// battle.js

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// ==================== STATE ====================
let battleData    = null;
let leaderboard   = [];
let participants  = [];
let refreshTimer  = null;
const BASE_URL    = '/api/battle';

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    setupUser();
    const code = getBattleCode();
    if (!code) {
        showToast('Kode Battle tidak ditemukan', 'error');
        hideLoading();
        return;
    }
    await loadBattle(code);
    await loadParticipants(code);
    setupEvents(code);

    // Auto-refresh setiap 10 detik selama battle aktif
    refreshTimer = setInterval(async () => {
        if (battleData?.battle?.status === 'active') {
            await loadBattle(code, true);
            await loadParticipants(code, true);
        }
    }, 10000);
});

// ==================== HELPERS ====================
function getBattleCode() {
    const params = new URLSearchParams(window.location.search);
    let code = params.get('code') || params.get('startapp') || '';
    if (code.startsWith('battle_')) code = code.replace('battle_', '');
    if (!code && tg?.initDataUnsafe?.start_param) {
        let p = tg.initDataUnsafe.start_param;
        if (p.startsWith('battle_')) p = p.replace('battle_', '');
        code = p;
    }
    return code;
}

function getUserData() {
    if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user;
    return { id: 12345, first_name: 'Test', username: 'testuser' };
}

function formatTime(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const H = String(d.getHours()).padStart(2,'0');
    const M = String(d.getMinutes()).padStart(2,'0');
    const S = String(d.getSeconds()).padStart(2,'0');
    return `${H}:${M}:${S}`;
}

function formatDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function timeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)  return `${s}d lalu`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m lalu`;
    const h = Math.floor(m / 60);
    return `${h}j lalu`;
}

function showToast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function hideLoading() {
    const ov = document.getElementById('loadingOverlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 300); }
}

// ==================== USER HEADER ====================
function setupUser() {
    const u = getUserData();
    const nameEl  = document.getElementById('userName');
    const unameEl = document.getElementById('userUsername');
    const avatarEl = document.getElementById('userAvatar');

    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    if (nameEl) nameEl.textContent = name || 'User';
    if (unameEl) unameEl.textContent = u.username ? `@${u.username}` : `ID: ${u.id}`;

    if (u.photo_url && avatarEl) {
        avatarEl.innerHTML = `<img src="${u.photo_url}" alt="avatar">`;
    }

    // Load user battle stats
    fetch(`${BASE_URL}/user-stats/${u.id}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.stats) {
                document.getElementById('statCreated').textContent     = data.stats.created || 0;
                document.getElementById('statParticipated').textContent = data.stats.participated || 0;
                document.getElementById('statWon').textContent         = data.stats.won || 0;
            }
        }).catch(() => {});
}

// ==================== LOAD BATTLE ====================
async function loadBattle(code, silent = false) {
    try {
        const res = await fetch(`${BASE_URL}/info/${code}`);
        const data = await res.json();

        if (!data.success) {
            if (!silent) showToast(data.error || 'Battle tidak ditemukan', 'error');
            hideLoading();
            return;
        }

        battleData  = data;
        leaderboard = data.leaderboard || [];
        renderBattleStatus(data.battle);
        renderLeaderboard(leaderboard, data.battle);
        hideLoading();
    } catch (e) {
        if (!silent) showToast('Gagal memuat data battle', 'error');
        hideLoading();
    }
}

// ==================== LOAD PARTICIPANTS ====================
async function loadParticipants(code, silent = false) {
    try {
        const res = await fetch(`${BASE_URL}/participants/${code}`);
        const data = await res.json();
        if (data.success) {
            participants = data.participants || [];
            renderParticipantsSummary(participants);
        }
    } catch (e) {
        if (!silent) console.error('Error loading participants:', e);
    }
}

// ==================== RENDER STATUS CARD ====================
function renderBattleStatus(battle) {
    if (!battle) return;

    document.getElementById('battleGroupName').textContent =
        battle.group_title || battle.group_username || `Group ID: ${battle.group_id}`;
    document.getElementById('deadlineMinutes').textContent = battle.deadline_minutes || 5;

    const badge    = document.getElementById('battleBadge');
    const badgeText = document.getElementById('battleBadgeText');
    const expired  = document.getElementById('expiredMessage');

    if (battle.is_ended || battle.status === 'ended') {
        badge.classList.add('ended');
        badgeText.textContent = 'Battle Selesai';
        expired.style.display = 'flex';
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    } else {
        badge.classList.remove('ended');
        badgeText.textContent = 'Battle Aktif';
        expired.style.display = 'none';
    }
}

// ==================== RENDER LEADERBOARD ====================
function renderLeaderboard(board, battle) {
    const container = document.getElementById('leaderboardList');
    if (!container) return;

    if (!board || board.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Belum ada pesan masuk di grup</p>
                <p style="font-size:12px;margin-top:6px">Kirim pesan di grup untuk masuk leaderboard!</p>
            </div>`;
        return;
    }

    const groupUsername = battle?.group_username || '';
    const rankColors    = ['gold', 'silver', 'bronze'];

    container.innerHTML = board.map((item, idx) => {
        const rank     = idx + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-n';
        const prizeColor = rankColors[idx] || '';

        const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

        const name   = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'User';
        const uname  = item.username ? `@${item.username}` : `ID: ${item.user_id}`;
        const initials = (name[0] || '?').toUpperCase();
        const timeStr  = formatTime(item.sent_at);
        const dateStr  = formatDate(item.sent_at);
        const ago      = timeAgo(item.sent_at);
        const preview  = item.message_text ? item.message_text.substring(0, 60) : '';

        // Link ke pesan Telegram jika group_username ada
        let msgLink = '';
        if (groupUsername && item.message_id) {
            msgLink = `https://t.me/${groupUsername}/${item.message_id}`;
        } else if (battle?.group_id && item.message_id) {
            const gid = String(battle.group_id).replace('-100', '');
            msgLink = `https://t.me/c/${gid}/${item.message_id}`;
        }

        const avatarHtml = item.photo_url
            ? `<img src="${item.photo_url}" alt="${name}" onerror="this.parentElement.innerHTML='${initials}'">`
            : initials;

        return `
        <div class="leaderboard-item ${rankClass}" onclick="openMessage('${msgLink}')">
            ${item.prize ? `<div class="prize-badge ${prizeColor}">🎁 ${item.prize}</div>` : ''}
            <div class="rank-badge ${rankClass}">${rankIcon}</div>
            <div class="user-avatar-sm">${avatarHtml}</div>
            <div class="user-info-lb">
                <div class="user-name-lb">${name}</div>
                <div class="user-uname-lb">${uname}</div>
                ${preview ? `<div class="msg-preview">"${preview}"</div>` : ''}
            </div>
            <div class="msg-time">
                <span class="time-text">${timeStr}</span>
                <span class="time-text" style="font-size:10px">${dateStr}</span>
                ${msgLink ? `
                <a class="open-link" href="${msgLink}" target="_blank" onclick="event.stopPropagation()">
                    <i class="fas fa-external-link-alt"></i> Buka
                </a>` : ''}
            </div>
        </div>`;
    }).join('');
}

function openMessage(link) {
    if (!link) return;
    if (tg) tg.openTelegramLink(link);
    else window.open(link, '_blank');
}

// ==================== RENDER PARTICIPANTS SUMMARY ====================
function renderParticipantsSummary(list) {
    const card = document.getElementById('participantsSummary');
    const countEl = document.getElementById('participantsCountText');
    const avatarsEl = document.getElementById('avatarsRow');
    if (!card || !list || list.length === 0) return;

    card.style.display = 'flex';
    countEl.textContent = `${list.length} Peserta`;

    const preview = list.slice(0, 5);
    avatarsEl.innerHTML = preview.map(p => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '?';
        const initials = name[0].toUpperCase();
        return p.photo_url
            ? `<div class="avatar-mini"><img src="${p.photo_url}" alt="${name}" onerror="this.parentElement.innerHTML='${initials}'"></div>`
            : `<div class="avatar-mini">${initials}</div>`;
    }).join('');
}

// ==================== RENDER PARTICIPANTS MODAL ====================
function renderParticipantsModal(list) {
    const container = document.getElementById('participantsList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Belum ada peserta</p>';
        return;
    }

    container.innerHTML = list.map(p => {
        const name   = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'User';
        const uname  = p.username ? `@${p.username}` : `ID: ${p.user_id}`;
        const initials = name[0].toUpperCase();
        const msgCount = p.message_count || 0;
        const lastAt   = p.last_message_at ? timeAgo(p.last_message_at) : '-';

        const avatarHtml = p.photo_url
            ? `<img src="${p.photo_url}" alt="${name}" onerror="this.parentElement.innerHTML='${initials}'">`
            : initials;

        return `
        <div class="participant-item">
            <div class="participant-avatar">${avatarHtml}</div>
            <div class="participant-info">
                <div class="participant-name">${name}</div>
                <div class="participant-meta">${uname} · ${msgCount} pesan · ${lastAt}</div>
            </div>
            ${p.is_winner ? `<span class="winner-chip">🏆 Menang</span>` : ''}
        </div>`;
    }).join('');
}

// ==================== EVENTS ====================
function setupEvents(code) {
    // Back to lobby
    document.getElementById('backToLobbyBtn')?.addEventListener('click', () => {
        if (tg) tg.close();
        else window.history.back();
    });

    // Refresh button
    document.getElementById('battleRefreshBtn')?.addEventListener('click', async () => {
        showToast('Memperbarui...', 'info');
        await loadBattle(code);
        await loadParticipants(code);
    });

    // See all participants
    document.getElementById('seeAllParticipantsBtn')?.addEventListener('click', () => {
        renderParticipantsModal(participants);
        document.getElementById('participantsModal').classList.add('active');
    });

    // Close participants modal
    document.getElementById('closeParticipantsModal')?.addEventListener('click', () => {
        document.getElementById('participantsModal').classList.remove('active');
    });

    document.getElementById('participantsModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });
}
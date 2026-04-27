// js/panel.js - ScamAction Panel JavaScript

// ─── Telegram WebApp initialization ──────────────────────────────────────────

const tg = window.Telegram?.WebApp;
let currentUserId    = null;
let currentMonitorChatId = null;

if (tg) {
    // Request fullscreen agar panel memenuhi layar penuh di WebApp
    tg.expand();
    if (typeof tg.requestFullscreen === 'function') {
        tg.requestFullscreen();
    }
    tg.ready();

    // Terapkan warna tema Telegram jika tersedia
    if (tg.themeParams) {
        const tp = tg.themeParams;
        if (tp.bg_color)         document.documentElement.style.setProperty('--tg-bg',      tp.bg_color);
        if (tp.secondary_bg_color) document.documentElement.style.setProperty('--tg-sec-bg', tp.secondary_bg_color);
        if (tp.text_color)       document.documentElement.style.setProperty('--tg-text',    tp.text_color);
        if (tp.button_color)     document.documentElement.style.setProperty('--primary',    tp.button_color);
    }

    if (tg.initDataUnsafe?.user) {
        currentUserId = tg.initDataUnsafe.user.id;
        document.getElementById('userId').textContent  = currentUserId;
        document.getElementById('userName').textContent =
            tg.initDataUnsafe.user.first_name + ' ' + (tg.initDataUnsafe.user.last_name || '');
    }
}

// ─── Base URL API — sesuai blueprint prefix /api/scamaction ──────────────────
const API = '/api/scamaction';

// ─── State ───────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';

// ─── DOM Elements ────────────────────────────────────────────────────────────
const pages      = document.querySelectorAll('.page');
const navItems   = document.querySelectorAll('.nav-item');
const pageTitle  = document.getElementById('pageTitle');
const refreshBtn = document.getElementById('refreshBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar    = document.getElementById('sidebar');

// ─── Navigation ──────────────────────────────────────────────────────────────
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage(item.dataset.page);
        // Tutup sidebar di mobile setelah navigasi
        sidebar.classList.remove('open');
    });
});

function switchPage(page) {
    currentPage = page;

    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    pages.forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });

    const titles = {
        dashboard: 'Dashboard',
        channels:  'Scan Channels',
        scanned:   'Scanned IDs',
        monitors:  'Monitor',
        reports:   'Laporan',
        alerts:    'Alert Logs',
        users:     'Users'
    };
    pageTitle.textContent = titles[page] || page;
    loadPageData(page);
}

function loadPageData(page) {
    switch (page) {
        case 'dashboard': loadDashboard();   break;
        case 'channels':  loadChannels();    break;
        case 'scanned':   loadScannedIds();  break;
        case 'monitors':  loadMonitors();    break;
        case 'reports':   loadReports();     break;
        case 'alerts':    loadAlerts();      break;
        case 'users':     loadUsers();       break;
    }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [statsRes, usersRes, alertsRes] = await Promise.all([
            fetch(`${API}/stats`),
            fetch(`${API}/users`),
            fetch(`${API}/alerts`)
        ]);

        const statsResult = await statsRes.json();
        if (statsResult.success) {
            const s = statsResult.data;
            document.getElementById('totalScammers').textContent     = s.total_scanned_ids    || 0;
            document.getElementById('totalScanChannels').textContent  = s.total_scan_channels  || 0;
            document.getElementById('totalMonitorActive').textContent = s.total_monitor_channels || 0;
            document.getElementById('totalAlerts').textContent        = s.total_alerts          || 0;
            document.getElementById('totalReports').textContent       = s.total_reports         || 0;
        }

        const usersResult = await usersRes.json();
        if (usersResult.success) {
            document.getElementById('totalUsers').textContent = usersResult.data.length;
        }

        const alertsResult = await alertsRes.json();
        if (alertsResult.success) {
            const alerts = alertsResult.data.slice(0, 10);
            const tbody  = document.getElementById('recentAlertsBody');
            tbody.innerHTML = alerts.length === 0
                ? '<tr><td colspan="3" class="text-center">No alerts</td></tr>'
                : alerts.map(a => `
                    <tr>
                        <td>${a.user_id}</td>
                        <td>${a.chat_name || '-'}</td>
                        <td>${new Date(a.triggered_at).toLocaleString()}</td>
                    </tr>`).join('');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ─── Channels ────────────────────────────────────────────────────────────────
async function loadChannels() {
    try {
        const result = await (await fetch(`${API}/channels`)).json();
        const tbody  = document.getElementById('channelsBody');

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No channels</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(ch => `
            <tr>
                <td>${ch.channel_id}</td>
                <td>${ch.channel_name || '-'}</td>
                <td>${ch.username ? '@' + ch.username : '-'}</td>
                <td>${new Date(ch.added_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteChannel(${ch.channel_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

async function deleteChannel(channelId) {
    if (!confirm('Hapus channel ini?')) return;
    try {
        const result = await (await fetch(`${API}/channels/${channelId}`, { method: 'DELETE' })).json();
        if (result.success) {
            loadChannels();
        } else {
            alert('Gagal menghapus channel');
        }
    } catch (error) {
        console.error('Error deleting channel:', error);
    }
}

document.getElementById('addChannelBtn')?.addEventListener('click', () => {
    document.getElementById('addChannelModal').classList.add('active');
});

document.getElementById('saveChannelBtn')?.addEventListener('click', async () => {
    const channelId   = document.getElementById('channelIdInput').value;
    const channelName = document.getElementById('channelNameInput').value;
    const username    = document.getElementById('channelUsernameInput').value;

    if (!channelId) { alert('Channel ID required'); return; }

    try {
        const result = await (await fetch(`${API}/channels`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel_id:   parseInt(channelId),
                channel_name: channelName,
                username:     username.replace('@', '')
            })
        })).json();

        if (result.success) {
            document.getElementById('addChannelModal').classList.remove('active');
            document.getElementById('channelIdInput').value       = '';
            document.getElementById('channelNameInput').value     = '';
            document.getElementById('channelUsernameInput').value = '';
            loadChannels();
        } else {
            alert('Gagal menambahkan channel');
        }
    } catch (error) {
        console.error('Error adding channel:', error);
    }
});

document.getElementById('resetChannelsBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset semua channel scan?')) return;
    try {
        const result = await (await fetch(`${API}/channels/reset`, { method: 'POST' })).json();
        if (result.success) loadChannels();
    } catch (error) {
        console.error('Error resetting channels:', error);
    }
});

// ─── Scanned IDs ─────────────────────────────────────────────────────────────
async function loadScannedIds(search = '') {
    try {
        const result = await (await fetch(`${API}/scanned`)).json();
        const tbody  = document.getElementById('scannedBody');

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center">No scanned IDs</td></tr>';
            return;
        }

        let ids = result.data;
        if (search) ids = ids.filter(id => id.toString().includes(search));

        tbody.innerHTML = ids.map(userId => `
            <tr>
                <td>${userId}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewScammerDetail(${userId})">
                        <i class="fas fa-eye"></i> Detail
                    </button>
                </td>
            </tr>`).join('');
    } catch (error) {
        console.error('Error loading scanned IDs:', error);
    }
}

document.getElementById('searchUserId')?.addEventListener('input', (e) => {
    loadScannedIds(e.target.value);
});

async function viewScammerDetail(userId) {
    try {
        const result = await (await fetch(`${API}/scanned/${userId}`)).json();

        if (result.success) {
            document.getElementById('detailUserId').textContent = userId;
            const refsList = document.getElementById('referencesList');

            refsList.innerHTML = result.data.length === 0
                ? '<p>Tidak ada referensi</p>'
                : result.data.map(ref => `
                    <div class="reference-item">
                        <span>${ref.channel_name || ref.channel_id}</span>
                        <a href="https://t.me/c/${String(ref.channel_id).replace('-100', '')}/${ref.msg_id}" target="_blank">
                            Lihat Pesan #${ref.msg_id}
                        </a>
                    </div>`).join('');

            document.getElementById('scammerDetailModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading scammer detail:', error);
    }
}

// ─── Monitors ────────────────────────────────────────────────────────────────
async function loadMonitors() {
    try {
        // Ambil semua monitor (bukan filter by user) agar admin juga kelihatan
        const result = await (await fetch(`${API}/monitor`)).json();
        const tbody  = document.getElementById('monitorsBody');

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No monitors</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(mon => `
            <tr>
                <td>${mon.chat_id}</td>
                <td>${mon.chat_name || '-'}</td>
                <td class="${mon.is_active ? 'status-active' : 'status-inactive'}">
                    ${mon.is_active ? 'Active' : 'Inactive'}
                </td>
                <td>${mon.added_by}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewMonitorDetail(${mon.chat_id})">
                        <i class="fas fa-cog"></i> Manage
                    </button>
                </td>
            </tr>`).join('');
    } catch (error) {
        console.error('Error loading monitors:', error);
    }
}

async function viewMonitorDetail(chatId) {
    currentMonitorChatId = chatId;
    try {
        const result = await (await fetch(`${API}/monitor/${chatId}`)).json();

        if (result.success) {
            const data = result.data;
            document.getElementById('monitorDetailTitle').textContent    = `Monitor: ${data.chat_name}`;
            document.getElementById('monitorChatId').textContent         = data.chat_id;
            document.getElementById('monitorChatName').textContent       = data.chat_name || '-';
            document.getElementById('monitorChatUsername').textContent   = data.chat_username ? '@' + data.chat_username : '-';
            document.getElementById('monitorStatus').textContent         = data.is_active ? 'Active' : 'Inactive';
            document.getElementById('monitorAddedBy').textContent        = data.added_by;

            // Warna tombol toggle
            const toggleBtn = document.getElementById('toggleMonitorBtn');
            toggleBtn.className = 'btn ' + (data.is_active ? 'btn-danger' : 'btn-primary');
            toggleBtn.textContent = data.is_active ? '🔴 Nonaktifkan' : '🟢 Aktifkan';

            loadAdmins(chatId);
            document.getElementById('monitorDetailModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading monitor detail:', error);
    }
}

async function loadAdmins(chatId) {
    try {
        const result    = await (await fetch(`${API}/monitor/${chatId}/admins`)).json();
        const adminList = document.getElementById('adminList');

        adminList.innerHTML = (!result.success || result.data.length === 0)
            ? '<p>Tidak ada admin</p>'
            : result.data.map(admin => `
                <div class="admin-item">
                    <span>User ID: ${admin.user_id}</span>
                    <button onclick="removeAdmin(${chatId}, ${admin.user_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`).join('');
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

async function removeAdmin(chatId, userId) {
    try {
        const result = await (await fetch(`${API}/monitor/${chatId}/admins/${userId}`, { method: 'DELETE' })).json();
        if (result.success) loadAdmins(chatId);
    } catch (error) {
        console.error('Error removing admin:', error);
    }
}

document.getElementById('toggleMonitorBtn')?.addEventListener('click', async () => {
    if (!currentMonitorChatId) return;
    try {
        const result = await (await fetch(`${API}/monitor/${currentMonitorChatId}/toggle`, { method: 'POST' })).json();
        if (result.success) {
            viewMonitorDetail(currentMonitorChatId);
            loadMonitors();
        }
    } catch (error) {
        console.error('Error toggling monitor:', error);
    }
});

document.getElementById('addAdminBtn')?.addEventListener('click', async () => {
    const userId = document.getElementById('newAdminId').value;
    if (!userId || !currentMonitorChatId) return;
    try {
        const result = await (await fetch(`${API}/monitor/${currentMonitorChatId}/admins`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId) })
        })).json();

        if (result.success) {
            document.getElementById('newAdminId').value = '';
            loadAdmins(currentMonitorChatId);
        } else {
            alert('Gagal menambahkan admin');
        }
    } catch (error) {
        console.error('Error adding admin:', error);
    }
});

document.getElementById('resetAdminsBtn')?.addEventListener('click', async () => {
    if (!currentMonitorChatId || !confirm('Reset semua admin?')) return;
    try {
        const result = await (await fetch(`${API}/monitor/${currentMonitorChatId}/admins/reset`, { method: 'POST' })).json();
        if (result.success) loadAdmins(currentMonitorChatId);
    } catch (error) {
        console.error('Error resetting admins:', error);
    }
});

// ─── Reports ─────────────────────────────────────────────────────────────────
async function loadReports() {
    try {
        const url    = currentUserId ? `${API}/reports?user_id=${currentUserId}` : `${API}/reports`;
        const result = await (await fetch(url)).json();
        const tbody  = document.getElementById('reportsBody');

        tbody.innerHTML = (!result.success || result.data.length === 0)
            ? '<tr><td colspan="4" class="text-center">No reports</td></tr>'
            : result.data.map(report => `
                <tr>
                    <td>${report.id}</td>
                    <td>${report.user_id}</td>
                    <td>${report.status}</td>
                    <td>${new Date(report.created_at).toLocaleString()}</td>
                </tr>`).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
async function loadAlerts() {
    try {
        const result = await (await fetch(`${API}/alerts`)).json();
        const tbody  = document.getElementById('alertsBody');

        tbody.innerHTML = (!result.success || result.data.length === 0)
            ? '<tr><td colspan="3" class="text-center">No alerts</td></tr>'
            : result.data.map(a => `
                <tr>
                    <td>${a.user_id}</td>
                    <td>${a.chat_name || '-'}</td>
                    <td>${new Date(a.triggered_at).toLocaleString()}</td>
                </tr>`).join('');
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// ─── Users ───────────────────────────────────────────────────────────────────
async function loadUsers() {
    try {
        const result = await (await fetch(`${API}/users`)).json();
        const tbody  = document.getElementById('usersBody');

        tbody.innerHTML = (!result.success || result.data.length === 0)
            ? '<tr><td colspan="5" class="text-center">No users</td></tr>'
            : result.data.map(user => `
                <tr>
                    <td>${user.user_id}</td>
                    <td>${user.fullname || '-'}</td>
                    <td>${user.username ? '@' + user.username : '-'}</td>
                    <td>${new Date(user.first_start).toLocaleString()}</td>
                    <td>${new Date(user.last_start).toLocaleString()}</td>
                </tr>`).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', () => loadPageData(currentPage));

// ─── Modal close handlers ────────────────────────────────────────────────────
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
});

// ─── Menu toggle mobile ──────────────────────────────────────────────────────
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Tutup sidebar saat klik di luar (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== menuToggle) {
        sidebar.classList.remove('open');
    }
});

// ─── Initial load ────────────────────────────────────────────────────────────
loadDashboard();

// ─── Expose globals untuk inline onclick ────────────────────────────────────
window.deleteChannel      = deleteChannel;
window.viewScammerDetail  = viewScammerDetail;
window.viewMonitorDetail  = viewMonitorDetail;
window.removeAdmin        = removeAdmin;
// lobby.js - Halaman Landing Page Giveaway Bot

(function() {
    'use strict';
    
    console.log('🏠 Lobby Page - Initializing...');

    const API_BASE_URL = window.location.origin;

    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        // Profile
        profileAvatar: document.getElementById('profileAvatar'),
        profileName: document.getElementById('profileName'),
        profileUsername: document.getElementById('profileUsername'),
        profileId: document.getElementById('profileId'),
        
        // User Stats
        userStatCreated: document.getElementById('userStatCreated'),
        userStatParticipated: document.getElementById('userStatParticipated'),
        userStatWon: document.getElementById('userStatWon'),
        
        // Bot Stats
        statTotalUsers: document.getElementById('statTotalUsers'),
        statTotalGiveaways: document.getElementById('statTotalGiveaways'),
        statTotalParticipants: document.getElementById('statTotalParticipants'),
        statTotalWinners: document.getElementById('statTotalWinners'),
        statActiveGiveaways: document.getElementById('statActiveGiveaways'),
        statTodayParticipants: document.getElementById('statTodayParticipants'),
        
        // Detail Stats
        detailGiveawaysToday: document.getElementById('detailGiveawaysToday'),
        detailGiveawaysWeek: document.getElementById('detailGiveawaysWeek'),
        detailGiveawaysMonth: document.getElementById('detailGiveawaysMonth'),
        detailUniqueParticipants: document.getElementById('detailUniqueParticipants'),
        detailAvgParticipants: document.getElementById('detailAvgParticipants'),
        detailTotalAdmins: document.getElementById('detailTotalAdmins'),
        
        // Owner
        ownerName: document.getElementById('ownerName'),
        ownerUsername: document.getElementById('ownerUsername'),
        ownerAvatarSmall: document.getElementById('ownerAvatarSmall'),
        
        // Force Subs
        forceSubsList: document.getElementById('forceSubsList'),
        
        // Recent Giveaways
        recentGiveaways: document.getElementById('recentGiveaways'),
        
        // Buttons
        refreshStatsBtn: document.getElementById('refreshStatsBtn'),
        openBotBtn: document.getElementById('openBotBtn'),
        openGiveawayBtn: document.getElementById('openGiveawayBtn'),
        contactOwnerBtn: document.getElementById('contactOwnerBtn'),
        officialChannelBtn: document.getElementById('officialChannelBtn'),
        helpBtn: document.getElementById('helpBtn'),
        ctaOpenBotBtn: document.getElementById('ctaOpenBotBtn'),
        viewAllGiveawaysBtn: document.getElementById('viewAllGiveawaysBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        else hapticLight();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '--';
        return num.toLocaleString('id-ID');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== TELEGRAM USER ====================
    
    function getTelegramUser() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    return {
                        id: initData.user.id,
                        username: initData.user.username || '',
                        first_name: initData.user.first_name || '',
                        last_name: initData.user.last_name || '',
                        photo_url: initData.user.photo_url || null
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    function updateProfileUI(telegramUser) {
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || 'Pengguna Telegram';
        
        if (elements.profileName) elements.profileName.textContent = fullName;
        if (elements.profileUsername) elements.profileUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        if (elements.profileId) elements.profileId.textContent = `ID: ${telegramUser.id}`;
        
        const avatarContainer = elements.profileAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" alt="${escapeHtml(fullName)}">`;
            } else {
                const nameForAvatar = encodeURIComponent(fullName.substring(0, 2));
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=128&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(fullName)}">`;
            }
        }
    }

    // ==================== API FUNCTIONS ====================
    
    async function fetchWithRetry(url, options, retries = 3) {
        try {
            const response = await fetch(url, { 
                ...options, 
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } 
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function loadUserStats(userId) {
        if (!userId) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/user-stats/${userId}`, { method: 'GET' });
            
            if (response.success) {
                if (elements.userStatCreated) elements.userStatCreated.textContent = formatNumber(response.created_count || 0);
                if (elements.userStatParticipated) elements.userStatParticipated.textContent = formatNumber(response.participated_count || 0);
                if (elements.userStatWon) elements.userStatWon.textContent = formatNumber(response.won_count || 0);
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    async function loadBotStatistics() {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/lobby-stats`, { method: 'GET' });
            
            if (response.success) {
                const stats = response.stats;
                
                // Main Stats
                if (elements.statTotalUsers) elements.statTotalUsers.textContent = formatNumber(stats.total_users);
                if (elements.statTotalGiveaways) elements.statTotalGiveaways.textContent = formatNumber(stats.total_giveaways);
                if (elements.statTotalParticipants) elements.statTotalParticipants.textContent = formatNumber(stats.total_participants);
                if (elements.statTotalWinners) elements.statTotalWinners.textContent = formatNumber(stats.total_winners);
                if (elements.statActiveGiveaways) elements.statActiveGiveaways.textContent = formatNumber(stats.active_giveaways);
                if (elements.statTodayParticipants) elements.statTodayParticipants.textContent = formatNumber(stats.today_participants);
                
                // Detail Stats
                if (elements.detailGiveawaysToday) elements.detailGiveawaysToday.textContent = formatNumber(stats.giveaways_today);
                if (elements.detailGiveawaysWeek) elements.detailGiveawaysWeek.textContent = formatNumber(stats.giveaways_week);
                if (elements.detailGiveawaysMonth) elements.detailGiveawaysMonth.textContent = formatNumber(stats.giveaways_month);
                if (elements.detailUniqueParticipants) elements.detailUniqueParticipants.textContent = formatNumber(stats.unique_participants);
                if (elements.detailAvgParticipants) elements.detailAvgParticipants.textContent = stats.avg_participants_per_giveaway || '0';
                if (elements.detailTotalAdmins) elements.detailTotalAdmins.textContent = formatNumber(stats.total_admins);
                
                return true;
            } else {
                console.error('Failed to load statistics:', response.error);
                return false;
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            return false;
        }
    }

    async function loadOwnerInfo() {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/owner-info`, { method: 'GET' });
            
            if (response.success && response.owner) {
                if (elements.ownerName) elements.ownerName.textContent = response.owner.name || 'Administrator';
                if (elements.ownerUsername) elements.ownerUsername.textContent = response.owner.username ? `@${response.owner.username}` : 'Owner';
                
                // Update owner avatar
                if (elements.ownerAvatarSmall && response.owner.photo_url) {
                    elements.ownerAvatarSmall.innerHTML = `<img src="${response.owner.photo_url}" alt="Owner">`;
                } else if (elements.ownerAvatarSmall) {
                    const nameForAvatar = encodeURIComponent((response.owner.name || 'O').substring(0, 2));
                    const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=96&rounded=true&bold=true&length=2`;
                    elements.ownerAvatarSmall.innerHTML = `<img src="${avatarUrl}" alt="Owner">`;
                }
                return response.owner;
            }
        } catch (error) {
            console.error('Error loading owner info:', error);
        }
        
        // Fallback
        if (elements.ownerName) elements.ownerName.textContent = 'Administrator';
        if (elements.ownerUsername) elements.ownerUsername.textContent = '@owner';
        return null;
    }

    async function loadForceSubs() {
        if (!elements.forceSubsList) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/force-subs`, { method: 'GET' });
            
            if (response.success && response.force_subs && response.force_subs.length > 0) {
                let html = '';
                for (const fs of response.force_subs) {
                    const title = fs.title || fs.chat_id;
                    const link = fs.invite_link || (fs.username ? `https://t.me/${fs.username}` : null);
                    
                    html += `
                        <div class="force-sub-item">
                            <i class="fas fa-telegram"></i>
                            <span class="force-sub-name">${escapeHtml(title)}</span>
                            ${link ? `<a href="${link}" target="_blank" class="force-sub-link" onclick="event.stopPropagation()">Join</a>` : ''}
                        </div>
                    `;
                }
                elements.forceSubsList.innerHTML = html;
            } else {
                elements.forceSubsList.innerHTML = '<div class="loading-placeholder">Tidak ada force subs aktif</div>';
            }
        } catch (error) {
            console.error('Error loading force subs:', error);
            elements.forceSubsList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    async function loadRecentGiveaways() {
        if (!elements.recentGiveaways) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/recent-giveaways?limit=5`, { method: 'GET' });
            
            if (response.success && response.giveaways && response.giveaways.length > 0) {
                let html = '';
                for (const gw of response.giveaways) {
                    const prizePreview = gw.prize_lines && gw.prize_lines.length > 0 
                        ? gw.prize_lines[0].substring(0, 30) + (gw.prize_lines[0].length > 30 ? '...' : '')
                        : 'Hadiah giveaway';
                    
                    html += `
                        <div class="recent-giveaway-item" data-giveaway-code="${gw.giveaway_code}">
                            <div class="recent-giveaway-icon">
                                <i class="fas fa-gift"></i>
                            </div>
                            <div class="recent-giveaway-info">
                                <div class="recent-giveaway-title">${escapeHtml(prizePreview)}</div>
                                <div class="recent-giveaway-meta">
                                    <span><i class="fas fa-users"></i> ${gw.participants_count || 0} peserta</span>
                                    <span><i class="fas fa-clock"></i> ${formatDate(gw.created_at)}</span>
                                </div>
                            </div>
                            <div class="recent-giveaway-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    `;
                }
                elements.recentGiveaways.innerHTML = html;
                
                document.querySelectorAll('.recent-giveaway-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const giveawayCode = item.dataset.giveawayCode;
                        if (giveawayCode) {
                            hapticMedium();
                            window.location.href = `/giveaways?id=${giveawayCode}`;
                        }
                    });
                });
            } else {
                elements.recentGiveaways.innerHTML = '<div class="loading-placeholder">Belum ada giveaway</div>';
            }
        } catch (error) {
            console.error('Error loading recent giveaways:', error);
            elements.recentGiveaways.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days === 0) return 'Hari ini';
            if (days === 1) return 'Kemarin';
            if (days < 7) return `${days} hari lalu`;
            return date.toLocaleDateString('id-ID');
        } catch {
            return '-';
        }
    }

    // ==================== EVENT HANDLERS ====================
    
    async function refreshAllData() {
        hapticMedium();
        showToast('Memperbarui data...', 'info', 1500);
        
        if (elements.refreshStatsBtn) {
            elements.refreshStatsBtn.classList.add('loading');
            elements.refreshStatsBtn.disabled = true;
        }
        
        const telegramUser = getTelegramUser();
        await Promise.all([
            loadBotStatistics(),
            loadForceSubs(),
            loadRecentGiveaways(),
            telegramUser ? loadUserStats(telegramUser.id) : Promise.resolve()
        ]);
        
        if (elements.refreshStatsBtn) {
            elements.refreshStatsBtn.classList.remove('loading');
            elements.refreshStatsBtn.disabled = false;
        }
        
        showToast('Data berhasil diperbarui!', 'success');
    }

    function openBot() {
        hapticMedium();
        window.open('https://t.me/freebiestbot', '_blank');
    }

    function openGiveawayInput() {
        hapticMedium();
        const code = prompt('Masukkan kode giveaway:');
        if (code && code.trim()) {
            window.location.href = `/giveaways?id=${code.trim()}`;
        }
    }

    function contactOwner() {
        hapticMedium();
        window.open('https://t.me/giftfreebies', '_blank');
    }

    function joinOfficialChannel() {
        hapticMedium();
        window.open('https://t.me/giftfreebies', '_blank');
    }

    function openHelp() {
        hapticMedium();
        showToast('Bantuan akan segera tersedia', 'info');
    }

    // ==================== INITIALIZATION ====================
    
    function initTelegram() {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0f0f0f');
            tg.setBackgroundColor('#0f0f0f');
            console.log('✅ Telegram WebApp initialized');
        }
    }

    function setupEventListeners() {
        if (elements.refreshStatsBtn) {
            elements.refreshStatsBtn.addEventListener('click', refreshAllData);
        }
        if (elements.openBotBtn) {
            elements.openBotBtn.addEventListener('click', openBot);
        }
        if (elements.openGiveawayBtn) {
            elements.openGiveawayBtn.addEventListener('click', openGiveawayInput);
        }
        if (elements.contactOwnerBtn) {
            elements.contactOwnerBtn.addEventListener('click', contactOwner);
        }
        if (elements.officialChannelBtn) {
            elements.officialChannelBtn.addEventListener('click', joinOfficialChannel);
        }
        if (elements.helpBtn) {
            elements.helpBtn.addEventListener('click', openHelp);
        }
        if (elements.ctaOpenBotBtn) {
            elements.ctaOpenBotBtn.addEventListener('click', openBot);
        }
        if (elements.viewAllGiveawaysBtn) {
            elements.viewAllGiveawaysBtn.addEventListener('click', () => {
                hapticMedium();
                const recentSection = document.getElementById('recentGiveaways');
                if (recentSection) {
                    recentSection.scrollIntoView({ behavior: 'smooth' });
                    showToast('Silakan pilih giveaway dari daftar di atas', 'info');
                } else {
                    showToast('Daftar giveaway sudah ditampilkan di atas', 'info');
                }
            });
        }
    }

    async function init() {
        initTelegram();
        showLoading(true);
        
        setupEventListeners();
        
        const telegramUser = getTelegramUser();
        if (telegramUser) {
            updateProfileUI(telegramUser);
            await loadUserStats(telegramUser.id);
        }
        
        await Promise.all([
            loadBotStatistics(),
            loadOwnerInfo(),
            loadForceSubs(),
            loadRecentGiveaways()
        ]);
        
        showLoading(false);
        console.log('✅ Lobby page initialized');
    }

    // Start initialization
    init();
})();
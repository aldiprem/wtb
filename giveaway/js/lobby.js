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

    // ==================== PAGE MANAGEMENT ====================

    let currentPage = 'dashboard';

    function showPage(pageId) {
        // Sembunyikan semua page container
        document.querySelectorAll('.page-container').forEach(container => {
            container.classList.remove('active');
        });
        
        // Tampilkan page yang dipilih
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Update active menu item
        document.querySelectorAll('.sidebar-menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            }
        });
        
        currentPage = pageId;
        
        // Load data sesuai page
        if (pageId === 'bot-stats') {
            renderBotStatsCharts();
        } else if (pageId === 'user-stats') {
            renderUserStatsCharts();
        } else if (pageId === 'dashboard') {
            loadBotStatistics();
            loadRecentGiveaways();
            loadUserStats(telegramUser?.id);
        }
    }

    // ==================== SIDEBAR FUNCTIONS ====================

    function initSidebar() {
        const menuBtn = document.getElementById('menuBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const sidebarDrawer = document.getElementById('sidebarDrawer');
        const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
        
        if (!menuBtn || !sidebarOverlay || !sidebarDrawer) return;
        
        function openSidebar() {
            hapticMedium();
            sidebarDrawer.classList.add('open');
            sidebarOverlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        function closeSidebar() {
            hapticLight();
            sidebarDrawer.classList.remove('open');
            sidebarOverlay.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        menuBtn.addEventListener('click', openSidebar);
        sidebarCloseBtn.addEventListener('click', closeSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
        
        // Setup menu items
        document.querySelectorAll('.sidebar-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (page) {
                    showPage(page);
                    closeSidebar();
                }
            });
        });
    }

    function updateSidebarUser(telegramUser) {
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarUsername = document.getElementById('sidebarUserUsername');
        
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || 'Pengguna Telegram';
        
        if (sidebarName) sidebarName.textContent = fullName;
        if (sidebarUsername) sidebarUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        
        if (sidebarAvatar) {
            if (telegramUser.photo_url) {
                sidebarAvatar.innerHTML = `<img src="${telegramUser.photo_url}" alt="Avatar">`;
            } else {
                const nameForAvatar = encodeURIComponent(fullName.substring(0, 2));
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=96&rounded=true&bold=true&length=2`;
                sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
            }
        }
    }

    // ==================== BOTTOM SHEET FUNCTIONS ====================

    let bottomSheet = null;
    let bottomSheetOverlay = null;

    function initBottomSheet() {
        // Buat bottom sheet element jika belum ada
        if (document.getElementById('bottomSheet')) return;
        
        const bottomSheetHtml = `
            <div class="bottom-sheet-overlay" id="bottomSheetOverlay"></div>
            <div class="bottom-sheet" id="bottomSheet">
                <div class="bottom-sheet-header">
                    <h3 id="bottomSheetTitle">Semua Giveaway</h3>
                    <button class="bottom-sheet-close" id="bottomSheetCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="bottom-sheet-body" id="bottomSheetBody">
                    <div class="loading-placeholder">Memuat...</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', bottomSheetHtml);
        
        bottomSheet = document.getElementById('bottomSheet');
        bottomSheetOverlay = document.getElementById('bottomSheetOverlay');
        const closeBtn = document.getElementById('bottomSheetCloseBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeBottomSheet);
        }
        if (bottomSheetOverlay) {
            bottomSheetOverlay.addEventListener('click', closeBottomSheet);
        }
    }

    function openBottomSheet(title, contentHtml) {
        initBottomSheet();
        
        const titleEl = document.getElementById('bottomSheetTitle');
        const bodyEl = document.getElementById('bottomSheetBody');
        
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = contentHtml;
        
        if (bottomSheetOverlay) bottomSheetOverlay.style.display = 'block';
        if (bottomSheet) {
            bottomSheet.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeBottomSheet() {
        if (bottomSheetOverlay) bottomSheetOverlay.style.display = 'none';
        if (bottomSheet) {
            bottomSheet.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    // ==================== SHOW ALL GIVEAWAYS ====================

    async function showAllGiveaways() {
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/all-giveaways`, { method: 'GET' });
            
            if (response.success && response.giveaways && response.giveaways.length > 0) {
                let html = '<div class="all-giveaways-list">';
                
                for (const gw of response.giveaways) {
                    const prizePreview = gw.prize_lines && gw.prize_lines.length > 0 
                        ? gw.prize_lines[0].substring(0, 40) + (gw.prize_lines[0].length > 40 ? '...' : '')
                        : 'Hadiah giveaway';
                    const statusBadge = gw.status === 'active' ? '🟢 Aktif' : '🔴 Berakhir';
                    
                    html += `
                        <div class="all-giveaway-item" data-giveaway-code="${gw.giveaway_code}" data-status="${gw.status}">
                            <div class="all-giveaway-icon">
                                <i class="fas fa-gift"></i>
                            </div>
                            <div class="all-giveaway-info">
                                <div class="all-giveaway-title">${escapeHtml(prizePreview)}</div>
                                <div class="all-giveaway-meta">
                                    <span><i class="fas fa-users"></i> ${gw.participants_count || 0} peserta</span>
                                    <span><i class="fas fa-clock"></i> ${formatDate(gw.created_at)}</span>
                                    <span>${statusBadge}</span>
                                </div>
                            </div>
                            <div class="all-giveaway-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    `;
                }
                
                html += '</div>';
                
                if (response.giveaways.length === 0) {
                    html = '<div class="loading-placeholder">Belum ada giveaway</div>';
                }
                
                openBottomSheet('Semua Giveaway', html);
                
                // Event listener untuk item giveaway
                document.querySelectorAll('.all-giveaway-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const giveawayCode = item.dataset.giveawayCode;
                        const status = item.dataset.status;
                        if (giveawayCode) {
                            hapticMedium();
                            closeBottomSheet();
                            if (status === 'active') {
                                window.location.href = `/giveaways?id=${giveawayCode}`;
                            } else {
                                showToast('Giveaway ini sudah berakhir', 'warning');
                            }
                        }
                    });
                });
            } else {
                openBottomSheet('Semua Giveaway', '<div class="loading-placeholder">Belum ada giveaway</div>');
            }
        } catch (error) {
            console.error('Error loading all giveaways:', error);
            openBottomSheet('Semua Giveaway', '<div class="loading-placeholder">Gagal memuat data</div>');
        } finally {
            showLoading(false);
        }
    }

    // ==================== CHART FUNCTIONS ====================

    let botStatsChart = null;
    let userStatsChart = null;

    async function renderBotStatsCharts() {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/chart-data`, { method: 'GET' });
            
            if (!response.success) return;
            
            const ctx = document.getElementById('botStatsCanvas');
            if (!ctx) return;
            
            if (botStatsChart) {
                botStatsChart.destroy();
            }
            
            // Load Chart.js if not available
            if (typeof Chart === 'undefined') {
                await loadChartJs();
            }
            
            botStatsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: response.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                    datasets: [
                        {
                            label: 'Giveaway Dibuat',
                            data: response.giveaways_created || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            borderColor: '#40a7e3',
                            backgroundColor: 'rgba(64, 167, 227, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Total Peserta',
                            data: response.total_participants || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#ffffff', font: { size: 11 } }
                        },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#a0a0a0' } },
                        x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error rendering bot stats chart:', error);
        }
    }

    async function renderUserStatsCharts() {
        if (!telegramUser) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/user-chart-data/${telegramUser.id}`, { method: 'GET' });
            
            if (!response.success) return;
            
            const ctx = document.getElementById('userStatsCanvas');
            if (!ctx) return;
            
            if (userStatsChart) {
                userStatsChart.destroy();
            }
            
            if (typeof Chart === 'undefined') {
                await loadChartJs();
            }
            
            userStatsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: response.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                    datasets: [
                        {
                            label: 'Giveaway Diikuti',
                            data: response.participated || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            backgroundColor: '#40a7e3',
                            borderRadius: 8,
                            borderSkipped: false
                        },
                        {
                            label: 'Giveaway Dimenangkan',
                            data: response.won || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            backgroundColor: '#f59e0b',
                            borderRadius: 8,
                            borderSkipped: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#ffffff', font: { size: 11 } }
                        }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#a0a0a0', stepSize: 1 } },
                        x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error rendering user stats chart:', error);
        }
    }

    function loadChartJs() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }

    // ==================== PAGE CONTAINERS ====================

    function createPageContainers() {
        const lobbyContainer = document.querySelector('.lobby-container');
        if (!lobbyContainer) return;
        
        // Sembunyikan konten asli dan pindahkan ke page-dashboard
        const originalContent = lobbyContainer.innerHTML;
        
        const pagesHtml = `
            <div class="page-container active" id="page-dashboard">
                ${originalContent}
            </div>
            <div class="page-container" id="page-bot-stats">
                <div class="stats-section" style="margin-top: 60px;">
                    <div class="section-header">
                        <i class="fas fa-chart-line"></i>
                        <h2>Statistik Bot</h2>
                    </div>
                    <div class="chart-container">
                        <div class="chart-title">📊 Trend Giveaway & Peserta</div>
                        <canvas id="botStatsCanvas" class="chart-canvas"></canvas>
                    </div>
                </div>
            </div>
            <div class="page-container" id="page-user-stats">
                <div class="stats-section" style="margin-top: 60px;">
                    <div class="section-header">
                        <i class="fas fa-user-chart"></i>
                        <h2>Statistik Personal</h2>
                    </div>
                    <div class="chart-container">
                        <div class="chart-title">📊 Aktivitas Giveaway Anda</div>
                        <canvas id="userStatsCanvas" class="chart-canvas"></canvas>
                    </div>
                    <div class="info-card full-width" style="margin-top: 16px;">
                        <div class="card-header-flex">
                            <div class="card-icon-small"><i class="fas fa-chart-simple"></i></div>
                            <h3>Ringkasan</h3>
                        </div>
                        <div class="detail-stats" id="userDetailStats"></div>
                    </div>
                </div>
            </div>
            <div class="page-container" id="page-social">
                <div class="stats-section" style="margin-top: 60px;">
                    <div class="section-header">
                        <i class="fas fa-share-alt"></i>
                        <h2>Sosial Resmi</h2>
                    </div>
                    <div class="social-links" id="socialLinksContainer"></div>
                </div>
            </div>
            <div class="page-container" id="page-help">
                <div class="stats-section" style="margin-top: 60px;">
                    <div class="section-header">
                        <i class="fas fa-question-circle"></i>
                        <h2>Bantuan & Panduan</h2>
                    </div>
                    <div class="info-card full-width">
                        <ul class="help-list" style="margin-bottom: 0;">
                            <li><i class="fas fa-check-circle"></i> <strong>Cara Membuat Giveaway:</strong> Buka bot @freebiestbot, klik "Buat Giveaway", isi hadiah, chat target, durasi, dan syarat</li>
                            <li><i class="fas fa-check-circle"></i> <strong>Cara Berpartisipasi:</strong> Klik tombol "Ikuti Giveaway" pada pesan giveaway, penuhi syarat, lalu klik "Partisipasi"</li>
                            <li><i class="fas fa-check-circle"></i> <strong>Syarat & Ketentuan:</strong> Peserta harus mengikuti semua syarat yang ditentukan, pemenang dipilih secara acak</li>
                            <li><i class="fas fa-check-circle"></i> <strong>FAQ:</strong> Jika ada masalah, hubungi admin di @giftfreebies</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="page-container" id="page-about">
                <div class="stats-section" style="margin-top: 60px;">
                    <div class="section-header">
                        <i class="fas fa-info-circle"></i>
                        <h2>Tentang Giveaway Bot</h2>
                    </div>
                    <div class="info-card full-width">
                        <p style="margin-bottom: 12px;">Giveaway Bot adalah platform giveaway terpercaya di Telegram yang memudahkan Anda membuat dan mengikuti giveaway dengan mudah.</p>
                        <p style="margin-bottom: 12px;"><strong>Fitur Unggulan:</strong></p>
                        <ul style="margin-left: 20px; margin-bottom: 12px; color: var(--text-secondary);">
                            <li>✅ Multiple hadiah dalam satu giveaway</li>
                            <li>✅ Multiple chat target (channel/group)</li>
                            <li>✅ Sistem captcha anti-bot</li>
                            <li>✅ Force subscribe otomatis</li>
                            <li>✅ Tracking partisipasi real-time</li>
                        </ul>
                        <p>Version 2.0.0 | © 2024 Giveaway Bot</p>
                    </div>
                </div>
            </div>
        `;
        
        lobbyContainer.innerHTML = pagesHtml;
    }

    // ==================== UPDATE VIEW ALL BUTTON ====================

    function updateViewAllButton() {
        const viewAllBtn = document.getElementById('viewAllGiveawaysBtn');
        if (viewAllBtn) {
            // Hapus event listener lama
            const newBtn = viewAllBtn.cloneNode(true);
            viewAllBtn.parentNode.replaceChild(newBtn, viewAllBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showAllGiveaways();
            });
        }
    }

    // ==================== LOAD SOCIAL LINKS ====================

    async function loadSocialLinks() {
        const container = document.getElementById('socialLinksContainer');
        if (!container) return;
        
        const socialLinks = [
            { name: 'Owner', username: 'giftfreebies', desc: 'Hubungi owner untuk bantuan', icon: 'fas fa-crown' },
            { name: 'Channel Resmi', username: 'giftfreebies', desc: 'Info giveaway terbaru', icon: 'fab fa-telegram' },
            { name: 'Bot Giveaway', username: 'freebiestbot', desc: 'Buat giveaway sendiri', icon: 'fas fa-robot' },
            { name: 'Support Group', username: 'giftfreebies', desc: 'Tempat diskusi dan bantuan', icon: 'fas fa-users' }
        ];
        
        let html = '';
        for (const link of socialLinks) {
            html += `
                <div class="social-link-item" data-link="https://t.me/${link.username}">
                    <div class="social-link-icon">
                        <i class="${link.icon}"></i>
                    </div>
                    <div class="social-link-info">
                        <div class="social-link-name">${link.name}</div>
                        <div class="social-link-desc">${link.desc}</div>
                    </div>
                    <div class="social-link-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        document.querySelectorAll('.social-link-item').forEach(item => {
            item.addEventListener('click', () => {
                const link = item.dataset.link;
                if (link) {
                    hapticMedium();
                    window.open(link, '_blank');
                }
            });
        });
    }

    // ==================== LOAD USER DETAIL STATS ====================

    async function loadUserDetailStats() {
        if (!telegramUser) return;
        
        const container = document.getElementById('userDetailStats');
        if (!container) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/user-stats/${telegramUser.id}`, { method: 'GET' });
            
            if (response.success) {
                container.innerHTML = `
                    <div class="detail-stat-item">
                        <span class="detail-label">Giveaway Dibuat:</span>
                        <span class="detail-value">${response.created_count || 0}</span>
                    </div>
                    <div class="detail-stat-item">
                        <span class="detail-label">Giveaway Diikuti:</span>
                        <span class="detail-value">${response.participated_count || 0}</span>
                    </div>
                    <div class="detail-stat-item">
                        <span class="detail-label">Giveaway Dimenangkan:</span>
                        <span class="detail-value">${response.won_count || 0}</span>
                    </div>
                    <div class="detail-stat-item">
                        <span class="detail-label">Win Rate:</span>
                        <span class="detail-value">${response.participated_count > 0 ? Math.round((response.won_count / response.participated_count) * 100) : 0}%</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading user detail stats:', error);
        }
    }

    // ==================== MODIFIED INIT FUNCTION ====================

    async function init() {
        initTelegram();
        
        showLoading(true);
        
        // Buat page containers terlebih dahulu
        createPageContainers();
        
        // Re-get elements setelah DOM berubah
        elements.profileAvatar = document.getElementById('profileAvatar');
        elements.profileName = document.getElementById('profileName');
        elements.profileUsername = document.getElementById('profileUsername');
        elements.profileId = document.getElementById('profileId');
        elements.userStatCreated = document.getElementById('userStatCreated');
        elements.userStatParticipated = document.getElementById('userStatParticipated');
        elements.userStatWon = document.getElementById('userStatWon');
        elements.statTotalUsers = document.getElementById('statTotalUsers');
        elements.statTotalGiveaways = document.getElementById('statTotalGiveaways');
        elements.statTotalParticipants = document.getElementById('statTotalParticipants');
        elements.statTotalWinners = document.getElementById('statTotalWinners');
        elements.statActiveGiveaways = document.getElementById('statActiveGiveaways');
        elements.statTodayParticipants = document.getElementById('statTodayParticipants');
        elements.detailGiveawaysToday = document.getElementById('detailGiveawaysToday');
        elements.detailGiveawaysWeek = document.getElementById('detailGiveawaysWeek');
        elements.detailGiveawaysMonth = document.getElementById('detailGiveawaysMonth');
        elements.detailUniqueParticipants = document.getElementById('detailUniqueParticipants');
        elements.detailAvgParticipants = document.getElementById('detailAvgParticipants');
        elements.detailTotalAdmins = document.getElementById('detailTotalAdmins');
        elements.ownerName = document.getElementById('ownerName');
        elements.ownerUsername = document.getElementById('ownerUsername');
        elements.ownerAvatarSmall = document.getElementById('ownerAvatarSmall');
        elements.forceSubsList = document.getElementById('forceSubsList');
        elements.recentGiveaways = document.getElementById('recentGiveaways');
        elements.refreshStatsBtn = document.getElementById('refreshStatsBtn');
        elements.openBotBtn = document.getElementById('openBotBtn');
        elements.openGiveawayBtn = document.getElementById('openGiveawayBtn');
        elements.contactOwnerBtn = document.getElementById('contactOwnerBtn');
        elements.officialChannelBtn = document.getElementById('officialChannelBtn');
        elements.helpBtn = document.getElementById('helpBtn');
        elements.ctaOpenBotBtn = document.getElementById('ctaOpenBotBtn');
        elements.viewAllGiveawaysBtn = document.getElementById('viewAllGiveawaysBtn');
        
        setupEventListeners();
        initSidebar();
        
        const telegramUser = getTelegramUser();
        if (telegramUser) {
            updateProfileUI(telegramUser);
            updateSidebarUser(telegramUser);
            await loadUserStats(telegramUser.id);
            await loadUserDetailStats();
        }
        
        await loadSocialLinks();
        await Promise.all([
            loadBotStatistics(),
            loadOwnerInfo(),
            loadForceSubs(),
            loadRecentGiveaways()
        ]);
        
        updateViewAllButton();
        
        showLoading(false);
        console.log('✅ Lobby page initialized');
    }
    // Start initialization
    init();
})();
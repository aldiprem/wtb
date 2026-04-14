// giveaway.js - Modern Minimalist Version with Telegram Haptic Feedback

(function() {
    'use strict';
    
    console.log('🎁 Giveaway Page - Initializing...');

    const API_BASE_URL = window.location.origin;
    const MAX_RETRIES = 3;

    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
    /**
     * Get Telegram WebApp instance
     */
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    /**
     * Light haptic feedback for button clicks (1x short vibration)
     */
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    /**
     * Medium haptic feedback for confirmations (1x medium vibration)
     */
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    /**
     * Heavy haptic feedback for major actions (1x heavy vibration)
     */
    function hapticHeavy() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('heavy');
        }
    }
    
    /**
     * Success haptic feedback (2x vibrations)
     * Telegram doesn't have native double vibration, so we do two impacts
     */
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            // Double vibration for success
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    /**
     * Error haptic feedback (long vibration)
     */
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
    
    /**
     * Warning haptic feedback
     */
    function hapticWarning() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('warning');
        }
    }

    let giveawayData = null;
    let telegramUser = null;
    let hasParticipated = false;
    let countdownInterval = null;
    let captchaCode = '';
    let isCaptchaVerified = false;
    let clickedLinks = new Set();
    let requiredLinks = [];
    let totalLinks = 0;
    let participationInProgress = false;
    let requirementsList = [];
    let captchaModal = null;
    let currentCaptchaCode = '';
    let isCaptchaVerifiedForParticipation = false;
    let membershipStatus = {
        isChecking: false,
        isMember: false,
        joinedChats: [],
        totalChats: 0,
        lastCheck: null
    };
    let membershipCheckInterval = null;

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        giveawayCode: document.getElementById('giveawayCode'),
        
        // Profile
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        userUsername: document.getElementById('userUsername'),
        statCreated: document.getElementById('statCreated'),
        statParticipated: document.getElementById('statParticipated'),
        statWon: document.getElementById('statWon'),
        
        // Countdown
        countdownTimer: document.getElementById('countdownTimer'),
        expiredMessage: document.getElementById('expiredMessage'),
        days: document.getElementById('days'),
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds'),
        
        // Prize
        prizeList: document.getElementById('prizeList'),
        prizeMore: document.getElementById('prizeMore'),
        remainingPrizesCount: document.getElementById('remainingPrizesCount'),
        showAllPrizesBtn: document.getElementById('showAllPrizesBtn'),
        prizeModal: document.getElementById('prizeModal'),
        allPrizesList: document.getElementById('allPrizesList'),
        closePrizeModal: document.getElementById('closePrizeModal'),
        
        // Requirements
        requirementsCard: document.getElementById('requirementsCard'),
        requirementsList: document.getElementById('requirementsList'),
        
        // Links
        linksCard: document.getElementById('linksCard'),
        linksContainer: document.getElementById('linksContainer'),
        linksStatus: document.getElementById('linksStatus'),
        
        // Captcha
        captchaCard: document.getElementById('captchaCard'),
        captchaDisplay: document.getElementById('captchaCode'),
        captchaInput: document.getElementById('captchaInput'),
        captchaRefresh: document.getElementById('captchaRefresh'),
        captchaStatus: document.getElementById('captchaStatus'),
        
        // Participation
        participationStatus: document.getElementById('participationStatus'),
        participateBtn: document.getElementById('participateBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        // Add haptic feedback for toast
        if (type === 'success') {
            hapticSuccess();
        } else if (type === 'error') {
            hapticError();
        } else if (type === 'warning') {
            hapticWarning();
        } else {
            hapticLight();
        }
        
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        return num.toString().padStart(2, '0');
    }

    // Telegram User
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
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            if (userId) {
                return {
                    id: parseInt(userId),
                    username: urlParams.get('username') || '',
                    first_name: urlParams.get('first_name') || '',
                    last_name: urlParams.get('last_name') || '',
                    photo_url: null
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    async function triggerMembershipCheck() {
        if (!giveawayData?.code || !telegramUser?.id) return;
        
        try {
            // Panggil endpoint untuk trigger pengecekan manual
            const response = await fetch(`${API_BASE_URL}/api/giveaway/trigger-membership-check/${giveawayData.code}/${telegramUser.id}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                console.log('Membership check triggered:', data.check_id);
            }
        } catch (error) {
            console.error('Error triggering membership check:', error);
        }
    }

    function updateUserUI() {
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
        
        if (elements.userName) elements.userName.textContent = fullName || 'Pengguna Telegram';
        if (elements.userUsername) elements.userUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        
        const avatarContainer = elements.userAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }

    // Stats
    async function loadUserStats() {
        if (!telegramUser) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/user-stats/${telegramUser.id}`);
            const data = await response.json();
            if (data.success) {
                if (elements.statCreated) elements.statCreated.textContent = data.created_count || 0;
                if (elements.statParticipated) elements.statParticipated.textContent = data.participated_count || 0;
                if (elements.statWon) elements.statWon.textContent = data.won_count || 0;
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    // Captcha
    function generateCaptcha() {
        hapticLight(); // Haptic feedback for refresh
        
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        captchaCode = result;
        if (elements.captchaDisplay) elements.captchaDisplay.textContent = captchaCode;
        isCaptchaVerified = false;
        if (elements.captchaInput) elements.captchaInput.value = '';
        if (elements.captchaStatus) {
            elements.captchaStatus.innerHTML = '';
            elements.captchaStatus.className = 'captcha-status';
        }
        checkParticipationEligibility();
    }

    function verifyCaptcha() {
        const inputValue = elements.captchaInput?.value.trim().toUpperCase();
        if (!inputValue) {
            hapticWarning();
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Masukkan kode';
                elements.captchaStatus.className = 'captcha-status error';
            }
            isCaptchaVerified = false;
            checkParticipationEligibility();
            return false;
        }
        if (inputValue === captchaCode) {
            hapticSuccess();
            isCaptchaVerified = true;
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-check-circle"></i> Valid!';
                elements.captchaStatus.className = 'captcha-status success';
            }
            checkParticipationEligibility();
            return true;
        } else {
            hapticError();
            isCaptchaVerified = false;
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-times-circle"></i> Salah';
                elements.captchaStatus.className = 'captcha-status error';
            }
            checkParticipationEligibility();
            return false;
        }
    }

    // Links
    async function fetchBotInfo(botUsername) {
        // Cache bot info untuk menghindari fetch berulang
        if (window.botInfoCache && window.botInfoCache[botUsername]) {
            return window.botInfoCache[botUsername];
        }
        
        try {
            // Gunakan API untuk mendapatkan info bot
            const response = await fetch(`${API_BASE_URL}/api/giveaway/bot-info/${botUsername}`);
            const data = await response.json();
            if (data.success) {
                if (!window.botInfoCache) window.botInfoCache = {};
                window.botInfoCache[botUsername] = data;
                return data;
            }
        } catch (error) {
            console.error('Error fetching bot info:', error);
        }
        return null;
    }

    function extractBotUsernameFromLink(link) {
        // Extract username dari link t.me
        // Contoh: https://t.me/epic_gift_bot/app?startapp=xxx -> epic_gift_bot
        //         t.me/username -> username
        try {
            let cleanLink = link.replace('https://', '').replace('http://', '');
            if (cleanLink.startsWith('t.me/')) {
                let parts = cleanLink.split('/');
                if (parts.length >= 2) {
                    let username = parts[1];
                    // Hapus query string jika ada
                    username = username.split('?')[0];
                    // Hapus path tambahan seperti /app
                    username = username.split('/')[0];
                    return username;
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async function renderLinks() {
        if (!elements.linksContainer) return;
        const hasTapLink = requirementsList.some(req => req.type === 'taplink');
        if (!hasTapLink || !requiredLinks || requiredLinks.length === 0) {
            if (elements.linksCard) elements.linksCard.style.display = 'none';
            return;
        }
        if (elements.linksCard) elements.linksCard.style.display = 'block';
        
        // Sembunyikan links-status karena tidak perlu
        if (elements.linksStatus) elements.linksStatus.style.display = 'none';
        
        let html = '';
        
        for (const link of requiredLinks) {
            const isClicked = clickedLinks.has(link);
            const botUsername = extractBotUsernameFromLink(link);
            let botName = botUsername || 'Telegram Bot';
            let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(botName.substring(0, 2))}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
            
            // Coba fetch info bot jika ada username
            if (botUsername) {
                try {
                    const botInfo = await fetchBotInfo(botUsername);
                    if (botInfo && botInfo.bot) {
                        if (botInfo.bot.username) botName = `@${botInfo.bot.username}`;
                        if (botInfo.bot.first_name) botName = botInfo.bot.first_name;
                        if (botInfo.bot.photo_url) avatarUrl = botInfo.bot.photo_url;
                    }
                } catch (e) {
                    console.error('Error fetching bot info:', e);
                }
            }
            
            html += `
                <div class="link-item ${isClicked ? 'completed' : ''}" data-link="${escapeHtml(link)}" data-bot-username="${escapeHtml(botUsername || '')}">
                    <div class="link-icon">
                        <img src="${avatarUrl}" alt="${escapeHtml(botName)}" class="bot-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(botName.substring(0, 2))}&background=40a7e3&color=fff&size=100&rounded=true'">
                    </div>
                    <div class="link-info">
                        <div class="link-bot-name">${escapeHtml(botName)}</div>
                        <div class="link-url">${escapeHtml(link)}</div>
                    </div>
                    <div class="link-arrow ${isClicked ? 'completed' : ''}">
                        ${isClicked ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-chevron-right"></i>'}
                    </div>
                </div>
            `;
        }
        elements.linksContainer.innerHTML = html;
        
        // Tambah event listener untuk seluruh link item
        document.querySelectorAll('.link-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                // Jangan trigger jika klik pada arrow/check (tapi arrow juga trigger)
                e.stopPropagation();
                const link = item.dataset.link;
                const isClicked = item.classList.contains('completed');
                
                if (!isClicked && link) {
                    hapticMedium();
                    // Buka link di new tab
                    window.open(link, '_blank');
                    await markLinkAsClicked(link);
                }
            });
        });
    }

    function markLinkAsClicked(link) {
        return new Promise((resolve) => {
            if (!clickedLinks.has(link)) {
                hapticSuccess();
                clickedLinks.add(link);
                if (giveawayData?.code) {
                    localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
                }
                renderLinks();
                renderRequirements();
                checkParticipationEligibility();
                showToast('Link dikunjungi!', 'success');
            }
            resolve();
        });
    }

    function updateLinksStatus() {
        if (!elements.linksStatus) return;
        const clickedCount = clickedLinks.size;
        const total = totalLinks;
        if (total === 0) return;
        if (clickedCount >= total) {
            elements.linksStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Semua link dikunjungi!</span>';
            elements.linksStatus.className = 'links-status success';
        } else {
            elements.linksStatus.innerHTML = `<i class="fas fa-info-circle"></i><span>${clickedCount}/${total} link dikunjungi</span>`;
            elements.linksStatus.className = 'links-status';
        }
    }

    // Requirements
    function parseRequirements(syaratString) {
        const requirements = [];
        if (!syaratString || syaratString === 'None' || syaratString === '') {
            requirements.push({ type: 'none', text: 'Tidak ada syarat', icon: 'fa-check-circle', completed: true });
            return requirements;
        }
        const syaratList = syaratString.split(',').map(s => s.trim());
        for (const s of syaratList) {
            if (s === 'Subscribe') {
                requirements.push({ type: 'subscribe', text: 'Bergabung Chat ID', icon: 'fa-telegram', completed: false });
            } else if (s === 'Boost') {
                requirements.push({ type: 'boost', text: 'Boost Channel', icon: 'fa-rocket', completed: false });
            } else if (s === 'Tap link') {
                requirements.push({ type: 'taplink', text: `Kunjungi Link (${clickedLinks.size}/${totalLinks})`, icon: 'fa-link', completed: (totalLinks > 0 && clickedLinks.size >= totalLinks) });
            }
        }
        return requirements;
    }

    function renderRequirements() {
        if (!elements.requirementsList) return;
        for (let i = 0; i < requirementsList.length; i++) {
            const req = requirementsList[i];
            if (req.type === 'taplink') {
                req.completed = (totalLinks > 0 && clickedLinks.size >= totalLinks);
                req.text = `Kunjungi Link (${clickedLinks.size}/${totalLinks})`;
            }
        }
        if (requirementsList.length === 0 || (requirementsList.length === 1 && requirementsList[0].type === 'none')) {
            if (elements.requirementsCard) elements.requirementsCard.style.display = 'none';
            return;
        }
        if (elements.requirementsCard) elements.requirementsCard.style.display = 'block';
        
        let html = '';
        for (const req of requirementsList) {
            if (req.type === 'none') continue;
            const isCompleted = req.completed;
            // Tambahkan data-type attribute untuk subscribe
            const dataAttr = req.type === 'subscribe' ? 'data-type="subscribe"' : '';
            html += `
                <div class="requirement-item ${isCompleted ? 'completed' : ''}" ${dataAttr}>
                    <div class="requirement-icon"><i class="fas ${req.icon}"></i></div>
                    <div class="requirement-text">
                        ${escapeHtml(req.text)}
                        <div class="requirement-sub">${req.type === 'subscribe' ? 'Klik untuk melihat daftar chat' : req.type === 'boost' ? 'Boost channel Telegram' : 'Klik tombol di samping'}</div>
                    </div>
                    ${isCompleted ? '<span class="requirement-status success">✓ Terpenuhi</span>' : '<span class="requirement-status pending">⏳ Belum</span>'}
                </div>
            `;
        }
        elements.requirementsList.innerHTML = html;
        
        // TAMBAHKAN EVENT LISTENER UNTUK SUBSCRIBE REQUIREMENT
        const subscribeItems = document.querySelectorAll('.requirement-item[data-type="subscribe"]');
        subscribeItems.forEach(item => {
            // Hanya tambahkan event jika belum completed
            const isCompleted = item.classList.contains('completed');
            if (!isCompleted) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', (e) => {
                    // Jangan trigger jika klik pada status badge
                    if (e.target.classList.contains('requirement-status')) return;
                    showChatListModal();
                });
            }
        });
    }

    // Prize
    function renderPrize() {
        if (!elements.prizeList) return;
        const prizes = giveawayData?.prize || [];
        if (prizes.length === 0) {
            elements.prizeList.innerHTML = '<div class="prize-empty">Belum ada hadiah</div>';
            return;
        }
        
        const displayCount = Math.min(3, prizes.length);
        let html = '';
        for (let i = 0; i < displayCount; i++) {
            html += `
                <div class="prize-item">
                    <div class="prize-number">${i + 1}</div>
                    <div class="prize-name">${escapeHtml(prizes[i])}</div>
                </div>
            `;
        }
        elements.prizeList.innerHTML = html;
        
        const remaining = prizes.length - 3;
        if (remaining > 0) {
            if (elements.prizeMore) elements.prizeMore.style.display = 'block';
            if (elements.remainingPrizesCount) elements.remainingPrizesCount.textContent = remaining;
        } else {
            if (elements.prizeMore) elements.prizeMore.style.display = 'none';
        }
    }

    function showAllPrizes() {
        hapticMedium(); // Haptic feedback for opening modal
        const prizes = giveawayData?.prize || [];
        if (!elements.allPrizesList) return;
        let html = '';
        prizes.forEach((prize, index) => {
            html += `
                <div class="modal-prize-item">
                    <div class="prize-number" style="width: 28px; height: 28px; font-size: 12px;">${index + 1}</div>
                    <div class="prize-name">${escapeHtml(prize)}</div>
                </div>
            `;
        });
        elements.allPrizesList.innerHTML = html;
        if (elements.prizeModal) elements.prizeModal.style.display = 'flex';
    }

    function closePrizeModal() {
        hapticLight(); // Haptic feedback for closing modal
        if (elements.prizeModal) elements.prizeModal.style.display = 'none';
    }

    // Countdown
    function startCountdown(endTimeStr) {
        if (countdownInterval) clearInterval(countdownInterval);
        function updateCountdown() {
            const now = new Date();
            const end = new Date(endTimeStr);
            const diff = end - now;
            if (diff <= 0) {
                if (countdownInterval) clearInterval(countdownInterval);
                if (elements.countdownTimer) elements.countdownTimer.style.display = 'none';
                if (elements.expiredMessage) elements.expiredMessage.style.display = 'flex';
                return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (86400000)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (3600000)) / (1000 * 60));
            const seconds = Math.floor((diff % (60000)) / 1000);
            if (elements.days) elements.days.textContent = formatNumber(days);
            if (elements.hours) elements.hours.textContent = formatNumber(hours);
            if (elements.minutes) elements.minutes.textContent = formatNumber(minutes);
            if (elements.seconds) elements.seconds.textContent = formatNumber(seconds);
        }
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    function generateCaptchaCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function checkParticipationEligibility() {
        if (hasParticipated) {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Sudah Berpartisipasi</span>';
            }
            return false;
        }
        if (giveawayData?.status === 'expired') {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-clock"></i><span>Giveaway Berakhir</span>';
            }
            return false;
        }
        
        // Cek semua syarat kecuali captcha (captcha akan di-check saat klik partisipasi)
        for (const req of requirementsList) {
            if (req.type === 'taplink' && totalLinks > 0 && clickedLinks.size < totalLinks) {
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-link"></i><span>Kunjungi Link Dulu</span>';
                }
                return false;
            }
            if ((req.type === 'subscribe' || req.type === 'boost') && !req.completed) {
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-lock"></i><span>Penuhi Syarat</span>';
                }
                return false;
            }
        }
        
        // Jika semua syarat terpenuhi, tombol aktif untuk PARTISIPASI
        if (elements.participateBtn) {
            elements.participateBtn.disabled = false;
            elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
        }
        return true;
    }

    async function showCaptchaModal() {
        hapticMedium();
        
        return new Promise((resolve) => {
            // Buat modal container jika belum ada
            let captchaModalEl = document.getElementById('captchaModal');
            if (!captchaModalEl) {
                captchaModalEl = document.createElement('div');
                captchaModalEl.id = 'captchaModal';
                captchaModalEl.className = 'modal-overlay';
                captchaModalEl.innerHTML = `
                    <div class="modal-container captcha-modal-container">
                        <div class="modal-header captcha-modal-header">
                            <h3><i class="fas fa-shield-alt"></i> Verifikasi Captcha</h3>
                            <button class="modal-close" id="closeCaptchaModal">&times;</button>
                        </div>
                        <div class="modal-body captcha-modal-body">
                            <div class="captcha-display-modal">
                                <span id="captchaCodeDisplay">XXXXXX</span>
                            </div>
                            <div class="captcha-modal-input-group">
                                <input type="text" id="captchaInputModal" class="captcha-modal-input" placeholder="Kode" maxlength="6" autocomplete="off">
                                <button class="captcha-modal-btn" id="captchaRefreshBtn">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                                <button class="captcha-modal-btn" id="captchaVerifyBtn">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                            <div class="captcha-modal-status info" id="captchaModalStatus">
                                <i class="fas fa-info-circle"></i> Masukkan kode di atas
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(captchaModalEl);
            }
            
            // Generate captcha baru
            let captchaCode = generateCaptchaCode();
            const displaySpan = document.getElementById('captchaCodeDisplay');
            const inputField = document.getElementById('captchaInputModal');
            const statusDiv = document.getElementById('captchaModalStatus');
            const refreshBtn = document.getElementById('captchaRefreshBtn');
            const verifyBtn = document.getElementById('captchaVerifyBtn');
            const closeBtn = document.getElementById('closeCaptchaModal');
            
            if (displaySpan) displaySpan.textContent = captchaCode;
            if (inputField) inputField.value = '';
            if (statusDiv) {
                statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Masukkan kode di atas';
                statusDiv.className = 'captcha-modal-status info';
            }
            
            // Fungsi refresh captcha
            const refreshCaptcha = () => {
                hapticLight();
                captchaCode = generateCaptchaCode();
                if (displaySpan) displaySpan.textContent = captchaCode;
                if (inputField) inputField.value = '';
                if (statusDiv) {
                    statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Masukkan kode di atas';
                    statusDiv.className = 'captcha-modal-status info';
                }
            };
            
            // Fungsi verifikasi
            const verifyCaptcha = () => {
                const inputValue = inputField?.value.trim().toUpperCase() || '';
                if (!inputValue) {
                    hapticWarning();
                    if (statusDiv) {
                        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Masukkan kode';
                        statusDiv.className = 'captcha-modal-status error';
                    }
                    return;
                }
                if (inputValue === captchaCode) {
                    hapticSuccess();
                    if (statusDiv) {
                        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Valid!';
                        statusDiv.className = 'captcha-modal-status success';
                    }
                    setTimeout(() => {
                        closeCaptchaModalEl();
                        resolve(true);
                    }, 500);
                } else {
                    hapticError();
                    if (statusDiv) {
                        statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Kode salah, coba lagi';
                        statusDiv.className = 'captcha-modal-status error';
                    }
                    // Refresh captcha setelah salah
                    setTimeout(() => refreshCaptcha(), 1000);
                }
            };
            
            // Close modal function
            const closeCaptchaModalEl = () => {
                if (captchaModalEl) captchaModalEl.style.display = 'none';
                refreshBtn?.removeEventListener('click', refreshCaptcha);
                verifyBtn?.removeEventListener('click', verifyCaptcha);
                closeBtn?.removeEventListener('click', closeCaptchaModalEl);
                inputField?.removeEventListener('keypress', keyHandler);
            };
            
            // Event listener untuk enter key
            const keyHandler = (e) => {
                if (e.key === 'Enter') verifyCaptcha();
            };
            
            refreshBtn?.addEventListener('click', refreshCaptcha);
            verifyBtn?.addEventListener('click', verifyCaptcha);
            closeBtn?.addEventListener('click', closeCaptchaModalEl);
            inputField?.addEventListener('keypress', keyHandler);
            
            // Klik overlay untuk close
            captchaModalEl.addEventListener('click', (e) => {
                if (e.target === captchaModalEl) {
                    hapticLight();
                    closeCaptchaModalEl();
                    resolve(false);
                }
            }, { once: true });
            
            captchaModalEl.style.display = 'flex';
            inputField?.focus();
        });
    }

    // API Functions
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, { ...options, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
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

    async function loadGiveaway(giveawayCode) {
        showLoading(true);
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/info/${giveawayCode}`, { method: 'GET' });
            if (data.success) {
                giveawayData = data.giveaway;
                requiredLinks = giveawayData.links || [];
                totalLinks = requiredLinks.length;
                if (giveawayData.code) {
                    const savedClicks = localStorage.getItem(`giveaway_links_${giveawayData.code}`);
                    if (savedClicks) {
                        const savedLinks = JSON.parse(savedClicks);
                        savedLinks.forEach(link => { if (requiredLinks.includes(link)) clickedLinks.add(link); });
                    }
                }
                requirementsList = parseRequirements(giveawayData.syarat);
                renderPrize();
                renderRequirements();
                renderLinks();
                if (giveawayData.end_time && giveawayData.status !== 'expired') {
                    startCountdown(giveawayData.end_time);
                } else if (giveawayData.status === 'expired') {
                    if (elements.countdownTimer) elements.countdownTimer.style.display = 'none';
                    if (elements.expiredMessage) elements.expiredMessage.style.display = 'flex';
                }
                if (telegramUser) await checkUserParticipation(giveawayData.code, telegramUser.id);
                renderRequirements();
                renderLinks();
                checkParticipationEligibility();
            } else {
                showToast(data.error || 'Gagal memuat giveaway', 'error');
            }
        } catch (error) {
            console.error('Error loading giveaway:', error);
            showToast('Gagal memuat data giveaway', 'error');
        } finally {
            showLoading(false);
        }
    }

    async function checkUserParticipation(giveawayCode, userId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/check-participation/${giveawayCode}/${userId}`, { method: 'GET' });
            if (data.success) {
                hasParticipated = data.has_participated;
                if (hasParticipated) {
                    if (elements.participationStatus) elements.participationStatus.style.display = 'flex';
                    if (elements.participateBtn) {
                        elements.participateBtn.disabled = true;
                        elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Sudah Berpartisipasi</span>';
                    }
                }
            }
        } catch (error) {
            console.error('Error checking participation:', error);
        }
    }

    async function participate() {
        if (participationInProgress) return;
        
        hapticMedium();
        
        if (hasParticipated) { 
            showToast('Sudah berpartisipasi', 'warning'); 
            return; 
        }
        if (!telegramUser) { 
            showToast('Data user tidak ditemukan', 'error'); 
            return; 
        }
        if (!checkParticipationEligibility()) { 
            showToast('Penuhi semua syarat dulu', 'warning'); 
            return; 
        }
        
        // ============ VERIFIKASI KEANGGOTAAN SEBELUM PARTISIPASI ============
        // Tampilkan loading pada tombol
        participationInProgress = true;
        if (elements.participateBtn) {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<span class="btn-loading"></span><span>Verifikasi Keanggotaan...</span>';
        }
        
        try {
            // Verifikasi keanggotaan ke bot
            const verifyResponse = await fetch(`${API_BASE_URL}/api/giveaway/verify-membership/${giveawayData.code}/${telegramUser.id}`);
            const verifyData = await verifyResponse.json();
            
            if (!verifyData.success || !verifyData.verified) {
                hapticError();
                showToast(verifyData.message || 'Anda belum bergabung ke semua chat yang diperlukan!', 'warning');
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = false;
                    elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
                }
                participationInProgress = false;
                
                // Refresh membership status
                checkMembershipStatus(true);
                return;
            }
        } catch (error) {
            console.error('Error verifying membership:', error);
            showToast('Gagal verifikasi keanggotaan, coba lagi', 'error');
            if (elements.participateBtn) {
                elements.participateBtn.disabled = false;
                elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
            }
            participationInProgress = false;
            return;
        }
        
        // ============ VERIFIKASI CAPTCHA ============
        if (giveawayData?.captcha === 'On') {
            if (elements.participateBtn) {
                elements.participateBtn.innerHTML = '<span class="btn-loading"></span><span>Verifikasi Captcha...</span>';
            }
            
            const captchaVerified = await showCaptchaModal();
            if (!captchaVerified) {
                showToast('Verifikasi captcha dibatalkan', 'info');
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = false;
                    elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
                }
                participationInProgress = false;
                return;
            }
            showToast('Captcha terverifikasi!', 'success');
        }
        
        // ============ LANJUTKAN PARTISIPASI ============
        if (elements.participateBtn) {
            elements.participateBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        }
        
        if (clickedLinks.size > 0 && giveawayData?.code) {
            localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/participate`, {
                method: 'POST',
                body: JSON.stringify({
                    giveaway_code: giveawayData.code,
                    user: {
                        id: telegramUser.id,
                        username: telegramUser.username,
                        first_name: telegramUser.first_name,
                        last_name: telegramUser.last_name
                    }
                })
            });
            if (data.success) {
                hapticSuccess();
                hasParticipated = true;
                if (elements.participationStatus) elements.participationStatus.style.display = 'flex';
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Berhasil!</span>';
                }
                showToast(data.message || 'Berhasil berpartisipasi!', 'success');
                await loadUserStats();
                // Stop membership checker karena sudah berpartisipasi
                stopMembershipChecker();
            } else {
                hapticError();
                showToast(data.error || 'Gagal berpartisipasi', 'error');
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = false;
                    elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
                }
            }
        } catch (error) {
            console.error('Error participating:', error);
            hapticError();
            showToast('Terjadi kesalahan', 'error');
            if (elements.participateBtn) {
                elements.participateBtn.disabled = false;
                elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
            }
        } finally {
            participationInProgress = false;
        }
    }

    function getStartParam() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.start_param) return initData.start_param;
            }
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('startapp') || urlParams.get('id');
        } catch (error) {
            console.error('Error getting start param:', error);
            return null;
        }
    }

    // Event Listeners with Haptic Feedback
    if (elements.showAllPrizesBtn) {
        elements.showAllPrizesBtn.addEventListener('click', (e) => {
            hapticLight();
            showAllPrizes();
        });
    }
    
    if (elements.closePrizeModal) {
        elements.closePrizeModal.addEventListener('click', (e) => {
            hapticLight();
            closePrizeModal();
        });
    }
    
    if (elements.prizeModal) {
        elements.prizeModal.addEventListener('click', (e) => { 
            if (e.target === elements.prizeModal) {
                hapticLight();
                closePrizeModal();
            }
        });
    }
    
    if (elements.participateBtn) {
        elements.participateBtn.addEventListener('click', participate);
    }

    // Add haptic feedback to requirement items (subscribe/boost)
    function addRequirementHaptic() {
        const requirementItems = document.querySelectorAll('.requirement-item');
        requirementItems.forEach(item => {
            item.addEventListener('click', () => {
                hapticLight();
            });
        });
    }

    // Observe DOM changes to add haptic to dynamically added elements
    const observer = new MutationObserver(() => {
        addRequirementHaptic();
    });
    
    if (elements.requirementsList) {
        observer.observe(elements.requirementsList, { childList: true, subtree: true });
    }

    // ==================== CHAT LIST MODAL ====================
    async function showChatListModal() {
        hapticMedium();
        
        if (!giveawayData?.code) {
            showToast('Data giveaway tidak ditemukan', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/chats/${giveawayData.code}`);
            const data = await response.json();
            
            if (!data.success) {
                showToast(data.error || 'Gagal memuat daftar chat', 'error');
                return;
            }
            
            const chats = data.chats || [];
            
            if (chats.length === 0) {
                showToast('Tidak ada chat yang tersimpan', 'warning');
                return;
            }
            
            // Buat modal container jika belum ada
            let chatModal = document.getElementById('chatModal');
            if (!chatModal) {
                chatModal = document.createElement('div');
                chatModal.id = 'chatModal';
                chatModal.className = 'modal-overlay';
                chatModal.innerHTML = `
                    <div class="modal-container" style="max-width: 320px;">
                        <div class="modal-header" style="padding: 12px 16px;">
                            <h3 style="font-size: 14px;"><i class="fas fa-telegram"></i> Daftar Chat</h3>
                            <button class="modal-close" id="closeChatModal" style="width: 30px; height: 30px;">&times;</button>
                        </div>
                        <div class="modal-body" id="chatListContainer" style="padding: 12px 16px;"></div>
                    </div>
                `;
                document.body.appendChild(chatModal);
                
                // Event listener untuk close
                document.getElementById('closeChatModal')?.addEventListener('click', () => {
                    hapticLight();
                    closeChatModal();
                });
                
                chatModal.addEventListener('click', (e) => {
                    if (e.target === chatModal) {
                        hapticLight();
                        closeChatModal();
                    }
                });
            }
            
            // Render daftar chat dengan ukuran lebih kecil
            const chatContainer = document.getElementById('chatListContainer');
            if (chatContainer) {
                let html = '';
                
                for (const chat of chats) {
                    // Generate nama dari chat_title atau fallback
                    const chatName = chat.chat_title || 'Chat';
                    const chatType = chat.chat_type || 'Chat';
                    const chatId = chat.chat_id;
                    const chatUsername = chat.chat_username || '';
                    
                    // Buat link untuk membuka chat
                    let chatLink = '';
                    if (chatUsername && chatUsername !== 'null' && chatUsername !== '') {
                        chatLink = `https://t.me/${chatUsername}`;
                    } else if (chatId) {
                        // Hapus tanda -100 untuk channel
                        let cleanId = chatId.replace('-100', '');
                        chatLink = `https://t.me/${cleanId}`;
                    }
                    
                    // Avatar URL - lebih kecil
                    const nameForAvatar = encodeURIComponent(chatName.substring(0, 2));
                    const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=60&rounded=true&bold=true&length=2`;
                    
                    html += `
                        <div class="chat-list-item" data-chat-link="${escapeHtml(chatLink)}" style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            padding: 8px 12px;
                            background: var(--bg);
                            backdrop-filter: var(--glass-blur);
                            -webkit-backdrop-filter: var(--glass-blur);
                            border-radius: 12px;
                            margin-bottom: 8px;
                            position: relative;
                            overflow: hidden;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">
                            <div class="chat-list-avatar" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                overflow: hidden;
                                flex-shrink: 0;
                                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <img src="${avatarUrl}" alt="${escapeHtml(chatName)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TG&background=40a7e3&color=fff&size=60&rounded=true'">
                            </div>
                            <div class="chat-list-info" style="flex: 1; min-width: 0;">
                                <div class="chat-list-name" style="
                                    font-size: 13px;
                                    font-weight: 600;
                                    margin-bottom: 2px;
                                    white-space: nowrap;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                ">${escapeHtml(chatName)}</div>
                                <div class="chat-list-type" style="
                                    font-size: 10px;
                                    color: var(--primary);
                                    background: rgba(64, 167, 227, 0.15);
                                    padding: 2px 6px;
                                    border-radius: 20px;
                                    display: inline-block;
                                ">${escapeHtml(chatType)}</div>
                            </div>
                            <div class="chat-list-arrow" style="
                                width: 28px;
                                height: 28px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                flex-shrink: 0;
                                background: rgba(255, 255, 255, 0.05);
                                border-radius: 8px;
                            ">
                                <i class="fas fa-chevron-right" style="font-size: 12px; color: var(--text-muted);"></i>
                            </div>
                        </div>
                    `;
                }
                
                chatContainer.innerHTML = html;
                
                // Tambah event listener untuk seluruh chat item (klik di mana saja)
                document.querySelectorAll('.chat-list-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        hapticMedium();
                        const chatLink = item.dataset.chatLink;
                        
                        if (chatLink) {
                            window.open(chatLink, '_blank');
                            showToast('Membuka chat...', 'info');
                        } else {
                            showToast('Link tidak tersedia', 'error');
                        }
                    });
                });
            }
            
            chatModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error loading chats:', error);
            showToast('Gagal memuat daftar chat', 'error');
        } finally {
            showLoading(false);
        }
    }

    function closeChatModal() {
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.style.display = 'none';
        }
    }

    async function checkMembershipStatus(showLoading = false) {
        if (!giveawayData?.code || !telegramUser?.id) return;
        if (membershipStatus.isChecking) return;
        
        membershipStatus.isChecking = true;
        
        // Update UI untuk menunjukkan loading
        updateMembershipUI('loading');
        
        // Set timeout 10 detik
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/check-membership/${giveawayData.code}/${telegramUser.id}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (data.success) {
                membershipStatus.isMember = data.member_status;
                membershipStatus.lastCheck = new Date();
                
                // Update requirement subscribe status
                updateSubscribeRequirementStatus(membershipStatus.isMember);
                
                // Update UI
                if (membershipStatus.isMember) {
                    updateMembershipUI('success');
                } else {
                    updateMembershipUI('pending');
                }
                
                checkParticipationEligibility();

                if (giveawayData.syarat && giveawayData.syarat.includes('Subscribe') && !hasParticipated) {
                    triggerMembershipCheck();
                }
            } else {
                updateMembershipUI('error');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Error checking membership:', error);
            updateMembershipUI('error');
        } finally {
            membershipStatus.isChecking = false;
        }
    }

    function updateMembershipUI(status) {
        const subscribeItems = document.querySelectorAll('.requirement-item[data-type="subscribe"]');
        
        subscribeItems.forEach(item => {
            const statusBadge = item.querySelector('.requirement-status');
            const iconDiv = item.querySelector('.requirement-icon i');
            const textDiv = item.querySelector('.requirement-text');
            
            if (status === 'loading') {
                if (statusBadge) {
                    statusBadge.innerHTML = '<span class="loading-dots">⏳ Memeriksa...</span>';
                    statusBadge.className = 'requirement-status pending';
                }
                if (iconDiv) {
                    iconDiv.className = 'fas fa-spinner fa-pulse';
                }
            } else if (status === 'success') {
                if (statusBadge) {
                    statusBadge.innerHTML = '✓ Terpenuhi';
                    statusBadge.className = 'requirement-status success';
                }
                if (iconDiv) {
                    iconDiv.className = 'fas fa-check-circle';
                    iconDiv.style.color = 'var(--success)';
                }
                item.classList.add('completed');
            } else if (status === 'pending') {
                if (statusBadge) {
                    statusBadge.innerHTML = '⏳ Belum';
                    statusBadge.className = 'requirement-status pending';
                }
                if (iconDiv) {
                    iconDiv.className = 'fas fa-telegram';
                    iconDiv.style.color = 'var(--primary)';
                }
                item.classList.remove('completed');
            } else if (status === 'error') {
                if (statusBadge) {
                    statusBadge.innerHTML = '⚠ Gagal cek';
                    statusBadge.className = 'requirement-status error';
                }
            }
        });
    }

    function updateSubscribeRequirementStatus(isMember) {
        // Update requirementsList
        for (let i = 0; i < requirementsList.length; i++) {
            if (requirementsList[i].type === 'subscribe') {
                requirementsList[i].completed = isMember;
                requirementsList[i].text = isMember ? '✓ Bergabung Chat ID' : 'Bergabung Chat ID';
                break;
            }
        }
        
        // Re-render requirements
        renderRequirements();
    }

    // Start periodic membership check (setiap 10 detik)
    function startMembershipChecker() {
        if (membershipCheckInterval) clearInterval(membershipCheckInterval);
        
        // Check pertama kali setelah load
        setTimeout(() => {
            checkMembershipStatus(false);
        }, 2000);
        
        // Check setiap 10 detik
        membershipCheckInterval = setInterval(() => {
            if (giveawayData && telegramUser && !hasParticipated) {
                checkMembershipStatus(false);
            }
        }, 10000);
    }

    function stopMembershipChecker() {
        if (membershipCheckInterval) {
            clearInterval(membershipCheckInterval);
            membershipCheckInterval = null;
        }
    }

    // Initialize Telegram WebApp
    function initTelegram() {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0f0f0f');
            tg.setBackgroundColor('#0f0f0f');
            console.log('✅ Telegram WebApp initialized');
        }
    }

    // Init
    function init() {
        initTelegram();
        showLoading(true);
        try {
            let giveawayCode = getStartParam();
            if (!giveawayCode) {
                const urlParams = new URLSearchParams(window.location.search);
                giveawayCode = urlParams.get('id');
            }
            if (!giveawayCode) {
                showToast('Kode giveaway tidak ditemukan', 'error');
                setTimeout(() => window.location.href = '/', 2000);
                return;
            }
            telegramUser = getTelegramUser();
            if (telegramUser) {
                updateUserUI();
                loadUserStats();
            }
            
        } catch (error) {
            console.error('Init error:', error);
            showToast('Terjadi kesalahan', 'error');
            showLoading(false);
        }
    }
    init();
})();
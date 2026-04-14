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
    let subscribeChats = [];
    let subscribeStatus = new Map();

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
    function renderLinks() {
        if (!elements.linksContainer) return;
        const hasTapLink = requirementsList.some(req => req.type === 'taplink');
        if (!hasTapLink || !requiredLinks || requiredLinks.length === 0) {
            if (elements.linksCard) elements.linksCard.style.display = 'none';
            return;
        }
        if (elements.linksCard) elements.linksCard.style.display = 'block';
        
        let html = '';
        requiredLinks.forEach((link) => {
            const isClicked = clickedLinks.has(link);
            html += `
                <div class="link-item ${isClicked ? 'completed' : ''}" data-link="${escapeHtml(link)}">
                    <div class="link-icon"><i class="fas ${isClicked ? 'fa-check-circle' : 'fa-link'}"></i></div>
                    <div class="link-info">
                        <div class="link-url">${escapeHtml(link)}</div>
                        <div class="link-status">${isClicked ? '✓ Dikunjungi' : '⚠ Belum'}</div>
                    </div>
                    <button class="link-visit-btn" data-link="${escapeHtml(link)}"><i class="fas fa-external-link-alt"></i> Kunjungi</button>
                </div>
            `;
        });
        elements.linksContainer.innerHTML = html;
        
        document.querySelectorAll('.link-visit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                hapticMedium(); // Haptic feedback for link click
                const link = btn.dataset.link;
                if (link) {
                    window.open(link, '_blank');
                    markLinkAsClicked(link);
                }
            });
        });
        updateLinksStatus();
    }

    function markLinkAsClicked(link) {
        if (!clickedLinks.has(link)) {
            hapticSuccess(); // Haptic feedback for successful link visit
            clickedLinks.add(link);
            if (giveawayData?.code) {
                localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
            }
            renderLinks();
            renderRequirements();
            checkParticipationEligibility();
            showToast('Link dikunjungi!', 'success');
        }
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

    async function loadSubscribeChats() {
        if (!giveawayData || !telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/membership-status/${telegramUser.id}/${giveawayData.code}`);
            const data = await response.json();
            
            if (data.success && data.requirements && data.requirements.length > 0) {
                subscribeChats = data.requirements;
                
                // Initialize status
                for (const chat of subscribeChats) {
                    subscribeStatus.set(chat.username, false);
                }
                
                renderSubscribeRequirement();
            }
        } catch (error) {
            console.error('Error loading subscribe chats:', error);
        }
    }

    // Update parseRequirements to include subscribe with expandable
    function parseRequirements(syaratString) {
        const requirements = [];
        if (!syaratString || syaratString === 'None' || syaratString === '') {
            requirements.push({ type: 'none', text: 'Tidak ada syarat', icon: 'fa-check-circle', completed: true });
            return requirements;
        }
        const syaratList = syaratString.split(',').map(s => s.trim());
        for (const s of syaratList) {
            if (s === 'Subscribe') {
                requirements.push({ 
                    type: 'subscribe', 
                    text: 'Bergabung Chat ID', 
                    icon: 'fa-telegram', 
                    completed: false,
                    hasExpandable: true
                });
            } else if (s === 'Boost') {
                requirements.push({ type: 'boost', text: 'Boost Channel', icon: 'fa-rocket', completed: false });
            } else if (s === 'Tap link') {
                requirements.push({ type: 'taplink', text: `Kunjungi Link (${clickedLinks.size}/${totalLinks})`, icon: 'fa-link', completed: (totalLinks > 0 && clickedLinks.size >= totalLinks) });
            }
        }
        return requirements;
    }

    // Update renderRequirements to add expandable indicator for subscribe
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
            
            // Add expandable indicator for subscribe
            const hasExpandableIcon = req.type === 'subscribe' ? '<i class="fas fa-chevron-down expand-icon"></i>' : '';
            
            html += `
                <div class="requirement-item ${isCompleted ? 'completed' : ''}" data-type="${req.type}">
                    <div class="requirement-icon">
                        <i class="fas ${req.icon}"></i>
                        ${hasExpandableIcon}
                    </div>
                    <div class="requirement-text">
                        ${escapeHtml(req.text)}
                        <div class="requirement-sub">${req.type === 'subscribe' ? 'Klik icon untuk melihat daftar channel' : req.type === 'boost' ? 'Boost channel Telegram' : 'Klik tombol di samping'}</div>
                    </div>
                    ${isCompleted ? '<span class="requirement-status success">✓ Terpenuhi</span>' : '<span class="requirement-status pending">⏳ Belum</span>'}
                </div>
            `;
        }
        elements.requirementsList.innerHTML = html;
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

    // Eligibility
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
        if (giveawayData?.captcha === 'On' && !isCaptchaVerified) {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-shield-alt"></i><span>Verifikasi Captcha</span>';
            }
            return false;
        }
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
        if (elements.participateBtn) {
            elements.participateBtn.disabled = false;
            elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
        }
        return true;
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
                
                // Load subscribe chats if needed
                if (giveawayData.syarat && giveawayData.syarat.includes('Subscribe')) {
                    await loadSubscribeChats();
                }
                
                // ... rest of the function
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
        
        hapticMedium(); // Haptic feedback for button click
        
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
        
        if (clickedLinks.size > 0 && giveawayData?.code) {
            localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
        }
        
        participationInProgress = true;
        if (elements.participateBtn) {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
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
                hapticSuccess(); // Success haptic feedback (double vibration)
                hasParticipated = true;
                if (elements.participationStatus) elements.participationStatus.style.display = 'flex';
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Berhasil!</span>';
                }
                showToast(data.message || 'Berhasil berpartisipasi!', 'success');
                await loadUserStats();
            } else {
                hapticError(); // Error haptic feedback (long vibration)
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

    function renderSubscribeRequirement() {
        const hasSubscribe = requirementsList.some(req => req.type === 'subscribe');
        
        if (!hasSubscribe || !subscribeChats || subscribeChats.length === 0) {
            return;
        }
        
        // Find subscribe requirement item in DOM
        const subscribeItem = document.querySelector('.requirement-item[data-type="subscribe"]');
        if (!subscribeItem) return;
        
        // Add expandable content
        const requirementTextDiv = subscribeItem.querySelector('.requirement-text');
        if (!requirementTextDiv) return;
        
        // Check if already expanded
        let expandableDiv = subscribeItem.querySelector('.subscribe-expandable');
        if (expandableDiv) {
            expandableDiv.remove();
        }
        
        // Create expandable chat list
        expandableDiv = document.createElement('div');
        expandableDiv.className = 'subscribe-expandable';
        expandableDiv.style.display = 'none';
        
        let chatsHtml = '<div class="subscribe-chats-list">';
        for (const chat of subscribeChats) {
            const isMember = subscribeStatus.get(chat.username) || false;
            chatsHtml += `
                <div class="subscribe-chat-item ${isMember ? 'member' : ''}" data-chat-username="${chat.username}" data-chat-link="${chat.link}">
                    <div class="subscribe-chat-avatar">
                        <i class="fas fa-telegram-plane"></i>
                    </div>
                    <div class="subscribe-chat-info">
                        <div class="subscribe-chat-name">${escapeHtml(chat.username)}</div>
                        <div class="subscribe-chat-id">${escapeHtml(chat.link)}</div>
                    </div>
                    <div class="subscribe-chat-status">
                        ${isMember ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-clock"></i>'}
                    </div>
                    <div class="subscribe-chat-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }
        
        // Add check button
        chatsHtml += `
            <div class="subscribe-check-all">
                <button class="btn-check-subscribe" id="checkSubscribeBtn">
                    <i class="fas fa-sync-alt"></i> Cek Partisipasi
                </button>
            </div>
        `;
        chatsHtml += '</div>';
        
        expandableDiv.innerHTML = chatsHtml;
        requirementTextDiv.appendChild(expandableDiv);
        
        // Add click handler to requirement item to toggle expand
        const requirementIcon = subscribeItem.querySelector('.requirement-icon');
        if (requirementIcon) {
            requirementIcon.style.cursor = 'pointer';
            requirementIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = expandableDiv.style.display === 'block';
                expandableDiv.style.display = isVisible ? 'none' : 'block';
                
                // Rotate icon
                const icon = requirementIcon.querySelector('i');
                if (icon) {
                    icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                    icon.style.transition = 'transform 0.3s ease';
                }
            });
        }
        
        // Add click handlers for chat items (redirect to channel)
        document.querySelectorAll('.subscribe-chat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const link = item.dataset.chatLink;
                if (link && !e.target.closest('#checkSubscribeBtn')) {
                    window.open(link, '_blank');
                    hapticLight();
                }
            });
        });
        
        // Add check button handler
        const checkBtn = document.getElementById('checkSubscribeBtn');
        if (checkBtn) {
            checkBtn.addEventListener('click', async () => {
                await checkAllMemberships();
            });
        }
    }

    /**
     * Check membership for all required chats
     */
    async function checkAllMemberships() {
        if (!telegramUser || !giveawayData) {
            showToast('Data user tidak ditemukan', 'error');
            return;
        }
        
        hapticMedium();
        
        const checkBtn = document.getElementById('checkSubscribeBtn');
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
        }
        
        showLoading(true);
        
        let allMember = true;
        
        for (const chat of subscribeChats) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/giveaway/check-membership`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: telegramUser.id,
                        chat_id: chat.username,
                        giveaway_code: giveawayData.code
                    })
                });
                
                const data = await response.json();
                
                // For demo, simulate check (in production, bot will update)
                // Here we simulate based on response
                if (data.success) {
                    // Temporary: set as member for demo
                    // In real implementation, bot will callback to update status
                    subscribeStatus.set(chat.username, true);
                    allMember = allMember && true;
                } else {
                    subscribeStatus.set(chat.username, false);
                    allMember = false;
                }
            } catch (error) {
                console.error(`Error checking membership for ${chat.username}:`, error);
                subscribeStatus.set(chat.username, false);
                allMember = false;
            }
        }
        
        // Update UI
        renderSubscribeRequirement();
        renderRequirements();
        
        // Update requirement completion
        const subscribeReq = requirementsList.find(req => req.type === 'subscribe');
        if (subscribeReq) {
            subscribeReq.completed = allMember;
        }
        
        renderRequirements();
        checkParticipationEligibility();
        
        if (allMember) {
            hapticSuccess();
            showToast('Semua channel sudah di-subscribe!', 'success');
        } else {
            hapticWarning();
            showToast('Beberapa channel belum di-subscribe', 'warning');
        }
        
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Cek Partisipasi';
        }
        
        showLoading(false);
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
            loadGiveaway(giveawayCode);
        } catch (error) {
            console.error('Init error:', error);
            showToast('Terjadi kesalahan', 'error');
        } finally {
            showLoading(false);
        }
    }
    init();
})();
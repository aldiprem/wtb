// giveaway.js - Halaman Giveaway
(function() {
    'use strict';
    
    console.log('🎁 Giveaway Page - Initializing...');

    // ==================== CONFIGURATION ====================
    const API_BASE_URL = window.location.origin;
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
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

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        giveawayCode: document.getElementById('giveawayCode'),
        
        // Countdown
        countdownSection: document.getElementById('countdownSection'),
        countdownTimer: document.getElementById('countdownTimer'),
        expiredMessage: document.getElementById('expiredMessage'),
        days: document.getElementById('days'),
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds'),
        
        // Prize
        prizeList: document.getElementById('prizeList'),
        winnersCount: document.getElementById('winnersCount'),
        
        // Requirements
        requirementsList: document.getElementById('requirementsList'),
        
        // Links
        linksSection: document.getElementById('linksSection'),
        linksContainer: document.getElementById('linksContainer'),
        linksStatus: document.getElementById('linksStatus'),
        
        // User
        userSection: document.getElementById('userSection'),
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        userUsername: document.getElementById('userUsername'),
        userId: document.getElementById('userId'),
        
        // Captcha
        captchaSection: document.getElementById('captchaSection'),
        captchaDisplay: document.getElementById('captchaCode'),
        captchaInput: document.getElementById('captchaInput'),
        captchaRefresh: document.getElementById('captchaRefresh'),
        captchaStatus: document.getElementById('captchaStatus'),
        
        // Participation
        participationStatus: document.getElementById('participationStatus'),
        participatedCard: document.getElementById('participatedCard'),
        participateBtn: document.getElementById('participateBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
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
            
            // Fallback: try URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            const username = urlParams.get('username');
            const firstName = urlParams.get('first_name');
            const lastName = urlParams.get('last_name');
            
            if (userId) {
                return {
                    id: parseInt(userId),
                    username: username || '',
                    first_name: firstName || '',
                    last_name: lastName || '',
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
        
        if (elements.userName) {
            elements.userName.textContent = fullName || 'Pengguna Telegram';
        }
        
        if (elements.userUsername) {
            elements.userUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak memiliki username';
        }
        
        if (elements.userId) {
            elements.userId.textContent = `ID: ${telegramUser.id}`;
        }
        
        // Set avatar with first letter
        if (elements.userAvatar) {
            const initial = fullName.charAt(0) || telegramUser.username?.charAt(0) || 'U';
            elements.userAvatar.innerHTML = `<span class="avatar-initial">${initial.toUpperCase()}</span>`;
        }
    }

    // ==================== CAPTCHA FUNCTIONS ====================
    
    function generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        captchaCode = result;
        if (elements.captchaDisplay) {
            elements.captchaDisplay.textContent = captchaCode;
        }
        isCaptchaVerified = false;
        if (elements.captchaInput) {
            elements.captchaInput.value = '';
        }
        if (elements.captchaStatus) {
            elements.captchaStatus.innerHTML = '';
            elements.captchaStatus.className = 'captcha-status';
        }
    }

    function verifyCaptcha() {
        const inputValue = elements.captchaInput?.value.trim().toUpperCase();
        
        if (!inputValue) {
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Masukkan kode captcha';
                elements.captchaStatus.className = 'captcha-status error';
            }
            return false;
        }
        
        if (inputValue === captchaCode) {
            isCaptchaVerified = true;
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-check-circle"></i> Captcha valid!';
                elements.captchaStatus.className = 'captcha-status success';
            }
            checkParticipationEligibility();
            return true;
        } else {
            isCaptchaVerified = false;
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-times-circle"></i> Kode captcha salah';
                elements.captchaStatus.className = 'captcha-status error';
            }
            checkParticipationEligibility();
            return false;
        }
    }

    // ==================== LINK REQUIREMENT FUNCTIONS ====================
    
    function renderLinks() {
        if (!elements.linksContainer) return;
        
        if (!requiredLinks || requiredLinks.length === 0) {
            elements.linksSection.style.display = 'none';
            return;
        }
        
        elements.linksSection.style.display = 'block';
        
        let html = '';
        requiredLinks.forEach((link, index) => {
            const isClicked = clickedLinks.has(link);
            html += `
                <div class="link-card ${isClicked ? 'completed' : ''}" data-link="${escapeHtml(link)}">
                    <div class="link-icon">
                        <i class="fas ${isClicked ? 'fa-check-circle' : 'fa-link'}"></i>
                    </div>
                    <div class="link-info">
                        <div class="link-url">${escapeHtml(link)}</div>
                        <div class="link-status">${isClicked ? 'Sudah dikunjungi' : 'Belum dikunjungi'}</div>
                    </div>
                    <button class="link-visit-btn" data-link="${escapeHtml(link)}">
                        <i class="fas fa-external-link-alt"></i>
                        Kunjungi
                    </button>
                </div>
            `;
        });
        
        elements.linksContainer.innerHTML = html;
        
        // Add click handlers for visit buttons
        document.querySelectorAll('.link-visit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
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
            clickedLinks.add(link);
            
            // Update UI for this link
            const linkCard = document.querySelector(`.link-card[data-link="${CSS.escape(link)}"]`);
            if (linkCard) {
                linkCard.classList.add('completed');
                const linkIcon = linkCard.querySelector('.link-icon i');
                if (linkIcon) {
                    linkIcon.className = 'fas fa-check-circle';
                }
                const linkStatus = linkCard.querySelector('.link-status');
                if (linkStatus) {
                    linkStatus.textContent = 'Sudah dikunjungi';
                }
            }
            
            updateLinksStatus();
            checkParticipationEligibility();
            showToast('Link telah dikunjungi!', 'success');
        }
    }
    
    function updateLinksStatus() {
        if (!elements.linksStatus) return;
        
        const clickedCount = clickedLinks.size;
        const total = totalLinks;
        
        if (clickedCount >= total && total > 0) {
            elements.linksStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Semua link telah dikunjungi! Silakan berpartisipasi.</span>';
            elements.linksStatus.className = 'links-status success';
        } else if (total > 0) {
            elements.linksStatus.innerHTML = `<i class="fas fa-info-circle"></i><span>${clickedCount} dari ${total} link telah dikunjungi</span>`;
            elements.linksStatus.className = 'links-status';
        }
    }

    // ==================== REQUIREMENTS UI ====================
    
    function renderRequirements() {
        if (!elements.requirementsList) return;
        
        const syarat = giveawayData?.syarat || 'None';
        let requirements = [];
        
        if (syarat === 'None' || syarat === '') {
            requirements = [{ text: 'Tidak ada syarat khusus', icon: 'fa-check-circle', completed: true }];
        } else {
            const syaratList = syarat.split(',').map(s => s.trim());
            for (const s of syaratList) {
                if (s === 'Subscribe') {
                    requirements.push({ text: 'Subscribe ke channel/group', icon: 'fa-telegram', completed: false });
                } else if (s === 'Boost') {
                    requirements.push({ text: 'Boost channel', icon: 'fa-rocket', completed: false });
                } else if (s === 'Tap link') {
                    requirements.push({ text: 'Kunjungi semua link yang disediakan', icon: 'fa-link', completed: clickedLinks.size >= totalLinks });
                }
            }
        }
        
        let html = '';
        requirements.forEach(req => {
            html += `
                <div class="requirement-item ${req.completed ? 'completed' : ''}">
                    <div class="requirement-icon">
                        <i class="fas ${req.icon}"></i>
                    </div>
                    <div class="requirement-text">${escapeHtml(req.text)}</div>
                    ${req.completed ? '<i class="fas fa-check-circle requirement-check"></i>' : ''}
                </div>
            `;
        });
        
        elements.requirementsList.innerHTML = html;
    }
    
    function checkParticipationEligibility() {
        if (hasParticipated) {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Sudah Berpartisipasi</span>';
            return false;
        }
        
        if (giveawayData?.status === 'expired') {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<i class="fas fa-clock"></i><span>Giveaway Berakhir</span>';
            return false;
        }
        
        // Check captcha if enabled
        if (giveawayData?.captcha === 'On' && !isCaptchaVerified) {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<i class="fas fa-shield-alt"></i><span>Verifikasi Captcha Dulu</span>';
            return false;
        }
        
        // Check link requirements
        if (requiredLinks.length > 0 && clickedLinks.size < totalLinks) {
            elements.participateBtn.disabled = true;
            elements.participateBtn.innerHTML = '<i class="fas fa-link"></i><span>Kunjungi Semua Link Dulu</span>';
            return false;
        }
        
        // All requirements met
        elements.participateBtn.disabled = false;
        elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
        return true;
    }

    // ==================== PRIZE UI ====================
    
    function renderPrize() {
        if (!elements.prizeList) return;
        
        const prizes = giveawayData?.prize || [];
        
        if (prizes.length === 0) {
            elements.prizeList.innerHTML = '<div class="prize-empty">Belum ada hadiah yang ditentukan</div>';
            return;
        }
        
        let html = '';
        prizes.forEach((prize, index) => {
            html += `
                <div class="prize-card">
                    <div class="prize-number">${index + 1}</div>
                    <div class="prize-name">${escapeHtml(prize)}</div>
                </div>
            `;
        });
        
        elements.prizeList.innerHTML = html;
        
        if (elements.winnersCount) {
            elements.winnersCount.textContent = giveawayData?.winners_count || prizes.length;
        }
    }

    // ==================== COUNTDOWN FUNCTIONS ====================
    
    function startCountdown(endTimeStr) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        function updateCountdown() {
            const now = new Date();
            const end = new Date(endTimeStr);
            const diff = end - now;
            
            if (diff <= 0) {
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }
                if (elements.countdownTimer) {
                    elements.countdownTimer.style.display = 'none';
                }
                if (elements.expiredMessage) {
                    elements.expiredMessage.style.display = 'flex';
                }
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

    // ==================== API FUNCTIONS ====================
    
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            
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
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/info/${giveawayCode}`, {
                method: 'GET'
            });
            
            if (data.success) {
                giveawayData = data.giveaway;
                
                // Update UI
                if (elements.giveawayCode) {
                    elements.giveawayCode.textContent = giveawayData.code;
                }
                
                // Set links
                requiredLinks = giveawayData.links || [];
                totalLinks = requiredLinks.length;
                
                // Render UI
                renderPrize();
                renderRequirements();
                renderLinks();
                
                // Start countdown
                if (giveawayData.end_time && giveawayData.status !== 'expired') {
                    startCountdown(giveawayData.end_time);
                } else if (giveawayData.status === 'expired') {
                    if (elements.countdownTimer) elements.countdownTimer.style.display = 'none';
                    if (elements.expiredMessage) elements.expiredMessage.style.display = 'flex';
                }
                
                // Setup captcha if needed
                if (giveawayData.captcha === 'On') {
                    elements.captchaSection.style.display = 'block';
                    generateCaptcha();
                    
                    if (elements.captchaRefresh) {
                        elements.captchaRefresh.addEventListener('click', generateCaptcha);
                    }
                    if (elements.captchaInput) {
                        elements.captchaInput.addEventListener('input', verifyCaptcha);
                    }
                }
                
                // Check if user already participated
                if (telegramUser) {
                    await checkUserParticipation(giveawayData.code, telegramUser.id);
                }
                
                // Update requirement status for tap link
                if (requiredLinks.length > 0) {
                    // Check localStorage for previously clicked links
                    const savedClicks = localStorage.getItem(`giveaway_links_${giveawayData.code}`);
                    if (savedClicks) {
                        const savedLinks = JSON.parse(savedClicks);
                        savedLinks.forEach(link => {
                            if (requiredLinks.includes(link)) {
                                clickedLinks.add(link);
                            }
                        });
                        renderLinks();
                    }
                    renderRequirements();
                }
                
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
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/check-participation/${giveawayCode}/${userId}`, {
                method: 'GET'
            });
            
            if (data.success) {
                hasParticipated = data.has_participated;
                
                if (hasParticipated) {
                    elements.participationStatus.style.display = 'block';
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Sudah Berpartisipasi</span>';
                }
            }
        } catch (error) {
            console.error('Error checking participation:', error);
        }
    }
    
    async function participate() {
        if (participationInProgress) return;
        if (hasParticipated) {
            showToast('Anda sudah berpartisipasi dalam giveaway ini', 'warning');
            return;
        }
        if (!telegramUser) {
            showToast('Data user tidak ditemukan', 'error');
            return;
        }
        
        // Save clicked links to localStorage
        if (clickedLinks.size > 0) {
            localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
        }
        
        participationInProgress = true;
        elements.participateBtn.disabled = true;
        elements.participateBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        
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
                hasParticipated = true;
                elements.participationStatus.style.display = 'block';
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Berhasil Berpartisipasi!</span>';
                showToast(data.message || 'Berhasil berpartisipasi! Semoga beruntung!', 'success');
                vibrate(50);
            } else {
                showToast(data.error || 'Gagal berpartisipasi', 'error');
                elements.participateBtn.disabled = false;
                elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
            }
        } catch (error) {
            console.error('Error participating:', error);
            showToast('Terjadi kesalahan, silakan coba lagi', 'error');
            elements.participateBtn.disabled = false;
            elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
        } finally {
            participationInProgress = false;
        }
    }

    // ==================== INITIALIZATION ====================
    
    function init() {
        showLoading(true);
        
        try {
            // Get giveaway code from URL
            const urlParams = new URLSearchParams(window.location.search);
            const giveawayCode = urlParams.get('id');
            
            if (!giveawayCode) {
                showToast('Kode giveaway tidak ditemukan', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                return;
            }
            
            // Get Telegram user
            telegramUser = getTelegramUser();
            
            if (telegramUser) {
                updateUserUI();
            } else {
                console.warn('No Telegram user found');
                if (elements.userName) {
                    elements.userName.textContent = 'Guest User';
                }
            }
            
            // Load giveaway data
            loadGiveaway(giveawayCode);
            
            // Setup participate button
            if (elements.participateBtn) {
                elements.participateBtn.addEventListener('click', participate);
            }
            
        } catch (error) {
            console.error('Init error:', error);
            showToast('Terjadi kesalahan', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // Start the app
    init();
})();
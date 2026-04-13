// giveaway.js - Halaman Giveaway (FIXED VERSION)
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
    let requirementsList = []; // Store parsed requirements

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
        requirementsSection: document.getElementById('requirementsSection'),
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
        checkParticipationEligibility();
    }

    function verifyCaptcha() {
        const inputValue = elements.captchaInput?.value.trim().toUpperCase();
        
        if (!inputValue) {
            if (elements.captchaStatus) {
                elements.captchaStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Masukkan kode captcha';
                elements.captchaStatus.className = 'captcha-status error';
            }
            isCaptchaVerified = false;
            checkParticipationEligibility();
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
        
        // Only show links section if Tap Link requirement exists
        const hasTapLinkRequirement = requirementsList.some(req => req.type === 'taplink');
        
        if (!hasTapLinkRequirement || !requiredLinks || requiredLinks.length === 0) {
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
                        <div class="link-status">${isClicked ? '✓ Sudah dikunjungi' : '⚠ Belum dikunjungi'}</div>
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
                    linkStatus.textContent = '✓ Sudah dikunjungi';
                }
            }
            
            // Save to localStorage
            if (giveawayData?.code) {
                localStorage.setItem(`giveaway_links_${giveawayData.code}`, JSON.stringify(Array.from(clickedLinks)));
            }
            
            updateLinksStatus();
            renderRequirements(); // Re-render requirements to update Tap Link status
            checkParticipationEligibility();
            showToast('Link telah dikunjungi!', 'success');
        }
    }
    
    function updateLinksStatus() {
        if (!elements.linksStatus) return;
        
        const clickedCount = clickedLinks.size;
        const total = totalLinks;
        
        if (total === 0) {
            elements.linksSection.style.display = 'none';
            return;
        }
        
        if (clickedCount >= total && total > 0) {
            elements.linksStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>✓ Semua link telah dikunjungi! Silakan berpartisipasi.</span>';
            elements.linksStatus.className = 'links-status success';
        } else if (total > 0) {
            elements.linksStatus.innerHTML = `<i class="fas fa-info-circle"></i><span>📌 ${clickedCount} dari ${total} link telah dikunjungi</span>`;
            elements.linksStatus.className = 'links-status';
        }
    }

    // ==================== REQUIREMENTS UI ====================
    
    function parseRequirements(syaratString, hasLinks) {
        // Parse syarat string like "Subscribe, Boost, Tap link" or "Subscribe, Tap link"
        const requirements = [];
        
        if (!syaratString || syaratString === 'None' || syaratString === '') {
            requirements.push({ 
                type: 'none', 
                text: 'Tidak ada syarat khusus', 
                icon: 'fa-check-circle', 
                completed: true,
                required: false
            });
            return requirements;
        }
        
        const syaratList = syaratString.split(',').map(s => s.trim());
        
        for (const s of syaratList) {
            if (s === 'Subscribe') {
                requirements.push({ 
                    type: 'subscribe', 
                    text: 'Subscribe ke channel/group', 
                    icon: 'fa-telegram', 
                    completed: false,
                    required: true
                });
            } else if (s === 'Boost') {
                requirements.push({ 
                    type: 'boost', 
                    text: 'Boost channel', 
                    icon: 'fa-rocket', 
                    completed: false,
                    required: true
                });
            } else if (s === 'Tap link') {
                requirements.push({ 
                    type: 'taplink', 
                    text: `Kunjungi semua link yang disediakan (${totalLinks} link)`, 
                    icon: 'fa-link', 
                    completed: (hasLinks && clickedLinks.size >= totalLinks),
                    required: true,
                    totalLinks: totalLinks,
                    clickedLinks: clickedLinks.size
                });
            }
        }
        
        return requirements;
    }
    
    function updateRequirementsCompletion() {
        // Update completion status for each requirement
        for (let i = 0; i < requirementsList.length; i++) {
            const req = requirementsList[i];
            
            if (req.type === 'taplink') {
                req.completed = (totalLinks > 0 && clickedLinks.size >= totalLinks);
                req.clickedLinks = clickedLinks.size;
                req.text = `Kunjungi semua link yang disediakan (${clickedLinks.size}/${totalLinks} link)`;
            } else if (req.type === 'subscribe') {
                // For now, subscribe is not auto-checked - user must click a button
                // You can implement actual check via API if needed
                req.completed = false;
            } else if (req.type === 'boost') {
                req.completed = false;
            } else if (req.type === 'none') {
                req.completed = true;
            }
        }
    }
    
    function renderRequirements() {
        if (!elements.requirementsList) return;
        
        // Update completion status
        updateRequirementsCompletion();
        
        if (requirementsList.length === 0) {
            elements.requirementsSection.style.display = 'none';
            return;
        }
        
        elements.requirementsSection.style.display = 'block';
        
        let html = '';
        for (const req of requirementsList) {
            const isCompleted = req.completed;
            let statusIcon = '';
            let statusText = '';
            
            if (req.type === 'none') {
                statusIcon = '<i class="fas fa-check-circle requirement-check"></i>';
                statusText = '';
            } else if (isCompleted) {
                statusIcon = '<i class="fas fa-check-circle requirement-check"></i>';
                statusText = '<span class="requirement-status success">✓ Terpenuhi</span>';
            } else {
                statusIcon = '';
                statusText = '<span class="requirement-status pending">⏳ Belum</span>';
            }
            
            html += `
                <div class="requirement-item ${isCompleted ? 'completed' : ''}" data-type="${req.type}">
                    <div class="requirement-icon">
                        <i class="fas ${req.icon}"></i>
                    </div>
                    <div class="requirement-text">
                        ${escapeHtml(req.text)}
                        ${statusText}
                    </div>
                    ${statusIcon}
                </div>
            `;
        }
        
        elements.requirementsList.innerHTML = html;
        
        // Add click handlers for subscribe/boost if needed
        addRequirementActionHandlers();
    }
    
    function addRequirementActionHandlers() {
        // Add click handler for subscribe requirement
        const subscribeItem = document.querySelector('.requirement-item[data-type="subscribe"]');
        if (subscribeItem && !subscribeItem.classList.contains('completed')) {
            subscribeItem.style.cursor = 'pointer';
            subscribeItem.addEventListener('click', async () => {
                // Show channel selection or open subscribe link
                showToast('Silakan subscribe ke channel terlebih dahulu', 'info');
                // You can implement actual subscribe check here
            });
        }
        
        // Add click handler for boost requirement
        const boostItem = document.querySelector('.requirement-item[data-type="boost"]');
        if (boostItem && !boostItem.classList.contains('completed')) {
            boostItem.style.cursor = 'pointer';
            boostItem.addEventListener('click', async () => {
                showToast('Silakan boost channel terlebih dahulu', 'info');
                // You can implement actual boost check here
            });
        }
    }
    
    function checkParticipationEligibility() {
        if (hasParticipated) {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>✓ Sudah Berpartisipasi</span>';
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
        
        // Check captcha if enabled
        if (giveawayData?.captcha === 'On' && !isCaptchaVerified) {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = '<i class="fas fa-shield-alt"></i><span>🔒 Verifikasi Captcha Dulu</span>';
            }
            return false;
        }
        
        // Check all requirements
        let allRequirementsMet = true;
        let missingRequirement = '';
        
        for (const req of requirementsList) {
            if (req.type === 'none') continue;
            
            if (req.type === 'taplink' && totalLinks > 0) {
                if (clickedLinks.size < totalLinks) {
                    allRequirementsMet = false;
                    missingRequirement = `Kunjungi ${totalLinks - clickedLinks.size} link lagi`;
                    break;
                }
            } else if (req.type === 'subscribe') {
                // For now, assume not completed until implemented
                allRequirementsMet = false;
                missingRequirement = 'Subscribe ke channel terlebih dahulu';
                break;
            } else if (req.type === 'boost') {
                allRequirementsMet = false;
                missingRequirement = 'Boost channel terlebih dahulu';
                break;
            }
        }
        
        if (!allRequirementsMet) {
            if (elements.participateBtn) {
                elements.participateBtn.disabled = true;
                elements.participateBtn.innerHTML = `<i class="fas fa-lock"></i><span>${missingRequirement}</span>`;
            }
            return false;
        }
        
        // All requirements met
        if (elements.participateBtn) {
            elements.participateBtn.disabled = false;
            elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>🎁 Partisipasi Sekarang</span>';
        }
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
                
                // Load saved clicked links from localStorage
                if (giveawayData.code) {
                    const savedClicks = localStorage.getItem(`giveaway_links_${giveawayData.code}`);
                    if (savedClicks) {
                        const savedLinks = JSON.parse(savedClicks);
                        savedLinks.forEach(link => {
                            if (requiredLinks.includes(link)) {
                                clickedLinks.add(link);
                            }
                        });
                    }
                }
                
                // Parse requirements
                requirementsList = parseRequirements(giveawayData.syarat, totalLinks > 0);
                
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
                        elements.captchaRefresh.removeEventListener('click', generateCaptcha);
                        elements.captchaRefresh.addEventListener('click', generateCaptcha);
                    }
                    if (elements.captchaInput) {
                        elements.captchaInput.removeEventListener('input', verifyCaptcha);
                        elements.captchaInput.addEventListener('input', verifyCaptcha);
                    }
                } else {
                    elements.captchaSection.style.display = 'none';
                }
                
                // Check if user already participated
                if (telegramUser) {
                    await checkUserParticipation(giveawayData.code, telegramUser.id);
                }
                
                // Re-render to ensure status is updated
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
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/check-participation/${giveawayCode}/${userId}`, {
                method: 'GET'
            });
            
            if (data.success) {
                hasParticipated = data.has_participated;
                
                if (hasParticipated) {
                    if (elements.participationStatus) {
                        elements.participationStatus.style.display = 'block';
                    }
                    if (elements.participateBtn) {
                        elements.participateBtn.disabled = true;
                        elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>✓ Sudah Berpartisipasi</span>';
                    }
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
        
        // Final eligibility check
        if (!checkParticipationEligibility()) {
            showToast('Silakan penuhi semua syarat terlebih dahulu', 'warning');
            return;
        }
        
        // Save clicked links to localStorage
        if (clickedLinks.size > 0) {
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
                hasParticipated = true;
                if (elements.participationStatus) {
                    elements.participationStatus.style.display = 'block';
                }
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>✓ Berhasil Berpartisipasi!</span>';
                }
                showToast(data.message || 'Berhasil berpartisipasi! Semoga beruntung!', 'success');
                vibrate(50);
            } else {
                showToast(data.error || 'Gagal berpartisipasi', 'error');
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = false;
                    elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>🎁 Partisipasi Sekarang</span>';
                }
            }
        } catch (error) {
            console.error('Error participating:', error);
            showToast('Terjadi kesalahan, silakan coba lagi', 'error');
            if (elements.participateBtn) {
                elements.participateBtn.disabled = false;
                elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>🎁 Partisipasi Sekarang</span>';
            }
        } finally {
            participationInProgress = false;
        }
    }

    function getStartParam() {
        try {
            // Cek dari Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.start_param) {
                    return initData.start_param;
                }
            }
            
            // Fallback: cek dari URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('startapp') || urlParams.get('id');
        } catch (error) {
            console.error('Error getting start param:', error);
            return null;
        }
    }

    // ==================== INITIALIZATION ====================
    function init() {
        showLoading(true);
        
        try {
            // PRIORITAS: Ambil dari startapp (Telegram MiniApp)
            let giveawayCode = getStartParam();
            
            // Jika tidak ada, coba dari URL parameter 'id'
            if (!giveawayCode) {
                const urlParams = new URLSearchParams(window.location.search);
                giveawayCode = urlParams.get('id');
            }
            
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
                elements.participateBtn.removeEventListener('click', participate);
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
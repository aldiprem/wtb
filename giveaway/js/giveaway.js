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
    let userCheckState = {
        status: 'pending',
        isAllMember: false,
        pollingInterval: null
    };
    let participantsList = [];
    let participantsModal = null;
    let scrollPosition = 0;

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
        participateBtn: document.getElementById('participateBtn'),  // <-- Tambah koma di sini
        
        // Chat Card
        chatInfoCard: document.getElementById('chatInfoCard'),
        chatListContainer: document.getElementById('chatListContainer')
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

    async function renderChatInfo() {
        if (!elements.chatListContainer || !giveawayData?.code) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/chats/${giveawayData.code}`);
            const data = await response.json();
            
            console.log('[DEBUG] Chat info response:', data);
            
            if (!data.success || !data.chats || data.chats.length === 0) {
                if (elements.chatInfoCard) elements.chatInfoCard.style.display = 'none';
                return;
            }
            
            // Ambil invite links untuk private chats
            let inviteLinkMap = new Map();
            try {
                const inviteLinksResponse = await fetch(`${API_BASE_URL}/api/giveaway/invite-links`);
                const inviteLinksData = await inviteLinksResponse.json();
                if (inviteLinksData.success && inviteLinksData.invite_links) {
                    for (const item of inviteLinksData.invite_links) {
                        inviteLinkMap.set(item.chat_id, item.invite_link);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch invite links:', e);
            }
            
            if (elements.chatInfoCard) elements.chatInfoCard.style.display = 'block';
            
            const allChats = data.chats;
            const displayCount = Math.min(3, allChats.length);
            const remainingCount = allChats.length - 3;
            
            let html = '';
            
            // Tampilkan maksimal 3 chat
            for (let i = 0; i < displayCount; i++) {
                const chat = allChats[i];
                const chatName = chat.chat_title || 'Chat';
                const chatType = chat.chat_type || 'Chat';
                const chatId = chat.chat_id;
                const chatUsername = chat.chat_username || '';
                
                // PRIORITAS: Gunakan invite link jika ada (untuk private chat)
                let chatLink = inviteLinkMap.get(chatId);
                
                // Jika tidak ada invite link, fallback ke username
                if (!chatLink && chatUsername && chatUsername !== 'null' && chatUsername !== '') {
                    chatLink = `https://t.me/${chatUsername}`;
                }
                // Jika masih tidak ada, fallback ke ID (hanya untuk debug)
                else if (!chatLink && chatId) {
                    let cleanId = chatId.replace('-100', '');
                    chatLink = `https://t.me/${cleanId}`;
                }
                
                const nameForAvatar = encodeURIComponent(chatName.substring(0, 2));
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                
                html += `
                    <div class="chat-info-item" data-chat-link="${escapeHtml(chatLink)}">
                        <div class="chat-info-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(chatName)}" 
                                onerror="this.src='https://ui-avatars.com/api/?name=TG&background=40a7e3&color=fff&size=100&rounded=true'">
                        </div>
                        <div class="chat-info-details">
                            <div class="chat-info-name">${escapeHtml(chatName)}</div>
                            <div class="chat-info-meta">
                                <span class="chat-info-type">${escapeHtml(chatType)}</span>
                                <span class="chat-info-id">${escapeHtml(chatId)}</span>
                            </div>
                        </div>
                        <div class="chat-info-arrow">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                `;
            }
            
            elements.chatListContainer.innerHTML = html;
            
            // Tampilkan tombol "Chat Lainnya" jika lebih dari 3
            const chatMore = document.getElementById('chatMore');
            const remainingChatsCount = document.getElementById('remainingChatsCount');
            
            if (remainingCount > 0) {
                if (chatMore) chatMore.style.display = 'block';
                if (remainingChatsCount) remainingChatsCount.textContent = remainingCount;
            } else {
                if (chatMore) chatMore.style.display = 'none';
            }
            
            // Event listener untuk setiap chat item
            document.querySelectorAll('.chat-info-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hapticMedium();
                    const chatLink = item.dataset.chatLink;
                    if (chatLink && chatLink !== 'null' && chatLink !== 'undefined') {
                        window.open(chatLink, '_blank');
                        showToast('Membuka chat...', 'info');
                    } else {
                        showToast('Link tidak tersedia', 'error');
                    }
                });
            });
            
            // Simpan semua chats untuk modal
            window.allChatsData = allChats;
            window.inviteLinkMap = inviteLinkMap;
            
        } catch (error) {
            console.error('Error loading chat info:', error);
            if (elements.chatInfoCard) elements.chatInfoCard.style.display = 'none';
        }
    }

    function showAllChatsModal() {
        hapticMedium();
        
        if (!window.allChatsData || window.allChatsData.length === 0) {
            showToast('Tidak ada data chat', 'warning');
            return;
        }
        
        let chatModal = document.getElementById('chatModal');
        const allChatsList = document.getElementById('allChatsList');
        
        if (!chatModal || !allChatsList) {
            console.error('Chat modal elements not found');
            return;
        }
        
        let html = '';
        
        for (const chat of window.allChatsData) {
            const chatName = chat.chat_title || 'Chat';
            const chatType = chat.chat_type || 'Chat';
            const chatId = chat.chat_id;
            const chatUsername = chat.chat_username || '';
            
            // Dapatkan link dari map
            let chatLink = window.inviteLinkMap?.get(chatId);
            
            if (!chatLink && chatUsername && chatUsername !== 'null' && chatUsername !== '') {
                chatLink = `https://t.me/${chatUsername}`;
            } else if (!chatLink && chatId) {
                let cleanId = chatId.replace('-100', '');
                chatLink = `https://t.me/${cleanId}`;
            }
            
            const nameForAvatar = encodeURIComponent(chatName.substring(0, 2));
            const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=80&rounded=true&bold=true&length=2`;
            
            html += `
                <div class="modal-chat-item" data-chat-link="${escapeHtml(chatLink)}" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    background: var(--bg);
                    backdrop-filter: var(--glass-blur);
                    border-radius: 14px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    <div class="chat-avatar" style="
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        overflow: hidden;
                        flex-shrink: 0;
                        background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <img src="${avatarUrl}" alt="${escapeHtml(chatName)}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="chat-info" style="flex: 1; min-width: 0;">
                        <div class="chat-title" style="font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(chatName)}
                        </div>
                        <div class="chat-detail" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span class="chat-type" style="font-size: 10px; color: var(--primary); background: rgba(64, 167, 227, 0.15); padding: 2px 8px; border-radius: 20px;">${escapeHtml(chatType)}</span>
                            <span class="chat-id" style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${escapeHtml(chatId)}</span>
                        </div>
                    </div>
                    <div class="chat-visit-btn" style="
                        width: 32px;
                        height: 32px;
                        background: rgba(64, 167, 227, 0.15);
                        border: none;
                        border-radius: 10px;
                        color: var(--primary);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }
        
        allChatsList.innerHTML = html;
        
        // Event listener untuk setiap item modal chat
        document.querySelectorAll('#allChatsList .modal-chat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                hapticMedium();
                const chatLink = item.dataset.chatLink;
                if (chatLink && chatLink !== 'null' && chatLink !== 'undefined') {
                    window.open(chatLink, '_blank');
                    showToast('Membuka chat...', 'info');
                } else {
                    showToast('Link tidak tersedia', 'error');
                }
            });
        });
        
        document.body.classList.add('modal-open');
        chatModal.style.display = 'flex';
    }

    function closeChatModal() {
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            document.body.classList.remove('modal-open');
            chatModal.style.display = 'none';
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
                    ${isCompleted ? '<span class="requirement-status success">✓ Selesai</span>' : '<span class="requirement-status pending">⏳ Belum</span>'}
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
        if (elements.prizeModal) {
            document.body.classList.add('modal-open');
            elements.prizeModal.style.display = 'flex';
        }
    }

    function closePrizeModal() {
        hapticLight();
        if (elements.prizeModal) {
            document.body.classList.remove('modal-open');
            elements.prizeModal.style.display = 'none';
        }
    }

    function updateUIAfterParticipation() {
        // Sembunyikan FAB Button
        const fabContainer = document.querySelector('.fab-container');
        if (fabContainer) {
            fabContainer.classList.add('hide-after-participate');
        }
        
        // Sembunyikan Requirements Card
        const requirementsCard = document.getElementById('requirementsCard');
        if (requirementsCard) {
            requirementsCard.classList.add('hide-after-participate');
        }
        
        // Sembunyikan Links Card
        const linksCard = document.getElementById('linksCard');
        if (linksCard) {
            linksCard.classList.add('hide-after-participate');
        }
        
        // Sembunyikan Captcha Card jika ada
        const captchaCard = document.getElementById('captchaCard');
        if (captchaCard) {
            captchaCard.classList.add('hide-after-participate');
        }
        
        // Tampilkan Status Card
        const participationStatus = document.getElementById('participationStatus');
        if (participationStatus) {
            participationStatus.style.display = 'flex';
        }
        
        // Fetch dan tampilkan participants avatars
        fetchParticipants();
    }

    // Fungsi untuk update countdown dengan separator titik dua
    function updateCountdownDisplay(days, hours, minutes, seconds) {
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (daysEl) daysEl.textContent = formatNumber(days);
        if (hoursEl) hoursEl.textContent = formatNumber(hours);
        if (minutesEl) minutesEl.textContent = formatNumber(minutes);
        if (secondsEl) secondsEl.textContent = formatNumber(seconds);
    }

    // Perbarui fungsi startCountdown
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
            
            updateCountdownDisplay(days, hours, minutes, seconds);
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
                            <div class="header-actions">
                                <button class="captcha-refresh-header" id="captchaRefreshHeader">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                                <button class="modal-close" id="closeCaptchaModal">&times;</button>
                            </div>
                        </div>
                        <div class="modal-body captcha-modal-body">
                            <div class="captcha-display-modal">
                                <span id="captchaCodeDisplay">XXXXXX</span>
                            </div>
                            <div class="captcha-modal-input-group">
                                <input type="text" id="captchaInputModal" class="captcha-modal-input" placeholder="Kode Verifikasi" maxlength="6" autocomplete="off">
                            </div>
                            <button class="captcha-verify-btn" id="captchaVerifyBtn">
                                <i class="fas fa-check-circle"></i>
                                <span>Verifikasi</span>
                            </button>
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
            const refreshBtn = document.getElementById('captchaRefreshHeader');
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
            
            const closeCaptchaModalEl = () => {
                document.body.classList.remove('modal-open');
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
            
            document.body.classList.add('modal-open');
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
                renderChatInfo(); // Tambahkan ini untuk render chat card
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
                    updateUIAfterParticipation();
                }
            }
            // Selalu fetch participants jika ada
            fetchParticipants();
        } catch (error) {
            console.error('Error checking participation:', error);
        }
    }

    function addCountdownSeparators() {
        const countdownTimer = document.getElementById('countdownTimer');
        if (!countdownTimer) return;
        
        const blocks = countdownTimer.querySelectorAll('.countdown-block');
        blocks.forEach((block, index) => {
            if (index < blocks.length - 1) {
                const numberSpan = block.querySelector('.countdown-number');
                if (numberSpan && !numberSpan.querySelector('.countdown-separator')) {
                    const separator = document.createElement('span');
                    separator.className = 'countdown-separator';
                    separator.textContent = ':';
                    separator.style.marginLeft = '4px';
                    numberSpan.parentNode.insertBefore(separator, numberSpan.nextSibling);
                }
            }
        });
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
        
        participationInProgress = true;
        
        // Cek user state dari database (polling terakhir)
        if (!userCheckState.isAllMember && requirementsList.some(r => r.type === 'subscribe')) {
            await pollUserCheckState();
            
            if (!userCheckState.isAllMember) {
                hapticError();
                showToast('Anda belum bergabung ke semua chat yang diperlukan!', 'warning');
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = false;
                    elements.participateBtn.innerHTML = '<i class="fas fa-hand-peace"></i><span>Partisipasi</span>';
                }
                participationInProgress = false;
                return;
            }
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
            // Dapatkan photo_url dari Telegram WebApp
            let photoUrl = '';
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user && initData.user.photo_url) {
                    photoUrl = initData.user.photo_url;
                }
            }
            
            const data = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/participate`, {
                method: 'POST',
                body: JSON.stringify({
                    giveaway_code: giveawayData.code,
                    user: {
                        id: telegramUser.id,
                        username: telegramUser.username,
                        first_name: telegramUser.first_name,
                        last_name: telegramUser.last_name,
                        photo_url: photoUrl  // Kirim photo_url
                    }
                })
            });
            
            if (data.success) {
                hapticSuccess();
                hasParticipated = true;
                
                // UPDATE UI SETELAH BERHASIL PARTISIPASI
                updateUIAfterParticipation();
                
                if (elements.participateBtn) {
                    elements.participateBtn.disabled = true;
                    elements.participateBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Berhasil!</span>';
                }
                
                showToast(data.message || 'Berhasil berpartisipasi!', 'success');
                await loadUserStats();
                stopUserStatePolling();
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
            
            console.log('[DEBUG] showChatListModal response:', data);
            
            if (!data.success) {
                showToast(data.error || 'Gagal memuat daftar chat', 'error');
                return;
            }
            
            const chats = data.chats || [];
            
            if (chats.length === 0) {
                showToast('Tidak ada chat yang tersimpan', 'warning');
                return;
            }
            
            // Gunakan modal yang sudah ada atau buat baru
            let chatListModal = document.getElementById('chatListModal');
            if (!chatListModal) {
                chatListModal = document.createElement('div');
                chatListModal.id = 'chatListModal';
                chatListModal.className = 'modal-overlay';
                chatListModal.innerHTML = `
                    <div class="modal-container" style="max-width: 320px;">
                        <div class="modal-header" style="padding: 12px 16px;">
                            <h3 style="font-size: 14px;"><i class="fas fa-telegram"></i> Daftar Chat</h3>
                            <button class="modal-close" id="closeChatListModal" style="width: 30px; height: 30px;">&times;</button>
                        </div>
                        <div class="modal-body" id="chatListModalBody" style="padding: 12px 16px;"></div>
                    </div>
                `;
                document.body.appendChild(chatListModal);
                
                document.getElementById('closeChatListModal')?.addEventListener('click', () => {
                    document.body.classList.remove('modal-open');
                    chatListModal.style.display = 'none';
                });
                
                chatListModal.addEventListener('click', (e) => {
                    if (e.target === chatListModal) {
                        document.body.classList.remove('modal-open');
                        chatListModal.style.display = 'none';
                    }
                });
            }
            
            // Ambil invite links
            let inviteLinkMap = new Map();
            try {
                const inviteLinksResponse = await fetch(`${API_BASE_URL}/api/giveaway/invite-links`);
                const inviteLinksData = await inviteLinksResponse.json();
                if (inviteLinksData.success && inviteLinksData.invite_links) {
                    for (const item of inviteLinksData.invite_links) {
                        inviteLinkMap.set(item.chat_id, item.invite_link);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch invite links:', e);
            }
            
            const chatContainer = document.getElementById('chatListModalBody');
            if (chatContainer) {
                let html = '';
                
                for (const chat of chats) {
                    const chatName = chat.chat_title || 'Chat';
                    const chatType = chat.chat_type || 'Chat';
                    const chatId = chat.chat_id;
                    const chatUsername = chat.chat_username || '';
                    
                    let chatLink = inviteLinkMap.get(chatId);
                    
                    if (!chatLink && chatUsername && chatUsername !== 'null' && chatUsername !== '') {
                        chatLink = `https://t.me/${chatUsername}`;
                    } else if (!chatLink && chatId) {
                        let cleanId = chatId.replace('-100', '');
                        chatLink = `https://t.me/${cleanId}`;
                    }
                    
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
                            border-radius: 12px;
                            margin-bottom: 8px;
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
                                <img src="${avatarUrl}" alt="${escapeHtml(chatName)}" style="width: 100%; height: 100%; object-fit: cover;">
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
                
                document.querySelectorAll('#chatListModalBody .chat-list-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        hapticMedium();
                        const chatLink = item.dataset.chatLink;
                        if (chatLink && chatLink !== 'null' && chatLink !== 'undefined') {
                            window.open(chatLink, '_blank');
                            showToast('Membuka chat...', 'info');
                        } else {
                            showToast('Link tidak tersedia', 'error');
                        }
                    });
                });
            }
            
            document.body.classList.add('modal-open');
            chatListModal.style.display = 'flex';
            
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
            document.body.classList.remove('modal-open');
            chatModal.style.display = 'none';
        }
    }

    async function refreshChatAndMembership() {
        hapticMedium();
        
        const refreshBtn = document.getElementById('refreshChatBtn');
        if (!refreshBtn) return;
        
        // Tambahkan class loading
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        
        showToast('Memperbarui data chat...', 'info', 1500);
        
        try {
            // 1. Refresh chat info (render ulang dari database)
            await renderChatInfo();
            
            // 2. Refresh user check state (polling ulang untuk cek membership)
            if (giveawayData?.code && telegramUser?.id && !hasParticipated) {
                // Cek ulang user state dari database
                await pollUserCheckState(true); // force refresh
                
                // Update requirement subscribe status
                for (let i = 0; i < requirementsList.length; i++) {
                    if (requirementsList[i].type === 'subscribe') {
                        requirementsList[i].completed = userCheckState.isAllMember;
                        requirementsList[i].text = userCheckState.isAllMember ? '✓ Bergabung Chat ID' : 'Bergabung Chat ID';
                        break;
                    }
                }
                
                renderRequirements();
                checkParticipationEligibility();
                
                if (userCheckState.isAllMember) {
                    hapticSuccess();
                    showToast('✅ Anda sudah bergabung ke semua chat!', 'success');
                } else {
                    hapticWarning();
                    showToast('⚠️ Anda belum bergabung ke semua chat yang diperlukan', 'warning');
                }
            } else {
                showToast('Data chat diperbarui', 'success');
            }
            
        } catch (error) {
            console.error('Error refreshing chat:', error);
            hapticError();
            showToast('Gagal memperbarui data chat', 'error');
        } finally {
            // Hapus class loading
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }

    // Modifikasi fungsi pollUserCheckState untuk support force refresh
    async function pollUserCheckState(force = false) {
        if (!giveawayData?.code || !telegramUser?.id) return;
        if (!force && (userCheckState.status === 'done' || userCheckState.status === 'reject')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/user-state/${giveawayData.code}/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success) {
                userCheckState.status = data.status;
                userCheckState.isAllMember = data.is_all_member;
                
                // Update requirement subscribe status
                for (let i = 0; i < requirementsList.length; i++) {
                    if (requirementsList[i].type === 'subscribe') {
                        requirementsList[i].completed = data.is_all_member;
                        requirementsList[i].text = data.is_all_member ? '✓ Bergabung Chat ID' : 'Bergabung Chat ID';
                        break;
                    }
                }
                
                renderRequirements();
                checkParticipationEligibility();
                
                // Jika sudah selesai (done/reject) dan bukan force, stop polling
                if (!force && (data.status === 'done' || data.status === 'reject')) {
                    stopUserStatePolling();
                }
            }
        } catch (error) {
            console.error('Error polling user state:', error);
        }
    }

    // ==================== REFRESH PAGE (RELOAD BROWSER) ====================
    async function refreshPage() {
        hapticMedium();
        
        const refreshBtn = document.getElementById('refreshChatBtn');
        if (refreshBtn) {
            // Tambahkan class loading sebentar
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }
        
        showToast('🔄 Memuat ulang halaman...', 'info', 1000);
        
        // Reload halaman setelah delay 500ms (agar toast terlihat)
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    // Event listener untuk tombol refresh
    function setupRefreshButton() {
        const refreshBtn = document.getElementById('refreshChatBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                refreshPage();
            });
        }
    }

    function setupShowAllChatsButton() {
        const showAllChatsBtn = document.getElementById('showAllChatsBtn');
        if (showAllChatsBtn) {
            showAllChatsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAllChatsModal();
            });
        }
        
        const closeChatModalBtn = document.getElementById('closeChatModal');
        if (closeChatModalBtn) {
            closeChatModalBtn.addEventListener('click', () => {
                closeChatModal();
            });
        }
        
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.addEventListener('click', (e) => {
                if (e.target === chatModal) {
                    closeChatModal();
                }
            });
        }
    }

    function startUserStatePolling() {
        if (userCheckState.pollingInterval) clearInterval(userCheckState.pollingInterval);
        
        // Polling setiap 2 detik
        userCheckState.pollingInterval = setInterval(() => {
            if (giveawayData && telegramUser && !hasParticipated) {
                pollUserCheckState();
            }
        }, 2000);
    }

    function stopUserStatePolling() {
        if (userCheckState.pollingInterval) {
            clearInterval(userCheckState.pollingInterval);
            userCheckState.pollingInterval = null;
        }
    }

    async function saveUserCheckState() {
        if (!giveawayData?.code || !telegramUser?.id) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/user-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    giveaway_code: giveawayData.code,
                    giveaway_id: giveawayData.id,
                    user_id: telegramUser.id,
                    username: telegramUser.username || '',
                    first_name: telegramUser.first_name || '',
                    total_chats: 0
                })
            });
            const data = await response.json();
            if (data.success) {
                console.log('User state saved');
            }
        } catch (error) {
            console.error('Error saving user state:', error);
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

    async function fetchParticipants() {
        if (!giveawayData?.code) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/participants/${giveawayData.code}`);
            const data = await response.json();
            
            if (data.success && data.participants && data.participants.length > 0) {
                participantsList = data.participants;
                renderAvatars(participantsList);
                
                // Tampilkan card avatars
                const avatarsCard = document.getElementById('participationAvatarsCard');
                if (avatarsCard) {
                    avatarsCard.style.display = 'flex';
                }
            } else {
                // Sembunyikan card jika tidak ada peserta
                const avatarsCard = document.getElementById('participationAvatarsCard');
                if (avatarsCard) {
                    avatarsCard.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error fetching participants:', error);
        }
    }

    function renderAvatars(participants) {
        const avatarsStack = document.getElementById('avatarsStack');
        if (!avatarsStack) return;
        
        const totalParticipants = participants.length;
        const sortedParticipants = [...participants];
        
        const displayParticipants = sortedParticipants.slice(-5);
        const remainingCount = totalParticipants - 5;
        
        let html = '';
        
        for (let i = 0; i < displayParticipants.length; i++) {
            const p = displayParticipants[i];
            const userName = p.first_name || p.username || 'User';
            const initial = userName.charAt(0).toUpperCase();
            
            let photoUrl = p.photo_url;
            if (!photoUrl || photoUrl === '') {
                const nameForAvatar = encodeURIComponent(userName.substring(0, 2));
                photoUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=80&rounded=true&bold=true&length=2`;
            }
            
            html += `
                <div class="avatar-stack-item" 
                    data-user-id="${p.user_id}" 
                    data-username="${escapeHtml(p.username || '')}" 
                    data-first-name="${escapeHtml(p.first_name || '')}" 
                    data-last-name="${escapeHtml(p.last_name || '')}"
                    data-photo-url="${escapeHtml(photoUrl)}"
                    title="${escapeHtml(userName)}">
                    <img src="${photoUrl}" alt="${escapeHtml(userName)}" 
                        onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=40a7e3&color=fff&size=80&rounded=true'">
                </div>
            `;
        }
        
        let sideText = '';
        if (totalParticipants > 0) {
            if (totalParticipants < 5) {
                sideText = `<span class="avatars-side-text">${totalParticipants} Peserta</span>`;
            } else if (remainingCount > 0) {
                sideText = `<span class="avatars-side-text">+${remainingCount} Peserta Lainnya...</span>`;
            }
        }
        
        // RENDER LENGKAP DENGAN TOMBOL
        const containerHtml = `
            <div class="avatars-stack-wrapper">
                <div class="avatars-stack">
                    ${html}
                    ${sideText}
                </div>
                <button class="avatars-view-btn" id="viewAllParticipantsBtn">
                    <span>Lihat semua</span>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        avatarsStack.innerHTML = containerHtml;
        
        // Event listener untuk avatar item
        document.querySelectorAll('.avatar-stack-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = item.dataset.userId;
                const username = item.dataset.username;
                const firstName = item.dataset.firstName;
                const lastName = item.dataset.lastName;
                const photoUrl = item.dataset.photoUrl;
                showUserProfileModal(userId, username, firstName, lastName, photoUrl);
            });
        });
        
        // Event listener untuk tombol show all participants
        const viewBtn = document.getElementById('viewAllParticipantsBtn');
        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAllParticipantsModal();
            });
        }
    }

    // Tambahkan CSS untuk side text di style
    const addAvatarsStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .avatars-stack-wrapper {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                gap: 12px;
            }
            
            .avatars-stack {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 0;
                flex: 1;
            }
            
            .avatars-side-text {
                font-size: 15px;
                color: var(--text-secondary);
                margin-left: 8px;
                white-space: nowrap;
            }
            
            @media (max-width: 480px) {
                .avatars-side-text {
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    };

    function showUserProfileModal(userId, username, firstName, lastName, photoUrl = null) {
        hapticMedium();
        
        const fullName = `${firstName || ''} ${lastName || ''}`.trim() || username || 'Pengguna';
        const initial = fullName.charAt(0).toUpperCase();
        
        // PRIORITAS: Gunakan photo_url jika ada
        let displayPhotoUrl = photoUrl;
        if (!displayPhotoUrl || displayPhotoUrl === '') {
            displayPhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=40a7e3&color=fff&size=200&rounded=true&bold=true&length=2`;
        }
        
        // Buat modal sederhana untuk profile user
        let userProfileModal = document.getElementById('userProfileModal');
        if (!userProfileModal) {
            userProfileModal = document.createElement('div');
            userProfileModal.id = 'userProfileModal';
            userProfileModal.className = 'modal-overlay';
            userProfileModal.innerHTML = `
                <div class="modal-container" style="max-width: 280px;">
                    <div class="modal-header" style="padding: 16px;">
                        <h3><i class="fas fa-user"></i> Profil Peserta</h3>
                        <button class="modal-close" id="closeUserProfileModal">&times;</button>
                    </div>
                    <div class="modal-body" style="text-align: center; padding: 20px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin: 0 auto 12px; background: linear-gradient(135deg, var(--primary), var(--primary-dark));">
                            <img id="userProfileAvatar" src="" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div id="userProfileName" style="font-size: 16px; font-weight: 600; margin-bottom: 4px;"></div>
                        <div id="userProfileUsername" style="font-size: 12px; color: var(--text-muted);"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(userProfileModal);
            
            document.getElementById('closeUserProfileModal')?.addEventListener('click', () => {
                document.body.classList.remove('modal-open');
                userProfileModal.style.display = 'none';
            });

            userProfileModal.addEventListener('click', (e) => {
                if (e.target === userProfileModal) {
                    document.body.classList.remove('modal-open');
                    userProfileModal.style.display = 'none';
                }
            });
        }
        
        document.getElementById('userProfileAvatar').src = displayPhotoUrl;
        document.getElementById('userProfileName').textContent = fullName;
        document.getElementById('userProfileUsername').textContent = username ? `@${username}` : 'Tidak ada username';
        
        document.body.classList.add('modal-open');
        userProfileModal.style.display = 'flex';
    }

    function showAllParticipantsModal() {
        hapticMedium();
        
        const modal = document.getElementById('participantsModal');
        const container = document.getElementById('participantsListContainer');
        
        if (!modal || !container) return;
        
        let html = '';
        
        for (const p of participantsList) {
            const userName = p.first_name || p.username || 'User';
            const initial = userName.charAt(0).toUpperCase();
            const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || 'Pengguna';
            
            // PRIORITAS: Gunakan photo_url dari database
            let photoUrl = p.photo_url;
            if (!photoUrl || photoUrl === '') {
                photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=40a7e3&color=fff&size=80&rounded=true&bold=true&length=1`;
            }
            
            html += `
                <div class="modal-participant-item" 
                    data-user-id="${p.user_id}" 
                    data-username="${escapeHtml(p.username || '')}" 
                    data-first-name="${escapeHtml(p.first_name || '')}" 
                    data-last-name="${escapeHtml(p.last_name || '')}"
                    data-photo-url="${escapeHtml(photoUrl)}">
                    <div class="participant-avatar">
                        <img src="${photoUrl}" alt="${escapeHtml(userName)}" 
                            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=40a7e3&color=fff&size=80&rounded=true'">
                    </div>
                    <div class="participant-info">
                        <div class="participant-name">${escapeHtml(fullName)}</div>
                        <div class="participant-username">${p.username ? `@${p.username}` : 'ID: ' + p.user_id}</div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Event listener untuk item participant
        document.querySelectorAll('.modal-participant-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const username = item.dataset.username;
                const firstName = item.dataset.firstName;
                const lastName = item.dataset.lastName;
                const photoUrl = item.dataset.photoUrl;
                modal.style.display = 'none';
                showUserProfileModal(userId, username, firstName, lastName, photoUrl);
            });
        });
        
        document.body.classList.add('modal-open');
        modal.style.display = 'flex';
    }

    function setupParticipantsModal() {
        const modal = document.getElementById('participantsModal');
        const closeBtn = document.getElementById('closeParticipantsModal');
        
        if (modal && closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.classList.remove('modal-open');
                modal.style.display = 'none';userProfileModal.style.display = 'flex';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.classList.remove('modal-open');
                    modal.style.display = 'none';
                }
            });
        }
    }

    // Tambahkan view all participants button event
    function setupViewAllButton() {
        const viewBtn = document.getElementById('viewAllParticipantsBtn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                showAllParticipantsModal();
            });
        }
    }

    async function forceSaveUserState() {
        if (!giveawayData?.code || !telegramUser?.id) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/giveaway/user-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    giveaway_code: giveawayData.code,
                    giveaway_id: giveawayData.id,
                    user_id: telegramUser.id,
                    username: telegramUser.username || '',
                    first_name: telegramUser.first_name || '',
                    total_chats: 0
                })
            });
            const data = await response.json();
            if (data.success) {
                console.log('User state re-saved');
                // Reset status untuk polling ulang
                userCheckState.status = 'pending';
                userCheckState.isAllMember = false;
                startUserStatePolling();
            }
        } catch (error) {
            console.error('Error re-saving user state:', error);
        }
    }

    function init() {
        initTelegram();
        addAvatarsStyles();
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
            
            // Setup modal
            setupParticipantsModal();
            setupViewAllButton();
            
            // 🔥 Setup refresh button (reload page)
            setupRefreshButton();
            
            // 🔥 Setup show all chats button
            setupShowAllChatsButton();
            
            loadGiveaway(giveawayCode).then(async () => {
                await saveUserCheckState();
                
                // Fetch participants untuk menampilkan avatar stack
                fetchParticipants();
                
                if (giveawayData && giveawayData.syarat && giveawayData.syarat.includes('Subscribe') && !hasParticipated) {
                    startUserStatePolling();
                }
            });
        } catch (error) {
            console.error('Init error:', error);
            showToast('Terjadi kesalahan', 'error');
            showLoading(false);
        }
    }
    init();
})();
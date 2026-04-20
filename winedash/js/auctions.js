// winedash/js/auctions.js - Auction System
(function() {
    'use strict';
    
    console.log('🔨 Winedash Auctions - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let currentAuctionTab = 'active'; // active, my-auctions, my-bids
    let currentAuctions = [];
    let currentSearchTerm = '';
    let currentLayout = localStorage.getItem('auctions_layout') || 'grid';
    let auctionTimers = {};
    let createAuctionPanel = null;
    let auctionDetailOverlay = null;
    let auctionDetailPanel = null;
    
    // DOM Elements
    let auctionsContainer = null;
    let auctionsSearchInput = null;
    let auctionsSearchApplyBtn = null;
    let auctionsGridBtn = null;
    let auctionsListBtn = null;
    let createAuctionBtn = null;
    
    // ==================== UTILITY FUNCTIONS ====================
    
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
    
    function showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        else hapticLight();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    function showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        return parseFloat(num).toFixed(2);
    }
    
    function formatTimeRemaining(endTimeStr) {
        const end = new Date(endTimeStr);
        const now = new Date();
        const diff = end - now;
        
        if (diff <= 0) return 'Ended';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (3600000)) / (1000 * 60));
        const seconds = Math.floor((diff % (60000)) / 1000);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    function formatDateIndonesia(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }
    
    // ==================== TELEGRAM USER ====================
    
    function getTelegramUserFromWebApp() {
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
    
    async function authenticateUser() {
        if (!telegramUser) return null;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(telegramUser)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Error authenticating user:', error);
            return null;
        }
    }
    
    // ==================== FETCH PROFILE PHOTO ====================
    
    async function fetchProfilePhoto(username) {
        const cached = localStorage.getItem(`avatar_${username}`);
        if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && !cached.includes('ui-avatars.com')) {
            return cached;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                localStorage.setItem(`avatar_${username}`, data.photo_url);
                return data.photo_url;
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile photo:', error);
            return null;
        }
    }
    
    // ==================== LOAD USER USERNAMES ====================
    
    async function loadUserUsernames() {
        if (!telegramUser) return [];
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            
            if (data.success && data.usernames) {
                // Filter usernames owned by user and available (not on auction)
                return data.usernames.filter(u => 
                    u.seller_id === telegramUser.id && 
                    u.status === 'available'
                );
            }
            return [];
        } catch (error) {
            console.error('Error loading user usernames:', error);
            return [];
        }
    }
    
    // ==================== LOAD AUCTIONS ====================
    
    async function loadAuctions() {
        if (!telegramUser) return;
        
        showLoading(true);
        
        try {
            console.log(`[AUCTIONS] Loading auctions for tab: ${currentAuctionTab}`);
            
            let url = '';
            switch (currentAuctionTab) {
                case 'active':
                    url = `${API_BASE_URL}/api/winedash/auctions/active`;
                    break;
                case 'my-auctions':
                    url = `${API_BASE_URL}/api/winedash/auctions/my/${telegramUser.id}`;
                    break;
                case 'my-bids':
                    url = `${API_BASE_URL}/api/winedash/auctions/my-bids/${telegramUser.id}`;
                    break;
                default:
                    url = `${API_BASE_URL}/api/winedash/auctions/active`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log(`[AUCTIONS] Loaded auctions:`, data);
            
            if (data.success) {
                currentAuctions = data.auctions || [];
                filterAndRenderAuctions();
                startTimers();
            } else {
                currentAuctions = [];
                renderAuctionsEmpty();
            }
        } catch (error) {
            console.error('[AUCTIONS] Error loading auctions:', error);
            renderAuctionsEmpty();
        } finally {
            showLoading(false);
        }
    }
    
    function filterAndRenderAuctions() {
        let filtered = [...currentAuctions];
        
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(auction => 
                auction.username && auction.username.toLowerCase().includes(term)
            );
        }
        
        renderAuctions(filtered);
    }
    
    function renderAuctions(auctions) {
        if (!auctionsContainer) return;
        
        if (!auctions || auctions.length === 0) {
            renderAuctionsEmpty();
            return;
        }
        
        if (currentLayout === 'grid') {
            auctionsContainer.className = 'auctions-grid';
            let html = '';
            
            for (const auction of auctions) {
                const username = auction.username || '';
                const timeRemaining = formatTimeRemaining(auction.end_time);
                const currentPrice = auction.current_price || auction.start_price || 0;
                const bidCount = auction.bid_count || 0;
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                html += `
                    <div class="auction-card" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                        <div class="auction-card-image">
                            <div class="auction-card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auction-card-username">@${escapeHtml(username)}</div>
                        </div>
                        <div class="auction-card-info">
                            <div class="auction-card-timer" id="timer-${auction.id}">${timeRemaining}</div>
                            <div class="auction-card-current-bid">Current: ${formatNumber(currentPrice)} TON</div>
                            <div class="auction-card-status">ON AUCTION</div>
                        </div>
                    </div>
                `;
            }
            
            auctionsContainer.innerHTML = html;
            
            // Attach click events
            document.querySelectorAll('.auction-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    try {
                        const auctionData = JSON.parse(card.dataset.auction.replace(/&#39;/g, "'"));
                        showAuctionDetail(auctionData.id);
                    } catch (err) {
                        console.error('Error parsing auction data:', err);
                    }
                });
            });
            
            // Fetch avatars async
            setTimeout(() => fetchAllAuctionAvatars(), 200);
            
        } else {
            // List layout
            auctionsContainer.className = 'auctions-list';
            let html = '';
            
            for (const auction of auctions) {
                const username = auction.username || '';
                const timeRemaining = formatTimeRemaining(auction.end_time);
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                html += `
                    <div class="auctions-list-item" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                        <div class="auctions-list-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="auctions-list-info">
                            <div class="auctions-list-username">@${escapeHtml(username)}</div>
                            <div class="auctions-list-timer" id="timer-${auction.id}">Ends: ${timeRemaining}</div>
                        </div>
                        <div class="auctions-list-status">ON AUCTION</div>
                    </div>
                `;
            }
            
            auctionsContainer.innerHTML = html;
            
            // Attach click events
            document.querySelectorAll('.auctions-list-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    try {
                        const auctionData = JSON.parse(item.dataset.auction.replace(/&#39;/g, "'"));
                        showAuctionDetail(auctionData.id);
                    } catch (err) {
                        console.error('Error parsing auction data:', err);
                    }
                });
            });
            
            setTimeout(() => fetchAllAuctionAvatars(), 200);
        }
    }
    
    async function fetchAllAuctionAvatars() {
        const avatars = document.querySelectorAll('.auction-card-avatar img, .auctions-list-avatar img');
        
        for (const img of avatars) {
            const username = img.dataset?.username || img.alt?.replace('@', '');
            if (!username) continue;
            
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                if (img.src !== cached) img.src = cached;
                continue;
            }
            
            try {
                const photoUrl = await fetchProfilePhoto(username);
                if (photoUrl && photoUrl.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, photoUrl);
                    img.src = photoUrl;
                }
            } catch (error) {
                console.error(`Error fetching avatar for @${username}:`, error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    function renderAuctionsEmpty() {
        if (!auctionsContainer) return;
        
        let emptyMessage = '';
        switch (currentAuctionTab) {
            case 'active':
                emptyMessage = 'Tidak ada auction aktif';
                break;
            case 'my-auctions':
                emptyMessage = 'Anda belum membuat auction';
                break;
            case 'my-bids':
                emptyMessage = 'Anda belum melakukan bid pada auction manapun';
                break;
            default:
                emptyMessage = 'Tidak ada data';
        }
        
        auctionsContainer.innerHTML = `
            <div class="offers-empty-state">
                <div class="offers-empty-animation" id="auctionsEmptyAnimation"></div>
                <div class="offers-empty-title">No Auctions</div>
                <div class="offers-empty-subtitle">${emptyMessage}</div>
            </div>
        `;
        
        const animContainer = document.getElementById('auctionsEmptyAnimation');
        if (animContainer) {
            animContainer.innerHTML = '<i class="fas fa-gavel" style="font-size: 48px; color: var(--text-muted);"></i>';
        }
    }
    
    // ==================== TIMER MANAGEMENT ====================
    
    function startTimers() {
        // Clear existing timers
        for (const id in auctionTimers) {
            clearInterval(auctionTimers[id]);
        }
        auctionTimers = {};
        
        for (const auction of currentAuctions) {
            const timerElement = document.getElementById(`timer-${auction.id}`);
            if (!timerElement) continue;
            
            const updateTimer = () => {
                const remaining = formatTimeRemaining(auction.end_time);
                if (remaining === 'Ended') {
                    clearInterval(auctionTimers[auction.id]);
                    timerElement.textContent = 'Ended';
                    // Reload auctions to remove ended ones
                    setTimeout(() => loadAuctions(), 1000);
                } else {
                    timerElement.textContent = remaining;
                }
            };
            
            updateTimer();
            auctionTimers[auction.id] = setInterval(updateTimer, 1000);
        }
    }
    
    // ==================== CREATE AUCTION PANEL ====================
    
    function showCreateAuctionPanel() {
        if (createAuctionPanel) {
            createAuctionPanel.remove();
            createAuctionPanel = null;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'panel-overlay';
        overlay.id = 'createAuctionOverlay';
        document.body.appendChild(overlay);
        
        const panel = document.createElement('div');
        panel.className = 'create-auction-panel';
        panel.innerHTML = `
            <div class="panel-drag-handle"></div>
            <div class="panel-header">
                <h3><i class="fas fa-gavel"></i> Create Auction</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="panel-content">
                <div class="form-group">
                    <label class="form-label">Select Username</label>
                    <select class="username-select" id="auctionUsernameSelect">
                        <option value="">Loading usernames...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Start Price (TON)</label>
                    <input type="number" id="auctionStartPrice" class="form-input" placeholder="0.1" step="0.1" min="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Minimum Bid Increment (TON)</label>
                    <input type="number" id="auctionMinIncrement" class="form-input" placeholder="0.1" step="0.1" min="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">Duration</label>
                    <div class="duration-options">
                        <button class="duration-option" data-duration="1h">1 Hour</button>
                        <button class="duration-option" data-duration="12h">12 Hours</button>
                        <button class="duration-option" data-duration="1d">1 Day</button>
                        <button class="duration-option" data-duration="7d">1 Week</button>
                    </div>
                    <div class="custom-duration-input" style="margin-top: 10px; display: none;">
                        <input type="number" id="auctionCustomDuration" class="form-input" placeholder="Hours" min="1" step="1">
                    </div>
                </div>
                <button class="panel-action-btn" id="confirmCreateAuctionBtn">Start Auction</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        createAuctionPanel = panel;
        overlay.classList.add('active');
        document.body.classList.add('panel-open');
        
        setTimeout(() => panel.classList.add('open'), 10);
        
        // Load usernames
        loadUserUsernames().then(usernames => {
            const select = document.getElementById('auctionUsernameSelect');
            if (select && usernames.length > 0) {
                select.innerHTML = usernames.map(u => 
                    `<option value="${u.id}" data-username="${u.username}">@${u.username}</option>`
                ).join('');
            } else if (select) {
                select.innerHTML = '<option value="">No available usernames</option>';
            }
        });
        
        // Setup duration options
        let selectedDuration = '1h';
        document.querySelectorAll('.duration-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.duration-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedDuration = btn.dataset.duration;
                
                const customInput = document.querySelector('.custom-duration-input');
                if (selectedDuration === 'custom') {
                    customInput.style.display = 'block';
                } else {
                    customInput.style.display = 'none';
                }
            });
        });
        document.querySelector('.duration-option').classList.add('active');
        
        // Close button
        const closeBtn = panel.querySelector('.panel-close');
        closeBtn.addEventListener('click', closeCreateAuctionPanel);
        
        // Overlay click
        overlay.addEventListener('click', closeCreateAuctionPanel);
        
        // Confirm button
        const confirmBtn = document.getElementById('confirmCreateAuctionBtn');
        confirmBtn.addEventListener('click', async () => {
            const select = document.getElementById('auctionUsernameSelect');
            const selectedOption = select.options[select.selectedIndex];
            const usernameId = select.value;
            const username = selectedOption?.dataset?.username;
            const startPrice = parseFloat(document.getElementById('auctionStartPrice').value);
            const minIncrement = parseFloat(document.getElementById('auctionMinIncrement').value);
            
            if (!usernameId || !username) {
                showToast('Pilih username terlebih dahulu', 'warning');
                return;
            }
            
            if (isNaN(startPrice) || startPrice < 0.1) {
                showToast('Start price minimal 0.1 TON', 'warning');
                return;
            }
            
            if (isNaN(minIncrement) || minIncrement < 0.01) {
                showToast('Minimum increment minimal 0.01 TON', 'warning');
                return;
            }
            
            let duration = selectedDuration;
            if (duration === 'custom') {
                const customHours = parseInt(document.getElementById('auctionCustomDuration').value);
                if (isNaN(customHours) || customHours < 1) {
                    showToast('Masukkan durasi yang valid (minimal 1 jam)', 'warning');
                    return;
                }
                duration = `${customHours}h`;
            }
            
            await createAuction(username, parseInt(usernameId), startPrice, minIncrement, duration);
        });
        
        hapticLight();
    }
    
    function closeCreateAuctionPanel() {
        if (createAuctionPanel) {
            createAuctionPanel.classList.remove('open');
            setTimeout(() => {
                createAuctionPanel.remove();
                createAuctionPanel = null;
            }, 300);
        }
        
        const overlay = document.getElementById('createAuctionOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
        
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    async function createAuction(username, usernameId, startPrice, minIncrement, duration) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    username_id: usernameId,
                    owner_id: telegramUser.id,
                    start_price: startPrice,
                    min_increment: minIncrement,
                    duration: duration
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast(data.message, 'success');
                closeCreateAuctionPanel();
                // Switch to my-auctions tab
                switchAuctionTab('my-auctions');
                await loadAuctions();
            } else {
                showToast(data.error || 'Gagal membuat auction', 'error');
            }
        } catch (error) {
            console.error('Error creating auction:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== AUCTION DETAIL ====================
    
    async function showAuctionDetail(auctionId) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/detail/${auctionId}`);
            const data = await response.json();
            
            if (!data.success) {
                showToast('Gagal memuat detail auction', 'error');
                return;
            }
            
            const auction = data.auction;
            const bids = data.bids || [];
            
            if (auctionDetailOverlay) {
                auctionDetailOverlay.remove();
            }
            if (auctionDetailPanel) {
                auctionDetailPanel.remove();
            }
            
            auctionDetailOverlay = document.createElement('div');
            auctionDetailOverlay.className = 'auction-detail-overlay';
            document.body.appendChild(auctionDetailOverlay);
            
            const username = auction.username || '';
            const timeRemaining = formatTimeRemaining(auction.end_time);
            const isOwner = telegramUser && auction.owner_id === telegramUser.id;
            const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();
            
            let avatarUrl = localStorage.getItem(`avatar_${username}`);
            if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                avatarUrl = "https://companel.shop/image/winedash-logo.png";
            }
            
            let bidHistoryHtml = '';
            for (const bid of bids) {
                const bidderName = bid.username || bid.first_name || 'Anonymous';
                const bidderPhoto = bid.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bidderName)}&background=40a7e3&color=fff&size=40&rounded=true`;
                const bidTime = formatDateIndonesia(bid.timestamp);
                
                bidHistoryHtml += `
                    <div class="bid-item">
                        <div class="bid-avatar">
                            <img src="${bidderPhoto}" alt="${escapeHtml(bidderName)}">
                        </div>
                        <div class="bid-info">
                            <div class="bid-user">${escapeHtml(bidderName)}</div>
                            <div class="bid-amount">${formatNumber(bid.bid_amount)} TON</div>
                        </div>
                        <div class="bid-time">${bidTime}</div>
                    </div>
                `;
            }
            
            if (bidHistoryHtml === '') {
                bidHistoryHtml = '<div class="empty-state" style="padding: 20px;">No bids yet</div>';
            }
            
            auctionDetailPanel = document.createElement('div');
            auctionDetailPanel.className = 'auction-detail-panel';
            auctionDetailPanel.innerHTML = `
                <div class="detail-header">
                    <h3><i class="fas fa-gavel"></i> Auction Detail</h3>
                    <button class="detail-close">&times;</button>
                </div>
                <div class="detail-content">
                    <div class="detail-avatar-section">
                        <div class="detail-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="detail-username">@${escapeHtml(username)}</div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-row">
                            <span class="info-label">Based On</span>
                            <span class="info-value">${escapeHtml(auction.based_on || '-')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Start Price</span>
                            <span class="info-value price">${formatNumber(auction.start_price)} TON</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Current Price</span>
                            <span class="info-value price">${formatNumber(auction.current_price)} TON</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Min Increment</span>
                            <span class="info-value">${formatNumber(auction.min_increment)} TON</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Time Remaining</span>
                            <span class="info-value timer" id="detailTimer">${timeRemaining}</span>
                        </div>
                    </div>
                    
                    <div class="bid-history-title">
                        <i class="fas fa-list"></i> Bid History (${bids.length})
                    </div>
                    <div class="bid-list">
                        ${bidHistoryHtml}
                    </div>
                </div>
                <div class="detail-actions">
                    <button class="detail-action-btn bid-btn" id="placeBidBtn" ${!isActive || isOwner ? 'disabled' : ''}>
                        <i class="fas fa-gavel"></i> Place Bid
                    </button>
                    <button class="detail-action-btn timer-btn" id="extendTimerBtn">
                        <i class="fas fa-clock"></i>
                    </button>
                </div>
            `;
            
            document.body.appendChild(auctionDetailPanel);
            auctionDetailOverlay.classList.add('active');
            setTimeout(() => auctionDetailPanel.classList.add('open'), 10);
            
            // Setup timer for detail view
            const timerElement = document.getElementById('detailTimer');
            const updateDetailTimer = () => {
                const remaining = formatTimeRemaining(auction.end_time);
                if (timerElement) {
                    timerElement.textContent = remaining;
                }
                if (remaining === 'Ended') {
                    clearInterval(detailTimerInterval);
                    const bidBtn = document.getElementById('placeBidBtn');
                    if (bidBtn) bidBtn.disabled = true;
                }
            };
            updateDetailTimer();
            const detailTimerInterval = setInterval(updateDetailTimer, 1000);
            
            // Close button
            const closeBtn = auctionDetailPanel.querySelector('.detail-close');
            closeBtn.addEventListener('click', () => {
                clearInterval(detailTimerInterval);
                closeAuctionDetail();
            });
            
            // Overlay click
            auctionDetailOverlay.addEventListener('click', () => {
                clearInterval(detailTimerInterval);
                closeAuctionDetail();
            });
            
            // Place Bid button
            const placeBidBtn = document.getElementById('placeBidBtn');
            if (placeBidBtn && isActive && !isOwner) {
                placeBidBtn.addEventListener('click', async () => {
                    const bidAmount = prompt(`Enter your bid (min: ${(auction.current_price + auction.min_increment).toFixed(2)} TON):`);
                    if (bidAmount) {
                        const amount = parseFloat(bidAmount);
                        const minBid = auction.current_price + auction.min_increment;
                        if (amount >= minBid) {
                            await placeBid(auction.id, amount);
                            closeAuctionDetail();
                            setTimeout(() => showAuctionDetail(auction.id), 500);
                            await loadAuctions();
                        } else {
                            showToast(`Minimum bid is ${minBid.toFixed(2)} TON`, 'warning');
                        }
                    }
                });
            }
            
            // Extend Timer button (placeholder for future feature)
            const extendTimerBtn = document.getElementById('extendTimerBtn');
            if (extendTimerBtn) {
                extendTimerBtn.addEventListener('click', () => {
                    showToast('Auto-extend feature coming soon', 'info');
                });
            }
            
        } catch (error) {
            console.error('Error loading auction detail:', error);
            showToast('Error loading auction detail', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function placeBid(auctionId, bidAmount) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/bid/${auctionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    bid_amount: bidAmount
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Bid berhasil ditempatkan!', 'success');
                await loadAuctions();
            } else {
                showToast(data.error || 'Gagal menempatkan bid', 'error');
            }
        } catch (error) {
            console.error('Error placing bid:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    function closeAuctionDetail() {
        if (auctionDetailPanel) {
            auctionDetailPanel.classList.remove('open');
            setTimeout(() => {
                auctionDetailPanel.remove();
                auctionDetailPanel = null;
            }, 300);
        }
        if (auctionDetailOverlay) {
            auctionDetailOverlay.classList.remove('active');
            setTimeout(() => {
                auctionDetailOverlay.remove();
                auctionDetailOverlay = null;
            }, 300);
        }
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    // ==================== TAB SWITCHING ====================
    
    function switchAuctionTab(tab) {
        currentAuctionTab = tab;
        
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            const btnTab = btn.dataset.auctionsTab;
            if (btnTab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        loadAuctions();
        hapticLight();
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (auctionsSearchApplyBtn) {
            auctionsSearchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = auctionsSearchInput?.value || '';
                filterAndRenderAuctions();
                hapticLight();
            });
        }
        
        if (auctionsSearchInput) {
            auctionsSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = auctionsSearchInput.value;
                    filterAndRenderAuctions();
                    hapticLight();
                }
            });
        }
    }
    
    // ==================== LAYOUT TOGGLE ====================
    
    function setupLayoutToggle() {
        if (auctionsGridBtn) {
            auctionsGridBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                localStorage.setItem('auctions_layout', 'grid');
                auctionsGridBtn.classList.add('active');
                if (auctionsListBtn) auctionsListBtn.classList.remove('active');
                filterAndRenderAuctions();
                hapticLight();
            });
        }
        
        if (auctionsListBtn) {
            auctionsListBtn.addEventListener('click', () => {
                currentLayout = 'list';
                localStorage.setItem('auctions_layout', 'list');
                auctionsListBtn.classList.add('active');
                if (auctionsGridBtn) auctionsGridBtn.classList.remove('active');
                filterAndRenderAuctions();
                hapticLight();
            });
        }
        
        if (currentLayout === 'grid' && auctionsGridBtn) {
            auctionsGridBtn.classList.add('active');
            if (auctionsListBtn) auctionsListBtn.classList.remove('active');
        } else if (currentLayout === 'list' && auctionsListBtn) {
            auctionsListBtn.classList.add('active');
            if (auctionsGridBtn) auctionsGridBtn.classList.remove('active');
        }
    }
    
    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🔨 Winedash Auctions - Initializing...');
        
        auctionsContainer = document.getElementById('auctionsContainer');
        auctionsSearchInput = document.getElementById('auctionsSearchInput');
        auctionsSearchApplyBtn = document.getElementById('auctionsSearchApplyBtn');
        auctionsGridBtn = document.getElementById('auctionsGridBtn');
        auctionsListBtn = document.getElementById('auctionsListBtn');
        createAuctionBtn = document.getElementById('createAuctionBtn');
        
        if (createAuctionBtn) {
            createAuctionBtn.addEventListener('click', () => {
                showCreateAuctionPanel();
            });
        }
        
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.auctionsTab;
                if (tab) switchAuctionTab(tab);
            });
        });
        
        setupSearch();
        setupLayoutToggle();
        
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            await authenticateUser();
            await loadAuctions();
        } else {
            if (auctionsContainer) {
                auctionsContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
            }
        }
        
        // Check for expired auctions periodically
        setInterval(async () => {
            try {
                await fetch(`${API_BASE_URL}/api/winedash/auctions/check-expired`, { method: 'POST' });
                await loadAuctions();
            } catch (error) {
                console.error('Error checking expired auctions:', error);
            }
        }, 60000); // Check every minute
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
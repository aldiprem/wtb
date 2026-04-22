// winedash/js/auctions.js - Auction System (FULLY FIXED)

(function() {
    'use strict';
    
    console.log('🔨 Winedash Auctions v2 - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let currentAuctionTab = 'active';
    let currentAuctions = [];
    let currentSearchTerm = '';
    let currentLayout = localStorage.getItem('auctions_layout') || 'grid';
    let auctionTimers = {};
    let createAuctionPanel = null;
    let auctionDetailOverlay = null;
    let auctionDetailPanel = null;
    let isLoading = false;
    let activeLoadingCount = 0;
    
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
    
    function showSilentLoading() {
        activeLoadingCount++;
        if (activeLoadingCount === 1) {
            isLoading = true;
            if (auctionsContainer) {
                auctionsContainer.classList.add('loading-silent');
            }
        }
    }
    
    function hideSilentLoading() {
        activeLoadingCount--;
        if (activeLoadingCount <= 0) {
            activeLoadingCount = 0;
            isLoading = false;
            if (auctionsContainer) {
                auctionsContainer.classList.remove('loading-silent');
            }
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
        if (!endTimeStr) return 'Ended';
        
        try {
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
        } catch (e) {
            return 'Ended';
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
        if (!telegramUser) {
            console.log('[AUCTIONS] No telegram user, cannot load usernames');
            return [];
        }
        
        try {
            console.log(`[AUCTIONS] Loading usernames for user ${telegramUser.id}`);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            
            if (data.success && data.usernames) {
                // Filter usernames owned by user and available (not on auction)
                const availableUsernames = data.usernames.filter(u => 
                    u.seller_id === telegramUser.id && 
                    u.status === 'available'
                );
                console.log(`[AUCTIONS] Found ${availableUsernames.length} available usernames for auction`);
                return availableUsernames;
            }
            return [];
        } catch (error) {
            console.error('Error loading user usernames:', error);
            return [];
        }
    }
    
    // ==================== LOAD AUCTIONS ====================
                
    async function loadAuctions() {
        if (!telegramUser) {
            console.log('[AUCTIONS] No telegram user, skipping load');
            return;
        }
        
        console.log(`[AUCTIONS] ========== LOADING AUCTIONS ==========`);
        console.log(`[AUCTIONS] Tab: ${currentAuctionTab}, User ID: ${telegramUser.id}`);
        
        showSilentLoading();
        
        try {
            let url = '';
            switch (currentAuctionTab) {
                case 'active':
                    url = `${API_BASE_URL}/api/winedash/auctions/active`;
                    break;
                case 'my-auctions':
                    url = `${API_BASE_URL}/api/winedash/auctions/my-auctions/${telegramUser.id}`;
                    break;
                case 'my-bids':
                    url = `${API_BASE_URL}/api/winedash/auctions/my-bids/${telegramUser.id}`;
                    break;
                case 'ended':
                    url = `${API_BASE_URL}/api/winedash/auctions/ended/${telegramUser.id}`;
                    break;
                case 'all':
                    // PERBAIKAN: Untuk filter "All", ambil data dari 2 sumber: active + ended
                    const [activeRes, endedRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/api/winedash/auctions/active`),
                        fetch(`${API_BASE_URL}/api/winedash/auctions/ended/${telegramUser.id}`)
                    ]);
                    
                    const activeData = await activeRes.json();
                    const endedData = await endedRes.json();
                    
                    let allAuctions = [];
                    if (activeData.success) {
                        allAuctions = [...allAuctions, ...(activeData.auctions || [])];
                    }
                    if (endedData.success) {
                        allAuctions = [...allAuctions, ...(endedData.auctions || [])];
                    }
                    
                    currentAuctions = allAuctions;
                    console.log(`[AUCTIONS] ✅ Loaded ${currentAuctions.length} total auctions (active + ended)`);
                    renderAuctions(currentAuctions);
                    startTimers();
                    hideSilentLoading();
                    return;
                default:
                    url = `${API_BASE_URL}/api/winedash/auctions/active`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                currentAuctions = data.auctions || [];
                console.log(`[AUCTIONS] ✅ Loaded ${currentAuctions.length} auctions for tab ${currentAuctionTab}`);
                renderAuctions(currentAuctions);
                startTimers();
            } else {
                console.error(`[AUCTIONS] ❌ Failed to load:`, data.error);
                currentAuctions = [];
                renderAuctionsEmpty();
            }
        } catch (error) {
            console.error('[AUCTIONS] ❌ Error loading auctions:', error);
            currentAuctions = [];
            renderAuctionsEmpty();
        } finally {
            hideSilentLoading();
        }
    }

    // ==================== RENDER AUCTIONS ====================
            
    function renderAuctions(auctions) {
        if (!auctionsContainer) return;
        
        if (!auctions || auctions.length === 0) {
            renderAuctionsEmpty();
            return;
        }
        
        // Filter by search term
        let filtered = auctions;
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(auction => 
                auction.username && auction.username.toLowerCase().includes(term)
            );
        }
        
        if (filtered.length === 0) {
            renderAuctionsEmpty();
            return;
        }
                        
        if (currentLayout === 'grid') {
            auctionsContainer.className = 'auctions-grid';
            let html = '';
            
            for (const auction of filtered) {
                const username = auction.username || '';
                const timeRemaining = formatTimeRemaining(auction.end_time);
                const currentPrice = auction.current_price || auction.start_price || 0;
                const startPrice = auction.start_price || 0;
                const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
                const basedOn = auction.based_on || '';
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                if (isEnded) {
                    // PERBAIKAN: Tampilan ENDED yang rapi - tanpa bubble berlebih
                    html += `
                        <div class="auction-card ended" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image ended-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                                </div>
                                <div class="auction-card-username">@${escapeHtml(username)}</div>
                            </div>
                            <div class="auction-card-info ended-info">
                                <div class="card-price-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                    <div class="price-with-logo" style="display: flex; align-items: center; gap: 4px;">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo" style="width: 16px; height: 16px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">Start: ${formatNumber(startPrice)}</span>
                                    </div>
                                    <div class="based-on-text" style="font-size: 9px; color: var(--text-muted); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(basedOn)}
                                    </div>
                                </div>
                                <div class="auction-card-status ended-status" style="margin-top: 4px;">END AUCTION</div>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="auction-card" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                                </div>
                                <div class="auction-card-username">@${escapeHtml(username)}</div>
                            </div>
                            <div class="auction-card-info">
                                <div class="card-price-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                    <div class="price-with-logo" style="display: flex; align-items: center; gap: 4px;">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo" style="width: 16px; height: 16px;">
                                        <span style="font-size: 11px;">Start: ${formatNumber(startPrice)}</span>
                                    </div>
                                    <div class="based-on-text" style="font-size: 9px; color: var(--text-muted); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(basedOn)}
                                    </div>
                                </div>
                                <div class="auction-card-timer" id="timer-${auction.id}" style="margin-top: 4px;">${timeRemaining}</div>
                                <div class="auction-card-current-bid" style="color: var(--success);">Current: ${formatNumber(currentPrice)} TON</div>
                                <div class="auction-card-status">ON AUCTION</div>
                            </div>
                        </div>
                    `;
                }
            }
            
            auctionsContainer.innerHTML = html;

            // Attach click events
            document.querySelectorAll('.auction-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const auctionId = card.dataset.auctionId;
                    if (auctionId) {
                        showAuctionDetail(parseInt(auctionId));
                    }
                });
            });
            
            setTimeout(() => fetchAllAuctionAvatars(), 200);
        } else {
            auctionsContainer.className = 'auctions-list';
            let html = '';
            
            for (const auction of filtered) {
                const username = auction.username || '';
                const timeRemaining = formatTimeRemaining(auction.end_time);
                const startPrice = auction.start_price || 0;
                const currentPrice = auction.current_price || 0;
                const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
                const basedOn = auction.based_on || '';
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                if (isEnded) {
                    // PERBAIKAN: List layout untuk ended - rapi tanpa bubble berlebih
                    html += `
                        <div class="auctions-list-item ended" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auctions-list-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auctions-list-info">
                                <div class="auctions-list-username">@${escapeHtml(username)}</div>
                                <div class="auctions-list-ended-info" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                                    <div class="price-with-logo" style="display: flex; align-items: center; gap: 4px;">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 14px; height: 14px;">
                                        <span style="font-size: 10px; color: var(--text-muted);">Start: ${formatNumber(startPrice)}</span>
                                    </div>
                                    <div class="based-on-text" style="font-size: 10px; color: var(--text-muted);">
                                        Based: ${escapeHtml(basedOn)}
                                    </div>
                                </div>
                            </div>
                            <div class="auctions-list-status ended-status">END AUCTION</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="auctions-list-item" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auctions-list-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auctions-list-info">
                                <div class="auctions-list-username">@${escapeHtml(username)}</div>
                                <div class="auctions-list-ended-info" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                                    <div class="price-with-logo" style="display: flex; align-items: center; gap: 4px;">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 14px; height: 14px;">
                                        <span style="font-size: 10px;">Start: ${formatNumber(startPrice)}</span>
                                    </div>
                                    <div class="based-on-text" style="font-size: 10px; color: var(--text-muted);">
                                        ${escapeHtml(basedOn)}
                                    </div>
                                </div>
                                <div class="auctions-list-timer" id="timer-${auction.id}" style="margin-top: 4px;">⏰ ${timeRemaining}</div>
                                <div class="auctions-list-startprice" style="color: var(--success);">💰 Current: ${formatNumber(currentPrice)} TON</div>
                            </div>
                            <div class="auctions-list-status">ON AUCTION</div>
                        </div>
                    `;
                }
            }
            
            auctionsContainer.innerHTML = html;

            document.querySelectorAll('.auctions-list-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const auctionId = item.dataset.auctionId;
                    if (auctionId) {
                        showAuctionDetail(parseInt(auctionId));
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
        let emptyIcon = 'fa-gavel';
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
            case 'ended':
                emptyMessage = 'Tidak ada auction yang selesai';
                break;
            default:
                emptyMessage = 'Tidak ada data';
        }
        
        // ============ PERBAIKAN: Gunakan animasi TGS ============
        auctionsContainer.innerHTML = `
            <div class="offers-empty-state">
                <div class="offers-empty-animation" id="auctionsEmptyAnimation" style="width: 120px; height: 120px; margin: 0 auto 20px auto;"></div>
                <div class="offers-empty-title">No Auctions</div>
                <div class="offers-empty-subtitle">${emptyMessage}</div>
            </div>
        `;
        
        // Load animasi TGS
        const animContainer = document.getElementById('auctionsEmptyAnimation');
        if (animContainer) {
            loadTGSAnimation(animContainer);
        }
    }

    // ==================== TIMER MANAGEMENT ====================
    
    function startTimers() {
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
            console.log('[AUCTIONS] Closing existing create auction panel');
            closeCreateAuctionPanel();
            setTimeout(() => showCreateAuctionPanel(), 300);
            return;
        }
        
        console.log('[AUCTIONS] Showing create auction panel');
        
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
        (async () => {
            const select = document.getElementById('auctionUsernameSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Loading usernames...</option>';
            const usernames = await loadUserUsernames();
            
            if (usernames && usernames.length > 0) {
                select.innerHTML = usernames.map(u => 
                    `<option value="${u.id}" data-username="${u.username}">@${u.username}</option>`
                ).join('');
            } else {
                select.innerHTML = '<option value="">No available usernames</option>';
            }
        })();
        
        // Setup duration options
        let selectedDuration = '1h';
        const durationOptions = panel.querySelectorAll('.duration-option');
        durationOptions.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                durationOptions.forEach(b => b.classList.remove('active'));
                newBtn.classList.add('active');
                selectedDuration = newBtn.dataset.duration;
                
                const customInput = panel.querySelector('.custom-duration-input');
                if (selectedDuration === 'custom') {
                    if (customInput) customInput.style.display = 'block';
                } else {
                    if (customInput) customInput.style.display = 'none';
                }
            });
        });
        
        // Close button
        const closeBtn = panel.querySelector('.panel-close');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeCreateAuctionPanel();
            });
        }
        
        // Overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeCreateAuctionPanel();
            }
        });
        
        // Confirm button
        const confirmBtn = document.getElementById('confirmCreateAuctionBtn');
        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const select = document.getElementById('auctionUsernameSelect');
                const selectedOption = select?.options[select.selectedIndex];
                const usernameId = select?.value;
                const username = selectedOption?.dataset?.username;
                const startPrice = parseFloat(document.getElementById('auctionStartPrice')?.value);
                const minIncrement = parseFloat(document.getElementById('auctionMinIncrement')?.value);
                
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
                    const customHours = parseInt(document.getElementById('auctionCustomDuration')?.value);
                    if (isNaN(customHours) || customHours < 1) {
                        showToast('Masukkan durasi yang valid (minimal 1 jam)', 'warning');
                        return;
                    }
                    duration = `${customHours}h`;
                }
                
                await createAuction(username, parseInt(usernameId), startPrice, minIncrement, duration);
            });
        }
        
        hapticLight();
    }
    
    function closeCreateAuctionPanel() {
        if (createAuctionPanel) {
            createAuctionPanel.classList.remove('open');
            setTimeout(() => {
                if (createAuctionPanel) createAuctionPanel.remove();
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
        if (!auctionId) {
            showToast('Invalid auction ID', 'error');
            return;
        }
        
        showSilentLoading();
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/detail/${auctionId}`);
            const data = await response.json();
            
            if (!data.success) {
                showToast(data.error || 'Gagal memuat detail auction', 'error');
                return;
            }
            
            const auction = data.auction;
            const bids = data.bids || [];
            
            if (auctionDetailOverlay) {
                auctionDetailOverlay.remove();
                auctionDetailOverlay = null;
            }
            if (auctionDetailPanel) {
                auctionDetailPanel.remove();
                auctionDetailPanel = null;
            }
            
            auctionDetailOverlay = document.createElement('div');
            auctionDetailOverlay.className = 'auction-detail-overlay';
            document.body.appendChild(auctionDetailOverlay);
            
            const username = auction.username || '';
            const timeRemaining = formatTimeRemaining(auction.end_time);
            const isOwner = telegramUser && auction.owner_id === telegramUser.id;
            const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();
            const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
            
            let avatarUrl = localStorage.getItem(`avatar_${username}`);
            if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                avatarUrl = "https://companel.shop/image/winedash-logo.png";
            }
            
            let winnerInfo = '';
            if (isEnded && auction.winner_id) {
                const winnerName = auction.winner_name || auction.winner_username || 'Winner';
                const winningBid = auction.winning_bid || auction.current_price || 0;
                winnerInfo = `
                    <div class="info-row winner-row">
                        <span class="info-label">Winner</span>
                        <span class="info-value price">${escapeHtml(winnerName)} - ${formatNumber(winningBid)} TON</span>
                    </div>
                `;
            }
            
            let bidHistoryHtml = '';
            if (bids && bids.length > 0) {
                for (const bid of bids) {
                    const bidderName = bid.username || bid.first_name || 'Anonymous';
                    const bidderPhoto = bid.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bidderName)}&background=40a7e3&color=fff&size=40&rounded=true`;
                    const bidTime = formatDateIndonesia(bid.timestamp);
                    
                    bidHistoryHtml += `
                        <div class="bid-item">
                            <div class="bid-avatar">
                                <img src="${bidderPhoto}" alt="${escapeHtml(bidderName)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="bid-info">
                                <div class="bid-user">${escapeHtml(bidderName)}</div>
                                <div class="bid-amount">${formatNumber(bid.bid_amount)} TON</div>
                            </div>
                            <div class="bid-time">${bidTime}</div>
                        </div>
                    `;
                }
            } else {
                bidHistoryHtml = '<div class="empty-state" style="padding: 20px;">No bids yet</div>';
            }
            
            auctionDetailPanel = document.createElement('div');
            auctionDetailPanel.className = 'auction-detail-panel';
            auctionDetailPanel.innerHTML = `
                <div class="detail-header">
                    <h3><i class="fas fa-gavel"></i> Auction Detail</h3>
                    <button class="detail-close" id="detailCloseBtn">&times;</button>
                </div>
                <div class="detail-content">
                    <div class="detail-avatar-section">
                        <div class="detail-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="detail-username">@${escapeHtml(username)}</div>
                        ${isEnded ? '<div class="detail-ended-badge">ENDED</div>' : ''}
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
                            <span class="info-label">${isEnded ? 'Final Price' : 'Current Price'}</span>
                            <span class="info-value price">${formatNumber(auction.current_price)} TON</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Min Increment</span>
                            <span class="info-value">${formatNumber(auction.min_increment)} TON</span>
                        </div>
                        ${!isEnded ? `
                        <div class="info-row">
                            <span class="info-label">Time Remaining</span>
                            <span class="info-value timer" id="detailTimer">${timeRemaining}</span>
                        </div>
                        ` : ''}
                        ${winnerInfo}
                    </div>
                    
                    <div class="bid-history-title">
                        <i class="fas fa-list"></i> Bid History (${bids.length})
                    </div>
                    <div class="bid-list">
                        ${bidHistoryHtml}
                    </div>
                </div>
                <div class="detail-actions">
                    ${!isEnded && isActive && !isOwner ? `
                        <button class="detail-action-btn bid-btn" id="placeBidBtn">
                            <i class="fas fa-gavel"></i> Place Bid
                        </button>
                    ` : ''}
                    <button class="detail-action-btn close-detail-btn" id="closeDetailBtn">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;
            
            document.body.appendChild(auctionDetailPanel);
            auctionDetailOverlay.classList.add('active');
            document.body.classList.add('panel-open');
            setTimeout(() => auctionDetailPanel.classList.add('open'), 10);
            
            let detailTimerInterval = null;
            if (!isEnded && isActive) {
                const timerElement = document.getElementById('detailTimer');
                const updateDetailTimer = () => {
                    if (!timerElement) return;
                    const remaining = formatTimeRemaining(auction.end_time);
                    timerElement.textContent = remaining;
                    if (remaining === 'Ended') {
                        if (detailTimerInterval) clearInterval(detailTimerInterval);
                        const bidBtn = document.getElementById('placeBidBtn');
                        if (bidBtn) bidBtn.remove();
                        setTimeout(() => showAuctionDetail(auctionId), 1000);
                    }
                };
                updateDetailTimer();
                detailTimerInterval = setInterval(updateDetailTimer, 1000);
            }
            
            // Setup close buttons
            const detailCloseBtn = document.getElementById('detailCloseBtn');
            if (detailCloseBtn) {
                const newDetailCloseBtn = detailCloseBtn.cloneNode(true);
                detailCloseBtn.parentNode.replaceChild(newDetailCloseBtn, detailCloseBtn);
                newDetailCloseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (detailTimerInterval) clearInterval(detailTimerInterval);
                    closeAuctionDetail();
                });
            }
            
            const closeDetailBtn = document.getElementById('closeDetailBtn');
            if (closeDetailBtn) {
                const newCloseDetailBtn = closeDetailBtn.cloneNode(true);
                closeDetailBtn.parentNode.replaceChild(newCloseDetailBtn, closeDetailBtn);
                newCloseDetailBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (detailTimerInterval) clearInterval(detailTimerInterval);
                    closeAuctionDetail();
                });
            }
            
            auctionDetailOverlay.addEventListener('click', (e) => {
                if (e.target === auctionDetailOverlay) {
                    if (detailTimerInterval) clearInterval(detailTimerInterval);
                    closeAuctionDetail();
                }
            });
            
            const placeBidBtn = document.getElementById('placeBidBtn');
            if (placeBidBtn && isActive && !isOwner) {
                const newPlaceBidBtn = placeBidBtn.cloneNode(true);
                placeBidBtn.parentNode.replaceChild(newPlaceBidBtn, placeBidBtn);
                newPlaceBidBtn.addEventListener('click', async () => {
                    const minBid = auction.current_price + auction.min_increment;
                    const bidAmount = prompt(`Enter your bid (min: ${minBid.toFixed(2)} TON):`);
                    if (bidAmount) {
                        const amount = parseFloat(bidAmount);
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
            
        } catch (error) {
            console.error('Error loading auction detail:', error);
            showToast('Error loading auction detail: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            hideSilentLoading();
        }
    }
    
    function closeAuctionDetail() {
        if (auctionDetailPanel) {
            const timerElement = auctionDetailPanel.querySelector('#detailTimer');
            if (timerElement && timerElement._interval) {
                clearInterval(timerElement._interval);
            }
            auctionDetailPanel.classList.remove('open');
            setTimeout(() => {
                if (auctionDetailPanel) auctionDetailPanel.remove();
                auctionDetailPanel = null;
            }, 300);
        }
        
        if (auctionDetailOverlay) {
            auctionDetailOverlay.classList.remove('active');
            setTimeout(() => {
                if (auctionDetailOverlay) auctionDetailOverlay.remove();
                auctionDetailOverlay = null;
            }, 300);
        }
        
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    // ==================== BID OPERATIONS ====================
    
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
    
    // ==================== TAB SWITCHING ====================
    
    function switchAuctionTab(tab) {
        console.log(`[AUCTIONS] Switching to tab: ${tab}`);
        currentAuctionTab = tab;
        
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            const btnTab = btn.dataset.auctionsTab;
            if (btnTab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        currentAuctions = [];
        loadAuctions();
        hapticLight();
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (auctionsSearchApplyBtn) {
            const newBtn = auctionsSearchApplyBtn.cloneNode(true);
            auctionsSearchApplyBtn.parentNode.replaceChild(newBtn, auctionsSearchApplyBtn);
            auctionsSearchApplyBtn = newBtn;
            
            auctionsSearchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = auctionsSearchInput?.value || '';
                loadAuctions();
                hapticLight();
            });
        }
        
        if (auctionsSearchInput) {
            const newInput = auctionsSearchInput.cloneNode(true);
            auctionsSearchInput.parentNode.replaceChild(newInput, auctionsSearchInput);
            auctionsSearchInput = newInput;
            
            auctionsSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = auctionsSearchInput.value;
                    loadAuctions();
                    hapticLight();
                }
            });
        }
    }
    
    // ==================== LAYOUT TOGGLE ====================
        
    function setupLayoutToggle() {
        const auctionsGridBtn = document.getElementById('auctionsGridBtn');
        const auctionsListBtn = document.getElementById('auctionsListBtn');
        
        if (!auctionsGridBtn || !auctionsListBtn) return;
        
        // Hapus event listener lama
        const newGridBtn = auctionsGridBtn.cloneNode(true);
        const newListBtn = auctionsListBtn.cloneNode(true);
        auctionsGridBtn.parentNode.replaceChild(newGridBtn, auctionsGridBtn);
        auctionsListBtn.parentNode.replaceChild(newListBtn, auctionsListBtn);
        
        // Set initial active state
        if (currentLayout === 'grid') {
            newGridBtn.classList.add('active');
            newListBtn.classList.remove('active');
        } else {
            newGridBtn.classList.remove('active');
            newListBtn.classList.add('active');
        }
        
        newGridBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentLayout !== 'grid') {
                currentLayout = 'grid';
                localStorage.setItem('auctions_layout', 'grid');
                newGridBtn.classList.add('active');
                newListBtn.classList.remove('active');
                loadAuctions();
                hapticLight();
            }
        });
        
        newListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentLayout !== 'list') {
                currentLayout = 'list';
                localStorage.setItem('auctions_layout', 'list');
                newListBtn.classList.add('active');
                newGridBtn.classList.remove('active');
                loadAuctions();
                hapticLight();
            }
        });
    }

    function loadTGSAnimation(container) {
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        container.style.width = '120px';
        container.style.height = '120px';
        container.style.margin = '0 auto';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        
        // Load libraries yang diperlukan
        loadLibrariesForTGS().then(() => {
            loadTGSAuctionFile(container);
        }).catch(err => {
            console.error('Error loading libraries:', err);
            container.innerHTML = '<i class="fas fa-gavel" style="font-size: 48px; color: var(--text-muted);"></i>';
        });
    }

    function loadLibrariesForTGS() {
        return new Promise((resolve, reject) => {
            let loaded = 0;
            let total = 2;
            
            function checkLoaded() {
                loaded++;
                if (loaded === total) resolve();
            }
            
            // Load lottie-web
            if (typeof window.lottie === 'undefined') {
                const lottieScript = document.createElement('script');
                lottieScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
                lottieScript.onload = checkLoaded;
                lottieScript.onerror = reject;
                document.head.appendChild(lottieScript);
            } else {
                checkLoaded();
            }
            
            // Load pako
            if (typeof window.pako === 'undefined') {
                const pakoScript = document.createElement('script');
                pakoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                pakoScript.onload = checkLoaded;
                pakoScript.onerror = reject;
                document.head.appendChild(pakoScript);
            } else {
                checkLoaded();
            }
        });
    }

    async function loadTGSAuctionFile(container) {
        try {
            // Fetch file .tgs dari path yang benar: /image/empty-auctions.tgs
            const response = await fetch('/image/empty-auctions.tgs');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            
            // Decompress dengan pako
            const decompressed = window.pako.ungzip(compressed, { to: 'string' });
            const animationData = JSON.parse(decompressed);
            
            // Render dengan lottie
            window.lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });
        } catch (error) {
            console.error('Error loading TGS file for auctions:', error);
            container.innerHTML = '<i class="fas fa-gavel" style="font-size: 48px; color: var(--text-muted);"></i>';
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
            const newBtn = createAuctionBtn.cloneNode(true);
            createAuctionBtn.parentNode.replaceChild(newBtn, createAuctionBtn);
            createAuctionBtn = newBtn;
            
            createAuctionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[AUCTIONS] Create auction button clicked');
                showCreateAuctionPanel();
            });
        }
        
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tab = newBtn.dataset.auctionsTab;
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
        
        setInterval(async () => {
            try {
                await fetch(`${API_BASE_URL}/api/winedash/auctions/check-expired`, { method: 'POST' });
                await loadAuctions();
            } catch (error) {
                console.error('Error checking expired auctions:', error);
            }
        }, 60000);
    }
    
    // ==================== EXPORT GLOBAL FUNCTIONS ====================
        
    window.initAuctions = async function(user) {
        console.log('🔨 Auctions - initAuctions called with user:', user);
        
        if (user) {
            telegramUser = user;
        } else if (!telegramUser) {
            telegramUser = getTelegramUserFromWebApp();
        }
        
        if (!telegramUser) {
            console.warn('❌ No Telegram user for auctions');
            if (auctionsContainer) {
                auctionsContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
            }
            return;
        }
        
        console.log('✅ Auctions - User authenticated:', telegramUser.id);
        
        await authenticateUser();
        
        if (!auctionsContainer) {
            auctionsContainer = document.getElementById('auctionsContainer');
        }
        
        if (!auctionsContainer) {
            console.error('❌ auctionsContainer not found!');
            return;
        }
        
        currentAuctions = [];
        // PERBAIKAN: Set default tab ke 'all' agar menampilkan semua auctions (active + ended)
        currentAuctionTab = 'all';
        
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            if (btn.dataset.auctionsTab === 'all') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        await loadAuctions();
        console.log('✅ Auctions initialized successfully');
    };

    window.refreshAuctions = async function() {
        console.log('🔄 Auctions - refreshAuctions called');
        if (telegramUser) {
            await loadAuctions();
        }
    };
    
    // Hanya init jika tidak di dalam storage page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.location.pathname.includes('/storage')) {
                init();
            }
        });
    } else {
        if (!window.location.pathname.includes('/storage')) {
            init();
        }
    }
    
    console.log('📦 Auctions module loaded, waiting for initAuctions() call');
        
    window.switchAuctionTab = switchAuctionTab;
    window.showAuctionDetail = showAuctionDetail;
    window.refreshAuctionsModule = loadAuctions;

    window.showCreateAuctionPanel = function() {
        console.log('[AUCTIONS] showCreateAuctionPanel called');
        
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        showCreateAuctionPanel();
    };

    // Tambahkan event listener untuk custom event dari storage.js
    window.addEventListener('showCreateAuctionPanel', () => {
        console.log('[AUCTIONS] Received showCreateAuctionPanel event');
        showCreateAuctionPanel();
    });

    window.setAuctionsLayout = function(layout) {
        console.log(`[AUCTIONS] Setting layout to: ${layout}`);
        currentLayout = layout;
        localStorage.setItem('auctions_layout', layout);
        loadAuctions();
    };
})();
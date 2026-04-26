// winedash/js/market-auctions.js - VERSI DIPERBAIKI

(function() {
    'use strict';
    
    console.log('🏪 Market Auctions - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let walletAddress = null;
    
    // State
    let currentAuctionsFilter = 'active';
    let currentAuctions = [];
    let currentSearchTerm = '';
    let currentLayout = localStorage.getItem('market_auctions_layout') || 'grid';
    let auctionTimers = {};
    let currentActivityTab = 'global-auctions'; // global-auctions, my-bids
    
    // DOM Elements
    let auctionsContainer = null;
    let searchInput = null;
    let searchApplyBtn = null;
    let filterBtn = null;
    let filterDropdown = null;
    let refreshBtn = null;
    let gridBtn = null;
    let listBtn = null;
    let backToMarketBtn = null;
    let globalAuctionsTabBtn = null;
    let myBidsTabBtn = null;
    
    // Auction detail panel
    let auctionDetailOverlay = null;
    let auctionDetailPanel = null;

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
    
    // ==================== PROFILE PHOTO ====================
    
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
    
    // ==================== LOAD AUCTIONS ====================
    
    async function loadMarketAuctions() {
        console.log(`[MARKET AUCTIONS] Loading auctions with filter: ${currentAuctionsFilter}, tab: ${currentActivityTab}`);
        
        showLoading(true);
        
        try {
            let url = '';
            
            if (currentActivityTab === 'my-bids' && telegramUser) {
                // My Bids - hanya auctions yang user pernah bid
                url = `${API_BASE_URL}/api/winedash/auctions/my-bids/${telegramUser.id}`;
            } else {
                // Global Auctions - semua auctions (active + ended dari semua user)
                if (currentAuctionsFilter === 'active') {
                    url = `${API_BASE_URL}/api/winedash/auctions/active`;
                } else if (currentAuctionsFilter === 'ended') {
                    url = `${API_BASE_URL}/api/winedash/auctions/ended-all`;
                } else {
                    // All Auctions - gabungkan active dan ended
                    const [activeRes, endedRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/api/winedash/auctions/active`),
                        fetch(`${API_BASE_URL}/api/winedash/auctions/ended-all`)
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
                    console.log(`[MARKET AUCTIONS] Loaded ${currentAuctions.length} total auctions (all)`);
                    renderMarketAuctions();
                    startTimers();
                    showLoading(false);
                    return;
                }
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                currentAuctions = data.auctions || [];
                console.log(`[MARKET AUCTIONS] Loaded ${currentAuctions.length} auctions`);
                renderMarketAuctions();
                startTimers();
            } else {
                console.error('[MARKET AUCTIONS] Failed to load:', data.error);
                currentAuctions = [];
                renderEmptyState();
            }
        } catch (error) {
            console.error('[MARKET AUCTIONS] Error loading auctions:', error);
            currentAuctions = [];
            renderEmptyState();
        } finally {
            showLoading(false);
        }
    }
    
    function renderMarketAuctions() {
        if (!auctionsContainer) return;
        
        let filtered = [...currentAuctions];
        
        // Filter by search term
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(auction => 
                auction.username && auction.username.toLowerCase().includes(term)
            );
        }
        
        // Filter by status untuk global auctions
        if (currentActivityTab !== 'my-bids' && currentAuctionsFilter !== 'all' && currentAuctionsFilter !== 'active' && currentAuctionsFilter !== 'ended') {
            const now = new Date();
            filtered = filtered.filter(auction => {
                if (currentAuctionsFilter === 'active') {
                    return auction.status === 'active' && (auction.end_time && new Date(auction.end_time) > now);
                }
                if (currentAuctionsFilter === 'ended') {
                    return auction.status === 'ended' || (auction.end_time && new Date(auction.end_time) <= now);
                }
                return true;
            });
        }
        
        if (filtered.length === 0) {
            renderEmptyState();
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
                    // Style ended auction yang rapi
                    html += `
                        <div class="auction-card ended" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image ended-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                                </div>
                                <div class="auction-card-username">@${escapeHtml(username)}</div>
                            </div>
                            <div class="auction-card-info ended-info">
                                <div class="card-price-row">
                                    <div class="price-with-logo">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                        <span style="font-size: 11px; color: var(--text-muted);">Start: ${formatNumber(startPrice)} TON</span>
                                    </div>
                                    <div class="based-on-text">${escapeHtml(basedOn)}</div>
                                </div>
                                <div class="auction-card-status ended-status">ENDED</div>
                            </div>
                        </div>
                    `;
                } else {
                    // Check if user has bid on this auction
                    const hasBid = auction.my_last_bid !== undefined && auction.my_last_bid > 0;
                    const myBidAmount = auction.my_last_bid || 0;
                    
                    html += `
                        <div class="auction-card" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                                </div>
                                <div class="auction-card-username">@${escapeHtml(username)}</div>
                            </div>
                            <div class="auction-card-info">
                                <div class="card-price-row">
                                    <div class="price-with-logo">
                                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                        <span>Start: ${formatNumber(startPrice)} TON</span>
                                    </div>
                                    <div class="based-on-text">${escapeHtml(basedOn)}</div>
                                </div>
                                <div class="auction-card-timer" id="timer-${auction.id}">${timeRemaining}</div>
                                <div class="auction-card-current-bid">Current: ${formatNumber(currentPrice)} TON</div>
                                ${hasBid ? `<div style="font-size: 10px; color: var(--warning);">My Bid: ${formatNumber(myBidAmount)} TON</div>` : ''}
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
            // List layout
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
                    html += `
                        <div class="auctions-list-item ended" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auctions-list-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auctions-list-info">
                                <div class="auctions-list-username">@${escapeHtml(username)}</div>
                                <div class="auctions-list-ended-info">
                                    <div>Start: ${formatNumber(startPrice)} TON</div>
                                    <div>Based: ${escapeHtml(basedOn)}</div>
                                </div>
                            </div>
                            <div class="auctions-list-status ended-status">ENDED</div>
                        </div>
                    `;
                } else {
                    const hasBid = auction.my_last_bid !== undefined && auction.my_last_bid > 0;
                    
                    html += `
                        <div class="auctions-list-item" data-auction-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auctions-list-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auctions-list-info">
                                <div class="auctions-list-username">@${escapeHtml(username)}</div>
                                <div class="auctions-list-ended-info">
                                    <div>Start: ${formatNumber(startPrice)} TON | Current: ${formatNumber(currentPrice)} TON</div>
                                    <div>Based: ${escapeHtml(basedOn)}</div>
                                </div>
                                <div class="auctions-list-timer" id="timer-${auction.id}">Ends: ${timeRemaining}</div>
                                ${hasBid ? `<div style="font-size: 10px; color: var(--warning);">My Bid: ${formatNumber(auction.my_last_bid)} TON</div>` : ''}
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
    
    function renderEmptyState() {
        if (!auctionsContainer) return;
        
        let emptyMessage = '';
        if (currentActivityTab === 'my-bids') {
            emptyMessage = 'Anda belum melakukan bid pada auction manapun';
        } else if (currentAuctionsFilter === 'active') {
            emptyMessage = 'Tidak ada auction aktif';
        } else if (currentAuctionsFilter === 'ended') {
            emptyMessage = 'Tidak ada auction yang selesai';
        } else {
            emptyMessage = 'Tidak ada data auction';
        }
        
        auctionsContainer.innerHTML = `
            <div class="offers-empty-state" style="padding: 60px 20px;">
                <div class="offers-empty-animation" style="width: 120px; height: 120px; margin: 0 auto 20px auto;">
                    <i class="fas fa-gavel" style="font-size: 48px; color: var(--text-muted);"></i>
                </div>
                <div class="offers-empty-title">No Auctions</div>
                <div class="offers-empty-subtitle">${emptyMessage}</div>
            </div>
        `;
    }
    
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
                    setTimeout(() => loadMarketAuctions(), 1000);
                } else {
                    timerElement.textContent = remaining;
                }
            };
            
            updateTimer();
            auctionTimers[auction.id] = setInterval(updateTimer, 1000);
        }
    }
    
    // ==================== TAB SWITCHING ====================
    
    function switchActivityTab(tab) {
        currentActivityTab = tab;
        
        // Update active state pada tabs
        if (globalAuctionsTabBtn) {
            if (tab === 'global-auctions') {
                globalAuctionsTabBtn.classList.add('active');
                if (myBidsTabBtn) myBidsTabBtn.classList.remove('active');
            } else {
                globalAuctionsTabBtn.classList.remove('active');
                if (myBidsTabBtn) myBidsTabBtn.classList.add('active');
            }
        }
        
        // Reset filter ke active untuk global auctions
        if (tab === 'global-auctions') {
            currentAuctionsFilter = 'active';
            updateFilterButtonText();
        }
        
        // Reload auctions
        loadMarketAuctions();
        hapticLight();
    }
    
    function updateFilterButtonText() {
        if (!filterBtn) return;
        
        let filterText = '';
        switch(currentAuctionsFilter) {
            case 'active': filterText = 'Active'; break;
            case 'all': filterText = 'All'; break;
            case 'ended': filterText = 'Ended'; break;
            default: filterText = 'Filter';
        }
        filterBtn.innerHTML = `<i class="fas fa-filter"></i><span>${filterText}</span>`;
    }
    
    // ==================== AUCTION DETAIL ====================
    
    async function showAuctionDetail(auctionId) {
        // ... (sama seperti sebelumnya, fungsi ini tetap)
        if (!auctionId) {
            showToast('Invalid auction ID', 'error');
            return;
        }
        
        showLoading(true);
        
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
                    const bidTime = new Date(bid.timestamp).toLocaleString('id-ID');
                    
                    const isCurrentUserBid = telegramUser && bid.user_id === telegramUser.id;
                    
                    bidHistoryHtml += `
                        <div class="bid-item">
                            <div class="bid-avatar">
                                <img src="${bidderPhoto}" alt="${escapeHtml(bidderName)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="bid-info">
                                <div class="bid-user">${escapeHtml(bidderName)}${isCurrentUserBid ? ' (You)' : ''}</div>
                                <div class="bid-amount">${formatNumber(bid.bid_amount)} TON</div>
                            </div>
                            <div class="bid-time">${bidTime}</div>
                        </div>
                    `;
                }
            } else {
                bidHistoryHtml = '<div class="empty-state" style="padding: 20px;">No bids yet</div>';
            }
            
            const userHasBid = bids.some(bid => bid.user_id === telegramUser?.id);
            const userHighestBid = userHasBid ? Math.max(...bids.filter(b => b.user_id === telegramUser?.id).map(b => b.bid_amount)) : 0;
            const minNextBid = auction.current_price + auction.min_increment;
            
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
                        ${userHasBid && !isEnded ? `<div class="detail-ended-badge" style="background: linear-gradient(135deg, var(--warning), #d97706); margin-top: 8px;">Your Bid: ${formatNumber(userHighestBid)} TON</div>` : ''}
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
                            <span class="info-label">Min Next Bid</span>
                            <span class="info-value price">${formatNumber(minNextBid)} TON</span>
                        </div>
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
                            <i class="fas fa-gavel"></i> Place Bid (Min ${formatNumber(minNextBid)} TON)
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
                    const bidAmount = prompt(`Enter your bid (min: ${minBid.toFixed(2)} TON):\n\nCurrent Price: ${auction.current_price} TON\nMin Increment: ${auction.min_increment} TON`, minBid.toFixed(2));
                    if (bidAmount) {
                        const amount = parseFloat(bidAmount);
                        if (amount >= minBid) {
                            await placeBid(auction.id, amount);
                            closeAuctionDetail();
                            setTimeout(() => showAuctionDetail(auction.id), 500);
                            await loadMarketAuctions();
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
            showLoading(false);
        }
    }
    
    function closeAuctionDetail() {
        if (auctionDetailPanel) {
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
                await loadMarketAuctions();
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
    
    // ==================== FILTER DROPDOWN ====================
    
    function setupFilterDropdown() {
        if (!filterBtn || !filterDropdown) return;
        
        const newFilterBtn = filterBtn.cloneNode(true);
        filterBtn.parentNode.replaceChild(newFilterBtn, filterBtn);
        
        let isOpen = false;
        
        function positionDropdown() {
            const rect = newFilterBtn.getBoundingClientRect();
            filterDropdown.style.top = `${rect.bottom + 5}px`;
            filterDropdown.style.left = `${rect.left}px`;
            filterDropdown.style.minWidth = `${rect.width}px`;
        }
        
        function closeDropdown() {
            if (filterDropdown) {
                filterDropdown.style.display = 'none';
                isOpen = false;
            }
            document.removeEventListener('click', handleClickOutside);
        }
        
        function handleClickOutside(e) {
            if (filterDropdown && !filterDropdown.contains(e.target) && e.target !== newFilterBtn) {
                closeDropdown();
            }
        }
        
        function openDropdown() {
            positionDropdown();
            filterDropdown.style.display = 'block';
            isOpen = true;
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 10);
        }
        
        newFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
            hapticLight();
        });
        
        filterDropdown.querySelectorAll('[data-market-auctions-filter]').forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', () => {
                const filterValue = newItem.dataset.marketAuctionsFilter;
                currentAuctionsFilter = filterValue;
                
                filterDropdown.querySelectorAll('[data-market-auctions-filter]').forEach(btn => {
                    btn.classList.remove('active');
                });
                newItem.classList.add('active');
                
                updateFilterButtonText();
                closeDropdown();
                loadMarketAuctions();
                hapticLight();
            });
        });
        
        window.addEventListener('scroll', () => {
            if (isOpen) positionDropdown();
        });
        
        window.addEventListener('resize', () => {
            if (isOpen) positionDropdown();
        });
    }
    
    // ==================== LAYOUT TOGGLE ====================
    
    function setupLayoutToggle() {
        if (!gridBtn || !listBtn) return;
        
        const newGridBtn = gridBtn.cloneNode(true);
        const newListBtn = listBtn.cloneNode(true);
        gridBtn.parentNode.replaceChild(newGridBtn, gridBtn);
        listBtn.parentNode.replaceChild(newListBtn, listBtn);
        
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
                localStorage.setItem('market_auctions_layout', 'grid');
                newGridBtn.classList.add('active');
                newListBtn.classList.remove('active');
                loadMarketAuctions();
                hapticLight();
            }
        });
        
        newListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentLayout !== 'list') {
                currentLayout = 'list';
                localStorage.setItem('market_auctions_layout', 'list');
                newListBtn.classList.add('active');
                newGridBtn.classList.remove('active');
                loadMarketAuctions();
                hapticLight();
            }
        });
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (searchApplyBtn) {
            const newBtn = searchApplyBtn.cloneNode(true);
            searchApplyBtn.parentNode.replaceChild(newBtn, searchApplyBtn);
            searchApplyBtn = newBtn;
            
            searchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = searchInput?.value || '';
                loadMarketAuctions();
                hapticLight();
            });
        }
        
        if (searchInput) {
            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);
            searchInput = newInput;
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = searchInput.value;
                    loadMarketAuctions();
                    hapticLight();
                }
            });
        }
    }
    
    // ==================== BALANCE & USER UI ====================
    
    async function loadMarketBalance() {
        if (!telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                const balanceCard = document.getElementById('marketAuctionsBalanceCard');
                if (balanceCard) {
                    const formattedBalance = parseFloat(data.user.balance).toFixed(2);
                    balanceCard.innerHTML = `
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                        <span class="balance-amount">${formattedBalance}</span>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    }
    
    function updateMarketUserUI() {
        if (!telegramUser) return;
        
        const avatarContainer = document.getElementById('marketAuctionsUserAvatar');
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }
    
    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🏪 Market Auctions - Initializing...');
        
        // Get DOM elements
        auctionsContainer = document.getElementById('marketAuctionsContainer');
        searchInput = document.getElementById('marketAuctionsSearchInput');
        searchApplyBtn = document.getElementById('marketAuctionsSearchApplyBtn');
        filterBtn = document.getElementById('marketAuctionsFilterBtn');
        filterDropdown = document.getElementById('marketAuctionsFilterDropdown');
        refreshBtn = document.getElementById('refreshAuctionsBtn');
        gridBtn = document.getElementById('marketAuctionsGridBtn');
        listBtn = document.getElementById('marketAuctionsListBtn');
        backToMarketBtn = document.getElementById('backToMarketBtn');
        globalAuctionsTabBtn = document.getElementById('globalAuctionsTabBtn');
        myBidsTabBtn = document.getElementById('myBidsTabBtn');
        
        if (!auctionsContainer) {
            console.error('[MARKET AUCTIONS] Container not found');
            return;
        }
        
        // Setup back button to market place
        if (backToMarketBtn) {
            const newBackBtn = backToMarketBtn.cloneNode(true);
            backToMarketBtn.parentNode.replaceChild(newBackBtn, backToMarketBtn);
            newBackBtn.addEventListener('click', () => {
                window.location.href = '/winedash#marketplace';
            });
        }
        
        // Setup refresh button
        if (refreshBtn) {
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            newRefreshBtn.addEventListener('click', () => {
                loadMarketAuctions();
                hapticLight();
            });
        }
        
        // Setup tabs
        if (globalAuctionsTabBtn) {
            const newGlobalBtn = globalAuctionsTabBtn.cloneNode(true);
            globalAuctionsTabBtn.parentNode.replaceChild(newGlobalBtn, globalAuctionsTabBtn);
            newGlobalBtn.addEventListener('click', () => {
                switchActivityTab('global-auctions');
            });
        }
        
        if (myBidsTabBtn) {
            const newMyBidsBtn = myBidsTabBtn.cloneNode(true);
            myBidsTabBtn.parentNode.replaceChild(newMyBidsBtn, myBidsTabBtn);
            newMyBidsBtn.addEventListener('click', () => {
                switchActivityTab('my-bids');
            });
        }
        
        // Get Telegram user
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            updateMarketUserUI();
            await authenticateUser();
            await loadMarketBalance();
            await loadMarketAuctions();
        } else {
            auctionsContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
        }
        
        // Setup event listeners
        setupFilterDropdown();
        setupSearch();
        setupLayoutToggle();
        
        // Auto refresh expired auctions every minute
        setInterval(async () => {
            try {
                await fetch(`${API_BASE_URL}/api/winedash/auctions/check-expired`, { method: 'POST' });
                await loadMarketAuctions();
            } catch (error) {
                console.error('Error checking expired auctions:', error);
            }
        }, 60000);
        
        console.log('✅ Market Auctions initialized');
    }
    
    // Cleanup timers on page unload
    window.addEventListener('beforeunload', () => {
        for (const id in auctionTimers) {
            clearInterval(auctionTimers[id]);
        }
    });
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
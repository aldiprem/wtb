// winedash/js/auctions.js - Auction System (FIXED - NO LOADING SPAM)
(function() {
    'use strict';
    
    console.log('🔨 Winedash Auctions - Initializing...');

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
    
    // DOM Elements
    let auctionsContainer = null;
    let auctionsSearchInput = null;
    let auctionsSearchApplyBtn = null;
    let auctionsGridBtn = null;
    let auctionsListBtn = null;
    let createAuctionBtn = null;

    // ==================== UTILITY FUNCTIONS ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
        return null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
    
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }
    
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
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
    
    // ==================== PERBAIKAN UTAMA: TIDAK ADA LOADING OVERLAY ====================
    // Fungsi showLoading DIHAPUS - tidak digunakan sama sekali
    // Semua loading diganti dengan indikator kecil di container saja
    
    function setContainerLoading(loading) {
        if (!auctionsContainer) return;
        isLoading = loading;
        if (loading) {
            auctionsContainer.classList.add('loading-silent');
        } else {
            auctionsContainer.classList.remove('loading-silent');
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
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
        } catch { return dateStr; }
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
            return data.success ? data.user : null;
        } catch (error) {
            return null;
        }
    }
    
    async function fetchProfilePhoto(username) {
        const cached = localStorage.getItem(`avatar_${username}`);
        if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
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
            return null;
        }
    }
    
    async function loadUserUsernames() {
        if (!telegramUser) return [];
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            if (data.success && data.usernames) {
                return data.usernames.filter(u => u.seller_id === telegramUser.id && u.status === 'available');
            }
            return [];
        } catch (error) {
            return [];
        }
    }
    
    // ==================== LOAD AUCTIONS - TANPA LOADING OVERLAY ====================
    
    async function loadAuctions() {
        if (!telegramUser) return;
        
        // HANYA tampilkan loading di container, BUKAN overlay
        setContainerLoading(true);
        
        try {
            let url = '';
            switch (currentAuctionTab) {
                case 'active': url = `${API_BASE_URL}/api/winedash/auctions/active`; break;
                case 'my-auctions': url = `${API_BASE_URL}/api/winedash/auctions/my/${telegramUser.id}`; break;
                case 'my-bids': url = `${API_BASE_URL}/api/winedash/auctions/my-bids/${telegramUser.id}`; break;
                case 'ended': url = `${API_BASE_URL}/api/winedash/auctions/ended/${telegramUser.id}`; break;
                default: url = `${API_BASE_URL}/api/winedash/auctions/active`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                currentAuctions = data.auctions || [];
                filterAndRenderAuctions();
                startTimers();
            } else {
                currentAuctions = [];
                renderAuctionsEmpty();
            }
        } catch (error) {
            console.error('[AUCTIONS] Error:', error);
            renderAuctionsEmpty();
        } finally {
            setContainerLoading(false);
        }
    }
    
    function filterAndRenderAuctions() {
        let filtered = [...currentAuctions];
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(a => a.username && a.username.toLowerCase().includes(term));
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
                const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`) || "https://companel.shop/image/winedash-logo.png";
                
                if (isEnded) {
                    const lastBidderName = auction.winner_name || auction.winner_username || 'Winner';
                    const lastBidderPhoto = auction.winner_photo || '';
                    const lastBidAmount = auction.winning_bid || auction.current_price || currentPrice;
                    
                    html += `
                        <div class="auction-card ended" data-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image ended-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                                </div>
                                <div class="auction-card-username">@${escapeHtml(username)}</div>
                                <div class="auction-ended-badge">ENDED</div>
                            </div>
                            <div class="auction-card-info ended-info">
                                ${lastBidderName ? `
                                <div class="auction-last-bidder">
                                    <div class="last-bidder-avatar">
                                        <img src="${lastBidderPhoto || 'https://companel.shop/image/winedash-logo.png'}" alt="${escapeHtml(lastBidderName)}">
                                    </div>
                                    <div class="last-bidder-info">
                                        <span class="last-bidder-name">${escapeHtml(lastBidderName)}</span>
                                        <span class="last-bid-amount">${formatNumber(lastBidAmount)} TON</span>
                                    </div>
                                </div>
                                ` : '<div class="no-bids">No bids placed</div>'}
                                <div class="auction-card-status ended-status">END OFFER</div>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="auction-card" data-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auction-card-image">
                                <div class="auction-card-avatar">
                                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
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
            }
            
            auctionsContainer.innerHTML = html;
            
            document.querySelectorAll('.auction-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const auctionData = JSON.parse(card.dataset.auction.replace(/&#39;/g, "'"));
                        showAuctionDetail(auctionData.id);
                    } catch (err) {}
                });
            });
            
        } else {
            auctionsContainer.className = 'auctions-list';
            let html = '';
            
            for (const auction of auctions) {
                const username = auction.username || '';
                const timeRemaining = formatTimeRemaining(auction.end_time);
                const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`) || "https://companel.shop/image/winedash-logo.png";
                
                if (isEnded) {
                    const lastBidderName = auction.winner_name || auction.winner_username || 'Winner';
                    const lastBidAmount = auction.winning_bid || auction.current_price || 0;
                    
                    html += `
                        <div class="auctions-list-item ended" data-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
                            <div class="auctions-list-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="auctions-list-info">
                                <div class="auctions-list-username">@${escapeHtml(username)}</div>
                                <div class="auctions-list-ended-info">
                                    <span class="ended-label">ENDED</span>
                                    <span class="ended-winner">Winner: ${escapeHtml(lastBidderName)} (${formatNumber(lastBidAmount)} TON)</span>
                                </div>
                            </div>
                            <div class="auctions-list-status ended-status">END OFFER</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="auctions-list-item" data-id="${auction.id}" data-auction='${JSON.stringify(auction).replace(/'/g, "&#39;")}'>
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
            }
            
            auctionsContainer.innerHTML = html;
            
            document.querySelectorAll('.auctions-list-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const auctionData = JSON.parse(item.dataset.auction.replace(/&#39;/g, "'"));
                        showAuctionDetail(auctionData.id);
                    } catch (err) {}
                });
            });
        }
        
        setTimeout(() => fetchAllAuctionAvatars(), 200);
    }
    
    async function fetchAllAuctionAvatars() {
        const avatars = document.querySelectorAll('.auction-card-avatar img, .auctions-list-avatar img');
        for (const img of avatars) {
            const username = img.alt?.replace('@', '');
            if (!username) continue;
            
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached.startsWith('data:image')) {
                if (img.src !== cached) img.src = cached;
                continue;
            }
            
            try {
                const photoUrl = await fetchProfilePhoto(username);
                if (photoUrl) {
                    localStorage.setItem(`avatar_${username}`, photoUrl);
                    img.src = photoUrl;
                }
            } catch (error) {}
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    function renderAuctionsEmpty() {
        if (!auctionsContainer) return;
        
        let emptyMessage = '';
        switch (currentAuctionTab) {
            case 'active': emptyMessage = 'Tidak ada auction aktif'; break;
            case 'my-auctions': emptyMessage = 'Anda belum membuat auction'; break;
            case 'my-bids': emptyMessage = 'Anda belum melakukan bid'; break;
            case 'ended': emptyMessage = 'Tidak ada auction yang berakhir'; break;
            default: emptyMessage = 'Tidak ada data';
        }
        
        auctionsContainer.innerHTML = `
            <div class="offers-empty-state">
                <div class="offers-empty-animation"><i class="fas fa-gavel" style="font-size: 48px; color: var(--text-muted);"></i></div>
                <div class="offers-empty-title">No Auctions</div>
                <div class="offers-empty-subtitle">${emptyMessage}</div>
            </div>
        `;
    }
    
    function startTimers() {
        for (const id in auctionTimers) clearInterval(auctionTimers[id]);
        auctionTimers = {};
        
        for (const auction of currentAuctions) {
            const timerElement = document.getElementById(`timer-${auction.id}`);
            if (!timerElement) continue;
            
            const updateTimer = () => {
                const remaining = formatTimeRemaining(auction.end_time);
                if (remaining === 'Ended') {
                    clearInterval(auctionTimers[auction.id]);
                    timerElement.textContent = 'Ended';
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
                        <button class="duration-option active" data-duration="1h">1 Hour</button>
                        <button class="duration-option" data-duration="12h">12 Hours</button>
                        <button class="duration-option" data-duration="1d">1 Day</button>
                        <button class="duration-option" data-duration="7d">1 Week</button>
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
        
        loadUserUsernames().then(usernames => {
            const select = document.getElementById('auctionUsernameSelect');
            if (select && usernames.length > 0) {
                select.innerHTML = usernames.map(u => `<option value="${u.id}" data-username="${u.username}">@${u.username}</option>`).join('');
            } else if (select) {
                select.innerHTML = '<option value="">No available usernames</option>';
            }
        });
        
        let selectedDuration = '1h';
        panel.querySelectorAll('.duration-option').forEach(btn => {
            btn.addEventListener('click', () => {
                panel.querySelectorAll('.duration-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedDuration = btn.dataset.duration;
            });
        });
        
        panel.querySelector('.panel-close').addEventListener('click', closeCreateAuctionPanel);
        overlay.addEventListener('click', closeCreateAuctionPanel);
        
        document.getElementById('confirmCreateAuctionBtn').addEventListener('click', async () => {
            const select = document.getElementById('auctionUsernameSelect');
            const selectedOption = select.options[select.selectedIndex];
            const usernameId = select.value;
            const username = selectedOption?.dataset?.username;
            const startPrice = parseFloat(document.getElementById('auctionStartPrice').value);
            const minIncrement = parseFloat(document.getElementById('auctionMinIncrement').value);
            
            if (!usernameId || !username) { showToast('Pilih username', 'warning'); return; }
            if (isNaN(startPrice) || startPrice < 0.1) { showToast('Start price minimal 0.1 TON', 'warning'); return; }
            if (isNaN(minIncrement) || minIncrement < 0.01) { showToast('Min increment minimal 0.01 TON', 'warning'); return; }
            
            await createAuction(username, parseInt(usernameId), startPrice, minIncrement, selectedDuration);
        });
        
        hapticLight();
    }
    
    function closeCreateAuctionPanel() {
        if (createAuctionPanel) {
            createAuctionPanel.classList.remove('open');
            setTimeout(() => { createAuctionPanel?.remove(); createAuctionPanel = null; }, 300);
        }
        document.getElementById('createAuctionOverlay')?.remove();
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    async function createAuction(username, usernameId, startPrice, minIncrement, duration) {
        if (!telegramUser) { showToast('Login terlebih dahulu', 'warning'); return; }
        
        hapticMedium();
        setContainerLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, username_id: usernameId, owner_id: telegramUser.id, start_price: startPrice, min_increment: minIncrement, duration })
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
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setContainerLoading(false);
        }
    }
    
    // ==================== AUCTION DETAIL ====================
    
    async function showAuctionDetail(auctionId) {
        if (!auctionId) { showToast('Invalid auction ID', 'error'); return; }
        
        setContainerLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/detail/${auctionId}`);
            const data = await response.json();
            
            if (!data.success) { showToast(data.error || 'Gagal memuat detail', 'error'); return; }
            
            const auction = data.auction;
            const bids = data.bids || [];
            
            if (auctionDetailOverlay) { auctionDetailOverlay.remove(); auctionDetailOverlay = null; }
            if (auctionDetailPanel) { auctionDetailPanel.remove(); auctionDetailPanel = null; }
            
            auctionDetailOverlay = document.createElement('div');
            auctionDetailOverlay.className = 'auction-detail-overlay';
            document.body.appendChild(auctionDetailOverlay);
            
            const username = auction.username || '';
            const timeRemaining = formatTimeRemaining(auction.end_time);
            const isOwner = telegramUser && auction.owner_id === telegramUser.id;
            const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();
            const isEnded = auction.status === 'ended' || timeRemaining === 'Ended';
            
            let avatarUrl = localStorage.getItem(`avatar_${username}`) || "https://companel.shop/image/winedash-logo.png";
            
            let winnerInfo = '';
            if (isEnded && auction.winner_id) {
                const winnerName = auction.winner_name || auction.winner_username || 'Winner';
                const winningBid = auction.winning_bid || auction.current_price || 0;
                winnerInfo = `<div class="info-row winner-row"><span class="info-label">Winner</span><span class="info-value price">${escapeHtml(winnerName)} - ${formatNumber(winningBid)} TON</span></div>`;
            }
            
            let bidHistoryHtml = '';
            if (bids.length > 0) {
                for (const bid of bids) {
                    const bidderName = bid.username || bid.first_name || 'Anonymous';
                    const bidderPhoto = bid.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bidderName)}&background=40a7e3&color=fff&size=40`;
                    bidHistoryHtml += `
                        <div class="bid-item">
                            <div class="bid-avatar"><img src="${bidderPhoto}" alt="${escapeHtml(bidderName)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'"></div>
                            <div class="bid-info"><div class="bid-user">${escapeHtml(bidderName)}</div><div class="bid-amount">${formatNumber(bid.bid_amount)} TON</div></div>
                            <div class="bid-time">${formatDateIndonesia(bid.timestamp)}</div>
                        </div>
                    `;
                }
            } else {
                bidHistoryHtml = '<div class="empty-state" style="padding: 20px;">No bids yet</div>';
            }
            
            auctionDetailPanel = document.createElement('div');
            auctionDetailPanel.className = 'auction-detail-panel';
            auctionDetailPanel.innerHTML = `
                <div class="detail-header"><h3><i class="fas fa-gavel"></i> Auction Detail</h3><button class="detail-close">&times;</button></div>
                <div class="detail-content">
                    <div class="detail-avatar-section">
                        <div class="detail-avatar"><img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'"></div>
                        <div class="detail-username">@${escapeHtml(username)}</div>
                        ${isEnded ? '<div class="detail-ended-badge">ENDED</div>' : ''}
                    </div>
                    <div class="info-grid">
                        <div class="info-row"><span class="info-label">Based On</span><span class="info-value">${escapeHtml(auction.based_on || '-')}</span></div>
                        <div class="info-row"><span class="info-label">Start Price</span><span class="info-value price">${formatNumber(auction.start_price)} TON</span></div>
                        <div class="info-row"><span class="info-label">${isEnded ? 'Final' : 'Current'} Price</span><span class="info-value price">${formatNumber(auction.current_price)} TON</span></div>
                        <div class="info-row"><span class="info-label">Min Increment</span><span class="info-value">${formatNumber(auction.min_increment)} TON</span></div>
                        ${!isEnded ? `<div class="info-row"><span class="info-label">Time Remaining</span><span class="info-value timer" id="detailTimer">${timeRemaining}</span></div>` : ''}
                        ${winnerInfo}
                    </div>
                    <div class="bid-history-title"><i class="fas fa-list"></i> Bid History (${bids.length})</div>
                    <div class="bid-list">${bidHistoryHtml}</div>
                </div>
                <div class="detail-actions">
                    ${!isEnded && isActive && !isOwner ? '<button class="detail-action-btn bid-btn" id="placeBidBtn"><i class="fas fa-gavel"></i> Place Bid</button>' : ''}
                    <button class="detail-action-btn close-detail-btn" id="closeDetailBtn"><i class="fas fa-times"></i> Close</button>
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
                    const remaining = formatTimeRemaining(auction.end_time);
                    if (timerElement) timerElement.textContent = remaining;
                    if (remaining === 'Ended') {
                        if (detailTimerInterval) clearInterval(detailTimerInterval);
                        document.getElementById('placeBidBtn')?.remove();
                    }
                };
                updateDetailTimer();
                detailTimerInterval = setInterval(updateDetailTimer, 1000);
            }
            
            const closeHandler = () => {
                if (detailTimerInterval) clearInterval(detailTimerInterval);
                closeAuctionDetail();
            };
            
            auctionDetailPanel.querySelector('.detail-close')?.addEventListener('click', closeHandler);
            auctionDetailPanel.querySelector('#closeDetailBtn')?.addEventListener('click', closeHandler);
            auctionDetailOverlay.addEventListener('click', (e) => { if (e.target === auctionDetailOverlay) closeHandler(); });
            
            document.getElementById('placeBidBtn')?.addEventListener('click', async () => {
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
            
        } catch (error) {
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setContainerLoading(false);
        }
    }
    
    function closeAuctionDetail() {
        if (auctionDetailPanel) {
            auctionDetailPanel.classList.remove('open');
            setTimeout(() => { auctionDetailPanel?.remove(); auctionDetailPanel = null; }, 300);
        }
        if (auctionDetailOverlay) {
            auctionDetailOverlay.classList.remove('active');
            setTimeout(() => { auctionDetailOverlay?.remove(); auctionDetailOverlay = null; }, 300);
        }
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    async function placeBid(auctionId, bidAmount) {
        if (!telegramUser) { showToast('Login terlebih dahulu', 'warning'); return; }
        
        hapticMedium();
        setContainerLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auctions/bid/${auctionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: telegramUser.id, bid_amount: bidAmount })
            });
            
            const data = await response.json();
            if (data.success) {
                hapticSuccess();
                showToast('Bid berhasil!', 'success');
                await loadAuctions();
            } else {
                showToast(data.error || 'Gagal menempatkan bid', 'error');
            }
        } catch (error) {
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setContainerLoading(false);
        }
    }
    
    function switchAuctionTab(tab) {
        currentAuctionTab = tab;
        document.querySelectorAll('.auctions-action-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.auctionsTab === tab);
        });
        loadAuctions();
        hapticLight();
    }
    
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
    
    function setupLayoutToggle() {
        if (auctionsGridBtn) {
            auctionsGridBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                localStorage.setItem('auctions_layout', 'grid');
                auctionsGridBtn.classList.add('active');
                auctionsListBtn?.classList.remove('active');
                filterAndRenderAuctions();
                hapticLight();
            });
        }
        if (auctionsListBtn) {
            auctionsListBtn.addEventListener('click', () => {
                currentLayout = 'list';
                localStorage.setItem('auctions_layout', 'list');
                auctionsListBtn.classList.add('active');
                auctionsGridBtn?.classList.remove('active');
                filterAndRenderAuctions();
                hapticLight();
            });
        }
        
        if (currentLayout === 'grid') {
            auctionsGridBtn?.classList.add('active');
            auctionsListBtn?.classList.remove('active');
        } else {
            auctionsListBtn?.classList.add('active');
            auctionsGridBtn?.classList.remove('active');
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
        
        createAuctionBtn?.addEventListener('click', showCreateAuctionPanel);
        
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
            if (auctionsContainer) auctionsContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
        }
        
        // PERBAIKAN: Interval TANPA loading overlay
        setInterval(async () => {
            try {
                await fetch(`${API_BASE_URL}/api/winedash/auctions/check-expired`, { method: 'POST' });
                // HANYA reload jika tab aktif dan tidak sedang loading
                if (!isLoading) {
                    await loadAuctions();
                }
            } catch (error) {
                console.error('Error checking expired:', error);
            }
        }, 60000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
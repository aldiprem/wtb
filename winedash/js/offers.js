// winedash/js/offers.js - Offers Page Logic

(function() {
    'use strict';
    
    console.log('📦 Winedash Offers - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let currentOffersTab = 'offers'; // offers, my-offers, my-bids, history
    let allOffers = [];
    let currentSearchTerm = '';
    let currentLayout = localStorage.getItem('offers_layout') || 'grid';
    let currentOffers = [];
    let offerDetailOverlay = null;
    
    // DOM Elements
    let offersContainer = null;
    let offersSearchInput = null;
    let offersSearchApplyBtn = null;
    let offersGridBtn = null;
    let offersListBtn = null;
    
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
    
    // ==================== LOAD OFFERS DATA ====================
    
    async function loadOffers() {
        if (!telegramUser) return;
        
        showLoading(true);
        
        try {
            console.log(`[OFFERS] Loading offers for tab: ${currentOffersTab}`);
            
            let url = '';
            switch (currentOffersTab) {
                case 'offers':
                    url = `${API_BASE_URL}/api/winedash/offers/incoming/${telegramUser.id}`;
                    break;
                case 'my-offers':
                    url = `${API_BASE_URL}/api/winedash/offers/my-offers/${telegramUser.id}`;
                    break;
                case 'my-bids':
                    url = `${API_BASE_URL}/api/winedash/offers/my-offers/${telegramUser.id}`;
                    break;
                case 'history':
                    url = `${API_BASE_URL}/api/winedash/offers/history/${telegramUser.id}`;
                    break;
                default:
                    url = `${API_BASE_URL}/api/winedash/offers/incoming/${telegramUser.id}`;
            }
            
            // Add status filter for offers and my-offers
            if (currentOffersTab === 'offers' || currentOffersTab === 'my-offers') {
                url += '?status=pending';
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log(`[OFFERS] Loaded offers:`, data);
            
            if (data.success) {
                if (currentOffersTab === 'history') {
                    currentOffers = data.history || [];
                } else {
                    currentOffers = data.offers || [];
                }
                filterAndRenderOffers();
            } else {
                currentOffers = [];
                renderOffersEmpty();
            }
        } catch (error) {
            console.error('[OFFERS] Error loading offers:', error);
            renderOffersEmpty();
        } finally {
            showLoading(false);
        }
    }
    
    function filterAndRenderOffers() {
        let filtered = [...currentOffers];
        
        // Filter by search term
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(offer => 
                offer.username && offer.username.toLowerCase().includes(term)
            );
        }
        
        renderOffers(filtered);
    }
    
    function renderOffers(offers) {
        if (!offersContainer) return;
        
        if (!offers || offers.length === 0) {
            renderOffersEmpty();
            return;
        }
        
        if (currentLayout === 'grid') {
            offersContainer.className = 'offers-grid';
            let html = '';
            
            for (const offer of offers) {
                const username = offer.username || '';
                const price = offer.price || 0;
                const status = offer.status || 'pending';
                const statusText = getStatusText(status);
                const statusClass = getStatusClass(status);
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                // Determine user info based on tab
                let userInfo = '';
                if (currentOffersTab === 'offers') {
                    const bidderName = offer.bidder_username || offer.bidder_name || 'Someone';
                    userInfo = `<div class="offers-card-user">From: @${escapeHtml(bidderName)}</div>`;
                } else if (currentOffersTab === 'my-offers') {
                    const ownerName = offer.owner_username || offer.owner_name || 'Owner';
                    userInfo = `<div class="offers-card-user">To: @${escapeHtml(ownerName)}</div>`;
                } else if (currentOffersTab === 'my-bids') {
                    const ownerName = offer.owner_username || offer.owner_name || 'Owner';
                    userInfo = `<div class="offers-card-user">To: @${escapeHtml(ownerName)}</div>`;
                } else if (currentOffersTab === 'history') {
                    const actionBy = offer.bidder_id === telegramUser?.id ? 'You made' : 'Received';
                    userInfo = `<div class="offers-card-user">${actionBy}</div>`;
                }
                
                html += `
                    <div class="offers-card" data-offer='${JSON.stringify(offer).replace(/'/g, "&#39;")}'>
                        <div class="offers-card-image">
                            <div class="offers-card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username)}" data-username="${username}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="offers-card-username">@${escapeHtml(username)}</div>
                        </div>
                        <div class="offers-card-info">
                            <div class="offers-card-price-row">
                                <div class="offers-price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="offers-price-logo">
                                    <span class="offers-card-price">${formatNumber(price)}</span>
                                </div>
                                <div class="offers-card-status ${statusClass}">${statusText}</div>
                            </div>
                            ${userInfo}
                        </div>
                    </div>
                `;
            }
            
            offersContainer.innerHTML = html;
            
            // Attach click events
            document.querySelectorAll('.offers-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    try {
                        const offerData = JSON.parse(card.dataset.offer.replace(/&#39;/g, "'"));
                        showOfferDetailPanel(offerData);
                    } catch (err) {
                        console.error('Error parsing offer data:', err);
                    }
                });
            });
            
            // Fetch avatars async
            setTimeout(() => fetchAllOfferAvatars(), 200);
            
        } else {
            // List layout
            offersContainer.className = 'offers-list';
            let html = '';
            
            for (const offer of offers) {
                const username = offer.username || '';
                const price = offer.price || 0;
                const status = offer.status || 'pending';
                const statusText = getStatusText(status);
                const statusClass = getStatusClass(status);
                
                let avatarUrl = localStorage.getItem(`avatar_${username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                let userInfo = '';
                if (currentOffersTab === 'offers') {
                    const bidderName = offer.bidder_username || offer.bidder_name || 'Someone';
                    userInfo = `<div class="offers-list-user">From: @${escapeHtml(bidderName)}</div>`;
                } else if (currentOffersTab === 'my-offers') {
                    const ownerName = offer.owner_username || offer.owner_name || 'Owner';
                    userInfo = `<div class="offers-list-user">To: @${escapeHtml(ownerName)}</div>`;
                } else if (currentOffersTab === 'my-bids') {
                    const ownerName = offer.owner_username || offer.owner_name || 'Owner';
                    userInfo = `<div class="offers-list-user">To: @${escapeHtml(ownerName)}</div>`;
                }
                
                html += `
                    <div class="offers-list-item" data-offer='${JSON.stringify(offer).replace(/'/g, "&#39;")}'>
                        <div class="offers-list-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="offers-list-info">
                            <div class="offers-list-username">@${escapeHtml(username)}</div>
                            ${userInfo}
                        </div>
                        <div class="offers-list-price-wrapper">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 16px; height: 16px;">
                            <span class="offers-list-price">${formatNumber(price)}</span>
                        </div>
                        <div class="offers-list-status ${statusClass}">${statusText}</div>
                    </div>
                `;
            }
            
            offersContainer.innerHTML = html;
            
            // Attach click events
            document.querySelectorAll('.offers-list-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    try {
                        const offerData = JSON.parse(item.dataset.offer.replace(/&#39;/g, "'"));
                        showOfferDetailPanel(offerData);
                    } catch (err) {
                        console.error('Error parsing offer data:', err);
                    }
                });
            });
            
            setTimeout(() => fetchAllOfferAvatars(), 200);
        }
    }
    
    async function fetchAllOfferAvatars() {
        const avatars = document.querySelectorAll('.offers-card-avatar img, .offers-list-avatar img');
        
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
    
    function renderOffersEmpty() {
        if (!offersContainer) return;
        
        let emptyMessage = '';
        switch (currentOffersTab) {
            case 'offers':
                emptyMessage = 'Belum ada offer masuk';
                break;
            case 'my-offers':
                emptyMessage = 'Anda belum membuat offer';
                break;
            case 'my-bids':
                emptyMessage = 'Anda belum melakukan bid';
                break;
            case 'history':
                emptyMessage = 'Belum ada riwayat offer';
                break;
            default:
                emptyMessage = 'Tidak ada data';
        }
        
        offersContainer.innerHTML = `
            <div class="offers-empty-state">
                <div class="offers-empty-animation" id="offersEmptyAnimation"></div>
                <div class="offers-empty-title">No Offers</div>
                <div class="offers-empty-subtitle">${emptyMessage}</div>
            </div>
        `;
        
        // Load empty animation
        const animContainer = document.getElementById('offersEmptyAnimation');
        if (animContainer) {
            animContainer.innerHTML = '<i class="fas fa-tag" style="font-size: 48px; color: var(--text-muted);"></i>';
        }
    }
    
    function getStatusText(status) {
        switch (status) {
            case 'pending': return 'Pending';
            case 'accepted': return 'Accepted';
            case 'rejected': return 'Rejected';
            case 'cancelled': return 'Cancelled';
            default: return status;
        }
    }
    
    function getStatusClass(status) {
        switch (status) {
            case 'pending': return 'pending';
            case 'accepted': return 'accepted';
            case 'rejected': return 'rejected';
            case 'cancelled': return 'cancelled';
            default: return '';
        }
    }
    
    // ==================== OFFER DETAIL PANEL ====================
    
    function showOfferDetailPanel(offer) {
        const existingPanel = document.querySelector('.offer-detail-panel');
        if (existingPanel) existingPanel.remove();
        
        if (!offerDetailOverlay) {
            offerDetailOverlay = document.createElement('div');
            offerDetailOverlay.className = 'panel-overlay';
            document.body.appendChild(offerDetailOverlay);
            offerDetailOverlay.addEventListener('click', closeOfferDetailPanel);
        }
        
        const username = offer.username || '';
        const price = offer.price || 0;
        const status = offer.status || 'pending';
        const statusText = getStatusText(status);
        const statusClass = getStatusClass(status);
        const createdAt = formatDateIndonesia(offer.created_at);
        const message = offer.message || '';
        
        let avatarUrl = localStorage.getItem(`avatar_${username}`);
        if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
            avatarUrl = "https://companel.shop/image/winedash-logo.png";
        }
        
        // Determine if user is owner or bidder
        const isOwner = telegramUser && offer.owner_id === telegramUser.id;
        const isBidder = telegramUser && offer.bidder_id === telegramUser.id;
        const isPending = status === 'pending';
        
        let actionButtons = '';
        if (isPending) {
            if (isOwner) {
                actionButtons = `
                    <button class="detail-action-btn accept-btn" data-action="accept">
                        <i class="fas fa-check-circle"></i> Accept Offer
                    </button>
                    <button class="detail-action-btn reject-btn" data-action="reject">
                        <i class="fas fa-times-circle"></i> Reject
                    </button>
                `;
            } else if (isBidder) {
                actionButtons = `
                    <button class="detail-action-btn cancel-btn" data-action="cancel">
                        <i class="fas fa-ban"></i> Cancel Offer
                    </button>
                `;
            }
        }
        
        const panel = document.createElement('div');
        panel.className = 'offer-detail-panel';
        panel.innerHTML = `
            <div class="drag-handle"></div>
            <div class="panel-header">
                <h3><i class="fas fa-tag"></i> Offer Detail</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="detail-avatar">
                <div class="detail-avatar-img">
                    <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                </div>
                <div class="detail-username-badge">@${escapeHtml(username)}</div>
            </div>
            <div class="panel-content">
                <div class="detail-field">
                    <div class="detail-label">Offer Price</div>
                    <div class="detail-value price">
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;">
                        ${formatNumber(price)} TON
                    </div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">
                        <span class="offers-card-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Created At</div>
                    <div class="detail-value">${createdAt}</div>
                </div>
                ${message ? `
                <div class="detail-field">
                    <div class="detail-label">Message</div>
                    <div class="detail-value" style="text-align: left; word-break: break-word;">${escapeHtml(message)}</div>
                </div>
                ` : ''}
                <div class="detail-field">
                    <div class="detail-label">Offer ID</div>
                    <div class="detail-value">#${offer.id}</div>
                </div>
            </div>
            ${actionButtons ? `<div class="detail-actions">${actionButtons}</div>` : ''}
        `;
        
        document.body.appendChild(panel);
        setupDragToClose(panel);
        document.body.classList.add('panel-open');
        offerDetailOverlay.classList.add('active');
        setTimeout(() => panel.classList.add('open'), 50);
        
        // Close button
        const closeBtn = panel.querySelector('.panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeOfferDetailPanel());
        }
        
        // Action buttons
        const acceptBtn = panel.querySelector('[data-action="accept"]');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', async () => {
                closeOfferDetailPanel();
                await acceptOffer(offer.id);
            });
        }
        
        const rejectBtn = panel.querySelector('[data-action="reject"]');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', async () => {
                closeOfferDetailPanel();
                await rejectOffer(offer.id);
            });
        }
        
        const cancelBtn = panel.querySelector('[data-action="cancel"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                closeOfferDetailPanel();
                await cancelOffer(offer.id);
            });
        }
    }
    
    function closeOfferDetailPanel() {
        const panel = document.querySelector('.offer-detail-panel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.remove(), 300);
        }
        if (offerDetailOverlay) {
            offerDetailOverlay.classList.remove('active');
        }
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    function setupDragToClose(panel) {
        const dragHandle = panel.querySelector('.drag-handle');
        if (!dragHandle) return;
        
        let startY = 0, currentY = 0, isDragging = false;
        
        dragHandle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            panel.style.transition = 'none';
            hapticLight();
        });
        
        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) {
                panel.style.transform = `translateY(${Math.min(deltaY, panel.offsetHeight * 0.7)}px)`;
            }
        });
        
        dragHandle.addEventListener('touchend', () => {
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            if (currentY - startY > 100) {
                closeOfferDetailPanel();
            } else {
                panel.style.transform = '';
            }
        });
    }
    
    // ==================== OFFER ACTIONS ====================
    
    async function acceptOffer(offerId) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/offers/accept/${offerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: telegramUser.id })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Offer berhasil diterima!', 'success');
                await loadOffers();
            } else {
                showToast(data.error || 'Gagal menerima offer', 'error');
            }
        } catch (error) {
            console.error('Error accepting offer:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function rejectOffer(offerId) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/offers/reject/${offerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: telegramUser.id })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Offer ditolak!', 'warning');
                await loadOffers();
            } else {
                showToast(data.error || 'Gagal menolak offer', 'error');
            }
        } catch (error) {
            console.error('Error rejecting offer:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function cancelOffer(offerId) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/offers/cancel/${offerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: telegramUser.id })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Offer dibatalkan!', 'info');
                await loadOffers();
            } else {
                showToast(data.error || 'Gagal membatalkan offer', 'error');
            }
        } catch (error) {
            console.error('Error cancelling offer:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== CREATE OFFER MODAL ====================
    
    function showCreateOfferModal(username, usernameId, ownerId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay create-offer-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 340px;">
                <h3><i class="fas fa-tag"></i> Buat Offer</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    Buat offer untuk username <strong>@${escapeHtml(username)}</strong>
                </p>
                <div class="price-with-logo" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;">
                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 24px; height: 24px;">
                    <input type="number" id="offerPriceInput" placeholder="Harga (TON)" class="form-input price-input" step="0.1" min="0.1" style="width: auto; flex: 1; text-align: center;">
                </div>
                <textarea id="offerMessageInput" placeholder="Pesan (opsional)" class="form-input message-input" rows="3" maxlength="200"></textarea>
                <div class="modal-buttons">
                    <button class="modal-cancel" id="cancelOfferBtn">Batal</button>
                    <button class="modal-confirm" id="confirmOfferBtn">Buat Offer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const priceInput = document.getElementById('offerPriceInput');
        if (priceInput) setTimeout(() => priceInput.focus(), 100);
        
        document.getElementById('cancelOfferBtn').addEventListener('click', () => modal.remove());
        document.getElementById('confirmOfferBtn').addEventListener('click', async () => {
            const price = parseFloat(priceInput?.value);
            const message = document.getElementById('offerMessageInput')?.value || '';
            
            if (isNaN(price) || price <= 0) {
                showToast('Masukkan harga yang valid', 'warning');
                return;
            }
            
            modal.remove();
            await createOffer(username, usernameId, ownerId, price, message);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    async function createOffer(username, usernameId, ownerId, price, message) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/offers/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    username_id: usernameId,
                    owner_id: ownerId,
                    bidder_id: telegramUser.id,
                    price: price,
                    message: message
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast(data.message, 'success');
                // Switch to my-offers tab
                switchOffersTab('my-offers');
                await loadOffers();
            } else {
                showToast(data.error || 'Gagal membuat offer', 'error');
            }
        } catch (error) {
            console.error('Error creating offer:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== TAB SWITCHING ====================
    
    function switchOffersTab(tab) {
        currentOffersTab = tab;
        
        // Update active state on buttons
        document.querySelectorAll('.offers-action-btn').forEach(btn => {
            const btnTab = btn.dataset.offersTab;
            if (btnTab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Reload offers
        loadOffers();
        hapticLight();
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (offersSearchApplyBtn) {
            offersSearchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = offersSearchInput?.value || '';
                filterAndRenderOffers();
                hapticLight();
            });
        }
        
        if (offersSearchInput) {
            offersSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = offersSearchInput.value;
                    filterAndRenderOffers();
                    hapticLight();
                }
            });
        }
    }
    
    // ==================== LAYOUT TOGGLE ====================
    
    function setupLayoutToggle() {
        if (offersGridBtn) {
            offersGridBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                localStorage.setItem('offers_layout', 'grid');
                offersGridBtn.classList.add('active');
                if (offersListBtn) offersListBtn.classList.remove('active');
                filterAndRenderOffers();
                hapticLight();
            });
        }
        
        if (offersListBtn) {
            offersListBtn.addEventListener('click', () => {
                currentLayout = 'list';
                localStorage.setItem('offers_layout', 'list');
                offersListBtn.classList.add('active');
                if (offersGridBtn) offersGridBtn.classList.remove('active');
                filterAndRenderOffers();
                hapticLight();
            });
        }
        
        // Set initial active state
        if (currentLayout === 'grid' && offersGridBtn) {
            offersGridBtn.classList.add('active');
            if (offersListBtn) offersListBtn.classList.remove('active');
        } else if (currentLayout === 'list' && offersListBtn) {
            offersListBtn.classList.add('active');
            if (offersGridBtn) offersGridBtn.classList.remove('active');
        }
    }
    
    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('📦 Winedash Offers - Initializing...');
        
        // Get DOM elements
        offersContainer = document.getElementById('offersContainer');
        offersSearchInput = document.getElementById('offersSearchInput');
        offersSearchApplyBtn = document.getElementById('offersSearchApplyBtn');
        offersGridBtn = document.getElementById('offersGridBtn');
        offersListBtn = document.getElementById('offersListBtn');
        
        // Setup action buttons
        document.querySelectorAll('.offers-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.offersTab;
                if (tab) switchOffersTab(tab);
            });
        });
        
        // Setup search
        setupSearch();
        
        // Setup layout toggle
        setupLayoutToggle();
        
        // Get Telegram user
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            await authenticateUser();
            await loadOffers();
        } else {
            if (offersContainer) {
                offersContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
            }
        }
        
        // Check for URL parameter to switch tab
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('offers_tab');
        if (tabParam && ['offers', 'my-offers', 'my-bids', 'history'].includes(tabParam)) {
            switchOffersTab(tabParam);
        }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
// winedash/js/auctions-activity.js - Halaman Auction Activity

(function() {
    'use strict';
    
    console.log('📊 Winedash Auctions Activity - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let activityType = 'my-auctions'; // my-auctions, my-bids, ended
    let activities = [];
    let currentSearchTerm = '';
    
    // DOM Elements
    let activityContainer = null;
    let activitySearchInput = null;
    let activitySearchApplyBtn = null;
    let backToAuctionsBtn = null;
    
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
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
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
    
    // ==================== LOAD ACTIVITIES ====================
    
    async function loadActivities() {
        if (!telegramUser) {
            console.log('[ACTIVITY] No telegram user');
            return;
        }
        
        showLoading(true);
        
        try {
            console.log(`[ACTIVITY] Loading activities for type: ${activityType}`);
            
            let url = '';
            switch (activityType) {
                case 'my-auctions':
                    url = `${API_BASE_URL}/api/winedash/auctions/my-auctions/${telegramUser.id}`;
                    break;
                case 'my-bids':
                    url = `${API_BASE_URL}/api/winedash/auctions/my-bids/${telegramUser.id}`;
                    break;
                case 'ended':
                    url = `${API_BASE_URL}/api/winedash/auctions/ended/${telegramUser.id}`;
                    break;
                default:
                    url = `${API_BASE_URL}/api/winedash/auctions/my-auctions/${telegramUser.id}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log(`[ACTIVITY] Response:`, data);
            
            if (data.success) {
                activities = data.auctions || [];
                renderActivities();
            } else {
                activities = [];
                renderEmptyState();
            }
        } catch (error) {
            console.error('[ACTIVITY] Error loading activities:', error);
            renderEmptyState();
        } finally {
            showLoading(false);
        }
    }
    
    function renderActivities() {
        if (!activityContainer) return;
        
        let filtered = [...activities];
        
        // Filter by search term
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(activity => 
                activity.username && activity.username.toLowerCase().includes(term)
            );
        }
        
        if (filtered.length === 0) {
            renderEmptyState();
            return;
        }
        
        let html = `
            <div class="activity-list">
                <div class="activity-header">
                    <h3><i class="fas ${activityType === 'my-auctions' ? 'fa-gavel' : activityType === 'my-bids' ? 'fa-history' : 'fa-check-circle'}"></i> 
                        ${activityType === 'my-auctions' ? 'My Auctions' : activityType === 'my-bids' ? 'My Bids' : 'Ended Auctions'}
                    </h3>
                </div>
                <div class="activity-items">
        `;
        
        for (const activity of filtered) {
            const username = activity.username || '';
            const currentPrice = activity.current_price || activity.start_price || 0;
            const isEnded = activity.status === 'ended' || (activity.end_time && new Date(activity.end_time) <= new Date());
            const timeRemaining = formatTimeRemaining(activity.end_time);
            
            let avatarUrl = localStorage.getItem(`avatar_${username}`);
            if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                avatarUrl = "https://companel.shop/image/winedash-logo.png";
            }
            
            let statusHtml = '';
            let bidInfoHtml = '';
            
            if (activityType === 'my-auctions') {
                statusHtml = `<span class="activity-status ${isEnded ? 'ended' : 'active'}">${isEnded ? 'ENDED' : 'ACTIVE'}</span>`;
                if (isEnded && activity.winner_id) {
                    const winnerName = activity.winner_username || activity.winner_name || 'Winner';
                    const winningBid = activity.winning_bid || currentPrice;
                    bidInfoHtml = `<div class="activity-winner">Winner: ${escapeHtml(winnerName)} (${formatNumber(winningBid)} TON)</div>`;
                } else if (!isEnded) {
                    bidInfoHtml = `<div class="activity-bid-count">Bids: ${activity.bid_count || 0} | Current: ${formatNumber(currentPrice)} TON</div>`;
                }
            } else if (activityType === 'my-bids') {
                const myLastBid = activity.my_last_bid || 0;
                statusHtml = `<span class="activity-status ${isEnded ? 'ended' : 'active'}">${isEnded ? 'ENDED' : 'ACTIVE'}</span>`;
                bidInfoHtml = `<div class="activity-bid-info">My Bid: ${formatNumber(myLastBid)} TON | Current: ${formatNumber(currentPrice)} TON</div>`;
                if (isEnded && activity.winner_id === telegramUser.id) {
                    bidInfoHtml += `<div class="activity-winner-badge">🏆 YOU WON!</div>`;
                }
            } else if (activityType === 'ended') {
                statusHtml = `<span class="activity-status ended">ENDED</span>`;
                if (activity.winner_id) {
                    const winnerName = activity.winner_username || activity.winner_name || 'Winner';
                    const winningBid = activity.winning_bid || currentPrice;
                    const isWinner = activity.winner_id === telegramUser.id;
                    bidInfoHtml = `<div class="activity-winner ${isWinner ? 'winner-me' : ''}">
                        Winner: ${escapeHtml(winnerName)} (${formatNumber(winningBid)} TON)${isWinner ? ' - 🏆 YOU WON!' : ''}
                    </div>`;
                } else {
                    bidInfoHtml = `<div class="activity-winner">No bids placed - Auction ended</div>`;
                }
            }
            
            html += `
                <div class="activity-item" data-auction-id="${activity.id}" data-auction='${JSON.stringify(activity).replace(/'/g, "&#39;")}'>
                    <div class="activity-avatar">
                        <img src="${avatarUrl}" alt="${escapeHtml(username)}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                    </div>
                    <div class="activity-info">
                        <div class="activity-username">@${escapeHtml(username)}</div>
                        <div class="activity-details">
                            ${bidInfoHtml}
                            ${!isEnded ? `<div class="activity-timer" id="timer-${activity.id}">Time: ${timeRemaining}</div>` : ''}
                            <div class="activity-basedon">Based On: ${escapeHtml(activity.based_on || '-')}</div>
                        </div>
                    </div>
                    <div class="activity-right">
                        ${statusHtml}
                        <button class="activity-view-btn" data-auction-id="${activity.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        activityContainer.innerHTML = html;
        
        // Attach click events untuk view detail
        document.querySelectorAll('.activity-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.activity-view-btn')) {
                    const auctionId = e.target.closest('.activity-view-btn').dataset.auctionId;
                    if (auctionId && typeof window.showAuctionDetail === 'function') {
                        window.showAuctionDetail(parseInt(auctionId));
                    }
                } else {
                    const auctionId = item.dataset.auctionId;
                    if (auctionId && typeof window.showAuctionDetail === 'function') {
                        window.showAuctionDetail(parseInt(auctionId));
                    }
                }
            });
        });
        
        // Start timers untuk yang active
        startTimers(filtered);
    }
    
    function startTimers(activities) {
        for (const activity of activities) {
            if (activity.status !== 'active') continue;
            
            const timerElement = document.getElementById(`timer-${activity.id}`);
            if (!timerElement) continue;
            
            const updateTimer = () => {
                const remaining = formatTimeRemaining(activity.end_time);
                timerElement.textContent = `Time: ${remaining}`;
                if (remaining === 'Ended') {
                    setTimeout(() => loadActivities(), 1000);
                }
            };
            
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            
            // Store interval for cleanup
            if (!window.activityTimers) window.activityTimers = {};
            window.activityTimers[activity.id] = interval;
        }
    }
    
    function renderEmptyState() {
        if (!activityContainer) return;
        
        let emptyMessage = '';
        switch (activityType) {
            case 'my-auctions':
                emptyMessage = 'Anda belum membuat auction apapun';
                break;
            case 'my-bids':
                emptyMessage = 'Anda belum melakukan bid pada auction manapun';
                break;
            case 'ended':
                emptyMessage = 'Tidak ada auction yang selesai';
                break;
            default:
                emptyMessage = 'Tidak ada aktivitas';
        }
        
        activityContainer.innerHTML = `
            <div class="activity-empty-state">
                <i class="fas fa-inbox"></i>
                <div class="activity-empty-title">No Activity</div>
                <div class="activity-empty-subtitle">${emptyMessage}</div>
                <button class="activity-back-btn" id="backToAuctionsFromEmptyBtn">
                    <i class="fas fa-arrow-left"></i> Back to Auctions
                </button>
            </div>
        `;
        
        const backBtn = document.getElementById('backToAuctionsFromEmptyBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (typeof window.switchToAuctionsMode === 'function') {
                    window.switchToAuctionsMode();
                }
            });
        }
    }
    
    // ==================== TAB SWITCHING ====================
    
    function switchActivityType(type) {
        activityType = type;
        
        // Update active state pada tabs
        document.querySelectorAll('.activity-tab-btn').forEach(btn => {
            const btnType = btn.dataset.activityType;
            if (btnType === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        loadActivities();
        hapticLight();
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (activitySearchApplyBtn) {
            const newBtn = activitySearchApplyBtn.cloneNode(true);
            activitySearchApplyBtn.parentNode.replaceChild(newBtn, activitySearchApplyBtn);
            activitySearchApplyBtn = newBtn;
            
            activitySearchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = activitySearchInput?.value || '';
                loadActivities();
                hapticLight();
            });
        }
        
        if (activitySearchInput) {
            const newInput = activitySearchInput.cloneNode(true);
            activitySearchInput.parentNode.replaceChild(newInput, activitySearchInput);
            activitySearchInput = newInput;
            
            activitySearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = activitySearchInput.value;
                    loadActivities();
                    hapticLight();
                }
            });
        }
    }

    // ==================== SAFE AREA INSET ====================

    function applySafeAreaInsets() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.warn('[ACTIVITY] Telegram WebApp not available');
            return;
        }
        
        const root = document.documentElement;
        
        const topInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-top')) || 0;
        const bottomInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-bottom')) || 0;
        const leftInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-left')) || 0;
        const rightInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-right')) || 0;
        
        let safeTop = topInset;
        let safeBottom = bottomInset;
        let safeLeft = leftInset;
        let safeRight = rightInset;
        
        if (tg.safeAreaInset) {
            safeTop = tg.safeAreaInset.top || safeTop;
            safeBottom = tg.safeAreaInset.bottom || safeBottom;
            safeLeft = tg.safeAreaInset.left || safeLeft;
            safeRight = tg.safeAreaInset.right || safeRight;
        }
        
        // Apply ke fullscreen page
        const fullscreenPage = document.getElementById('auctionsActivityFullscreen');
        if (fullscreenPage) {
            fullscreenPage.style.paddingTop = `${safeTop}px`;
            fullscreenPage.style.paddingBottom = `${safeBottom}px`;
            fullscreenPage.style.paddingLeft = `${safeLeft}px`;
            fullscreenPage.style.paddingRight = `${safeRight}px`;
        }
        
        // Apply ke fullscreen header
        const fullscreenHeader = document.querySelector('#auctionsActivityFullscreen .fullscreen-header');
        if (fullscreenHeader) {
            fullscreenHeader.style.paddingTop = `${safeTop + 16}px`;
        }
        
        // Apply ke fullscreen content
        const fullscreenContent = document.querySelector('#auctionsActivityFullscreen .fullscreen-content');
        if (fullscreenContent) {
            fullscreenContent.style.paddingBottom = `${safeBottom + 20}px`;
        }
        
        console.log('[ACTIVITY] Safe area applied:', { safeTop, safeBottom });
    }

    function initSafeArea() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        setTimeout(applySafeAreaInsets, 50);
        applySafeAreaInsets();
        
        if (tg.onEvent) {
            tg.onEvent('safeAreaChanged', () => applySafeAreaInsets());
            tg.onEvent('contentSafeAreaChanged', () => applySafeAreaInsets());
            tg.onEvent('viewportChanged', () => applySafeAreaInsets());
        }
    }

    function createFullscreenActivityPage() {
        const existingFullscreen = document.getElementById('auctionsActivityFullscreen');
        if (existingFullscreen) {
            existingFullscreen.remove();
        }
        
        const fullscreenDiv = document.createElement('div');
        fullscreenDiv.id = 'auctionsActivityFullscreen';
        fullscreenDiv.className = 'fullscreen-page';
        
        // Apply initial safe area insets
        const tg = window.Telegram?.WebApp;
        let safeTop = 0, safeBottom = 0;
        if (tg && tg.safeAreaInset) {
            safeTop = tg.safeAreaInset.top || 0;
            safeBottom = tg.safeAreaInset.bottom || 0;
        }
        
        fullscreenDiv.style.paddingTop = `${safeTop}px`;
        fullscreenDiv.style.paddingBottom = `${safeBottom}px`;
        
        fullscreenDiv.innerHTML = `
            <div class="fullscreen-header" style="padding-top: ${safeTop + 16}px;">
                <div class="fullscreen-header-left">
                    <h2><i class="fas fa-history"></i> Auction Activity</h2>
                </div>
                <button class="close-fullscreen-btn" id="closeActivityFullscreenBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="fullscreen-content" style="padding-bottom: ${safeBottom + 20}px;">
                <!-- Tabs Navigation -->
                <div class="activity-tabs-fullscreen">
                    <button class="activity-tab-fullscreen active" data-activity-tab="my-auctions">
                        <i class="fas fa-gavel"></i>
                        <span>My Auctions</span>
                    </button>
                    <button class="activity-tab-fullscreen" data-activity-tab="my-bids">
                        <i class="fas fa-history"></i>
                        <span>My Bids</span>
                    </button>
                    <button class="activity-tab-fullscreen" data-activity-tab="ended">
                        <i class="fas fa-check-circle"></i>
                        <span>Ended</span>
                    </button>
                </div>

                <!-- Search Bar -->
                <div class="activity-search-fullscreen">
                    <div class="search-container-fullscreen">
                        <input type="text" class="search-input-fullscreen" id="activityFullscreenSearchInput" placeholder="🔍 Cari username...">
                        <button class="search-btn-fullscreen" id="activityFullscreenSearchBtn">Apply</button>
                    </div>
                </div>

                <!-- Activity Container -->
                <div id="auctionsActivityFullscreenContainer" class="activity-fullscreen-container">
                    <div class="loading-placeholder">Memuat aktivitas...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(fullscreenDiv);
        activityFullscreen = fullscreenDiv;
        
        // Setup tombol close
        const closeBtn = document.getElementById('closeActivityFullscreenBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeFullscreenActivity();
                if (typeof window.switchToAuctionsMode === 'function') {
                    window.switchToAuctionsMode();
                }
            });
        }
        
        // Setup tabs
        document.querySelectorAll('.activity-tab-fullscreen').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.activityTab;
                if (tab) {
                    currentActivityTab = tab;
                    document.querySelectorAll('.activity-tab-fullscreen').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    await loadActivityData();
                }
            });
        });
        
        // Setup search
        const searchBtn = document.getElementById('activityFullscreenSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('activityFullscreenSearchInput');
                activitySearchTerm = searchInput?.value || '';
                renderActivityItems();
            });
        }
        
        const searchInput = document.getElementById('activityFullscreenSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    activitySearchTerm = searchInput.value;
                    renderActivityItems();
                }
            });
        }
        
        // Setup closing behavior untuk fullscreen
        setupFullscreenClosingBehavior();
        
        return fullscreenDiv;
    }

    function setupFullscreenClosingBehavior() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        // Disable vertical swipe untuk fullscreen page
        const fullscreenPage = document.getElementById('auctionsActivityFullscreen');
        if (fullscreenPage) {
            fullscreenPage.addEventListener('touchstart', (e) => {
                // Prevent default hanya jika diperlukan
            }, { passive: true });
        }
    }

    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('📊 Winedash Auctions Activity - Initializing...');

        initSafeArea();
        
        activityContainer = document.getElementById('auctionsActivityContainer');
        activitySearchInput = document.getElementById('activitySearchInput');
        activitySearchApplyBtn = document.getElementById('activitySearchApplyBtn');
        backToAuctionsBtn = document.getElementById('backToAuctionsBtn');
        
        if (!activityContainer) {
            console.error('[ACTIVITY] Container not found');
            return;
        }
        
        // Setup back button
        if (backToAuctionsBtn) {
            const newBtn = backToAuctionsBtn.cloneNode(true);
            backToAuctionsBtn.parentNode.replaceChild(newBtn, backToAuctionsBtn);
            backToAuctionsBtn = newBtn;
            
            backToAuctionsBtn.addEventListener('click', () => {
                if (typeof window.switchToAuctionsMode === 'function') {
                    window.switchToAuctionsMode();
                }
            });
        }
        
        // Setup activity tabs
        document.querySelectorAll('.activity-tab-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const type = newBtn.dataset.activityType;
                if (type) switchActivityType(type);
            });
        });
        
        setupSearch();
        
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            await authenticateUser();
            await loadActivities();
        } else {
            activityContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
        }
        
        console.log('✅ Auctions Activity initialized');
    }
    
    // Cleanup timers on page unload
    window.addEventListener('beforeunload', () => {
        if (window.activityTimers) {
            Object.values(window.activityTimers).forEach(interval => clearInterval(interval));
        }
    });
    
    // Export global functions
    window.initAuctionsActivity = init;
    window.refreshAuctionsActivity = loadActivities;
    
    // Auto init if this is the activity page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        if (window.location.pathname.includes('/auctions-activity')) {
            init();
        }
    }
    
})();
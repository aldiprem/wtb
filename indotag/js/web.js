// INDOTAG MARKET - Main JavaScript

(function() {
    'use strict';
    
    console.log('🏷️ INDOTAG MARKET - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
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

    // State
    let telegramUser = null;
    let currentPage = 'market';
    let currentCategory = 'all';
    let listings = [];
    let categories = [];
    let userBalance = 0;
    let userStats = { total_listings: 0, total_purchases: 0, total_storage: 0 };

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        userBalance: document.getElementById('userBalance'),
        
        // Navigation
        navItems: document.querySelectorAll('.nav-item'),
        sections: {
            market: document.getElementById('marketSection'),
            activity: document.getElementById('activitySection'),
            storage: document.getElementById('storageSection'),
            profile: document.getElementById('profileSection')
        },
        
        // Market
        listingsGrid: document.getElementById('listingsGrid'),
        categoriesContainer: document.getElementById('categoriesContainer'),
        searchInput: document.getElementById('searchInput'),
        
        // Activity
        activitiesList: document.getElementById('activitiesList'),
        
        // Storage
        storageList: document.getElementById('storageList'),
        
        // Profile
        profileAvatar: document.getElementById('profileAvatar'),
        profileName: document.getElementById('profileName'),
        profileUsername: document.getElementById('profileUsername'),
        profileId: document.getElementById('profileId'),
        statListings: document.getElementById('statListings'),
        statPurchases: document.getElementById('statPurchases'),
        statStorage: document.getElementById('statStorage'),
        createListingBtn: document.getElementById('createListingBtn'),
        
        // Modals
        createListingModal: document.getElementById('createListingModal'),
        listingDetailModal: document.getElementById('listingDetailModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
        submitListingBtn: document.getElementById('submitListingBtn'),
        listingUsername: document.getElementById('listingUsername'),
        listingPrice: document.getElementById('listingPrice'),
        listingCategory: document.getElementById('listingCategory'),
        listingDescription: document.getElementById('listingDescription'),
        listingDetailBody: document.getElementById('listingDetailBody')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        else hapticLight();
        
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
        if (num === undefined || num === null) return '0';
        return num.toLocaleString('id-ID');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days === 0) return 'Hari ini';
            if (days === 1) return 'Kemarin';
            if (days < 7) return `${days} hari lalu`;
            return date.toLocaleDateString('id-ID');
        } catch {
            return '-';
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

    async function loadUserData() {
        if (!telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/user/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: telegramUser })
            });
            const data = await response.json();
            
            if (data.success) {
                userBalance = data.balance || 0;
                userStats = data.stats || { total_listings: 0, total_purchases: 0, total_storage: 0 };
                
                if (elements.userBalance) elements.userBalance.textContent = formatNumber(userBalance);
                if (elements.statListings) elements.statListings.textContent = formatNumber(userStats.total_listings);
                if (elements.statPurchases) elements.statPurchases.textContent = formatNumber(userStats.total_purchases);
                if (elements.statStorage) elements.statStorage.textContent = formatNumber(userStats.total_storage);
                
                updateProfileUI();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    function updateProfileUI() {
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || 'Pengguna Telegram';
        
        if (elements.profileName) elements.profileName.textContent = fullName;
        if (elements.profileUsername) elements.profileUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        if (elements.profileId) elements.profileId.textContent = `ID: ${telegramUser.id}`;
        
        const avatarContainer = elements.profileAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" alt="${escapeHtml(fullName)}">`;
            } else {
                const nameForAvatar = encodeURIComponent(fullName.substring(0, 2));
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=140&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(fullName)}">`;
            }
        }
    }

    // ==================== MARKET FUNCTIONS ====================
    
    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/categories`);
            const data = await response.json();
            
            if (data.success && data.categories) {
                categories = data.categories;
                renderCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    function renderCategories() {
        if (!elements.categoriesContainer) return;
        
        let html = '';
        for (const cat of categories) {
            html += `
                <div class="category-chip ${cat.id === currentCategory ? 'active' : ''}" data-category="${cat.id}">
                    <i class="fas ${cat.icon}"></i>
                    <span>${escapeHtml(cat.name)}</span>
                </div>
            `;
        }
        elements.categoriesContainer.innerHTML = html;
        
        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                hapticLight();
                currentCategory = chip.dataset.category;
                loadListings();
                renderCategories();
            });
        });
    }

    async function loadListings() {
        if (!elements.listingsGrid) return;
        
        elements.listingsGrid.innerHTML = '<div class="loading-placeholder">Memuat listing...</div>';
        
        try {
            const url = `${API_BASE_URL}/api/indotag/listings?category=${currentCategory}&limit=50`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success && data.listings) {
                listings = data.listings;
                renderListings(listings);
            } else {
                elements.listingsGrid.innerHTML = '<div class="loading-placeholder">Tidak ada listing</div>';
            }
        } catch (error) {
            console.error('Error loading listings:', error);
            elements.listingsGrid.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function renderListings(listingsData) {
        if (!elements.listingsGrid) return;
        
        const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
        let filteredListings = listingsData;
        
        if (searchTerm) {
            filteredListings = listingsData.filter(l => 
                l.username.toLowerCase().includes(searchTerm)
            );
        }
        
        if (filteredListings.length === 0) {
            elements.listingsGrid.innerHTML = '<div class="loading-placeholder">Tidak ada username ditemukan</div>';
            return;
        }
        
        let html = '';
        for (const listing of filteredListings) {
            const categoryIcon = getCategoryIcon(listing.category);
            const isPremium = listing.is_premium ? '<span style="color: var(--warning);"><i class="fas fa-crown"></i></span> ' : '';
            
            html += `
                <div class="listing-card" data-listing-id="${listing.listing_id}">
                    <div class="listing-header">
                        <div class="listing-username">${isPremium}@${escapeHtml(listing.username)}</div>
                        <div class="listing-price">
                            <i class="fas fa-star"></i>
                            <span>${formatNumber(listing.price)}</span>
                        </div>
                    </div>
                    <div class="listing-category">
                        <i class="fas ${categoryIcon}"></i>
                        <span>${escapeHtml(listing.category || 'General')}</span>
                    </div>
                    ${listing.description ? `<div class="listing-description">${escapeHtml(listing.description.substring(0, 60))}${listing.description.length > 60 ? '...' : ''}</div>` : ''}
                    <div class="listing-footer">
                        <span><i class="fas fa-eye"></i> ${formatNumber(listing.views || 0)}</span>
                        <span><i class="fas fa-user"></i> @${escapeHtml(listing.seller_username || 'seller')}</span>
                    </div>
                </div>
            `;
        }
        
        elements.listingsGrid.innerHTML = html;
        
        document.querySelectorAll('.listing-card').forEach(card => {
            card.addEventListener('click', () => {
                const listingId = card.dataset.listingId;
                if (listingId) showListingDetail(listingId);
            });
        });
    }

    function getCategoryIcon(category) {
        const icons = {
            'premium': 'fa-crown',
            'rare': 'fa-gem',
            'old': 'fa-clock',
            'general': 'fa-tag'
        };
        return icons[category] || 'fa-tag';
    }

    // ==================== ACTIVITY FUNCTIONS ====================
    
    async function loadActivities() {
        if (!elements.activitiesList || !telegramUser) return;
        
        elements.activitiesList.innerHTML = '<div class="loading-placeholder">Memuat aktivitas...</div>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/activities?user_id=${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.activities) {
                renderActivities(data.activities);
            } else {
                elements.activitiesList.innerHTML = '<div class="loading-placeholder">Tidak ada aktivitas</div>';
            }
        } catch (error) {
            console.error('Error loading activities:', error);
            elements.activitiesList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function renderActivities(activities) {
        if (!elements.activitiesList) return;
        
        if (activities.length === 0) {
            elements.activitiesList.innerHTML = '<div class="loading-placeholder">Belum ada aktivitas</div>';
            return;
        }
        
        let html = '';
        for (const activity of activities) {
            const icon = getActivityIcon(activity.activity_type);
            html += `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-info">
                        <div class="activity-description">${escapeHtml(activity.description || activity.activity_type)}</div>
                        <div class="activity-time">${formatDate(activity.created_at)}</div>
                    </div>
                </div>
            `;
        }
        elements.activitiesList.innerHTML = html;
    }

    function getActivityIcon(type) {
        const icons = {
            'create_listing': 'fa-tag',
            'purchase': 'fa-shopping-cart',
            'sell': 'fa-exchange-alt',
            'deposit': 'fa-plus-circle',
            'withdraw': 'fa-minus-circle'
        };
        return icons[type] || 'fa-history';
    }

    // ==================== STORAGE FUNCTIONS ====================
    
    async function loadStorage() {
        if (!elements.storageList || !telegramUser) return;
        
        elements.storageList.innerHTML = '<div class="loading-placeholder">Memuat storage...</div>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/storage?user_id=${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.storage) {
                renderStorage(data.storage);
            } else {
                elements.storageList.innerHTML = '<div class="loading-placeholder">Tidak ada username tersimpan</div>';
            }
        } catch (error) {
            console.error('Error loading storage:', error);
            elements.storageList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function renderStorage(storage) {
        if (!elements.storageList) return;
        
        if (storage.length === 0) {
            elements.storageList.innerHTML = '<div class="loading-placeholder">Belum ada username yang dibeli</div>';
            return;
        }
        
        let html = '';
        for (const item of storage) {
            html += `
                <div class="storage-item">
                    <div class="activity-icon">
                        <i class="fas fa-tag"></i>
                    </div>
                    <div class="activity-info">
                        <div class="storage-username">@${escapeHtml(item.username)}</div>
                        <div class="storage-date">Dibeli: ${formatDate(item.purchased_at)}</div>
                    </div>
                </div>
            `;
        }
        elements.storageList.innerHTML = html;
    }

    // ==================== LISTING DETAIL ====================
    
    async function showListingDetail(listingId) {
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/listings/${listingId}`);
            const data = await response.json();
            
            if (data.success && data.listing) {
                renderListingDetail(data.listing);
                elements.listingDetailModal.style.display = 'flex';
                document.body.classList.add('modal-open');
            } else {
                showToast('Gagal memuat detail listing', 'error');
            }
        } catch (error) {
            console.error('Error loading listing detail:', error);
            showToast('Gagal memuat detail listing', 'error');
        } finally {
            showLoading(false);
        }
    }

    function renderListingDetail(listing) {
        if (!elements.listingDetailBody) return;
        
        const isOwner = telegramUser && listing.seller_id === telegramUser.id;
        const categoryIcon = getCategoryIcon(listing.category);
        
        let html = `
            <div class="listing-detail-header">
                <div class="listing-detail-username">@${escapeHtml(listing.username)}</div>
                <div class="listing-detail-price">
                    <i class="fas fa-star"></i>
                    <span>${formatNumber(listing.price)} Stars</span>
                </div>
                <div class="listing-detail-category">
                    <i class="fas ${categoryIcon}"></i>
                    <span>${escapeHtml(listing.category || 'General')}</span>
                </div>
            </div>
        `;
        
        if (listing.description) {
            html += `
                <div class="listing-detail-description">
                    ${escapeHtml(listing.description)}
                </div>
            `;
        }
        
        html += `
            <div class="listing-detail-seller">
                <div class="seller-avatar">
                    ${listing.seller_photo_url ? 
                        `<img src="${listing.seller_photo_url}" alt="Seller">` : 
                        `<i class="fas fa-user"></i>`
                    }
                </div>
                <div class="seller-info">
                    <div class="seller-name">${escapeHtml(listing.seller_first_name || 'Seller')}</div>
                    <div class="seller-username">@${escapeHtml(listing.seller_username || 'unknown')}</div>
                </div>
            </div>
        `;
        
        if (!isOwner && telegramUser) {
            html += `
                <button class="buy-btn" id="buyListingBtn" data-listing-id="${listing.listing_id}" data-price="${listing.price}">
                    <i class="fas fa-shopping-cart"></i>
                    <span>Beli Sekarang</span>
                </button>
            `;
        } else if (isOwner) {
            html += `
                <div style="text-align: center; padding: 12px; background: var(--primary-glass); border-radius: 14px; color: var(--primary);">
                    <i class="fas fa-crown"></i> Ini adalah listing milik Anda
                </div>
            `;
        }
        
        elements.listingDetailBody.innerHTML = html;
        
        const buyBtn = document.getElementById('buyListingBtn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => purchaseListing(buyBtn.dataset.listingId, parseInt(buyBtn.dataset.price)));
        }
    }

    async function purchaseListing(listingId, price) {
        hapticMedium();
        
        if (userBalance < price) {
            showToast(`Saldo tidak mencukupi! Butuh ${formatNumber(price)} Stars`, 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            // Simulate purchase (implement actual transaction logic)
            showToast('Fitur pembelian akan segera tersedia', 'info');
        } catch (error) {
            console.error('Error purchasing:', error);
            showToast('Gagal melakukan pembelian', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== CREATE LISTING ====================
    
    function showCreateListingModal() {
        hapticMedium();
        elements.createListingModal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        if (elements.listingUsername) elements.listingUsername.value = '';
        if (elements.listingPrice) elements.listingPrice.value = '';
        if (elements.listingDescription) elements.listingDescription.value = '';
    }

    async function submitListing() {
        const username = elements.listingUsername?.value.trim();
        const price = parseInt(elements.listingPrice?.value);
        const category = elements.listingCategory?.value;
        const description = elements.listingDescription?.value.trim();
        
        if (!username) {
            showToast('Masukkan username', 'warning');
            return;
        }
        
        if (!price || price < 1) {
            showToast('Masukkan harga yang valid', 'warning');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/indotag/listings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: telegramUser,
                    username: username,
                    price: price,
                    category: category,
                    description: description
                })
            });
            const data = await response.json();
            
            if (data.success) {
                showToast('Listing berhasil dibuat!', 'success');
                closeCreateListingModal();
                loadListings();
                loadUserData();
            } else {
                showToast(data.error || 'Gagal membuat listing', 'error');
            }
        } catch (error) {
            console.error('Error creating listing:', error);
            showToast('Gagal membuat listing', 'error');
        } finally {
            showLoading(false);
        }
    }

    function closeCreateListingModal() {
        elements.createListingModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function closeDetailModal() {
        elements.listingDetailModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    // ==================== NAVIGATION ====================
    
    function switchPage(page) {
        currentPage = page;
        
        Object.keys(elements.sections).forEach(key => {
            if (elements.sections[key]) {
                elements.sections[key].classList.remove('active');
            }
        });
        
        if (elements.sections[page]) {
            elements.sections[page].classList.add('active');
        }
        
        elements.navItems.forEach(item => {
            const itemPage = item.dataset.page;
            if (itemPage === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Load data based on page
        if (page === 'activity') loadActivities();
        if (page === 'storage') loadStorage();
        if (page === 'market') loadListings();
        if (page === 'profile') loadUserData();
    }

    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', () => {
                renderListings(listings);
            });
        }
    }

    // ==================== INITIALIZATION ====================
    
    function initTelegram() {
        const tg = getTelegramWebApp();
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0a0a0a');
            tg.setBackgroundColor('#0a0a0a');
            console.log('✅ Telegram WebApp initialized');
        }
    }

    function setupEventListeners() {
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => {
                hapticLight();
                const page = item.dataset.page;
                if (page) switchPage(page);
            });
        });
        
        if (elements.createListingBtn) {
            elements.createListingBtn.addEventListener('click', showCreateListingModal);
        }
        
        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', closeCreateListingModal);
        }
        
        if (elements.closeDetailModalBtn) {
            elements.closeDetailModalBtn.addEventListener('click', closeDetailModal);
        }
        
        if (elements.submitListingBtn) {
            elements.submitListingBtn.addEventListener('click', submitListing);
        }
        
        elements.createListingModal?.addEventListener('click', (e) => {
            if (e.target === elements.createListingModal) closeCreateListingModal();
        });
        
        elements.listingDetailModal?.addEventListener('click', (e) => {
            if (e.target === elements.listingDetailModal) closeDetailModal();
        });
    }

    async function init() {
        initTelegram();
        showLoading(true);
        
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            await loadUserData();
        }
        
        await loadCategories();
        await loadListings();
        
        setupEventListeners();
        setupSearch();
        
        showLoading(false);
        console.log('✅ INDOTAG MARKET initialized');
    }
    
    init();
})();
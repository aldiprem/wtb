// panel.js - Panel Admin dengan Dashboard Lengkap
(function() {
    'use strict';
    
    console.log('🛠️ Panel Admin - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentUser = null;
    let currentWebsite = null;
    let products = [];
    let orders = [];

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        errorMessage: document.getElementById('errorMessage'),
        websiteBadge: document.getElementById('websiteBadge'),
        panelContent: document.getElementById('panelContent'),
        noWebsiteMessage: document.getElementById('noWebsiteMessage'),
        refreshBtn: document.getElementById('refreshBtn'),
        
        // Profile (tetap sama)
        profileAvatar: document.getElementById('profileAvatar'),
        profileName: document.getElementById('profileName'),
        profileBadge: document.getElementById('profileBadge'),
        profileUsername: document.getElementById('profileUsername'),
        profileId: document.getElementById('profileId'),
        websiteEndpoint: document.getElementById('websiteEndpoint'),
        copyEndpointBtn: document.getElementById('copyEndpointBtn'),
        previewWebsiteBtn: document.getElementById('previewWebsiteBtn'),
        websiteStatus: document.getElementById('websiteStatus'),
        
        // Stats
        statTotalProducts: document.getElementById('statTotalProducts'),
        statRevenue: document.getElementById('statRevenue'),
        statOrders: document.getElementById('statOrders'),
        statCustomers: document.getElementById('statCustomers'),
        
        // Navigation
        productsNav: document.getElementById('productsNav'),
        appearanceNav: document.getElementById('appearanceNav'),
        paymentsNav: document.getElementById('paymentsNav'),
        settingsNav: document.getElementById('settingsNav'),
        
        // Recent Orders
        recentOrdersList: document.getElementById('recentOrdersList'),
        emptyOrders: document.getElementById('emptyOrders'),
        
        // Popular Products
        popularProductsList: document.getElementById('popularProductsList'),
        emptyPopularProducts: document.getElementById('emptyPopularProducts'),
        
        // Website Info
        websiteCreatedDate: document.getElementById('websiteCreatedDate'),
        websiteEndDate: document.getElementById('websiteEndDate'),
        totalStock: document.getElementById('totalStock'),
        lowStockCount: document.getElementById('lowStockCount')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
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

    function formatRupiah(angka) {
        if (!angka) return 'Rp 0';
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    // ==================== API FUNCTIONS (SAMA PERSIS DENGAN KODE ASLI) ====================
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
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

    // Fungsi verifikasi kepemilikan (SAMA PERSIS DENGAN KODE ASLI)
    function isOwner(userId) {
        return currentWebsite && Number(currentWebsite.owner_id) === Number(userId);
    }

    async function fetchWebsiteData(userId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/user/${userId}`, {
                method: 'GET'
            });
            
            if (data.success && data.websites && data.websites.length > 0) {
                return data.websites[0];
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching website:', error);
            return null;
        }
    }

    async function fetchProducts(websiteId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${websiteId}`, {
                method: 'GET'
            });
            
            if (data.success) {
                return data.data || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Error fetching products:', error);
            return [];
        }
    }

    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            setTimeout(() => {
                window.location.href = '/wtb/dashboard.html';
            }, 2000);
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                return data.website;
            }
            return null;
        } catch (error) {
            console.error('❌ Error loading website:', error);
            return null;
        }
    }

    // ==================== LOAD DATA ====================
    async function loadAllData() {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            // Load products
            products = await fetchProducts(currentWebsite.id);
            
            // Generate dummy orders untuk demo
            orders = generateDummyOrders();
            
            // Update UI
            updateUI();
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Dummy data generator
    function generateDummyOrders() {
        const statuses = ['pending', 'processing', 'completed', 'cancelled'];
        const statusText = {
            'pending': 'Menunggu',
            'processing': 'Diproses',
            'completed': 'Selesai',
            'cancelled': 'Dibatalkan'
        };
        
        return Array(5).fill().map((_, i) => ({
            id: i + 1,
            order_number: `ORD-${Date.now().toString().slice(-6)}${i + 1}`,
            customer_name: `Customer ${i + 1}`,
            total: Math.floor(Math.random() * 500000) + 50000,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            status_text: statusText[statuses[Math.floor(Math.random() * statuses.length)]],
            date: new Date(Date.now() - i * 86400000).toISOString()
        }));
    }

    function calculateStats() {
        let totalProducts = 0;
        let totalStock = 0;
        let lowStock = 0;
        let totalRevenue = 0;
        
        products.forEach(layanan => {
            layanan.aplikasi?.forEach(aplikasi => {
                aplikasi.items?.forEach(item => {
                    totalProducts++;
                    if (item.item_metode === 'directly') {
                        const stokCount = item.item_stok?.length || 0;
                        totalStock += stokCount;
                        if (stokCount > 0 && stokCount <= 5) lowStock++;
                    }
                });
            });
        });
        
        // Hitung pendapatan dummy dari orders
        orders.forEach(order => {
            if (order.status === 'completed') {
                totalRevenue += order.total;
            }
        });
        
        return {
            totalProducts,
            totalStock,
            lowStock,
            totalRevenue,
            totalOrders: orders.length,
            totalCustomers: Math.floor(Math.random() * 50) + 10 // Dummy customers
        };
    }

    // ==================== UPDATE UI ====================
    function updateUI() {
        // Update profile
        if (currentUser) {
            const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'User';
            const username = currentUser.username ? `@${currentUser.username}` : '(no username)';
            
            if (elements.profileName) elements.profileName.textContent = fullName;
            if (elements.profileUsername) elements.profileUsername.innerHTML = `<i class="fab fa-telegram"></i> ${username}`;
            if (elements.profileId) elements.profileId.innerHTML = `<i class="fas fa-id-card"></i> ID: ${currentUser.id}`;
            
            if (currentUser.photo_url) {
                elements.profileAvatar.src = currentUser.photo_url;
            } else {
                elements.profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=120&background=40a7e3&color=fff`;
            }
        }
        
        // Update website info
        if (currentWebsite) {
            const endpoint = currentWebsite.endpoint;
            
            if (elements.websiteBadge) elements.websiteBadge.textContent = `/${endpoint}`;
            if (elements.websiteEndpoint) elements.websiteEndpoint.textContent = `/${endpoint}`;
            if (elements.websiteStatus) {
                if (currentWebsite.status === 'active') {
                    elements.websiteStatus.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>';
                } else {
                    elements.websiteStatus.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i>';
                }
            }
            
            if (elements.websiteCreatedDate) elements.websiteCreatedDate.textContent = formatDate(currentWebsite.created_at);
            if (elements.websiteEndDate) elements.websiteEndDate.textContent = formatDate(currentWebsite.end_date) || 'Tidak terbatas';
            
            // Update navigation links
            const baseUrl = `/wtb/html`;
            if (elements.productsNav) elements.productsNav.href = `${baseUrl}/produk.html?website=${endpoint}`;
            if (elements.appearanceNav) elements.appearanceNav.href = `${baseUrl}/tampilan.html?website=${endpoint}`;
            if (elements.paymentsNav) elements.paymentsNav.href = `${baseUrl}/pembayaran.html?website=${endpoint}`;
            if (elements.settingsNav) elements.settingsNav.href = `${baseUrl}/pengaturan.html?website=${endpoint}`;
            
            // View all links
            const viewAllOrders = document.getElementById('ordersViewAll');
            const viewAllProducts = document.getElementById('productsViewAll');
            if (viewAllOrders) viewAllOrders.href = `${baseUrl}/pesanan.html?website=${endpoint}`;
            if (viewAllProducts) viewAllProducts.href = `${baseUrl}/produk.html?website=${endpoint}`;
        }
        
        // Calculate and update stats
        const stats = calculateStats();
        
        if (elements.statTotalProducts) elements.statTotalProducts.textContent = stats.totalProducts;
        if (elements.statRevenue) elements.statRevenue.textContent = formatRupiah(stats.totalRevenue);
        if (elements.statOrders) elements.statOrders.textContent = stats.totalOrders;
        if (elements.statCustomers) elements.statCustomers.textContent = stats.totalCustomers;
        
        if (elements.totalStock) elements.totalStock.textContent = stats.totalStock;
        if (elements.lowStockCount) elements.lowStockCount.textContent = stats.lowStock;
        
        // Render recent orders
        renderRecentOrders();
        
        // Render popular products
        renderPopularProducts();
    }

    function renderRecentOrders() {
        if (!elements.recentOrdersList) return;
        
        if (orders.length === 0) {
            elements.recentOrdersList.innerHTML = '';
            if (elements.emptyOrders) elements.emptyOrders.style.display = 'block';
            return;
        }
        
        if (elements.emptyOrders) elements.emptyOrders.style.display = 'none';
        
        let html = '';
        orders.slice(0, 5).forEach(order => {
            html += `
                <div class="order-item" data-id="${order.id}">
                    <div class="order-info">
                        <div class="order-number">${escapeHtml(order.order_number)}</div>
                        <div class="order-customer">${escapeHtml(order.customer_name)}</div>
                    </div>
                    <div class="order-meta">
                        <span class="order-status ${order.status}">${escapeHtml(order.status_text)}</span>
                        <span class="order-total">${formatRupiah(order.total)}</span>
                    </div>
                </div>
            `;
        });
        
        elements.recentOrdersList.innerHTML = html;
    }

    function renderPopularProducts() {
        if (!elements.popularProductsList) return;
        
        // Collect all items
        const allItems = [];
        products.forEach(layanan => {
            layanan.aplikasi?.forEach(aplikasi => {
                aplikasi.items?.forEach(item => {
                    allItems.push({
                        ...item,
                        layanan_nama: layanan.layanan_nama,
                        aplikasi_nama: aplikasi.aplikasi_nama
                    });
                });
            });
        });
        
        // Sort by terjual (dummy)
        const popular = allItems.sort((a, b) => (b.terjual || 0) - (a.terjual || 0)).slice(0, 3);
        
        if (popular.length === 0) {
            elements.popularProductsList.innerHTML = '';
            if (elements.emptyPopularProducts) elements.emptyPopularProducts.style.display = 'block';
            return;
        }
        
        if (elements.emptyPopularProducts) elements.emptyPopularProducts.style.display = 'none';
        
        let html = '';
        popular.forEach(item => {
            html += `
                <div class="product-mini-card" data-id="${item.id}">
                    <div class="product-mini-info">
                        <div class="product-mini-name">${escapeHtml(item.item_nama)}</div>
                        <div class="product-mini-category">${escapeHtml(item.aplikasi_nama)}</div>
                    </div>
                    <div class="product-mini-stats">
                        <span class="product-mini-price">${formatRupiah(item.item_harga)}</span>
                        <span class="product-mini-sold"><i class="fas fa-shopping-cart"></i> ${item.terjual || 0}</span>
                    </div>
                </div>
            `;
        });
        
        elements.popularProductsList.innerHTML = html;
    }

    // ==================== ACTION FUNCTIONS (SAMA PERSIS DENGAN KODE ASLI) ====================
    function copyEndpoint() {
        if (!currentWebsite) return;
        
        const endpoint = `/${currentWebsite.endpoint}`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(endpoint).then(() => {
                showToast('✅ Endpoint copied!', 'success');
            }).catch(() => {
                fallbackCopy(endpoint);
            });
        } else {
            fallbackCopy(endpoint);
        }
    }
    
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showToast('✅ Endpoint copied!', 'success');
        } catch (err) {
            showToast('❌ Failed to copy', 'error');
        }
        
        document.body.removeChild(textarea);
    }

    function previewWebsite() {
        if (!currentWebsite) return;
        
        const url = `https://aldiprem.github.io/wtb/website?store=${currentWebsite.endpoint}`;
        window.open(url, '_blank');
    }

    // ==================== APPLY TELEGRAM THEME (SAMA PERSIS DENGAN KODE ASLI) ====================
    function applyTelegramTheme(tg) {
        if (!tg || !tg.themeParams) return;
        
        try {
            const theme = tg.themeParams;
            
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
            }
            if (theme.hint_color) {
                document.documentElement.style.setProperty('--tg-hint-color', theme.hint_color);
            }
            if (theme.link_color) {
                document.documentElement.style.setProperty('--tg-link-color', theme.link_color);
            }
            if (theme.button_color) {
                document.documentElement.style.setProperty('--tg-button-color', theme.button_color);
            }
            if (theme.button_text_color) {
                document.documentElement.style.setProperty('--tg-button-text-color', theme.button_text_color);
            }
        } catch (themeError) {
            console.warn('⚠️ Error applying Telegram theme:', themeError);
        }
    }

    // ==================== SET USER AVATAR (SAMA PERSIS DENGAN KODE ASLI) ====================
    function setUserAvatar(user) {
        if (!user) return;
        
        if (user.photo_url) {
            elements.profileAvatar.src = user.photo_url;
        } else {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
            elements.profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=120&background=40a7e3&color=fff`;
        }
    }

    // ==================== SHOW ERROR (SAMA PERSIS DENGAN KODE ASLI) ====================
    function showError(message, isOwnerError = false) {
        vibrate(30);
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.error) {
            elements.error.style.display = 'flex';
            if (elements.errorMessage) {
                if (isOwnerError) {
                    elements.errorMessage.innerHTML = `
                        <strong>❌ Access Denied</strong><br>
                        <small>Your ID is not authorized as owner</small>
                    `;
                } else {
                    elements.errorMessage.textContent = message;
                }
            }
        }
        if (elements.panelContent) {
            elements.panelContent.style.display = 'none';
        }
        if (elements.noWebsiteMessage) {
            elements.noWebsiteMessage.style.display = 'none';
        }
        showLoading(false);
    }

    // ==================== UPDATE UI (SAMA PERSIS DENGAN KODE ASLI) ====================
    async function updateUI(user) {
        currentUser = user;
        
        setUserAvatar(user);
        
        if (elements.loading) elements.loading.style.display = 'none';
        
        const website = await fetchWebsiteData(user.id);
        
        if (website) {
            if (elements.error) elements.error.style.display = 'none';
            if (elements.noWebsiteMessage) elements.noWebsiteMessage.style.display = 'none';
            if (elements.panelContent) elements.panelContent.style.display = 'block';
            
            currentWebsite = website;
            
            // Load all data
            await loadAllData();
            
        } else {
            if (elements.error) elements.error.style.display = 'none';
            if (elements.panelContent) elements.panelContent.style.display = 'none';
            if (elements.noWebsiteMessage) elements.noWebsiteMessage.style.display = 'flex';
        }
    }

    // ==================== INITIALIZATION (SAMA PERSIS DENGAN KODE ASLI) ====================
    async function init() {
        console.log('🛠️ Initializing Panel...');

        try {
            let telegramUserData = null;
            let tg = null;

            if (window.Telegram?.WebApp) {
                console.log('📱 Running inside Telegram Web App');
                tg = window.Telegram.WebApp;
                
                tg.expand();
                tg.ready();
                
                if (tg.initDataUnsafe?.user) {
                    telegramUserData = tg.initDataUnsafe.user;
                    
                    if (tg.initDataUnsafe?.user?.photo_url) {
                        telegramUserData.photo_url = tg.initDataUnsafe.user.photo_url;
                    }
                    
                    console.log('📱 Telegram user data:', telegramUserData);
                }
                
                applyTelegramTheme(tg);
            } else {
                console.log('🌐 Running in standalone web browser');
                
                telegramUserData = {
                    id: 7998861975,
                    first_name: 'Test',
                    last_name: 'User',
                    username: 'test_user'
                };
            }

            if (!telegramUserData) {
                showError('No user data available');
                return;
            }

            await updateUI(telegramUserData);

        } catch (error) {
            console.error('💥 Fatal error in init:', error);
            showError('Failed to initialize panel');
        }
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => {
                vibrate(10);
                loadAllData();
                showToast('Data diperbarui', 'success');
            });
        }
        
        // Copy endpoint
        if (elements.copyEndpointBtn) {
            elements.copyEndpointBtn.addEventListener('click', copyEndpoint);
        }
        
        // Preview website
        if (elements.previewWebsiteBtn) {
            elements.previewWebsiteBtn.addEventListener('click', previewWebsite);
        }
    }

    // ==================== START ====================
    setupEventListeners();
    init();
})();
// website.js - Website Store Front
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    const ITEMS_PER_PAGE = 10;

    // ==================== STATE ====================
    let currentWebsite = null;
    let currentUser = null;
    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 1;
    let totalPages = 1;
    let bannerInterval = null;
    let currentBannerIndex = 0;
    
    // Filter state
    let selectedLayanan = 'all';
    let selectedAplikasi = 'all';
    let selectedItem = 'all';
    let currentSort = 'terlaris';
    
    // Data dari database
    let tampilanData = null;
    let sosialData = null;
    let paymentData = null;
    let voucherData = null;
    let userClaims = [];

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        // Store Info
        storeLogo: document.getElementById('storeLogo'),
        logoImage: document.getElementById('logoImage'),
        logoIcon: document.getElementById('logoIcon'),
        storeName: document.getElementById('storeName'),
        storeNameContainer: document.getElementById('storeNameContainer'),
        
        // Banner
        bannerSlider: document.getElementById('bannerSliderTrack'),
        bannerDots: document.getElementById('bannerDots'),
        bannerPrev: document.getElementById('bannerPrev'),
        bannerNext: document.getElementById('bannerNext'),
        
        // Navigation
        navTabs: document.querySelectorAll('.nav-tab'),
        pages: document.querySelectorAll('.page'),
        
        // Layanan
        layananGrid: document.getElementById('layananGrid'),
        viewAllLayanan: document.getElementById('viewAllLayanan'),
        
        // Products
        productsGrid: document.getElementById('productsGrid'),
        pagination: document.getElementById('pagination'),
        
        // Filter
        filterLayananBtn: document.getElementById('filterLayananBtn'),
        filterLayananMenu: document.getElementById('filterLayananMenu'),
        selectedLayanan: document.getElementById('selectedLayanan'),
        filterAplikasiBtn: document.getElementById('filterAplikasiBtn'),
        filterAplikasiMenu: document.getElementById('filterAplikasiMenu'),
        selectedAplikasi: document.getElementById('selectedAplikasi'),
        filterItemBtn: document.getElementById('filterItemBtn'),
        filterItemMenu: document.getElementById('filterItemMenu'),
        selectedItem: document.getElementById('selectedItem'),
        sortBtn: document.getElementById('sortBtn'),
        sortMenu: document.getElementById('sortMenu'),
        selectedSort: document.getElementById('selectedSort'),
        
        // Aktivitas
        aktivitasList: document.getElementById('aktivitasList'),
        
        // Promo
        promoBanners: document.getElementById('promoBanners'),
        voucherSection: document.getElementById('voucherSection'),
        voucherGrid: document.getElementById('voucherGrid'),
        lihatVoucherBtn: document.getElementById('lihatVoucherBtn'),
        
        // Bank
        bankBalance: document.getElementById('bankBalance'),
        userBalance: document.getElementById('userBalance'),
        depositBtn: document.getElementById('depositBtn'),
        withdrawBtn: document.getElementById('withdrawBtn'),
        transferBtn: document.getElementById('transferBtn'),
        rekeningGrid: document.getElementById('rekeningGrid'),
        gatewaySection: document.getElementById('gatewaySection'),
        gatewayCard: document.getElementById('gatewayCard'),
        
        // Profil
        profileImage: document.getElementById('profileImage'),
        profileName: document.getElementById('profileName'),
        profileUsername: document.getElementById('profileUsername'),
        profileOrders: document.getElementById('profileOrders'),
        profileSpent: document.getElementById('profileSpent'),
        profileVouchers: document.getElementById('profileVouchers'),
        profileUserId: document.getElementById('profileUserId'),
        profileJoined: document.getElementById('profileJoined'),
        profileEmail: document.getElementById('profileEmail'),
        profilePhone: document.getElementById('profilePhone'),
        forceSubscribeSection: document.getElementById('forceSubscribeSection'),
        forceList: document.getElementById('forceList'),
        logoutBtn: document.getElementById('logoutBtn')
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

    function formatRupiah(angka) {
        if (!angka) return 'Rp 0';
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Baru saja';
            if (diffMins < 60) return `${diffMins} menit lalu`;
            if (diffHours < 24) return `${diffHours} jam lalu`;
            if (diffDays < 7) return `${diffDays} hari lalu`;
            
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

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
                console.log(`🔄 Retry... ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // ==================== LOAD WEBSITE DATA ====================
    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return null;
        }
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (response.success && response.website) {
                currentWebsite = response.website;
                return currentWebsite;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat website', 'error');
            return null;
        }
    }

    async function loadTampilan() {
        if (!currentWebsite) return null;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success) {
                tampilanData = response.tampilan;
                return tampilanData;
            }
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
        }
        return null;
    }

    async function loadProducts() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success) {
                allProducts = [];
                response.data.forEach(layanan => {
                    if (layanan.aplikasi) {
                        layanan.aplikasi.forEach(aplikasi => {
                            if (aplikasi.items) {
                                aplikasi.items.forEach(item => {
                                    allProducts.push({
                                        ...item,
                                        layanan_nama: layanan.layanan_nama,
                                        layanan_gambar: layanan.layanan_gambar,
                                        aplikasi_nama: aplikasi.aplikasi_nama,
                                        aplikasi_gambar: aplikasi.aplikasi_gambar
                                    });
                                });
                            }
                        });
                    }
                });
                filteredProducts = [...allProducts];
                return allProducts;
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
        }
        return [];
    }

    async function loadSosialData() {
        if (!currentWebsite) return;
        
        try {
            const [telegram, links, force, forceSettings] = await Promise.all([
                fetchWithRetry(`${API_BASE_URL}/api/social/telegram/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false })),
                fetchWithRetry(`${API_BASE_URL}/api/social/links/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false })),
                fetchWithRetry(`${API_BASE_URL}/api/social/force/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false })),
                fetchWithRetry(`${API_BASE_URL}/api/social/force-settings/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false }))
            ]);
            
            sosialData = {
                telegram: telegram.success ? telegram.data : null,
                links: links.success ? links.data : null,
                force: force.success ? force.data : [],
                forceSettings: forceSettings.success ? forceSettings.data : null
            };
            
            return sosialData;
        } catch (error) {
            console.error('❌ Error loading sosial data:', error);
        }
        return null;
    }

    async function loadPaymentData() {
        if (!currentWebsite) return;
        
        try {
            const [rekening, gateway] = await Promise.all([
                fetchWithRetry(`${API_BASE_URL}/api/payments/rekening/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false })),
                fetchWithRetry(`${API_BASE_URL}/api/payments/gateway/${currentWebsite.id}`, { method: 'GET' }).catch(() => ({ success: false }))
            ]);
            
            paymentData = {
                rekening: rekening.success ? rekening.rekening : [],
                gateway: gateway.success ? gateway.gateway : []
            };
            
            return paymentData;
        } catch (error) {
            console.error('❌ Error loading payment data:', error);
        }
        return null;
    }

    async function loadVoucherData() {
        if (!currentWebsite || !currentUser) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/user/${currentUser.id}?website_id=${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success) {
                userClaims = response.claims || [];
                return userClaims;
            }
        } catch (error) {
            console.error('❌ Error loading voucher data:', error);
        }
        return [];
    }

    // ==================== LOAD USER DATA ====================
    function loadUserFromTelegram() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            currentUser = window.Telegram.WebApp.initDataUnsafe.user;
            return currentUser;
        }
        
        // Untuk testing tanpa Telegram
        currentUser = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            photo_url: null
        };
        return currentUser;
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderStoreHeader() {
        if (!tampilanData) return;
        
        // Logo
        if (tampilanData.logo) {
            elements.logoImage.src = tampilanData.logo;
            elements.logoImage.style.display = 'block';
            elements.logoIcon.style.display = 'none';
        } else {
            elements.logoImage.style.display = 'none';
            elements.logoIcon.style.display = 'flex';
        }
        
        // Nama Store dengan animasi font
        const storeName = tampilanData.store_display_name || tampilanData.title || 'Toko Online';
        elements.storeName.textContent = storeName;
        
        // Terapkan font family
        if (tampilanData.font_family) {
            elements.storeName.style.fontFamily = tampilanData.font_family;
        }
        
        // Terapkan font size
        if (tampilanData.font_size) {
            elements.storeName.style.fontSize = tampilanData.font_size + 'px';
        }
        
        // Terapkan animasi
        if (tampilanData.font_animation && tampilanData.font_animation !== 'none') {
            elements.storeNameContainer.style.animation = 
                `${tampilanData.font_animation} ${tampilanData.animation_duration || 2}s ${tampilanData.animation_delay || 0}s ${tampilanData.animation_iteration || 'infinite'}`;
        }
        
        // Warna border dari database
        if (tampilanData.colors && tampilanData.colors.primary) {
            document.documentElement.style.setProperty('--primary-color', tampilanData.colors.primary);
            document.getElementById('storeInfoCard').style.borderColor = tampilanData.colors.primary;
        }
    }

    function renderBanners() {
        if (!tampilanData || !tampilanData.banners || tampilanData.banners.length === 0) {
            elements.bannerSlider.parentElement.style.display = 'none';
            return;
        }
        
        elements.bannerSlider.parentElement.style.display = 'block';
        
        // Render slides
        let slidesHtml = '';
        tampilanData.banners.forEach((banner, index) => {
            slidesHtml += `
                <div class="banner-slide" data-index="${index}">
                    <img src="${banner.url}" alt="Banner ${index + 1}">
                </div>
            `;
        });
        elements.bannerSlider.innerHTML = slidesHtml;
        
        // Render dots
        let dotsHtml = '';
        tampilanData.banners.forEach((_, index) => {
            dotsHtml += `<button class="banner-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></button>`;
        });
        elements.bannerDots.innerHTML = dotsHtml;
        
        // Setup auto slide
        startBannerAutoSlide();
    }

    function startBannerAutoSlide() {
        if (bannerInterval) clearInterval(bannerInterval);
        bannerInterval = setInterval(() => {
            goToNextBanner();
        }, 5000);
    }

    function goToBanner(index) {
        if (!tampilanData || !tampilanData.banners) return;
        
        const totalSlides = tampilanData.banners.length;
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
        
        currentBannerIndex = index;
        elements.bannerSlider.style.transform = `translateX(-${index * 100}%)`;
        
        // Update dots
        document.querySelectorAll('.banner-dot').forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function goToNextBanner() {
        goToBanner(currentBannerIndex + 1);
    }

    function goToPrevBanner() {
        goToBanner(currentBannerIndex - 1);
    }

    function renderLayanan() {
        if (!allProducts || allProducts.length === 0) {
            elements.layananGrid.innerHTML = `
                <div class="empty-state" style="grid-column: span 2;">
                    <i class="fas fa-box-open"></i>
                    <p>Belum ada layanan</p>
                </div>
            `;
            return;
        }
        
        // Group by layanan
        const layananMap = new Map();
        allProducts.forEach(product => {
            const key = product.layanan_nama || 'Lainnya';
            if (!layananMap.has(key)) {
                layananMap.set(key, {
                    nama: key,
                    gambar: product.layanan_gambar,
                    count: 0
                });
            }
            layananMap.get(key).count++;
        });
        
        const layananList = Array.from(layananMap.values()).slice(0, 4);
        
        let html = '';
        layananList.forEach(layanan => {
            html += `
                <div class="layanan-card" data-layanan="${escapeHtml(layanan.nama)}">
                    <div class="layanan-icon">
                        ${layanan.gambar ? 
                            `<img src="${escapeHtml(layanan.gambar)}" alt="${escapeHtml(layanan.nama)}">` : 
                            `<i class="fas fa-layer-group"></i>`
                        }
                    </div>
                    <div class="layanan-nama">${escapeHtml(layanan.nama)}</div>
                    <div class="layanan-count">${layanan.count} produk</div>
                </div>
            `;
        });
        
        elements.layananGrid.innerHTML = html;
        
        // Add click handlers
        document.querySelectorAll('.layanan-card').forEach(card => {
            card.addEventListener('click', () => {
                const layanan = card.dataset.layanan;
                selectedLayanan = layanan;
                elements.selectedLayanan.textContent = layanan;
                applyFilters();
            });
        });
    }

    function renderFilterOptions() {
        // Layanan filter
        const layananSet = new Set(allProducts.map(p => p.layanan_nama || 'Lainnya'));
        let layananHtml = '<button class="filter-option active" data-layanan="all"><i class="fas fa-th-large"></i> Semua Layanan</button>';
        Array.from(layananSet).sort().forEach(layanan => {
            layananHtml += `<button class="filter-option" data-layanan="${escapeHtml(layanan)}"><i class="fas fa-layer-group"></i> ${escapeHtml(layanan)}</button>`;
        });
        elements.filterLayananMenu.innerHTML = layananHtml;
        
        // Setup filter events
        setupFilterEvents();
    }

    function setupFilterEvents() {
        // Layanan filter
        elements.filterLayananBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.filterLayananBtn.parentElement.classList.toggle('active');
        });
        
        elements.filterLayananMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.filter-option');
            if (!option) return;
            
            document.querySelectorAll('#filterLayananMenu .filter-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            selectedLayanan = option.dataset.layanan;
            elements.selectedLayanan.textContent = option.dataset.layanan === 'all' ? 'Layanan' : option.dataset.layanan;
            
            // Reset aplikasi filter
            selectedAplikasi = 'all';
            elements.selectedAplikasi.textContent = 'Aplikasi';
            
            // Update aplikasi options
            updateAplikasiFilter();
            
            elements.filterLayananBtn.parentElement.classList.remove('active');
            applyFilters();
        });
        
        // Aplikasi filter
        elements.filterAplikasiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.filterAplikasiBtn.parentElement.classList.toggle('active');
        });
        
        // Item filter
        elements.filterItemBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.filterItemBtn.parentElement.classList.toggle('active');
        });
        
        elements.filterItemMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.filter-option');
            if (!option) return;
            
            document.querySelectorAll('#filterItemMenu .filter-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            selectedItem = option.dataset.item;
            elements.selectedItem.textContent = option.dataset.item === 'all' ? 'Item' : option.dataset.item;
            
            elements.filterItemBtn.parentElement.classList.remove('active');
            applyFilters();
        });
        
        // Sort filter
        elements.sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.sortBtn.parentElement.classList.toggle('active');
        });
        
        elements.sortMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.filter-option');
            if (!option) return;
            
            document.querySelectorAll('#sortMenu .filter-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            currentSort = option.dataset.sort;
            elements.selectedSort.textContent = option.textContent.trim();
            
            elements.sortBtn.parentElement.classList.remove('active');
            applyFilters();
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });
    }

    function updateAplikasiFilter() {
        let filtered = allProducts;
        if (selectedLayanan !== 'all') {
            filtered = filtered.filter(p => p.layanan_nama === selectedLayanan);
        }
        
        const aplikasiSet = new Set(filtered.map(p => p.aplikasi_nama || 'Lainnya'));
        let aplikasiHtml = '<button class="filter-option active" data-aplikasi="all"><i class="fas fa-th-large"></i> Semua Aplikasi</button>';
        Array.from(aplikasiSet).sort().forEach(aplikasi => {
            aplikasiHtml += `<button class="filter-option" data-aplikasi="${escapeHtml(aplikasi)}"><i class="fas fa-mobile-alt"></i> ${escapeHtml(aplikasi)}</button>`;
        });
        elements.filterAplikasiMenu.innerHTML = aplikasiHtml;
        
        // Add click handlers
        elements.filterAplikasiMenu.querySelectorAll('.filter-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('#filterAplikasiMenu .filter-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                
                selectedAplikasi = opt.dataset.aplikasi;
                elements.selectedAplikasi.textContent = opt.dataset.aplikasi === 'all' ? 'Aplikasi' : opt.dataset.aplikasi;
                
                // Update item filter
                updateItemFilter();
                
                elements.filterAplikasiBtn.parentElement.classList.remove('active');
                applyFilters();
            });
        });
    }

    function updateItemFilter() {
        let filtered = allProducts;
        if (selectedLayanan !== 'all') {
            filtered = filtered.filter(p => p.layanan_nama === selectedLayanan);
        }
        if (selectedAplikasi !== 'all') {
            filtered = filtered.filter(p => p.aplikasi_nama === selectedAplikasi);
        }
        
        const itemSet = new Set(filtered.map(p => p.item_nama || 'Lainnya'));
        let itemHtml = '<button class="filter-option active" data-item="all"><i class="fas fa-th-large"></i> Semua Item</button>';
        Array.from(itemSet).sort().forEach(item => {
            itemHtml += `<button class="filter-option" data-item="${escapeHtml(item)}"><i class="fas fa-box"></i> ${escapeHtml(item)}</button>`;
        });
        elements.filterItemMenu.innerHTML = itemHtml;
    }

    function applyFilters() {
        let filtered = [...allProducts];
        
        // Filter by layanan
        if (selectedLayanan !== 'all') {
            filtered = filtered.filter(p => p.layanan_nama === selectedLayanan);
        }
        
        // Filter by aplikasi
        if (selectedAplikasi !== 'all') {
            filtered = filtered.filter(p => p.aplikasi_nama === selectedAplikasi);
        }
        
        // Filter by item
        if (selectedItem !== 'all') {
            filtered = filtered.filter(p => p.item_nama === selectedItem);
        }
        
        // Apply sorting
        switch (currentSort) {
            case 'terlaris':
                filtered.sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
                break;
            case 'terbaru':
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'harga-rendah':
                filtered.sort((a, b) => (a.item_harga || 0) - (b.item_harga || 0));
                break;
            case 'harga-tinggi':
                filtered.sort((a, b) => (b.item_harga || 0) - (a.item_harga || 0));
                break;
            case 'stok-banyak':
                filtered.sort((a, b) => (b.item_stok?.length || 0) - (a.item_stok?.length || 0));
                break;
            case 'stok-sedikit':
                filtered.sort((a, b) => (a.item_stok?.length || 0) - (b.item_stok?.length || 0));
                break;
        }
        
        filteredProducts = filtered;
        currentPage = 1;
        renderProducts();
        renderPagination();
    }

    function renderProducts() {
        if (filteredProducts.length === 0) {
            elements.productsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: span 2;">
                    <i class="fas fa-box-open"></i>
                    <p>Tidak ada produk</p>
                </div>
            `;
            return;
        }
        
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageProducts = filteredProducts.slice(start, end);
        
        let html = '';
        pageProducts.forEach(product => {
            const stokCount = product.item_stok?.length || 0;
            const isReady = product.item_ready && stokCount > 0;
            
            html += `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-image">
                        ${product.aplikasi_gambar ? 
                            `<img src="${escapeHtml(product.aplikasi_gambar)}" alt="${escapeHtml(product.item_nama)}">` : 
                            `<i class="fas fa-box"></i>`
                        }
                    </div>
                    <div class="product-info">
                        <div class="product-nama">${escapeHtml(product.item_nama || 'Produk')}</div>
                        <div class="product-kategori">${escapeHtml(product.layanan_nama || '')} / ${escapeHtml(product.aplikasi_nama || '')}</div>
                        <div class="product-harga">${formatRupiah(product.item_harga)}</div>
                        <div class="product-stok">
                            <i class="fas fa-cubes"></i>
                            <span>Stok: ${stokCount}</span>
                            ${!isReady ? '<span class="product-badge sold">Sold</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.productsGrid.innerHTML = html;
        
        // Add click handlers
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.id;
                showProductDetail(productId);
            });
        });
    }

    function renderPagination() {
        totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
        
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="prev"><i class="fas fa-chevron-left"></i></button>`;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Next button
        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="next"><i class="fas fa-chevron-right"></i></button>`;
        
        elements.pagination.innerHTML = html;
        
        // Add click handlers
        elements.pagination.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                
                const page = btn.dataset.page;
                if (page === 'prev') {
                    currentPage--;
                } else if (page === 'next') {
                    currentPage++;
                } else {
                    currentPage = parseInt(page);
                }
                
                renderProducts();
                renderPagination();
            });
        });
    }

    function renderAktivitas() {
        // Simulasi aktivitas (nanti diambil dari database)
        const aktivitas = [
            {
                type: 'sold',
                title: 'Produk Terjual',
                desc: 'Canva Pro 1 Tahun',
                time: new Date(Date.now() - 5 * 60000)
            },
            {
                type: 'price',
                title: 'Harga Berubah',
                desc: 'Netflix Premium turun Rp 20.000',
                time: new Date(Date.now() - 2 * 3600000)
            },
            {
                type: 'stock',
                title: 'Stok Ditambahkan',
                desc: 'Spotify Family +5 stok',
                time: new Date(Date.now() - 1 * 86400000)
            }
        ];
        
        let html = '';
        aktivitas.forEach(act => {
            const iconClass = act.type === 'sold' ? 'sold' : act.type === 'price' ? 'price' : '';
            html += `
                <div class="aktivitas-item">
                    <div class="aktivitas-icon ${iconClass}">
                        <i class="fas fa-${act.type === 'sold' ? 'shopping-cart' : act.type === 'price' ? 'tag' : 'cube'}"></i>
                    </div>
                    <div class="aktivitas-content">
                        <div class="aktivitas-title">${act.title}</div>
                        <div class="aktivitas-desc">${act.desc}</div>
                    </div>
                    <div class="aktivitas-time">
                        <i class="far fa-clock"></i>
                        <span>${formatDate(act.time)}</span>
                    </div>
                </div>
            `;
        });
        
        elements.aktivitasList.innerHTML = html;
    }

    function renderPromo() {
        if (!tampilanData || !tampilanData.promos || tampilanData.promos.length === 0) {
            elements.promoBanners.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tags"></i>
                    <p>Belum ada promo</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        tampilanData.promos.forEach(promo => {
            html += `
                <div class="promo-card">
                    <img src="${promo.banner}" alt="${promo.title}">
                    <div class="promo-overlay">
                        <div class="promo-title">${promo.title}</div>
                        <div class="promo-desc">${promo.description || ''}</div>
                    </div>
                </div>
            `;
        });
        
        elements.promoBanners.innerHTML = html;
    }

    function renderVouchers() {
        if (!userClaims || userClaims.length === 0) {
            elements.voucherGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <p>Belum ada voucher</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        userClaims.forEach(claim => {
            const isExpired = claim.expired_at && new Date(claim.expired_at) < new Date();
            html += `
                <div class="voucher-card ${isExpired ? 'expired' : ''}">
                    <div class="voucher-icon">
                        <i class="fas fa-ticket-alt"></i>
                    </div>
                    <div class="voucher-info">
                        <div class="voucher-kode">${claim.kode}</div>
                        <div class="voucher-nama">${claim.nama}</div>
                        ${claim.expired_at ? `
                            <div class="voucher-expiry">
                                <i class="far fa-clock"></i>
                                <span>Berlaku hingga: ${new Date(claim.expired_at).toLocaleDateString('id-ID')}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        elements.voucherGrid.innerHTML = html;
    }

    function renderRekening() {
        if (!paymentData || !paymentData.rekening || paymentData.rekening.length === 0) {
            elements.rekeningGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card"></i>
                    <p>Belum ada rekening</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        paymentData.rekening.forEach(rek => {
            html += `
                <div class="rekening-card">
                    <div class="rekening-logo">
                        <img src="${rek.logo_url}" alt="${rek.nama}">
                    </div>
                    <div class="rekening-info">
                        <div class="rekening-nama">${rek.nama}</div>
                        <div class="rekening-nomor">${rek.nomor}</div>
                        <div class="rekening-pemilik">a.n ${rek.pemilik}</div>
                    </div>
                    <button class="rekening-copy" data-nomor="${rek.nomor}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
        });
        
        elements.rekeningGrid.innerHTML = html;
        
        // Add copy handlers
        document.querySelectorAll('.rekening-copy').forEach(btn => {
            btn.addEventListener('click', () => {
                const nomor = btn.dataset.nomor;
                navigator.clipboard.writeText(nomor).then(() => {
                    showToast('Nomor rekening disalin', 'success');
                });
            });
        });
    }

    function renderGateway() {
        if (!paymentData || !paymentData.gateway || paymentData.gateway.length === 0) {
            elements.gatewaySection.style.display = 'none';
            return;
        }
        
        const gateway = paymentData.gateway[0];
        elements.gatewaySection.style.display = 'block';
        
        elements.gatewayCard.innerHTML = `
            <div class="gateway-qr">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${gateway.qris_id || 'QRIS'}" alt="QRIS">
            </div>
            <div class="gateway-nama">${gateway.nama || 'Cashify'}</div>
            <div class="gateway-expiry">⏱️ Kadaluarsa dalam ${gateway.expired_menit || 30} menit</div>
            <button class="gateway-btn" id="bayarQrisBtn">
                <i class="fas fa-qrcode"></i>
                Bayar via QRIS
            </button>
        `;
        
        document.getElementById('bayarQrisBtn')?.addEventListener('click', () => {
            showToast('Fitur pembayaran akan segera tersedia', 'info');
        });
    }

    function renderForceSubscribe() {
        if (!sosialData || !sosialData.force || sosialData.force.length === 0) {
            elements.forceSubscribeSection.style.display = 'none';
            return;
        }
        
        elements.forceSubscribeSection.style.display = 'block';
        
        let html = '';
        sosialData.force.forEach(force => {
            html += `
                <a href="${force.link}" target="_blank" class="force-item">
                    <div class="force-icon">
                        <i class="fas fa-${force.type === 'channel' ? 'satellite' : 'users'}"></i>
                    </div>
                    <div class="force-info">
                        <div class="force-nama">${force.nama}</div>
                        <div class="force-desc">${force.description || `@${force.username}`}</div>
                    </div>
                    <span class="force-status">Subscribe</span>
                </a>
            `;
        });
        
        elements.forceList.innerHTML = html;
    }

    function renderProfile() {
        if (!currentUser) return;
        
        const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'User';
        const username = currentUser.username ? `@${currentUser.username}` : '@user';
        
        elements.profileName.textContent = fullName;
        elements.profileUsername.textContent = username;
        elements.profileUserId.textContent = currentUser.id;
        
        if (currentUser.photo_url) {
            elements.profileImage.src = currentUser.photo_url;
        } else {
            elements.profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.charAt(0))}&size=80&background=40a7e3&color=fff`;
        }
        
        // Stats (simulasi)
        elements.profileOrders.textContent = '12';
        elements.profileSpent.textContent = formatRupiah(450000);
        elements.profileVouchers.textContent = userClaims.length || '0';
        elements.profileJoined.textContent = '1 Jan 2024';
        elements.profileEmail.textContent = currentUser.email || '-';
        elements.profilePhone.textContent = '-';
    }

    function showProductDetail(productId) {
        showToast('Fitur detail produk akan segera tersedia', 'info');
    }

    // ==================== NAVIGATION ====================
    function setupNavigation() {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const pageId = tab.dataset.page;
                
                // Update active tab
                elements.navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show page
                elements.pages.forEach(page => {
                    page.classList.remove('active');
                });
                document.getElementById(`page-${pageId}`).classList.add('active');
            });
        });
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            // Load user from Telegram
            loadUserFromTelegram();
            
            // Load website data
            await loadWebsite();
            if (!currentWebsite) return;
            
            // Load all data in parallel
            await Promise.all([
                loadTampilan(),
                loadProducts(),
                loadSosialData(),
                loadPaymentData(),
                loadVoucherData()
            ]);
            
            // Render everything
            renderStoreHeader();
            renderBanners();
            renderLayanan();
            renderFilterOptions();
            applyFilters();
            renderAktivitas();
            renderPromo();
            renderVouchers();
            renderRekening();
            renderGateway();
            renderForceSubscribe();
            renderProfile();
            
            // Setup navigation
            setupNavigation();
            
            // Setup banner navigation
            if (elements.bannerPrev) {
                elements.bannerPrev.addEventListener('click', goToPrevBanner);
                elements.bannerNext.addEventListener('click', goToNextBanner);
            }
            
            // Setup banner dots
            document.querySelectorAll('.banner-dot').forEach((dot, index) => {
                dot.addEventListener('click', () => goToBanner(index));
            });
            
            // Setup view all layanan
            if (elements.viewAllLayanan) {
                elements.viewAllLayanan.addEventListener('click', (e) => {
                    e.preventDefault();
                    selectedLayanan = 'all';
                    elements.selectedLayanan.textContent = 'Layanan';
                    applyFilters();
                    
                    // Switch to utama page
                    document.querySelector('[data-page="utama"]').click();
                });
            }
            
            // Setup lihat voucher
            if (elements.lihatVoucherBtn) {
                elements.lihatVoucherBtn.addEventListener('click', () => {
                    elements.voucherSection.style.display = elements.voucherSection.style.display === 'none' ? 'block' : 'none';
                });
            }
            
            // Setup bank actions
            if (elements.depositBtn) {
                elements.depositBtn.addEventListener('click', () => showToast('Fitur deposit akan segera tersedia', 'info'));
                elements.withdrawBtn.addEventListener('click', () => showToast('Fitur withdraw akan segera tersedia', 'info'));
                elements.transferBtn.addEventListener('click', () => showToast('Fitur transfer akan segera tersedia', 'info'));
            }
            
            // Setup logout
            if (elements.logoutBtn) {
                elements.logoutBtn.addEventListener('click', () => {
                    if (window.Telegram?.WebApp) {
                        window.Telegram.WebApp.close();
                    } else {
                        window.location.href = '/';
                    }
                });
            }
            
            // Setup Telegram WebApp
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.expand();
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.enableClosingConfirmation();
            }
            
            console.log('✅ Website initialized successfully');
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat website', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== START ====================
    init();
})();
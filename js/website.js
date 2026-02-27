// website.js - Website Store Front
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    const ITEMS_PER_PAGE = 8;

    // ==================== STATE ====================
    let currentWebsite = null;
    let currentUser = null;
    let tampilanData = {};
    let productsData = [];
    let layananList = [];
    let filteredItems = [];
    let currentPage = 1;
    let totalPages = 1;
    
    // Aktivitas
    let aktivitasList = [];
    
    // Promo
    let promosList = [];
    
    // Bank
    let rekeningList = [];
    let balance = 0;
    let transactions = [];
    
    // Voucher
    let userVouchers = [];
    
    // Filter state
    let currentFilters = {
        layanan: null,
        aplikasi: null,
        search: '',
        sort: 'terbaru'
    };
    
    // Nav scroll state
    let lastScrollTop = 0;
    let scrollTimer = null;
    
    // Banner slider
    let currentBannerIndex = 0;
    let bannerInterval = null;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        storeHeader: document.getElementById('storeHeader'),
        storeLogo: document.getElementById('storeLogo'),
        storeName: document.getElementById('storeName'),
        
        // Banner
        bannerSlider: document.getElementById('bannerSlider'),
        bannerTrack: document.getElementById('bannerTrack'),
        bannerDots: document.getElementById('bannerDots'),
        
        // Main Content
        mainContent: document.getElementById('mainContent'),
        
        // Bottom Nav
        bottomNav: document.getElementById('bottomNav'),
        navItems: document.querySelectorAll('.nav-item'),
        
        // Modal Voucher
        voucherModal: document.getElementById('voucherModal'),
        voucherForm: document.getElementById('voucherForm'),
        voucherCode: document.getElementById('voucherCode'),
        closeVoucherModal: document.getElementById('closeVoucherModal'),
        cancelVoucherBtn: document.getElementById('cancelVoucherBtn'),
        
        // Modal Deposit
        depositModal: document.getElementById('depositModal'),
        depositForm: document.getElementById('depositForm'),
        depositAmount: document.getElementById('depositAmount'),
        paymentMethod: document.getElementById('paymentMethod'),
        closeDepositModal: document.getElementById('closeDepositModal'),
        cancelDepositBtn: document.getElementById('cancelDepositBtn'),
        
        // Modal Withdraw
        withdrawModal: document.getElementById('withdrawModal'),
        withdrawForm: document.getElementById('withdrawForm'),
        withdrawAmount: document.getElementById('withdrawAmount'),
        userBalance: document.getElementById('userBalance'),
        withdrawAccount: document.getElementById('withdrawAccount'),
        closeWithdrawModal: document.getElementById('closeWithdrawModal'),
        cancelWithdrawBtn: document.getElementById('cancelWithdrawBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
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
        if (!angka && angka !== 0) return 'Rp 0';
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatDate(dateString, withTime = true) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (withTime) {
                return date.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ==================== API FUNCTIONS ====================
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

    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                return data.website;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat data website', 'error');
            return null;
        }
    }

    async function loadTampilan() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success && response.tampilan) {
                tampilanData = response.tampilan;
                applyTampilan();
            }
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
        }
    }

    function applyTampilan() {
        // Apply logo
        if (tampilanData.logo && elements.storeLogo) {
            elements.storeLogo.src = tampilanData.logo;
        }
        
        // Apply store name with font and animation
        const storeName = tampilanData.store_display_name || 'Toko Online';
        if (elements.storeName) {
            elements.storeName.textContent = storeName;
            
            // Apply font family
            if (tampilanData.font_family) {
                elements.storeName.style.fontFamily = `'${tampilanData.font_family}', sans-serif`;
            }
            
            // Apply font size
            if (tampilanData.font_size) {
                elements.storeName.style.fontSize = `${tampilanData.font_size}px`;
            }
            
            // Apply animation
            if (tampilanData.font_animation && tampilanData.font_animation !== 'none') {
                const animName = tampilanData.font_animation + 'Anim';
                const duration = tampilanData.animation_duration || 2;
                const delay = tampilanData.animation_delay || 0;
                const iteration = tampilanData.animation_iteration || 'infinite';
                
                elements.storeName.style.animation = `${animName} ${duration}s ${delay}s ${iteration}`;
            }
        }
        
        // Apply header border color
        if (tampilanData.colors && tampilanData.colors.primary && elements.storeHeader) {
            elements.storeHeader.style.borderColor = tampilanData.colors.primary;
        }
    }

    async function loadUserFromTelegram() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            currentUser = window.Telegram.WebApp.initDataUnsafe.user;
            console.log('📱 Telegram user:', currentUser);
            
            // Cek apakah user sudah memiliki data di sistem
            await checkOrCreateUser();
            
            return currentUser;
        } else {
            // Untuk testing - buat user dummy
            currentUser = {
                id: Math.floor(Math.random() * 1000000),
                first_name: 'User',
                last_name: '',
                username: 'user_' + Math.floor(Math.random() * 1000),
                photo_url: null
            };
            return currentUser;
        }
    }

    async function checkOrCreateUser() {
        if (!currentWebsite || !currentUser) return;
        
        // Implementasi jika perlu menyimpan user ke database
        // Untuk sekarang, kita anggap user sudah ada
    }

    async function loadAllData() {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            // Load products
            const productsResponse = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (productsResponse.success) {
                productsData = productsResponse.data || [];
                extractLayananList();
                extractAllItems();
            }
            
            // Load promos
            const promosResponse = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/promos`, {
                method: 'GET'
            });
            
            if (promosResponse.success) {
                promosList = promosResponse.promos || [];
            }
            
            // Load rekening
            const rekeningResponse = await fetchWithRetry(`${API_BASE_URL}/api/payments/rekening/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (rekeningResponse.success) {
                rekeningList = rekeningResponse.rekening || [];
            }
            
            // Load user vouchers jika user sudah login
            if (currentUser) {
                const vouchersResponse = await fetchWithRetry(`${API_BASE_URL}/api/voucher/user/${currentUser.id}?website_id=${currentWebsite.id}`, {
                    method: 'GET'
                });
                
                if (vouchersResponse.success) {
                    userVouchers = vouchersResponse.claims || [];
                }
            }
            
            // Generate dummy aktivitas
            generateDummyAktivitas();
            
            // Generate dummy transactions
            generateDummyTransactions();
            
            // Render halaman awal
            renderHomePage();
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    function extractLayananList() {
        const seen = new Set();
        layananList = [];
        
        productsData.forEach(layanan => {
            if (layanan.layanan_nama && !seen.has(layanan.layanan_nama)) {
                seen.add(layanan.layanan_nama);
                layananList.push({
                    nama: layanan.layanan_nama,
                    gambar: layanan.layanan_gambar,
                    desc: layanan.layanan_desc,
                    count: layanan.aplikasi ? layanan.aplikasi.length : 0
                });
            }
        });
        
        // Batasi 4 layanan untuk tampilan
        if (layananList.length > 4) {
            layananList = layananList.slice(0, 4);
        }
    }

    function extractAllItems() {
        filteredItems = [];
        
        productsData.forEach(layanan => {
            if (layanan.aplikasi) {
                layanan.aplikasi.forEach(aplikasi => {
                    if (aplikasi.items) {
                        aplikasi.items.forEach(item => {
                            filteredItems.push({
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
        
        applySort();
        updatePagination();
    }

    function generateDummyAktivitas() {
        aktivitasList = [];
        const now = new Date();
        
        // Generate 20 aktivitas dummy
        for (let i = 0; i < 20; i++) {
            const date = new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000);
            const type = Math.random() > 0.5 ? 'pembelian' : 'aktivitas_lain';
            
            aktivitasList.push({
                id: i,
                type: type,
                title: type === 'pembelian' ? 'Pembelian Produk' : 'Aktivitas Lain',
                description: type === 'pembelian' ? 
                    `Membeli produk seharga ${formatRupiah(Math.floor(Math.random() * 100000) + 10000)}` :
                    `Melakukan ${['deposit', 'withdraw', 'klaim voucher', 'ubah profil'][Math.floor(Math.random() * 4)]}`,
                time: date.toISOString(),
                icon: type === 'pembelian' ? 'fa-shopping-cart' : 'fa-history'
            });
        }
        
        // Sort by time descending
        aktivitasList.sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    function generateDummyTransactions() {
        transactions = [];
        const now = new Date();
        const types = ['deposit', 'withdraw', 'pembelian'];
        const statuses = ['success', 'pending', 'failed'];
        
        for (let i = 0; i < 15; i++) {
            const date = new Date(now - Math.random() * 60 * 24 * 60 * 60 * 1000);
            const type = types[Math.floor(Math.random() * types.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const amount = Math.floor(Math.random() * 1000000) + 10000;
            
            if (type === 'deposit' && status === 'success') {
                balance += amount;
            } else if (type === 'withdraw' && status === 'success') {
                balance -= amount;
            }
            
            transactions.push({
                id: i,
                type: type,
                status: status,
                amount: amount,
                description: type === 'deposit' ? 'Deposit Saldo' : 
                            type === 'withdraw' ? 'Withdraw Saldo' : 'Pembelian Produk',
                time: date.toISOString()
            });
        }
        
        // Sort by time descending
        transactions.sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    // ==================== FILTER & SORT FUNCTIONS ====================
    function applyFilters() {
        let filtered = [...filteredItems];
        
        // Filter by layanan
        if (currentFilters.layanan) {
            filtered = filtered.filter(item => item.layanan_nama === currentFilters.layanan);
        }
        
        // Filter by aplikasi
        if (currentFilters.aplikasi) {
            filtered = filtered.filter(item => item.aplikasi_nama === currentFilters.aplikasi);
        }
        
        // Filter by search
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            filtered = filtered.filter(item => 
                (item.item_nama && item.item_nama.toLowerCase().includes(searchLower)) ||
                (item.layanan_nama && item.layanan_nama.toLowerCase().includes(searchLower)) ||
                (item.aplikasi_nama && item.aplikasi_nama.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply sort
        switch (currentFilters.sort) {
            case 'terlaris':
                filtered.sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
                break;
            case 'terbaru':
                filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                break;
            case 'termurah':
                filtered.sort((a, b) => (a.item_harga || 0) - (b.item_harga || 0));
                break;
            case 'termahal':
                filtered.sort((a, b) => (b.item_harga || 0) - (a.item_harga || 0));
                break;
            case 'stok-terbanyak':
                filtered.sort((a, b) => (b.item_stok?.length || 0) - (a.item_stok?.length || 0));
                break;
            case 'stok-tersedikit':
                filtered.sort((a, b) => (a.item_stok?.length || 0) - (b.item_stok?.length || 0));
                break;
        }
        
        filteredItems = filtered;
        updatePagination();
    }

    function applySort() {
        switch (currentFilters.sort) {
            case 'terlaris':
                filteredItems.sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
                break;
            case 'terbaru':
                filteredItems.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                break;
            case 'termurah':
                filteredItems.sort((a, b) => (a.item_harga || 0) - (b.item_harga || 0));
                break;
            case 'termahal':
                filteredItems.sort((a, b) => (b.item_harga || 0) - (a.item_harga || 0));
                break;
            case 'stok-terbanyak':
                filteredItems.sort((a, b) => (b.item_stok?.length || 0) - (a.item_stok?.length || 0));
                break;
            case 'stok-tersedikit':
                filteredItems.sort((a, b) => (a.item_stok?.length || 0) - (b.item_stok?.length || 0));
                break;
        }
    }

    function updatePagination() {
        totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderBanners() {
        if (!elements.bannerTrack || !elements.bannerDots) return;
        
        const banners = tampilanData.banners || [];
        
        if (banners.length === 0) {
            // Banner default
            elements.bannerTrack.innerHTML = `
                <div class="banner-slide" style="background-image: url('https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Welcome+to+Store')"></div>
            `;
            elements.bannerDots.innerHTML = '<span class="banner-dot active"></span>';
            return;
        }
        
        let trackHtml = '';
        let dotsHtml = '';
        
        banners.forEach((banner, index) => {
            const url = typeof banner === 'string' ? banner : banner.url;
            const positionX = banner.positionX || 50;
            const positionY = banner.positionY || 50;
            
            trackHtml += `
                <div class="banner-slide" style="background-image: url('${url}'); background-position: ${positionX}% ${positionY}%;"></div>
            `;
            
            dotsHtml += `<span class="banner-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`;
        });
        
        elements.bannerTrack.innerHTML = trackHtml;
        elements.bannerDots.innerHTML = dotsHtml;
        
        // Start auto slide
        startBannerSlider();
        
        // Add click handlers for dots
        document.querySelectorAll('.banner-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                goToBanner(index);
            });
        });
    }

    function startBannerSlider() {
        if (bannerInterval) clearInterval(bannerInterval);
        
        const banners = tampilanData.banners || [];
        if (banners.length <= 1) return;
        
        bannerInterval = setInterval(() => {
            currentBannerIndex = (currentBannerIndex + 1) % banners.length;
            updateBannerPosition();
        }, 5000);
    }

    function goToBanner(index) {
        currentBannerIndex = index;
        updateBannerPosition();
        
        // Reset interval
        if (bannerInterval) {
            clearInterval(bannerInterval);
            startBannerSlider();
        }
    }

    function updateBannerPosition() {
        if (!elements.bannerTrack) return;
        elements.bannerTrack.style.transform = `translateX(-${currentBannerIndex * 100}%)`;
        
        // Update dots
        document.querySelectorAll('.banner-dot').forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentBannerIndex);
        });
    }

    function renderHomePage() {
        const html = `
            <div class="page-content">
                <!-- Produk Layanan Section -->
                <div class="section-title">
                    <h2><i class="fas fa-layer-group"></i> Produk Layanan</h2>
                    <span class="view-all" onclick="window.website.showAllLayanan()">
                        Lihat semua <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
                
                <div class="layanan-grid" id="layananGrid">
                    ${renderLayananGrid()}
                </div>
                
                <!-- Filter Section -->
                <div class="filter-section" id="filterSection">
                    <div class="filter-header" onclick="window.website.toggleFilter()">
                        <h3><i class="fas fa-filter"></i> Filter & Sortir</h3>
                        <i class="fas fa-chevron-down" id="filterChevron"></i>
                    </div>
                    <div class="filter-content" id="filterContent">
                        <div class="filter-bubbles" id="layananFilter"></div>
                        <div class="filter-bubbles" id="aplikasiFilter"></div>
                        <select class="sort-select" id="sortSelect">
                            <option value="terbaru">Terbaru</option>
                            <option value="terlaris">Terlaris</option>
                            <option value="termurah">Termurah</option>
                            <option value="termahal">Termahal</option>
                            <option value="stok-terbanyak">Stok Terbanyak</option>
                            <option value="stok-tersedikit">Stok Tersedikit</option>
                        </select>
                    </div>
                </div>
                
                <!-- Produk Tersedia Section -->
                <div class="section-title">
                    <h2><i class="fas fa-box"></i> Produk Tersedia</h2>
                </div>
                
                <div class="products-grid" id="productsGrid">
                    ${renderProductsGrid()}
                </div>
                
                <!-- Pagination -->
                <div class="pagination" id="pagination">
                    ${renderPagination()}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
        
        // Render filter bubbles
        renderFilterBubbles();
        
        // Add event listener for sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = currentFilters.sort;
            sortSelect.addEventListener('change', (e) => {
                currentFilters.sort = e.target.value;
                applySort();
                renderHomePage();
            });
        }
    }

    function renderLayananGrid() {
        if (layananList.length === 0) {
            return '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Belum ada layanan</p></div>';
        }
        
        return layananList.map(layanan => `
            <div class="layanan-card" onclick="window.website.filterByLayanan('${escapeHtml(layanan.nama)}')">
                <div class="layanan-icon">
                    ${layanan.gambar ? 
                        `<img src="${escapeHtml(layanan.gambar)}" alt="${escapeHtml(layanan.nama)}">` : 
                        `<i class="fas fa-layer-group"></i>`
                    }
                </div>
                <div class="layanan-nama">${escapeHtml(layanan.nama)}</div>
                <div class="layanan-count">${layanan.count} aplikasi</div>
            </div>
        `).join('');
    }

    function renderFilterBubbles() {
        // Layanan filter
        const layananFilter = document.getElementById('layananFilter');
        if (layananFilter) {
            let html = '';
            const uniqueLayanan = [...new Set(productsData.map(l => l.layanan_nama))];
            
            uniqueLayanan.forEach(layanan => {
                if (layanan) {
                    html += `
                        <span class="filter-bubble ${currentFilters.layanan === layanan ? 'active' : ''}" 
                              onclick="window.website.toggleLayananFilter('${escapeHtml(layanan)}')">
                            ${escapeHtml(layanan)}
                        </span>
                    `;
                }
            });
            
            layananFilter.innerHTML = html || '<span class="filter-bubble">Tidak ada layanan</span>';
        }
        
        // Aplikasi filter (ditampilkan jika layanan dipilih)
        const aplikasiFilter = document.getElementById('aplikasiFilter');
        if (aplikasiFilter) {
            if (currentFilters.layanan) {
                const layananData = productsData.find(l => l.layanan_nama === currentFilters.layanan);
                const aplikasiList = layananData?.aplikasi || [];
                const uniqueAplikasi = [...new Set(aplikasiList.map(a => a.aplikasi_nama))];
                
                let html = '';
                uniqueAplikasi.forEach(aplikasi => {
                    if (aplikasi) {
                        html += `
                            <span class="filter-bubble ${currentFilters.aplikasi === aplikasi ? 'active' : ''}" 
                                  onclick="window.website.toggleAplikasiFilter('${escapeHtml(aplikasi)}')">
                                ${escapeHtml(aplikasi)}
                            </span>
                        `;
                    }
                });
                
                aplikasiFilter.innerHTML = html || '<span class="filter-bubble">Tidak ada aplikasi</span>';
            } else {
                aplikasiFilter.innerHTML = '';
            }
        }
    }

    function renderProductsGrid() {
        if (filteredItems.length === 0) {
            return '<div class="empty-state"><i class="fas fa-box-open"></i><p>Tidak ada produk</p></div>';
        }
        
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = filteredItems.slice(start, end);
        
        return pageItems.map(item => {
            const readyClass = item.item_ready ? 'ready' : 'sold';
            const logo = item.aplikasi_gambar || item.layanan_gambar;
            const durasi = item.item_durasi_jumlah ? `${item.item_durasi_jumlah} ${item.item_durasi_satuan}` : '';
            const stokCount = item.item_stok?.length || 0;
            
            return `
                <div class="product-card ${!item.item_ready ? 'sold' : ''}" onclick="window.website.viewProduct(${item.id})">
                    <div class="product-badge ${readyClass}">
                        ${item.item_ready ? 'Ready' : 'Sold'}
                    </div>
                    <div class="product-logo">
                        ${logo ? 
                            `<img src="${escapeHtml(logo)}" alt="${escapeHtml(item.item_nama)}">` : 
                            `<i class="fas fa-box"></i>`
                        }
                    </div>
                    <div class="product-info">
                        <div class="product-nama">${escapeHtml(item.item_nama || 'Produk')}</div>
                        <div class="product-category">${escapeHtml(item.aplikasi_nama || '')}</div>
                    </div>
                    <div class="product-harga">${formatRupiah(item.item_harga)}</div>
                    ${durasi ? `<div class="product-durasi">⏱️ ${escapeHtml(durasi)}</div>` : ''}
                    ${item.item_metode === 'request' ? 
                        `<div class="product-stok"><i class="fas fa-clipboard-list"></i> Request</div>` : 
                        `<div class="product-stok"><i class="fas fa-cubes"></i> Stok: ${stokCount}</div>`
                    }
                </div>
            `;
        }).join('');
    }

    function renderPagination() {
        if (totalPages <= 1) return '';
        
        let html = '';
        
        // Previous button
        html += `
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.website.goToPage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        html += '<div class="page-numbers">';
        
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (startPage > 1) {
            html += `<button class="page-number" onclick="window.website.goToPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span class="page-number" style="background: transparent;">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="window.website.goToPage(${i})">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="page-number" style="background: transparent;">...</span>`;
            }
            html += `<button class="page-number" onclick="window.website.goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        html += '</div>';
        
        // Next button
        html += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.website.goToPage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        return html;
    }

    function renderAktivitasPage() {
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-history"></i> Aktivitas Terkini</h2>
                </div>
                
                <div class="aktivitas-timeline">
                    ${renderAktivitasList()}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
    }

    function renderAktivitasList() {
        if (aktivitasList.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada aktivitas</p></div>';
        }
        
        return aktivitasList.slice(0, 30).map(aktivitas => `
            <div class="aktivitas-item">
                <div class="aktivitas-icon">
                    <i class="fas ${aktivitas.icon}"></i>
                </div>
                <div class="aktivitas-content">
                    <div class="aktivitas-title">${escapeHtml(aktivitas.title)}</div>
                    <div class="aktivitas-meta">
                        <span class="aktivitas-time">
                            <i class="far fa-clock"></i> ${formatDate(aktivitas.time)}
                        </span>
                    </div>
                    <div class="aktivitas-desc" style="font-size: 12px; color: var(--tg-hint-color); margin-top: 4px;">
                        ${escapeHtml(aktivitas.description)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderPromoPage() {
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-bullhorn"></i> Promo Spesial</h2>
                </div>
                
                <div class="promo-actions" style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button class="btn-primary" style="flex: 1;" onclick="window.website.openVoucherModal()">
                        <i class="fas fa-ticket-alt"></i> Klaim Voucher
                    </button>
                    <button class="btn-secondary" style="flex: 1;" onclick="window.website.showMyVouchers()">
                        <i class="fas fa-gift"></i> Voucher Saya (${userVouchers.length})
                    </button>
                </div>
                
                <div class="promo-grid">
                    ${renderPromoList()}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
    }

    function renderPromoList() {
        if (promosList.length === 0) {
            return '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Belum ada promo</p></div>';
        }
        
        return promosList.map(promo => {
            const expiryText = promo.never_end ? 
                'Tidak ada batas waktu' : 
                `Berakhir: ${formatDate(promo.end_date + 'T' + (promo.end_time || '23:59'), true)}`;
            
            return `
                <div class="promo-card">
                    <div class="promo-banner">
                        <img src="${escapeHtml(promo.banner || 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo')}" 
                             alt="${escapeHtml(promo.title)}"
                             onerror="this.src='https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo';">
                    </div>
                    <div class="promo-content">
                        <h3 class="promo-title">${escapeHtml(promo.title)}</h3>
                        ${promo.description ? `<p class="promo-description">${escapeHtml(promo.description)}</p>` : ''}
                        <div class="promo-footer">
                            <span class="promo-expiry">
                                <i class="far fa-clock"></i> ${expiryText}
                            </span>
                        </div>
                        ${promo.notes ? `
                            <div class="promo-notes">
                                <i class="fas fa-sticky-note"></i> ${escapeHtml(promo.notes)}
                            </div>
                        ` : ''}
                        <div class="promo-actions">
                            <button class="promo-btn" onclick="window.website.claimPromo(${promo.id})">
                                <i class="fas fa-tag"></i> Klaim Promo
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderBankPage() {
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-university"></i> Bank & Deposit</h2>
                </div>
                
                <!-- Balance Card -->
                <div class="balance-card">
                    <div class="balance-label">Saldo Anda</div>
                    <div class="balance-amount" id="balanceAmount">${formatRupiah(balance)}</div>
                    <div class="balance-actions">
                        <button class="balance-btn" onclick="window.website.openDepositModal()">
                            <i class="fas fa-plus-circle"></i> Deposit
                        </button>
                        <button class="balance-btn" onclick="window.website.openWithdrawModal()">
                            <i class="fas fa-minus-circle"></i> Withdraw
                        </button>
                    </div>
                </div>
                
                <!-- Rekening Tersedia -->
                <div class="section-title" style="margin-top: 16px;">
                    <h3><i class="fas fa-credit-card"></i> Rekening Tersedia</h3>
                </div>
                
                <div class="rekening-grid">
                    ${renderRekeningList()}
                </div>
                
                <!-- Riwayat Transaksi -->
                <div class="transaction-history">
                    <div class="transaction-header">
                        <h3><i class="fas fa-history"></i> Riwayat Transaksi</h3>
                    </div>
                    <div class="transaction-list">
                        ${renderTransactionList()}
                    </div>
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
        
        // Populate payment method select
        populatePaymentMethod();
        
        // Populate withdraw account select
        populateWithdrawAccount();
    }

    function renderRekeningList() {
        if (rekeningList.length === 0) {
            return '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-university"></i><p>Belum ada rekening</p></div>';
        }
        
        return rekeningList.map(rek => `
            <div class="rekening-card">
                <div class="rekening-logo">
                    <img src="${escapeHtml(rek.logo_url)}" alt="${escapeHtml(rek.nama)}"
                         onerror="this.src='https://via.placeholder.com/40x40/40a7e3/ffffff?text=${escapeHtml(rek.nama.charAt(0))}';">
                </div>
                <div class="rekening-info">
                    <div class="rekening-nama">${escapeHtml(rek.nama)}</div>
                    <div class="rekening-nomor">${escapeHtml(rek.nomor)}</div>
                    <div style="font-size: 9px; color: var(--tg-hint-color);">${escapeHtml(rek.pemilik)}</div>
                </div>
            </div>
        `).join('');
    }

    function renderTransactionList() {
        if (transactions.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada transaksi</p></div>';
        }
        
        return transactions.slice(0, 10).map(trx => {
            const amountClass = trx.type === 'deposit' ? 'positive' : (trx.type === 'withdraw' ? 'negative' : '');
            const amountPrefix = trx.type === 'deposit' ? '+' : (trx.type === 'withdraw' ? '-' : '');
            const iconClass = trx.type === 'deposit' ? 'fa-arrow-down' : 
                             (trx.type === 'withdraw' ? 'fa-arrow-up' : 'fa-shopping-cart');
            
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-icon">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="transaction-details">
                            <h4>${escapeHtml(trx.description)}</h4>
                            <span>${formatDate(trx.time)} • ${trx.status}</span>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix} ${formatRupiah(trx.amount)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function populatePaymentMethod() {
        const select = elements.paymentMethod;
        if (!select) return;
        
        let options = '<option value="">-- Pilih Metode --</option>';
        
        rekeningList.forEach(rek => {
            options += `<option value="${rek.id}">${escapeHtml(rek.nama)} - ${escapeHtml(rek.nomor)}</option>`;
        });
        
        select.innerHTML = options;
    }

    function populateWithdrawAccount() {
        const select = elements.withdrawAccount;
        if (!select) return;
        
        let options = '<option value="">-- Pilih Rekening --</option>';
        
        // Untuk demo, kita pakai rekening yang sama
        rekeningList.forEach(rek => {
            options += `<option value="${rek.id}">${escapeHtml(rek.nama)} - ${escapeHtml(rek.nomor)}</option>`;
        });
        
        select.innerHTML = options;
    }

    function renderProfilePage() {
        const fullName = currentUser ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') : 'User';
        const username = currentUser?.username ? `@${currentUser.username}` : '@user';
        const avatarUrl = currentUser?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.charAt(0))}&size=80&background=40a7e3&color=fff`;
        
        const html = `
            <div class="page-content">
                <!-- Profile Header -->
                <div class="profile-header">
                    <div class="profile-avatar">
                        <img src="${avatarUrl}" alt="Profile">
                    </div>
                    <div class="profile-name">${escapeHtml(fullName)}</div>
                    <div class="profile-username">${escapeHtml(username)}</div>
                    <div class="profile-badge">
                        <i class="fas fa-id-card"></i> ID: ${currentUser?.id || '-'}
                    </div>
                </div>
                
                <!-- Stats -->
                <div class="profile-stats">
                    <div class="profile-stat">
                        <span class="stat-value">${userVouchers.length}</span>
                        <span class="stat-label">Voucher</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-value">${transactions.filter(t => t.type === 'pembelian').length}</span>
                        <span class="stat-label">Pembelian</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-value">${formatRupiah(balance)}</span>
                        <span class="stat-label">Saldo</span>
                    </div>
                </div>
                
                <!-- Menu -->
                <div class="profile-menu">
                    <div class="profile-menu-item" onclick="window.website.showMyVouchers()">
                        <div class="menu-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="menu-info">
                            <div class="menu-title">Voucher Saya</div>
                            <div class="menu-subtitle">${userVouchers.length} voucher tersedia</div>
                        </div>
                        <div class="menu-value">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                    
                    <div class="profile-menu-item" onclick="window.website.showTransactionHistory()">
                        <div class="menu-icon">
                            <i class="fas fa-history"></i>
                        </div>
                        <div class="menu-info">
                            <div class="menu-title">Riwayat Transaksi</div>
                            <div class="menu-subtitle">Lihat semua transaksi</div>
                        </div>
                        <div class="menu-value">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                    
                    <div class="profile-menu-item" onclick="window.website.openSettings()">
                        <div class="menu-icon">
                            <i class="fas fa-cog"></i>
                        </div>
                        <div class="menu-info">
                            <div class="menu-title">Pengaturan Akun</div>
                            <div class="menu-subtitle">Atur preferensi Anda</div>
                        </div>
                        <div class="menu-value">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                    
                    <div class="profile-menu-item" onclick="window.website.logout()">
                        <div class="menu-icon">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <div class="menu-info">
                            <div class="menu-title">Keluar</div>
                            <div class="menu-subtitle">Kembali ke Telegram</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
    }

    // ==================== NAVIGATION FUNCTIONS ====================
    function changePage(page) {
        elements.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        switch (page) {
            case 'home':
                renderHomePage();
                break;
            case 'aktivitas':
                renderAktivitasPage();
                break;
            case 'promo':
                renderPromoPage();
                break;
            case 'bank':
                renderBankPage();
                break;
            case 'profile':
                renderProfilePage();
                break;
        }
        
        vibrate(10);
    }

    function initNavScroll() {
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scroll down - hide nav
                elements.bottomNav.classList.add('hidden');
            } else {
                // Scroll up - show nav
                elements.bottomNav.classList.remove('hidden');
            }
            
            lastScrollTop = scrollTop;
            
            // Clear previous timer
            if (scrollTimer) clearTimeout(scrollTimer);
            
            // Set timer to show nav when stopped scrolling
            scrollTimer = setTimeout(() => {
                elements.bottomNav.classList.remove('hidden');
            }, 150);
        });
    }

    // ==================== FILTER ACTIONS ====================
    function toggleFilter() {
        const filterContent = document.getElementById('filterContent');
        const chevron = document.getElementById('filterChevron');
        
        if (filterContent && chevron) {
            filterContent.classList.toggle('open');
            chevron.style.transform = filterContent.classList.contains('open') ? 'rotate(180deg)' : '';
        }
    }

    function toggleLayananFilter(layanan) {
        if (currentFilters.layanan === layanan) {
            currentFilters.layanan = null;
            currentFilters.aplikasi = null;
        } else {
            currentFilters.layanan = layanan;
            currentFilters.aplikasi = null;
        }
        
        currentPage = 1;
        applyFilters();
        renderHomePage();
    }

    function toggleAplikasiFilter(aplikasi) {
        if (currentFilters.aplikasi === aplikasi) {
            currentFilters.aplikasi = null;
        } else {
            currentFilters.aplikasi = aplikasi;
        }
        
        currentPage = 1;
        applyFilters();
        renderHomePage();
    }

    function filterByLayanan(layanan) {
        currentFilters.layanan = layanan;
        currentFilters.aplikasi = null;
        currentPage = 1;
        applyFilters();
        renderHomePage();
    }

    function showAllLayanan() {
        currentFilters.layanan = null;
        currentFilters.aplikasi = null;
        currentPage = 1;
        applyFilters();
        renderHomePage();
    }

    function goToPage(page) {
        currentPage = page;
        renderHomePage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==================== PRODUCT ACTIONS ====================
    function viewProduct(productId) {
        const product = filteredItems.find(p => p.id === productId);
        if (!product) return;
        
        // Implementasi view product detail
        showToast(`Melihat detail produk: ${product.item_nama}`, 'info');
        
        // Bisa redirect ke halaman detail produk
        // window.location.href = `/wtb/html/produk-detail.html?website=${currentWebsite?.endpoint}&id=${productId}`;
    }

    // ==================== PROMO ACTIONS ====================
    function openVoucherModal() {
        elements.voucherModal.classList.add('active');
    }

    function closeVoucherModal() {
        elements.voucherModal.classList.remove('active');
        elements.voucherCode.value = '';
    }

    async function claimVoucher(e) {
        e.preventDefault();
        
        const code = elements.voucherCode.value.trim();
        
        if (!code) {
            showToast('Masukkan kode voucher', 'warning');
            return;
        }
        
        if (!currentUser) {
            showToast('Silakan login terlebih dahulu', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/claim`, {
                method: 'POST',
                body: JSON.stringify({
                    website_id: currentWebsite.id,
                    kode: code,
                    user_id: currentUser.id,
                    username: currentUser.username,
                    name: currentUser.first_name + (currentUser.last_name ? ' ' + currentUser.last_name : '')
                })
            });
            
            if (response.success) {
                showToast('✅ Voucher berhasil diklaim!', 'success');
                closeVoucherModal();
                
                // Reload user vouchers
                const vouchersResponse = await fetchWithRetry(`${API_BASE_URL}/api/voucher/user/${currentUser.id}?website_id=${currentWebsite.id}`, {
                    method: 'GET'
                });
                
                if (vouchersResponse.success) {
                    userVouchers = vouchersResponse.claims || [];
                }
                
                // Tambah aktivitas
                aktivitasList.unshift({
                    id: aktivitasList.length + 1,
                    type: 'aktivitas_lain',
                    title: 'Klaim Voucher',
                    description: `Berhasil mengklaim voucher dengan kode ${code}`,
                    time: new Date().toISOString(),
                    icon: 'fa-ticket-alt'
                });
                
            } else {
                showToast(response.message || 'Gagal mengklaim voucher', 'error');
            }
        } catch (error) {
            console.error('❌ Error claiming voucher:', error);
            showToast('Gagal mengklaim voucher', 'error');
        } finally {
            showLoading(false);
        }
    }

    function showMyVouchers() {
        if (userVouchers.length === 0) {
            showToast('Anda belum memiliki voucher', 'info');
            return;
        }
        
        // Implementasi tampil daftar voucher
        let message = 'Voucher Saya:\n';
        userVouchers.forEach(v => {
            message += `\n• ${v.nama} (${v.kode}) - ${v.used ? 'Sudah digunakan' : 'Belum digunakan'}`;
        });
        
        showToast(message, 'info', 5000);
    }

    function claimPromo(promoId) {
        const promo = promosList.find(p => p.id == promoId);
        if (!promo) return;
        
        showToast(`Promo: ${promo.title}`, 'info');
        // Implementasi klaim promo
    }

    // ==================== BANK ACTIONS ====================
    function openDepositModal() {
        elements.depositModal.classList.add('active');
    }

    function closeDepositModal() {
        elements.depositModal.classList.remove('active');
        elements.depositForm.reset();
    }

    async function deposit(e) {
        e.preventDefault();
        
        const amount = parseInt(elements.depositAmount.value);
        const method = elements.paymentMethod.value;
        
        if (!amount || amount < 10000) {
            showToast('Minimal deposit Rp 10.000', 'warning');
            return;
        }
        
        if (!method) {
            showToast('Pilih metode pembayaran', 'warning');
            return;
        }
        
        showToast('Fitur deposit akan segera tersedia', 'info');
        closeDepositModal();
    }

    function openWithdrawModal() {
        if (balance < 50000) {
            showToast('Minimal withdraw Rp 50.000', 'warning');
            return;
        }
        
        elements.withdrawAmount.max = balance;
        elements.userBalance.textContent = formatRupiah(balance);
        elements.withdrawModal.classList.add('active');
    }

    function closeWithdrawModal() {
        elements.withdrawModal.classList.remove('active');
        elements.withdrawForm.reset();
    }

    async function withdraw(e) {
        e.preventDefault();
        
        const amount = parseInt(elements.withdrawAmount.value);
        const account = elements.withdrawAccount.value;
        
        if (!amount || amount < 50000) {
            showToast('Minimal withdraw Rp 50.000', 'warning');
            return;
        }
        
        if (amount > balance) {
            showToast('Saldo tidak mencukupi', 'warning');
            return;
        }
        
        if (!account) {
            showToast('Pilih rekening tujuan', 'warning');
            return;
        }
        
        showToast('Fitur withdraw akan segera tersedia', 'info');
        closeWithdrawModal();
    }

    function showTransactionHistory() {
        // Bisa redirect ke halaman riwayat transaksi
        changePage('bank');
    }

    // ==================== PROFILE ACTIONS ====================
    function openSettings() {
        showToast('Fitur pengaturan akan segera tersedia', 'info');
    }

    function logout() {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.close();
        } else {
            window.location.href = '/';
        }
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadUserFromTelegram();
            await loadTampilan();
            await loadAllData();
            
            // Render banners
            renderBanners();
            
            // Render home page
            renderHomePage();
            
            // Setup navigation
            elements.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    changePage(item.dataset.page);
                });
            });
            
            // Setup scroll hide nav
            initNavScroll();
            
            // Setup modal forms
            if (elements.voucherForm) {
                elements.voucherForm.addEventListener('submit', claimVoucher);
            }
            
            if (elements.closeVoucherModal) {
                elements.closeVoucherModal.addEventListener('click', closeVoucherModal);
            }
            
            if (elements.cancelVoucherBtn) {
                elements.cancelVoucherBtn.addEventListener('click', closeVoucherModal);
            }
            
            if (elements.depositForm) {
                elements.depositForm.addEventListener('submit', deposit);
            }
            
            if (elements.closeDepositModal) {
                elements.closeDepositModal.addEventListener('click', closeDepositModal);
            }
            
            if (elements.cancelDepositBtn) {
                elements.cancelDepositBtn.addEventListener('click', closeDepositModal);
            }
            
            if (elements.withdrawForm) {
                elements.withdrawForm.addEventListener('submit', withdraw);
            }
            
            if (elements.closeWithdrawModal) {
                elements.closeWithdrawModal.addEventListener('click', closeWithdrawModal);
            }
            
            if (elements.cancelWithdrawBtn) {
                elements.cancelWithdrawBtn.addEventListener('click', closeWithdrawModal);
            }
            
            // Close modals on outside click
            window.addEventListener('click', (e) => {
                if (e.target === elements.voucherModal) closeVoucherModal();
                if (e.target === elements.depositModal) closeDepositModal();
                if (e.target === elements.withdrawModal) closeWithdrawModal();
            });
            
            console.log('✅ Website initialized');
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat website', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.website = {
        // Navigation
        changePage,
        
        // Filter
        toggleFilter,
        toggleLayananFilter,
        toggleAplikasiFilter,
        filterByLayanan,
        showAllLayanan,
        
        // Pagination
        goToPage,
        
        // Products
        viewProduct,
        
        // Promo
        openVoucherModal,
        showMyVouchers,
        claimPromo,
        
        // Bank
        openDepositModal,
        openWithdrawModal,
        showTransactionHistory,
        
        // Profile
        openSettings,
        logout
    };

    // ==================== START ====================
    init();
})();
// website.js - Website Store Front (COMPLETE FIXED VERSION)
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = (function() {
        if (window.location.hostname.includes('github.io')) {
            return 'https://supports-lease-honest-potter.trycloudflare.com';
        }
        return 'http://localhost:5050';
    })();
    
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
    let selectedTransaction = null;
    let transactionFilterOpen = false;

    // Loading states
    let loadingStates = {
        user: 'loading',
        website: 'loading',
        tampilan: 'loading',
        products: 'loading',
        promos: 'loading',
        rekening: 'loading',
        transactions: 'loading',
        vouchers: 'loading',
        activities: 'loading'
    };

    // Data dummy
    const dummyData = {
        layanan: [
            { nama: 'Loading...', gambar: null, count: 0 },
            { nama: 'Loading...', gambar: null, count: 0 },
            { nama: 'Loading...', gambar: null, count: 0 },
            { nama: 'Loading...', gambar: null, count: 0 }
        ],
        products: Array(6).fill().map((_, i) => ({
            id: `dummy-${i}`,
            item_nama: 'Memuat produk...',
            aplikasi_nama: 'Loading...',
            item_harga: 0,
            item_ready: true,
            item_metode: 'directly',
            item_stok: []
        })),
        rekening: Array(4).fill().map((_, i) => ({
            id: `dummy-${i}`,
            logo_url: 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank',
            nama: 'Memuat bank...',
            nomor: '**** **** ****',
            pemilik: 'Loading...'
        })),
        transactions: Array(3).fill().map((_, i) => ({
            id: `dummy-${i}`,
            transaction_type: 'deposit',
            status: 'pending',
            amount: 0,
            created_at: new Date().toISOString()
        })),
        promos: Array(2).fill().map((_, i) => ({
            id: `dummy-${i}`,
            title: 'Memuat promo...',
            banner: 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Loading',
            description: 'Silakan tunggu, sedang memuat data promo...',
            never_end: true
        })),
        activities: Array(5).fill().map((_, i) => ({
            id: `dummy-${i}`,
            type: 'loading',
            title: 'Memuat aktivitas...',
            description: 'Loading...',
            time: new Date().toISOString(),
            icon: 'fa-spinner fa-spin'
        }))
    };

    // Filter states
    let filterOpen = false;
    let aktivitasFilterOpen = false;
    let aktivitasFilter = { type: 'all', search: '' };
    let transactionFilter = { status: 'all' };
    let currentFilters = {
        layanan: null,
        aplikasi: null,
        search: '',
        sort: 'terbaru',
        filterType: 'layanan',
        itemStatus: 'all'
    };
    
    // Data arrays
    let aktivitasList = [];
    let promosList = [];
    let rekeningList = [];
    let allRekeningList = [];
    let balance = 0;
    let transactions = [];
    let userVouchers = [];
    
    // UI states
    let lastScrollTop = 0;
    let scrollTimer = null;
    let currentBannerIndex = 0;
    let bannerInterval = null;
    let showAllRekening = false;
    let currentDeposit = null;
    let statusCheckInterval = null;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        storeHeader: document.getElementById('storeHeader'),
        storeLogo: document.getElementById('storeLogo'),
        storeName: document.getElementById('storeName'),
        bannerSlider: document.getElementById('bannerSlider'),
        bannerTrack: document.getElementById('bannerTrack'),
        bannerDots: document.getElementById('bannerDots'),
        mainContent: document.getElementById('mainContent'),
        bottomNav: document.getElementById('bottomNav'),
        navItems: document.querySelectorAll('.nav-item'),
        voucherModal: document.getElementById('voucherModal'),
        voucherForm: document.getElementById('voucherForm'),
        voucherCode: document.getElementById('voucherCode'),
        closeVoucherModal: document.getElementById('closeVoucherModal'),
        cancelVoucherBtn: document.getElementById('cancelVoucherBtn'),
        depositModal: document.getElementById('depositModal'),
        depositForm: document.getElementById('depositForm'),
        depositAmount: document.getElementById('depositAmount'),
        paymentMethod: document.getElementById('paymentMethod'),
        closeDepositModal: document.getElementById('closeDepositModal'),
        cancelDepositBtn: document.getElementById('cancelDepositBtn'),
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
            setTimeout(() => toast.remove(), 300);
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
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            return date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
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

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            console.log(`📡 Fetching: ${url}`);
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
    
            if (response.status === 404) {
                console.warn(`⚠️ Endpoint not found (404): ${url}`);
                return { success: false, error: 'Endpoint not found' };
            }
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HTTP error ${response.status}:`, errorText);
                return { success: false, error: `HTTP error ${response.status}` };
            }
    
            const data = await response.json();
            console.log(`📥 Response from ${url}:`, data);
            return data;
        } catch (error) {
            console.error(`❌ Fetch error for ${url}:`, error);
            if (retries > 0) {
                console.log(`🔄 Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (MAX_RETRIES - retries + 1)));
                return fetchWithRetry(url, options, retries - 1);
            }
            return { success: false, error: error.message };
        }
    }

    // ==================== PROGRESSIVE LOADING FUNCTIONS ====================
    function updateLoadingState(dataType, status) {
        loadingStates[dataType] = status;
        console.log(`📊 Loading state ${dataType}: ${status}`);
        
        const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'home';
        switch (activePage) {
            case 'home': renderHomePage(); break;
            case 'aktivitas': renderAktivitasPage(); break;
            case 'promo': renderPromoPage(); break;
            case 'bank': renderBankPage(); break;
            case 'profile': renderProfilePage(); break;
        }
    }

    function isDataLoaded(dataType) {
        return loadingStates[dataType] === 'loaded';
    }

    // ==================== DATA LOADING FUNCTIONS ====================
    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            updateLoadingState('website', 'error');
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                currentWebsite = data.website;
                updateLoadingState('website', 'loaded');
                return data.website;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat data website', 'error');
            updateLoadingState('website', 'error');
            return null;
        }
    }

    async function loadUserFromTelegram() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            currentUser = window.Telegram.WebApp.initDataUnsafe.user;
            console.log('📱 Telegram user:', currentUser);
            updateLoadingState('user', 'loaded');
            return currentUser;
        } else {
            currentUser = {
                id: Math.floor(Math.random() * 1000000),
                first_name: 'User',
                last_name: '',
                username: 'user_' + Math.floor(Math.random() * 1000),
                photo_url: null
            };
            updateLoadingState('user', 'loaded');
            return currentUser;
        }
    }

    async function checkOrCreateUser() {
        if (!currentWebsite || !currentUser) return;
        
        try {
            await fetchWithRetry(`${API_BASE_URL}/api/user/check`, {
                method: 'POST',
                body: JSON.stringify({
                    user_id: currentUser.id,
                    username: currentUser.username,
                    first_name: currentUser.first_name,
                    last_name: currentUser.last_name,
                    photo_url: currentUser.photo_url
                })
            });
        } catch (error) {
            console.error('Error checking user:', error);
        }
    }

    async function loadTampilan() {
        if (!currentWebsite) return;
        
        try {
            console.log(`📡 Fetching tampilan for website ${currentWebsite.id}`);
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}`, {
                method: 'GET'
            });
    
            if (response.success && response.tampilan) {
                tampilanData = response.tampilan;
                console.log('✅ Tampilan data loaded:', tampilanData);
                await injectWebsiteFonts();
                updateLoadingState('tampilan', 'loaded');
            } else {
                tampilanData = {
                    logo: '',
                    banners: [],
                    colors: { primary: '#40a7e3', secondary: '#FFD700', background: '#0f0f0f', text: '#ffffff', card: '#1a1a1a' },
                    font_family: 'Inter',
                    font_size: 14,
                    store_display_name: currentWebsite.name || 'Toko Online',
                    font_animation: 'none'
                };
                updateLoadingState('tampilan', 'loaded');
            }
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
            tampilanData = { store_display_name: currentWebsite?.name || 'Toko Online', font_family: 'Inter', font_size: 14 };
            updateLoadingState('tampilan', 'loaded');
        }
    }

    async function loadAllData() {
        if (!currentWebsite) return;
        
        try {
            console.log(`📡 Fetching initial data for website ${currentWebsite.id}, user: ${currentUser?.id || 0}`);
            
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/website/${currentWebsite.id}/initial-data?user_id=${currentUser?.id || 0}`,
                { method: 'GET' }
            );
    
            if (response.success && response.data) {
                const d = response.data;
                
                if (d.products) {
                    productsData = d.products;
                    extractLayananList();
                    extractAllItems();
                    updateLoadingState('products', 'loaded');
                }
                
                if (d.promos) {
                    promosList = d.promos;
                    updateLoadingState('promos', 'loaded');
                }
                
                if (d.rekening) {
                    allRekeningList = d.rekening;
                    rekeningList = allRekeningList.slice(0, 4);
                    updateLoadingState('rekening', 'loaded');
                }
                
                if (d.user_vouchers) {
                    userVouchers = d.user_vouchers;
                    updateLoadingState('vouchers', 'loaded');
                }
                
                if (d.activities) {
                    aktivitasList = d.activities;
                    updateLoadingState('activities', 'loaded');
                }
                
                if (d.transactions) {
                    transactions = d.transactions || [];
                    
                    let calculatedBalance = 0;
                    transactions.forEach(t => {
                        if (t.transaction_type === 'deposit' && t.status === 'success') {
                            calculatedBalance += t.amount;
                        } else if (t.transaction_type === 'withdraw' && t.status === 'success') {
                            calculatedBalance -= t.amount;
                        }
                    });
                    
                    balance = (d.balance !== undefined) ? d.balance : calculatedBalance;
                    updateLoadingState('transactions', 'loaded');
                }
                
                if (d.templates) {
                    for (const template of d.templates) {
                        const templateData = template.template_data || {};
                        if (templateData.font_file_data) {
                            injectFontStyle(templateData.font_family, templateData.font_file_data);
                        }
                    }
                }
                
                console.log('✅ Data loaded successfully');
            } else {
                console.warn('⚠️ Failed to load initial data');
                updateLoadingState('products', 'error');
                updateLoadingState('promos', 'error');
                updateLoadingState('rekening', 'error');
                updateLoadingState('transactions', 'error');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat beberapa data', 'warning');
            updateLoadingState('products', 'error');
            updateLoadingState('promos', 'error');
            updateLoadingState('rekening', 'error');
            updateLoadingState('transactions', 'error');
        }
    }

    function injectFontStyle(fontFamily, fontData) {
        if (document.getElementById(`website-font-${fontFamily}`)) return;
        
        const style = document.createElement('style');
        style.id = `website-font-${fontFamily}`;
        style.textContent = `
            @font-face {
                font-family: '${fontFamily}';
                src: url('${fontData}') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
        `;
        document.head.appendChild(style);
    }

    async function injectWebsiteFonts() {
        if (!tampilanData) return;
        
        const fontFamilies = [];
        if (tampilanData.store_font_family && tampilanData.store_font_family !== 'Inter')
            fontFamilies.push(tampilanData.store_font_family);
        if (tampilanData.heading_font_family && tampilanData.heading_font_family !== 'Inter')
            fontFamilies.push(tampilanData.heading_font_family);
        if (tampilanData.body_font_family && tampilanData.body_font_family !== 'Inter')
            fontFamilies.push(tampilanData.body_font_family);
        if (tampilanData.font_family && tampilanData.font_family !== 'Inter')
            fontFamilies.push(tampilanData.font_family);
        
        const uniqueFonts = [...new Set(fontFamilies)];
        
        for (const fontFamily of uniqueFonts) {
            await loadFontForFamily(fontFamily);
        }
    }
    
    async function loadFontForFamily(fontFamily) {
        if (document.getElementById(`website-font-${fontFamily}`)) return;
    
        try {
            console.log(`🔍 Mencari font: ${fontFamily}`);
            const encodedFont = encodeURIComponent(fontFamily);
            const response = await fetchWithRetry(`${API_BASE_URL}/api/font-templates/by-font/${encodedFont}`, {
                method: 'GET'
            });
    
            if (response.success && response.template) {
                const template = response.template;
                if (template.font_file_data) {
                    const fontFace = `
                        @font-face {
                            font-family: '${fontFamily}';
                            src: url('${template.font_file_data}') format('truetype');
                            font-weight: normal;
                            font-style: normal;
                            font-display: swap;
                        }
                    `;
                    const style = document.createElement('style');
                    style.id = `website-font-${fontFamily}`;
                    style.textContent = fontFace;
                    document.head.appendChild(style);
                    console.log(`✅ Font injected for website: ${fontFamily}`);
                    return true;
                }
            }
        } catch (error) {
            console.error(`❌ Error loading font ${fontFamily}:`, error);
        }
        return false;
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

    function applyFilters() {
        let filtered = [...filteredItems];
        
        if (currentFilters.layanan) {
            filtered = filtered.filter(item => item.layanan_nama === currentFilters.layanan);
        }
        
        if (currentFilters.aplikasi) {
            filtered = filtered.filter(item => item.aplikasi_nama === currentFilters.aplikasi);
        }
        
        if (currentFilters.itemStatus && currentFilters.itemStatus !== 'all') {
            if (currentFilters.itemStatus === 'ready') {
                filtered = filtered.filter(item => item.item_ready === true);
            } else if (currentFilters.itemStatus === 'sold') {
                filtered = filtered.filter(item => item.item_ready === false);
            } else if (currentFilters.itemStatus === 'request') {
                filtered = filtered.filter(item => item.item_metode === 'request');
            }
        }
        
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            filtered = filtered.filter(item => 
                (item.item_nama && item.item_nama.toLowerCase().includes(searchLower)) ||
                (item.layanan_nama && item.layanan_nama.toLowerCase().includes(searchLower)) ||
                (item.aplikasi_nama && item.aplikasi_nama.toLowerCase().includes(searchLower))
            );
        }
        
        applySort(filtered);
        filteredItems = filtered;
        updatePagination();
    }

    function applySort(filtered = filteredItems) {
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
    }

    function updatePagination() {
        totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderBanners() {
        if (!elements.bannerTrack || !elements.bannerDots) return;
        
        const banners = (isDataLoaded('tampilan') && tampilanData.banners) ? tampilanData.banners : [];
        
        if (banners.length === 0) {
            elements.bannerTrack.innerHTML = `
                <div class="banner-slide skeleton-banner" style="background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite;"></div>
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
        
        if (banners.length > 1) {
            startBannerSlider();
        }
        
        document.querySelectorAll('.banner-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                goToBanner(index);
            });
        });
    }

    function applyTampilan() {
        if (isDataLoaded('tampilan')) {
            if (tampilanData.logo && elements.storeLogo) {
                elements.storeLogo.src = tampilanData.logo;
            }
            
            const storeName = tampilanData.store_display_name || 'Toko Online';
            if (elements.storeName) {
                elements.storeName.textContent = storeName;
                
                setTimeout(() => {
                    if (tampilanData.store_font_family) {
                        elements.storeName.style.fontFamily = `'${tampilanData.store_font_family}', sans-serif`;
                    } else if (tampilanData.font_family) {
                        elements.storeName.style.fontFamily = `'${tampilanData.font_family}', sans-serif`;
                    }
                    
                    if (tampilanData.store_font_size) {
                        elements.storeName.style.fontSize = `${tampilanData.store_font_size}px`;
                    } else if (tampilanData.font_size) {
                        elements.storeName.style.fontSize = `${tampilanData.font_size}px`;
                    }
                    
                    if (tampilanData.colors && tampilanData.colors.text) {
                        elements.storeName.style.color = tampilanData.colors.text;
                    }
                    
                    let animType = tampilanData.store_font_animation || tampilanData.font_animation;
                    let animDuration = tampilanData.store_animation_duration || tampilanData.animation_duration || 2;
                    let animDelay = tampilanData.store_animation_delay || tampilanData.animation_delay || 0;
                    let animIteration = tampilanData.store_animation_iteration || tampilanData.animation_iteration || 'infinite';
                    
                    elements.storeName.style.animation = 'none';
                    void elements.storeName.offsetWidth;
                    
                    if (animType && animType !== 'none') {
                        const animName = animType + 'Anim';
                        elements.storeName.style.animation = `${animName} ${animDuration}s ${animDelay}s ${animIteration}`;
                    }
                }, 200);
            }
            
            if (tampilanData.colors && tampilanData.colors.primary && elements.storeHeader) {
                elements.storeHeader.style.borderColor = tampilanData.colors.primary;
            }
        }
    }

    function renderHomePage() {
        if (elements.bannerSlider) {
            elements.bannerSlider.style.display = 'block';
        }
        
        const displayLayanan = isDataLoaded('products') ? layananList : dummyData.layanan;
        const displayProducts = isDataLoaded('products') ? filteredItems : dummyData.products;
        
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-layer-group"></i> Produk Layanan</h2>
                    <span class="view-all" onclick="window.website.showAllLayanan()">
                        Lihat semua <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
                
                <div class="layanan-grid" id="layananGrid">
                    ${renderLayananGrid(displayLayanan)}
                </div>
                
                <div class="filter-section" id="filterSection">
                    <div class="filter-header" onclick="window.website.toggleFilter()">
                        <h3><i class="fas fa-filter"></i> Filter & Sortir</h3>
                        <i class="fas fa-chevron-down" id="filterChevron"></i>
                    </div>
                    <div class="filter-content" id="filterContent">
                        <div class="filter-actions-grid">
                            <button class="filter-action-btn ${currentFilters.filterType === 'layanan' ? 'active' : ''}" onclick="window.website.setFilterType('layanan')">
                                <i class="fas fa-layer-group"></i> Layanan
                            </button>
                            <button class="filter-action-btn ${currentFilters.filterType === 'aplikasi' ? 'active' : ''}" onclick="window.website.setFilterType('aplikasi')">
                                <i class="fas fa-mobile-alt"></i> Aplikasi
                            </button>
                            <button class="filter-action-btn ${currentFilters.filterType === 'item' ? 'active' : ''}" onclick="window.website.setFilterType('item')">
                                <i class="fas fa-box"></i> Item
                            </button>
                            <button class="filter-action-btn ${currentFilters.filterType === 'sort' ? 'active' : ''}" onclick="window.website.setFilterType('sort')">
                                <i class="fas fa-sort-amount-down"></i> Sort By
                            </button>
                        </div>
                        
                        <div id="filterContentDynamic">
                            ${renderFilterContent()}
                        </div>
                    </div>
                </div>
                
                <div class="section-title">
                    <h2><i class="fas fa-box"></i> Produk Tersedia</h2>
                </div>
                
                <div class="products-grid" id="productsGrid">
                    ${renderProductsGrid(displayProducts)}
                </div>
                
                <div class="pagination" id="pagination">
                    ${renderPagination()}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
        
        if (filterOpen) {
            const filterContent = document.getElementById('filterContent');
            const filterChevron = document.getElementById('filterChevron');
            if (filterContent) filterContent.classList.add('open');
            if (filterChevron) filterChevron.style.transform = 'rotate(180deg)';
        }
    }

    function renderLayananGrid(layananData) {
        if (layananData.length === 0) {
            return '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Belum ada layanan</p></div>';
        }
        
        return layananData.map(layanan => `
            <div class="layanan-card ${!isDataLoaded('products') ? 'skeleton-card' : ''}" 
                 onclick="${isDataLoaded('products') ? `window.website.filterByLayanan('${escapeHtml(layanan.nama)}')` : ''}">
                <div class="layanan-icon ${!isDataLoaded('products') ? 'skeleton-icon' : ''}">
                    ${isDataLoaded('products') && layanan.gambar ? 
                        `<img src="${escapeHtml(layanan.gambar)}" alt="${escapeHtml(layanan.nama)}">` : 
                        `<i class="fas ${isDataLoaded('products') ? 'fa-layer-group' : 'fa-spinner fa-spin'}"></i>`
                    }
                </div>
                <div class="layanan-nama ${!isDataLoaded('products') ? 'skeleton-text' : ''}">${escapeHtml(layanan.nama)}</div>
                <div class="layanan-count ${!isDataLoaded('products') ? 'skeleton-text-small' : ''}">${layanan.count} aplikasi</div>
            </div>
        `).join('');
    }

    function renderProductsGrid(products) {
        if (products.length === 0) {
            return '<div class="empty-state"><i class="fas fa-box-open"></i><p>Tidak ada produk</p></div>';
        }
        
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = products.slice(start, end);
        
        return pageItems.map(item => {
            const isDummy = item.id?.toString().startsWith('dummy');
            const readyClass = item.item_ready ? 'ready' : 'sold';
            const logo = item.aplikasi_gambar || item.layanan_gambar;
            const durasi = item.item_durasi_jumlah ? `${item.item_durasi_jumlah} ${item.item_durasi_satuan}` : '';
            const stokCount = item.item_stok?.length || 0;
            
            return `
                <div class="product-card ${isDummy ? 'skeleton-card' : ''} ${!item.item_ready ? 'sold' : ''}" 
                     onclick="${!isDummy ? `window.website.viewProduct(${item.id})` : ''}">
                    <div class="product-badge ${readyClass} ${isDummy ? 'skeleton-badge' : ''}">
                        ${isDummy ? 'Memuat...' : (item.item_ready ? 'Ready' : 'Sold')}
                    </div>
                    <div class="product-logo ${isDummy ? 'skeleton-image' : ''}">
                        ${!isDummy && logo ? 
                            `<img src="${escapeHtml(logo)}" alt="${escapeHtml(item.item_nama)}">` : 
                            `<i class="fas ${isDummy ? 'fa-spinner fa-spin' : 'fa-box'}"></i>`
                        }
                    </div>
                    <div class="product-info">
                        <div class="product-nama ${isDummy ? 'skeleton-text' : ''}">${escapeHtml(item.item_nama || 'Produk')}</div>
                        <div class="product-category ${isDummy ? 'skeleton-text-small' : ''}">${escapeHtml(item.aplikasi_nama || '')}</div>
                    </div>
                    <div class="product-harga ${isDummy ? 'skeleton-text' : ''}">${isDummy ? 'Rp ---' : formatRupiah(item.item_harga)}</div>
                    ${!isDummy && durasi ? `<div class="product-durasi">⏱️ ${escapeHtml(durasi)}</div>` : ''}
                    <div class="product-stok ${isDummy ? 'skeleton-text-small' : ''}">
                        <i class="fas ${isDummy ? 'fa-spinner fa-spin' : (item.item_metode === 'request' ? 'fa-clipboard-list' : 'fa-cubes')}"></i> 
                        ${isDummy ? 'Memuat...' : (item.item_metode === 'request' ? 'Request' : `Stok: ${stokCount}`)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderFilterContent() {
        switch (currentFilters.filterType) {
            case 'layanan':
                return renderLayananFilter();
            case 'aplikasi':
                return renderAplikasiFilter();
            case 'item':
                return renderItemFilter();
            case 'sort':
                return renderSortFilter();
            default:
                return renderLayananFilter();
        }
    }

    function renderLayananFilter() {
        const uniqueLayanan = isDataLoaded('products') ? 
            [...new Set(productsData.map(l => l.layanan_nama))].filter(Boolean) : [];
        
        if (uniqueLayanan.length === 0) {
            return '<div class="filter-bubbles"><span class="filter-bubble skeleton-text">Memuat layanan...</span></div>';
        }
        
        let html = '<div class="filter-bubbles">';
        uniqueLayanan.forEach(layanan => {
            html += `
                <span class="filter-bubble ${currentFilters.layanan === layanan ? 'active' : ''}" 
                      onclick="window.website.toggleLayananFilter('${escapeHtml(layanan)}')">
                    ${escapeHtml(layanan)}
                </span>
            `;
        });
        html += '</div>';
        return html;
    }

    function renderAplikasiFilter() {
        if (!currentFilters.layanan) {
            return '<div class="filter-bubbles"><span class="filter-bubble">Pilih layanan terlebih dahulu</span></div>';
        }
        
        const layananData = productsData.find(l => l.layanan_nama === currentFilters.layanan);
        const aplikasiList = layananData?.aplikasi || [];
        const uniqueAplikasi = isDataLoaded('products') ? 
            [...new Set(aplikasiList.map(a => a.aplikasi_nama))].filter(Boolean) : [];
        
        if (uniqueAplikasi.length === 0) {
            return '<div class="filter-bubbles"><span class="filter-bubble">Memuat aplikasi...</span></div>';
        }
        
        let html = '<div class="filter-bubbles">';
        uniqueAplikasi.forEach(aplikasi => {
            html += `
                <span class="filter-bubble ${currentFilters.aplikasi === aplikasi ? 'active' : ''}" 
                      onclick="window.website.toggleAplikasiFilter('${escapeHtml(aplikasi)}')">
                    ${escapeHtml(aplikasi)}
                </span>
            `;
        });
        html += '</div>';
        return html;
    }

    function renderItemFilter() {
        let html = '<div class="filter-bubbles">';
        html += `
            <span class="filter-bubble ${currentFilters.itemStatus === 'all' ? 'active' : ''}" 
                  onclick="window.website.setItemFilter('all')">Semua</span>
            <span class="filter-bubble ${currentFilters.itemStatus === 'ready' ? 'active' : ''}" 
                  onclick="window.website.setItemFilter('ready')">Ready</span>
            <span class="filter-bubble ${currentFilters.itemStatus === 'sold' ? 'active' : ''}" 
                  onclick="window.website.setItemFilter('sold')">Sold</span>
            <span class="filter-bubble ${currentFilters.itemStatus === 'request' ? 'active' : ''}" 
                  onclick="window.website.setItemFilter('request')">Request</span>
        `;
        html += '</div>';
        return html;
    }

    function renderSortFilter() {
        return `
            <div class="sort-section">
                <label><i class="fas fa-sort"></i> Urutkan berdasarkan</label>
                <select class="sort-select" id="sortSelect" onchange="window.website.changeSort(this.value)">
                    <option value="terbaru" ${currentFilters.sort === 'terbaru' ? 'selected' : ''}>Terbaru</option>
                    <option value="terlaris" ${currentFilters.sort === 'terlaris' ? 'selected' : ''}>Terlaris</option>
                    <option value="termurah" ${currentFilters.sort === 'termurah' ? 'selected' : ''}>Termurah</option>
                    <option value="termahal" ${currentFilters.sort === 'termahal' ? 'selected' : ''}>Termahal</option>
                    <option value="stok-terbanyak" ${currentFilters.sort === 'stok-terbanyak' ? 'selected' : ''}>Stok Terbanyak</option>
                    <option value="stok-tersedikit" ${currentFilters.sort === 'stok-tersedikit' ? 'selected' : ''}>Stok Tersedikit</option>
                </select>
            </div>
        `;
    }

    function renderPagination() {
        if (!isDataLoaded('products') || totalPages <= 1) return '';
        
        let html = '';
        
        html += `
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.website.goToPage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
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
        
        html += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.website.goToPage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        return html;
    }

    function renderAktivitasPage() {
        if (elements.bannerSlider) {
            elements.bannerSlider.style.display = 'none';
        }
        
        const displayActivities = isDataLoaded('activities') ? aktivitasList : dummyData.activities;
        
        const html = `
            <div class="page-content">
                <div class="aktivitas-header">
                    <h2><i class="fas fa-history"></i> Aktivitas Terkini</h2>
                    <button class="aktivitas-filter-btn ${aktivitasFilterOpen ? 'active' : ''}" id="aktivitasFilterBtn" onclick="window.website.toggleAktivitasFilter()">
                        <i class="fas fa-filter"></i>
                    </button>
                </div>
                
                <div class="aktivitas-filter-panel ${aktivitasFilterOpen ? 'open' : ''}" id="aktivitasFilterPanel">
                    <div class="aktivitas-filter-section">
                        <h4>Jenis Aktivitas</h4>
                        <div class="aktivitas-filter-bubbles">
                            <span class="filter-bubble ${aktivitasFilter.type === 'all' ? 'active' : ''}" onclick="window.website.filterAktivitas('all')">Semua</span>
                            <span class="filter-bubble ${aktivitasFilter.type === 'pembelian' ? 'active' : ''}" onclick="window.website.filterAktivitas('pembelian')">Pembelian</span>
                            <span class="filter-bubble ${aktivitasFilter.type === 'deposit' ? 'active' : ''}" onclick="window.website.filterAktivitas('deposit')">Deposit</span>
                            <span class="filter-bubble ${aktivitasFilter.type === 'withdraw' ? 'active' : ''}" onclick="window.website.filterAktivitas('withdraw')">Withdraw</span>
                            <span class="filter-bubble ${aktivitasFilter.type === 'voucher' ? 'active' : ''}" onclick="window.website.filterAktivitas('voucher')">Voucher</span>
                        </div>
                    </div>
                </div>
                
                <div class="aktivitas-timeline" id="aktivitasTimeline">
                    ${renderAktivitasList(displayActivities)}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
    }

    function renderAktivitasList(activities) {
        if (activities.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada aktivitas</p></div>';
        }
        
        let filtered = [...activities];
        if (aktivitasFilter.type !== 'all' && isDataLoaded('activities')) {
            filtered = filtered.filter(a => a.type === aktivitasFilter.type);
        }
        
        if (filtered.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Tidak ada aktivitas dengan filter ini</p></div>';
        }
        
        return filtered.slice(0, 30).map(aktivitas => {
            const isDummy = aktivitas.id?.toString().startsWith('dummy');
            return `
                <div class="aktivitas-item ${isDummy ? 'skeleton-item' : ''}">
                    <div class="aktivitas-icon ${isDummy ? 'skeleton-icon' : ''}">
                        <i class="fas ${aktivitas.icon || (isDummy ? 'fa-spinner fa-spin' : 'fa-history')}"></i>
                    </div>
                    <div class="aktivitas-content">
                        <div class="aktivitas-title ${isDummy ? 'skeleton-text' : ''}">${escapeHtml(aktivitas.title || 'Aktivitas')}</div>
                        <div class="aktivitas-meta">
                            <span class="aktivitas-time ${isDummy ? 'skeleton-text-small' : ''}">
                                <i class="far fa-clock"></i> ${isDummy ? 'Memuat...' : formatDate(aktivitas.time)}
                            </span>
                        </div>
                        <div class="aktivitas-desc ${isDummy ? 'skeleton-text-small' : ''}" style="font-size: 12px; color: var(--tg-hint-color); margin-top: 4px;">
                            ${escapeHtml(aktivitas.description || '')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPromoPage() {
        const displayPromos = isDataLoaded('promos') ? promosList : dummyData.promos;
        
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
                        <i class="fas fa-gift"></i> Voucher Saya (${isDataLoaded('vouchers') ? userVouchers.length : 'Memuat...'})
                    </button>
                </div>
                
                <div class="promo-grid">
                    ${renderPromoList(displayPromos)}
                </div>
            </div>
        `;
        
        elements.mainContent.innerHTML = html;
    }

    function renderPromoList(promos) {
        if (promos.length === 0) {
            return '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Belum ada promo</p></div>';
        }
        
        return promos.map(promo => {
            const isDummy = promo.id?.toString().startsWith('dummy');
            const expiryText = isDummy ? 'Memuat...' : 
                (promo.never_end ? 'Tidak ada batas waktu' : `Berakhir: ${formatDate(promo.end_date + 'T' + (promo.end_time || '23:59'), true)}`);
            
            return `
                <div class="promo-card ${isDummy ? 'skeleton-card' : ''}">
                    <div class="promo-banner ${isDummy ? 'skeleton-image' : ''}">
                        <img src="${escapeHtml(promo.banner || 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo')}" 
                             alt="${escapeHtml(promo.title)}"
                             onerror="this.src='https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo';">
                    </div>
                    <div class="promo-content">
                        <h3 class="promo-title ${isDummy ? 'skeleton-text' : ''}">${escapeHtml(promo.title)}</h3>
                        ${promo.description ? `<p class="promo-description ${isDummy ? 'skeleton-text' : ''}">${escapeHtml(promo.description)}</p>` : ''}
                        <div class="promo-footer">
                            <span class="promo-expiry ${isDummy ? 'skeleton-text-small' : ''}">
                                <i class="far fa-clock"></i> ${expiryText}
                            </span>
                        </div>
                        ${promo.notes ? `
                            <div class="promo-notes ${isDummy ? 'skeleton-text' : ''}">
                                <i class="fas fa-sticky-note"></i> ${escapeHtml(promo.notes)}
                            </div>
                        ` : ''}
                        <div class="promo-actions">
                            <button class="promo-btn ${isDummy ? 'skeleton-button' : ''}" onclick="${!isDummy ? `window.website.claimPromo(${promo.id})` : ''}">
                                <i class="fas fa-tag"></i> ${isDummy ? 'Memuat...' : 'Klaim Promo'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderBankPage() {
        if (elements.bannerSlider) {
            elements.bannerSlider.style.display = 'none';
        }
        
        const displayRekening = isDataLoaded('rekening') ? rekeningList : dummyData.rekening;
        const displayTransactions = isDataLoaded('transactions') ? transactions : dummyData.transactions;
        const displayBalance = isDataLoaded('transactions') ? formatRupiah(balance) : 'Rp ---';
    
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-university"></i> Bank & Deposit</h2>
                </div>
                
                <div class="balance-card ${!isDataLoaded('transactions') ? 'skeleton-card' : ''}">
                    <div class="balance-label">Saldo Anda</div>
                    <div class="balance-amount ${!isDataLoaded('transactions') ? 'skeleton-text' : ''}" id="balanceAmount">${displayBalance}</div>
                    <div class="balance-actions">
                        <button class="balance-btn" onclick="window.website.openDepositModal()">
                            <i class="fas fa-plus-circle"></i> Deposit
                        </button>
                        <button class="balance-btn" onclick="window.website.openWithdrawModal()">
                            <i class="fas fa-minus-circle"></i> Withdraw
                        </button>
                    </div>
                </div>
                
                <div class="transaction-filter-section">
                    <div class="filter-header" onclick="window.website.toggleTransactionFilter()">
                        <h3><i class="fas fa-filter"></i> Filter Status</h3>
                        <i class="fas fa-chevron-down" id="transactionFilterChevron"></i>
                    </div>
                    <div class="filter-content" id="transactionFilterContent">
                        <div class="filter-bubbles">
                            <span class="filter-bubble ${transactionFilter.status === 'all' ? 'active' : ''}" 
                                  onclick="window.website.filterTransactions('all')">Semua</span>
                            <span class="filter-bubble ${transactionFilter.status === 'pending' ? 'active' : ''}" 
                                  onclick="window.website.filterTransactions('pending')">Pending</span>
                            <span class="filter-bubble ${transactionFilter.status === 'success' ? 'active' : ''}" 
                                  onclick="window.website.filterTransactions('success')">Sukses</span>
                            <span class="filter-bubble ${transactionFilter.status === 'failed' ? 'active' : ''}" 
                                  onclick="window.website.filterTransactions('failed')">Gagal</span>
                            <span class="filter-bubble ${transactionFilter.status === 'expired' ? 'active' : ''}" 
                                  onclick="window.website.filterTransactions('expired')">Kadaluwarsa</span>
                        </div>
                    </div>
                </div>
                
                <div class="section-title" style="margin-top: 16px;">
                    <h3><i class="fas fa-credit-card"></i> Rekening Tersedia</h3>
                    ${isDataLoaded('rekening') && allRekeningList.length > 4 ? `
                        <span class="view-all" onclick="window.website.toggleShowAllRekening()">
                            ${showAllRekening ? 'Tampilkan Sedikit' : 'Lihat Semua'} <i class="fas fa-arrow-right"></i>
                        </span>
                    ` : ''}
                </div>
                
                <div class="rekening-grid" id="rekeningGrid">
                    ${renderRekeningList(displayRekening)}
                </div>
                
                <div class="transaction-history">
                    <div class="transaction-header">
                        <h3><i class="fas fa-history"></i> Riwayat Transaksi</h3>
                    </div>
                    <div class="transaction-list" id="transactionList">
                        ${renderTransactionList(displayTransactions)}
                    </div>
                </div>
            </div>
        `;
    
        elements.mainContent.innerHTML = html;
        
        if (transactionFilterOpen) {
            const filterContent = document.getElementById('transactionFilterContent');
            const filterChevron = document.getElementById('transactionFilterChevron');
            if (filterContent) filterContent.classList.add('open');
            if (filterChevron) filterChevron.style.transform = 'rotate(180deg)';
        }
    }

    function renderRekeningList(rekeningData) {
        if (rekeningData.length === 0) {
            return '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-university"></i><p>Belum ada rekening</p></div>';
        }
        
        return rekeningData.map(rek => {
            const isDummy = rek.id?.toString().startsWith('dummy');
            return `
                <div class="rekening-card ${isDummy ? 'skeleton-card' : ''}">
                    <div class="rekening-logo ${isDummy ? 'skeleton-image' : ''}">
                        <img src="${escapeHtml(rek.logo_url)}" alt="${escapeHtml(rek.nama)}"
                             onerror="this.src='https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank';">
                    </div>
                    <div class="rekening-info">
                        <div class="rekening-nama ${isDummy ? 'skeleton-text' : ''}">${escapeHtml(rek.nama)}</div>
                        <div class="rekening-nomor ${isDummy ? 'skeleton-text-small' : ''}">${escapeHtml(rek.nomor)}</div>
                        <div style="font-size: 9px; color: var(--tg-hint-color); ${isDummy ? 'skeleton-text-small' : ''}">${escapeHtml(rek.pemilik)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTransactionList(transactionsData) {
        if (transactionsData.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada transaksi</p></div>';
        }
        
        return transactionsData.slice(0, 20).map(trx => {
            const isDummy = trx.id?.toString().startsWith('dummy');
            let statusColor = '';
            let statusIcon = '';
        
            switch (trx.status) {
                case 'success':
                    statusColor = 'var(--success-color)';
                    statusIcon = 'fa-check-circle';
                    break;
                case 'pending':
                case 'processing':
                    statusColor = 'var(--warning-color)';
                    statusIcon = 'fa-clock';
                    break;
                case 'failed':
                    statusColor = 'var(--danger-color)';
                    statusIcon = 'fa-times-circle';
                    break;
                case 'expired':
                    statusColor = 'var(--tg-hint-color)';
                    statusIcon = 'fa-hourglass-end';
                    break;
                default:
                    statusColor = 'var(--tg-hint-color)';
                    statusIcon = 'fa-question-circle';
            }
        
            const amountClass = trx.transaction_type === 'deposit' ? 'positive' : 'negative';
            const amountPrefix = trx.transaction_type === 'deposit' ? '+' : '-';
            const iconClass = trx.type_icon || (trx.transaction_type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up');
            const rekeningInfo = trx.rekening_nama ? `${trx.rekening_nama} - ${trx.rekening_nomor}` : '';
        
            return `
                <div class="transaction-item ${isDummy ? 'skeleton-item' : ''}" data-id="${trx.id}" 
                     onclick="${!isDummy ? `window.website.openTransactionDetail(${trx.id})` : ''}" style="cursor: ${!isDummy ? 'pointer' : 'default'};">
                    <div class="transaction-info">
                        <div class="transaction-icon ${trx.transaction_type} ${isDummy ? 'skeleton-icon' : ''}">
                            <i class="fas ${isDummy ? 'fa-spinner fa-spin' : iconClass}"></i>
                        </div>
                        <div class="transaction-details">
                            <h4 class="${isDummy ? 'skeleton-text' : ''}">${isDummy ? 'Memuat...' : (trx.transaction_type === 'deposit' ? 'Deposit' : 'Withdraw')}</h4>
                            <span class="transaction-meta ${isDummy ? 'skeleton-text-small' : ''}">
                                <i class="far fa-clock"></i> ${isDummy ? 'Memuat...' : formatDate(trx.created_at)}
                            </span>
                            ${!isDummy && rekeningInfo ? `<span class="transaction-rekening"><i class="fas fa-university"></i> ${rekeningInfo}</span>` : ''}
                            ${!isDummy ? `
                                <span class="transaction-status" style="color: ${statusColor};">
                                    <i class="fas ${statusIcon}"></i> ${trx.status.toUpperCase()}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass} ${isDummy ? 'skeleton-text' : ''}">
                        ${isDummy ? 'Rp ---' : `${amountPrefix} ${formatRupiah(trx.amount)}`}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderProfilePage() {
        const fullName = currentUser ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') : 'User';
        const username = currentUser?.username ? `@${currentUser.username}` : '@user';
        const avatarUrl = currentUser?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.charAt(0))}&size=80&background=40a7e3&color=fff`;
        
        const displayBalance = isDataLoaded('transactions') ? formatRupiah(balance) : 'Rp ---';
        const displayVoucherCount = isDataLoaded('vouchers') ? userVouchers.length : 'Memuat...';
        const displayPurchaseCount = isDataLoaded('transactions') ? transactions.filter(t => t.type === 'pembelian').length : 'Memuat...';
        
        const html = `
            <div class="page-content">
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
                
                <div class="profile-stats">
                    <div class="profile-stat">
                        <span class="stat-value">${displayVoucherCount}</span>
                        <span class="stat-label">Voucher</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-value">${displayPurchaseCount}</span>
                        <span class="stat-label">Pembelian</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-value">${displayBalance}</span>
                        <span class="stat-label">Saldo</span>
                    </div>
                </div>
                
                <div class="profile-menu">
                    <div class="profile-menu-item" onclick="window.website.showMyVouchers()">
                        <div class="menu-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="menu-info">
                            <div class="menu-title">Voucher Saya</div>
                            <div class="menu-subtitle">${displayVoucherCount} voucher tersedia</div>
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

    // ==================== FILTER ACTIONS ====================
    function toggleFilter() {
        const filterContent = document.getElementById('filterContent');
        const chevron = document.getElementById('filterChevron');
        
        if (filterContent && chevron) {
            filterContent.classList.toggle('open');
            chevron.style.transform = filterContent.classList.contains('open') ? 'rotate(180deg)' : '';
            filterOpen = filterContent.classList.contains('open');
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

    function setFilterType(type) {
        currentFilters.filterType = type;
        renderHomePage();
    }

    function setItemFilter(status) {
        currentFilters.itemStatus = status;
        applyFilters();
        renderHomePage();
    }

    function viewProduct(productId) {
        const product = filteredItems.find(p => p.id === productId);
        if (!product) return;
        showToast(`Melihat detail produk: ${product.item_nama}`, 'info');
    }

    function toggleAktivitasFilter() {
        aktivitasFilterOpen = !aktivitasFilterOpen;
        renderAktivitasPage();
    }

    function filterAktivitas(type) {
        aktivitasFilter.type = type;
        renderAktivitasPage();
    }

    function changePage(page) {
        elements.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        if (elements.bannerSlider) {
            elements.bannerSlider.style.display = page === 'home' ? 'block' : 'none';
        }
        
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

    function changeSort(value) {
        currentFilters.sort = value;
        applyFilters();
        renderHomePage();
    }

    // ==================== BALANCE & TRANSACTION FUNCTIONS ====================
    
    function filterTransactions(status) {
        console.log(`🔍 Filtering transactions by status: ${status}`);
        transactionFilter.status = status;
        
        loadUserBalance().then(() => {
            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
            if (activePage === 'bank') {
                renderBankPage();
            }
        });
    }
    
    function toggleTransactionFilter() {
        const filterContent = document.getElementById('transactionFilterContent');
        const chevron = document.getElementById('transactionFilterChevron');
        
        if (filterContent && chevron) {
            filterContent.classList.toggle('open');
            chevron.style.transform = filterContent.classList.contains('open') ? 'rotate(180deg)' : '';
            transactionFilterOpen = filterContent.classList.contains('open');
        }
    }
    
    function toggleShowAllRekening() {
        if (!isDataLoaded('rekening')) return;
        showAllRekening = !showAllRekening;
        rekeningList = showAllRekening ? allRekeningList : allRekeningList.slice(0, 4);
        
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'bank') {
            renderBankPage();
        }
    }
    
    async function loadUserBalance() {
        if (!currentWebsite || !currentUser) {
            balance = 0;
            updateLoadingState('transactions', 'loaded');
            return;
        }
        
        try {
            console.log(`📡 Fetching balance for user ${currentUser.id} on website ${currentWebsite.id}`);
            
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/transactions/user/${currentUser.id}?website_id=${currentWebsite.id}&status=all&limit=100`,
                { method: 'GET' }
            );
    
            if (response.success && response.transactions) {
                transactions = response.transactions || [];
                
                let calculatedBalance = 0;
                transactions.forEach(t => {
                    if (t.transaction_type === 'deposit' && t.status === 'success') {
                        calculatedBalance += t.amount;
                    } else if (t.transaction_type === 'withdraw' && t.status === 'success') {
                        calculatedBalance -= t.amount;
                    }
                });
                
                balance = calculatedBalance;
                updateLoadingState('transactions', 'loaded');
                updateAllBalanceDisplays();
            }
        } catch (error) {
            console.error('❌ Error loading balance:', error);
            updateLoadingState('transactions', 'error');
        }
    }
    
    function updateAllBalanceDisplays() {
        const balanceElement = document.getElementById('balanceAmount');
        if (balanceElement) {
            balanceElement.textContent = formatRupiah(balance);
        }
        
        if (elements.userBalance) {
            elements.userBalance.textContent = formatRupiah(balance);
        }
        
        if (elements.withdrawAmount) {
            elements.withdrawAmount.max = balance;
        }
        
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues.length >= 3) {
            statValues[2].textContent = formatRupiah(balance);
        }
    }

    // ==================== DEPOSIT FUNCTIONS ====================

    function openDepositModal() {
        if (!elements.depositModal) return;
        elements.depositModal.classList.add('active');
        
        const select = elements.paymentMethod;
        if (select) {
            let options = '<option value="">-- Pilih Metode --</option>';
            
            if (rekeningList.length > 0) {
                options += '<option value="qris" class="qris-option">🔵 QRIS (Otomatis)</option>';
                rekeningList.forEach(rek => {
                    options += `<option value="${rek.id}" data-type="rekening">${escapeHtml(rek.nama)} - ${escapeHtml(rek.nomor)}</option>`;
                });
            }
            
            select.innerHTML = options;
        }
    }

    function closeDepositModal() {
        if (!elements.depositModal) return;
        elements.depositModal.classList.remove('active');
        if (elements.depositForm) elements.depositForm.reset();
    }

    async function deposit(e) {
        e.preventDefault();
        
        const amount = parseInt(elements.depositAmount?.value);
        const methodValue = elements.paymentMethod?.value;

        if (!amount || amount < 100) {
            showToast('Minimal deposit Rp 100', 'warning');
            return;
        }

        if (!methodValue) {
            showToast('Pilih metode pembayaran', 'warning');
            return;
        }

        showLoading(true);

        try {
            let payment_method = 'rekening';
            let rekening_id = null;
            let gateway_id = null;

            if (methodValue === 'qris') {
                payment_method = 'qris';
                const gatewayResponse = await fetchWithRetry(`${API_BASE_URL}/api/payments/gateway/${currentWebsite.id}`, {
                    method: 'GET'
                });

                if (gatewayResponse.success && gatewayResponse.gateway && gatewayResponse.gateway.length > 0) {
                    const activeGateway = gatewayResponse.gateway.find(g => g.active) || gatewayResponse.gateway[0];
                    gateway_id = activeGateway.id;
                } else {
                    showToast('Gateway pembayaran tidak tersedia', 'error');
                    showLoading(false);
                    return;
                }
            } else {
                rekening_id = parseInt(methodValue);
            }

            const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/create`, {
                method: 'POST',
                body: JSON.stringify({
                    website_id: currentWebsite.id,
                    user_id: currentUser.id,
                    amount: amount,
                    payment_method: payment_method,
                    rekening_id: rekening_id,
                    gateway_id: gateway_id,
                    user_data: {
                        username: currentUser.username,
                        first_name: currentUser.first_name,
                        last_name: currentUser.last_name
                    }
                })
            });

            if (response.success) {
                if (payment_method === 'qris' && response.qris_data) {
                    showQrisModal(response.qris_data, response.deposit_id);
                    closeDepositModal();
                } else {
                    showToast('Deposit berhasil dibuat, silakan transfer', 'success');
                    closeDepositModal();
                    await loadUserBalance();
                }
            } else {
                showToast(response.error || 'Gagal membuat deposit', 'error');
            }
        } catch (error) {
            console.error('❌ Error creating deposit:', error);
            showToast('Gagal membuat deposit', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== WITHDRAW FUNCTIONS ====================

    function openWithdrawModal() {
        if (balance < 50000) {
            showToast('Minimal withdraw Rp 50.000', 'warning');
            return;
        }
        
        if (elements.withdrawAmount) elements.withdrawAmount.max = balance;
        if (elements.userBalance) elements.userBalance.textContent = formatRupiah(balance);
        if (elements.withdrawModal) elements.withdrawModal.classList.add('active');
        
        const select = elements.withdrawAccount;
        if (select) {
            let options = '<option value="">-- Pilih Rekening --</option>';
            rekeningList.forEach(rek => {
                options += `<option value="${rek.id}">${escapeHtml(rek.nama)} - ${escapeHtml(rek.nomor)}</option>`;
            });
            select.innerHTML = options;
        }
    }

    function closeWithdrawModal() {
        if (!elements.withdrawModal) return;
        elements.withdrawModal.classList.remove('active');
        if (elements.withdrawForm) elements.withdrawForm.reset();
    }

    async function withdraw(e) {
        e.preventDefault();
        
        const amount = parseInt(elements.withdrawAmount?.value);
        const account = elements.withdrawAccount?.value;
        
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

    // ==================== QRIS MODAL FUNCTIONS ====================

    function showQrisModal(qrisData, depositId) {
        currentDeposit = { id: depositId, ...qrisData };
        
        const modal = document.getElementById('confirmDepositModal');
        const qrisImage = document.getElementById('qrisImage');
        const confirmAmount = document.getElementById('confirmAmount');
        const confirmUnique = document.getElementById('confirmUnique');
        const confirmTotal = document.getElementById('confirmTotal');
        const confirmExpired = document.getElementById('confirmExpired');

        if (qrisImage) qrisImage.src = qrisData.qr_image_url;
        if (confirmAmount) confirmAmount.textContent = formatRupiah(qrisData.original_amount);
        if (confirmUnique) confirmUnique.textContent = formatRupiah(qrisData.unique_nominal);
        if (confirmTotal) confirmTotal.textContent = formatRupiah(qrisData.total_amount);
        if (confirmExpired) confirmExpired.textContent = formatDate(qrisData.expired_at, true);

        if (modal) modal.classList.add('active');
        startStatusCheck(depositId);
    }

    async function checkStatusManually() {
      if (!currentDeposit) {
        showToast('Tidak ada transaksi aktif', 'warning');
        return;
      }
    
      showToast('Mengecek status pembayaran...', 'info');
    
      try {
        const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
          method: 'POST',
          body: JSON.stringify({ deposit_id: currentDeposit.id })
        });
    
        if (response.success && response.deposit) {
          const status = response.deposit.status;
    
          if (status === 'success') {
            showToast('✅ Pembayaran berhasil!', 'success');
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            closeConfirmDepositModal();
            await handleDepositSuccess(currentDeposit.id);
          } else if (status === 'expired') {
            showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            closeConfirmDepositModal();
          } else if (status === 'pending') {
            showToast('⏳ Menunggu pembayaran...', 'info');
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
        showToast('Gagal mengecek status', 'error');
      }
    }

    function closeConfirmDepositModal() {
        const modal = document.getElementById('confirmDepositModal');
        if (modal) modal.classList.remove('active');
        
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }
    }

    function startStatusCheck(depositId) {
        if (statusCheckInterval) clearInterval(statusCheckInterval);

        statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
                    method: 'POST',
                    body: JSON.stringify({ deposit_id: depositId })
                });

                if (response.success && response.deposit) {
                    const status = response.deposit.status;

                    if (status === 'success') {
                        showToast('✅ Pembayaran berhasil!', 'success');
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        closeConfirmDepositModal();
                        await handleDepositSuccess(depositId);
                    } else if (status === 'expired') {
                        showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        closeConfirmDepositModal();
                    } else if (status === 'failed') {
                        showToast('❌ Pembayaran gagal', 'error');
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        closeConfirmDepositModal();
                    }
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        }, 5000);
    }

    async function handleDepositSuccess(depositId) {
        showToast('✅ Deposit berhasil!', 'success');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadUserBalance();
        updateAllBalanceDisplays();
        
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'bank') {
            renderBankPage();
        } else if (activePage === 'profile') {
            renderProfilePage();
        }
    }

    // ==================== TRANSACTION DETAIL FUNCTIONS ====================

    async function openTransactionDetail(transactionId) {
        console.log(`📋 Opening transaction detail for ID: ${transactionId}`);
        
        const transaction = transactions.find(t => t.id == transactionId);
        if (!transaction) {
            showToast('Transaksi tidak ditemukan', 'error');
            return;
        }
        
        selectedTransaction = transaction;
        
        const modal = document.getElementById('transactionDetailModal');
        const detailContent = document.getElementById('detailContent');
        const detailLoading = document.getElementById('detailLoading');
        const detailError = document.getElementById('detailError');
        
        if (detailLoading) detailLoading.style.display = 'block';
        if (detailError) detailError.style.display = 'none';
        if (detailContent) detailContent.innerHTML = '';
        if (modal) modal.classList.add('active');
        
        try {
            await loadQrisDetail(transaction.id);
            if (detailLoading) detailLoading.style.display = 'none';
        } catch (error) {
            console.error('❌ Error loading transaction detail:', error);
            if (detailLoading) detailLoading.style.display = 'none';
            if (detailError) detailError.style.display = 'block';
        }
    }

    function closeTransactionDetail() {
        const modal = document.getElementById('transactionDetailModal');
        if (modal) modal.classList.remove('active');
        selectedTransaction = null;
    }

    async function loadQrisDetail(depositId) {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
                method: 'GET'
            });
            
            if (response.success && response.deposit) {
                const deposit = response.deposit;
                showQrisPendingModal(deposit);
            } else {
                throw new Error('Gagal memuat detail QRIS');
            }
        } catch (error) {
            console.error('❌ Error loading qris detail:', error);
            throw error;
        }
    }

    function showQrisPendingModal(deposit) {
        const modal = document.getElementById('qrisPendingModal');
        const body = document.getElementById('qrisPendingBody');
        
        if (!modal || !body) return;
        
        const qrisData = {
            qr_image_url: deposit.cashify_qr_image_url,
            original_amount: deposit.amount,
            unique_nominal: deposit.cashify_unique_nominal || 0,
            total_amount: deposit.amount + (deposit.cashify_unique_nominal || 0),
            expired_at: deposit.cashify_expired_at || deposit.expired_at
        };
        
        body.innerHTML = `
            <div class="qris-container">
                <img src="${qrisData.qr_image_url}" alt="QRIS" class="qris-image" style="max-width: 100%;">
            </div>
            
            <div class="deposit-details">
                <div class="detail-row">
                    <span class="detail-label">Nominal:</span>
                    <span class="detail-value">${formatRupiah(qrisData.original_amount)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Kode Unik:</span>
                    <span class="detail-value">${formatRupiah(qrisData.unique_nominal)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Bayar:</span>
                    <span class="detail-value total">${formatRupiah(qrisData.total_amount)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Waktu Expired:</span>
                    <span class="detail-value">${formatDate(qrisData.expired_at, true)}</span>
                </div>
            </div>
            
            <div class="qris-instruction">
                <h4><i class="fas fa-info-circle"></i> Cara Pembayaran:</h4>
                <ol>
                    <li>Buka aplikasi pembayaran yang mendukung QRIS</li>
                    <li>Pilih menu Scan QR atau Bayar QRIS</li>
                    <li>Scan QR code di atas</li>
                    <li>Periksa nominal pembayaran (total termasuk kode unik)</li>
                    <li>Selesaikan pembayaran</li>
                </ol>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.website.closeQrisPending()">Tutup</button>
                <button type="button" class="btn-primary" onclick="window.website.checkPendingStatus(${deposit.id})">
                    <i class="fas fa-sync-alt"></i> Cek Status
                </button>
            </div>
        `;
        
        modal.classList.add('active');
        startPendingStatusCheck(deposit.id);
    }

    function showQrisPending(depositId) {
        loadQrisDetail(depositId);
    }

    function closeQrisPending() {
        const modal = document.getElementById('qrisPendingModal');
        if (modal) modal.classList.remove('active');
        
        if (pendingStatusInterval) {
            clearInterval(pendingStatusInterval);
            pendingStatusInterval = null;
        }
    }

    let pendingStatusInterval = null;

    function startPendingStatusCheck(depositId) {
        if (pendingStatusInterval) clearInterval(pendingStatusInterval);
        
        pendingStatusInterval = setInterval(async () => {
            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
                    method: 'POST',
                    body: JSON.stringify({ deposit_id: depositId })
                });
                
                if (response.success && response.deposit) {
                    const status = response.deposit.status;
                    
                    if (status === 'success') {
                        showToast('✅ Pembayaran berhasil!', 'success');
                        clearInterval(pendingStatusInterval);
                        pendingStatusInterval = null;
                        closeQrisPending();
                        await loadUserBalance();
                        updateAllBalanceDisplays();
                    } else if (status === 'expired') {
                        showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
                        clearInterval(pendingStatusInterval);
                        pendingStatusInterval = null;
                        closeQrisPending();
                    }
                }
            } catch (error) {
                console.error('Error checking pending status:', error);
            }
        }, 5000);
    }

    async function checkPendingStatus(depositId) {
        showToast('Mengecek status pembayaran...', 'info');
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
                method: 'POST',
                body: JSON.stringify({ deposit_id: depositId })
            });
            
            if (response.success && response.deposit) {
                const status = response.deposit.status;
                
                if (status === 'success') {
                    showToast('✅ Pembayaran berhasil!', 'success');
                    clearInterval(pendingStatusInterval);
                    pendingStatusInterval = null;
                    closeQrisPending();
                    await loadUserBalance();
                    updateAllBalanceDisplays();
                } else if (status === 'expired') {
                    showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
                } else if (status === 'pending') {
                    showToast('⏳ Menunggu pembayaran...', 'info');
                }
            }
        } catch (error) {
            console.error('Error checking status:', error);
            showToast('Gagal mengecek status', 'error');
        }
    }

    // ==================== VOUCHER FUNCTIONS ====================

    function openVoucherModal() {
        if (elements.voucherModal) elements.voucherModal.classList.add('active');
    }

    function closeVoucherModal() {
        if (elements.voucherModal) elements.voucherModal.classList.remove('active');
        if (elements.voucherCode) elements.voucherCode.value = '';
    }

    async function claimVoucher(e) {
        e.preventDefault();
        
        const code = elements.voucherCode?.value.trim();
        
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
                
                const vouchersResponse = await fetchWithRetry(`${API_BASE_URL}/api/voucher/user/${currentUser.id}?website_id=${currentWebsite.id}`, {
                    method: 'GET'
                });
                
                if (vouchersResponse.success) {
                    userVouchers = vouchersResponse.claims || [];
                    updateLoadingState('vouchers', 'loaded');
                }
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
        if (!isDataLoaded('vouchers') || userVouchers.length === 0) {
            showToast('Anda belum memiliki voucher', 'info');
            return;
        }
        
        let message = 'Voucher Saya:\n';
        userVouchers.slice(0, 5).forEach(v => {
            message += `\n• ${v.nama} (${v.kode}) - ${v.used ? 'Sudah digunakan' : 'Belum digunakan'}`;
        });
        
        if (userVouchers.length > 5) {
            message += `\n\n...dan ${userVouchers.length - 5} voucher lainnya`;
        }
        
        showToast(message, 'info', 5000);
    }

    function claimPromo(promoId) {
        const promo = promosList.find(p => p.id == promoId);
        if (!promo) return;
        showToast(`Promo: ${promo.title}`, 'info');
    }

    function showTransactionHistory() {
        changePage('bank');
    }

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

    // ==================== BANNER FUNCTIONS ====================

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
        
        if (bannerInterval) {
            clearInterval(bannerInterval);
            startBannerSlider();
        }
    }

    function updateBannerPosition() {
        if (!elements.bannerTrack) return;
        elements.bannerTrack.style.transform = `translateX(-${currentBannerIndex * 100}%)`;
        
        document.querySelectorAll('.banner-dot').forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentBannerIndex);
        });
    }

    function initNavScroll() {
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                elements.bottomNav.classList.add('hidden');
            } else {
                elements.bottomNav.classList.remove('hidden');
            }
            
            lastScrollTop = scrollTop;
            
            if (scrollTimer) clearTimeout(scrollTimer);
            
            scrollTimer = setTimeout(() => {
                elements.bottomNav.classList.remove('hidden');
            }, 150);
        });
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            Object.keys(loadingStates).forEach(key => {
                loadingStates[key] = 'loading';
            });
            
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadUserFromTelegram();
            await checkOrCreateUser();
            
            renderHomePage();
            renderBanners();
            
            // Load data secara paralel
            await Promise.all([
                loadTampilan().then(() => {
                    applyTampilan();
                    renderBanners();
                }),
                loadAllData()
            ]).catch(error => {
                console.error('Error loading data:', error);
            }).finally(() => {
                showLoading(false);
            });
            
            // Setup navigation
            elements.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    changePage(item.dataset.page);
                });
            });
            
            initNavScroll();
            
            // Setup form listeners
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

            // Modal listeners
            const closeConfirmModal = document.getElementById('closeConfirmDepositModal');
            const closeConfirmBtn = document.getElementById('closeConfirmBtn');
            const checkStatusBtn = document.getElementById('checkStatusBtn');
            
            if (closeConfirmModal) {
                closeConfirmModal.addEventListener('click', closeConfirmDepositModal);
            }
            
            if (closeConfirmBtn) {
                closeConfirmBtn.addEventListener('click', closeConfirmDepositModal);
            }
            
            if (checkStatusBtn) {
                checkStatusBtn.addEventListener('click', checkStatusManually);
            }
            
            const closeTransactionModal = document.getElementById('closeTransactionDetailModal');
            if (closeTransactionModal) {
                closeTransactionModal.addEventListener('click', closeTransactionDetail);
            }
            
            const closeQrisPendingModal = document.getElementById('qrisPendingModal');
            if (closeQrisPendingModal) {
                closeQrisPendingModal.addEventListener('click', closeQrisPending);
            }
            
            // Click outside untuk modal
            window.addEventListener('click', (e) => {
                if (e.target === elements.voucherModal) closeVoucherModal();
                if (e.target === elements.depositModal) closeDepositModal();
                if (e.target === elements.withdrawModal) closeWithdrawModal();
                if (e.target === document.getElementById('confirmDepositModal')) closeConfirmDepositModal();
                if (e.target === document.getElementById('transactionDetailModal')) closeTransactionDetail();
                if (e.target === document.getElementById('qrisPendingModal')) closeQrisPending();
            });
            
            console.log('✅ Website initialized');
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat website', 'error');
            showLoading(false);
            
            if (elements.mainContent) {
                elements.mainContent.innerHTML = `
                    <div class="error-container" style="text-align: center; padding: 50px 20px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger-color); margin-bottom: 20px;"></i>
                        <h3>Gagal Memuat Halaman</h3>
                        <p style="color: var(--tg-hint-color); margin-top: 10px;">${error.message || 'Terjadi kesalahan tidak diketahui'}</p>
                        <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
                            <i class="fas fa-sync-alt"></i> Muat Ulang
                        </button>
                    </div>
                `;
            }
        }
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.website = {
        changePage,
        toggleFilter,
        checkStatusManually,
        toggleLayananFilter,
        toggleAplikasiFilter,
        filterByLayanan,
        showAllLayanan,
        setFilterType,
        setItemFilter,
        changeSort,
        toggleAktivitasFilter,
        filterAktivitas,
        filterTransactions,
        toggleTransactionFilter,
        toggleShowAllRekening,
        goToPage,
        viewProduct,
        openVoucherModal,
        showMyVouchers,
        claimPromo,
        openDepositModal,
        openWithdrawModal,
        showTransactionHistory,
        openSettings,
        logout,
        openTransactionDetail,
        showQrisPending,
        checkPendingStatus,
        closeTransactionDetail,
        closeQrisPending
    };

    // ==================== START ====================
    init();
})();
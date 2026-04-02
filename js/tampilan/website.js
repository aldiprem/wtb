// website.js - Website Store Front (FINAL VERSION WITH NEW FEATURES)
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    
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
    let pendingStatusInterval = null;

    // ==================== NEW STATE VARIABLES ====================
    // Deposit state
    let selectedVoucher = null;
    let selectedProofFile = null;
    let selectedRekening = null;

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

    // ==================== NEW DOM ELEMENTS ====================
    // Tambahkan elemen baru untuk fitur deposit yang diperbarui
    const newElements = {
        rekeningPreview: document.getElementById('rekeningPreview'),
        previewLogo: document.getElementById('previewLogo'),
        previewBank: document.getElementById('previewBank'),
        previewAccountNumber: document.getElementById('previewAccountNumber'),
        previewOwner: document.getElementById('previewOwner'),
        voucherCodeInput: document.getElementById('voucherCodeInput'),
        voucherApplied: document.getElementById('voucherApplied'),
        appliedVoucherName: document.getElementById('appliedVoucherName'),
        uploadSection: document.getElementById('uploadSection'),
        uploadArea: document.getElementById('uploadArea'),
        proofFile: document.getElementById('proofFile'),
        uploadPreview: document.getElementById('uploadPreview'),
        previewImage: document.getElementById('previewImage'),
        proofUrl: document.getElementById('proofUrl'),
        voucherSelectionModal: document.getElementById('voucherSelectionModal'),
        voucherList: document.getElementById('voucherList'),
        closeVoucherSelectionModal: document.getElementById('closeVoucherSelectionModal'),
        copyAccountBtn: document.getElementById('copyAccountBtn')
    };

    // Gabungkan dengan elements yang sudah ada
    Object.assign(elements, newElements);

    function hashToImageUrl(hash) {
        console.log('🔍 hashToImageUrl called with:', hash);
        
        if (!hash) {
            console.log('⚠️ Hash is empty');
            return '';
        }
        
        // Jika sudah URL penuh atau base64
        if (hash.startsWith('http://') || hash.startsWith('https://') || hash.startsWith('data:')) {
            console.log('✅ Already a full URL:', hash);
            return hash;
        }
        
        // Jika hash 35 karakter
        if (hash.length === 35 && /^[a-f0-9]{35}$/i.test(hash)) {
            const endpoint = currentWebsite?.endpoint || 'companel';
            const fullUrl = `https://companel.shop/ii?${endpoint}=${hash}`;
            console.log('✅ Converted hash to URL:', fullUrl);
            return fullUrl;
        }
        
        console.log('⚠️ Not a valid hash (length: ' + hash.length + '):', hash);
        return hash;
    }

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
            // Convert ke WIB (UTC+7)
            const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
            if (withTime) {
                return wibDate.toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) + ' WIB';
            }
            return wibDate.toLocaleDateString('id-ID', {
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

    // ==================== NEW UTILITY FUNCTIONS ====================
    function copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const text = element.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Nomor rekening berhasil disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin nomor rekening', 'error');
        });
    }

    function copyToClipboardText(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Teks berhasil disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin teks', 'error');
        });
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

    // ==================== AUTO REFRESH FUNCTIONS ====================
    let autoRefreshIntervals = {
        transactions: null,
        balance: null
    };

    function startAutoRefresh() {
        if (autoRefreshIntervals.transactions) clearInterval(autoRefreshIntervals.transactions);
        if (autoRefreshIntervals.balance) clearInterval(autoRefreshIntervals.balance);
        
        autoRefreshIntervals.transactions = setInterval(() => {
            if (currentWebsite && currentUser) {
                loadUserBalance(true);
            }
        }, 30000);
        
        autoRefreshIntervals.balance = setInterval(() => {
            checkAllPendingTransactions();
        }, 10000);
    }
    
    function stopAutoRefresh() {
        if (autoRefreshIntervals.transactions) {
            clearInterval(autoRefreshIntervals.transactions);
            autoRefreshIntervals.transactions = null;
        }
        if (autoRefreshIntervals.balance) {
            clearInterval(autoRefreshIntervals.balance);
            autoRefreshIntervals.balance = null;
        }
    }
    
    async function checkAllPendingTransactions() {
        if (!transactions || transactions.length === 0) return;
        
        const pendingTransactions = transactions.filter(t => 
            t.transaction_type === 'deposit' && 
            t.payment_method === 'qris' && 
            t.status === 'pending'
        );
        
        if (pendingTransactions.length === 0) return;
        
        let statusChanged = false;
        
        for (const transaction of pendingTransactions) {
            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
                    method: 'POST',
                    body: JSON.stringify({ deposit_id: transaction.id })
                });
                
                if (response.success && response.deposit) {
                    const newStatus = response.deposit.status;
                    if (newStatus !== transaction.status) {
                        statusChanged = true;
                        const index = transactions.findIndex(t => t.id === transaction.id);
                        if (index !== -1) {
                            transactions[index] = response.deposit;
                            transactions[index].transaction_type = 'deposit';
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking pending transaction:', error);
            }
        }
        
        if (statusChanged) {
            let calculatedBalance = 0;
            transactions.forEach(t => {
                if (t.transaction_type === 'deposit' && t.status === 'success') {
                    calculatedBalance += t.amount;
                } else if (t.transaction_type === 'withdraw' && t.status === 'success') {
                    calculatedBalance -= t.amount;
                }
            });
            balance = calculatedBalance;
            updateAllBalanceDisplays();
            
            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
            if (activePage === 'bank') {
                renderBankPage();
            }
        }
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
                
                // ==================== AMBIL DATA TAMPILAN (TERMASUK LOGO) ====================
                if (d.tampilan) {
                    tampilanData = d.tampilan;
                    console.log('✅ Tampilan data loaded:', tampilanData);
                    console.log('🖼️ Logo value from DB:', tampilanData.logo);
                    
                    // Update loading state
                    updateLoadingState('tampilan', 'loaded');
                    
                    // PANGGIL APPLY TAMPILAN LANGSUNG UNTUK UPDATE LOGO
                    applyTampilan();
                    
                } else {
                    console.log('ℹ️ No tampilan data in initial-data, loading separately...');
                    await loadTampilan();
                }
                
                // ==================== PRODUK ====================
                if (d.products) {
                    productsData = d.products;
                    extractLayananList();
                    extractAllItems();
                    updateLoadingState('products', 'loaded');
                }
                
                // ==================== PROMOS ====================
                if (d.promos) {
                    promosList = d.promos;
                    updateLoadingState('promos', 'loaded');
                }
                
                // ==================== REKENING ====================
                if (d.rekening) {
                    allRekeningList = d.rekening;
                    rekeningList = allRekeningList.slice(0, 4);
                    updateLoadingState('rekening', 'loaded');
                }
                
                // ==================== VOUCHER ====================
                if (d.user_vouchers) {
                    userVouchers = d.user_vouchers;
                    updateLoadingState('vouchers', 'loaded');
                }
                
                // ==================== AKTIVITAS ====================
                if (d.activities) {
                    aktivitasList = d.activities;
                    updateLoadingState('activities', 'loaded');
                }
                
                // ==================== TRANSAKSI ====================
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
                    updateLoadingState('balance', 'loaded');
                    
                    console.log(`💰 Initial balance loaded: ${balance}`);
                }
                
                // ==================== TEMPLATE FONT ====================
                if (d.templates) {
                    for (const template of d.templates) {
                        const templateData = template.template_data || {};
                        if (templateData.font_file_data) {
                            injectFontStyle(templateData.font_family, templateData.font_file_data);
                        }
                    }
                }
                
                console.log('✅ All data loaded successfully');
                
                updateAllBalanceDisplays();
                startAutoRefresh();
                
                // Render ulang banner jika ada
                if (tampilanData.banners) {
                    renderBanners();
                }
                
                // Terapkan tampilan (warna, dll)
                applyTampilan();
                
            } else {
                console.warn('⚠️ Failed to load initial data');
                updateLoadingState('products', 'error');
                updateLoadingState('promos', 'error');
                updateLoadingState('rekening', 'error');
                updateLoadingState('transactions', 'error');
                updateLoadingState('balance', 'error');
                updateLoadingState('tampilan', 'error');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat beberapa data', 'warning');
            updateLoadingState('products', 'error');
            updateLoadingState('promos', 'error');
            updateLoadingState('rekening', 'error');
            updateLoadingState('transactions', 'error');
            updateLoadingState('balance', 'error');
            updateLoadingState('tampilan', 'error');
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
            // KONVERSI HASH KE URL
            let url = '';
            if (typeof banner === 'string') {
                url = hashToImageUrl(banner);
            } else if (typeof banner === 'object') {
                url = hashToImageUrl(banner.url || banner.hash);
            }
            
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
        console.log('🎨 applyTampilan called, isDataLoaded:', isDataLoaded('tampilan'));
        console.log('📦 tampilanData:', tampilanData);
        
        if (isDataLoaded('tampilan')) {
            // LOGO - KONVERSI HASH KE URL
            if (tampilanData.logo && elements.storeLogo) {
                const rawLogo = tampilanData.logo;
                console.log('🖼️ Raw logo from database:', rawLogo);
                
                const logoUrl = hashToImageUrl(rawLogo);
                console.log('🖼️ Final logo URL:', logoUrl);
                
                elements.storeLogo.src = logoUrl;
                
                // Tambahkan event listener untuk error loading gambar
                elements.storeLogo.onerror = () => {
                    console.error('❌ Failed to load logo from URL:', logoUrl);
                    elements.storeLogo.src = 'https://via.placeholder.com/48x48/40a7e3/ffffff?text=Logo';
                };
                
                elements.storeLogo.onload = () => {
                    console.log('✅ Logo loaded successfully!');
                };
            } else {
                console.log('⚠️ No logo data or storeLogo element not found');
                if (!tampilanData.logo) console.log('   - tampilanData.logo is empty');
                if (!elements.storeLogo) console.log('   - storeLogo element not found');
            }
            
            // Store name
            const storeName = tampilanData.store_display_name || 'Toko Online';
            if (elements.storeName) {
                elements.storeName.textContent = storeName;
                console.log('🏪 Store name set to:', storeName);
                
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
        } else {
            console.log('⚠️ Tampilan data not loaded yet');
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
                        `<img src="${hashToImageUrl(layanan.gambar)}" alt="${escapeHtml(layanan.nama)}">` : 
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
            // KONVERSI GAMBAR PRODUK
            const logo = item.aplikasi_gambar ? hashToImageUrl(item.aplikasi_gambar) : 
                        (item.layanan_gambar ? hashToImageUrl(item.layanan_gambar) : '');
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
                            `<img src="${escapeHtml(logo)}" alt="${escapeHtml(item.item_nama)}" onerror="this.src='https://via.placeholder.com/80x80/40a7e3/ffffff?text=Product';">` : 
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
            // KONVERSI BANNER PROMO
            const bannerUrl = hashToImageUrl(promo.banner || 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo');
            const expiryText = isDummy ? 'Memuat...' : 
                (promo.never_end ? 'Tidak ada batas waktu' : `Berakhir: ${formatDate(promo.end_date + 'T' + (promo.end_time || '23:59'), true)}`);
            
            return `
                <div class="promo-card ${isDummy ? 'skeleton-card' : ''}">
                    <div class="promo-banner ${isDummy ? 'skeleton-image' : ''}">
                        <img src="${escapeHtml(bannerUrl)}" 
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
                    <button class="copy-btn-small" onclick="window.website.copyToClipboardText('${escapeHtml(rek.nomor)}')">
                        <i class="fas fa-copy"></i>
                    </button>
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
                <div class="transaction-item ${isDummy ? 'skeleton-item' : ''}" data-id="${trx.id}" data-status="${trx.status}"
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
    
    async function loadUserBalance(silent = false) {
        if (!currentWebsite || !currentUser) {
            balance = 0;
            updateLoadingState('transactions', 'loaded');
            return;
        }
        
        try {
            if (!silent) console.log(`📡 Fetching balance for user ${currentUser.id} on website ${currentWebsite.id}`);
            
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/user/${currentUser.id}/balance?website_id=${currentWebsite.id}`,
                { method: 'GET' }
            );
    
            if (response.success) {
                balance = response.balance || 0;
                console.log(`💰 Balance loaded: ${balance}`);
                updateLoadingState('transactions', 'loaded');
                updateAllBalanceDisplays();
                
                if (response.transactions) {
                    transactions = response.transactions || [];
                }
            } else {
                const trxResponse = await fetchWithRetry(
                    `${API_BASE_URL}/api/transactions/user/${currentUser.id}?website_id=${currentWebsite.id}&status=all&limit=100`,
                    { method: 'GET' }
                );
                
                if (trxResponse.success && trxResponse.transactions) {
                    transactions = trxResponse.transactions || [];
                    
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
            }
        } catch (error) {
            console.error('❌ Error loading balance:', error);
            if (!silent) updateLoadingState('transactions', 'error');
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
        
        // Reset state
        selectedVoucher = null;
        selectedProofFile = null;
        selectedRekening = null;
        
        if (elements.voucherApplied) elements.voucherApplied.style.display = 'none';
        if (elements.voucherCodeInput) elements.voucherCodeInput.value = '';
        if (elements.uploadSection) elements.uploadSection.style.display = 'none';
        if (elements.uploadPreview) elements.uploadPreview.style.display = 'none';
        if (elements.rekeningPreview) elements.rekeningPreview.style.display = 'none';
        if (elements.proofUrl) elements.proofUrl.value = '';
        
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
        
        vibrate(10);
    }

    function closeDepositModal() {
        if (!elements.depositModal) return;
        elements.depositModal.classList.remove('active');
        if (elements.depositForm) elements.depositForm.reset();
    }

    function onPaymentMethodChange() {
        const methodValue = elements.paymentMethod?.value;
        
        if (methodValue === 'qris') {
            // QRIS - sembunyikan upload section dan preview
            if (elements.uploadSection) elements.uploadSection.style.display = 'none';
            if (elements.rekeningPreview) elements.rekeningPreview.style.display = 'none';
        } else if (methodValue && methodValue !== '') {
            // Rekening manual - tampilkan upload section dan preview
            const rekeningId = parseInt(methodValue);
            const rekening = allRekeningList.find(r => r.id === rekeningId);
            
            if (rekening) {
                selectedRekening = rekening;
                
                // Tampilkan preview
                if (elements.rekeningPreview) {
                    elements.rekeningPreview.style.display = 'block';
                    if (elements.previewLogo) elements.previewLogo.src = rekening.logo_url || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank';
                    if (elements.previewBank) elements.previewBank.textContent = rekening.nama || '-';
                    if (elements.previewAccountNumber) elements.previewAccountNumber.textContent = rekening.nomor || '-';
                    if (elements.previewOwner) elements.previewOwner.textContent = rekening.pemilik || '-';
                }
                
                // Tampilkan upload section
                if (elements.uploadSection) elements.uploadSection.style.display = 'block';
            }
        } else {
            // Tidak ada metode dipilih
            if (elements.rekeningPreview) elements.rekeningPreview.style.display = 'none';
            if (elements.uploadSection) elements.uploadSection.style.display = 'none';
        }
    }

    // Voucher Functions
    function showVoucherSelection() {
        if (!elements.voucherSelectionModal) return;
        
        // Load user vouchers
        const voucherList = document.getElementById('voucherList');
        if (!voucherList) return;
        
        if (userVouchers.length === 0) {
            voucherList.innerHTML = '<div class="empty-state"><i class="fas fa-gift"></i><p>Anda belum memiliki voucher</p></div>';
        } else {
            let html = '';
            userVouchers.forEach(voucher => {
                if (!voucher.used) {
                    html += `
                        <div class="voucher-item" onclick="window.website.selectVoucher(${voucher.id})">
                            <div class="voucher-icon">
                                <i class="fas fa-ticket-alt"></i>
                            </div>
                            <div class="voucher-info">
                                <div class="voucher-name">${escapeHtml(voucher.nama)}</div>
                                <div class="voucher-code">${escapeHtml(voucher.kode)}</div>
                                <div class="voucher-desc">${escapeHtml(voucher.deskripsi || '')}</div>
                            </div>
                            <div class="voucher-value">
                                ${voucher.reward_type === 'saldo' ? '+' + formatRupiah(voucher.reward_data?.amount || 0) : ''}
                            </div>
                        </div>
                    `;
                }
            });
            
            if (html === '') {
                voucherList.innerHTML = '<div class="empty-state"><i class="fas fa-gift"></i><p>Semua voucher sudah digunakan</p></div>';
            } else {
                voucherList.innerHTML = html;
            }
        }
        
        elements.voucherSelectionModal.classList.add('active');
    }

    function closeVoucherSelection() {
        if (elements.voucherSelectionModal) {
            elements.voucherSelectionModal.classList.remove('active');
        }
    }

    function selectVoucher(voucherId) {
        const voucher = userVouchers.find(v => v.id == voucherId);
        if (!voucher) return;
        
        selectedVoucher = voucher;
        
        if (elements.voucherCodeInput) elements.voucherCodeInput.value = voucher.kode;
        if (elements.voucherApplied) {
            elements.voucherApplied.style.display = 'flex';
            if (elements.appliedVoucherName) elements.appliedVoucherName.textContent = voucher.nama;
        }
        
        closeVoucherSelection();
        showToast(`Voucher ${voucher.nama} dipilih`, 'success');
    }

    function removeVoucher() {
        selectedVoucher = null;
        if (elements.voucherCodeInput) elements.voucherCodeInput.value = '';
        if (elements.voucherApplied) elements.voucherApplied.style.display = 'none';
    }

    // Upload Functions
    function setupUploadArea() {
        const uploadArea = elements.uploadArea;
        const fileInput = elements.proofFile;
        
        if (!uploadArea || !fileInput) return;
        
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    function handleFileSelect(file) {
        // Validasi tipe file
        if (!file.type.match('image.*')) {
            showToast('Hanya file gambar yang diperbolehkan', 'error');
            return;
        }
        
        // Validasi ukuran (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('Ukuran file maksimal 2MB', 'error');
            return;
        }
        
        selectedProofFile = file;
        
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            if (elements.previewImage) elements.previewImage.src = e.target.result;
            if (elements.uploadPreview) elements.uploadPreview.style.display = 'block';
            if (elements.uploadArea) elements.uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function removeUpload() {
        selectedProofFile = null;
        if (elements.proofFile) elements.proofFile.value = '';
        if (elements.uploadPreview) elements.uploadPreview.style.display = 'none';
        if (elements.uploadArea) elements.uploadArea.style.display = 'flex';
        if (elements.proofUrl) elements.proofUrl.value = '';
    }

    async function uploadProofFile(file) {
        // Implementasi upload ke server
        // Untuk sementara, return dummy URL
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.readAsDataURL(file);
        });
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
            let proof_url = null;

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
                
                // Validasi upload file untuk rekening manual
                if (!selectedProofFile) {
                    showToast('Upload bukti transfer wajib diisi', 'warning');
                    showLoading(false);
                    return;
                }
                
                // Upload file
                proof_url = await uploadProofFile(selectedProofFile);
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
                    voucher_id: selectedVoucher?.id,
                    proof_url: proof_url,
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
                    showToast('Deposit berhasil dibuat, silakan tunggu konfirmasi admin', 'success');
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
                } else if (status === 'failed') {
                    showToast('❌ Pembayaran gagal', 'error');
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                    closeConfirmDepositModal();
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
        // Jika deposit QRIS dan status pending, ambil data QRIS dari server
        if (transaction.transaction_type === 'deposit' &&
          transaction.payment_method === 'qris' &&
          transaction.status === 'pending') {

          // Ambil data deposit terbaru dari server
          const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${transaction.id}`, {
            method: 'GET'
          });

          if (response.success && response.deposit) {
            const deposit = response.deposit;
            // Gabungkan data deposit dengan data transaksi yang sudah ada
            const updatedTransaction = {
              ...transaction,
              ...deposit,
              cashify_qr_image_url: deposit.cashify_qr_image_url || transaction.cashify_qr_image_url,
              cashify_unique_nominal: deposit.cashify_unique_nominal || transaction.cashify_unique_nominal,
              cashify_expired_at: deposit.cashify_expired_at || transaction.cashify_expired_at,
              cashify_transaction_id: deposit.cashify_transaction_id || transaction.cashify_transaction_id
            };
            renderTransactionDetail(updatedTransaction);
          } else {
            // Jika gagal ambil data terbaru, tetap gunakan data yang ada
            renderTransactionDetail(transaction);
          }
        } else {
          // Untuk transaksi lain, render detail biasa
          renderTransactionDetail(transaction);
        }

        if (detailLoading) detailLoading.style.display = 'none';

      } catch (error) {
        console.error('❌ Error loading transaction detail:', error);
        if (detailLoading) detailLoading.style.display = 'none';
        if (detailError) detailError.style.display = 'block';

        // Tampilkan pesan error yang lebih informatif
        if (detailError) {
          detailError.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat detail transaksi: ${error.message || 'Terjadi kesalahan'}</p>
                `;
        }
      }
    }

    function renderTransactionDetail(transaction) {
      const detailContent = document.getElementById('detailContent');
      if (!detailContent) return;

      // Tentukan icon berdasarkan tipe
      const typeIcon = transaction.transaction_type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up';
      const typeColor = transaction.transaction_type === 'deposit' ? 'var(--success-color)' : 'var(--danger-color)';
      const typeText = transaction.transaction_type === 'deposit' ? 'DEPOSIT' : 'WITHDRAW';

      // Format status
      let statusColor = '';
      let statusIcon = '';
      let statusText = (transaction.status || 'pending').toUpperCase();

      switch (transaction.status) {
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

      // Format metode pembayaran
      let paymentMethodText = '';
      let paymentIcon = '';

      if (transaction.payment_method === 'qris') {
        paymentMethodText = 'QRIS (Otomatis)';
        paymentIcon = 'fa-qrcode';
      } else if (transaction.rekening_nama) {
        paymentMethodText = `${transaction.rekening_nama} - ${transaction.rekening_nomor}`;
        paymentIcon = 'fa-university';
      } else {
        paymentMethodText = 'Transfer Manual';
        paymentIcon = 'fa-money-bill-transfer';
      }

      // HTML detail
      let html = `
            <div class="detail-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div class="detail-icon" style="width: 48px; height: 48px; border-radius: 12px; background: rgba(64, 167, 227, 0.1); display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${typeIcon}" style="font-size: 24px; color: ${typeColor};"></i>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--tg-hint-color);">${typeText}</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${typeColor};">${formatRupiah(transaction.amount)}</div>
                </div>
            </div>
            
            <div class="detail-section" style="background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">Status</span>
                    <span style="color: ${statusColor}; font-weight: 600;">
                        <i class="fas ${statusIcon}" style="margin-right: 4px;"></i> ${statusText}
                    </span>
                </div>
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">ID Transaksi</span>
                    <span style="font-family: monospace;">#${transaction.id}</span>
                </div>
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">Waktu</span>
                    <span>${formatDate(transaction.created_at, true)}</span>
                </div>
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">Metode</span>
                    <span><i class="fas ${paymentIcon}" style="margin-right: 4px;"></i> ${escapeHtml(paymentMethodText)}</span>
                </div>
        `;

    if (transaction.status === 'rejected' && transaction.rejection_reason) {
      html += `
            <div class="detail-message" style="margin-top: 16px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; font-size: 12px; color: var(--tg-hint-color); border-left: 3px solid var(--danger-color);">
                <i class="fas fa-exclamation-circle" style="margin-right: 6px; color: var(--danger-color);"></i>
                <strong>Alasan Penolakan:</strong> ${escapeHtml(transaction.rejection_reason)}
            </div>
        `;
    }

      // Untuk deposit QRIS - tampilkan informasi QRIS
      if (transaction.transaction_type === 'deposit' && transaction.payment_method === 'qris') {
        html += `
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">Nominal</span>
                    <span>${formatRupiah(transaction.amount)}</span>
                </div>
            `;

        // Gunakan cashify_unique_nominal dari deposit
        const uniqueNominal = transaction.cashify_unique_nominal || 0;
        if (uniqueNominal > 0) {
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Kode Unik</span>
                        <span>${formatRupiah(uniqueNominal)}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Total Bayar</span>
                        <span style="color: var(--success-color); font-weight: 600;">${formatRupiah(transaction.amount + uniqueNominal)}</span>
                    </div>
                `;
        }

        const expiredAt = transaction.cashify_expired_at || transaction.expired_at;
        if (expiredAt) {
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Waktu Expired</span>
                        <span id="expiredTimeDisplay">${formatDate(expiredAt, true)}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Sisa Waktu</span>
                        <span id="countdownTimer" style="color: var(--warning-color); font-weight: 600;">Menghitung...</span>
                    </div>
                `;
        }

        if (transaction.cashify_transaction_id) {
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Ref. Cashify</span>
                        <span style="font-family: monospace; font-size: 11px;">${transaction.cashify_transaction_id.substring(0, 16)}...</span>
                    </div>
                `;
        }
      }

      // Untuk deposit rekening manual - TAMBAHKAN PREVIEW REKENING
      if (transaction.transaction_type === 'deposit' && transaction.payment_method !== 'qris') {
        if (transaction.rekening_nama) {
          html += `
                    <div class="rekening-detail-preview" style="margin: 16px 0; padding: 16px; background: rgba(64, 167, 227, 0.05); border-radius: 12px; border-left: 4px solid var(--primary-color);">
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                            <img src="${escapeHtml(transaction.rekening_logo || 'https://via.placeholder.com/48x48/40a7e3/ffffff?text=Bank')}" 
                                 style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">
                            <div>
                                <div style="font-size: 16px; font-weight: 600;">${escapeHtml(transaction.rekening_nama)}</div>
                                <div style="font-size: 12px; color: var(--tg-hint-color);">Tujuan Transfer</div>
                            </div>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--tg-hint-color);">Nomor Rekening</span>
                            <span style="display: flex; align-items: center; gap: 8px;">
                                ${escapeHtml(transaction.rekening_nomor || '-')}
                                <button class="copy-btn" onclick="window.website.copyToClipboardText('${escapeHtml(transaction.rekening_nomor || '')}')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </span>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between;">
                            <span style="color: var(--tg-hint-color);">Atas Nama</span>
                            <span>${escapeHtml(transaction.rekening_pemilik || '-')}</span>
                        </div>
                    </div>
                `;
        }

        // Ubah expired menjadi 1 jam
        if (transaction.expired_at) {
          const expiredAt = transaction.expired_at;
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Batas Pembayaran</span>
                        <span>${formatDate(expiredAt, true)}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Sisa Waktu</span>
                        <span id="countdownTimer" style="color: var(--warning-color); font-weight: 600;">Menghitung...</span>
                    </div>
                `;
        }
        
        // Tampilkan bukti transfer jika ada
        if (transaction.proof_url) {
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Bukti Transfer</span>
                        <a href="${transaction.proof_url}" target="_blank" style="color: var(--primary-color);">
                            <i class="fas fa-image"></i> Lihat Bukti
                        </a>
                    </div>
                `;
        }
      }

      // Untuk withdraw
      if (transaction.transaction_type === 'withdraw') {
        if (transaction.rekening_nama) {
          html += `
                    <div class="rekening-detail-preview withdraw" style="margin: 16px 0; padding: 16px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border-left: 4px solid var(--danger-color);">
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                            <img src="${escapeHtml(transaction.rekening_logo || 'https://via.placeholder.com/48x48/40a7e3/ffffff?text=Bank')}" 
                                 style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">
                            <div>
                                <div style="font-size: 16px; font-weight: 600;">${escapeHtml(transaction.rekening_nama)}</div>
                                <div style="font-size: 12px; color: var(--tg-hint-color);">Tujuan Withdraw</div>
                            </div>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--tg-hint-color);">Nomor Rekening</span>
                            <span>${escapeHtml(transaction.rekening_nomor || '-')}</span>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between;">
                            <span style="color: var(--tg-hint-color);">Atas Nama</span>
                            <span>${escapeHtml(transaction.rekening_pemilik || '-')}</span>
                        </div>
                    </div>
                `;
        }

        if (transaction.processed_at) {
          html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Diproses Pada</span>
                        <span>${formatDate(transaction.processed_at, true)}</span>
                    </div>
                `;
        }
      }

      // Tambahkan pesan status jika ada
      if (transaction.status_message) {
        html += `
                <div class="detail-message" style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; font-size: 12px; color: var(--tg-hint-color); border-left: 3px solid ${statusColor};">
                    <i class="fas fa-info-circle" style="margin-right: 6px; color: ${statusColor};"></i>
                    ${escapeHtml(transaction.status_message)}
                </div>
            `;
      }

      html += `</div>`;

      // Tambahkan tombol aksi berdasarkan status
      if (transaction.transaction_type === 'deposit' &&
        transaction.payment_method === 'qris' &&
        transaction.status === 'pending') {

        html += `
                <button class="btn-primary" style="width: 100%; margin-top: 16px;" onclick="window.website.showQrisPendingModalFromDetail(${transaction.id})">
                    <i class="fas fa-qrcode"></i> Lihat QRIS
                </button>
            `;
      }

      html += `
            <button class="btn-secondary" style="width: 100%; margin-top: 8px;" onclick="window.website.closeTransactionDetail()">
                Tutup
            </button>
        `;

      detailContent.innerHTML = html;

      // Mulai countdown timer jika ada expired_at
      if ((transaction.transaction_type === 'deposit' && transaction.payment_method === 'qris' && transaction.status === 'pending') ||
        (transaction.transaction_type === 'deposit' && transaction.payment_method !== 'qris' && transaction.status === 'pending')) {
        const expiredAt = transaction.cashify_expired_at || transaction.expired_at;
        if (expiredAt) {
          startCountdownTimer(expiredAt);
        }
      }
    }

    // Fungsi untuk memulai countdown timer
    function startCountdownTimer(expiredAt) {
      const timerElement = document.getElementById('countdownTimer');
      if (!timerElement) return;

      const expiredTime = new Date(expiredAt).getTime();

      function updateTimer() {
        const now = new Date().getTime();
        const distance = expiredTime - now;

        if (distance < 0) {
          timerElement.textContent = 'Expired';
          timerElement.style.color = 'var(--danger-color)';
          return;
        }

        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let timeString = '';
        if (hours > 0) {
          timeString = `${hours}j ${minutes}m ${seconds}d`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}d`;
        } else {
          timeString = `${seconds}d`;
        }

        timerElement.textContent = timeString;

        // Ubah warna jika mendekati expired (kurang dari 5 menit)
        if (distance < 5 * 60 * 1000) {
          timerElement.style.color = 'var(--danger-color)';
        } else {
          timerElement.style.color = 'var(--warning-color)';
        }
      }

      // Update setiap detik
      updateTimer();
      const timerInterval = setInterval(updateTimer, 1000);

      // Hentikan interval ketika modal ditutup
      const closeHandler = () => {
        clearInterval(timerInterval);
        document.getElementById('closeTransactionDetailModal')?.removeEventListener('click', closeHandler);
      };
      document.getElementById('closeTransactionDetailModal')?.addEventListener('click', closeHandler);
    }

    async function showQrisPendingModalFromDetail(depositId) {
      console.log(`📋 Opening QRIS modal for deposit ID: ${depositId}`);
    
      // Tutup modal detail transaksi terlebih dahulu
      closeTransactionDetail();
    
      // Ambil data deposit terbaru
      try {
        showLoading(true);
        const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
          method: 'GET'
        });
    
        if (response.success && response.deposit) {
          const deposit = response.deposit;
          showQrisPendingModal(deposit);
        } else {
          showToast('Gagal memuat data QRIS', 'error');
        }
      } catch (error) {
        console.error('❌ Error loading deposit for QRIS modal:', error);
        showToast('Gagal memuat data QRIS: ' + (error.message || 'Terjadi kesalahan'), 'error');
      } finally {
        showLoading(false);
      }
    }

    function showQrisPending(depositId) {
      // Panggil fungsi baru
      showQrisPendingModalFromDetail(depositId);
    }

    function closeTransactionDetail() {
      const modal = document.getElementById('transactionDetailModal');
      if (modal) modal.classList.remove('active');
      selectedTransaction = null;
    }

    function closeQrisPending() {
      const modal = document.getElementById('qrisPendingModal');
      if (modal) modal.classList.remove('active');

      if (pendingStatusInterval) {
        clearInterval(pendingStatusInterval);
        pendingStatusInterval = null;
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
        expired_at: deposit.cashify_expired_at || deposit.expired_at,
        transaction_id: deposit.cashify_transaction_id,
        status: deposit.status
      };

      let statusWarning = '';
      if (deposit.status === 'expired') {
        statusWarning = '<div class="qris-expired-warning"><i class="fas fa-exclamation-triangle"></i> QRIS ini telah kadaluwarsa</div>';
      } else if (deposit.status === 'failed') {
        statusWarning = '<div class="qris-expired-warning" style="background: rgba(239,68,68,0.1); color: var(--danger-color);"><i class="fas fa-times-circle"></i> Pembayaran gagal</div>';
      }

      // Hitung sisa waktu untuk countdown
      let countdownHtml = '';
      if (deposit.status === 'pending' && qrisData.expired_at) {
        countdownHtml = `
                <div class="detail-row">
                    <span class="detail-label">Sisa Waktu:</span>
                    <span class="detail-value" id="qrisCountdownTimer" style="color: var(--warning-color); font-weight: 600;">Menghitung...</span>
                </div>
            `;
      }

      body.innerHTML = `
            <div class="qris-container">
                <img src="${qrisData.qr_image_url}" alt="QRIS" class="qris-image" style="max-width: 100%;">
            </div>
            
            ${statusWarning}
            
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
                ${countdownHtml}
                ${qrisData.transaction_id ? `
                <div class="detail-row">
                    <span class="detail-label">ID Transaksi:</span>
                    <span class="detail-value" style="font-size: 11px;">${qrisData.transaction_id.substring(0, 20)}...</span>
                </div>
                ` : ''}
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
                ${deposit.status === 'pending' ? `
                <button type="button" class="btn-primary" onclick="window.website.checkPendingStatus(${deposit.id})">
                    <i class="fas fa-sync-alt"></i> Cek Status
                </button>
                ` : ''}
            </div>
        `;

      modal.classList.add('active');

      if (deposit.status === 'pending') {
        startPendingStatusCheck(deposit.id);

        // Mulai countdown timer di modal QRIS
        if (qrisData.expired_at) {
          startQrisCountdownTimer(qrisData.expired_at);
        }
      }
    }

    function startQrisCountdownTimer(expiredAt) {
      const timerElement = document.getElementById('qrisCountdownTimer');
      if (!timerElement) return;

      const expiredTime = new Date(expiredAt).getTime();

      function updateTimer() {
        const now = new Date().getTime();
        const distance = expiredTime - now;

        if (distance < 0) {
          timerElement.textContent = 'Expired';
          timerElement.style.color = 'var(--danger-color)';
          return;
        }

        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let timeString = '';
        if (hours > 0) {
          timeString = `${hours}j ${minutes}m ${seconds}d`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}d`;
        } else {
          timeString = `${seconds}d`;
        }

        timerElement.textContent = timeString;

        // Ubah warna jika mendekati expired (kurang dari 5 menit)
        if (distance < 5 * 60 * 1000) {
          timerElement.style.color = 'var(--danger-color)';
        } else {
          timerElement.style.color = 'var(--warning-color)';
        }
      }

      // Update setiap detik
      updateTimer();
      const timerInterval = setInterval(updateTimer, 1000);

      // Hentikan interval ketika modal ditutup
      const closeHandler = () => {
        clearInterval(timerInterval);
        document.getElementById('closeQrisPendingModal')?.removeEventListener('click', closeHandler);
      };
      document.getElementById('closeQrisPendingModal')?.addEventListener('click', closeHandler);
    }

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
              await handleDepositSuccess(depositId);

              // Refresh transaction list
              await loadUserBalance();
              const activePage = document.querySelector('.nav-item.active')?.dataset.page;
              if (activePage === 'bank') {
                renderBankPage();
              }
            } else if (status === 'expired') {
              showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
              clearInterval(pendingStatusInterval);
              pendingStatusInterval = null;

              // Update modal jika masih terbuka
              const modal = document.getElementById('qrisPendingModal');
              if (modal && modal.classList.contains('active')) {
                // Refresh data deposit
                const depositResponse = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
                  method: 'GET'
                });
                if (depositResponse.success && depositResponse.deposit) {
                  closeQrisPending();
                  showQrisPendingModal(depositResponse.deposit);
                }
              }
            } else if (status === 'failed') {
              showToast('❌ Pembayaran gagal', 'error');
              clearInterval(pendingStatusInterval);
              pendingStatusInterval = null;

              // Update modal jika masih terbuka
              const modal = document.getElementById('qrisPendingModal');
              if (modal && modal.classList.contains('active')) {
                const depositResponse = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
                  method: 'GET'
                });
                if (depositResponse.success && depositResponse.deposit) {
                  closeQrisPending();
                  showQrisPendingModal(depositResponse.deposit);
                }
              }
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
            await handleDepositSuccess(depositId);

            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
            if (activePage === 'bank') {
              renderBankPage();
            }
          } else if (status === 'expired') {
            showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
            clearInterval(pendingStatusInterval);
            pendingStatusInterval = null;

            // Refresh modal
            const depositResponse = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
              method: 'GET'
            });
            if (depositResponse.success && depositResponse.deposit) {
              closeQrisPending();
              showQrisPendingModal(depositResponse.deposit);
            }
          } else if (status === 'failed') {
            showToast('❌ Pembayaran gagal', 'error');
            clearInterval(pendingStatusInterval);
            pendingStatusInterval = null;

            const depositResponse = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
              method: 'GET'
            });
            if (depositResponse.success && depositResponse.deposit) {
              closeQrisPending();
              showQrisPendingModal(depositResponse.deposit);
            }
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
            
            // Setelah user dan website loaded, matikan loading overlay
            showLoading(false);
            
            // Tampilkan halaman home dengan skeleton
            renderHomePage();
            renderBanners();
            
            // Load data lainnya di background
            Promise.all([
                loadTampilan().then(() => {
                    applyTampilan();
                    renderBanners();
                }),
                loadAllData()
            ]).catch(error => {
                console.error('Error loading data:', error);
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

            // ==================== NEW SETUP ====================
            // Setup upload area
            setupUploadArea();
            
            // Setup voucher selection modal close button
            if (elements.closeVoucherSelectionModal) {
                elements.closeVoucherSelectionModal.addEventListener('click', closeVoucherSelection);
            }
            
            // Setup payment method change listener
            if (elements.paymentMethod) {
                elements.paymentMethod.addEventListener('change', onPaymentMethodChange);
            }
            
            // Setup copy button
            if (elements.copyAccountBtn) {
                elements.copyAccountBtn.addEventListener('click', () => copyToClipboard('previewAccountNumber'));
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
                if (e.target === elements.voucherSelectionModal) closeVoucherSelection();
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
      // Fungsi lama
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
      showQrisPendingModalFromDetail,
      checkPendingStatus,
      closeTransactionDetail,
      closeQrisPending,
      
      // Fungsi baru
      copyToClipboard,
      copyToClipboardText: (text) => {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Teks berhasil disalin!', 'success');
        }).catch(() => {
          showToast('Gagal menyalin teks', 'error');
        });
      },
      onPaymentMethodChange,
      showVoucherSelection,
      closeVoucherSelection,
      selectVoucher,
      removeVoucher,
      removeUpload
    };

    // ==================== START ====================
    init();
})();
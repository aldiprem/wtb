// website.js - Website Store Front (FIXED VERSION WITH AUTO-LOADING & REAL-TIME UPDATES)
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = (function() {
        if (window.location.hostname.includes('github.io')) {
            return 'https://supports-lease-honest-pottersss.trycloudflare.com';
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

    // ==================== PERBAIKAN: Data loading progress ====================
    let dataLoadComplete = {
        user: false,
        website: false,
        tampilan: false,
        products: false,
        promos: false,
        rekening: false,
        transactions: false,
        vouchers: false,
        activities: false
    };

    // ==================== PERBAIKAN: Status check intervals ====================
    let pendingStatusIntervals = new Map(); // Untuk menyimpan interval per deposit ID
    let transactionStatusCheckInterval = null; // Interval global untuk cek status transaksi pending

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

    // ==================== PERBAIKAN: Loading overlay hanya untuk data kritis ====================
    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            // Hanya tunjukkan loading overlay untuk data kritis (user & website)
            // Jika semua data kritis sudah selesai, sembunyikan overlay
            if (dataLoadComplete.website && dataLoadComplete.user) {
                elements.loadingOverlay.style.display = 'none';
            } else {
                elements.loadingOverlay.style.display = show ? 'flex' : 'none';
            }
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

    // ==================== PERBAIKAN: Progressive Loading dengan background loading ====================
    function updateLoadingState(dataType, status) {
        loadingStates[dataType] = status;
        console.log(`📊 Loading state ${dataType}: ${status}`);
        
        if (status === 'loaded') {
            dataLoadComplete[dataType] = true;
        }
        
        // Selalu update halaman aktif dengan data yang tersedia (termasuk dummy)
        const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'home';
        switch (activePage) {
            case 'home': renderHomePage(); break;
            case 'aktivitas': renderAktivitasPage(); break;
            case 'promo': renderPromoPage(); break;
            case 'bank': renderBankPage(); break;
            case 'profile': renderProfilePage(); break;
        }
        
        // Cek apakah semua data kritis sudah selesai
        if (dataLoadComplete.website && dataLoadComplete.user) {
            showLoading(false);
        }
    }

    function isDataLoaded(dataType) {
        return loadingStates[dataType] === 'loaded';
    }

    // ==================== PERBAIKAN: Load balance langsung dari endpoint khusus ====================
    async function loadUserBalance() {
        if (!currentWebsite || !currentUser) {
            balance = 0;
            updateLoadingState('transactions', 'loaded');
            return balance;
        }
        
        try {
            console.log(`📡 Fetching balance for user ${currentUser.id} on website ${currentWebsite.id}`);
            
            // Gunakan endpoint khusus untuk balance
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/transactions/user/${currentUser.id}/balance?website_id=${currentWebsite.id}`,
                { method: 'GET' }
            );
    
            if (response.success) {
                balance = response.balance || 0;
                console.log(`💰 Balance loaded: ${balance}`);
                
                // Update semua tampilan balance
                updateAllBalanceDisplays();
                
                updateLoadingState('transactions', 'loaded');
                return balance;
            } else {
                // Fallback ke endpoint lama
                return await loadUserBalanceFromTransactions();
            }
        } catch (error) {
            console.error('❌ Error loading balance from dedicated endpoint:', error);
            // Fallback ke endpoint lama
            return await loadUserBalanceFromTransactions();
        }
    }

    // Fallback function
    async function loadUserBalanceFromTransactions() {
        try {
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
                return balance;
            }
        } catch (error) {
            console.error('❌ Error loading balance from transactions:', error);
            updateLoadingState('transactions', 'error');
        }
        return 0;
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

    // ==================== PERBAIKAN: Auto-check status untuk semua transaksi pending ====================
    function startTransactionStatusChecker() {
        if (transactionStatusCheckInterval) {
            clearInterval(transactionStatusCheckInterval);
        }
        
        // Cek setiap 10 detik
        transactionStatusCheckInterval = setInterval(async () => {
            if (!currentWebsite || !currentUser) return;
            
            try {
                // Ambil semua transaksi yang statusnya pending
                const response = await fetchWithRetry(
                    `${API_BASE_URL}/api/transactions/user/${currentUser.id}?website_id=${currentWebsite.id}&status=pending&limit=50`,
                    { method: 'GET' }
                );
                
                if (response.success && response.transactions) {
                    const pendingTransactions = response.transactions.filter(t => 
                        t.status === 'pending' || t.status === 'processing'
                    );
                    
                    // Cek status untuk setiap transaksi pending
                    for (const trx of pendingTransactions) {
                        await checkTransactionStatus(trx);
                    }
                }
            } catch (error) {
                console.error('Error in transaction status checker:', error);
            }
        }, 10000); // 10 detik
    }

    async function checkTransactionStatus(transaction) {
        if (!transaction || transaction.status !== 'pending') return;
        
        try {
            if (transaction.transaction_type === 'deposit' && transaction.cashify_transaction_id) {
                // Cek ke endpoint status deposit
                const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
                    method: 'POST',
                    body: JSON.stringify({ deposit_id: transaction.id })
                });

                if (response.success && response.deposit) {
                    const newStatus = response.deposit.status;
                    
                    if (newStatus !== transaction.status) {
                        console.log(`🔄 Transaction ${transaction.id} status changed: ${transaction.status} → ${newStatus}`);
                        
                        // Update status di array lokal
                        const index = transactions.findIndex(t => t.id === transaction.id);
                        if (index !== -1) {
                            transactions[index] = { ...transactions[index], ...response.deposit };
                        }
                        
                        // Reload balance
                        await loadUserBalance();
                        
                        // Update tampilan jika perlu
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
                        
                        // Tampilkan notifikasi
                        if (newStatus === 'success') {
                            showToast('✅ Pembayaran berhasil!', 'success');
                        } else if (newStatus === 'expired') {
                            showToast('⚠️ Transaksi kadaluwarsa', 'warning');
                        } else if (newStatus === 'failed') {
                            showToast('❌ Pembayaran gagal', 'error');
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error checking transaction ${transaction.id} status:`, error);
        }
    }

    // ==================== PERBAIKAN: Data loading functions with background loading ====================
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
            
            // Update tampilan setelah data loaded
            applyTampilan();
            renderBanners();
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
                
                // PERBAIKAN: Load balance dari data atau langsung dari endpoint khusus
                if (d.balance !== undefined) {
                    balance = d.balance;
                    console.log(`💰 Balance from initial data: ${balance}`);
                }
                
                if (d.transactions) {
                    transactions = d.transactions || [];
                }
                
                updateLoadingState('transactions', 'loaded');
                updateAllBalanceDisplays();
                
                if (d.templates) {
                    for (const template of d.templates) {
                        const templateData = template.template_data || {};
                        if (templateData.font_file_data) {
                            injectFontStyle(templateData.font_family, templateData.font_file_data);
                        }
                    }
                }
                
                console.log('✅ Data loaded successfully');
                
                // Mulai auto-check status untuk transaksi pending
                startTransactionStatusChecker();
                
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

    // ==================== RENDER FUNCTIONS ====================
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

    function renderTransactionList(transactionsData) {
        if (transactionsData.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada transaksi</p></div>';
        }
        
        // Filter berdasarkan status jika ada filter
        let filtered = [...transactionsData];
        if (transactionFilter.status !== 'all' && isDataLoaded('transactions')) {
            filtered = filtered.filter(t => t.status === transactionFilter.status);
        }
        
        return filtered.slice(0, 20).map(trx => {
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
    function filterTransactions(status) {
        console.log(`🔍 Filtering transactions by status: ${status}`);
        transactionFilter.status = status;
        
        // Render ulang halaman bank dengan filter baru
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'bank') {
            renderBankPage();
        }
    }

    // ==================== PERBAIKAN: Deposit functions with auto-status check ====================
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
                    
                    // Tambahkan transaksi baru ke array
                    if (response.deposit_id) {
                        // Reload transactions setelah deposit dibuat
                        setTimeout(() => {
                            loadUserBalance();
                            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                            if (activePage === 'bank') {
                                renderBankPage();
                            }
                        }, 1000);
                    }
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
                        
                        // Update status di array transactions
                        const index = transactions.findIndex(t => t.id === depositId);
                        if (index !== -1) {
                            transactions[index].status = 'expired';
                        }
                        
                        // Update tampilan
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
                    } else if (status === 'failed') {
                        showToast('❌ Pembayaran gagal', 'error');
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        closeConfirmDepositModal();
                        
                        // Update status di array transactions
                        const index = transactions.findIndex(t => t.id === depositId);
                        if (index !== -1) {
                            transactions[index].status = 'failed';
                        }
                        
                        // Update tampilan
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        }, 5000);
    }

    async function handleDepositSuccess(depositId) {
        showToast('✅ Deposit berhasil!', 'success');
        
        await loadUserBalance();
        updateAllBalanceDisplays();
        
        // Update status di array transactions
        const index = transactions.findIndex(t => t.id === depositId);
        if (index !== -1) {
            transactions[index].status = 'success';
        }
        
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'bank') {
            renderBankPage();
        } else if (activePage === 'profile') {
            renderProfilePage();
        }
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        // Tampilkan loading overlay hanya untuk data kritis
        showLoading(true);
        
        try {
            // Reset loading states
            Object.keys(loadingStates).forEach(key => {
                loadingStates[key] = 'loading';
                dataLoadComplete[key] = false;
            });
            
            // Load data kritis dulu (website & user)
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadUserFromTelegram();
            await checkOrCreateUser();
            
            // Data kritis selesai, sembunyikan overlay
            showLoading(false);
            
            // Render halaman awal dengan dummy data
            renderHomePage();
            renderBanners();
            
            // Load tampilan di background
            loadTampilan().then(() => {
                applyTampilan();
                renderBanners();
            });
            
            // Load semua data lainnya di background
            loadAllData().catch(error => {
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
      showQrisPendingModalFromDetail,
      checkPendingStatus,
      closeTransactionDetail,
      closeQrisPending
    };

    // ==================== START ====================
    init();
})();
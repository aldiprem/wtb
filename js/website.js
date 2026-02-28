// website.js - Website Store Front (IMPROVED VERSION WITH PROGRESSIVE LOADING)
(function() {
    'use strict';
    
    console.log('🏪 Website Store - Initializing with Progressive Loading...');

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

    // Loading states untuk progressive loading
    let loadingStates = {
        user: 'loading',      // 'loading', 'loaded', 'error'
        website: 'loading',
        tampilan: 'loading',
        products: 'loading',
        promos: 'loading',
        rekening: 'loading',
        transactions: 'loading',
        vouchers: 'loading',
        activities: 'loading'
    };

    // Data dummy untuk skeleton/placeholder
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

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
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
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HTTP error ${response.status}:`, errorText);
                throw new Error(`HTTP error ${response.status}`);
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
            throw error;
        }
    }

    // ==================== PROGRESSIVE LOADING FUNCTIONS ====================
    function updateLoadingState(dataType, status) {
        loadingStates[dataType] = status;
        console.log(`📊 Loading state ${dataType}: ${status}`);
        
        // Render ulang halaman yang sedang aktif
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

    function getDataWithFallback(dataType, actualData, dummyData) {
        if (isDataLoaded(dataType) && actualData && actualData.length > 0) {
            return actualData;
        }
        return dummyData;
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
            // User dummy untuk testing
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
            }).catch(() => {});
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
            }).catch(err => {
                console.warn('⚠️ Tampilan fetch failed:', err);
                return { success: false };
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

    async function checkStatusManually() {
      if (!currentDeposit) return;
    
      showToast('Mengecek status pembayaran...', 'info');
    
      try {
        const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/status`, {
          method: 'POST',
          body: JSON.stringify({ deposit_id: currentDeposit.id })
        });
    
        if (response.success && response.deposit) {
          const status = response.deposit.status;
    
          if (status === 'success') {
            await handleDepositSuccess(currentDeposit.id);
            closeConfirmDepositModal();
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
                
                const vouchersResponse = await fetchWithRetry(`${API_BASE_URL}/api/voucher/user/${currentUser.id}?website_id=${currentWebsite.id}`, {
                    method: 'GET'
                }).catch(() => ({ success: false }));
                
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

    function changeSort(value) {
        currentFilters.sort = value;
        applyFilters();
        renderHomePage();
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

    async function loadAllData() {
        if (!currentWebsite) return;
        
        try {
            console.log(`📡 Fetching initial data for website ${currentWebsite.id}, user: ${currentUser?.id || 0}`);
            
            // Gunakan endpoint yang benar - website-service sudah menyediakan /api/website/{id}/initial-data
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/website/${currentWebsite.id}/initial-data?user_id=${currentUser?.id || 0}`,
                { method: 'GET' }
            );
    
            console.log('📥 Initial data response:', response);
    
            if (response.success && response.data) {
                const d = response.data;
                
                // Update data
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
                    
                    // Hitung balance
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
                
                // Inject fonts
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
                console.warn('⚠️ Failed to load initial data, using dummy data');
                // Set loading states to error but don't break
                updateLoadingState('products', 'error');
                updateLoadingState('promos', 'error');
                updateLoadingState('rekening', 'error');
                updateLoadingState('transactions', 'error');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat beberapa data', 'warning');
            
            // Set error states but continue
            updateLoadingState('products', 'error');
            updateLoadingState('promos', 'error');
            updateLoadingState('rekening', 'error');
            updateLoadingState('transactions', 'error');
        }
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            // Set semua loading state ke 'loading'
            Object.keys(loadingStates).forEach(key => {
                loadingStates[key] = 'loading';
            });
            
            // Load user dan website terlebih dahulu (wajib)
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadUserFromTelegram();
            await checkOrCreateUser();
            
            // Tampilan minimal sudah ada
            renderHomePage();
            renderBanners();
            
            // Load data lainnya secara paralel
            Promise.all([
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
            
            const closeQrisPendingModal = document.getElementById('closeQrisPendingModal');
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
            
            console.log('✅ Website initialized with progressive loading');
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat website', 'error');
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
        setFilterType,
        setItemFilter,
        changeSort,
        
        // Aktivitas filter
        toggleAktivitasFilter,
        filterAktivitas,
        
        // Transaction filter
        filterTransactions,
        toggleTransactionFilter,
        toggleShowAllRekening,
        
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
        logout,
        
        // Transaction Detail
        openTransactionDetail,
        showQrisPending,
        checkPendingStatus,
        closeTransactionDetail,
        closeQrisPending
    };

    // ==================== START ====================
    init();
})();
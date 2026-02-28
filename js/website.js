// website.js - Website Store Front (FINAL VERSION)
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
        activities: 'loading',
        balance: 'loading'
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
    
    // Deposit state
    let selectedVoucher = null;
    let selectedProofFile = null;
    let selectedRekening = null;
    
    // UI states
    let lastScrollTop = 0;
    let scrollTimer = null;
    let currentBannerIndex = 0;
    let bannerInterval = null;
    let showAllRekening = false;
    let currentDeposit = null;
    let statusCheckInterval = null;
    let pendingStatusInterval = null;

    // Auto-refresh intervals
    let autoRefreshIntervals = {
        transactions: null,
        balance: null
    };

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
        
        // Deposit Modal Elements
        depositModal: document.getElementById('depositModal'),
        depositForm: document.getElementById('depositForm'),
        depositAmount: document.getElementById('depositAmount'),
        paymentMethod: document.getElementById('paymentMethod'),
        closeDepositModal: document.getElementById('closeDepositModal'),
        cancelDepositBtn: document.getElementById('cancelDepositBtn'),
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
        
        // Voucher Selection Modal
        voucherSelectionModal: document.getElementById('voucherSelectionModal'),
        voucherList: document.getElementById('voucherList'),
        closeVoucherSelectionModal: document.getElementById('closeVoucherSelectionModal'),
        
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

    // ==================== COPY TO CLIPBOARD ====================
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
                    updateLoadingState('balance', 'loaded');
                    
                    console.log(`💰 Initial balance loaded: ${balance}`);
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
                
                updateAllBalanceDisplays();
                startAutoRefresh();
                
            } else {
                console.warn('⚠️ Failed to load initial data');
                updateLoadingState('products', 'error');
                updateLoadingState('promos', 'error');
                updateLoadingState('rekening', 'error');
                updateLoadingState('transactions', 'error');
                updateLoadingState('balance', 'error');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat beberapa data', 'warning');
            updateLoadingState('products', 'error');
            updateLoadingState('promos', 'error');
            updateLoadingState('rekening', 'error');
            updateLoadingState('transactions', 'error');
            updateLoadingState('balance', 'error');
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

    // ==================== BALANCE & TRANSACTION FUNCTIONS ====================
    
    function filterTransactions(status) {
        console.log(`🔍 Filtering transactions by status: ${status}`);
        transactionFilter.status = status;
        
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'bank') {
            renderBankPage();
        }
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
            updateLoadingState('balance', 'loaded');
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
                updateLoadingState('balance', 'loaded');
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
                    updateLoadingState('balance', 'loaded');
                    updateAllBalanceDisplays();
                }
            }
        } catch (error) {
            console.error('❌ Error loading balance:', error);
            if (!silent) updateLoadingState('balance', 'error');
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

    // ==================== RENDER FUNCTIONS (Hanya fungsi yang diubah) ====================

    function renderBankPage() {
        if (elements.bannerSlider) {
            elements.bannerSlider.style.display = 'none';
        }
        
        const displayRekening = isDataLoaded('rekening') ? rekeningList : [];
        const displayTransactions = isDataLoaded('transactions') ? transactions : [];
        const displayBalance = isDataLoaded('balance') ? formatRupiah(balance) : 'Rp 0';
    
        const html = `
            <div class="page-content">
                <div class="section-title">
                    <h2><i class="fas fa-university"></i> Bank & Deposit</h2>
                </div>
                
                <div class="balance-card">
                    <div class="balance-label">Saldo Anda</div>
                    <div class="balance-amount" id="balanceAmount">${displayBalance}</div>
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
        
        if (elements.userBalance) {
            elements.userBalance.textContent = formatRupiah(balance);
        }
        
        if (elements.withdrawAmount) {
            elements.withdrawAmount.max = balance;
        }
    }

    function renderTransactionList(transactionsData) {
        if (transactionsData.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada transaksi</p></div>';
        }
        
        let filtered = [...transactionsData];
        if (transactionFilter.status !== 'all') {
            filtered = filtered.filter(t => t.status === transactionFilter.status);
        }
        
        if (filtered.length === 0) {
            return '<div class="empty-state"><i class="fas fa-history"></i><p>Tidak ada transaksi dengan filter ini</p></div>';
        }
        
        return filtered.slice(0, 20).map(trx => {
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
                <div class="transaction-item" data-id="${trx.id}" data-status="${trx.status}"
                     onclick="window.website.openTransactionDetail(${trx.id})" style="cursor: pointer;">
                    <div class="transaction-info">
                        <div class="transaction-icon ${trx.transaction_type}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="transaction-details">
                            <h4>${trx.transaction_type === 'deposit' ? 'Deposit' : 'Withdraw'}</h4>
                            <span class="transaction-meta">
                                <i class="far fa-clock"></i> ${formatDate(trx.created_at)}
                            </span>
                            ${rekeningInfo ? `<span class="transaction-rekening"><i class="fas fa-university"></i> ${rekeningInfo}</span>` : ''}
                            <span class="transaction-status" style="color: ${statusColor};">
                                <i class="fas ${statusIcon}"></i> ${trx.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix} ${formatRupiah(trx.amount)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRekeningList(rekeningData) {
        if (rekeningData.length === 0) {
            return '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-university"></i><p>Belum ada rekening</p></div>';
        }
        
        return rekeningData.map(rek => `
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
                <button class="copy-btn-small" onclick="window.website.copyToClipboardText('${escapeHtml(rek.nomor)}')">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `).join('');
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

                const response = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${transaction.id}`, {
                    method: 'GET'
                });

                if (response.success && response.deposit) {
                    const deposit = response.deposit;
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
                    renderTransactionDetail(transaction);
                }
            } else {
                renderTransactionDetail(transaction);
            }

            if (detailLoading) detailLoading.style.display = 'none';

        } catch (error) {
            console.error('❌ Error loading transaction detail:', error);
            if (detailLoading) detailLoading.style.display = 'none';
            if (detailError) detailError.style.display = 'block';

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

        const typeIcon = transaction.transaction_type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up';
        const typeColor = transaction.transaction_type === 'deposit' ? 'var(--success-color)' : 'var(--danger-color)';
        const typeText = transaction.transaction_type === 'deposit' ? 'DEPOSIT' : 'WITHDRAW';

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

        // Untuk deposit QRIS
        if (transaction.transaction_type === 'deposit' && transaction.payment_method === 'qris') {
            html += `
                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--tg-hint-color);">Nominal</span>
                    <span>${formatRupiah(transaction.amount)}</span>
                </div>
            `;

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
                        <span>${formatDate(expiredAt, true)}</span>
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

        // Untuk deposit rekening manual
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
            
            if (transaction.expired_at) {
                const expiredAt = transaction.expired_at;
                html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Batas Pembayaran</span>
                        <span>${formatDate(expiredAt, true)}</span>
                    </div>
                `;
            }
            
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

        if (transaction.transaction_type === 'withdraw' && transaction.rekening_nama) {
            html += `
                <div class="rekening-detail-preview" style="margin: 16px 0; padding: 16px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border-left: 4px solid var(--danger-color);">
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

            if (transaction.processed_at) {
                html += `
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tg-hint-color);">Diproses Pada</span>
                        <span>${formatDate(transaction.processed_at, true)}</span>
                    </div>
                `;
            }
        }

        if (transaction.status_message) {
            html += `
                <div class="detail-message" style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; font-size: 12px; color: var(--tg-hint-color); border-left: 3px solid ${statusColor};">
                    <i class="fas fa-info-circle" style="margin-right: 6px; color: ${statusColor};"></i>
                    ${escapeHtml(transaction.status_message)}
                </div>
            `;
        }

        html += `</div>`;

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

    // ==================== QRIS PENDING FUNCTIONS ====================

    async function showQrisPendingModalFromDetail(depositId) {
        console.log(`📋 Opening QRIS modal for deposit ID: ${depositId}`);
    
        closeTransactionDetail();
    
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
        }
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

                        await loadUserBalance();
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
                    } else if (status === 'expired') {
                        showToast('⚠️ QRIS telah kadaluwarsa', 'warning');
                        clearInterval(pendingStatusInterval);
                        pendingStatusInterval = null;

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
                        
                        const transaction = transactions.find(t => t.id == depositId);
                        if (transaction) {
                            transaction.status = 'expired';
                            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                            if (activePage === 'bank') {
                                renderBankPage();
                            }
                        }
                    } else if (status === 'failed') {
                        showToast('❌ Pembayaran gagal', 'error');
                        clearInterval(pendingStatusInterval);
                        pendingStatusInterval = null;

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
                        
                        const transaction = transactions.find(t => t.id == depositId);
                        if (transaction) {
                            transaction.status = 'failed';
                            const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                            if (activePage === 'bank') {
                                renderBankPage();
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

                    const depositResponse = await fetchWithRetry(`${API_BASE_URL}/api/transactions/deposit/${depositId}`, {
                        method: 'GET'
                    });
                    if (depositResponse.success && depositResponse.deposit) {
                        closeQrisPending();
                        showQrisPendingModal(depositResponse.deposit);
                    }
                    
                    const transaction = transactions.find(t => t.id == depositId);
                    if (transaction) {
                        transaction.status = 'expired';
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
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
                    
                    const transaction = transactions.find(t => t.id == depositId);
                    if (transaction) {
                        transaction.status = 'failed';
                        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
                        if (activePage === 'bank') {
                            renderBankPage();
                        }
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
        
        // Render halaman tanpa animasi slide
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
            
            // Tampilkan halaman home
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
            
            // Setup upload area
            setupUploadArea();
            
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
            
            if (elements.closeVoucherSelectionModal) {
                elements.closeVoucherSelectionModal.addEventListener('click', closeVoucherSelection);
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
                if (e.target === elements.voucherSelectionModal) closeVoucherSelection();
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
        closeQrisPending,
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
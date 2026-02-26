// voucher.js - Pengaturan Voucher Website
(function() {
    'use strict';
    
    console.log('🎫 Voucher Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let vouchers = [];
    let filteredVouchers = [];
    let activities = [];
    let statistics = {
        total_vouchers: 0,
        active_vouchers: 0,
        total_claims: 0,
        total_used: 0,
        unique_users: 0,
        total_reward: 0
    };
    
    // Pagination
    let currentPage = 1;
    let itemsPerPage = 12;
    let totalPages = 1;
    
    // Filters
    let currentFilter = {
        search: '',
        status: 'all',
        type: 'all'
    };
    
    // Activity Filters
    let activityFilter = {
        search: '',
        type: 'all',
        date: 'all'
    };
    
    // Selected items
    let selectedVoucher = null;
    let selectedVoucherForBroadcast = null;
    let selectedUsers = new Set();
    let broadcastSelectedUsers = new Set();
    
    // Products data from prd.py
    let productsData = {
        layanan: [],
        aplikasi: {},
        items: {}
    };

    // Chart instances
    let claimChart = null;
    let miniChart = null;

    // Mode dummy data (aktif jika endpoint tidak ditemukan)
    let useDummyData = false;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        backToPanel: document.getElementById('backToPanel'),
        refreshBtn: document.getElementById('refreshBtn'),
        
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Voucher Grid
        voucherGrid: document.getElementById('voucherGrid'),
        emptyVoucher: document.getElementById('emptyVoucher'),
        createVoucherBtn: document.getElementById('createVoucherBtn'),
        emptyCreateVoucherBtn: document.getElementById('emptyCreateVoucherBtn'),
        
        // Filters
        voucherSearch: document.getElementById('voucherSearch'),
        voucherStatusFilter: document.getElementById('voucherStatusFilter'),
        voucherTypeFilter: document.getElementById('voucherTypeFilter'),
        
        // Pagination
        voucherPagination: document.getElementById('voucherPagination'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        pageInfo: document.getElementById('pageInfo'),
        
        // Statistics
        statTotalVoucher: document.getElementById('statTotalVoucher'),
        statActiveVoucher: document.getElementById('statActiveVoucher'),
        statTotalClaimed: document.getElementById('statTotalClaimed'),
        statUsedVoucher: document.getElementById('statUsedVoucher'),
        statUniqueUsers: document.getElementById('statUniqueUsers'),
        statTotalReward: document.getElementById('statTotalReward'),
        
        // Charts
        claimChartCanvas: document.getElementById('claimChartCanvas'),
        miniChartCanvas: document.getElementById('miniChartCanvas'),
        
        // Top Vouchers
        topVouchersList: document.getElementById('topVouchersList'),
        
        // Activity
        activityTimeline: document.getElementById('activityTimeline'),
        emptyActivity: document.getElementById('emptyActivity'),
        activitySearch: document.getElementById('activitySearch'),
        activityTypeFilter: document.getElementById('activityTypeFilter'),
        activityDateFilter: document.getElementById('activityDateFilter'),
        
        // Voucher Modal
        voucherModal: document.getElementById('voucherModal'),
        voucherModalTitle: document.getElementById('voucherModalTitle'),
        voucherForm: document.getElementById('voucherForm'),
        voucherId: document.getElementById('voucherId'),
        voucherNama: document.getElementById('voucherNama'),
        voucherKode: document.getElementById('voucherKode'),
        generateKodeBtn: document.getElementById('generateKodeBtn'),
        voucherDeskripsi: document.getElementById('voucherDeskripsi'),
        voucherStartDate: document.getElementById('voucherStartDate'),
        voucherEndDate: document.getElementById('voucherEndDate'),
        voucherStartTime: document.getElementById('voucherStartTime'),
        voucherEndTime: document.getElementById('voucherEndTime'),
        voucherNoExpiry: document.getElementById('voucherNoExpiry'),
        voucherTarget: document.getElementById('voucherTarget'),
        voucherLimit: document.getElementById('voucherLimit'),
        voucherActive: document.getElementById('voucherActive'),
        
        // Manual User Section
        manualUserSection: document.getElementById('manualUserSection'),
        userSearch: document.getElementById('userSearch'),
        userList: document.getElementById('userList'),
        selectedUserCount: document.getElementById('selectedUserCount'),
        clearSelectedUsers: document.getElementById('clearSelectedUsers'),
        
        // Reward Panels
        rewardSaldoPanel: document.getElementById('rewardSaldoPanel'),
        rewardDepositPanel: document.getElementById('rewardDepositPanel'),
        rewardDiskonPanel: document.getElementById('rewardDiskonPanel'),
        rewardSaldo: document.getElementById('rewardSaldo'),
        depositMin: document.getElementById('depositMin'),
        depositMax: document.getElementById('depositMax'),
        depositPercent: document.getElementById('depositPercent'),
        diskonJenis: document.getElementById('diskonJenis'),
        diskonNilai: document.getElementById('diskonNilai'),
        diskonLayanan: document.getElementById('diskonLayanan'),
        diskonAplikasi: document.getElementById('diskonAplikasi'),
        diskonItem: document.getElementById('diskonItem'),
        diskonSemuaProduk: document.getElementById('diskonSemuaProduk'),
        
        closeVoucherModal: document.getElementById('closeVoucherModal'),
        cancelVoucherBtn: document.getElementById('cancelVoucherBtn'),
        
        // Broadcast Modal
        broadcastModal: document.getElementById('broadcastModal'),
        broadcastVoucherInfo: document.getElementById('broadcastVoucherInfo'),
        broadcastTarget: document.getElementById('broadcastTarget'),
        broadcastManualSection: document.getElementById('broadcastManualSection'),
        broadcastUserSearch: document.getElementById('broadcastUserSearch'),
        broadcastUserList: document.getElementById('broadcastUserList'),
        broadcastSelectedCount: document.getElementById('broadcastSelectedCount'),
        clearBroadcastUsers: document.getElementById('clearBroadcastUsers'),
        broadcastMessage: document.getElementById('broadcastMessage'),
        previewVoucherName: document.getElementById('previewVoucherName'),
        previewVoucherCode: document.getElementById('previewVoucherCode'),
        previewCustomMessage: document.getElementById('previewCustomMessage'),
        closeBroadcastModal: document.getElementById('closeBroadcastModal'),
        cancelBroadcastBtn: document.getElementById('cancelBroadcastBtn'),
        confirmBroadcastBtn: document.getElementById('confirmBroadcastBtn'),
        
        // Detail Modal
        detailModal: document.getElementById('detailModal'),
        detailHeader: document.getElementById('detailHeader'),
        detailTabs: document.querySelectorAll('.detail-tab'),
        detailPanels: document.querySelectorAll('.detail-panel'),
        detailInfo: document.getElementById('detailInfo'),
        claimsList: document.getElementById('claimsList'),
        emptyClaims: document.getElementById('emptyClaims'),
        detailStats: document.getElementById('detailStats'),
        closeDetailModal: document.getElementById('closeDetailModal'),
        
        // Delete Modal
        deleteModal: document.getElementById('deleteModal'),
        deleteMessage: document.getElementById('deleteMessage'),
        deleteInfo: document.getElementById('deleteInfo'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatRupiah(angka) {
        if (!angka && angka !== 0) return 'Rp 0';
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatDate(dateString, timeString = '') {
        if (!dateString) return 'Tanpa batas waktu';
        try {
            const date = new Date(dateString + 'T' + (timeString || '00:00'));
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: timeString ? '2-digit' : undefined,
                minute: timeString ? '2-digit' : undefined
            });
        } catch (e) {
            return dateString;
        }
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return timestamp;
        }
    }

    function generateVoucherCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
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
            if (retries > 0 && !useDummyData) {
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
            // Tidak ada parameter endpoint - gunakan dummy mode
            useDummyData = true;
            if (elements.websiteBadge) {
                elements.websiteBadge.textContent = '/endpoint';
            }
            showToast('Mode Demo: Menampilkan data contoh', 'info', 4000);
            return {
                id: 0,
                endpoint: 'demo',
                name: 'Demo Website'
            };
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                if (elements.websiteBadge) {
                    elements.websiteBadge.textContent = '/' + data.website.endpoint;
                }
                useDummyData = false;
                return data.website;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            
            // Endpoint tidak ditemukan - gunakan dummy mode
            useDummyData = true;
            if (elements.websiteBadge) {
                elements.websiteBadge.textContent = '/endpoint';
            }
            showToast('Website tidak ditemukan. Menampilkan data contoh.', 'warning', 5000);
            
            return {
                id: 0,
                endpoint: 'demo',
                name: 'Demo Website'
            };
        }
    }

    async function loadProducts() {
        if (!currentWebsite || useDummyData) {
            // Load dummy products untuk demo
            loadDummyProducts();
            return;
        }
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success && response.data) {
                productsData.layanan = response.data;
                
                // Build aplikasi and items maps
                response.data.forEach(layanan => {
                    if (layanan.aplikasi) {
                        layanan.aplikasi.forEach(aplikasi => {
                            if (!productsData.aplikasi[layanan.layanan_nama]) {
                                productsData.aplikasi[layanan.layanan_nama] = [];
                            }
                            productsData.aplikasi[layanan.layanan_nama].push(aplikasi);
                            
                            if (aplikasi.items) {
                                if (!productsData.items[aplikasi.aplikasi_nama]) {
                                    productsData.items[aplikasi.aplikasi_nama] = [];
                                }
                                productsData.items[aplikasi.aplikasi_nama] = aplikasi.items;
                            }
                        });
                    }
                });
                
                populateLayananSelect();
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            loadDummyProducts();
        }
    }

    function loadDummyProducts() {
        productsData = {
            layanan: [
                {
                    layanan_nama: 'Social Media',
                    aplikasi: [
                        {
                            aplikasi_nama: 'Instagram',
                            items: [
                                { id: 1, item_nama: 'Followers Indonesia' },
                                { id: 2, item_nama: 'Likes Instagram' },
                                { id: 3, item_nama: 'Views Story' }
                            ]
                        },
                        {
                            aplikasi_nama: 'TikTok',
                            items: [
                                { id: 4, item_nama: 'Followers TikTok' },
                                { id: 5, item_nama: 'Likes TikTok' },
                                { id: 6, item_nama: 'Views Video' }
                            ]
                        }
                    ]
                },
                {
                    layanan_nama: 'Game',
                    aplikasi: [
                        {
                            aplikasi_nama: 'Mobile Legends',
                            items: [
                                { id: 7, item_nama: 'Diamond 86' },
                                { id: 8, item_nama: 'Diamond 172' },
                                { id: 9, item_nama: 'Starlight Member' }
                            ]
                        },
                        {
                            aplikasi_nama: 'Free Fire',
                            items: [
                                { id: 10, item_nama: 'Diamond 100' },
                                { id: 11, item_nama: 'Diamond 310' },
                                { id: 12, item_nama: 'Membership' }
                            ]
                        }
                    ]
                }
            ],
            aplikasi: {},
            items: {}
        };
        
        // Build maps
        productsData.layanan.forEach(layanan => {
            if (layanan.aplikasi) {
                layanan.aplikasi.forEach(aplikasi => {
                    if (!productsData.aplikasi[layanan.layanan_nama]) {
                        productsData.aplikasi[layanan.layanan_nama] = [];
                    }
                    productsData.aplikasi[layanan.layanan_nama].push(aplikasi);
                    
                    if (aplikasi.items) {
                        if (!productsData.items[aplikasi.aplikasi_nama]) {
                            productsData.items[aplikasi.aplikasi_nama] = [];
                        }
                        productsData.items[aplikasi.aplikasi_nama] = aplikasi.items;
                    }
                });
            }
        });
        
        populateLayananSelect();
    }

    function populateLayananSelect() {
        if (!elements.diskonLayanan) return;
        
        let options = '<option value="">-- Pilih Layanan --</option>';
        productsData.layanan.forEach(layanan => {
            options += `<option value="${escapeHtml(layanan.layanan_nama)}">${escapeHtml(layanan.layanan_nama)}</option>`;
        });
        
        elements.diskonLayanan.innerHTML = options;
    }

    function populateAplikasiSelect(layananNama) {
        if (!elements.diskonAplikasi) return;
        
        elements.diskonAplikasi.innerHTML = '<option value="">-- Pilih Aplikasi --</option>';
        elements.diskonAplikasi.disabled = true;
        elements.diskonItem.innerHTML = '<option value="">-- Pilih Aplikasi Dulu --</option>';
        elements.diskonItem.disabled = true;
        
        if (!layananNama) return;
        
        const aplikasiList = productsData.aplikasi[layananNama];
        if (aplikasiList && aplikasiList.length > 0) {
            let options = '<option value="">-- Pilih Aplikasi --</option>';
            aplikasiList.forEach(aplikasi => {
                options += `<option value="${escapeHtml(aplikasi.aplikasi_nama)}">${escapeHtml(aplikasi.aplikasi_nama)}</option>`;
            });
            elements.diskonAplikasi.innerHTML = options;
            elements.diskonAplikasi.disabled = false;
        }
    }

    function populateItemSelect(aplikasiNama) {
        if (!elements.diskonItem) return;
        
        elements.diskonItem.innerHTML = '<option value="">-- Pilih Item --</option>';
        elements.diskonItem.disabled = true;
        
        if (!aplikasiNama) return;
        
        const itemList = productsData.items[aplikasiNama];
        if (itemList && itemList.length > 0) {
            let options = '<option value="">-- Pilih Item --</option>';
            itemList.forEach(item => {
                options += `<option value="${item.id}">${escapeHtml(item.item_nama)}</option>`;
            });
            elements.diskonItem.innerHTML = options;
            elements.diskonItem.disabled = false;
        }
    }

    // ==================== VOUCHER FUNCTIONS ====================
    async function loadVouchers() {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            if (useDummyData) {
                // Generate dummy data untuk demo
                await new Promise(resolve => setTimeout(resolve, 800));
                vouchers = generateDummyVouchers(25);
            } else {
                // Ambil dari API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}`, {
                    method: 'GET'
                });
                
                if (response.success) {
                    vouchers = response.vouchers || [];
                } else {
                    throw new Error(response.error || 'Gagal memuat voucher');
                }
            }
            
            applyFilters();
            calculateStatistics();
            renderVouchers();
            renderTopVouchers();
            
        } catch (error) {
            console.error('❌ Error loading vouchers:', error);
            showToast('Gagal memuat data voucher', 'error');
            
            // Fallback ke dummy data jika error
            if (!useDummyData) {
                useDummyData = true;
                vouchers = generateDummyVouchers(25);
                applyFilters();
                calculateStatistics();
                renderVouchers();
                renderTopVouchers();
                showToast('Menampilkan data contoh', 'info');
            }
        } finally {
            showLoading(false);
        }
    }

    function generateDummyVouchers(count) {
        const vouchers = [];
        const now = new Date();
        
        for (let i = 1; i <= count; i++) {
            const type = ['saldo', 'deposit', 'diskon'][Math.floor(Math.random() * 3)];
            const active = Math.random() > 0.3;
            const expired = !active && Math.random() > 0.5;
            const claimed = Math.floor(Math.random() * 50);
            const used = Math.floor(Math.random() * claimed);
            const limit = Math.floor(Math.random() * 100) + 10;
            
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 10));
            
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 30));
            
            vouchers.push({
                id: i,
                kode: `VCR${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                nama: `Voucher ${type} ${i}`,
                deskripsi: `Deskripsi voucher ${type} nomor ${i}`,
                type: type,
                active: active,
                expired: expired,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                start_time: '00:00',
                end_time: '23:59',
                no_expiry: false,
                target: ['all', 'subscriber', 'new_member', 'manual'][Math.floor(Math.random() * 4)],
                limit: limit,
                total_claimed: claimed,
                total_used: used,
                reward_data: type === 'saldo' ? 50000 :
                        type === 'deposit' ? { min: 10000, max: 100000, percent: 10 } :
                        { jenis: 'percent', nilai: 20, layanan: null, aplikasi: null, item: null, semua_produk: true },
                created_at: new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        return vouchers;
    }

    function applyFilters() {
        filteredVouchers = vouchers.filter(voucher => {
            // Search filter
            if (currentFilter.search) {
                const searchLower = currentFilter.search.toLowerCase();
                const match = (voucher.nama || '').toLowerCase().includes(searchLower) ||
                             (voucher.kode || '').toLowerCase().includes(searchLower);
                if (!match) return false;
            }
            
            // Status filter
            if (currentFilter.status !== 'all') {
                if (currentFilter.status === 'active' && !voucher.active) return false;
                if (currentFilter.status === 'inactive' && voucher.active) return false;
                if (currentFilter.status === 'expired' && !voucher.expired) return false;
            }
            
            // Type filter
            if (currentFilter.type !== 'all' && voucher.type !== currentFilter.type) {
                return false;
            }
            
            return true;
        });
        
        totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);
        currentPage = Math.min(currentPage, totalPages) || 1;
        
        updatePagination();
    }

    function renderVouchers() {
        if (!elements.voucherGrid || !elements.emptyVoucher) return;
        
        if (filteredVouchers.length === 0) {
            elements.voucherGrid.innerHTML = '';
            elements.emptyVoucher.style.display = 'block';
            elements.voucherPagination.style.display = 'none';
            return;
        }
        
        elements.emptyVoucher.style.display = 'none';
        elements.voucherPagination.style.display = 'flex';
        
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageVouchers = filteredVouchers.slice(start, end);
        
        let html = '';
        pageVouchers.forEach(voucher => {
            const statusClass = voucher.expired ? 'expired' : (voucher.active ? 'active' : 'inactive');
            const statusText = voucher.expired ? 'Kadaluarsa' : (voucher.active ? 'Aktif' : 'Tidak Aktif');
            const typeIcon = {
                'saldo': 'fa-credit-card',
                'deposit': 'fa-percent',
                'diskon': 'fa-tag'
            }[voucher.type] || 'fa-gift';
            
            const claimed = voucher.total_claimed || 0;
            const used = voucher.total_used || 0;
            const limit = voucher.limit || 1;
            
            const progressPercent = limit > 0 ? (claimed / limit) * 100 : 0;
            
            html += `
                <div class="voucher-card ${statusClass}" data-id="${voucher.id}">
                    <div class="voucher-header">
                        <div class="voucher-icon ${voucher.type}">
                            <i class="fas ${typeIcon}"></i>
                        </div>
                        <div class="voucher-info">
                            <div class="voucher-name">
                                ${escapeHtml(voucher.nama || '')}
                                <span class="voucher-code">${escapeHtml(voucher.kode || '')}</span>
                            </div>
                            <div>
                                <span class="voucher-badge ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="voucher-body">
                        <div class="voucher-desc">
                            ${escapeHtml(voucher.deskripsi || 'Tidak ada deskripsi')}
                        </div>
                        
                        <div class="voucher-meta">
                            <div class="meta-item">
                                <i class="fas fa-calendar-alt"></i>
                                <span>Berlaku: ${formatDate(voucher.start_date)} - ${formatDate(voucher.end_date)}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-users"></i>
                                <span>Klaim: <strong>${claimed}</strong> / ${limit}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-check-double"></i>
                                <span>Digunakan: <strong>${used}</strong> / ${claimed}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-gift"></i>
                                <span>Reward: ${formatReward(voucher)}</span>
                            </div>
                        </div>
                        
                        <div class="voucher-progress">
                            <div class="progress-header">
                                <span>Progress Klaim</span>
                                <span>${Math.round(progressPercent)}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="voucher-footer">
                        <button class="voucher-action-btn view" onclick="window.voucher.viewVoucher(${voucher.id})" title="Lihat Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="voucher-action-btn edit" onclick="window.voucher.editVoucher(${voucher.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="voucher-action-btn broadcast" onclick="window.voucher.broadcastVoucher(${voucher.id})" title="Broadcast">
                            <i class="fas fa-bullhorn"></i>
                        </button>
                        <button class="voucher-action-btn toggle" onclick="window.voucher.toggleVoucher(${voucher.id})" title="${voucher.active ? 'Nonaktifkan' : 'Aktifkan'}">
                            <i class="fas fa-power-off"></i>
                        </button>
                        <button class="voucher-action-btn delete" onclick="window.voucher.deleteVoucher(${voucher.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.voucherGrid.innerHTML = html;
    }

    function formatReward(voucher) {
        const type = voucher.type;
        const reward = voucher.reward_data || voucher.reward;
        
        if (type === 'saldo') {
            return formatRupiah(reward);
        } else if (type === 'deposit') {
            return `${reward.percent || 0}% bonus (Min ${formatRupiah(reward.min || 0)} - Max ${formatRupiah(reward.max || 0)})`;
        } else if (type === 'diskon') {
            if (reward.semua_produk) {
                return reward.jenis === 'percent' ? 
                    `Diskon ${reward.nilai || 0}% semua produk` : 
                    `Diskon ${formatRupiah(reward.nilai || 0)} semua produk`;
            } else {
                return reward.jenis === 'percent' ? 
                    `Diskon ${reward.nilai || 0}%` : 
                    `Diskon ${formatRupiah(reward.nilai || 0)}`;
            }
        }
        return '-';
    }

    function updatePagination() {
        if (elements.pageInfo) {
            elements.pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        }
        
        if (elements.prevPage) {
            elements.prevPage.disabled = currentPage === 1;
        }
        
        if (elements.nextPage) {
            elements.nextPage.disabled = currentPage === totalPages;
        }
    }

    function calculateStatistics() {
        if (useDummyData) {
            statistics = {
                total_vouchers: vouchers.length,
                active_vouchers: vouchers.filter(v => v.active && !v.expired).length,
                total_claims: vouchers.reduce((sum, v) => sum + (v.total_claimed || 0), 0),
                total_used: vouchers.reduce((sum, v) => sum + (v.total_used || 0), 0),
                unique_users: Math.floor(vouchers.reduce((sum, v) => sum + (v.total_claimed || 0), 0) * 0.7),
                total_reward: vouchers.reduce((sum, v) => {
                    if (v.type === 'saldo') return sum + ((v.reward_data || v.reward || 0) * (v.total_used || 0));
                    return sum + ((v.total_used || 0) * 10000);
                }, 0)
            };
        } else {
            statistics.total_vouchers = vouchers.length;
            statistics.active_vouchers = vouchers.filter(v => v.active && !v.expired).length;
            statistics.total_claims = vouchers.reduce((sum, v) => sum + (v.total_claimed || 0), 0);
            statistics.total_used = vouchers.reduce((sum, v) => sum + (v.total_used || 0), 0);
            statistics.unique_users = Math.floor(statistics.total_claims * 0.7); // Sementara
            statistics.total_reward = vouchers.reduce((sum, v) => {
                if (v.type === 'saldo') return sum + ((v.reward_data || 0) * (v.total_used || 0));
                if (v.type === 'deposit') return sum + ((v.total_used || 0) * 5000);
                return sum + ((v.total_used || 0) * 10000);
            }, 0);
        }
        
        updateStatistics();
    }

    function updateStatistics() {
        if (elements.statTotalVoucher) {
            elements.statTotalVoucher.textContent = statistics.total_vouchers;
        }
        if (elements.statActiveVoucher) {
            elements.statActiveVoucher.textContent = statistics.active_vouchers;
        }
        if (elements.statTotalClaimed) {
            elements.statTotalClaimed.textContent = statistics.total_claims;
        }
        if (elements.statUsedVoucher) {
            elements.statUsedVoucher.textContent = statistics.total_used;
        }
        if (elements.statUniqueUsers) {
            elements.statUniqueUsers.textContent = statistics.unique_users;
        }
        if (elements.statTotalReward) {
            elements.statTotalReward.textContent = formatRupiah(statistics.total_reward);
        }
    }

    function renderTopVouchers() {
        if (!elements.topVouchersList) return;
        
        const topVouchers = [...vouchers]
            .sort((a, b) => (b.total_claimed || 0) - (a.total_claimed || 0))
            .slice(0, 5);
        
        if (topVouchers.length === 0) {
            elements.topVouchersList.innerHTML = '<div class="empty-state" style="padding: 30px;"><i class="fas fa-ticket-alt"></i><p>Belum ada data</p></div>';
            return;
        }
        
        let html = '';
        topVouchers.forEach((voucher, index) => {
            const claimed = voucher.total_claimed || 0;
            const used = voucher.total_used || 0;
            const usageRate = claimed > 0 ? Math.round((used / claimed) * 100) : 0;
            
            html += `
                <div class="top-voucher-item">
                    <div class="top-voucher-rank">${index + 1}</div>
                    <div class="top-voucher-info">
                        <div class="top-voucher-name">${escapeHtml(voucher.nama || '')}</div>
                        <div class="top-voucher-stats">
                            <span><i class="fas fa-hand-holding-heart"></i> ${claimed} klaim</span>
                            <span><i class="fas fa-check-double"></i> ${used} digunakan</span>
                            <span><i class="fas fa-percent"></i> ${usageRate}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.topVouchersList.innerHTML = html;
    }

    // ==================== ACTIVITY FUNCTIONS ====================
    async function loadActivities() {
        if (!currentWebsite) return;
        
        try {
            if (useDummyData) {
                // Generate dummy activities untuk demo
                activities = generateDummyActivities(30);
            } else {
                // Ambil dari API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}/activities`, {
                    method: 'GET'
                });
                
                if (response.success) {
                    activities = response.activities || [];
                } else {
                    throw new Error(response.error || 'Gagal memuat aktivitas');
                }
            }
            
            renderActivities();
            
        } catch (error) {
            console.error('❌ Error loading activities:', error);
            
            // Fallback ke dummy data
            if (!useDummyData) {
                activities = generateDummyActivities(30);
                renderActivities();
            }
        }
    }

    function generateDummyActivities(count) {
        const activities = [];
        const now = new Date();
        const types = ['create', 'claim', 'use', 'expire', 'broadcast'];
        
        for (let i = 1; i <= count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const date = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);
            
            let desc = '';
            let meta = {};
            
            if (type === 'create') {
                desc = `Voucher baru dibuat: VCR${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                meta = { oleh: 'Admin' };
            } else if (type === 'claim') {
                desc = `User @user${Math.floor(Math.random() * 100)} mengklaim voucher`;
                meta = { user_id: Math.floor(Math.random() * 1000) };
            } else if (type === 'use') {
                desc = `Voucher digunakan untuk pembelian`;
                meta = { nominal: Math.floor(Math.random() * 100000) };
            } else if (type === 'expire') {
                desc = `Voucher otomatis kadaluarsa`;
                meta = { voucher: `VCR${Math.random().toString(36).substring(2, 8).toUpperCase()}` };
            } else if (type === 'broadcast') {
                desc = `Broadcast voucher ke ${Math.floor(Math.random() * 50) + 10} user`;
                meta = { target: 'all' };
            }
            
            activities.push({
                id: i,
                type: type,
                created_at: date.toISOString(),
                description: desc,
                meta_data: meta
            });
        }
        
        return activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    function renderActivities() {
        if (!elements.activityTimeline || !elements.emptyActivity) return;
        
        let filtered = filterActivities();
        
        if (filtered.length === 0) {
            elements.activityTimeline.innerHTML = '';
            elements.emptyActivity.style.display = 'block';
            return;
        }
        
        elements.emptyActivity.style.display = 'none';
        
        let html = '';
        filtered.slice(0, 20).forEach(activity => {
            const icon = {
                'create': 'fa-plus-circle',
                'claim': 'fa-hand-holding-heart',
                'use': 'fa-check-circle',
                'expire': 'fa-clock',
                'broadcast': 'fa-bullhorn'
            }[activity.type] || 'fa-history';
            
            const typeText = {
                'create': 'Pembuatan',
                'claim': 'Klaim',
                'use': 'Penggunaan',
                'expire': 'Kadaluarsa',
                'broadcast': 'Broadcast'
            }[activity.type] || activity.type;
            
            const meta = activity.meta_data || activity.meta || {};
            
            html += `
                <div class="timeline-item">
                    <div class="timeline-icon ${activity.type}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <div class="timeline-title">
                                ${escapeHtml(activity.description || '')}
                                <span class="timeline-badge">${typeText}</span>
                            </div>
                            <div class="timeline-time">${formatDateTime(activity.created_at)}</div>
                        </div>
                        ${Object.keys(meta).length > 0 ? `
                            <div class="timeline-meta">
                                ${Object.entries(meta).map(([key, value]) => 
                                    `<span><i class="fas fa-info-circle"></i> ${key}: ${value}</span>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        elements.activityTimeline.innerHTML = html;
    }

    function filterActivities() {
        return activities.filter(activity => {
            // Search filter
            if (activityFilter.search) {
                const searchLower = activityFilter.search.toLowerCase();
                if (!(activity.description || '').toLowerCase().includes(searchLower)) {
                    return false;
                }
            }
            
            // Type filter
            if (activityFilter.type !== 'all' && activity.type !== activityFilter.type) {
                return false;
            }
            
            // Date filter
            if (activityFilter.date !== 'all') {
                const activityDate = new Date(activity.created_at);
                const now = new Date();
                
                if (activityFilter.date === 'today') {
                    if (activityDate.toDateString() !== now.toDateString()) return false;
                } else if (activityFilter.date === 'week') {
                    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    if (activityDate < weekAgo) return false;
                } else if (activityFilter.date === 'month') {
                    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    if (activityDate < monthAgo) return false;
                }
            }
            
            return true;
        });
    }

    // ==================== VOUCHER MODAL FUNCTIONS ====================
    function openVoucherModal(voucher = null) {
        resetVoucherForm();
        
        if (voucher) {
            // Edit mode
            elements.voucherModalTitle.textContent = 'Edit Voucher';
            elements.voucherId.value = voucher.id || '';
            elements.voucherNama.value = voucher.nama || '';
            elements.voucherKode.value = voucher.kode || '';
            elements.voucherDeskripsi.value = voucher.deskripsi || '';
            elements.voucherStartDate.value = voucher.start_date || '';
            elements.voucherEndDate.value = voucher.end_date || '';
            elements.voucherStartTime.value = voucher.start_time || '00:00';
            elements.voucherEndTime.value = voucher.end_time || '23:59';
            elements.voucherNoExpiry.checked = voucher.no_expiry || false;
            elements.voucherTarget.value = voucher.target || 'all';
            elements.voucherLimit.value = voucher.limit || 1;
            elements.voucherActive.checked = voucher.active !== false;
            
            // Set reward type
            const rewardRadio = document.querySelector(`input[name="rewardType"][value="${voucher.type}"]`);
            if (rewardRadio) rewardRadio.checked = true;
            
            // Show appropriate reward panel
            showRewardPanel(voucher.type);
            
            // Fill reward data
            const reward = voucher.reward_data || voucher.reward;
            
            if (voucher.type === 'saldo') {
                elements.rewardSaldo.value = reward || '';
            } else if (voucher.type === 'deposit') {
                elements.depositMin.value = reward?.min || '';
                elements.depositMax.value = reward?.max || '';
                elements.depositPercent.value = reward?.percent || 10;
            } else if (voucher.type === 'diskon') {
                elements.diskonJenis.value = reward?.jenis || 'percent';
                elements.diskonNilai.value = reward?.nilai || '';
                elements.diskonSemuaProduk.checked = reward?.semua_produk || false;
                
                if (reward?.layanan) {
                    elements.diskonLayanan.value = reward.layanan;
                    populateAplikasiSelect(reward.layanan);
                    
                    if (reward?.aplikasi) {
                        setTimeout(() => {
                            elements.diskonAplikasi.value = reward.aplikasi;
                            populateItemSelect(reward.aplikasi);
                            
                            if (reward?.item) {
                                setTimeout(() => {
                                    elements.diskonItem.value = reward.item;
                                }, 100);
                            }
                        }, 100);
                    }
                }
            }
            
            // Show manual user section if target is manual
            if (voucher.target === 'manual') {
                elements.manualUserSection.style.display = 'block';
                // Load selected users
                if (voucher.selected_users) {
                    selectedUsers = new Set(voucher.selected_users);
                    updateSelectedUserCount();
                }
            }
            
        } else {
            // Create mode
            elements.voucherModalTitle.textContent = 'Buat Voucher Baru';
            elements.voucherId.value = '';
            elements.voucherKode.value = generateVoucherCode();
            elements.voucherNoExpiry.checked = false;
            elements.voucherActive.checked = true;
            elements.voucherLimit.value = 1;
            
            // Set default dates
            const today = new Date().toISOString().split('T')[0];
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            
            elements.voucherStartDate.value = today;
            elements.voucherEndDate.value = nextMonth.toISOString().split('T')[0];
            elements.voucherStartTime.value = '00:00';
            elements.voucherEndTime.value = '23:59';
            
            // Default reward type
            showRewardPanel('saldo');
        }
        
        updateDateFields();
        
        elements.voucherModal.classList.add('active');
        vibrate(10);
        
        setTimeout(() => {
            elements.voucherNama.focus();
        }, 300);
    }

    function resetVoucherForm() {
        elements.voucherForm.reset();
        elements.voucherId.value = '';
        selectedUsers.clear();
        updateSelectedUserCount();
        elements.manualUserSection.style.display = 'none';
    }

    function showRewardPanel(type) {
        elements.rewardSaldoPanel.style.display = 'none';
        elements.rewardDepositPanel.style.display = 'none';
        elements.rewardDiskonPanel.style.display = 'none';
        
        if (type === 'saldo') {
            elements.rewardSaldoPanel.style.display = 'block';
        } else if (type === 'deposit') {
            elements.rewardDepositPanel.style.display = 'block';
        } else if (type === 'diskon') {
            elements.rewardDiskonPanel.style.display = 'block';
        }
    }

    function updateDateFields() {
        const noExpiry = elements.voucherNoExpiry.checked;
        elements.voucherEndDate.disabled = noExpiry;
        elements.voucherEndTime.disabled = noExpiry;
        
        if (noExpiry) {
            elements.voucherEndDate.value = '';
            elements.voucherEndTime.value = '';
        }
    }

    function updateSelectedUserCount() {
        if (elements.selectedUserCount) {
            elements.selectedUserCount.textContent = selectedUsers.size;
        }
    }

    function updateBroadcastSelectedCount() {
        if (elements.broadcastSelectedCount) {
            elements.broadcastSelectedCount.textContent = broadcastSelectedUsers.size;
        }
    }

    function closeVoucherModal() {
        elements.voucherModal.classList.remove('active');
    }

    async function saveVoucher(e) {
        e.preventDefault();
        
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        // Validasi dasar
        const nama = elements.voucherNama.value.trim();
        const kode = elements.voucherKode.value.trim();
        
        if (!nama) {
            showToast('Nama voucher wajib diisi', 'warning');
            elements.voucherNama.focus();
            return;
        }
        
        if (!kode) {
            showToast('Kode voucher wajib diisi', 'warning');
            elements.voucherKode.focus();
            return;
        }
        
        // Validasi tanggal
        if (!elements.voucherNoExpiry.checked) {
            if (!elements.voucherEndDate.value) {
                showToast('Tanggal berakhir wajib diisi jika tidak memilih "Tanpa batas waktu"', 'warning');
                elements.voucherEndDate.focus();
                return;
            }
        }
        
        // Validasi reward berdasarkan tipe
        const rewardType = document.querySelector('input[name="rewardType"]:checked')?.value;
        
        if (rewardType === 'saldo') {
            const saldo = parseInt(elements.rewardSaldo.value);
            if (!saldo || saldo < 1000) {
                showToast('Jumlah saldo minimal Rp 1.000', 'warning');
                elements.rewardSaldo.focus();
                return;
            }
        } else if (rewardType === 'deposit') {
            const min = parseInt(elements.depositMin.value) || 0;
            const max = parseInt(elements.depositMax.value) || 0;
            const percent = parseInt(elements.depositPercent.value);
            
            if (max && min && max <= min) {
                showToast('Maksimal deposit harus lebih besar dari minimal', 'warning');
                return;
            }
            
            if (!percent || percent < 1 || percent > 100) {
                showToast('Persen bonus harus antara 1-100', 'warning');
                elements.depositPercent.focus();
                return;
            }
        } else if (rewardType === 'diskon') {
            const nilai = parseInt(elements.diskonNilai.value);
            if (!nilai || nilai < 0) {
                showToast('Nilai diskon wajib diisi', 'warning');
                elements.diskonNilai.focus();
                return;
            }
            
            if (!elements.diskonSemuaProduk.checked) {
                if (!elements.diskonLayanan.value) {
                    showToast('Pilih layanan untuk diskon', 'warning');
                    return;
                }
            }
        }
        
        // Siapkan data voucher
        const voucherData = {
            id: elements.voucherId.value ? parseInt(elements.voucherId.value) : null,
            website_id: currentWebsite.id,
            nama: nama,
            kode: kode,
            deskripsi: elements.voucherDeskripsi.value.trim(),
            start_date: elements.voucherStartDate.value,
            end_date: elements.voucherNoExpiry.checked ? null : elements.voucherEndDate.value,
            start_time: elements.voucherStartTime.value || '00:00',
            end_time: elements.voucherNoExpiry.checked ? null : elements.voucherEndTime.value,
            no_expiry: elements.voucherNoExpiry.checked,
            target: elements.voucherTarget.value,
            limit: parseInt(elements.voucherLimit.value) || 1,
            active: elements.voucherActive.checked,
            type: rewardType
        };
        
        // Tambah reward data
        if (rewardType === 'saldo') {
            voucherData.reward = parseInt(elements.rewardSaldo.value);
        } else if (rewardType === 'deposit') {
            voucherData.reward = {
                min: parseInt(elements.depositMin.value) || 0,
                max: parseInt(elements.depositMax.value) || 0,
                percent: parseInt(elements.depositPercent.value) || 10
            };
        } else if (rewardType === 'diskon') {
            voucherData.reward = {
                jenis: elements.diskonJenis.value,
                nilai: parseInt(elements.diskonNilai.value),
                layanan: elements.diskonLayanan.value || null,
                aplikasi: elements.diskonAplikasi.value || null,
                item: elements.diskonItem.value ? parseInt(elements.diskonItem.value) : null,
                semua_produk: elements.diskonSemuaProduk.checked
            };
        }
        
        // Tambah selected users jika target manual
        if (voucherData.target === 'manual') {
            voucherData.selected_users = Array.from(selectedUsers);
        }
        
        showLoading(true);
        
        try {
            if (useDummyData) {
                // Simulasi penyimpanan untuk dummy mode
                await new Promise(resolve => setTimeout(resolve, 800));
                
                if (voucherData.id) {
                    // Update existing
                    const index = vouchers.findIndex(v => v.id === voucherData.id);
                    if (index !== -1) {
                        vouchers[index] = { ...vouchers[index], ...voucherData };
                    }
                } else {
                    // Create new
                    voucherData.id = Math.max(...vouchers.map(v => v.id), 0) + 1;
                    voucherData.total_claimed = 0;
                    voucherData.total_used = 0;
                    voucherData.created_at = new Date().toISOString();
                    vouchers.push(voucherData);
                }
                
                showToast(`✅ Voucher berhasil ${voucherData.id ? 'diperbarui' : 'ditambahkan'}!`, 'success');
                closeVoucherModal();
                
                // Refresh data
                applyFilters();
                calculateStatistics();
                renderVouchers();
                renderTopVouchers();
                
            } else {
                // Kirim ke API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(voucherData)
                });
                
                if (response.success) {
                    showToast(`✅ Voucher berhasil ${voucherData.id ? 'diperbarui' : 'ditambahkan'}!`, 'success');
                    closeVoucherModal();
                    
                    // Refresh data
                    await loadVouchers();
                    await loadActivities();
                } else {
                    throw new Error(response.error || 'Gagal menyimpan voucher');
                }
            }
            
        } catch (error) {
            console.error('❌ Error saving voucher:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== BROADCAST FUNCTIONS ====================
    function openBroadcastModal(voucherId) {
        const voucher = vouchers.find(v => v.id === voucherId);
        if (!voucher) return;
        
        selectedVoucherForBroadcast = voucher;
        broadcastSelectedUsers.clear();
        
        if (elements.broadcastVoucherInfo) {
            elements.broadcastVoucherInfo.innerHTML = `
                <strong>${escapeHtml(voucher.nama || '')}</strong><br>
                <small>Kode: ${escapeHtml(voucher.kode || '')}</small>
            `;
        }
        
        if (elements.previewVoucherName) {
            elements.previewVoucherName.textContent = voucher.nama || '';
        }
        if (elements.previewVoucherCode) {
            elements.previewVoucherCode.textContent = voucher.kode || '';
        }
        
        updateBroadcastPreview();
        
        elements.broadcastModal.classList.add('active');
        vibrate(10);
    }

    function updateBroadcastPreview() {
        if (elements.previewCustomMessage) {
            elements.previewCustomMessage.textContent = elements.broadcastMessage.value || '';
        }
    }

    function closeBroadcastModal() {
        elements.broadcastModal.classList.remove('active');
        selectedVoucherForBroadcast = null;
        broadcastSelectedUsers.clear();
        updateBroadcastSelectedCount();
        elements.broadcastManualSection.style.display = 'none';
        elements.broadcastMessage.value = '';
    }

    async function sendBroadcast() {
        if (!selectedVoucherForBroadcast) return;
        
        const target = elements.broadcastTarget.value;
        
        if (target === 'manual' && broadcastSelectedUsers.size === 0) {
            showToast('Pilih minimal 1 user untuk broadcast manual', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            if (useDummyData) {
                // Simulasi broadcast untuk dummy mode
                await new Promise(resolve => setTimeout(resolve, 1200));
                
                showToast(`✅ Broadcast berhasil dikirim!`, 'success');
                closeBroadcastModal();
                
                // Log activity
                activities.unshift({
                    id: activities.length + 1,
                    type: 'broadcast',
                    created_at: new Date().toISOString(),
                    description: `Broadcast voucher ${selectedVoucherForBroadcast.kode} ke ${target === 'all' ? 'semua user' : target === 'subscriber' ? 'pelanggan' : target === 'new_member' ? 'member baru' : `${broadcastSelectedUsers.size} user terpilih`}`,
                    meta_data: { target: target, count: target === 'manual' ? broadcastSelectedUsers.size : 'semua' }
                });
                
                renderActivities();
                
            } else {
                // Kirim ke API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}/broadcast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        voucher_id: selectedVoucherForBroadcast.id,
                        target: target,
                        selected_users: target === 'manual' ? Array.from(broadcastSelectedUsers) : [],
                        message: elements.broadcastMessage.value
                    })
                });
                
                if (response.success) {
                    showToast(`✅ Broadcast berhasil dikirim!`, 'success');
                    closeBroadcastModal();
                    
                    // Refresh activities
                    await loadActivities();
                } else {
                    throw new Error(response.error || 'Gagal mengirim broadcast');
                }
            }
            
        } catch (error) {
            console.error('❌ Error sending broadcast:', error);
            showToast('Gagal mengirim broadcast', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== VIEW/DETAIL FUNCTIONS ====================
    function viewVoucher(id) {
        const voucher = vouchers.find(v => v.id === id);
        if (!voucher) return;
        
        selectedVoucher = voucher;
        
        // Render header
        if (elements.detailHeader) {
            const statusClass = voucher.expired ? 'expired' : (voucher.active ? 'active' : 'inactive');
            const statusText = voucher.expired ? 'Kadaluarsa' : (voucher.active ? 'Aktif' : 'Tidak Aktif');
            
            elements.detailHeader.innerHTML = `
                <div class="voucher-detail-title">
                    <h3>${escapeHtml(voucher.nama || '')}</h3>
                    <span class="voucher-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="voucher-detail-code">${escapeHtml(voucher.kode || '')}</div>
            `;
        }
        
        // Render info tab
        renderDetailInfo(voucher);
        
        // Render claims tab
        renderDetailClaims(voucher);
        
        // Render stats tab
        renderDetailStats(voucher);
        
        // Reset to first tab
        showDetailTab('info');
        
        elements.detailModal.classList.add('active');
        vibrate(10);
    }

    function renderDetailInfo(voucher) {
        if (!elements.detailInfo) return;
        
        const rewardText = formatReward(voucher);
        const targetText = {
            'all': 'Semua User',
            'subscriber': 'Langganan (Pernah Order)',
            'new_member': 'New Member (Belum Order)',
            'manual': 'Manual (User Terpilih)'
        }[voucher.target] || voucher.target;
        
        const expiryText = voucher.no_expiry ? 
            'Tidak ada batas waktu' : 
            `${formatDate(voucher.start_date, voucher.start_time)} - ${formatDate(voucher.end_date, voucher.end_time)}`;
        
        elements.detailInfo.innerHTML = `
            <div class="info-item">
                <div class="info-label">Nama Voucher</div>
                <div class="info-value">${escapeHtml(voucher.nama || '')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Kode Voucher</div>
                <div class="info-value">${escapeHtml(voucher.kode || '')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Deskripsi</div>
                <div class="info-value">${escapeHtml(voucher.deskripsi || '-')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Masa Berlaku</div>
                <div class="info-value">${expiryText}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Target</div>
                <div class="info-value">${targetText}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Limit Klaim</div>
                <div class="info-value">${voucher.limit || 0}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Jenis Reward</div>
                <div class="info-value">${voucher.type || '-'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Detail Reward</div>
                <div class="info-value">${rewardText}</div>
            </div>
        `;
    }

    async function renderDetailClaims(voucher) {
        if (!elements.claimsList || !elements.emptyClaims) return;
        
        let claims = [];
        
        if (useDummyData) {
            // Dummy claims data
            for (let i = 0; i < (voucher.total_claimed || 0); i++) {
                claims.push({
                    user: {
                        id: Math.floor(Math.random() * 1000),
                        name: `User ${Math.random().toString(36).substring(2, 8)}`,
                        username: `@user${Math.floor(Math.random() * 100)}`
                    },
                    claimed_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                    used: Math.random() > 0.3,
                    used_at: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString()
                });
            }
        } else {
            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}/claims/${voucher.id}`, {
                    method: 'GET'
                });
                
                if (response.success) {
                    claims = response.claims || [];
                }
            } catch (error) {
                console.error('Error loading claims:', error);
            }
        }
        
        if (claims.length === 0) {
            elements.claimsList.innerHTML = '';
            elements.emptyClaims.style.display = 'block';
            return;
        }
        
        elements.emptyClaims.style.display = 'none';
        
        let html = '';
        claims.sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at))
              .forEach(claim => {
            const user = claim.user || {};
            html += `
                <div class="claim-item">
                    <div class="claim-user">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <h4>${escapeHtml(user.name || user.user_name || `User ${user.id || ''}`)}</h4>
                            <span>${escapeHtml(user.username || claim.user_username || '')}</span>
                        </div>
                    </div>
                    <div class="claim-info">
                        <div class="claim-date">${formatDateTime(claim.claimed_at)}</div>
                        <span class="claim-status ${claim.used ? 'used' : 'unused'}">
                            ${claim.used ? 'Digunakan' : 'Belum Digunakan'}
                        </span>
                    </div>
                </div>
            `;
        });
        
        elements.claimsList.innerHTML = html;
    }

    function renderDetailStats(voucher) {
        if (!elements.detailStats) return;
        
        const claimed = voucher.total_claimed || 0;
        const used = voucher.total_used || 0;
        const limit = voucher.limit || 1;
        
        const usageRate = claimed > 0 ? (used / claimed) * 100 : 0;
        const claimRate = limit > 0 ? (claimed / limit) * 100 : 0;
        
        elements.detailStats.innerHTML = `
            <div class="stat-mini-item">
                <div class="stat-mini-label">Total Klaim</div>
                <div class="stat-mini-value">${claimed}</div>
            </div>
            <div class="stat-mini-item">
                <div class="stat-mini-label">Digunakan</div>
                <div class="stat-mini-value">${used}</div>
            </div>
            <div class="stat-mini-item">
                <div class="stat-mini-label">Tersisa</div>
                <div class="stat-mini-value">${claimed - used}</div>
            </div>
            <div class="stat-mini-item">
                <div class="stat-mini-label">Usage Rate</div>
                <div class="stat-mini-value">${Math.round(usageRate)}%</div>
            </div>
            <div class="stat-mini-item">
                <div class="stat-mini-label">Claim Rate</div>
                <div class="stat-mini-value">${Math.round(claimRate)}%</div>
            </div>
            <div class="stat-mini-item">
                <div class="stat-mini-label">Sisa Kuota</div>
                <div class="stat-mini-value">${limit - claimed}</div>
            </div>
        `;
        
        // Initialize mini chart
        if (elements.miniChartCanvas) {
            if (miniChart) miniChart.destroy();
            
            miniChart = new Chart(elements.miniChartCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Digunakan', 'Belum Digunakan', 'Sisa Kuota'],
                    datasets: [{
                        data: [used, claimed - used, limit - claimed],
                        backgroundColor: [
                            '#10b981',
                            '#f59e0b',
                            '#3b82f6'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    }

    function showDetailTab(tabId) {
        elements.detailTabs.forEach(tab => {
            const isActive = tab.dataset.detailTab === tabId;
            tab.classList.toggle('active', isActive);
        });
        
        elements.detailPanels.forEach(panel => {
            const isActive = panel.id === `detail${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Panel`;
            panel.classList.toggle('active', isActive);
        });
    }

    function closeDetailModal() {
        elements.detailModal.classList.remove('active');
        selectedVoucher = null;
    }

    // ==================== VOUCHER ACTIONS ====================
    function editVoucher(id) {
        const voucher = vouchers.find(v => v.id === id);
        if (voucher) {
            openVoucherModal(voucher);
        }
    }

    async function toggleVoucher(id) {
        const voucher = vouchers.find(v => v.id === id);
        if (!voucher) return;
        
        const newStatus = !voucher.active;
        const action = newStatus ? 'mengaktifkan' : 'menonaktifkan';
        
        if (!confirm(`Yakin ingin ${action} voucher "${voucher.nama}"?`)) return;
        
        showLoading(true);
        
        try {
            if (useDummyData) {
                // Simulasi untuk dummy mode
                await new Promise(resolve => setTimeout(resolve, 500));
                voucher.active = newStatus;
            } else {
                // Kirim ke API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}/${voucher.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: newStatus })
                });
                
                if (!response.success) {
                    throw new Error(response.error || 'Gagal mengubah status');
                }
            }
            
            applyFilters();
            renderVouchers();
            calculateStatistics();
            
            showToast(`✅ Voucher berhasil ${action}`, 'success');
            
        } catch (error) {
            console.error('Error toggling voucher:', error);
            showToast('Gagal mengubah status voucher', 'error');
        } finally {
            showLoading(false);
        }
    }

    function deleteVoucher(id) {
        const voucher = vouchers.find(v => v.id === id);
        if (!voucher) return;
        
        elements.deleteMessage.textContent = `Hapus voucher "${voucher.nama}"?`;
        elements.deleteInfo.innerHTML = `
            <strong>${escapeHtml(voucher.nama || '')}</strong><br>
            <small>Kode: ${escapeHtml(voucher.kode || '')}</small>
        `;
        
        elements.deleteModal.classList.add('active');
        window._deleteVoucherId = id;
        vibrate(10);
    }

    async function confirmDelete() {
        const id = window._deleteVoucherId;
        if (!id) return;
        
        const voucher = vouchers.find(v => v.id === id);
        if (!voucher) return;
        
        showLoading(true);
        
        try {
            if (useDummyData) {
                // Simulasi hapus untuk dummy mode
                await new Promise(resolve => setTimeout(resolve, 800));
                vouchers = vouchers.filter(v => v.id !== id);
            } else {
                // Kirim ke API
                const response = await fetchWithRetry(`${API_BASE_URL}/api/voucher/${currentWebsite.id}/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.success) {
                    throw new Error(response.error || 'Gagal menghapus voucher');
                }
            }
            
            applyFilters();
            renderVouchers();
            calculateStatistics();
            renderTopVouchers();
            
            showToast(`✅ Voucher "${voucher.nama}" dihapus`, 'success');
            closeDeleteModal();
            
            // Refresh activities
            await loadActivities();
            
        } catch (error) {
            console.error('❌ Error deleting voucher:', error);
            showToast('Gagal menghapus voucher', 'error');
        } finally {
            showLoading(false);
        }
    }

    function closeDeleteModal() {
        elements.deleteModal.classList.remove('active');
        window._deleteVoucherId = null;
    }

    // ==================== CHARTS ====================
    function initCharts() {
        if (!elements.claimChartCanvas) return;
        
        // Dummy data for chart
        const labels = [];
        const data = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            data.push(Math.floor(Math.random() * 20));
        }
        
        if (claimChart) claimChart.destroy();
        
        claimChart = new Chart(elements.claimChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Klaim',
                    data: data,
                    borderColor: '#40a7e3',
                    backgroundColor: 'rgba(64, 167, 227, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#7d7d7d'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#7d7d7d'
                        }
                    }
                }
            }
        });
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            
            await Promise.all([
                loadProducts(),
                loadVouchers(),
                loadActivities()
            ]);
            
            initCharts();
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Back to panel
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/wtb/html/panel.html';
            });
        }
        
        // Refresh
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', async () => {
                vibrate(10);
                await loadVouchers();
                await loadActivities();
                showToast('Data diperbarui', 'success');
            });
        }
        
        // Tabs
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                elements.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
                
                if (tab === 'statistik') {
                    setTimeout(() => initCharts(), 100);
                }
                
                vibrate(10);
            });
        });
        
        // Filters
        if (elements.voucherSearch) {
            const debouncedSearch = debounce((e) => {
                currentFilter.search = e.target.value;
                currentPage = 1;
                applyFilters();
                renderVouchers();
            }, 500);
            
            elements.voucherSearch.addEventListener('input', debouncedSearch);
        }
        
        if (elements.voucherStatusFilter) {
            elements.voucherStatusFilter.addEventListener('change', (e) => {
                currentFilter.status = e.target.value;
                currentPage = 1;
                applyFilters();
                renderVouchers();
            });
        }
        
        if (elements.voucherTypeFilter) {
            elements.voucherTypeFilter.addEventListener('change', (e) => {
                currentFilter.type = e.target.value;
                currentPage = 1;
                applyFilters();
                renderVouchers();
            });
        }
        
        // Pagination
        if (elements.prevPage) {
            elements.prevPage.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderVouchers();
                }
            });
        }
        
        if (elements.nextPage) {
            elements.nextPage.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderVouchers();
                }
            });
        }
        
        // Create voucher buttons
        if (elements.createVoucherBtn) {
            elements.createVoucherBtn.addEventListener('click', () => openVoucherModal());
        }
        
        if (elements.emptyCreateVoucherBtn) {
            elements.emptyCreateVoucherBtn.addEventListener('click', () => openVoucherModal());
        }
        
        // Voucher Modal
        if (elements.generateKodeBtn) {
            elements.generateKodeBtn.addEventListener('click', () => {
                elements.voucherKode.value = generateVoucherCode();
            });
        }
        
        if (elements.voucherNoExpiry) {
            elements.voucherNoExpiry.addEventListener('change', updateDateFields);
        }
        
        // Reward type radio
        document.querySelectorAll('input[name="rewardType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                showRewardPanel(e.target.value);
            });
        });
        
        // Layanan change for diskon
        if (elements.diskonLayanan) {
            elements.diskonLayanan.addEventListener('change', (e) => {
                populateAplikasiSelect(e.target.value);
            });
        }
        
        if (elements.diskonAplikasi) {
            elements.diskonAplikasi.addEventListener('change', (e) => {
                populateItemSelect(e.target.value);
            });
        }
        
        // Target change
        if (elements.voucherTarget) {
            elements.voucherTarget.addEventListener('change', (e) => {
                if (e.target.value === 'manual') {
                    elements.manualUserSection.style.display = 'block';
                } else {
                    elements.manualUserSection.style.display = 'none';
                    selectedUsers.clear();
                    updateSelectedUserCount();
                }
            });
        }
        
        // Clear selected users
        if (elements.clearSelectedUsers) {
            elements.clearSelectedUsers.addEventListener('click', () => {
                selectedUsers.clear();
                updateSelectedUserCount();
                // Uncheck all checkboxes
                document.querySelectorAll('#userList input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
            });
        }
        
        // Voucher form submit
        if (elements.voucherForm) {
            elements.voucherForm.addEventListener('submit', saveVoucher);
        }
        
        if (elements.closeVoucherModal) {
            elements.closeVoucherModal.addEventListener('click', closeVoucherModal);
        }
        
        if (elements.cancelVoucherBtn) {
            elements.cancelVoucherBtn.addEventListener('click', closeVoucherModal);
        }
        
        // Broadcast Modal
        if (elements.broadcastTarget) {
            elements.broadcastTarget.addEventListener('change', (e) => {
                if (e.target.value === 'manual') {
                    elements.broadcastManualSection.style.display = 'block';
                } else {
                    elements.broadcastManualSection.style.display = 'none';
                    broadcastSelectedUsers.clear();
                    updateBroadcastSelectedCount();
                }
            });
        }
        
        if (elements.broadcastMessage) {
            elements.broadcastMessage.addEventListener('input', updateBroadcastPreview);
        }
        
        if (elements.clearBroadcastUsers) {
            elements.clearBroadcastUsers.addEventListener('click', () => {
                broadcastSelectedUsers.clear();
                updateBroadcastSelectedCount();
                document.querySelectorAll('#broadcastUserList input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
            });
        }
        
        if (elements.confirmBroadcastBtn) {
            elements.confirmBroadcastBtn.addEventListener('click', sendBroadcast);
        }
        
        if (elements.closeBroadcastModal) {
            elements.closeBroadcastModal.addEventListener('click', closeBroadcastModal);
        }
        
        if (elements.cancelBroadcastBtn) {
            elements.cancelBroadcastBtn.addEventListener('click', closeBroadcastModal);
        }
        
        // Detail Modal tabs
        elements.detailTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                showDetailTab(tab.dataset.detailTab);
            });
        });
        
        if (elements.closeDetailModal) {
            elements.closeDetailModal.addEventListener('click', closeDetailModal);
        }
        
        // Delete Modal
        if (elements.closeDeleteModal) {
            elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
        
        // Activity Filters
        if (elements.activitySearch) {
            const debouncedActivitySearch = debounce((e) => {
                activityFilter.search = e.target.value;
                renderActivities();
            }, 500);
            
            elements.activitySearch.addEventListener('input', debouncedActivitySearch);
        }
        
        if (elements.activityTypeFilter) {
            elements.activityTypeFilter.addEventListener('change', (e) => {
                activityFilter.type = e.target.value;
                renderActivities();
            });
        }
        
        if (elements.activityDateFilter) {
            elements.activityDateFilter.addEventListener('change', (e) => {
                activityFilter.date = e.target.value;
                renderActivities();
            });
        }
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.voucherModal) closeVoucherModal();
            if (e.target === elements.broadcastModal) closeBroadcastModal();
            if (e.target === elements.detailModal) closeDetailModal();
            if (e.target === elements.deleteModal) closeDeleteModal();
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.voucher = {
        viewVoucher: viewVoucher,
        editVoucher: editVoucher,
        broadcastVoucher: openBroadcastModal,
        toggleVoucher: toggleVoucher,
        deleteVoucher: deleteVoucher
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();
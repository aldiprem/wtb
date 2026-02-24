// produk.js - Manajemen Produk dengan Struktur Hierarki (VERSI BARU DENGAN FITUR LENGKAP)
(function() {
    'use strict';
    
    console.log('📦 Produk Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let productsData = [];
    
    // Current selections
    let currentLayanan = null;
    let currentAplikasi = null;
    let currentItem = null;
    
    // Item state
    let currentItemStok = [];
    let currentItemFields = [];

    // Track open/close state
    let openLayanan = new Set();
    let openAplikasi = new Set();

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        productsContainer: document.getElementById('productsContainer'),
        emptyState: document.getElementById('emptyState'),
        backToPanel: document.getElementById('backToPanel'),
        
        // Layanan Modal
        layananModal: document.getElementById('layananModal'),
        layananModalTitle: document.getElementById('layananModalTitle'),
        layananForm: document.getElementById('layananForm'),
        layananId: document.getElementById('layananId'),
        layananNama: document.getElementById('layananNama'),
        layananGambar: document.getElementById('layananGambar'),
        layananBanner: document.getElementById('layananBanner'),
        layananDesc: document.getElementById('layananDesc'),
        layananCatatan: document.getElementById('layananCatatan'),
        closeLayananModal: document.getElementById('closeLayananModal'),
        cancelLayananBtn: document.getElementById('cancelLayananBtn'),
        
        // Aplikasi Modal
        aplikasiModal: document.getElementById('aplikasiModal'),
        aplikasiModalTitle: document.getElementById('aplikasiModalTitle'),
        aplikasiForm: document.getElementById('aplikasiForm'),
        aplikasiId: document.getElementById('aplikasiId'),
        aplikasiLayananNama: document.getElementById('aplikasiLayananNama'),
        aplikasiNama: document.getElementById('aplikasiNama'),
        aplikasiGambar: document.getElementById('aplikasiGambar'),
        aplikasiDesc: document.getElementById('aplikasiDesc'),
        aplikasiCatatan: document.getElementById('aplikasiCatatan'),
        closeAplikasiModal: document.getElementById('closeAplikasiModal'),
        cancelAplikasiBtn: document.getElementById('cancelAplikasiBtn'),
        
        // Item Modal
        itemModal: document.getElementById('itemModal'),
        itemModalTitle: document.getElementById('itemModalTitle'),
        itemForm: document.getElementById('itemForm'),
        itemId: document.getElementById('itemId'),
        itemNama: document.getElementById('itemNama'),
        itemDurasiJumlah: document.getElementById('itemDurasiJumlah'),
        itemDurasiSatuan: document.getElementById('itemDurasiSatuan'),
        itemHarga: document.getElementById('itemHarga'),
        itemTipeRadios: document.querySelectorAll('input[name="itemTipe"]'),
        itemMetodeRadios: document.querySelectorAll('input[name="itemMetode"]'),
        itemDirectlyPanel: document.getElementById('itemDirectlyPanel'),
        itemRequestPanel: document.getElementById('itemRequestPanel'),
        itemStokList: document.getElementById('itemStokList'),
        emptyItemStok: document.getElementById('emptyItemStok'),
        addItemStokBtn: document.getElementById('addItemStokBtn'),
        itemFieldsList: document.getElementById('itemFieldsList'),
        emptyItemFields: document.getElementById('emptyItemFields'),
        addItemFieldBtn: document.getElementById('addItemFieldBtn'),
        itemReadyRadios: document.querySelectorAll('input[name="itemReady"]'),
        closeItemModal: document.getElementById('closeItemModal'),
        cancelItemBtn: document.getElementById('cancelItemBtn'),
        
        // Stok Modal
        stokModal: document.getElementById('stokModal'),
        stokDataInput: document.getElementById('stokDataInput'),
        closeStokModal: document.getElementById('closeStokModal'),
        cancelStokBtn: document.getElementById('cancelStokBtn'),
        confirmStokBtn: document.getElementById('confirmStokBtn'),
        
        // Field Modal
        fieldModal: document.getElementById('fieldModal'),
        fieldNamaInput: document.getElementById('fieldNamaInput'),
        fieldTipeInput: document.getElementById('fieldTipeInput'),
        fieldPlaceholderInput: document.getElementById('fieldPlaceholderInput'),
        fieldRequiredInput: document.getElementById('fieldRequiredInput'),
        closeFieldModal: document.getElementById('closeFieldModal'),
        cancelFieldBtn: document.getElementById('cancelFieldBtn'),
        confirmFieldBtn: document.getElementById('confirmFieldBtn'),
        
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

    function formatDurasi(jumlah, satuan) {
        if (!jumlah || jumlah === 0) return '';
        return `${jumlah} ${satuan}`;
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
            setTimeout(() => {
                window.location.href = '/wtb/panel.html';
            }, 2000);
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                if (elements.websiteBadge) {
                    elements.websiteBadge.textContent = '/' + data.website.endpoint;
                }
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

    async function loadAllData() {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (data.success) {
                productsData = data.data || [];
                renderProducts();
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== TOGGLE FUNCTIONS ====================
    function toggleLayanan(layananNama) {
        if (openLayanan.has(layananNama)) {
            openLayanan.delete(layananNama);
        } else {
            openLayanan.add(layananNama);
        }
        renderProducts();
    }

    function toggleAplikasi(aplikasiId) {
        if (openAplikasi.has(aplikasiId)) {
            openAplikasi.delete(aplikasiId);
        } else {
            openAplikasi.add(aplikasiId);
        }
        renderProducts();
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderProducts() {
        if (!elements.productsContainer) return;
        
        if (productsData.length === 0) {
            elements.productsContainer.innerHTML = '';
            elements.emptyState.style.display = 'block';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        
        let html = '';
        
        productsData.forEach(layanan => {
            const isLayananOpen = openLayanan.has(layanan.layanan_nama);
            const layananId = `layanan-${layanan.layanan_nama.replace(/\s+/g, '-')}`;
            
            html += `
                <div class="layanan-card">
                    <div class="layanan-header">
                        <div class="layanan-icon">
                            ${layanan.layanan_gambar ? 
                                `<img src="${escapeHtml(layanan.layanan_gambar)}" alt="${escapeHtml(layanan.layanan_nama)}">` : 
                                `<i class="fas fa-layer-group"></i>`
                            }
                        </div>
                        <div class="layanan-info">
                            <div class="layanan-nama">${escapeHtml(layanan.layanan_nama)}</div>
                            ${layanan.layanan_desc ? `<div class="layanan-desc">${escapeHtml(layanan.layanan_desc)}</div>` : ''}
                        </div>
                        <div class="layanan-actions-right">
                            <button class="btn-icon add" onclick="window.produk.addLayanan()" title="Tambah Layanan">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn-icon edit" onclick="window.produk.editLayanan('${escapeHtml(layanan.layanan_nama)}')" title="Edit Layanan">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon delete" onclick="window.produk.deleteLayanan('${escapeHtml(layanan.layanan_nama)}')" title="Hapus Layanan">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="btn-icon toggle" onclick="window.produk.toggleLayanan('${escapeHtml(layanan.layanan_nama)}')" title="${isLayananOpen ? 'Tutup' : 'Buka'}">
                                <i class="fas fa-chevron-${isLayananOpen ? 'up' : 'down'}"></i>
                            </button>
                        </div>
                    </div>
                    
                    ${isLayananOpen ? `
                        <div class="layanan-banner">
                            ${layanan.layanan_banner ? 
                                `<img src="${escapeHtml(layanan.layanan_banner)}" alt="Banner" onerror="this.style.display='none'">` : ''
                            }
                        </div>
                        
                        <div class="layanan-catatan">
                            ${layanan.layanan_catatan ? 
                                `<small><i class="fas fa-sticky-note"></i> ${escapeHtml(layanan.layanan_catatan)}</small>` : ''
                            }
                        </div>
                        
                        <div class="aplikasi-container">
                    ` : ''}
            
            ${isLayananOpen ? layanan.aplikasi.map(aplikasi => {
                const aplikasiId = `aplikasi-${layanan.layanan_nama}-${aplikasi.aplikasi_nama}`.replace(/\s+/g, '-');
                const isAplikasiOpen = openAplikasi.has(aplikasiId);
                
                return `
                    <div class="aplikasi-card">
                        <div class="aplikasi-header">
                            <div class="aplikasi-logo">
                                ${aplikasi.aplikasi_gambar ? 
                                    `<img src="${escapeHtml(aplikasi.aplikasi_gambar)}" alt="${escapeHtml(aplikasi.aplikasi_nama)}">` : 
                                    `<i class="fas fa-mobile-alt"></i>`
                                }
                            </div>
                            <div class="aplikasi-info">
                                <div class="aplikasi-nama">${escapeHtml(aplikasi.aplikasi_nama)}</div>
                                ${aplikasi.aplikasi_desc ? `<div class="aplikasi-desc">${escapeHtml(aplikasi.aplikasi_desc)}</div>` : ''}
                            </div>
                            <div class="aplikasi-actions-right">
                                <button class="btn-icon add" onclick="window.produk.addAplikasi('${escapeHtml(layanan.layanan_nama)}')" title="Tambah Aplikasi">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-icon edit" onclick="window.produk.editAplikasi('${escapeHtml(layanan.layanan_nama)}', '${escapeHtml(aplikasi.aplikasi_nama)}')" title="Edit Aplikasi">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon delete" onclick="window.produk.deleteAplikasi('${escapeHtml(layanan.layanan_nama)}', '${escapeHtml(aplikasi.aplikasi_nama)}')" title="Hapus Aplikasi">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="btn-icon toggle" onclick="window.produk.toggleAplikasi('${escapeHtml(aplikasiId)}')" title="${isAplikasiOpen ? 'Tutup' : 'Buka'}">
                                    <i class="fas fa-chevron-${isAplikasiOpen ? 'up' : 'down'}"></i>
                                </button>
                            </div>
                        </div>
                        
                        ${isAplikasiOpen ? `
                            <div class="aplikasi-catatan">
                                ${aplikasi.aplikasi_catatan ? 
                                    `<small><i class="fas fa-sticky-note"></i> ${escapeHtml(aplikasi.aplikasi_catatan)}</small>` : ''
                                }
                            </div>
                            
                            <div class="items-container">
                                ${aplikasi.items.map(item => {
                                    const durasi = formatDurasi(item.item_durasi_jumlah, item.item_durasi_satuan);
                                    const tipeClass = item.item_tipe === 'seller' ? 'seller' : item.item_tipe === 'buyer' ? 'buyer' : '';
                                    const readyClass = item.item_ready ? 'ready' : 'sold';
                                    const metode = item.item_metode || 'directly';
                                    const stokCount = metode === 'directly' ? (item.item_stok?.length || 0) : 0;
                                    const hasFields = metode === 'request' && item.item_fields?.length > 0;
                                    
                                    return `
                                        <div class="item-card ${readyClass}" data-id="${item.id}">
                                            <div class="item-info">
                                                <div class="item-nama">
                                                    ${escapeHtml(item.item_nama)}
                                                </div>
                                                <div class="item-durasi-harga">
                                                    ${durasi ? `${escapeHtml(durasi)} • ` : ''}
                                                    <span class="item-harga">${formatRupiah(item.item_harga)}</span>
                                                </div>
                                                <div class="item-badges">
                                                    ${metode === 'directly' ? `
                                                        <span class="badge stok-badge">
                                                            <i class="fas fa-cubes"></i> stok:${stokCount}
                                                        </span>
                                                    ` : ''}
                                                    ${item.item_tipe ? `
                                                        <span class="badge tipe-badge ${item.item_tipe}">
                                                            <i class="fas fa-${item.item_tipe === 'seller' ? 'store' : 'shopping-cart'}"></i>
                                                            ${item.item_tipe}
                                                        </span>
                                                    ` : ''}
                                                    <span class="badge status-badge ${readyClass}">
                                                        <i class="fas fa-${item.item_ready ? 'check-circle' : 'times-circle'}"></i>
                                                        ${item.item_ready ? 'Ready' : 'Sold'}
                                                    </span>
                                                    ${metode === 'request' ? `
                                                        <span class="badge metode-badge request ${hasFields ? 'active' : 'inactive'}">
                                                            <i class="fas fa-clipboard-list"></i>
                                                            Request:${hasFields ? '✅' : '🚫'}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            <div class="item-actions">
                                                <button class="btn-icon edit" onclick="window.produk.editItem(${item.id})" title="Edit Item">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button class="btn-icon delete" onclick="window.produk.deleteItem(${item.id})" title="Hapus Item">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                                
                                <button class="btn-add-item" onclick="window.produk.addItem('${escapeHtml(layanan.layanan_nama)}', '${escapeHtml(aplikasi.aplikasi_nama)}')">
                                    <i class="fas fa-plus"></i> Tambah Item
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('') : ''}
            
            ${isLayananOpen ? `
                        <button class="btn-add-aplikasi" onclick="window.produk.addAplikasi('${escapeHtml(layanan.layanan_nama)}')">
                            <i class="fas fa-plus"></i> Tambah Aplikasi
                        </button>
                    </div>
                </div>
            ` : ''}
            `;
        });
        
        elements.productsContainer.innerHTML = html;
    }

    // ==================== LAYANAN FUNCTIONS ====================
    function openLayananModal(layanan = null) {
        if (layanan) {
            elements.layananModalTitle.textContent = 'Edit Layanan';
            elements.layananNama.value = layanan.layanan_nama || '';
            elements.layananGambar.value = layanan.layanan_gambar || '';
            elements.layananBanner.value = layanan.layanan_banner || '';
            elements.layananDesc.value = layanan.layanan_desc || '';
            elements.layananCatatan.value = layanan.layanan_catatan || '';
        } else {
            elements.layananModalTitle.textContent = 'Tambah Layanan';
            elements.layananForm.reset();
        }
        
        elements.layananModal.classList.add('active');
        vibrate(10);
    }

    function closeLayananModal() {
        elements.layananModal.classList.remove('active');
    }

    async function saveLayanan(e) {
        e.preventDefault();
        
        if (!currentWebsite) return;
        
        const data = {
            layanan_nama: elements.layananNama.value.trim(),
            layanan_gambar: elements.layananGambar.value.trim(),
            layanan_banner: elements.layananBanner.value.trim(),
            layanan_desc: elements.layananDesc.value.trim(),
            layanan_catatan: elements.layananCatatan.value.trim()
        };
        
        if (!data.layanan_nama) {
            showToast('Nama layanan wajib diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/layanan/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Layanan disimpan', 'success');
                closeLayananModal();
                await loadAllData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving layanan:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== APLIKASI FUNCTIONS ====================
    function openAplikasiModal(layananNama, aplikasi = null) {
        elements.aplikasiLayananNama.value = layananNama;
        
        if (aplikasi) {
            elements.aplikasiModalTitle.textContent = 'Edit Aplikasi';
            elements.aplikasiNama.value = aplikasi.aplikasi_nama || '';
            elements.aplikasiGambar.value = aplikasi.aplikasi_gambar || '';
            elements.aplikasiDesc.value = aplikasi.aplikasi_desc || '';
            elements.aplikasiCatatan.value = aplikasi.aplikasi_catatan || '';
        } else {
            elements.aplikasiModalTitle.textContent = 'Tambah Aplikasi';
            elements.aplikasiForm.reset();
            elements.aplikasiLayananNama.value = layananNama;
        }
        
        elements.aplikasiModal.classList.add('active');
        vibrate(10);
    }

    function closeAplikasiModal() {
        elements.aplikasiModal.classList.remove('active');
    }

    async function saveAplikasi(e) {
        e.preventDefault();
        
        if (!currentWebsite) return;
        
        const layananNama = elements.aplikasiLayananNama.value;
        const data = {
            aplikasi_nama: elements.aplikasiNama.value.trim(),
            aplikasi_gambar: elements.aplikasiGambar.value.trim(),
            aplikasi_desc: elements.aplikasiDesc.value.trim(),
            aplikasi_catatan: elements.aplikasiCatatan.value.trim()
        };
        
        if (!data.aplikasi_nama) {
            showToast('Nama aplikasi wajib diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/aplikasi/${currentWebsite.id}/${encodeURIComponent(layananNama)}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Aplikasi disimpan', 'success');
                closeAplikasiModal();
                await loadAllData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving aplikasi:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== ITEM FUNCTIONS ====================
    function openItemModal(layananNama, aplikasiNama, item = null) {
        currentLayanan = layananNama;
        currentAplikasi = aplikasiNama;
        
        if (item) {
            currentItem = item;
            elements.itemModalTitle.textContent = 'Edit Item';
            elements.itemId.value = item.id || '';
            elements.itemNama.value = item.item_nama || '';
            elements.itemDurasiJumlah.value = item.item_durasi_jumlah || 0;
            elements.itemDurasiSatuan.value = item.item_durasi_satuan || 'hari';
            elements.itemHarga.value = item.item_harga || 0;
            
            // Set tipe
            elements.itemTipeRadios.forEach(radio => {
                if (radio.value === (item.item_tipe || '')) {
                    radio.checked = true;
                }
            });
            
            // Set metode
            elements.itemMetodeRadios.forEach(radio => {
                if (radio.value === (item.item_metode || 'directly')) {
                    radio.checked = true;
                }
            });
            
            // Set stok & fields
            currentItemStok = item.item_stok || [];
            currentItemFields = item.item_fields || [];
            
            // Set ready
            elements.itemReadyRadios.forEach(radio => {
                if (radio.value === (item.item_ready ? 'ready' : 'sold')) {
                    radio.checked = true;
                }
            });
        } else {
            elements.itemModalTitle.textContent = 'Tambah Item';
            elements.itemForm.reset();
            elements.itemDurasiJumlah.value = 1;
            elements.itemDurasiSatuan.value = 'hari';
            elements.itemTipeRadios[0].checked = true; // seller
            elements.itemMetodeRadios[0].checked = true; // directly
            elements.itemReadyRadios[0].checked = true; // ready
            currentItemStok = [];
            currentItemFields = [];
        }
        
        updateItemMethodUI();
        renderItemStokList();
        renderItemFieldsList();
        
        elements.itemModal.classList.add('active');
        vibrate(10);
    }

    function closeItemModal() {
        elements.itemModal.classList.remove('active');
        currentItem = null;
        currentItemStok = [];
        currentItemFields = [];
    }

    function updateItemMethodUI() {
        const metode = document.querySelector('input[name="itemMetode"]:checked')?.value || 'directly';
        
        if (metode === 'directly') {
            elements.itemDirectlyPanel.style.display = 'block';
            elements.itemRequestPanel.style.display = 'none';
        } else {
            elements.itemDirectlyPanel.style.display = 'none';
            elements.itemRequestPanel.style.display = 'block';
        }
    }

    function renderItemStokList() {
        if (!elements.itemStokList) return;
        
        if (currentItemStok.length === 0) {
            elements.itemStokList.innerHTML = '';
            elements.emptyItemStok.style.display = 'block';
            return;
        }
        
        elements.emptyItemStok.style.display = 'none';
        
        let html = '';
        currentItemStok.forEach((item, index) => {
            html += `
                <div class="stok-item" data-index="${index}">
                    <span class="stok-item-data">${escapeHtml(item)}</span>
                    <div class="stok-item-actions">
                        <button class="stok-item-btn edit" onclick="window.produk.editStok(${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="stok-item-btn delete" onclick="window.produk.deleteStok(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.itemStokList.innerHTML = html;
    }

    function renderItemFieldsList() {
        if (!elements.itemFieldsList) return;
        
        if (currentItemFields.length === 0) {
            elements.itemFieldsList.innerHTML = '';
            elements.emptyItemFields.style.display = 'block';
            return;
        }
        
        elements.emptyItemFields.style.display = 'none';
        
        let html = '';
        currentItemFields.forEach((field, index) => {
            html += `
                <div class="field-item" data-index="${index}">
                    <div class="field-info">
                        <div class="field-nama">
                            ${escapeHtml(field.nama)}
                            ${field.required ? '<span class="field-required">Wajib</span>' : ''}
                        </div>
                        <div class="field-meta">
                            Tipe: ${field.tipe} ${field.placeholder ? `• ${escapeHtml(field.placeholder)}` : ''}
                        </div>
                    </div>
                    <div class="stok-item-actions">
                        <button class="stok-item-btn delete" onclick="window.produk.deleteField(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.itemFieldsList.innerHTML = html;
    }

    async function saveItem(e) {
        e.preventDefault();
        
        if (!currentWebsite || !currentLayanan || !currentAplikasi) return;
        
        const tipe = document.querySelector('input[name="itemTipe"]:checked')?.value || '';
        const metode = document.querySelector('input[name="itemMetode"]:checked')?.value || 'directly';
        const ready = document.querySelector('input[name="itemReady"]:checked')?.value === 'ready';
        
        const data = {
            id: elements.itemId.value ? parseInt(elements.itemId.value) : null,
            item_nama: elements.itemNama.value.trim(),
            item_durasi_jumlah: parseInt(elements.itemDurasiJumlah.value) || 0,
            item_durasi_satuan: elements.itemDurasiSatuan.value,
            item_harga: parseInt(elements.itemHarga.value) || 0,
            item_tipe: tipe,
            item_metode: metode,
            item_stok: metode === 'directly' ? currentItemStok : [],
            item_fields: metode === 'request' ? currentItemFields : [],
            item_ready: ready,
            aktif: true
        };
        
        if (!data.item_nama) {
            showToast('Nama item wajib diisi', 'warning');
            return;
        }
        
        if (data.item_harga <= 0) {
            showToast('Harga wajib diisi dan lebih dari 0', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(
                `${API_BASE_URL}/api/products/item/${currentWebsite.id}/${encodeURIComponent(currentLayanan)}/${encodeURIComponent(currentAplikasi)}`,
                {
                    method: 'POST',
                    body: JSON.stringify(data)
                }
            );
            
            if (response.success) {
                showToast('✅ Item disimpan', 'success');
                closeItemModal();
                await loadAllData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving item:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== DELETE FUNCTIONS ====================
    function openDeleteModal(type, name, callback) {
        let message = '';
        switch(type) {
            case 'layanan':
                message = `Hapus layanan "${name}"? Semua aplikasi dan item di dalamnya akan ikut terhapus.`;
                break;
            case 'aplikasi':
                message = `Hapus aplikasi "${name}"? Semua item di dalamnya akan ikut terhapus.`;
                break;
            case 'item':
                message = `Hapus item "${name}"?`;
                break;
        }
        
        elements.deleteMessage.textContent = message;
        elements.deleteInfo.innerHTML = `<strong>${escapeHtml(name)}</strong>`;
        
        elements.deleteModal.classList.add('active');
        window._deleteCallback = callback;
    }

    function closeDeleteModal() {
        elements.deleteModal.classList.remove('active');
        window._deleteCallback = null;
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadAllData();
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Back button
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/wtb/panel.html';
            });
        }
        
        // Add Layanan button (from empty state)
        document.getElementById('addLayananBtn').addEventListener('click', () => openLayananModal());
        
        // Layanan modal
        elements.closeLayananModal.addEventListener('click', closeLayananModal);
        elements.cancelLayananBtn.addEventListener('click', closeLayananModal);
        elements.layananForm.addEventListener('submit', saveLayanan);
        
        // Aplikasi modal
        elements.closeAplikasiModal.addEventListener('click', closeAplikasiModal);
        elements.cancelAplikasiBtn.addEventListener('click', closeAplikasiModal);
        elements.aplikasiForm.addEventListener('submit', saveAplikasi);
        
        // Item modal
        elements.closeItemModal.addEventListener('click', closeItemModal);
        elements.cancelItemBtn.addEventListener('click', closeItemModal);
        elements.itemForm.addEventListener('submit', saveItem);
        
        // Method change
        elements.itemMetodeRadios.forEach(radio => {
            radio.addEventListener('change', updateItemMethodUI);
        });
        
        // Stok modal
        elements.addItemStokBtn.addEventListener('click', () => {
            elements.stokDataInput.value = '';
            elements.stokModal.classList.add('active');
        });
        
        elements.closeStokModal.addEventListener('click', () => {
            elements.stokModal.classList.remove('active');
        });
        
        elements.cancelStokBtn.addEventListener('click', () => {
            elements.stokModal.classList.remove('active');
        });
        
        elements.confirmStokBtn.addEventListener('click', () => {
            const data = elements.stokDataInput.value;
            if (data.trim()) {
                const lines = data.split('\n').map(l => l.trim()).filter(l => l);
                currentItemStok = [...currentItemStok, ...lines];
                renderItemStokList();
                elements.stokModal.classList.remove('active');
                showToast(`✅ ${lines.length} data stok ditambahkan`, 'success');
            }
        });
        
        // Field modal
        elements.addItemFieldBtn.addEventListener('click', () => {
            elements.fieldNamaInput.value = '';
            elements.fieldTipeInput.value = 'text';
            elements.fieldPlaceholderInput.value = '';
            elements.fieldRequiredInput.checked = true;
            elements.fieldModal.classList.add('active');
        });
        
        elements.closeFieldModal.addEventListener('click', () => {
            elements.fieldModal.classList.remove('active');
        });
        
        elements.cancelFieldBtn.addEventListener('click', () => {
            elements.fieldModal.classList.remove('active');
        });
        
        elements.confirmFieldBtn.addEventListener('click', () => {
            const nama = elements.fieldNamaInput.value.trim();
            if (!nama) {
                showToast('Nama field wajib diisi', 'warning');
                return;
            }
            
            const field = {
                nama: nama,
                tipe: elements.fieldTipeInput.value,
                placeholder: elements.fieldPlaceholderInput.value,
                required: elements.fieldRequiredInput.checked
            };
            
            currentItemFields.push(field);
            renderItemFieldsList();
            elements.fieldModal.classList.remove('active');
            showToast('✅ Field ditambahkan', 'success');
        });
        
        // Delete modal
        elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        
        elements.confirmDeleteBtn.addEventListener('click', async () => {
            if (window._deleteCallback) {
                await window._deleteCallback();
                closeDeleteModal();
            }
        });
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.layananModal) closeLayananModal();
            if (e.target === elements.aplikasiModal) closeAplikasiModal();
            if (e.target === elements.itemModal) closeItemModal();
            if (e.target === elements.stokModal) elements.stokModal.classList.remove('active');
            if (e.target === elements.fieldModal) elements.fieldModal.classList.remove('active');
            if (e.target === elements.deleteModal) closeDeleteModal();
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.produk = {
        // Layanan
        addLayanan: () => openLayananModal(),
        editLayanan: (layananNama) => {
            const layanan = productsData.find(l => l.layanan_nama === layananNama);
            if (layanan) openLayananModal(layanan);
        },
        deleteLayanan: (layananNama) => {
            openDeleteModal('layanan', layananNama, async () => {
                if (!currentWebsite) return;
                showLoading(true);
                try {
                    const response = await fetchWithRetry(
                        `${API_BASE_URL}/api/products/layanan/${currentWebsite.id}/${encodeURIComponent(layananNama)}`,
                        { method: 'DELETE' }
                    );
                    if (response.success) {
                        showToast('✅ Layanan dihapus', 'success');
                        await loadAllData();
                    }
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    showLoading(false);
                }
            });
        },
        
        // Aplikasi
        addAplikasi: (layananNama) => openAplikasiModal(layananNama),
        editAplikasi: (layananNama, aplikasiNama) => {
            const layanan = productsData.find(l => l.layanan_nama === layananNama);
            if (layanan) {
                const aplikasi = layanan.aplikasi.find(a => a.aplikasi_nama === aplikasiNama);
                if (aplikasi) openAplikasiModal(layananNama, aplikasi);
            }
        },
        deleteAplikasi: (layananNama, aplikasiNama) => {
            openDeleteModal('aplikasi', aplikasiNama, async () => {
                if (!currentWebsite) return;
                showLoading(true);
                try {
                    const response = await fetchWithRetry(
                        `${API_BASE_URL}/api/products/aplikasi/${currentWebsite.id}/${encodeURIComponent(layananNama)}/${encodeURIComponent(aplikasiNama)}`,
                        { method: 'DELETE' }
                    );
                    if (response.success) {
                        showToast('✅ Aplikasi dihapus', 'success');
                        await loadAllData();
                    }
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    showLoading(false);
                }
            });
        },
        
        // Item
        addItem: (layananNama, aplikasiNama) => openItemModal(layananNama, aplikasiNama),
        editItem: (itemId) => {
            for (const layanan of productsData) {
                for (const aplikasi of layanan.aplikasi) {
                    const item = aplikasi.items.find(i => i.id === itemId);
                    if (item) {
                        openItemModal(layanan.layanan_nama, aplikasi.aplikasi_nama, item);
                        return;
                    }
                }
            }
        },
        deleteItem: (itemId) => {
            let itemNama = '';
            for (const layanan of productsData) {
                for (const aplikasi of layanan.aplikasi) {
                    const item = aplikasi.items.find(i => i.id === itemId);
                    if (item) {
                        itemNama = item.item_nama;
                        break;
                    }
                }
            }
            
            openDeleteModal('item', itemNama, async () => {
                if (!currentWebsite) return;
                showLoading(true);
                try {
                    const response = await fetchWithRetry(
                        `${API_BASE_URL}/api/products/item/${itemId}`,
                        { method: 'DELETE' }
                    );
                    if (response.success) {
                        showToast('✅ Item dihapus', 'success');
                        await loadAllData();
                    }
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    showLoading(false);
                }
            });
        },
        
        // Stok
        editStok: (index) => {
            const newValue = prompt('Edit data stok:', currentItemStok[index]);
            if (newValue !== null) {
                currentItemStok[index] = newValue;
                renderItemStokList();
            }
        },
        deleteStok: (index) => {
            if (confirm('Hapus data stok ini?')) {
                currentItemStok.splice(index, 1);
                renderItemStokList();
            }
        },
        
        // Fields
        deleteField: (index) => {
            if (confirm('Hapus field ini?')) {
                currentItemFields.splice(index, 1);
                renderItemFieldsList();
            }
        },
        
        // Toggle functions
        toggleLayanan: (layananNama) => toggleLayanan(layananNama),
        toggleAplikasi: (aplikasiId) => toggleAplikasi(aplikasiId)
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();
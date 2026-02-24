// produk.js - Manajemen Produk dengan Tampilan Tree (DENGAN TOMBOL MANAGE)
(function() {
    'use strict';
    
    console.log('📦 Produk Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let products = [];
    let filteredProducts = [];
    let editingProductId = null;
    
    // Form State (camelCase untuk internal)
    let formData = {
        layanan: '',
        layananGambar: '',
        layananDesc: '',
        aplikasi: '',
        aplikasiGambar: '',
        aplikasiDesc: '',
        itemNama: '',
        itemDurasi: '',
        harga: 0,
        fitur: 'biasa',
        method: 'directly',
        stok: [],
        fields: [],
        aktif: true
    };

    // Filter State
    let searchQuery = '';
    let methodFilter = 'all';
    let statusFilter = 'all';

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        productsTree: document.getElementById('productsTree'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        methodFilter: document.getElementById('methodFilter'),
        statusFilter: document.getElementById('statusFilter'),
        addProductBtn: document.getElementById('addProductBtn'),
        emptyAddBtn: document.getElementById('emptyAddBtn'),
        backToPanel: document.getElementById('backToPanel'),
        
        // Modal
        productModal: document.getElementById('productModal'),
        modalTitle: document.getElementById('modalTitle'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelFormBtn: document.getElementById('cancelFormBtn'),
        productForm: document.getElementById('productForm'),
        
        // Form Inputs
        layananInput: document.getElementById('layananInput'),
        layananGambarInput: document.getElementById('layananGambarInput'),
        layananDescInput: document.getElementById('layananDescInput'),
        aplikasiInput: document.getElementById('aplikasiInput'),
        aplikasiGambarInput: document.getElementById('aplikasiGambarInput'),
        aplikasiDescInput: document.getElementById('aplikasiDescInput'),
        itemNamaInput: document.getElementById('itemNamaInput'),
        itemDurasiInput: document.getElementById('itemDurasiInput'),
        itemHargaInput: document.getElementById('itemHargaInput'),
        itemFiturInput: document.getElementById('itemFiturInput'),
        methodRadios: document.querySelectorAll('input[name="method"]'),
        directlyPanel: document.getElementById('directlyPanel'),
        requestPanel: document.getElementById('requestPanel'),
        produkAktif: document.getElementById('produkAktif'),
        saveProductBtn: document.getElementById('saveProductBtn'),
        
        // Stok
        stokContainer: document.getElementById('stokContainer'),
        stokList: document.getElementById('stokList'),
        emptyStok: document.getElementById('emptyStok'),
        addStokBtn: document.getElementById('addStokBtn'),
        
        // Fields
        fieldsContainer: document.getElementById('fieldsContainer'),
        fieldsList: document.getElementById('fieldsList'),
        emptyFields: document.getElementById('emptyFields'),
        addFieldBtn: document.getElementById('addFieldBtn'),
        
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
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async function loadProducts(websiteId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/products/${websiteId}`, {
                method: 'GET'
            });
            
            if (data.success) {
                products = data.products || [];
                applyFilters();
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            showToast('Gagal memuat produk', 'error');
        }
    }

    async function saveProduct() {
        if (!currentWebsite) return;
        
        // Mapping dari camelCase (formData) ke underscore (database)
        const productData = {
            layanan: formData.layanan,
            layanan_gambar: formData.layananGambar,
            layanan_desc: formData.layananDesc,
            aplikasi: formData.aplikasi,
            aplikasi_gambar: formData.aplikasiGambar,
            aplikasi_desc: formData.aplikasiDesc,
            item_nama: formData.itemNama,
            item_durasi: formData.itemDurasi,
            harga: parseInt(formData.harga) || 0,
            fitur: formData.fitur,
            method: formData.method,
            stok: formData.method === 'directly' ? formData.stok : [],
            fields: formData.method === 'request' ? formData.fields : [],
            aktif: formData.aktif
        };
        
        console.log('📤 Sending product data:', productData);
        
        showLoading(true);
        
        try {
            let response;
            if (editingProductId) {
                response = await fetchWithRetry(`${API_BASE_URL}/api/products/${editingProductId}`, {
                    method: 'PUT',
                    body: JSON.stringify(productData)
                });
            } else {
                response = await fetchWithRetry(`${API_BASE_URL}/api/products/${currentWebsite.id}`, {
                    method: 'POST',
                    body: JSON.stringify(productData)
                });
            }
            
            if (response.success) {
                showToast(
                    editingProductId ? '✅ Produk diperbarui' : '✅ Produk ditambahkan',
                    'success'
                );
                closeModal();
                await loadProducts(currentWebsite.id);
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving product:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function deleteProduct(productId) {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/${productId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                showToast('✅ Produk dihapus', 'success');
                elements.deleteModal.classList.remove('active');
                await loadProducts(currentWebsite.id);
            } else {
                throw new Error(response.error || 'Gagal menghapus');
            }
        } catch (error) {
            console.error('❌ Error deleting product:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== FILTER FUNCTIONS ====================
    function applyFilters() {
        filteredProducts = products.filter(p => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const match = 
                    (p.layanan || '').toLowerCase().includes(query) ||
                    (p.aplikasi || '').toLowerCase().includes(query) ||
                    (p.item_nama || '').toLowerCase().includes(query);
                if (!match) return false;
            }
            
            // Method filter
            if (methodFilter !== 'all' && p.method !== methodFilter) {
                return false;
            }
            
            // Status filter
            if (statusFilter !== 'all') {
                const isActive = p.aktif ? 'active' : 'inactive';
                if (isActive !== statusFilter) return false;
            }
            
            return true;
        });
        
        renderProducts();
    }

    // ==================== RENDER FUNCTIONS ====================
    // 🔥 DITAMBAH: Tombol manage di setiap layanan dan aplikasi
    function renderProducts() {
        if (!elements.productsTree) return;
        
        if (filteredProducts.length === 0) {
            elements.productsTree.innerHTML = '';
            elements.emptyState.style.display = 'block';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        
        // Group by layanan
        const grouped = {};
        filteredProducts.forEach(p => {
            if (!grouped[p.layanan]) {
                grouped[p.layanan] = {
                    gambar: p.layanan_gambar || '',
                    desc: p.layanan_desc || '',
                    aplikasi: {}
                };
            }
            
            if (!grouped[p.layanan].aplikasi[p.aplikasi]) {
                grouped[p.layanan].aplikasi[p.aplikasi] = {
                    gambar: p.aplikasi_gambar || '',
                    desc: p.aplikasi_desc || '',
                    items: []
                };
            }
            
            grouped[p.layanan].aplikasi[p.aplikasi].items.push(p);
        });
        
        let html = '';
        
        for (const [layanan, layananData] of Object.entries(grouped)) {
            html += `
                <div class="layanan-card">
                    <div class="layanan-header" onclick="toggleLayanan(this)">
                        <div class="layanan-icon">
                            ${layananData.gambar ? 
                                `<img src="${escapeHtml(layananData.gambar)}" alt="${escapeHtml(layanan)}">` : 
                                `<i class="fas fa-layer-group"></i>`
                            }
                        </div>
                        <div class="layanan-info">
                            <div class="layanan-nama">${escapeHtml(layanan)}</div>
                            ${layananData.desc ? `<div class="layanan-desc">${escapeHtml(layananData.desc)}</div>` : ''}
                        </div>
                        <div class="layanan-actions">
                            <!-- 🔥 TOMBOL MANAGE LAYANAN (BARU) -->
                            <button class="btn-manage manage-layanan" data-tooltip="Kelola Layanan" onclick="event.stopPropagation(); window.produk.manageLayanan('${escapeHtml(layanan)}')">
                                <i class="fas fa-cog"></i>
                            </button>
                            <button class="layanan-toggle" onclick="event.stopPropagation(); toggleLayanan(this)">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <div class="layanan-content">
            `;
            
            for (const [aplikasi, appData] of Object.entries(layananData.aplikasi)) {
                html += `
                    <div class="aplikasi-card">
                        <div class="aplikasi-header" onclick="toggleAplikasi(this)">
                            <div class="aplikasi-logo">
                                ${appData.gambar ? 
                                    `<img src="${escapeHtml(appData.gambar)}" alt="${escapeHtml(aplikasi)}">` : 
                                    `<i class="fas fa-mobile-alt"></i>`
                                }
                            </div>
                            <div class="aplikasi-info">
                                <div class="aplikasi-nama">${escapeHtml(aplikasi)}</div>
                                ${appData.desc ? `<div class="aplikasi-desc">${escapeHtml(appData.desc)}</div>` : ''}
                            </div>
                            <span class="aplikasi-count">${appData.items.length} item</span>
                            <div class="aplikasi-actions">
                                <!-- 🔥 TOMBOL MANAGE APLIKASI (BARU) -->
                                <button class="btn-manage manage-aplikasi" data-tooltip="Kelola Aplikasi" onclick="event.stopPropagation(); window.produk.manageAplikasi('${escapeHtml(layanan)}', '${escapeHtml(aplikasi)}')">
                                    <i class="fas fa-cog"></i>
                                </button>
                                <button class="aplikasi-toggle" onclick="event.stopPropagation(); toggleAplikasi(this)">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                        <div class="aplikasi-items">
                `;
                
                appData.items.forEach(item => {
                    const stockCount = item.method === 'directly' ? (item.stok?.length || 0) : 0;
                    const stockClass = stockCount === 0 ? 'habis' : stockCount <= 5 ? 'low' : '';
                    
                    html += `
                        <div class="item-row" data-id="${item.id}">
                            <div class="item-info">
                                <div class="item-nama">${escapeHtml(item.item_nama)}</div>
                                ${item.item_durasi ? `<div class="item-durasi">${escapeHtml(item.item_durasi)}</div>` : ''}
                                <div class="item-meta">
                                    <span class="item-harga">${formatRupiah(item.harga)}</span>
                                    ${item.fitur !== 'biasa' ? 
                                        `<span class="item-badge ${item.fitur}">${item.fitur}</span>` : ''}
                                    <span class="item-method ${item.method}">
                                        <i class="fas fa-${item.method === 'directly' ? 'bolt' : 'clipboard-list'}"></i>
                                        ${item.method === 'directly' ? 'Direct' : 'Request'}
                                    </span>
                                    ${item.method === 'directly' ? `
                                        <span class="item-stok ${stockClass}">
                                            <i class="fas fa-cubes"></i>
                                            ${stockCount} stok
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="item-actions">
                                <button class="btn-icon edit" onclick="window.produk.editProduct(${item.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon delete" onclick="window.produk.deleteProduct(${item.id})" title="Hapus">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        elements.productsTree.innerHTML = html;
    }

    // ==================== FORM FUNCTIONS ====================
    function resetForm() {
        formData = {
            layanan: '',
            layananGambar: '',
            layananDesc: '',
            aplikasi: '',
            aplikasiGambar: '',
            aplikasiDesc: '',
            itemNama: '',
            itemDurasi: '',
            harga: 0,
            fitur: 'biasa',
            method: 'directly',
            stok: [],
            fields: [],
            aktif: true
        };
        
        editingProductId = null;
        
        // Reset inputs
        if (elements.layananInput) {
            elements.layananInput.value = '';
            elements.layananInput.disabled = false;
            elements.layananInput.classList.remove('disabled');
        }
        if (elements.layananGambarInput) elements.layananGambarInput.value = '';
        if (elements.layananDescInput) elements.layananDescInput.value = '';
        
        if (elements.aplikasiInput) {
            elements.aplikasiInput.value = '';
            elements.aplikasiInput.disabled = false;
            elements.aplikasiInput.classList.remove('disabled');
        }
        if (elements.aplikasiGambarInput) elements.aplikasiGambarInput.value = '';
        if (elements.aplikasiDescInput) elements.aplikasiDescInput.value = '';
        
        if (elements.itemNamaInput) elements.itemNamaInput.value = '';
        if (elements.itemDurasiInput) elements.itemDurasiInput.value = '';
        if (elements.itemHargaInput) elements.itemHargaInput.value = '';
        if (elements.itemFiturInput) elements.itemFiturInput.value = 'biasa';
        
        // Reset method
        elements.methodRadios.forEach(radio => {
            if (radio.value === 'directly') radio.checked = true;
        });
        updateMethodUI('directly');
        
        // Reset stok & fields
        formData.stok = [];
        formData.fields = [];
        renderStokList();
        renderFieldsList();
        
        if (elements.produkAktif) elements.produkAktif.checked = true;
    }

    // 🔥 FUNGSI BARU: Manage Layanan
    function manageLayanan(layanan) {
        resetForm();
        
        // Set layanan dan disable input
        formData.layanan = layanan;
        elements.layananInput.value = layanan;
        elements.layananInput.disabled = true;
        elements.layananInput.classList.add('disabled');
        
        // Tambah info manage
        const infoHtml = `
            <div class="manage-info">
                <i class="fas fa-layer-group"></i>
                <span>Menambah produk untuk layanan: <strong>${escapeHtml(layanan)}</strong></span>
            </div>
        `;
        
        // Sisipkan info di awal form
        const form = elements.productForm;
        const existingInfo = form.querySelector('.manage-info');
        if (existingInfo) existingInfo.remove();
        form.insertAdjacentHTML('afterbegin', infoHtml);
        
        elements.modalTitle.textContent = `Tambah Produk untuk Layanan: ${layanan}`;
        elements.productModal.classList.add('active');
        vibrate(10);
    }

    // 🔥 FUNGSI BARU: Manage Aplikasi
    function manageAplikasi(layanan, aplikasi) {
        resetForm();
        
        // Set layanan dan aplikasi, disable input
        formData.layanan = layanan;
        formData.aplikasi = aplikasi;
        
        elements.layananInput.value = layanan;
        elements.layananInput.disabled = true;
        elements.layananInput.classList.add('disabled');
        
        elements.aplikasiInput.value = aplikasi;
        elements.aplikasiInput.disabled = true;
        elements.aplikasiInput.classList.add('disabled');
        
        // Tambah info manage
        const infoHtml = `
            <div class="manage-info aplikasi">
                <i class="fas fa-mobile-alt"></i>
                <span>Menambah produk untuk aplikasi: <strong>${escapeHtml(aplikasi)}</strong> (Layanan: ${escapeHtml(layanan)})</span>
            </div>
        `;
        
        // Sisipkan info di awal form
        const form = elements.productForm;
        const existingInfo = form.querySelector('.manage-info');
        if (existingInfo) existingInfo.remove();
        form.insertAdjacentHTML('afterbegin', infoHtml);
        
        elements.modalTitle.textContent = `Tambah Produk untuk Aplikasi: ${aplikasi}`;
        elements.productModal.classList.add('active');
        vibrate(10);
    }

    function loadProductForEdit(product) {
        editingProductId = product.id;
        
        // Mapping dari database (underscore) ke form (camelCase)
        formData = {
            layanan: product.layanan || '',
            layananGambar: product.layanan_gambar || '',
            layananDesc: product.layanan_desc || '',
            aplikasi: product.aplikasi || '',
            aplikasiGambar: product.aplikasi_gambar || '',
            aplikasiDesc: product.aplikasi_desc || '',
            itemNama: product.item_nama || '',
            itemDurasi: product.item_durasi || '',
            harga: product.harga || 0,
            fitur: product.fitur || 'biasa',
            method: product.method || 'directly',
            stok: product.stok || [],
            fields: product.fields || [],
            aktif: product.aktif !== false
        };
        
        // Fill inputs
        elements.layananInput.value = formData.layanan;
        elements.layananGambarInput.value = formData.layananGambar;
        elements.layananDescInput.value = formData.layananDesc;
        elements.aplikasiInput.value = formData.aplikasi;
        elements.aplikasiGambarInput.value = formData.aplikasiGambar;
        elements.aplikasiDescInput.value = formData.aplikasiDesc;
        elements.itemNamaInput.value = formData.itemNama;
        elements.itemDurasiInput.value = formData.itemDurasi;
        elements.itemHargaInput.value = formData.harga;
        elements.itemFiturInput.value = formData.fitur;
        
        // Set method
        elements.methodRadios.forEach(radio => {
            if (radio.value === formData.method) radio.checked = true;
        });
        updateMethodUI(formData.method);
        
        // Render stok & fields
        renderStokList();
        renderFieldsList();
        
        elements.produkAktif.checked = formData.aktif;
        elements.modalTitle.textContent = 'Edit Produk';
    }

    function updateMethodUI(method) {
        if (method === 'directly') {
            elements.directlyPanel.style.display = 'block';
            elements.requestPanel.style.display = 'none';
        } else {
            elements.directlyPanel.style.display = 'none';
            elements.requestPanel.style.display = 'block';
        }
        formData.method = method;
    }

    // ==================== STOK FUNCTIONS ====================
    function renderStokList() {
        if (!elements.stokList) return;
        
        if (formData.stok.length === 0) {
            elements.stokList.innerHTML = '';
            elements.emptyStok.style.display = 'block';
            return;
        }
        
        elements.emptyStok.style.display = 'none';
        
        let html = '';
        formData.stok.forEach((item, index) => {
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
        
        elements.stokList.innerHTML = html;
    }

    // ==================== FIELDS FUNCTIONS ====================
    function renderFieldsList() {
        if (!elements.fieldsList) return;
        
        if (formData.fields.length === 0) {
            elements.fieldsList.innerHTML = '';
            elements.emptyFields.style.display = 'block';
            return;
        }
        
        elements.emptyFields.style.display = 'none';
        
        let html = '';
        formData.fields.forEach((field, index) => {
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
        
        elements.fieldsList.innerHTML = html;
    }

    // ==================== MODAL FUNCTIONS ====================
    function openModal() {
        resetForm();
        
        // Hapus info manage jika ada
        const existingInfo = elements.productForm.querySelector('.manage-info');
        if (existingInfo) existingInfo.remove();
        
        elements.modalTitle.textContent = 'Tambah Produk';
        elements.productModal.classList.add('active');
        vibrate(10);
    }

    function closeModal() {
        elements.productModal.classList.remove('active');
        resetForm();
    }

    function openDeleteModal(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        elements.deleteInfo.innerHTML = `
            <strong>${escapeHtml(product.item_nama)}</strong><br>
            <small>${escapeHtml(product.aplikasi)} • ${escapeHtml(product.layanan)}</small>
        `;
        
        elements.deleteModal.classList.add('active');
        window._deletingProductId = productId;
    }

    // ==================== VALIDATION ====================
    function validateForm() {
        if (!formData.layanan) {
            showToast('Nama layanan wajib diisi', 'warning');
            elements.layananInput.focus();
            return false;
        }
        if (!formData.aplikasi) {
            showToast('Nama aplikasi wajib diisi', 'warning');
            elements.aplikasiInput.focus();
            return false;
        }
        if (!formData.itemNama) {
            showToast('Nama item wajib diisi', 'warning');
            elements.itemNamaInput.focus();
            return false;
        }
        if (!formData.harga || formData.harga <= 0) {
            showToast('Harga wajib diisi dan lebih dari 0', 'warning');
            elements.itemHargaInput.focus();
            return false;
        }
        return true;
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            // Load website data
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            // Load products
            await loadProducts(currentWebsite.id);
            
            // Check for edit parameter
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('edit');
            if (editId) {
                const product = products.find(p => p.id === parseInt(editId));
                if (product) {
                    setTimeout(() => {
                        loadProductForEdit(product);
                        elements.productModal.classList.add('active');
                    }, 500);
                }
            }
            
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
        
        // Add product buttons
        if (elements.addProductBtn) {
            elements.addProductBtn.addEventListener('click', openModal);
        }
        if (elements.emptyAddBtn) {
            elements.emptyAddBtn.addEventListener('click', openModal);
        }
        
        // Close modal
        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', closeModal);
        }
        if (elements.cancelFormBtn) {
            elements.cancelFormBtn.addEventListener('click', closeModal);
        }
        
        // Form submit
        if (elements.productForm) {
            elements.productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Update formData from inputs
                formData.layanan = elements.layananInput.value;
                formData.layananGambar = elements.layananGambarInput.value;
                formData.layananDesc = elements.layananDescInput.value;
                formData.aplikasi = elements.aplikasiInput.value;
                formData.aplikasiGambar = elements.aplikasiGambarInput.value;
                formData.aplikasiDesc = elements.aplikasiDescInput.value;
                formData.itemNama = elements.itemNamaInput.value;
                formData.itemDurasi = elements.itemDurasiInput.value;
                formData.harga = parseInt(elements.itemHargaInput.value) || 0;
                formData.fitur = elements.itemFiturInput.value;
                formData.aktif = elements.produkAktif.checked;
                
                if (validateForm()) {
                    saveProduct();
                }
            });
        }
        
        // Method change
        elements.methodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                updateMethodUI(e.target.value);
            });
        });
        
        // Stok modal
        if (elements.addStokBtn) {
            elements.addStokBtn.addEventListener('click', () => {
                elements.stokDataInput.value = '';
                elements.stokModal.classList.add('active');
            });
        }
        
        if (elements.closeStokModal) {
            elements.closeStokModal.addEventListener('click', () => {
                elements.stokModal.classList.remove('active');
            });
        }
        
        if (elements.cancelStokBtn) {
            elements.cancelStokBtn.addEventListener('click', () => {
                elements.stokModal.classList.remove('active');
            });
        }
        
        if (elements.confirmStokBtn) {
            elements.confirmStokBtn.addEventListener('click', () => {
                const data = elements.stokDataInput.value;
                if (data.trim()) {
                    const lines = data.split('\n').map(l => l.trim()).filter(l => l);
                    formData.stok = [...formData.stok, ...lines];
                    renderStokList();
                    elements.stokModal.classList.remove('active');
                    showToast(`✅ ${lines.length} data stok ditambahkan`, 'success');
                }
            });
        }
        
        // Field modal
        if (elements.addFieldBtn) {
            elements.addFieldBtn.addEventListener('click', () => {
                elements.fieldNamaInput.value = '';
                elements.fieldTipeInput.value = 'text';
                elements.fieldPlaceholderInput.value = '';
                elements.fieldRequiredInput.checked = true;
                elements.fieldModal.classList.add('active');
            });
        }
        
        if (elements.closeFieldModal) {
            elements.closeFieldModal.addEventListener('click', () => {
                elements.fieldModal.classList.remove('active');
            });
        }
        
        if (elements.cancelFieldBtn) {
            elements.cancelFieldBtn.addEventListener('click', () => {
                elements.fieldModal.classList.remove('active');
            });
        }
        
        if (elements.confirmFieldBtn) {
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
                
                formData.fields.push(field);
                renderFieldsList();
                elements.fieldModal.classList.remove('active');
                showToast('✅ Field ditambahkan', 'success');
            });
        }
        
        // Delete modal
        if (elements.closeDeleteModal) {
            elements.closeDeleteModal.addEventListener('click', () => {
                elements.deleteModal.classList.remove('active');
            });
        }
        
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', () => {
                elements.deleteModal.classList.remove('active');
            });
        }
        
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', () => {
                if (window._deletingProductId) {
                    deleteProduct(window._deletingProductId);
                }
            });
        }
        
        // Filters
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                applyFilters();
            });
        }
        
        if (elements.methodFilter) {
            elements.methodFilter.addEventListener('change', (e) => {
                methodFilter = e.target.value;
                applyFilters();
            });
        }
        
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', (e) => {
                statusFilter = e.target.value;
                applyFilters();
            });
        }
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.productModal) {
                closeModal();
            }
            if (e.target === elements.stokModal) {
                elements.stokModal.classList.remove('active');
            }
            if (e.target === elements.fieldModal) {
                elements.fieldModal.classList.remove('active');
            }
            if (e.target === elements.deleteModal) {
                elements.deleteModal.classList.remove('active');
            }
        });
    }

    // ==================== TOGGLE FUNCTIONS ====================
    window.toggleLayanan = function(element) {
        const header = element.closest('.layanan-header');
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.layanan-toggle i');
        
        content.classList.toggle('open');
        toggle.style.transform = content.classList.contains('open') ? 'rotate(180deg)' : '';
    };

    window.toggleAplikasi = function(element) {
        const header = element.closest('.aplikasi-header');
        const items = header.nextElementSibling;
        const toggle = header.querySelector('.aplikasi-toggle i');
        
        items.classList.toggle('open');
        toggle.style.transform = items.classList.contains('open') ? 'rotate(180deg)' : '';
    };

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.produk = {
        editProduct: (id) => {
            const product = products.find(p => p.id === id);
            if (product) {
                loadProductForEdit(product);
                elements.productModal.classList.add('active');
            }
        },
        deleteProduct: (id) => {
            openDeleteModal(id);
        },
        editStok: (index) => {
            const newValue = prompt('Edit data stok:', formData.stok[index]);
            if (newValue !== null) {
                formData.stok[index] = newValue;
                renderStokList();
            }
        },
        deleteStok: (index) => {
            if (confirm('Hapus data stok ini?')) {
                formData.stok.splice(index, 1);
                renderStokList();
            }
        },
        deleteField: (index) => {
            if (confirm('Hapus field ini?')) {
                formData.fields.splice(index, 1);
                renderFieldsList();
            }
        },
        // 🔥 FUNGSI BARU: Manage Layanan dan Aplikasi
        manageLayanan: (layanan) => manageLayanan(layanan),
        manageAplikasi: (layanan, aplikasi) => manageAplikasi(layanan, aplikasi)
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();
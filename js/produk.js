// produk.js - Manajemen Produk dengan Integrasi Backend
(function() {
    'use strict';
    
    console.log('📦 Produk Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    // ==================== STATE ====================
    let currentUser = null;
    let currentWebsite = null;
    let products = [];
    let filteredProducts = [];
    let editingProductId = null;
    let editingMode = false;
    
    // State untuk form bertahap
    let formData = {
        layanan: '',
        layananGambar: '',
        layananDesc: '',
        aplikasi: '',
        aplikasiGambar: '',
        aplikasiDesc: '',
        item: {
            nama: '',
            durasi: '',
            harga: 0,
            fitur: 'biasa'
        },
        method: 'directly',
        stok: [],
        fields: [],
        aktif: true
    };

    // UI State
    let currentFilter = 'all';
    let searchQuery = '';

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        
        // Stats
        totalLayanan: document.getElementById('totalLayanan'),
        totalAktif: document.getElementById('totalAktif'),
        totalLowStock: document.getElementById('totalLowStock'),
        totalTerjual: document.getElementById('totalTerjual'),
        
        // Products Tree
        productsTree: document.getElementById('productsTree'),
        emptyState: document.getElementById('emptyState'),
        
        // Filter
        searchInput: document.getElementById('searchInput'),
        filterBtns: document.querySelectorAll('.filter-btn'),
        
        // Buttons
        addProductBtn: document.getElementById('addProductBtn'),
        emptyAddBtn: document.getElementById('emptyAddBtn'),
        
        // Product Modal
        productModal: document.getElementById('productModal'),
        modalTitle: document.getElementById('modalTitle'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        
        // Stepper
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        step3: document.getElementById('step3'),
        stepElements: document.querySelectorAll('.step'),
        stepLines: document.querySelectorAll('.step-line'),
        
        // Step 1
        layananInput: document.getElementById('layananInput'),
        layananGambarInput: document.getElementById('layananGambarInput'),
        layananDescInput: document.getElementById('layananDescInput'),
        layananPreview: document.getElementById('layananPreview'),
        cancelStep1Btn: document.getElementById('cancelStep1Btn'),
        nextToStep2: document.getElementById('nextToStep2'),
        
        // Step 2
        aplikasiInput: document.getElementById('aplikasiInput'),
        aplikasiGambarInput: document.getElementById('aplikasiGambarInput'),
        aplikasiDescInput: document.getElementById('aplikasiDescInput'),
        aplikasiPreview: document.getElementById('aplikasiPreview'),
        prevToStep1: document.getElementById('prevToStep1'),
        nextToStep3: document.getElementById('nextToStep3'),
        
        // Step 3
        itemNamaInput: document.getElementById('itemNamaInput'),
        itemDurasiInput: document.getElementById('itemDurasiInput'),
        itemHargaInput: document.getElementById('itemHargaInput'),
        itemFiturInput: document.getElementById('itemFiturInput'),
        
        methodCards: document.querySelectorAll('.method-card'),
        methodRadios: document.querySelectorAll('input[name="method"]'),
        directlyPanel: document.getElementById('directlyPanel'),
        requestPanel: document.getElementById('requestPanel'),
        
        stokContainer: document.getElementById('stokContainer'),
        emptyStok: document.getElementById('emptyStok'),
        stokList: document.getElementById('stokList'),
        addStokBtn: document.getElementById('addStokBtn'),
        
        formatContainer: document.getElementById('formatContainer'),
        emptyFormat: document.getElementById('emptyFormat'),
        formatList: document.getElementById('formatList'),
        addFieldBtn: document.getElementById('addFieldBtn'),
        
        produkAktif: document.getElementById('produkAktif'),
        
        prevToStep2: document.getElementById('prevToStep2'),
        saveProductBtn: document.getElementById('saveProductBtn'),
        
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
        
        // Edit Stok Modal
        editStokModal: document.getElementById('editStokModal'),
        editStokInput: document.getElementById('editStokInput'),
        closeEditStokModal: document.getElementById('closeEditStokModal'),
        cancelEditStokBtn: document.getElementById('cancelEditStokBtn'),
        confirmEditStokBtn: document.getElementById('confirmEditStokBtn'),
        
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

    function showLoading(text = 'Memuat...') {
        if (elements.loadingOverlay) {
            if (elements.loadingText) elements.loadingText.textContent = text;
            elements.loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
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
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                console.log(`🔄 Retry... ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function fetchWebsite(userId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (data.success && data.websites && data.websites.length > 0) {
                return data.websites[0];
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching website:', error);
            showToast('Gagal memuat data website', 'error');
            return null;
        }
    }

    async function fetchProducts(websiteId) {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/${websiteId}/products`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            return data.success ? (data.products || []) : [];
        } catch (error) {
            console.error('❌ Error fetching products:', error);
            showToast('Gagal memuat produk', 'error');
            return [];
        }
    }

    async function saveProductToAPI(websiteId, productData) {
        try {
            let response;
            
            if (editingProductId) {
                // Update existing product
                response = await fetchWithRetry(`${API_BASE_URL}/api/websites/${websiteId}/products/${editingProductId}`, {
                    method: 'PUT',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(productData)
                });
            } else {
                // Create new product
                response = await fetchWithRetry(`${API_BASE_URL}/api/websites/${websiteId}/products`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(productData)
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ Error saving product:', error);
            throw error;
        }
    }

    async function deleteProductFromAPI(websiteId, productId) {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/websites/${websiteId}/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            return response;
        } catch (error) {
            console.error('❌ Error deleting product:', error);
            throw error;
        }
    }

    // ==================== RENDER FUNCTIONS ====================
    function updateStats() {
        // Hitung unique layanan
        const uniqueLayanan = new Set(products.map(p => p.layanan || 'Lainnya'));
        if (elements.totalLayanan) elements.totalLayanan.textContent = uniqueLayanan.size;
        
        // Hitung produk aktif
        const aktif = products.filter(p => p.aktif !== false).length;
        if (elements.totalAktif) elements.totalAktif.textContent = aktif;
        
        // Hitung stok menipis (<=5)
        const lowStock = products.filter(p => 
            p.method === 'directly' && p.stok && p.stok.length > 0 && p.stok.length <= 5
        ).length;
        if (elements.totalLowStock) elements.totalLowStock.textContent = lowStock;
        
        // Hitung total terjual
        const terjual = products.reduce((sum, p) => sum + (p.terjual || 0), 0);
        if (elements.totalTerjual) elements.totalTerjual.textContent = terjual;
    }

    function applyFilter() {
        filteredProducts = products.filter(p => {
            // Filter by method
            if (currentFilter !== 'all' && p.method !== currentFilter) {
                return false;
            }
            
            // Search by layanan, aplikasi, atau item
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    (p.layanan || '').toLowerCase().includes(query) ||
                    (p.aplikasi || '').toLowerCase().includes(query) ||
                    (p.itemNama || '').toLowerCase().includes(query)
                );
            }
            
            return true;
        });
        
        renderProductsTree();
    }

    function renderProductsTree() {
        if (!elements.productsTree) return;
        
        if (filteredProducts.length === 0) {
            elements.productsTree.innerHTML = '';
            if (elements.emptyState) elements.emptyState.style.display = 'block';
            return;
        }
        
        if (elements.emptyState) elements.emptyState.style.display = 'none';
        
        // Group by layanan
        const groupedByLayanan = {};
        filteredProducts.forEach(p => {
            const layanan = p.layanan || 'Lainnya';
            if (!groupedByLayanan[layanan]) {
                groupedByLayanan[layanan] = {
                    gambar: p.layananGambar || '',
                    desc: p.layananDesc || '',
                    aplikasi: {}
                };
            }
            
            const aplikasi = p.aplikasi || 'Umum';
            if (!groupedByLayanan[layanan].aplikasi[aplikasi]) {
                groupedByLayanan[layanan].aplikasi[aplikasi] = {
                    gambar: p.aplikasiGambar || '',
                    desc: p.aplikasiDesc || '',
                    items: []
                };
            }
            
            groupedByLayanan[layanan].aplikasi[aplikasi].items.push(p);
        });
        
        let html = '';
        
        for (const [layanan, layananData] of Object.entries(groupedByLayanan)) {
            html += `
                <div class="layanan-group" data-layanan="${escapeHtml(layanan)}">
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
                            <div class="layanan-meta">
                                ${Object.keys(layananData.aplikasi).length} Aplikasi • 
                                ${Object.values(layananData.aplikasi).reduce((sum, a) => sum + a.items.length, 0)} Item
                            </div>
                        </div>
                        <div class="layanan-actions">
                            <button class="layanan-toggle" onclick="event.stopPropagation(); toggleLayanan(this)">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <div class="layanan-content">
            `;
            
            for (const [aplikasi, appData] of Object.entries(layananData.aplikasi)) {
                html += `
                    <div class="aplikasi-card" data-aplikasi="${escapeHtml(aplikasi)}">
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
                            <div class="aplikasi-count">${appData.items.length} item</div>
                            <div class="aplikasi-actions">
                                <button class="aplikasi-toggle" onclick="event.stopPropagation(); toggleAplikasi(this)">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                        <div class="aplikasi-items">
                `;
                
                appData.items.forEach(item => {
                    const stokCount = item.method === 'directly' ? (item.stok?.length || 0) : '-';
                    const stokClass = item.method === 'directly' ? 
                        (stokCount === 0 ? 'habis' : stokCount <= 5 ? 'low' : '') : '';
                    
                    html += `
                        <div class="item-card" data-id="${item.id}">
                            <div class="item-info">
                                <div class="item-nama">${escapeHtml(item.itemNama || item.nama)}</div>
                                ${item.itemDurasi ? `<div class="item-durasi">${escapeHtml(item.itemDurasi)}</div>` : ''}
                                <div class="item-meta">
                                    <span class="item-harga">${formatRupiah(item.harga)}</span>
                                    ${item.fitur && item.fitur !== 'biasa' ? 
                                        `<span class="item-badge ${item.fitur}">${item.fitur}</span>` : ''}
                                    <span class="item-stok ${stokClass}">
                                        <i class="fas fa-cubes"></i>
                                        ${item.method === 'directly' ? `${stokCount} stok` : 'Request'}
                                    </span>
                                </div>
                            </div>
                            <div class="item-actions">
                                <button class="btn-icon-sm edit" onclick="window.produk.editProduct(${item.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${item.method === 'directly' ? `
                                    <button class="btn-icon-sm stok" onclick="window.produk.kelolaStok(${item.id})" title="Kelola Stok">
                                        <i class="fas fa-database"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-icon-sm delete" onclick="window.produk.deleteProduct(${item.id})" title="Hapus">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                            <button class="add-item-btn" onclick="window.produk.addItem('${escapeHtml(layanan)}', '${escapeHtml(aplikasi)}')">
                                <i class="fas fa-plus"></i> Tambah Item
                            </button>
                        </div>
                    </div>
                `;
            }
            
            html += `
                        <button class="add-aplikasi-btn" onclick="window.produk.addAplikasi('${escapeHtml(layanan)}')">
                            <i class="fas fa-plus"></i> Tambah Aplikasi
                        </button>
                    </div>
                </div>
            `;
        }
        
        elements.productsTree.innerHTML = html;
    }

    // ==================== STEPPER FUNCTIONS ====================
    function goToStep(step) {
        // Update step indicators
        elements.stepElements.forEach((el, index) => {
            const stepNum = index + 1;
            if (stepNum < step) {
                el.classList.add('done');
                el.classList.remove('active');
            } else if (stepNum === step) {
                el.classList.add('active');
                el.classList.remove('done');
            } else {
                el.classList.remove('active', 'done');
            }
        });
        
        elements.stepLines.forEach((el, index) => {
            if (index + 1 < step) {
                el.classList.add('done');
            } else {
                el.classList.remove('done');
            }
        });
        
        // Show active step content
        [elements.step1, elements.step2, elements.step3].forEach((el, index) => {
            if (index + 1 === step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        vibrate(10);
    }

    function resetForm() {
        formData = {
            layanan: '',
            layananGambar: '',
            layananDesc: '',
            aplikasi: '',
            aplikasiGambar: '',
            aplikasiDesc: '',
            item: {
                nama: '',
                durasi: '',
                harga: 0,
                fitur: 'biasa'
            },
            method: 'directly',
            stok: [],
            fields: [],
            aktif: true
        };
        
        editingProductId = null;
        editingMode = false;
        
        // Clear inputs
        if (elements.layananInput) elements.layananInput.value = '';
        if (elements.layananGambarInput) elements.layananGambarInput.value = '';
        if (elements.layananDescInput) elements.layananDescInput.value = '';
        if (elements.layananPreview) elements.layananPreview.style.display = 'none';
        
        if (elements.aplikasiInput) elements.aplikasiInput.value = '';
        if (elements.aplikasiGambarInput) elements.aplikasiGambarInput.value = '';
        if (elements.aplikasiDescInput) elements.aplikasiDescInput.value = '';
        if (elements.aplikasiPreview) elements.aplikasiPreview.style.display = 'none';
        
        if (elements.itemNamaInput) elements.itemNamaInput.value = '';
        if (elements.itemDurasiInput) elements.itemDurasiInput.value = '';
        if (elements.itemHargaInput) elements.itemHargaInput.value = '';
        if (elements.itemFiturInput) elements.itemFiturInput.value = 'biasa';
        
        // Reset method
        elements.methodRadios.forEach(radio => {
            if (radio.value === 'directly') radio.checked = true;
        });
        updateMethodUI('directly');
        
        // Clear stok & fields
        formData.stok = [];
        formData.fields = [];
        renderStokList();
        renderFieldsList();
        
        if (elements.produkAktif) elements.produkAktif.checked = true;
        
        goToStep(1);
    }

    function loadProductForEdit(product) {
        editingProductId = product.id;
        editingMode = true;
        
        // Step 1
        formData.layanan = product.layanan || '';
        formData.layananGambar = product.layananGambar || '';
        formData.layananDesc = product.layananDesc || '';
        
        if (elements.layananInput) elements.layananInput.value = formData.layanan;
        if (elements.layananGambarInput) elements.layananGambarInput.value = formData.layananGambar;
        if (elements.layananDescInput) elements.layananDescInput.value = formData.layananDesc;
        
        if (formData.layananGambar && elements.layananPreview) {
            const img = elements.layananPreview.querySelector('img');
            if (img) {
                img.src = formData.layananGambar;
                elements.layananPreview.style.display = 'block';
            }
        }
        
        // Step 2
        formData.aplikasi = product.aplikasi || '';
        formData.aplikasiGambar = product.aplikasiGambar || '';
        formData.aplikasiDesc = product.aplikasiDesc || '';
        
        if (elements.aplikasiInput) elements.aplikasiInput.value = formData.aplikasi;
        if (elements.aplikasiGambarInput) elements.aplikasiGambarInput.value = formData.aplikasiGambar;
        if (elements.aplikasiDescInput) elements.aplikasiDescInput.value = formData.aplikasiDesc;
        
        if (formData.aplikasiGambar && elements.aplikasiPreview) {
            const img = elements.aplikasiPreview.querySelector('img');
            if (img) {
                img.src = formData.aplikasiGambar;
                elements.aplikasiPreview.style.display = 'block';
            }
        }
        
        // Step 3
        formData.item = {
            nama: product.itemNama || product.nama || '',
            durasi: product.itemDurasi || '',
            harga: product.harga || 0,
            fitur: product.fitur || 'biasa'
        };
        formData.method = product.method || 'directly';
        formData.stok = product.stok || [];
        formData.fields = product.fields || [];
        formData.aktif = product.aktif !== false;
        
        if (elements.itemNamaInput) elements.itemNamaInput.value = formData.item.nama;
        if (elements.itemDurasiInput) elements.itemDurasiInput.value = formData.item.durasi;
        if (elements.itemHargaInput) elements.itemHargaInput.value = formData.item.harga;
        if (elements.itemFiturInput) elements.itemFiturInput.value = formData.item.fitur;
        
        // Set method
        elements.methodRadios.forEach(radio => {
            if (radio.value === formData.method) radio.checked = true;
        });
        updateMethodUI(formData.method);
        
        // Render stok & fields
        renderStokList();
        renderFieldsList();
        
        if (elements.produkAktif) elements.produkAktif.checked = formData.aktif;
        
        if (elements.modalTitle) elements.modalTitle.textContent = 'Edit Produk';
        goToStep(3); // Langsung ke step 3 untuk edit
    }

    // ==================== METHOD UI ====================
    function updateMethodUI(method) {
        elements.methodCards.forEach(card => {
            const cardMethod = card.dataset.method;
            if (cardMethod === method) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        if (method === 'directly') {
            if (elements.directlyPanel) elements.directlyPanel.style.display = 'block';
            if (elements.requestPanel) elements.requestPanel.style.display = 'none';
        } else {
            if (elements.directlyPanel) elements.directlyPanel.style.display = 'none';
            if (elements.requestPanel) elements.requestPanel.style.display = 'block';
        }
        
        formData.method = method;
    }

    // ==================== STOK FUNCTIONS ====================
    function renderStokList() {
        if (!elements.stokList) return;
        
        if (formData.stok.length === 0) {
            if (elements.emptyStok) elements.emptyStok.style.display = 'block';
            elements.stokList.innerHTML = '';
            return;
        }
        
        if (elements.emptyStok) elements.emptyStok.style.display = 'none';
        
        let html = '';
        formData.stok.forEach((item, index) => {
            html += `
                <div class="stok-item" data-index="${index}">
                    <span class="stok-item-data">${escapeHtml(item)}</span>
                    <div class="stok-item-actions">
                        <button class="stok-item-btn" onclick="window.produk.editStok(${index})">
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

    function addStok(data) {
        const lines = data.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        formData.stok = [...formData.stok, ...lines];
        renderStokList();
        showToast(`✅ ${lines.length} data stok ditambahkan`, 'success');
    }

    function editStok(index) {
        if (elements.editStokInput) {
            elements.editStokInput.value = formData.stok[index];
            elements.editStokModal.classList.add('active');
            
            window._editingStokIndex = index;
        }
    }

    function updateStok(index, newValue) {
        formData.stok[index] = newValue;
        renderStokList();
        showToast('✅ Stok diperbarui', 'success');
    }

    function deleteStok(index) {
        formData.stok.splice(index, 1);
        renderStokList();
        showToast('✅ Stok dihapus', 'success');
    }

    // ==================== FIELD FUNCTIONS ====================
    function renderFieldsList() {
        if (!elements.formatList) return;
        
        if (formData.fields.length === 0) {
            if (elements.emptyFormat) elements.emptyFormat.style.display = 'block';
            elements.formatList.innerHTML = '';
            return;
        }
        
        if (elements.emptyFormat) elements.emptyFormat.style.display = 'none';
        
        let html = '';
        formData.fields.forEach((field, index) => {
            html += `
                <div class="format-item" data-index="${index}">
                    <div class="format-item-info">
                        <div class="format-item-nama">
                            ${escapeHtml(field.nama)}
                            ${field.required ? '<span class="format-item-required">Wajib</span>' : ''}
                        </div>
                        <div class="format-item-meta">
                            Tipe: ${field.tipe} ${field.placeholder ? `• Placeholder: ${escapeHtml(field.placeholder)}` : ''}
                        </div>
                    </div>
                    <div class="format-item-actions">
                        <button class="stok-item-btn delete" onclick="window.produk.deleteField(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.formatList.innerHTML = html;
    }

    function addField(field) {
        formData.fields.push(field);
        renderFieldsList();
        showToast('✅ Field ditambahkan', 'success');
    }

    function deleteField(index) {
        formData.fields.splice(index, 1);
        renderFieldsList();
        showToast('✅ Field dihapus', 'success');
    }

    // ==================== VALIDATION ====================
    function validateStep1() {
        if (!formData.layanan) {
            showToast('Nama layanan wajib diisi', 'warning');
            if (elements.layananInput) elements.layananInput.focus();
            return false;
        }
        return true;
    }

    function validateStep2() {
        if (!formData.aplikasi) {
            showToast('Nama aplikasi wajib diisi', 'warning');
            if (elements.aplikasiInput) elements.aplikasiInput.focus();
            return false;
        }
        return true;
    }

    function validateStep3() {
        if (!formData.item.nama) {
            showToast('Nama item wajib diisi', 'warning');
            if (elements.itemNamaInput) elements.itemNamaInput.focus();
            return false;
        }
        
        if (!formData.item.harga || formData.item.harga <= 0) {
            showToast('Harga wajib diisi dan lebih dari 0', 'warning');
            if (elements.itemHargaInput) elements.itemHargaInput.focus();
            return false;
        }
        
        if (formData.method === 'directly' && formData.stok.length === 0) {
            if (!confirm('Stok kosong. Lanjutkan menyimpan produk?')) {
                return false;
            }
        }
        
        if (formData.method === 'request' && formData.fields.length === 0) {
            if (!confirm('Tidak ada field permintaan. Customer tidak bisa checkout. Lanjutkan?')) {
                return false;
            }
        }
        
        return true;
    }

    // ==================== SAVE PRODUCT ====================
    async function saveProduct() {
        if (!validateStep3()) return;
        
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const productData = {
            layanan: formData.layanan,
            layananGambar: formData.layananGambar,
            layananDesc: formData.layananDesc,
            aplikasi: formData.aplikasi,
            aplikasiGambar: formData.aplikasiGambar,
            aplikasiDesc: formData.aplikasiDesc,
            itemNama: formData.item.nama,
            itemDurasi: formData.item.durasi,
            nama: `${formData.aplikasi} - ${formData.item.nama}`,
            harga: parseInt(formData.item.harga) || 0,
            fitur: formData.item.fitur,
            method: formData.method,
            stok: formData.method === 'directly' ? formData.stok : [],
            fields: formData.method === 'request' ? formData.fields : [],
            aktif: formData.aktif,
            terjual: 0
        };
        
        showLoading(editingProductId ? 'Memperbarui produk...' : 'Menyimpan produk...');
        
        if (elements.saveProductBtn) {
            elements.saveProductBtn.disabled = true;
            elements.saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        }
        
        try {
            const result = await saveProductToAPI(currentWebsite.id, productData);
            
            if (result.success) {
                showToast(
                    editingProductId ? '✅ Produk berhasil diperbarui!' : '✅ Produk berhasil ditambahkan!',
                    'success'
                );
                closeModal();
                await loadProducts();
            } else {
                throw new Error(result.error || 'Gagal menyimpan produk');
            }
        } catch (error) {
            console.error('❌ Error saving product:', error);
            showToast(error.message || 'Gagal menyimpan produk', 'error');
        } finally {
            hideLoading();
            if (elements.saveProductBtn) {
                elements.saveProductBtn.disabled = false;
                elements.saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Produk';
            }
        }
    }

    // ==================== DELETE PRODUCT ====================
    async function deleteProduct(id) {
        if (!currentWebsite) return;
        
        const product = products.find(p => p.id === id);
        if (!product) return;
        
        if (elements.deleteInfo) {
            elements.deleteInfo.innerHTML = `
                <strong>${escapeHtml(product.itemNama || product.nama)}</strong><br>
                <small>${escapeHtml(product.aplikasi || '')} · ${escapeHtml(product.layanan || '')}</small>
            `;
        }
        
        elements.deleteModal.classList.add('active');
        window._deletingProductId = id;
    }

    async function confirmDelete() {
        const id = window._deletingProductId;
        if (!id || !currentWebsite) return;
        
        showLoading('Menghapus produk...');
        
        try {
            const result = await deleteProductFromAPI(currentWebsite.id, id);
            
            if (result.success) {
                showToast('✅ Produk berhasil dihapus!', 'success');
                elements.deleteModal.classList.remove('active');
                await loadProducts();
            } else {
                throw new Error(result.error || 'Gagal menghapus produk');
            }
        } catch (error) {
            console.error('❌ Error deleting product:', error);
            showToast(error.message || 'Gagal menghapus produk', 'error');
        } finally {
            hideLoading();
            window._deletingProductId = null;
        }
    }

    // ==================== MODAL CONTROLS ====================
    function openModal() {
        resetForm();
        elements.productModal.classList.add('active');
        if (elements.modalTitle) elements.modalTitle.textContent = 'Tambah Produk';
        vibrate(10);
        
        setTimeout(() => {
            if (elements.layananInput) elements.layananInput.focus();
        }, 300);
    }

    function closeModal() {
        elements.productModal.classList.remove('active');
        resetForm();
    }

    // ==================== LOAD DATA ====================
    async function loadProducts() {
        if (!currentWebsite) return;
        
        products = await fetchProducts(currentWebsite.id);
        filteredProducts = [...products];
        updateStats();
        applyFilter();
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing Produk Manager...');
        
        showLoading('Memuat data...');
        
        try {
            // Get user from Telegram or localStorage
            let telegramUser = null;
            
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                
                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    telegramUser = tg.initDataUnsafe.user;
                }
            }
            
            // Fallback for testing
            if (!telegramUser) {
                telegramUser = {
                    id: 7998861975,
                    first_name: 'Test',
                    username: 'test_user'
                };
            }
            
            currentUser = telegramUser;
            
            // Fetch website
            currentWebsite = await fetchWebsite(telegramUser.id);
            
            if (!currentWebsite) {
                showToast('Website tidak ditemukan. Pastikan Anda sudah membuat website.', 'error');
                hideLoading();
                return;
            }
            
            // Update badge
            if (elements.websiteBadge) {
                elements.websiteBadge.textContent = '/' + currentWebsite.endpoint;
            }
            
            // Load products
            await loadProducts();
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
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
        
        // Stepper navigation
        if (elements.nextToStep2) {
            elements.nextToStep2.addEventListener('click', () => {
                formData.layanan = elements.layananInput?.value || '';
                formData.layananGambar = elements.layananGambarInput?.value || '';
                formData.layananDesc = elements.layananDescInput?.value || '';
                
                if (validateStep1()) {
                    goToStep(2);
                }
            });
        }
        
        if (elements.prevToStep1) {
            elements.prevToStep1.addEventListener('click', () => goToStep(1));
        }
        
        if (elements.nextToStep3) {
            elements.nextToStep3.addEventListener('click', () => {
                formData.aplikasi = elements.aplikasiInput?.value || '';
                formData.aplikasiGambar = elements.aplikasiGambarInput?.value || '';
                formData.aplikasiDesc = elements.aplikasiDescInput?.value || '';
                
                if (validateStep2()) {
                    goToStep(3);
                }
            });
        }
        
        if (elements.prevToStep2) {
            elements.prevToStep2.addEventListener('click', () => goToStep(2));
        }
        
        // Method selection
        elements.methodCards.forEach(card => {
            card.addEventListener('click', () => {
                const method = card.dataset.method;
                updateMethodUI(method);
            });
        });
        
        // Stok modal
        if (elements.addStokBtn) {
            elements.addStokBtn.addEventListener('click', () => {
                if (elements.stokDataInput) elements.stokDataInput.value = '';
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
                const data = elements.stokDataInput?.value || '';
                if (data.trim()) {
                    addStok(data);
                    elements.stokModal.classList.remove('active');
                } else {
                    showToast('Data stok tidak boleh kosong', 'warning');
                }
            });
        }
        
        // Field modal
        if (elements.addFieldBtn) {
            elements.addFieldBtn.addEventListener('click', () => {
                if (elements.fieldNamaInput) elements.fieldNamaInput.value = '';
                if (elements.fieldTipeInput) elements.fieldTipeInput.value = 'text';
                if (elements.fieldPlaceholderInput) elements.fieldPlaceholderInput.value = '';
                if (elements.fieldRequiredInput) elements.fieldRequiredInput.checked = true;
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
                const nama = elements.fieldNamaInput?.value.trim();
                if (!nama) {
                    showToast('Nama field wajib diisi', 'warning');
                    elements.fieldNamaInput?.focus();
                    return;
                }
                
                const field = {
                    nama: nama,
                    tipe: elements.fieldTipeInput?.value || 'text',
                    placeholder: elements.fieldPlaceholderInput?.value || '',
                    required: elements.fieldRequiredInput?.checked || false
                };
                
                addField(field);
                elements.fieldModal.classList.remove('active');
            });
        }
        
        // Edit stok modal
        if (elements.closeEditStokModal) {
            elements.closeEditStokModal.addEventListener('click', () => {
                elements.editStokModal.classList.remove('active');
            });
        }
        
        if (elements.cancelEditStokBtn) {
            elements.cancelEditStokBtn.addEventListener('click', () => {
                elements.editStokModal.classList.remove('active');
            });
        }
        
        if (elements.confirmEditStokBtn) {
            elements.confirmEditStokBtn.addEventListener('click', () => {
                const newValue = elements.editStokInput?.value || '';
                const index = window._editingStokIndex;
                
                if (index !== undefined && newValue) {
                    updateStok(index, newValue);
                }
                
                elements.editStokModal.classList.remove('active');
                window._editingStokIndex = undefined;
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
            elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
        
        // Filter
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                applyFilter();
            });
        }
        
        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                applyFilter();
                vibrate(10);
            });
        });
        
        // Save product
        if (elements.saveProductBtn) {
            elements.saveProductBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update formData from inputs
                formData.item = {
                    nama: elements.itemNamaInput?.value || '',
                    durasi: elements.itemDurasiInput?.value || '',
                    harga: parseInt(elements.itemHargaInput?.value) || 0,
                    fitur: elements.itemFiturInput?.value || 'biasa'
                };
                
                formData.aktif = elements.produkAktif?.checked || false;
                
                saveProduct();
            });
        }
        
        // Cancel step 1
        if (elements.cancelStep1Btn) {
            elements.cancelStep1Btn.addEventListener('click', closeModal);
        }
        
        // Image previews
        if (elements.layananGambarInput) {
            elements.layananGambarInput.addEventListener('input', () => {
                const url = elements.layananGambarInput.value;
                if (url && elements.layananPreview) {
                    const img = elements.layananPreview.querySelector('img');
                    if (img) {
                        img.src = url;
                        elements.layananPreview.style.display = 'block';
                    }
                }
            });
        }
        
        if (elements.aplikasiGambarInput) {
            elements.aplikasiGambarInput.addEventListener('input', () => {
                const url = elements.aplikasiGambarInput.value;
                if (url && elements.aplikasiPreview) {
                    const img = elements.aplikasiPreview.querySelector('img');
                    if (img) {
                        img.src = url;
                        elements.aplikasiPreview.style.display = 'block';
                    }
                }
            });
        }
        
        // Click outside modal to close
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
            if (e.target === elements.editStokModal) {
                elements.editStokModal.classList.remove('active');
            }
            if (e.target === elements.deleteModal) {
                elements.deleteModal.classList.remove('active');
            }
        });
        
        // Keyboard dismiss
        document.addEventListener('touchstart', (e) => {
            const activeElement = document.activeElement;
            if (!activeElement) return;
            
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT';
            
            if (!isInput && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                activeElement.blur();
            }
        });
    }

    // ==================== TOGGLE FUNCTIONS ====================
    window.toggleLayanan = function(element) {
        const header = element.closest('.layanan-header');
        const content = header?.nextElementSibling;
        const toggle = header?.querySelector('.layanan-toggle i');
        
        if (content) {
            content.classList.toggle('open');
        }
        if (toggle) {
            toggle.style.transform = content?.classList.contains('open') ? 'rotate(180deg)' : '';
        }
    };

    window.toggleAplikasi = function(element) {
        const header = element.closest('.aplikasi-header');
        const items = header?.nextElementSibling;
        const toggle = header?.querySelector('.aplikasi-toggle i');
        
        if (items) {
            items.classList.toggle('open');
        }
        if (toggle) {
            toggle.style.transform = items?.classList.contains('open') ? 'rotate(180deg)' : '';
        }
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
        deleteProduct: (id) => deleteProduct(id),
        kelolaStok: (id) => {
            const product = products.find(p => p.id === id);
            if (product && product.method === 'directly') {
                formData.stok = product.stok || [];
                renderStokList();
                
                // Buka modal stok
                if (elements.stokDataInput) elements.stokDataInput.value = '';
                elements.stokModal.classList.add('active');
                
                // Simpan ID untuk referensi
                window._kelolaStokProductId = id;
            }
        },
        addItem: (layanan, aplikasi) => {
            formData.layanan = layanan;
            formData.aplikasi = aplikasi;
            openModal();
        },
        addAplikasi: (layanan) => {
            formData.layanan = layanan;
            openModal();
            goToStep(2);
        },
        editStok: (index) => editStok(index),
        deleteStok: (index) => deleteStok(index),
        deleteField: (index) => deleteField(index)
    };

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupEventListeners();
            init();
        });
    } else {
        setupEventListeners();
        init();
    }
})();

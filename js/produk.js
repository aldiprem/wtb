// ============================================================
// produk.js - Manajemen Produk
// Menyesuaikan: API panel.js, format struktur app.py
// ============================================================
(function () {
    'use strict';
    console.log('📦 Produk Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';

    // ==================== STATE ====================
    let currentUser = null;
    let currentWebsite = null;
    let allProducts = [];
    let filteredProducts = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // Edit state
    let editingProductId = null;

    // Stok sementara (saat form terbuka)
    let tempStok = [];
    let tempKolom = [];

    // Kelola stok state
    let kelolaStokProductId = null;

    // Hapus state
    let hapusProductId = null;

    // ==================== UTILITY ====================
    function showToast(msg, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(text = 'Memuat...') {
        const el = document.getElementById('loadingOverlay');
        const txt = document.getElementById('loadingText');
        if (el) el.style.display = 'flex';
        if (txt) txt.textContent = text;
    }

    function hideLoading() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.style.display = 'none';
    }

    function formatRupiah(num) {
        if (!num) return 'Rp 0';
        return 'Rp ' + Number(num).toLocaleString('id-ID');
    }

    function escHtml(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = String(text);
        return d.innerHTML;
    }

    function vibrate(ms = 10) {
        if (navigator.vibrate) navigator.vibrate(ms);
    }

    // ==================== API ====================
    async function fetchWebsite(userId) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/websites/user/${userId}`, {
                headers: { 'Accept': 'application/json' }, mode: 'cors'
            });
            const data = await res.json();
            if (data.success && data.websites && data.websites.length > 0) {
                return data.websites[0];
            }
            return null;
        } catch (e) {
            console.error('❌ fetchWebsite:', e);
            return null;
        }
    }

    async function fetchProducts(websiteId) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/websites/${websiteId}/products`, {
                headers: { 'Accept': 'application/json' }, mode: 'cors'
            });
            const data = await res.json();
            return data.success ? (data.products || []) : [];
        } catch (e) {
            console.error('❌ fetchProducts:', e);
            return [];
        }
    }

    async function apiAddProduct(websiteId, productData) {
        const res = await fetch(`${API_BASE_URL}/api/websites/${websiteId}/products`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(productData)
        });
        return await res.json();
    }

    async function apiUpdateProduct(websiteId, productId, productData) {
        const res = await fetch(`${API_BASE_URL}/api/websites/${websiteId}/products/${productId}`, {
            method: 'PUT',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(productData)
        });
        return await res.json();
    }

    async function apiDeleteProduct(websiteId, productId) {
        const res = await fetch(`${API_BASE_URL}/api/websites/${websiteId}/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        });
        return await res.json();
    }

    // ==================== RENDER ====================
    function updateStats() {
        const total = allProducts.length;
        const aktif = allProducts.filter(p => p.active && (p.method === 'request' || (p.stock || 0) > 0)).length;
        const stokTipis = allProducts.filter(p => p.method === 'directly' && p.stock > 0 && p.stock <= 5).length;
        const terjual = allProducts.reduce((s, p) => s + (p.sold || 0), 0);

        const el = (id) => document.getElementById(id);
        if (el('statTotal')) el('statTotal').textContent = total;
        if (el('statAktif')) el('statAktif').textContent = aktif;
        if (el('statStokTipis')) el('statStokTipis').textContent = stokTipis;
        if (el('statTerjual')) el('statTerjual').textContent = terjual;
    }

    function applyFilter() {
        filteredProducts = allProducts.filter(p => {
            const matchFilter = currentFilter === 'all' || p.method === currentFilter;
            const matchSearch = !searchQuery ||
                (p.layanan || '').toLowerCase().includes(searchQuery) ||
                (p.aplikasi || '').toLowerCase().includes(searchQuery) ||
                (p.item || '').toLowerCase().includes(searchQuery) ||
                (p.name || '').toLowerCase().includes(searchQuery);
            return matchFilter && matchSearch;
        });
        renderProducts();
    }

    function renderProducts() {
        const container = document.getElementById('produkContainer');
        const emptyState = document.getElementById('emptyState');
        if (!container) return;

        if (filteredProducts.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        // Group by layanan -> aplikasi
        const grouped = {};
        filteredProducts.forEach(p => {
            const layanan = p.layanan || p.category || 'Lainnya';
            const aplikasi = p.aplikasi || 'Umum';
            if (!grouped[layanan]) grouped[layanan] = {};
            if (!grouped[layanan][aplikasi]) grouped[layanan][aplikasi] = [];
            grouped[layanan][aplikasi].push(p);
        });

        let html = '';
        for (const [layanan, apps] of Object.entries(grouped)) {
            const totalItems = Object.values(apps).reduce((s, arr) => s + arr.length, 0);
            html += `<div class="layanan-group">`;
            html += `<div class="layanan-group-header">
                <i class="fas fa-layer-group"></i>
                <h3>${escHtml(layanan)}</h3>
                <span class="layanan-count">${totalItems} item</span>
            </div>`;

            for (const [aplikasi, items] of Object.entries(apps)) {
                html += `<div class="aplikasi-group">
                    <div class="aplikasi-header">
                        <div class="app-placeholder-icon"><i class="fas fa-mobile-alt"></i></div>
                        <h4>${escHtml(aplikasi)}</h4>
                        <span class="aplikasi-item-count">${items.length} paket</span>
                    </div>`;

                items.forEach(p => {
                    const method = p.method || 'directly';
                    const stok = p.stock || (p.stok_data ? p.stok_data.length : 0);
                    const stokClass = stok === 0 ? 'habis' : stok <= 5 ? 'low' : '';
                    const stokText = method === 'request'
                        ? '<i class="fas fa-hand-paper"></i> Request'
                        : (stok === 0 ? '<i class="fas fa-times-circle"></i> Habis' : `<i class="fas fa-cubes"></i> ${stok} stok`);
                    const isInactive = !p.active;

                    html += `<div class="produk-card ${isInactive ? 'inactive' : ''}" data-id="${p.id}">
                        <div class="produk-card-inner">`;

                    if (p.image) {
                        html += `<img src="${escHtml(p.image)}" class="produk-img" alt="${escHtml(p.item || p.name)}" onerror="this.style.display='none'">`;
                    } else {
                        html += `<div class="produk-img-placeholder"><i class="fas fa-box"></i></div>`;
                    }

                    html += `<div class="produk-info">
                            <div class="produk-meta-top">
                                <span class="badge-method ${method}">${method === 'directly' ? 'Directly' : 'Request'}</span>
                                <span class="badge-status ${p.active ? 'aktif' : 'nonaktif'}">${p.active ? 'Aktif' : 'Nonaktif'}</span>
                                ${p.featured ? '<span class="badge-status unggulan"><i class="fas fa-star"></i> Unggulan</span>' : ''}
                            </div>
                            <div class="produk-nama">${escHtml(p.item || p.name)}</div>
                            <div class="produk-meta-bottom">
                                <span class="produk-harga">${formatRupiah(p.price)}</span>
                                <span class="produk-stok ${stokClass}">${stokText}</span>
                                <span class="produk-terjual"><i class="fas fa-shopping-cart"></i> ${p.sold || 0} terjual</span>
                            </div>
                        </div>
                        <div class="produk-actions">
                            <button class="btn-icon-action edit" onclick="produk.editProduct(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
                            ${method === 'directly' ? `<button class="btn-icon-action stok" onclick="produk.kelolaStok(${p.id})" title="Kelola Stok"><i class="fas fa-cubes"></i></button>` : ''}
                            <button class="btn-icon-action delete" onclick="produk.hapusProduct(${p.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
                });

                html += `</div>`;
            }
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    // ==================== MODAL PRODUK ====================
    function openModalProduk(product = null) {
        editingProductId = product ? product.id : null;
        tempStok = product && product.stok_data ? [...product.stok_data] : [];
        tempKolom = product && product.kolom_request ? [...product.kolom_request] : [];

        const title = document.getElementById('modalProdukTitle');
        if (title) title.textContent = product ? 'Edit Produk' : 'Tambah Produk';

        document.getElementById('inputLayanan').value = product ? (product.layanan || product.category || '') : '';
        document.getElementById('inputAplikasi').value = product ? (product.aplikasi || '') : '';
        document.getElementById('inputItem').value = product ? (product.item || product.name || '') : '';
        document.getElementById('inputDeskripsi').value = product ? (product.description || '') : '';
        document.getElementById('inputHarga').value = product ? (product.price || '') : '';
        document.getElementById('inputGambar').value = product ? (product.image || '') : '';
        document.getElementById('inputAktif').checked = product ? (product.active !== false) : true;
        document.getElementById('inputFeatured').checked = product ? (product.featured || false) : false;

        const method = product ? (product.method || 'directly') : 'directly';
        setMethod(method);

        renderTempStok();
        renderTempKolom();

        document.getElementById('modalProduk').classList.add('active');
        vibrate(10);
        setTimeout(() => {
            document.getElementById('inputLayanan').focus();
        }, 300);
    }

    function closeModalProduk() {
        document.getElementById('modalProduk').classList.remove('active');
        editingProductId = null;
        tempStok = [];
        tempKolom = [];
    }

    function setMethod(method) {
        document.getElementById('inputMethod').value = method;
        document.querySelectorAll('.method-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.method === method);
        });
        document.getElementById('panelDirectly').style.display = method === 'directly' ? 'block' : 'none';
        document.getElementById('panelRequest').style.display = method === 'request' ? 'block' : 'none';
    }

    // ==================== TEMP STOK ====================
    function renderTempStok() {
        const list = document.getElementById('stokList');
        const count = document.getElementById('jumlahStok');
        if (count) count.textContent = tempStok.length;
        if (!list) return;

        if (tempStok.length === 0) {
            list.innerHTML = '<div class="list-empty"><i class="fas fa-inbox"></i><p>Belum ada data stok.</p></div>';
            return;
        }

        list.innerHTML = tempStok.map((item, i) =>
            `<div class="stok-item">
                <span class="stok-item-data">${escHtml(item)}</span>
                <button class="stok-item-del" onclick="produk.removeTempStok(${i})"><i class="fas fa-times"></i></button>
            </div>`
        ).join('');
    }

    function renderTempKolom() {
        const list = document.getElementById('kolomList');
        if (!list) return;

        if (tempKolom.length === 0) {
            list.innerHTML = '<div class="list-empty"><i class="fas fa-file-alt"></i><p>Belum ada kolom permintaan.</p></div>';
            return;
        }

        list.innerHTML = tempKolom.map((k, i) =>
            `<div class="kolom-item">
                <div class="kolom-item-info">
                    <div class="kolom-item-name">${escHtml(k.nama)}</div>
                    <div class="kolom-item-meta">${k.tipe}${k.required ? ' • Wajib' : ''}</div>
                </div>
                <button class="kolom-item-del" onclick="produk.removeTempKolom(${i})"><i class="fas fa-times"></i></button>
            </div>`
        ).join('');
    }

    // ==================== MODAL STOK ====================
    function openModalStok() {
        document.getElementById('stokDataInput').value = '';
        document.getElementById('modalStok').classList.add('active');
        vibrate(10);
    }

    function closeModalStok() {
        document.getElementById('modalStok').classList.remove('active');
    }

    function konfirmasiTambahStok() {
        const raw = document.getElementById('stokDataInput').value.trim();
        if (!raw) {
            showToast('Data stok tidak boleh kosong', 'warning');
            return;
        }
        const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            showToast('Tidak ada data valid', 'warning');
            return;
        }
        tempStok = [...tempStok, ...lines];
        renderTempStok();
        closeModalStok();
        showToast(`✅ ${lines.length} data stok ditambahkan`, 'success');
    }

    // ==================== MODAL KOLOM ====================
    function openModalKolom() {
        document.getElementById('kolomNama').value = '';
        document.getElementById('kolomPlaceholder').value = '';
        document.getElementById('kolomTipe').value = 'text';
        document.getElementById('kolomRequired').checked = true;
        document.getElementById('kolomOpsi').value = '';
        document.getElementById('kolomOpsiGroup').style.display = 'none';
        document.getElementById('modalKolom').classList.add('active');
        vibrate(10);
    }

    function closeModalKolom() {
        document.getElementById('modalKolom').classList.remove('active');
    }

    function simpanKolom() {
        const nama = document.getElementById('kolomNama').value.trim();
        if (!nama) {
            showToast('Nama kolom tidak boleh kosong', 'warning');
            document.getElementById('kolomNama').focus();
            return;
        }
        const kolom = {
            nama,
            placeholder: document.getElementById('kolomPlaceholder').value.trim(),
            tipe: document.getElementById('kolomTipe').value,
            required: document.getElementById('kolomRequired').checked,
            opsi: document.getElementById('kolomTipe').value === 'select'
                ? document.getElementById('kolomOpsi').value.split(',').map(s => s.trim()).filter(s => s)
                : []
        };
        tempKolom.push(kolom);
        renderTempKolom();
        closeModalKolom();
        showToast('✅ Kolom ditambahkan', 'success');
    }

    // ==================== SIMPAN PRODUK ====================
    async function simpanProduk(e) {
        e.preventDefault();

        const layanan = document.getElementById('inputLayanan').value.trim();
        const aplikasi = document.getElementById('inputAplikasi').value.trim();
        const item = document.getElementById('inputItem').value.trim();
        const harga = parseInt(document.getElementById('inputHarga').value) || 0;
        const method = document.getElementById('inputMethod').value;

        if (!layanan || !aplikasi || !item) {
            showToast('Layanan, Aplikasi, dan Item wajib diisi', 'warning');
            return;
        }
        if (harga <= 0) {
            showToast('Harga harus lebih dari 0', 'warning');
            return;
        }

        if (!currentWebsite) {
            showToast('Website belum dimuat', 'error');
            return;
        }

        const productData = {
            layanan,
            aplikasi,
            item,
            name: `${aplikasi} - ${item}`,
            description: document.getElementById('inputDeskripsi').value.trim(),
            price: harga,
            image: document.getElementById('inputGambar').value.trim(),
            method,
            active: document.getElementById('inputAktif').checked,
            featured: document.getElementById('inputFeatured').checked,
            stok_data: method === 'directly' ? tempStok : [],
            stock: method === 'directly' ? tempStok.length : 0,
            kolom_request: method === 'request' ? tempKolom : [],
            category: layanan
        };

        const btn = document.getElementById('saveProdukBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; }

        showLoading(editingProductId ? 'Memperbarui produk...' : 'Menyimpan produk...');

        try {
            let result;
            if (editingProductId) {
                result = await apiUpdateProduct(currentWebsite.id, editingProductId, productData);
            } else {
                result = await apiAddProduct(currentWebsite.id, productData);
            }

            if (result.success) {
                showToast(editingProductId ? '✅ Produk berhasil diperbarui!' : '✅ Produk berhasil ditambahkan!', 'success');
                closeModalProduk();
                await reloadProducts();
            } else {
                throw new Error(result.error || 'Gagal menyimpan produk');
            }
        } catch (err) {
            console.error('❌ simpanProduk:', err);
            showToast(err.message || 'Gagal menyimpan produk', 'error');
        } finally {
            hideLoading();
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Produk'; }
        }
    }

    // ==================== HAPUS PRODUK ====================
    function openModalHapus(productId) {
        hapusProductId = productId;
        const p = allProducts.find(pr => pr.id === productId);
        const info = document.getElementById('hapusInfo');
        if (info && p) {
            info.innerHTML = `
                <strong>${escHtml(p.item || p.name)}</strong><br>
                <small style="color:var(--tg-hint-color)">${escHtml(p.aplikasi || '')} · ${escHtml(p.layanan || p.category || '')}</small>
            `;
        }
        document.getElementById('modalHapus').classList.add('active');
        vibrate(20);
    }

    function closeModalHapus() {
        document.getElementById('modalHapus').classList.remove('active');
        hapusProductId = null;
    }

    async function konfirmasiHapus() {
        if (!hapusProductId || !currentWebsite) return;

        showLoading('Menghapus produk...');
        try {
            const result = await apiDeleteProduct(currentWebsite.id, hapusProductId);
            if (result.success) {
                showToast('✅ Produk berhasil dihapus', 'success');
                closeModalHapus();
                await reloadProducts();
            } else {
                throw new Error(result.error || 'Gagal menghapus');
            }
        } catch (err) {
            console.error('❌ konfirmasiHapus:', err);
            showToast(err.message || 'Gagal menghapus produk', 'error');
        } finally {
            hideLoading();
        }
    }

    // ==================== KELOLA STOK (existing product) ====================
    function openKelolaStok(productId) {
        kelolaStokProductId = productId;
        const p = allProducts.find(pr => pr.id === productId);
        if (!p) return;

        document.getElementById('kelolaStokSubtitle').textContent = `${p.aplikasi || ''} · ${p.item || p.name || ''}`;
        renderKelolaStokList(p.stok_data || []);
        document.getElementById('modalKelolaStok').classList.add('active');
        vibrate(10);
    }

    function closeKelolaStok() {
        document.getElementById('modalKelolaStok').classList.remove('active');
        kelolaStokProductId = null;
    }

    function renderKelolaStokList(stokData) {
        const list = document.getElementById('kelolaStokList');
        const count = document.getElementById('kelolaStokCount');
        if (count) count.textContent = `${stokData.length} item stok`;

        if (!list) return;
        if (stokData.length === 0) {
            list.innerHTML = '<div class="list-empty"><i class="fas fa-inbox"></i><p>Belum ada stok.</p></div>';
            return;
        }

        list.innerHTML = stokData.map((item, i) =>
            `<div class="kelola-stok-item">
                <div class="kelola-stok-num">${i + 1}</div>
                <div class="kelola-stok-data">${escHtml(item)}</div>
                <button class="kelola-stok-del" onclick="produk.hapusItemStok(${i})"><i class="fas fa-trash"></i></button>
            </div>`
        ).join('');
    }

    async function hapusItemStok(index) {
        if (!kelolaStokProductId || !currentWebsite) return;

        const p = allProducts.find(pr => pr.id === kelolaStokProductId);
        if (!p) return;

        const stokData = [...(p.stok_data || [])];
        stokData.splice(index, 1);

        showLoading('Memperbarui stok...');
        try {
            const result = await apiUpdateProduct(currentWebsite.id, kelolaStokProductId, {
                stok_data: stokData,
                stock: stokData.length
            });
            if (result.success) {
                p.stok_data = stokData;
                p.stock = stokData.length;
                renderKelolaStokList(stokData);
                updateStats();
                renderProducts();
                showToast('✅ Item stok dihapus', 'success');
            } else {
                throw new Error(result.error || 'Gagal memperbarui stok');
            }
        } catch (err) {
            showToast(err.message || 'Gagal menghapus item stok', 'error');
        } finally {
            hideLoading();
        }
    }

    async function tambahStokKelola() {
        if (!kelolaStokProductId || !currentWebsite) return;

        const p = allProducts.find(pr => pr.id === kelolaStokProductId);
        if (!p) return;

        // Reuse stok modal
        const stokInput = document.getElementById('stokDataInput');
        if (stokInput) stokInput.value = '';
        document.getElementById('modalStok').classList.add('active');

        // Override konfirmasi temporarily to save to existing product
        window._kelolaStokMode = true;
    }

    // ==================== RELOAD ====================
    async function reloadProducts() {
        if (!currentWebsite) return;
        allProducts = await fetchProducts(currentWebsite.id);
        updateStats();
        applyFilter();
    }

    // ==================== INIT ====================
    async function init() {
        console.log('🚀 Initializing Produk Manager...');

        let telegramUser = null;

        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                telegramUser = tg.initDataUnsafe.user;
            }
        }

        // Fallback for browser testing
        if (!telegramUser) {
            telegramUser = { id: 7998861975, first_name: 'Test', username: 'test_user' };
        }

        currentUser = telegramUser;

        showLoading('Memuat data...');
        try {
            currentWebsite = await fetchWebsite(telegramUser.id);

            if (!currentWebsite) {
                showToast('Website tidak ditemukan. Pastikan Anda sudah membuat website.', 'error');
                hideLoading();
                return;
            }

            const badge = document.getElementById('websiteBadge');
            if (badge) badge.textContent = '/' + currentWebsite.endpoint;

            allProducts = await fetchProducts(currentWebsite.id);
            updateStats();
            applyFilter();

        } catch (err) {
            console.error('❌ init error:', err);
            showToast('Gagal memuat data: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEvents() {

        // Tambah Produk button
        const addBtn = document.getElementById('addProdukBtn');
        if (addBtn) addBtn.addEventListener('click', () => openModalProduk());

        const emptyAddBtn = document.getElementById('emptyAddBtn');
        if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => openModalProduk());

        // Close produk modal
        document.getElementById('closeProdukModal')?.addEventListener('click', closeModalProduk);
        document.getElementById('cancelProdukBtn')?.addEventListener('click', closeModalProduk);

        // Form submit
        document.getElementById('formProduk')?.addEventListener('submit', simpanProduk);

        // Method selection
        document.querySelectorAll('.method-option').forEach(el => {
            el.addEventListener('click', () => {
                setMethod(el.dataset.method);
                vibrate(10);
            });
        });

        // Stok modal
        document.getElementById('btnTambahStok')?.addEventListener('click', () => {
            window._kelolaStokMode = false;
            openModalStok();
        });
        document.getElementById('closeStokModal')?.addEventListener('click', closeModalStok);
        document.getElementById('cancelStokBtn')?.addEventListener('click', closeModalStok);
        document.getElementById('konfirmasiStokBtn')?.addEventListener('click', async () => {
            if (window._kelolaStokMode) {
                // Save to existing product
                const raw = document.getElementById('stokDataInput').value.trim();
                if (!raw) { showToast('Data kosong', 'warning'); return; }
                const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (!lines.length) { showToast('Data tidak valid', 'warning'); return; }

                const p = allProducts.find(pr => pr.id === kelolaStokProductId);
                if (!p || !currentWebsite) return;

                const newStok = [...(p.stok_data || []), ...lines];
                showLoading('Menyimpan stok...');
                try {
                    const result = await apiUpdateProduct(currentWebsite.id, kelolaStokProductId, {
                        stok_data: newStok, stock: newStok.length
                    });
                    if (result.success) {
                        p.stok_data = newStok;
                        p.stock = newStok.length;
                        renderKelolaStokList(newStok);
                        updateStats();
                        renderProducts();
                        closeModalStok();
                        showToast(`✅ ${lines.length} stok ditambahkan`, 'success');
                    } else {
                        throw new Error(result.error || 'Gagal menyimpan stok');
                    }
                } catch (err) {
                    showToast(err.message || 'Gagal menyimpan stok', 'error');
                } finally {
                    hideLoading();
                }
            } else {
                konfirmasiTambahStok();
            }
        });

        // Kolom modal
        document.getElementById('btnTambahKolom')?.addEventListener('click', openModalKolom);
        document.getElementById('closeKolomModal')?.addEventListener('click', closeModalKolom);
        document.getElementById('cancelKolomBtn')?.addEventListener('click', closeModalKolom);
        document.getElementById('simpanKolomBtn')?.addEventListener('click', simpanKolom);
        document.getElementById('kolomTipe')?.addEventListener('change', function () {
            const opsiGroup = document.getElementById('kolomOpsiGroup');
            if (opsiGroup) opsiGroup.style.display = this.value === 'select' ? 'block' : 'none';
        });

        // Hapus modal
        document.getElementById('closeHapusModal')?.addEventListener('click', closeModalHapus);
        document.getElementById('cancelHapusBtn')?.addEventListener('click', closeModalHapus);
        document.getElementById('konfirmasiHapusBtn')?.addEventListener('click', konfirmasiHapus);

        // Kelola stok modal
        document.getElementById('closeKelolaStokModal')?.addEventListener('click', closeKelolaStok);
        document.getElementById('btnTambahStokKelola')?.addEventListener('click', tambahStokKelola);

        // Search
        document.getElementById('searchInput')?.addEventListener('input', function () {
            searchQuery = this.value.trim().toLowerCase();
            applyFilter();
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                applyFilter();
                vibrate(10);
            });
        });

        // Backdrop close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        });
    }

    // ==================== GLOBAL EXPOSE ====================
    window.produk = {
        editProduct: (id) => {
            const p = allProducts.find(pr => pr.id === id);
            if (p) openModalProduk(p);
        },
        hapusProduct: (id) => openModalHapus(id),
        kelolaStok: (id) => openKelolaStok(id),
        removeTempStok: (i) => {
            tempStok.splice(i, 1);
            renderTempStok();
        },
        removeTempKolom: (i) => {
            tempKolom.splice(i, 1);
            renderTempKolom();
        },
        hapusItemStok: (i) => hapusItemStok(i)
    };

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { setupEvents(); init(); });
    } else {
        setupEvents();
        init();
    }

})();

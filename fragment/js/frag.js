// fragment/js/frag.js - JavaScript untuk Fragment Stars Bot

(function() {
    'use strict';
    
    console.log('🌟 Fragment Stars Bot - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    
    // State
    let currentUser = null;
    let config = {
        price_per_star: 0.01,
        min_stars: 10,
        max_stars: 100000
    };
    let recentPurchases = [];
    let isLoading = false;

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        userAvatar: document.getElementById('userAvatar'),
        refreshBtn: document.getElementById('refreshBtn'),
        pricePerStar: document.getElementById('pricePerStar'),
        totalPurchases: document.getElementById('totalPurchases'),
        totalStars: document.getElementById('totalStars'),
        totalVolume: document.getElementById('totalVolume'),
        fragmentApiStatus: document.getElementById('fragmentApiStatus'),
        walletStatus: document.getElementById('walletStatus'),
        walletBalance: document.getElementById('walletBalance'),
        recipientUsername: document.getElementById('recipientUsername'),
        starsAmount: document.getElementById('starsAmount'),
        totalPrice: document.getElementById('totalPrice'),
        submitPurchaseBtn: document.getElementById('submitPurchaseBtn'),
        checkUserBtn: document.getElementById('checkUserBtn'),
        clearFormBtn: document.getElementById('clearFormBtn'),
        refreshPurchasesBtn: document.getElementById('refreshPurchasesBtn'),
        purchasesList: document.getElementById('purchasesList'),
        confirmModal: document.getElementById('confirmModal'),
        resultModal: document.getElementById('resultModal')
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
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        isLoading = show;
    }

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatRupiah(angka) {
        return 'Rp ' + formatNumber(angka);
    }

    function formatTon(amount) {
        return amount.toFixed(4) + ' TON';
    }

    function cleanUsername(username) {
        return username.trim().replace('@', '');
    }

    async function fetchAPI(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/fragment${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showToast(error.message, 'error');
            throw error;
        }
    }

    // ==================== LOAD FUNCTIONS ====================
    async function loadConfig() {
        try {
            const response = await fetchAPI('/config');
            if (response.success) {
                config = response.config;
                if (elements.pricePerStar) {
                    elements.pricePerStar.textContent = formatTon(config.price_per_star);
                }
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    async function loadStats() {
        try {
            const response = await fetchAPI('/stats');
            if (response.success) {
                if (elements.totalPurchases) {
                    elements.totalPurchases.textContent = formatNumber(response.stats.total_purchases);
                }
                if (elements.totalStars) {
                    elements.totalStars.textContent = formatNumber(response.stats.total_stars);
                }
                if (elements.totalVolume) {
                    elements.totalVolume.textContent = formatTon(response.stats.total_volume);
                }
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async function loadStatus() {
        try {
            const response = await fetchAPI('/status');
            if (response.success) {
                if (elements.fragmentApiStatus) {
                    elements.fragmentApiStatus.textContent = response.status.fragment_ok ? '✅ Online' : '❌ Offline';
                    elements.fragmentApiStatus.className = `status-value ${response.status.fragment_ok ? 'online' : 'offline'}`;
                }
                if (elements.walletStatus) {
                    elements.walletStatus.textContent = response.status.wallet_ok ? '✅ Online' : '❌ Offline';
                    elements.walletStatus.className = `status-value ${response.status.wallet_ok ? 'online' : 'offline'}`;
                }
                if (elements.walletBalance) {
                    elements.walletBalance.textContent = formatTon(response.status.balance);
                }
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    async function loadRecentPurchases() {
        try {
            const response = await fetchAPI('/purchases/recent?limit=20');
            if (response.success) {
                recentPurchases = response.purchases;
                renderPurchasesList();
            }
        } catch (error) {
            console.error('Failed to load purchases:', error);
        }
    }

    function renderPurchasesList() {
        if (!elements.purchasesList) return;
        
        if (recentPurchases.length === 0) {
            elements.purchasesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Belum ada pembelian</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        recentPurchases.forEach(purchase => {
            const statusClass = `status-${purchase.status}`;
            const statusText = purchase.status === 'success' ? 'Berhasil' : 
                              purchase.status === 'pending' ? 'Diproses' : 'Gagal';
            
            html += `
                <div class="purchase-item">
                    <div class="purchase-info">
                        <div class="purchase-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="purchase-details">
                            <h4>@${escapeHtml(purchase.recipient_username)}</h4>
                            <div class="purchase-meta">
                                <span><i class="fas fa-star"></i> ${formatNumber(purchase.stars_amount)} stars</span>
                                <span><i class="fas fa-clock"></i> ${formatDate(purchase.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="purchase-status ${statusClass}">${statusText}</span>
                        <div class="purchase-amount">${formatTon(purchase.price_ton)}</div>
                    </div>
                </div>
            `;
        });
        
        elements.purchasesList.innerHTML = html;
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
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

    // ==================== PURCHASE FUNCTIONS ====================
    function calculatePrice() {
        const stars = parseInt(elements.starsAmount?.value) || 0;
        const price = stars * config.price_per_star;
        if (elements.totalPrice) {
            elements.totalPrice.textContent = formatTon(price);
        }
        return price;
    }

    async function checkUser() {
        const username = elements.recipientUsername?.value;
        if (!username) {
            showToast('Masukkan username terlebih dahulu', 'warning');
            return;
        }
        
        const cleanName = cleanUsername(username);
        showLoading(true);
        
        try {
            const response = await fetchAPI('/check-user', {
                method: 'POST',
                body: JSON.stringify({ username: cleanName })
            });
            
            if (response.success && response.user) {
                showToast(`✅ User ditemukan: ${response.user.nickname}`, 'success');
                if (elements.recipientUsername) {
                    elements.recipientUsername.value = cleanName;
                }
            } else {
                showToast(`❌ Username @${cleanName} tidak ditemukan`, 'error');
            }
        } catch (error) {
            console.error('Check user error:', error);
        } finally {
            showLoading(false);
        }
    }

    async function submitPurchase() {
        const username = elements.recipientUsername?.value;
        const stars = parseInt(elements.starsAmount?.value);
        const showSender = document.querySelector('input[name="showSender"]:checked')?.value === 'true';
        
        if (!username) {
            showToast('Masukkan username penerima', 'warning');
            return;
        }
        
        if (!stars || stars < config.min_stars || stars > config.max_stars) {
            showToast(`Jumlah stars harus antara ${config.min_stars} - ${config.max_stars}`, 'warning');
            return;
        }
        
        const price = calculatePrice();
        const cleanName = cleanUsername(username);
        
        // Show confirmation modal
        showConfirmationModal({
            username: cleanName,
            stars: stars,
            price: price,
            showSender: showSender
        });
    }

    function showConfirmationModal(data) {
        const modalBody = document.getElementById('confirmModalBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="confirmation-details">
                <div class="detail-row">
                    <span class="detail-label">Penerima:</span>
                    <span class="detail-value">@${escapeHtml(data.username)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Stars:</span>
                    <span class="detail-value">${formatNumber(data.stars)} stars</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Harga:</span>
                    <span class="detail-value price">${formatTon(data.price)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Opsi:</span>
                    <span class="detail-value">${data.showSender ? '👤 Tampilkan nama' : '🎁 Gift mode (anonim)'}</span>
                </div>
                <div class="warning-text">
                    <i class="fas fa-exclamation-triangle"></i>
                    Transaksi tidak dapat dibatalkan!
                </div>
            </div>
        `;
        
        if (elements.confirmModal) {
            elements.confirmModal.classList.add('active');
            
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            const cancelBtn = document.getElementById('cancelConfirmBtn');
            const closeBtn = elements.confirmModal.querySelector('.modal-close');
            
            const executePurchase = async () => {
                elements.confirmModal.classList.remove('active');
                await executePurchaseTransaction(data);
            };
            
            if (confirmBtn) confirmBtn.onclick = executePurchase;
            if (cancelBtn) cancelBtn.onclick = () => elements.confirmModal.classList.remove('active');
            if (closeBtn) closeBtn.onclick = () => elements.confirmModal.classList.remove('active');
        }
    }

    async function executePurchaseTransaction(data) {
        showLoading(true);
        
        try {
            const response = await fetchAPI('/buy', {
                method: 'POST',
                body: JSON.stringify({
                    username: data.username,
                    stars: data.stars,
                    show_sender: data.showSender
                })
            });
            
            if (response.success && response.transaction_hash) {
                showToast('✅ Pembelian berhasil!', 'success');
                showResultModal('success', {
                    title: 'Pembelian Berhasil!',
                    message: `
                        <div class="result-details">
                            <div class="detail-row">
                                <span class="detail-label">Penerima:</span>
                                <span class="detail-value">@${escapeHtml(data.username)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Stars:</span>
                                <span class="detail-value">${formatNumber(data.stars)} stars</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Hash:</span>
                                <span class="detail-value hash">${response.transaction_hash}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Explorer:</span>
                                <span class="detail-value">
                                    <a href="https://tonviewer.com/transaction/${response.transaction_hash}" target="_blank">
                                        Lihat di TON Viewer <i class="fas fa-external-link-alt"></i>
                                    </a>
                                </span>
                            </div>
                        </div>
                    `
                });
                
                // Refresh stats and purchases
                loadStats();
                loadRecentPurchases();
                loadStatus();
                
                // Clear form
                if (elements.recipientUsername) elements.recipientUsername.value = '';
                if (elements.starsAmount) elements.starsAmount.value = '';
                calculatePrice();
                
            } else {
                showToast(response.error || 'Pembelian gagal', 'error');
                showResultModal('error', {
                    title: 'Pembelian Gagal',
                    message: response.error || 'Terjadi kesalahan, silakan coba lagi nanti.'
                });
            }
        } catch (error) {
            console.error('Purchase error:', error);
            showToast(error.message, 'error');
            showResultModal('error', {
                title: 'Pembelian Gagal',
                message: error.message || 'Terjadi kesalahan, silakan coba lagi nanti.'
            });
        } finally {
            showLoading(false);
        }
    }

    function showResultModal(type, data) {
        const modal = elements.resultModal;
        const header = document.getElementById('resultModalHeader');
        const body = document.getElementById('resultModalBody');
        
        if (!modal || !header || !body) return;
        
        if (type === 'success') {
            header.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                <h3>${data.title}</h3>
                <button class="modal-close">&times;</button>
            `;
        } else {
            header.innerHTML = `
                <i class="fas fa-times-circle" style="color: var(--danger-color);"></i>
                <h3>${data.title}</h3>
                <button class="modal-close">&times;</button>
            `;
        }
        
        body.innerHTML = `<div class="result-content">${data.message}</div>`;
        modal.classList.add('active');
        
        const closeBtn = modal.querySelector('.modal-close');
        const closeResultBtn = document.getElementById('closeResultBtn');
        
        const closeModal = () => modal.classList.remove('active');
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeResultBtn) closeResultBtn.onclick = closeModal;
        
        // Auto close after 5 seconds for success
        if (type === 'success') {
            setTimeout(closeModal, 5000);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        if (elements.submitPurchaseBtn) {
            elements.submitPurchaseBtn.addEventListener('click', submitPurchase);
        }
        
        if (elements.checkUserBtn) {
            elements.checkUserBtn.addEventListener('click', checkUser);
        }
        
        if (elements.clearFormBtn) {
            elements.clearFormBtn.addEventListener('click', () => {
                if (elements.recipientUsername) elements.recipientUsername.value = '';
                if (elements.starsAmount) elements.starsAmount.value = '';
                calculatePrice();
                showToast('Form dibersihkan', 'info');
            });
        }
        
        if (elements.starsAmount) {
            elements.starsAmount.addEventListener('input', calculatePrice);
        }
        
        // Quantity buttons
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qty = parseInt(btn.dataset.qty);
                if (elements.starsAmount) {
                    elements.starsAmount.value = qty;
                    calculatePrice();
                }
            });
        });
        
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', async () => {
                showToast('Memuat ulang data...', 'info');
                await Promise.all([loadStats(), loadRecentPurchases(), loadStatus()]);
                showToast('Data berhasil dimuat ulang', 'success');
            });
        }
        
        if (elements.refreshPurchasesBtn) {
            elements.refreshPurchasesBtn.addEventListener('click', loadRecentPurchases);
        }
        
        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // ==================== LOAD USER DATA ====================
    async function loadUserData() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const user = window.Telegram.WebApp.initDataUnsafe.user;
            currentUser = user;
            
            if (elements.userAvatar) {
                elements.userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=${user.first_name}&size=40&background=40a7e3&color=fff`;
            }
            
            // Expand WebApp
            window.Telegram.WebApp.expand();
            window.Telegram.WebApp.ready();
        }
    }

    // ==================== INIT ====================
    async function init() {
        showLoading(true);
        
        try {
            await loadUserData();
            await Promise.all([
                loadConfig(),
                loadStats(),
                loadStatus(),
                loadRecentPurchases()
            ]);
            setupEventListeners();
            console.log('✅ Fragment Stars Bot initialized');
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    init();
})();
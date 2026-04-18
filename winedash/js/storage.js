// winedash/js/storage.js - Storage Page

(function() {
    'use strict';
    
    console.log('📦 Winedash Storage - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let walletAddress = null;
    
    // State
    let allUsernames = [];
    let currentMode = 'onchain';
    let currentStatus = 'all';
    let currentSort = 'price_asc';
    let currentLayout = 'grid';
    let currentSearchTerm = '';
    
    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        usernameContainer: document.getElementById('usernameContainer'),
        searchInput: document.getElementById('searchStorage'),
        searchApplyBtn: document.getElementById('searchApplyBtn'),
        backButton: document.getElementById('backButton'),
        addUsernameBtn: document.getElementById('addUsernameBtn'),
        addModal: document.getElementById('addModal'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        confirmAddBtn: document.getElementById('confirmAddBtn'),
        modalUsername: document.getElementById('modalUsername'),
        modalPrice: document.getElementById('modalPrice'),
        modalCategory: document.getElementById('modalCategory'),
        sortBtn: document.getElementById('sortBtn'),
        sortDropdown: document.getElementById('sortDropdown'),
        sortSelect: document.getElementById('sortSelect'),
        gridLayoutBtn: document.getElementById('gridLayoutBtn'),
        listLayoutBtn: document.getElementById('listLayoutBtn'),
        toggleListedBtn: document.getElementById('toggleListedBtn'),
        toggleListedBtnListed: document.getElementById('toggleListedBtnListed'),
        toggleListedBtnUnlisted: document.getElementById('toggleListedBtnUnlisted'),
        modeBtns: document.querySelectorAll('.mode-btn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        return parseFloat(num).toFixed(2);
    }

    // ==================== TELEGRAM USER ====================
    
    function getTelegramUserFromWebApp() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    return {
                        id: initData.user.id,
                        username: initData.user.username || '',
                        first_name: initData.user.first_name || '',
                        last_name: initData.user.last_name || '',
                        photo_url: initData.user.photo_url || null
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    async function authenticateUser() {
        if (!telegramUser) return null;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(telegramUser)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Error authenticating user:', error);
            return null;
        }
    }

    // ==================== CRUD OPERATIONS ====================
    
    async function loadUsernames() {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=100`);
            const data = await response.json();
            
            if (data.success && data.usernames.length > 0) {
                allUsernames = data.usernames;
                filterAndRender();
            } else {
                allUsernames = [];
                renderUsernames([]);
            }
        } catch (error) {
            console.error('Error loading usernames:', error);
            if (elements.usernameContainer) {
                elements.usernameContainer.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
            }
        } finally {
            showLoading(false);
        }
    }
    
    async function addUsername(username, price, category) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    price: price,
                    seller_id: telegramUser.id,
                    seller_wallet: walletAddress || '',
                    category: category
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Username berhasil ditambahkan!', 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal menambahkan username', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error adding username:', error);
            showToast('Error adding username', 'error');
            return false;
        }
    }
    
    async function deleteUsername(usernameId) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        try {
            // Note: You need to implement delete endpoint in backend
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Username berhasil dihapus!', 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal menghapus username', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error deleting username:', error);
            showToast('Error deleting username', 'error');
            return false;
        }
    }
    
    async function toggleListStatus(usernameId, currentStatus) {
        if (!telegramUser) return false;
        
        const newStatus = currentStatus === 'available' ? 'unlisted' : 'available';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    status: newStatus,
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Username ${newStatus === 'available' ? 'listed' : 'unlisted'}!`, 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal mengubah status', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            showToast('Error toggling status', 'error');
            return false;
        }
    }
    
    // ==================== FILTERING & SORTING ====================
    
    function filterAndRender() {
        let filtered = [...allUsernames];
        
        // Filter by search term
        if (currentSearchTerm) {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(username => 
                username.username.toLowerCase().includes(term) ||
                username.category.toLowerCase().includes(term)
            );
        }
        
        // Filter by status (only for user's own usernames - for demo, using seller_id)
        if (currentStatus !== 'all') {
            filtered = filtered.filter(username => {
                const isListed = username.status === 'available';
                return currentStatus === 'listed' ? isListed : !isListed;
            });
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'price_asc':
                    return a.price - b.price;
                case 'price_desc':
                    return b.price - a.price;
                case 'name_asc':
                    return a.username.localeCompare(b.username);
                case 'name_desc':
                    return b.username.localeCompare(a.username);
                case 'date_desc':
                    return new Date(b.created_at) - new Date(a.created_at);
                default:
                    return a.price - b.price;
            }
        });
        
        renderUsernames(filtered);
    }
    
    function renderUsernames(usernames) {
        if (!elements.usernameContainer) return;
        
        if (usernames.length === 0) {
            elements.usernameContainer.innerHTML = '<div class="loading-placeholder">Belum ada username</div>';
            return;
        }
        
        if (currentLayout === 'grid') {
            elements.usernameContainer.className = 'username-grid';
            let html = '';
            for (const username of usernames) {
                const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
                const statusClass = username.status === 'available' ? 'listed' : 'unlisted';
                html += `
                    <div class="username-card" data-id="${username.id}">
                        <div class="card-icon">
                            <i class="fas fa-tag"></i>
                        </div>
                        <div class="card-name">${escapeHtml(username.username)}</div>
                        <div class="card-category">${escapeHtml(username.category)}</div>
                        <div class="card-price">${formatNumber(username.price)} TON</div>
                        <div class="card-status ${statusClass}">${statusText}</div>
                        <div class="card-actions">
                            <button class="card-action-btn toggle-status-btn" data-id="${username.id}" data-status="${username.status}">
                                <i class="fas fa-${username.status === 'available' ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button class="card-action-btn delete-btn" data-id="${username.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            elements.usernameContainer.innerHTML = html;
        } else {
            elements.usernameContainer.className = 'username-list';
            let html = '';
            for (const username of usernames) {
                const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
                const statusClass = username.status === 'available' ? 'listed' : 'unlisted';
                html += `
                    <div class="username-item" data-id="${username.id}">
                        <div class="username-icon">
                            <i class="fas fa-tag"></i>
                        </div>
                        <div class="username-info">
                            <div class="username-name">${escapeHtml(username.username)}</div>
                            <div class="username-category">${escapeHtml(username.category)}</div>
                        </div>
                        <div class="username-price">${formatNumber(username.price)} TON</div>
                        <div class="username-status ${statusClass}">${statusText}</div>
                        <div class="list-actions">
                            <button class="list-action-btn toggle-status-btn" data-id="${username.id}" data-status="${username.status}">
                                <i class="fas fa-${username.status === 'available' ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button class="list-action-btn list-delete-btn delete-btn" data-id="${username.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            elements.usernameContainer.innerHTML = html;
        }
        
        // Attach event listeners to buttons
        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const status = btn.dataset.status;
                toggleListStatus(id, status);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Yakin ingin menghapus username ini?')) {
                    deleteUsername(id);
                }
            });
        });
    }
    
    // ==================== EVENT HANDLERS ====================
    
    function setupEventListeners() {
        // Back button
        if (elements.backButton) {
            elements.backButton.addEventListener('click', () => {
                window.location.href = '/winedash';
            });
        }
        
        // Search
        if (elements.searchApplyBtn) {
            elements.searchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = elements.searchInput?.value || '';
                filterAndRender();
                hapticLight();
            });
        }
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = elements.searchInput.value;
                    filterAndRender();
                    hapticLight();
                }
            });
        }
        
        // Mode toggle
        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                loadUsernames();
                hapticLight();
            });
        });
        
        // Status filters
        if (elements.toggleListedBtn) {
            elements.toggleListedBtn.addEventListener('click', () => {
                currentStatus = 'all';
                updateStatusButtons('all');
                filterAndRender();
                hapticLight();
            });
        }
        
        if (elements.toggleListedBtnListed) {
            elements.toggleListedBtnListed.addEventListener('click', () => {
                currentStatus = 'listed';
                updateStatusButtons('listed');
                filterAndRender();
                hapticLight();
            });
        }
        
        if (elements.toggleListedBtnUnlisted) {
            elements.toggleListedBtnUnlisted.addEventListener('click', () => {
                currentStatus = 'unlisted';
                updateStatusButtons('unlisted');
                filterAndRender();
                hapticLight();
            });
        }
        
        // Sort
        if (elements.sortBtn) {
            elements.sortBtn.addEventListener('click', () => {
                if (elements.sortDropdown.style.display === 'none') {
                    elements.sortDropdown.style.display = 'block';
                } else {
                    elements.sortDropdown.style.display = 'none';
                }
                hapticLight();
            });
        }
        
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', () => {
                currentSort = elements.sortSelect.value;
                filterAndRender();
                elements.sortDropdown.style.display = 'none';
                hapticLight();
            });
        }
        
        // Layout toggle
        if (elements.gridLayoutBtn) {
            elements.gridLayoutBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                elements.gridLayoutBtn.classList.add('active');
                elements.listLayoutBtn.classList.remove('active');
                filterAndRender();
                hapticLight();
            });
        }
        
        if (elements.listLayoutBtn) {
            elements.listLayoutBtn.addEventListener('click', () => {
                currentLayout = 'list';
                elements.listLayoutBtn.classList.add('active');
                elements.gridLayoutBtn.classList.remove('active');
                filterAndRender();
                hapticLight();
            });
        }
        
        // Add modal
        if (elements.addUsernameBtn) {
            elements.addUsernameBtn.addEventListener('click', () => {
                elements.addModal.style.display = 'flex';
                hapticLight();
            });
        }
        
        if (elements.cancelModalBtn) {
            elements.cancelModalBtn.addEventListener('click', () => {
                elements.addModal.style.display = 'none';
                clearModal();
            });
        }
        
        if (elements.confirmAddBtn) {
            elements.confirmAddBtn.addEventListener('click', async () => {
                const username = elements.modalUsername?.value.trim();
                const price = parseFloat(elements.modalPrice?.value);
                const category = elements.modalCategory?.value;
                
                if (!username) {
                    showToast('Masukkan username', 'warning');
                    return;
                }
                
                if (!price || price <= 0) {
                    showToast('Masukkan harga yang valid', 'warning');
                    return;
                }
                
                await addUsername(username, price, category);
                elements.addModal.style.display = 'none';
                clearModal();
                hapticSuccess();
            });
        }
        
        // Close modal on overlay click
        if (elements.addModal) {
            elements.addModal.addEventListener('click', (e) => {
                if (e.target === elements.addModal) {
                    elements.addModal.style.display = 'none';
                    clearModal();
                }
            });
        }
    }
    
    function updateStatusButtons(activeStatus) {
        const btns = [elements.toggleListedBtn, elements.toggleListedBtnListed, elements.toggleListedBtnUnlisted];
        const statuses = ['all', 'listed', 'unlisted'];
        
        btns.forEach((btn, index) => {
            if (btn) {
                if (statuses[index] === activeStatus) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
    
    function clearModal() {
        if (elements.modalUsername) elements.modalUsername.value = '';
        if (elements.modalPrice) elements.modalPrice.value = '';
        if (elements.modalCategory) elements.modalCategory.value = 'default';
    }
    
    // ==================== INITIALIZATION ====================
    
    function initTelegram() {
        const tg = getTelegramWebApp();
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0f0f0f');
            tg.setBackgroundColor('#0f0f0f');
            console.log('✅ Telegram WebApp initialized');
        }
    }
    
    async function init() {
        initTelegram();
        showLoading(true);
        
        setupEventListeners();
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            await authenticateUser();
            await loadUsernames();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        showLoading(false);
        console.log('✅ Winedash Storage initialized');
    }
    
    init();
})();
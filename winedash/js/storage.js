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
        
        // Filter by search term - gunakan currentSearchTerm dari state
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(username => 
                username.username.toLowerCase().includes(term) ||
                username.category.toLowerCase().includes(term)
            );
        }
        
        // Filter by status
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
        // Action Row Buttons
        const addActionBtn = document.getElementById('addUsernameActionBtn');
        if (addActionBtn) {
            addActionBtn.addEventListener('click', () => {
                elements.addModal.style.display = 'flex';
                hapticLight();
            });
        }

        const sendBtn = document.getElementById('sendUsernameBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                showToast('Send username feature coming soon', 'info');
                hapticLight();
            });
        }

        const withdrawBtnAction = document.getElementById('withdrawUsernameBtn');
        if (withdrawBtnAction) {
            withdrawBtnAction.addEventListener('click', () => {
                showToast('Withdraw username feature coming soon', 'info');
                hapticLight();
            });
        }

        const offerBtn = document.getElementById('offerUsernameBtn');
        if (offerBtn) {
            offerBtn.addEventListener('click', () => {
                showToast('Offer username feature coming soon', 'info');
                hapticLight();
            });
        }

        // Back to home button - sudah menggunakan icon store
        const backToHomeBtn = document.getElementById('backToHomeBtn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                window.location.href = '/winedash';
            });
        }

        // Search - dengan pengecekan
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

        // Navigation links - update urutan
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                const navType = link.dataset.nav;
                
                if (navType === 'store') {
                    loadUsernames();
                } else if (navType === 'offers') {
                    showToast('Offers feature coming soon', 'info');
                } else if (navType === 'activity') {
                    showToast('Activity feature coming soon', 'info');
                }
                hapticLight();
            });
        });
        
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

    // Balance Card Functions
    async function loadStorageBalance() {
        if (!telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success) {
                const balanceCard = document.getElementById('storageBalanceCard');
                if (balanceCard && data.user) {
                    const formattedBalance = parseFloat(data.user.balance).toFixed(2);
                    balanceCard.innerHTML = `
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                        <span class="balance-amount">${formattedBalance}</span>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    }

    function setupToggleButtons() {
        const toggleBtn = document.getElementById('toggleStatusBtn');
        
        if (toggleBtn) {
            // Set initial state
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i><span>All</span>';
            
            toggleBtn.addEventListener('click', () => {
                if (currentStatus === 'all') {
                    currentStatus = 'listed';
                    toggleBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Listed</span>';
                    toggleBtn.classList.add('toggle-active');
                    toggleBtn.classList.remove('toggle-active-unlisted');
                } else if (currentStatus === 'listed') {
                    currentStatus = 'unlisted';
                    toggleBtn.innerHTML = '<i class="fas fa-times-circle"></i><span>Unlisted</span>';
                    toggleBtn.classList.remove('toggle-active');
                    toggleBtn.classList.add('toggle-active-unlisted');
                } else {
                    currentStatus = 'all';
                    toggleBtn.innerHTML = '<i class="fas fa-eye"></i><span>All</span>';
                    toggleBtn.classList.remove('toggle-active', 'toggle-active-unlisted');
                }
                filterAndRender();
                hapticLight();
            });
        }
    }

    function setupSearch() {
        const searchInput = document.getElementById('searchStorage');
        const searchApplyBtn = document.getElementById('searchApplyBtn');
        
        if (searchApplyBtn) {
            searchApplyBtn.addEventListener('click', () => {
                const searchTerm = searchInput?.value || '';
                currentSearchTerm = searchTerm;
                filterAndRender();
                hapticLight();
            });
        }
        
        // Enter key juga bisa search
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    currentSearchTerm = searchInput.value;
                    filterAndRender();
                    hapticLight();
                }
            });
        }
    }

    function clearModal() {
        if (elements.modalUsername) elements.modalUsername.value = '';
        if (elements.modalPrice) elements.modalPrice.value = '';
        if (elements.modalCategory) elements.modalCategory.value = 'default';
    }

    function updateStorageUserUI() {
        if (!telegramUser) return;
        
        const avatarContainer = document.getElementById('storageUserAvatar');
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
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
        setupToggleButtons();
        setupSearch();  // Pastikan fungsi ini sudah didefinisikan
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            updateStorageUserUI();
            await authenticateUser();
            await loadStorageBalance();
            await loadUsernames();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        showLoading(false);
        console.log('✅ Winedash Storage initialized');
    }
    init();
})();
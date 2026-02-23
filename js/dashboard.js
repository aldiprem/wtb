// Dashboard JavaScript for Owner - VERSI LENGKAP DENGAN KEYBOARD HANDLER
(function() {
    console.log('👑 Owner Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const OWNER_IDS = [7998861975, 7349865750];
    const API_BASE_URL = 'https://intimate-benefit-editions-girls.trycloudflare.com';

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        errorMessage: document.getElementById('errorMessage'),
        dashboardContent: document.getElementById('dashboardContent'),
        ownerPhoto: document.getElementById('ownerPhoto'),
        ownerName: document.getElementById('ownerName'),
        ownerUsername: document.getElementById('ownerUsername'),
        ownerId: document.getElementById('ownerId'),
        totalWebsites: document.getElementById('totalWebsites'),
        activeWebsites: document.getElementById('activeWebsites'),
        inactiveWebsites: document.getElementById('inactiveWebsites'),
        totalBots: document.getElementById('totalBots'),
        websitesTableBody: document.getElementById('websitesTableBody'),
        noDataMessage: document.getElementById('noDataMessage'),
        createWebsiteBtn: document.getElementById('createWebsiteBtn'),
        refreshDataBtn: document.getElementById('refreshDataBtn'),
        searchWebsite: document.getElementById('searchWebsite'),
        createModal: document.getElementById('createModal'),
        deleteModal: document.getElementById('deleteModal'),
        editModal: document.getElementById('editModal'),
        closeEditModalBtn: document.getElementById('closeEditModalBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        editWebsiteForm: document.getElementById('editWebsiteForm'),
        editEndpoint: document.getElementById('editEndpoint'),
        editBotToken: document.getElementById('editBotToken'),
        editOwnerId: document.getElementById('editOwnerId'),
        editUsername: document.getElementById('editUsername'),
        editPassword: document.getElementById('editPassword'),
        editEmail: document.getElementById('editEmail'),
        editTunnelUrl: document.getElementById('editTunnelUrl'),
        editStatus: document.getElementById('editStatus'),
        editActivePeriod: document.getElementById('editActivePeriod'),
        editStartDate: document.getElementById('editStartDate'),
        editEndDate: document.getElementById('editEndDate'),
        currentEndDate: document.getElementById('currentEndDate'),
        createWebsiteForm: document.getElementById('createWebsiteForm'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        deleteWebsiteInfo: document.getElementById('deleteWebsiteInfo'),
        endpointInput: document.getElementById('endpoint'),
        botTokenInput: document.getElementById('botToken'),
        ownerIdInput: document.getElementById('ownerId'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        emailInput: document.getElementById('email')
    };

    // ==================== STATE ====================
    let currentUser = null;
    let websites = [];
    let websiteToDelete = null;
    let websiteToEdit = null;

    // ==================== FUNGSI VIBRATE ====================
    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    // ==================== FUNGSI TOAST ====================
    function showToast(message, type = 'info', duration = 3000) {
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideUp 0.3s ease;
            pointer-events: auto;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        `;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                toast.remove();
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, duration);
    }

    // ==================== FUNGSI KEYBOARD HANDLER ====================
    function setupKeyboardHandler() {
        console.log('⌨️ Setting up keyboard handler...');
        
        function scrollToInput(input) {
            const rect = input.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight * 0.4;
            
            if (rect.bottom > windowHeight - keyboardHeight) {
                const scrollY = window.scrollY + rect.bottom - (windowHeight - keyboardHeight) + 20;
                window.scrollTo({ top: scrollY, behavior: 'smooth' });
            }
        }
        
        const modalInputs = document.querySelectorAll('.modal input, .modal textarea, .modal select');
        
        modalInputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    scrollToInput(input);
                    
                    const modal = input.closest('.modal');
                    if (modal) {
                        modal.classList.add('modal-with-input');
                        const modalContent = modal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.maxHeight = '70vh';
                            modalContent.style.overflowY = 'auto';
                        }
                    }
                }, 300);
            });
            
            input.addEventListener('blur', () => {
                const modal = input.closest('.modal');
                if (modal) {
                    modal.classList.remove('modal-with-input');
                }
            });
        });
        
        document.addEventListener('touchstart', (e) => {
            const activeElement = document.activeElement;
            if (!activeElement) return;
            
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT' ||
                           e.target.closest('.modal-content');
            
            if (!isInput && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                activeElement.blur();
            }
        });
        
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', () => {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                    activeElement.blur();
                }
            });
        });
        
        let viewportHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            const newHeight = window.innerHeight;
            
            if (newHeight < viewportHeight * 0.7) {
                document.body.classList.add('keyboard-visible');
            } else if (newHeight > viewportHeight * 0.8) {
                document.body.classList.remove('keyboard-visible');
            }
            
            viewportHeight = newHeight;
        });
    }

    // ==================== FUNGSI CEK OWNER ====================
    function isOwner(userId) {
        return OWNER_IDS.includes(Number(userId));
    }

    // ==================== FUNGSI APPLY TELEGRAM THEME ====================
    function applyTelegramTheme(tg) {
        if (!tg || !tg.themeParams) return;
        
        try {
            const theme = tg.themeParams;
            console.log('🎨 Applying Telegram theme');
            
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
            }
            if (theme.hint_color) {
                document.documentElement.style.setProperty('--tg-hint-color', theme.hint_color);
            }
            if (theme.link_color) {
                document.documentElement.style.setProperty('--tg-link-color', theme.link_color);
            }
            if (theme.button_color) {
                document.documentElement.style.setProperty('--tg-button-color', theme.button_color);
            }
            if (theme.button_text_color) {
                document.documentElement.style.setProperty('--tg-button-text-color', theme.button_text_color);
            }
        } catch (themeError) {
            console.warn('⚠️ Error applying Telegram theme:', themeError);
        }
    }

    // ==================== FUNGSI GENERATE AVATAR ====================
    function generateAvatarUrl(name) {
        if (!name) return 'https://ui-avatars.com/api/?name=O&size=120&background=FFD700&color=000';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0).toUpperCase())}&size=120&background=FFD700&color=000`;
    }

    // ==================== FUNGSI FORMAT DATE ====================
    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }

    // ==================== FUNGSI ESCAPE HTML ====================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== FUNGSI API ====================
    async function fetchWebsites() {
        try {
            console.log('📡 Fetching websites...');
            const response = await fetch(`${API_BASE_URL}/api/websites`);
            const data = await response.json();
            
            if (data.success) {
                websites = data.websites;
                renderWebsitesTable();
                updateStats();
                console.log('✅ Websites loaded:', websites.length);
            }
        } catch (error) {
            console.error('❌ Error fetching:', error);
            showToast('Failed to fetch websites', 'error');
        }
    }

    async function createWebsite(formData) {
        try {
            showToast('Creating website...', 'info');
            console.log('📤 Sending to server:', formData);
            
            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('📥 Server response:', data);

            if (data.success) {
                showToast('✅ Website created successfully!', 'success');
                closeModal();
                fetchWebsites();
            } else {
                showToast('❌ Error: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            showToast('❌ Failed to create website', 'error');
        }
    }

    async function deleteWebsite(id) {
        try {
            showToast('Deleting website...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/websites/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('✅ Website deleted successfully!', 'success');
                closeDeleteModal();
                fetchWebsites();
            } else {
                throw new Error(data.error || 'Failed to delete website');
            }
        } catch (error) {
            console.error('❌ Error deleting website:', error);
            showToast(error.message || 'Failed to delete website', 'error');
        }
    }

    async function updateWebsite(formData) {
        try {
            showToast('Updating website...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/websites/${formData.id}`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('✅ Website updated successfully!', 'success');
                closeEditModal();
                fetchWebsites();
            } else {
                throw new Error(data.error || 'Failed to update website');
            }
        } catch (error) {
            console.error('❌ Error updating website:', error);
            showToast(error.message || 'Failed to update website', 'error');
        }
    }

    // ==================== FUNGSI RENDER ====================
    function renderWebsitesTable(filterText = '') {
        const tbody = document.getElementById('websitesTableBody');
        if (!tbody) return;

        const filter = filterText.toLowerCase();
        const filteredWebsites = websites.filter(w => 
            w.endpoint.toLowerCase().includes(filter) ||
            w.username.toLowerCase().includes(filter) ||
            w.email.toLowerCase().includes(filter)
        );

        if (filteredWebsites.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No websites found</td></tr>';
            document.getElementById('noDataMessage').style.display = 'flex';
            return;
        }

        document.getElementById('noDataMessage').style.display = 'none';

        let html = '';
        filteredWebsites.forEach(website => {
            const status = website.status === 'active' ? 
                '<span class="status-badge status-active"><i class="fas fa-circle"></i> Active</span>' : 
                '<span class="status-badge status-inactive"><i class="fas fa-circle"></i> Inactive</span>';
            
            const botTokenShort = website.bot_token ? 
                website.bot_token.substring(0, 15) + '...' : '-';
            
            html += `
                <tr>
                    <td>${status}</td>
                    <td><strong>/${escapeHtml(website.endpoint)}</strong></td>
                    <td><code>${escapeHtml(botTokenShort)}</code></td>
                    <td>${escapeHtml(website.owner_id)}</td>
                    <td>${escapeHtml(website.username)}</td>
                    <td>${escapeHtml(website.email)}</td>
                    <td>
                        <a href="${escapeHtml(website.tunnel_url || '#')}" target="_blank" class="tunnel-link">
                            <i class="fas fa-external-link-alt"></i> Tunnel
                        </a>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="table-btn edit-btn" onclick="window.dashboard.editWebsite(${website.id})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="table-btn delete-btn" onclick="window.dashboard.deleteWebsite(${website.id})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function updateStats() {
        const total = websites.length;
        const active = websites.filter(w => w.status === 'active').length;
        const inactive = websites.filter(w => w.status !== 'active').length;
        const uniqueBots = new Set(websites.map(w => w.bot_token)).size;

        document.getElementById('totalWebsites').textContent = total;
        document.getElementById('activeWebsites').textContent = active;
        document.getElementById('inactiveWebsites').textContent = inactive;
        document.getElementById('totalBots').textContent = uniqueBots;
    }

    // ==================== FUNGSI MODAL ====================
    function showModal() {
        console.log('🔓 Opening modal');
        document.getElementById('createModal').classList.add('active');
        vibrate(10);
        setTimeout(() => setupKeyboardHandler(), 100);
    }

    function closeModal() {
        console.log('🔒 Closing modal');
        document.getElementById('createModal').classList.remove('active');
        document.getElementById('createWebsiteForm').reset();
    }

    function showDeleteModal(website) {
        websiteToDelete = website;
        document.getElementById('deleteWebsiteInfo').innerHTML = `
            <strong>${escapeHtml(website.endpoint)}</strong><br>
            <small>ID: ${website.id}</small>
        `;
        document.getElementById('deleteModal').classList.add('active');
        vibrate(10);
    }

    function closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        websiteToDelete = null;
    }

    function showEditModal(website) {
        websiteToEdit = website;
        
        document.getElementById('editEndpoint').value = website.endpoint || '';
        document.getElementById('editBotToken').value = website.bot_token || '';
        document.getElementById('editOwnerId').value = website.owner_id || '';
        document.getElementById('editUsername').value = website.username || '';
        document.getElementById('editEmail').value = website.email || '';
        document.getElementById('editTunnelUrl').value = website.tunnel_url || '';
        document.getElementById('editStatus').value = website.status || 'active';
        document.getElementById('editPassword').value = '';
        
        const today = new Date().toISOString().split('T')[0];
        
        if (website.created_at) {
            const startDate = new Date(website.created_at);
            document.getElementById('editStartDate').value = startDate.toISOString().split('T')[0];
        } else {
            document.getElementById('editStartDate').value = today;
        }
        
        if (website.end_date) {
            const endDate = new Date(website.end_date);
            document.getElementById('editEndDate').value = endDate.toISOString().split('T')[0];
            document.getElementById('currentEndDate').textContent = formatDate(website.end_date);
        } else {
            const defaultEnd = new Date();
            defaultEnd.setDate(defaultEnd.getDate() + 30);
            document.getElementById('editEndDate').value = defaultEnd.toISOString().split('T')[0];
            document.getElementById('currentEndDate').textContent = 'Tidak terbatas';
        }
        
        document.getElementById('editModal').classList.add('active');
        vibrate(10);
        setTimeout(() => setupKeyboardHandler(), 100);
    }

    function closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        websiteToEdit = null;
    }

    function calculateEndDate(startDate, days) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + parseInt(days));
        return date.toISOString().split('T')[0];
    }

    // ==================== HANDLE CREATE SUBMIT ====================
    async function handleCreateSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🎯 Create form submitted!');

        const formData = {
            endpoint: document.getElementById('endpoint').value.trim(),
            bot_token: document.getElementById('botToken').value.trim(),
            owner_id: parseInt(document.getElementById('ownerId').value.trim()),
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value,
            email: document.getElementById('email').value.trim().toLowerCase(),
            status: 'active'
        };

        console.log('📦 Form data:', formData);

        // Validasi
        if (!formData.endpoint) {
            showToast('❌ Endpoint cannot be empty', 'error');
            return;
        }
        if (!formData.bot_token) {
            showToast('❌ Bot Token cannot be empty', 'error');
            return;
        }
        if (!formData.bot_token.includes(':')) {
            showToast('❌ Invalid bot token format (must contain :)', 'error');
            return;
        }
        if (isNaN(formData.owner_id)) {
            showToast('❌ Owner ID must be a number', 'error');
            return;
        }
        if (!formData.username) {
            showToast('❌ Username cannot be empty', 'error');
            return;
        }
        if (!formData.password) {
            showToast('❌ Password cannot be empty', 'error');
            return;
        }
        if (!formData.email || !formData.email.includes('@')) {
            showToast('❌ Invalid email', 'error');
            return;
        }

        // Disable submit button
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        }

        await createWebsite(formData);

        // Enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Website';
        }
    }

    // ==================== HANDLE EDIT SUBMIT ====================
    async function handleEditSubmit(event) {
        event.preventDefault();
        
        if (!websiteToEdit) return;
        
        const formData = {
            id: websiteToEdit.id,
            bot_token: document.getElementById('editBotToken').value.trim(),
            owner_id: parseInt(document.getElementById('editOwnerId').value),
            username: document.getElementById('editUsername').value.trim(),
            email: document.getElementById('editEmail').value.trim().toLowerCase(),
            tunnel_url: document.getElementById('editTunnelUrl').value.trim(),
            status: document.getElementById('editStatus').value,
            end_date: document.getElementById('editEndDate').value,
            start_date: document.getElementById('editStartDate').value
        };
        
        const password = document.getElementById('editPassword').value;
        if (password) {
            formData.password = password;
        }
        
        await updateWebsite(formData);
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Create button
        if (elements.createWebsiteBtn) {
            elements.createWebsiteBtn.onclick = function() {
                console.log('👆 Create button clicked');
                showModal();
            };
        }

        // Close buttons
        if (elements.closeModalBtn) elements.closeModalBtn.onclick = closeModal;
        if (elements.cancelModalBtn) elements.cancelModalBtn.onclick = closeModal;

        // Delete modal close buttons
        if (elements.closeDeleteModalBtn) elements.closeDeleteModalBtn.onclick = closeDeleteModal;
        if (elements.cancelDeleteBtn) elements.cancelDeleteBtn.onclick = closeDeleteModal;

        // Edit modal close buttons
        if (elements.closeEditModalBtn) elements.closeEditModalBtn.onclick = closeEditModal;
        if (elements.cancelEditBtn) elements.cancelEditBtn.onclick = closeEditModal;

        // Refresh button
        if (elements.refreshDataBtn) {
            elements.refreshDataBtn.onclick = function() {
                vibrate(10);
                fetchWebsites();
                showToast('🔄 Data refreshed', 'success');
            };
        }

        // Search input
        if (elements.searchWebsite) {
            elements.searchWebsite.oninput = function(e) {
                renderWebsitesTable(e.target.value);
            };
        }

        // Create form submit
        if (elements.createWebsiteForm) {
            elements.createWebsiteForm.onsubmit = handleCreateSubmit;
            console.log('✅ Create form handler attached');
        }

        // Edit form submit
        if (elements.editWebsiteForm) {
            elements.editWebsiteForm.onsubmit = handleEditSubmit;
        }

        // Confirm delete button
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.onclick = async function() {
                if (websiteToDelete) {
                    await deleteWebsite(websiteToDelete.id);
                }
            };
        }

        // Active period change
        if (elements.editActivePeriod) {
            elements.editActivePeriod.onchange = function() {
                const period = elements.editActivePeriod.value;
                const dateRange = document.getElementById('dateRange');
                
                if (dateRange) {
                    if (period === 'custom') {
                        dateRange.style.display = 'block';
                    } else {
                        dateRange.style.display = 'none';
                        
                        const startDate = elements.editStartDate.value || new Date().toISOString().split('T')[0];
                        const endDate = calculateEndDate(startDate, period);
                        if (elements.editEndDate) {
                            elements.editEndDate.value = endDate;
                        }
                    }
                }
            };
        }

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === elements.createModal) closeModal();
            if (e.target === elements.deleteModal) closeDeleteModal();
            if (e.target === elements.editModal) closeEditModal();
        });
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing dashboard...');

        try {
            // Cek environment Telegram
            let telegramUserData = null;
            let tg = null;
            
            if (window.Telegram?.WebApp) {
                console.log('📱 Running inside Telegram Web App');
                tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                
                if (tg.initDataUnsafe?.user) {
                    telegramUserData = tg.initDataUnsafe.user;
                }
                
                applyTelegramTheme(tg);
            }

            if (!telegramUserData) {
                // Untuk testing di browser
                telegramUserData = {
                    id: 7998861975,
                    first_name: 'Owner',
                    last_name: '',
                    username: 'ftamous'
                };
            }

            if (!isOwner(telegramUserData.id)) {
                showError('You are not authorized as owner', true);
                return;
            }

            // Update UI dengan data user
            const fullName = [telegramUserData.first_name, telegramUserData.last_name].filter(Boolean).join(' ') || 'Owner';
            const username = telegramUserData.username ? `@${telegramUserData.username}` : '(no username)';
            
            if (elements.ownerName) elements.ownerName.textContent = fullName;
            if (elements.ownerUsername) elements.ownerUsername.textContent = username;
            if (elements.ownerId) elements.ownerId.textContent = `ID: ${telegramUserData.id}`;
            
            if (elements.ownerPhoto) {
                elements.ownerPhoto.src = telegramUserData.photo_url || generateAvatarUrl(fullName);
            }

            // Sembunyikan loading, tampilkan content
            if (elements.loading) elements.loading.style.display = 'none';
            if (elements.error) elements.error.style.display = 'none';
            if (elements.dashboardContent) elements.dashboardContent.style.display = 'block';

            // Setup keyboard handler
            setupKeyboardHandler();

            // Setup event listeners
            setupEventListeners();

            // Fetch websites
            await fetchWebsites();

            console.log('✅ Dashboard initialized');
        } catch (error) {
            console.error('❌ Init error:', error);
            showError('Failed to initialize dashboard');
        }
    }

    function showError(message, isOwnerError = false) {
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.error) {
            elements.error.style.display = 'flex';
            if (elements.errorMessage) {
                if (isOwnerError) {
                    elements.errorMessage.innerHTML = `
                        <strong>❌ Access Denied</strong><br>
                        <small>Your ID is not authorized as owner</small>
                    `;
                } else {
                    elements.errorMessage.textContent = message;
                }
            }
        }
        if (elements.dashboardContent) {
            elements.dashboardContent.style.display = 'none';
        }
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.dashboard = {
        editWebsite: (id) => {
            const website = websites.find(w => w.id === id);
            if (website) {
                showEditModal(website);
            } else {
                showToast('Website not found', 'error');
            }
        },
        deleteWebsite: (id) => {
            const website = websites.find(w => w.id === id);
            if (website) {
                showDeleteModal(website);
            } else {
                showToast('Website not found', 'error');
            }
        }
    };

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

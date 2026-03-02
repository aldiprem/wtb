// Dashboard JavaScript for Owner
(function() {
    console.log('👑 Owner Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const OWNER_IDS = [7998861975, 7349865750]; // Tambahkan ID owner Anda di sini
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://desperate-journey-penny-expansion.trycloudflare.com';

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
        createWebsiteBtn: document.getElementById('createWebsiteBtn'), // SEKARANG INI ADALAH LINK
        refreshDataBtn: document.getElementById('refreshDataBtn'),
        searchWebsite: document.getElementById('searchWebsite'),
        // Create Modal - TETAP ADA TAPI TIDAK DIGUNAKAN (untuk menjaga struktur HTML)
        createModal: document.getElementById('createModal'),
        createWebsiteForm: document.getElementById('createWebsiteForm'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        endpointInput: document.getElementById('endpoint'),
        botTokenInput: document.getElementById('botToken'),
        ownerIdInput: document.getElementById('ownerId'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        emailInput: document.getElementById('email'),
        
        // Delete Modal - TETAP
        deleteModal: document.getElementById('deleteModal'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        deleteWebsiteInfo: document.getElementById('deleteWebsiteInfo'),
        
        // Edit Modal - TETAP
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
        currentEndDate: document.getElementById('currentEndDate')
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

    // ==================== FUNGSI TEST API CONNECTION ====================
    async function testApiConnection() {
        try {
            console.log('🔍 Testing API connection to:', API_BASE_URL);
            
            const response = await fetch(`${API_BASE_URL}/api/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Connected:', data);
                return true;
            } else {
                console.warn('⚠️ API health check failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ API connection failed:', error);
            return false;
        }
    }

    // ==================== FUNGSI FETCH WEBSITES ====================
    async function fetchWebsites() {
        try {
            console.log('📡 Fetching websites data from:', `${API_BASE_URL}/api/websites`);
            
            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            console.log('📥 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📥 Websites data:', data);
            
            if (data.success && data.websites) {
                websites = data.websites;
            } else {
                websites = [];
            }
            
            updateStats();
            renderWebsitesTable();
            
        } catch (error) {
            console.error('❌ Error fetching websites:', error);
            showToast('Failed to fetch websites data: ' + error.message, 'error');
            
            // Gunakan dummy data jika gagal
            websites = getDummyWebsites();
            updateStats();
            renderWebsitesTable();
        }
    }

    // ==================== FUNGSI DATA DUMMY UNTUK TESTING ====================
    function getDummyWebsites() {
        return [
            {
                id: 1,
                endpoint: 'giveaway-site',
                bot_token: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
                owner_id: 123456789,
                username: 'admin_giveaway',
                email: 'admin@giveaway.com',
                tunnel_url: API_BASE_URL,
                status: 'active',
                created_at: new Date().toISOString(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                endpoint: 'contest-bot',
                bot_token: '0987654321:ZYXwvutsrqponMLKJIHGFEDCBA',
                owner_id: 987654321,
                username: 'contest_admin',
                email: 'contest@bot.com',
                tunnel_url: API_BASE_URL,
                status: 'inactive',
                created_at: new Date().toISOString(),
                end_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // ==================== FUNGSI UPDATE STATS ====================
    function updateStats() {
        const total = websites.length;
        const active = websites.filter(w => w.status === 'active').length;
        const inactive = websites.filter(w => w.status === 'inactive' || !w.status).length;
        
        const uniqueTokens = new Set(websites.map(w => w.bot_token));
        const totalBots = uniqueTokens.size;
        
        if (elements.totalWebsites) elements.totalWebsites.textContent = total;
        if (elements.activeWebsites) elements.activeWebsites.textContent = active;
        if (elements.inactiveWebsites) elements.inactiveWebsites.textContent = inactive;
        if (elements.totalBots) elements.totalBots.textContent = totalBots;
    }

    // ==================== FUNGSI RENDER TABEL WEBSITES ====================
    function renderWebsitesTable(filterText = '') {
        if (!elements.websitesTableBody) return;
        
        const filter = filterText.toLowerCase();
        const filteredWebsites = websites.filter(w => 
            w.endpoint.toLowerCase().includes(filter) ||
            w.username.toLowerCase().includes(filter) ||
            w.email.toLowerCase().includes(filter) ||
            (w.bot_token && w.bot_token.includes(filter))
        );
        
        if (filteredWebsites.length === 0) {
            elements.websitesTableBody.innerHTML = '';
            if (elements.noDataMessage) {
                elements.noDataMessage.style.display = 'flex';
            }
            return;
        }
        
        if (elements.noDataMessage) {
            elements.noDataMessage.style.display = 'none';
        }
        
        let html = '';
        filteredWebsites.forEach(website => {
            const status = website.status === 'active' ? 
                '<span class="status-badge status-active"><i class="fas fa-circle"></i> Active</span>' : 
                '<span class="status-badge status-inactive"><i class="fas fa-circle"></i> Inactive</span>';
            
            const botTokenShort = website.bot_token ? 
                website.bot_token.substring(0, 15) + '...' : 
                '-';
            
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
                            <button class="table-btn test-btn" onclick="window.dashboard.testBot(${website.id})" title="Test Bot">
                                <i class="fas fa-robot"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        elements.websitesTableBody.innerHTML = html;
    }

    // ==================== FUNGSI CREATE WEBSITE (DIKOMENTARI AGAR TIDAK DIGUNAKAN) ====================
    /*
    async function createWebsite(formData) {
        try {
            showToast('Creating website...', 'info');
            console.log('📤 Sending data to server:', formData);
            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify(formData)
            });
            console.log('📥 Response status:', response.status);
            let data;
            const responseText = await response.text();
            console.log('📥 Raw response:', responseText);
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Failed to parse response:', e);
                throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
            }
            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }
            if (data.success) {
                showToast('Website created successfully!', 'success');
                closeModal();
                await fetchWebsites();
            } else {
                throw new Error(data.error || 'Failed to create website');
            }
        } catch (error) {
            console.error('❌ Error creating website:', error);
            showToast(error.message || 'Failed to create website', 'error');
        }
    }
    */

    // ==================== FUNGSI DELETE WEBSITE ====================
    async function deleteWebsite(id) {
        try {
            showToast('Deleting website...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/websites/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📥 Delete website response:', data);
            
            if (data.success) {
                showToast('Website deleted successfully!', 'success');
                closeDeleteModal();
                await fetchWebsites();
            } else {
                throw new Error(data.error || 'Failed to delete website');
            }
            
        } catch (error) {
            console.error('❌ Error deleting website:', error);
            showToast(error.message || 'Failed to delete website', 'error');
        }
    }

    // ==================== FUNGSI TEST BOT ====================
    async function testBot(id) {
        const website = websites.find(w => w.id === id);
        if (!website) return;
        
        showToast(`Testing bot for ${website.endpoint}...`, 'info');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/websites/${id}/test-bot`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({
                    bot_token: website.bot_token,
                    tunnel_url: website.tunnel_url
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                showToast('✅ Bot is working correctly!', 'success');
            } else {
                showToast('❌ Bot test failed: ' + (data.error || 'Unknown error'), 'error');
            }
            
        } catch (error) {
            console.error('❌ Error testing bot:', error);
            showToast('Failed to test bot: ' + error.message, 'error');
        }
    }

    // ==================== FUNGSI EDIT WEBSITE ====================
    function showEditModal(website) {
        if (!elements.editModal || !website) return;
        
        websiteToEdit = website;
        
        // Isi form dengan data website
        if (elements.editEndpoint) elements.editEndpoint.value = website.endpoint || '';
        if (elements.editBotToken) elements.editBotToken.value = website.bot_token || '';
        if (elements.editOwnerId) elements.editOwnerId.value = website.owner_id || '';
        if (elements.editUsername) elements.editUsername.value = website.username || '';
        if (elements.editEmail) elements.editEmail.value = website.email || '';
        if (elements.editTunnelUrl) elements.editTunnelUrl.value = website.tunnel_url || '';
        if (elements.editStatus) elements.editStatus.value = website.status || 'active';
        
        // Kosongkan password
        if (elements.editPassword) elements.editPassword.value = '';
        
        // Set tanggal aktif
        const today = new Date().toISOString().split('T')[0];
        
        if (elements.editStartDate) {
            if (website.created_at) {
                const startDate = new Date(website.created_at);
                elements.editStartDate.value = startDate.toISOString().split('T')[0];
            } else {
                elements.editStartDate.value = today;
            }
        }
        
        if (elements.editEndDate) {
            if (website.end_date) {
                const endDate = new Date(website.end_date);
                elements.editEndDate.value = endDate.toISOString().split('T')[0];
                if (elements.currentEndDate) {
                    elements.currentEndDate.textContent = formatDate(website.end_date);
                }
            } else {
                const defaultEnd = new Date();
                defaultEnd.setDate(defaultEnd.getDate() + 30);
                elements.editEndDate.value = defaultEnd.toISOString().split('T')[0];
                if (elements.currentEndDate) {
                    elements.currentEndDate.textContent = 'Tidak terbatas';
                }
            }
        }
        
        elements.editModal.classList.add('active');
        vibrate(10);
        
        // Setup keyboard handler untuk modal ini
        setTimeout(() => {
            setupKeyboardHandler();
        }, 100);
    }
    
    function closeEditModal() {
        if (elements.editModal) {
            elements.editModal.classList.remove('active');
            websiteToEdit = null;
        }
    }
    
    function calculateEndDate(startDate, days) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + parseInt(days));
        return date.toISOString().split('T')[0];
    }
    
    // Fungsi update website
    async function updateWebsite(formData) {
        try {
            showToast('Updating website...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/websites/${formData.id}`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Website updated successfully!', 'success');
                closeEditModal();
                await fetchWebsites();
            } else {
                throw new Error(data.error || 'Failed to update website');
            }
            
        } catch (error) {
            console.error('❌ Error updating website:', error);
            showToast(error.message || 'Failed to update website', 'error');
        }
    }

    // FUNGSI SHOW MODAL UNTUK CREATE - DIKOMENTARI
    /*
    function showModal() {
        if (elements.createModal) {
            elements.createModal.classList.add('active');
            vibrate(10);
            setTimeout(() => setupKeyboardHandler(), 100);
            console.log('🔓 Create modal opened');
        }
    }
    */
    
    // FUNGSI CLOSE MODAL UNTUK CREATE - DIKOMENTARI
    /*
    function closeModal() {
        if (elements.createModal) {
            elements.createModal.classList.remove('active');
            // Reset form
            if (elements.createWebsiteForm) {
                elements.createWebsiteForm.reset();
                console.log('📝 Create form reset');
            }
        }
    }
    */

    function showDeleteModal(website) {
        if (elements.deleteModal && website) {
            websiteToDelete = website;
            elements.deleteWebsiteInfo.innerHTML = `
                <strong>${escapeHtml(website.endpoint)}</strong><br>
                <small>ID: ${website.id}</small>
            `;
            elements.deleteModal.classList.add('active');
            vibrate(10);
        }
    }

    function closeDeleteModal() {
        if (elements.deleteModal) {
            elements.deleteModal.classList.remove('active');
            websiteToDelete = null;
        }
    }

    // ==================== FUNGSI UPDATE UI ====================
    function updateUI(user) {
        currentUser = user;
        
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Owner';
        const username = user.username ? `@${user.username}` : '(no username)';
        const userId = user.id || '-';
        
        if (elements.ownerName) elements.ownerName.textContent = fullName;
        if (elements.ownerUsername) elements.ownerUsername.textContent = username;
        if (elements.ownerId) elements.ownerId.textContent = `ID: ${userId}`;
        
        if (elements.ownerPhoto) {
            elements.ownerPhoto.src = user.photo_url || generateAvatarUrl(fullName);
        }
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.error) elements.error.style.display = 'none';
        if (elements.dashboardContent) elements.dashboardContent.style.display = 'block';
        
        fetchWebsites();
    }

    // ==================== FUNGSI SHOW ERROR ====================
    function showError(message, isOwnerError = false) {
        vibrate(30);
        
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

    // FUNGSI HANDLE CREATE SUBMIT - DIKOMENTARI
    /*
    async function handleCreateSubmit(e) {
        e.preventDefault();
        console.log('🎯 Create form submitted!');
        const endpoint = elements.endpointInput?.value.trim() || '';
        const botToken = elements.botTokenInput?.value.trim() || '';
        const ownerId = elements.ownerIdInput?.value.trim() || '';
        const username = elements.usernameInput?.value.trim() || '';
        const password = elements.passwordInput?.value || '';
        const email = elements.emailInput?.value.trim() || '';
        
        console.log('📝 Form values:', {
            endpoint,
            botToken: botToken ? `${botToken.substring(0, 10)}...` : '(empty)',
            ownerId,
            username,
            password: password ? '***' : '(empty)',
            email
        });
        
        // Validasi sederhana
        if (!endpoint || !botToken || !ownerId || !username || !password || !email) {
            showToast('Please fill all fields', 'error');
            return;
        }
        
        // Validasi endpoint
        const endpointRegex = /^[a-z0-9-]+$/;
        if (!endpointRegex.test(endpoint.toLowerCase())) {
            showToast('Endpoint can only contain lowercase letters, numbers, and hyphens', 'error');
            return;
        }
        
        // Validasi email
        if (!email.includes('@') || !email.includes('.')) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        
        // Validasi bot token
        if (!botToken.includes(':')) {
            showToast('Bot token format invalid (should contain :)', 'error');
            return;
        }
        
        // Konversi ownerId ke number
        const ownerIdNum = parseInt(ownerId);
        if (isNaN(ownerIdNum)) {
            showToast('Owner ID must be a number', 'error');
            return;
        }
        
        const formData = {
            endpoint: endpoint.toLowerCase(),
            bot_token: botToken,
            owner_id: ownerIdNum,
            username: username,
            password: password,
            email: email.toLowerCase(),
            status: 'active'
        };
        
        console.log('📦 FormData prepared:', formData);
        await createWebsite(formData);
    }
    */

    // ==================== FUNGSI INIT ====================
    async function init() {
        console.log('👑 Initializing Owner Dashboard...');
        
        try {
            // Test API connection
            const apiConnected = await testApiConnection();
            if (!apiConnected) {
                showToast('Warning: Cannot connect to server. Using dummy data.', 'warning');
            }

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
                    console.log('📱 Telegram user data:', telegramUserData);
                }
                
                applyTelegramTheme(tg);
            } else {
                console.log('🌐 Running in standalone web browser');
                
                // Untuk testing di browser
                telegramUserData = {
                    id: 7998861975,
                    first_name: 'Owner',
                    last_name: '',
                    username: 'owner',
                    language_code: 'id'
                };
            }
            
            if (!telegramUserData) {
                showError('No user data available');
                return;
            }
            
            if (!isOwner(telegramUserData.id)) {
                console.warn('⛔ Unauthorized access attempt:', telegramUserData.id);
                showError('You are not authorized as owner', true);
                return;
            }
            
            console.log('✅ Owner verified!');
            updateUI(telegramUserData);
            setupKeyboardHandler();
            
        } catch (error) {
            console.error('💥 Fatal error in init:', error);
            showError('Failed to initialize dashboard');
        }
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        // CREATE WEBSITE BUTTON - TIDAK PERLU EVENT LISTENER KARENA SUDAH MENGGUNAKAN LINK
        // if (elements.createWebsiteBtn) {
        //     elements.createWebsiteBtn.addEventListener('click', showModal);
        // }
        
        if (elements.refreshDataBtn) {
            elements.refreshDataBtn.addEventListener('click', () => {
                vibrate(10);
                fetchWebsites();
                showToast('Data refreshed', 'success');
            });
        }
        
        if (elements.searchWebsite) {
            elements.searchWebsite.addEventListener('input', (e) => {
                renderWebsitesTable(e.target.value);
            });
        }
        
        // CLOSE MODAL BUTTONS UNTUK CREATE - DIKOMENTARI
        // if (elements.closeModalBtn) {
        //     elements.closeModalBtn.addEventListener('click', closeModal);
        // }
        // if (elements.cancelModalBtn) {
        //     elements.cancelModalBtn.addEventListener('click', closeModal);
        // }
        
        if (elements.closeDeleteModalBtn) {
            elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
        }
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.closeEditModalBtn) {
            elements.closeEditModalBtn.addEventListener('click', closeEditModal);
        }
        if (elements.cancelEditBtn) {
            elements.cancelEditBtn.addEventListener('click', closeEditModal);
        }
        
        // CREATE FORM SUBMIT - DIKOMENTARI
        // if (elements.createWebsiteForm) {
        //     elements.createWebsiteForm.addEventListener('submit', handleCreateSubmit);
        //     console.log('✅ Event listener attached to create form');
        // } else {
        //     console.error('❌ Create website form not found!');
        // }
        
        // Confirm delete button
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', async () => {
                if (websiteToDelete) {
                    await deleteWebsite(websiteToDelete.id);
                }
            });
        }
        
        // Event listener untuk active period di edit modal
        if (elements.editActivePeriod) {
            elements.editActivePeriod.addEventListener('change', () => {
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
            });
        }
        
        // Edit form submit
        if (elements.editWebsiteForm) {
            elements.editWebsiteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!websiteToEdit) return;
                
                const formData = {
                    id: websiteToEdit.id,
                    bot_token: elements.editBotToken.value.trim(),
                    owner_id: parseInt(elements.editOwnerId.value),
                    username: elements.editUsername.value.trim(),
                    email: elements.editEmail.value.trim().toLowerCase(),
                    tunnel_url: elements.editTunnelUrl.value.trim(),
                    status: elements.editStatus.value,
                    end_date: elements.editEndDate.value,
                    start_date: elements.editStartDate.value
                };
                
                if (elements.editPassword && elements.editPassword.value) {
                    formData.password = elements.editPassword.value;
                }
                
                await updateWebsite(formData);
            });
        }
        
        // Close modals on outside click - TIDAK ADA REFERENSI KE createModal
        window.addEventListener('click', (e) => {
            if (e.target === elements.deleteModal) {
                closeDeleteModal();
            }
            if (e.target === elements.editModal) {
                closeEditModal();
            }
        });
    }

    // ==================== EXPOSE FUNCTIONS FOR GLOBAL ACCESS ====================
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
        },
        testBot: (id) => {
            testBot(id);
        }
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();
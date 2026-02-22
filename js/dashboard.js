// Dashboard JavaScript for Owner
(function() {
    console.log('👑 Owner Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const OWNER_IDS = [7998861975];
    const API_BASE_URL = 'https://climb-gzip-enquiry-other.trycloudflare.com';

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
        createWebsiteForm: document.getElementById('createWebsiteForm'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        deleteWebsiteInfo: document.getElementById('deleteWebsiteInfo')
    };

    // ==================== STATE ====================
    let currentUser = null;
    let websites = [];
    let websiteToDelete = null;

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

    // ==================== FUNGSI FETCH WEBSITES ====================
    async function fetchWebsites() {
        try {
            console.log('📡 Fetching websites data...');
            
            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Websites data:', data);

            if (data.success && data.websites) {
                websites = data.websites;
            } else if (Array.isArray(data)) {
                websites = data;
            } else {
                websites = [];
            }

            updateStats();
            renderWebsitesTable();
            
        } catch (error) {
            console.error('❌ Error fetching websites:', error);
            showToast('Failed to fetch websites data', 'error');
            
            // Gunakan data dummy untuk testing
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
                tunnel_url: 'https://giveaway.trycloudflare.com',
                status: 'active',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                endpoint: 'contest-bot',
                bot_token: '0987654321:ZYXwvutsrqponMLKJIHGFEDCBA',
                owner_id: 987654321,
                username: 'contest_admin',
                email: 'contest@bot.com',
                tunnel_url: 'https://contest.trycloudflare.com',
                status: 'inactive',
                created_at: new Date().toISOString()
            }
        ];
    }

    // ==================== FUNGSI UPDATE STATS ====================
    function updateStats() {
        const total = websites.length;
        const active = websites.filter(w => w.status === 'active').length;
        const inactive = websites.filter(w => w.status === 'inactive' || !w.status).length;
        
        // Hitung total bot unik berdasarkan token
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
            w.bot_token.includes(filter)
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
                        <a href="${escapeHtml(website.tunnel_url)}" target="_blank" class="tunnel-link">
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

    // ==================== FUNGSI CREATE WEBSITE ====================
    async function createWebsite(formData) {
        try {
            showToast('Creating website...', 'info');

            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Create website response:', data);

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
                throw new Error(`HTTP error! status: ${response.status}`);
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

    // ==================== FUNGSI SHOW MODAL ====================
    function showModal() {
        if (elements.createModal) {
            elements.createModal.classList.add('active');
            vibrate(10);
        }
    }

    function closeModal() {
        if (elements.createModal) {
            elements.createModal.classList.remove('active');
            elements.createWebsiteForm.reset();
        }
    }

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

        // Sembunyikan loading, tampilkan content
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.error) elements.error.style.display = 'none';
        if (elements.dashboardContent) elements.dashboardContent.style.display = 'block';

        // Fetch data websites
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

    // ==================== FUNGSI INIT ====================
    async function init() {
        console.log('👑 Initializing Owner Dashboard...');

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
                    console.log('📱 Telegram user data:', telegramUserData);
                }
                
                applyTelegramTheme(tg);
            } else {
                console.log('🌐 Running in standalone web browser');
                
                // Untuk testing di browser, gunakan data dummy
                telegramUserData = {
                    id: 123456789, // GANTI DENGAN ID ANDA UNTUK TESTING
                    first_name: 'Test',
                    last_name: 'Owner',
                    username: 'test_owner',
                    language_code: 'id'
                };
            }

            // Verifikasi owner
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

        } catch (error) {
            console.error('💥 Fatal error in init:', error);
            showError('Failed to initialize dashboard');
        }
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        // Create Website button
        if (elements.createWebsiteBtn) {
            elements.createWebsiteBtn.addEventListener('click', showModal);
        }

        // Refresh Data button
        if (elements.refreshDataBtn) {
            elements.refreshDataBtn.addEventListener('click', () => {
                vibrate(10);
                fetchWebsites();
                showToast('Data refreshed', 'success');
            });
        }

        // Search input
        if (elements.searchWebsite) {
            elements.searchWebsite.addEventListener('input', (e) => {
                renderWebsitesTable(e.target.value);
            });
        }

        // Modal close buttons
        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', closeModal);
        }
        if (elements.cancelModalBtn) {
            elements.cancelModalBtn.addEventListener('click', closeModal);
        }

        // Delete modal close buttons
        if (elements.closeDeleteModalBtn) {
            elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
        }
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }

        // Create Website form submit
        if (elements.createWebsiteForm) {
            elements.createWebsiteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    endpoint: document.getElementById('endpoint').value,
                    bot_token: document.getElementById('botToken').value,
                    owner_id: parseInt(document.getElementById('ownerId').value),
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value,
                    email: document.getElementById('email').value,
                    tunnel_url: document.getElementById('tunnelUrl').value,
                    status: 'active'
                };

                await createWebsite(formData);
            });
        }

        // Confirm delete button
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', async () => {
                if (websiteToDelete) {
                    await deleteWebsite(websiteToDelete.id);
                }
            });
        }

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === elements.createModal) {
                closeModal();
            }
            if (e.target === elements.deleteModal) {
                closeDeleteModal();
            }
        });
    }

    // ==================== EXPOSE FUNCTIONS FOR GLOBAL ACCESS ====================
    window.dashboard = {
        editWebsite: (id) => {
            console.log('Edit website:', id);
            showToast('Edit feature coming soon', 'info');
        },
        deleteWebsite: (id) => {
            const website = websites.find(w => w.id === id);
            if (website) {
                showDeleteModal(website);
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

// Dashboard JavaScript for Owner - VERSI FINAL (PASTI BEKERJA)
(function() {
    console.log('👑 Owner Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const OWNER_IDS = [7998861975, 7349865750];
    const API_BASE_URL = 'https://intimate-benefit-editions-girls.trycloudflare.com';

    // ==================== STATE ====================
    let websites = [];

    // ==================== FUNGSI UTILITY ====================
    function showToast(message, type = 'info') {
        // Gunakan alert untuk sementara sampai toast berfungsi
        alert(message);
    }

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
        }
    }

    async function createWebsite(formData) {
        try {
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
                showToast('✅ Website created successfully!');
                closeModal();
                fetchWebsites(); // Refresh daftar websites
            } else {
                showToast('❌ Error: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Error:', error);
            showToast('❌ Failed to create website');
        }
    }

    // ==================== FUNGSI RENDER ====================
    function renderWebsitesTable() {
        const tbody = document.getElementById('websitesTableBody');
        if (!tbody) return;

        if (websites.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No websites found</td></tr>';
            return;
        }

        let html = '';
        websites.forEach(website => {
            const statusClass = website.status === 'active' ? 'status-active' : 'status-inactive';
            
            html += `
                <tr>
                    <td><span class="status-badge ${statusClass}">${website.status}</span></td>
                    <td><strong>/${escapeHtml(website.endpoint)}</strong></td>
                    <td><code>${(website.bot_token || '').substring(0, 15)}...</code></td>
                    <td>${website.owner_id}</td>
                    <td>${escapeHtml(website.username)}</td>
                    <td>${escapeHtml(website.email)}</td>
                    <td>
                        <a href="${website.tunnel_url || '#'}" target="_blank" class="tunnel-link">
                            <i class="fas fa-external-link-alt"></i> Tunnel
                        </a>
                    </td>
                    <td>
                        <button class="table-btn edit-btn" onclick="window.dashboard.editWebsite(${website.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="table-btn delete-btn" onclick="window.dashboard.deleteWebsite(${website.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
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
    }

    function closeModal() {
        console.log('🔒 Closing modal');
        document.getElementById('createModal').classList.remove('active');
        document.getElementById('createWebsiteForm').reset();
    }

    // ==================== HANDLE CREATE SUBMIT ====================
    async function handleCreateSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🎯 Form submitted!');
        console.log('Event target:', event.target);

        // Ambil data dari form - PASTIKAN ELEMEN ADA
        const endpointInput = document.getElementById('endpoint');
        const botTokenInput = document.getElementById('botToken');
        const ownerIdInput = document.getElementById('ownerId');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const emailInput = document.getElementById('email');

        if (!endpointInput || !botTokenInput || !ownerIdInput || !usernameInput || !passwordInput || !emailInput) {
            console.error('❌ Form elements not found!');
            showToast('❌ Form elements not found');
            return;
        }

        const formData = {
            endpoint: endpointInput.value.trim(),
            bot_token: botTokenInput.value.trim(),
            owner_id: parseInt(ownerIdInput.value.trim()),
            username: usernameInput.value.trim(),
            password: passwordInput.value,
            email: emailInput.value.trim().toLowerCase(),
            status: 'active'
        };

        console.log('📦 Form data:', formData);

        // Validasi
        if (!formData.endpoint) {
            showToast('❌ Endpoint cannot be empty');
            return;
        }
        if (!formData.bot_token) {
            showToast('❌ Bot Token cannot be empty');
            return;
        }
        if (!formData.bot_token.includes(':')) {
            showToast('❌ Invalid bot token format (must contain :)');
            return;
        }
        if (isNaN(formData.owner_id)) {
            showToast('❌ Owner ID must be a number');
            return;
        }
        if (!formData.username) {
            showToast('❌ Username cannot be empty');
            return;
        }
        if (!formData.password) {
            showToast('❌ Password cannot be empty');
            return;
        }
        if (!formData.email || !formData.email.includes('@')) {
            showToast('❌ Invalid email');
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

    // ==================== SETUP (PAKAI ONSUBMIT LANGSUNG) ====================
    function setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Create button - pakai onclick langsung
        const createBtn = document.getElementById('createWebsiteBtn');
        if (createBtn) {
            createBtn.onclick = function() {
                console.log('👆 Create button clicked');
                showModal();
            };
        }

        // Close buttons - pakai onclick langsung
        const closeBtn = document.getElementById('closeModalBtn');
        if (closeBtn) closeBtn.onclick = closeModal;

        const cancelBtn = document.getElementById('cancelModalBtn');
        if (cancelBtn) cancelBtn.onclick = closeModal;

        // Refresh button
        const refreshBtn = document.getElementById('refreshDataBtn');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                fetchWebsites();
                showToast('🔄 Data refreshed');
            };
        }

        // FORM SUBMIT - PAKAI ONSIGNMENT LANGSUNG
        const form = document.getElementById('createWebsiteForm');
        if (form) {
            console.log('✅ Form found, attaching submit handler');
            // Hapus onsubmit lama kalau ada
            form.onsubmit = null;
            // Set onsubmit baru
            form.onsubmit = handleCreateSubmit;
            console.log('✅ Submit handler attached');
        } else {
            console.error('❌ Form not found!');
        }

        console.log('✅ Event listeners setup complete');
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing dashboard...');

        try {
            // Set user info (hardcode untuk testing)
            document.getElementById('ownerName').textContent = 'Owner';
            document.getElementById('ownerUsername').textContent = '@ftamous';
            document.getElementById('ownerId').textContent = 'ID: 7998861975';

            // Sembunyikan loading, tampilkan content
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';

            // Setup event listeners
            setupEventListeners();

            // Fetch websites
            await fetchWebsites();

            console.log('✅ Dashboard initialized');
        } catch (error) {
            console.error('❌ Init error:', error);
        }
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.dashboard = {
        editWebsite: (id) => {
            const website = websites.find(w => w.id === id);
            if (website) {
                alert('Edit feature - ID: ' + id + '\nEndpoint: ' + website.endpoint);
            }
        },
        deleteWebsite: (id) => {
            if (confirm('Are you sure you want to delete this website?')) {
                alert('Delete feature - ID: ' + id);
            }
        }
    };

    // ==================== START ====================
    // Jalankan init setelah DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

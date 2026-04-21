// winedash/js/admin.js - Admin Panel JavaScript

(function() {
    'use strict';
    
    const API_BASE_URL = window.location.origin;
    
    let currentUser = null;
    let currentTab = 'dashboard';
    let telegramUser = null;
    
    // DOM Elements
    let loginContainer, adminContainer, loginForm, loginError;
    let statsContainer, usersTableBody, usernamesTableBody, pendingTableBody;
    let auctionsTableBody, logsTableBody;
    let searchInput, searchBtn;
    
    // ==================== UTILITY FUNCTIONS ====================
    
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
    
    function showToast(message, type = 'info', duration = 3000) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.id = 'toastContainer';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    function showLoading(show) {
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Loading...</div>';
            document.body.appendChild(loadingOverlay);
        }
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return parseFloat(num).toFixed(2);
    }
    
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== AUTHENTICATION ====================
    
    async function checkTelegramAuth() {
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/admin/auth/telegram`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: telegramUser.id })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentUser = telegramUser;
                    showAdminPanel();
                    return true;
                }
            } catch (error) {
                console.error('Telegram auth error:', error);
            }
        }
        return false;
    }
    
    async function checkSessionAuth() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/auth/check`);
            const data = await response.json();
            
            if (data.authenticated) {
                showAdminPanel();
                return true;
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
        return false;
    }
    
    async function initAuth() {
        // Try Telegram auth first
        const telegramAuthed = await checkTelegramAuth();
        if (telegramAuthed) return;
        
        // Try session auth
        const sessionAuthed = await checkSessionAuth();
        if (sessionAuthed) return;
        
        // Show login form
        showLoginForm();
    }
    
    function showLoginForm() {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (adminContainer) adminContainer.style.display = 'none';
    }
    
    function showAdminPanel() {
        if (loginContainer) loginContainer.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'block';
        
        // Update admin info if from Telegram
        if (telegramUser) {
            const adminAvatar = document.querySelector('.admin-avatar');
            const adminName = document.querySelector('.admin-name');
            
            if (adminAvatar) {
                if (telegramUser.photo_url) {
                    adminAvatar.innerHTML = `<img src="${telegramUser.photo_url}" alt="Avatar">`;
                } else {
                    const initial = (telegramUser.first_name?.[0] || telegramUser.username?.[0] || 'A').toUpperCase();
                    adminAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
            }
            if (adminName) {
                adminName.textContent = telegramUser.first_name || telegramUser.username || 'Admin';
            }
        }
        
        // Load initial data
        loadDashboard();
    }
    
    async function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername')?.value;
        const password = document.getElementById('loginPassword')?.value;
        
        if (!username || !password) {
            if (loginError) loginError.textContent = 'Username and password required';
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAdminPanel();
                loadDashboard();
            } else {
                if (loginError) loginError.textContent = data.error || 'Invalid credentials';
            }
        } catch (error) {
            console.error('Login error:', error);
            if (loginError) loginError.textContent = 'Login failed. Please try again.';
        } finally {
            showLoading(false);
        }
    }
    
    async function handleLogout() {
        try {
            await fetch(`${API_BASE_URL}/api/winedash/admin/auth/logout`, { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // Reset UI
        currentUser = null;
        telegramUser = null;
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (adminContainer) adminContainer.style.display = 'none';
        
        showToast('Logged out successfully', 'success');
    }
    
    // ==================== DASHBOARD ====================
    
    async function loadDashboard() {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/stats`);
            const data = await response.json();
            
            if (data.success && statsContainer) {
                const stats = data.stats;
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-value">${stats.total_users || 0}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-tag"></i></div>
                        <div class="stat-value">${stats.total_usernames || 0}</div>
                        <div class="stat-label">Total Usernames</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-value">${stats.listed_usernames || 0}</div>
                        <div class="stat-label">Listed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
                        <div class="stat-value">${stats.sold_usernames || 0}</div>
                        <div class="stat-label">Sold</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-value">${formatNumber(stats.total_volume)} TON</div>
                        <div class="stat-label">Total Volume</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-arrow-down"></i></div>
                        <div class="stat-value">${formatNumber(stats.total_deposits)} TON</div>
                        <div class="stat-label">Total Deposits</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                        <div class="stat-value">${formatNumber(stats.total_withdrawals)} TON</div>
                        <div class="stat-label">Total Withdrawals</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-gavel"></i></div>
                        <div class="stat-value">${stats.active_auctions || 0}</div>
                        <div class="stat-label">Active Auctions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-value">${stats.pending_usernames || 0}</div>
                        <div class="stat-label">Pending Verif</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-tag"></i></div>
                        <div class="stat-value">${stats.pending_offers || 0}</div>
                        <div class="stat-label">Pending Offers</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Error loading dashboard', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== USERS MANAGEMENT ====================
    
    async function loadUsers(searchTerm = '') {
        if (!usersTableBody) return;
        
        showLoading(true);
        usersTableBody.innerHTML = '<tr><td colspan="10" class="loading-placeholder"><div class="loading-spinner"></div>Loading users...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/users`);
            const data = await response.json();
            
            if (data.success && data.users) {
                let users = data.users;
                
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    users = users.filter(u => 
                        (u.username && u.username.toLowerCase().includes(term)) ||
                        (u.first_name && u.first_name.toLowerCase().includes(term)) ||
                        u.user_id.toString().includes(term)
                    );
                }
                
                if (users.length === 0) {
                    usersTableBody.innerHTML = '<tr><td colspan="10" class="loading-placeholder">No users found</td></tr>';
                    return;
                }
                
                usersTableBody.innerHTML = users.map(user => `
                    <tr>
                        <td>
                            ${user.photo_url ? 
                                `<img src="${user.photo_url}" class="user-avatar-small" onerror="this.style.display='none'">` : 
                                '<i class="fas fa-user" style="font-size: 20px; color: var(--text-muted);"></i>'
                            }
                        </td>
                        <td>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</td>
                        <td>${escapeHtml(user.username || '-')}</td>
                        <td>${user.user_id}</td>
                        <td>${formatNumber(user.balance)} TON</td>
                        <td>${user.total_usernames || 0}</td>
                        <td>${user.pending_usernames || 0}</td>
                        <td>${user.active_auctions || 0}</td>
                        <td>${formatDate(user.last_seen)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn primary" onclick="window.viewUserDetail(${user.user_id})">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="action-btn success" onclick="window.adjustUserBalance(${user.user_id}, '${escapeHtml(user.first_name || user.username || user.user_id)}', ${user.balance})">
                                    <i class="fas fa-coins"></i> Balance
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            } else {
                usersTableBody.innerHTML = '<tr><td colspan="10" class="loading-placeholder">Failed to load users</td></tr>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
            usersTableBody.innerHTML = '<tr><td colspan="10" class="loading-placeholder">Error loading users</td></tr>';
            showToast('Error loading users', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function viewUserDetail(userId) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/user/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                const user = data.user;
                const usernames = data.usernames || [];
                const transactions = data.transactions || [];
                
                const modalContent = `
                    <div class="user-detail-header">
                        <div class="user-detail-avatar">
                            ${user.photo_url ? 
                                `<img src="${user.photo_url}" alt="Avatar" onerror="this.style.display='none'">` : 
                                '<i class="fas fa-user" style="font-size: 32px; color: white;"></i>'
                            }
                        </div>
                        <div class="user-detail-info">
                            <h4>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</h4>
                            <p>@${escapeHtml(user.username || '-')}</p>
                            <p>ID: ${user.user_id}</p>
                        </div>
                    </div>
                    
                    <div class="user-stats">
                        <div class="user-stat-item">
                            <div class="user-stat-value">${formatNumber(user.balance)}</div>
                            <div class="user-stat-label">Balance (TON)</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${formatNumber(user.total_deposit)}</div>
                            <div class="user-stat-label">Total Deposit</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${formatNumber(user.total_withdraw)}</div>
                            <div class="user-stat-label">Total Withdraw</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${user.total_usernames || 0}</div>
                            <div class="user-stat-label">Usernames</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${user.listed_usernames || 0}</div>
                            <div class="user-stat-label">Listed</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${user.purchased_usernames || 0}</div>
                            <div class="user-stat-label">Purchased</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${user.total_auctions || 0}</div>
                            <div class="user-stat-label">Auctions</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${user.total_bids || 0}</div>
                            <div class="user-stat-label">Bids</div>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px 0;">Usernames (${usernames.length})</h4>
                    <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr><th>Username</th><th>Price</th><th>Status</th><th>Created</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                ${usernames.map(u => `
                                    <tr>
                                        <td>@${escapeHtml(u.username)}</td>
                                        <td>${formatNumber(u.price)} TON</td>
                                        <td><span class="badge ${u.status === 'available' ? 'badge-success' : u.status === 'unlisted' ? 'badge-warning' : 'badge-info'}">${u.status}</span></td>
                                        <td>${formatDate(u.created_at)}</td>
                                        <td>
                                            <button class="action-btn danger" onclick="window.deleteUsernameAdmin(${u.id}, '${escapeHtml(u.username)}')">
                                                <i class="fas fa-trash"></i> Delete
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${usernames.length === 0 ? '<tr><td colspan="5" class="loading-placeholder">No usernames</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px 0;">Recent Transactions (${transactions.length})</h4>
                    <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                        <table class="admin-table">
                            <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Details</th></tr></thead>
                            <tbody>
                                ${transactions.slice(0, 10).map(tx => `
                                    <tr>
                                        <td><span class="badge ${tx.type === 'deposit' ? 'badge-success' : tx.type === 'withdraw' ? 'badge-warning' : 'badge-info'}">${tx.type}</span></td>
                                        <td>${formatNumber(tx.amount)} TON</td>
                                        <td><span class="badge ${tx.status === 'success' ? 'badge-success' : 'badge-warning'}">${tx.status}</span></td>
                                        <td>${formatDate(tx.created_at)}</td>
                                        <td>${escapeHtml(tx.details || '-')}</td>
                                    </tr>
                                `).join('')}
                                ${transactions.length === 0 ? '<tr><td colspan="5" class="loading-placeholder">No transactions</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                `;
                
                showModal('User Details', modalContent, [
                    { text: 'Close', class: 'modal-cancel', onClick: 'closeModal()' }
                ]);
            }
        } catch (error) {
            console.error('Error loading user detail:', error);
            showToast('Error loading user details', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    function adjustUserBalance(userId, userName, currentBalance) {
        const modalContent = `
            <div style="text-align: center;">
                <p>User: <strong>${escapeHtml(userName)}</strong></p>
                <p>Current Balance: <strong style="color: var(--success);">${formatNumber(currentBalance)} TON</strong></p>
                <div class="balance-actions" style="margin: 20px 0;">
                    <button class="action-btn success" onclick="window.addBalance(${userId}, '${escapeHtml(userName)}')">
                        <i class="fas fa-plus"></i> Add Balance
                    </button>
                    <button class="action-btn danger" onclick="window.subtractBalance(${userId}, '${escapeHtml(userName)}')">
                        <i class="fas fa-minus"></i> Subtract Balance
                    </button>
                </div>
            </div>
        `;
        
        showModal('Adjust Balance', modalContent, [
            { text: 'Close', class: 'modal-cancel', onClick: 'closeModal()' }
        ]);
    }
    
    async function addBalance(userId, userName) {
        const amount = prompt(`Enter amount to add for ${userName}:`, '10');
        if (!amount) return;
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast('Invalid amount', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/user/balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, amount: amountNum, is_add: true })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Added ${amountNum} TON to ${userName}`, 'success');
                closeModal();
                loadUsers();
            } else {
                showToast(data.error || 'Failed to add balance', 'error');
            }
        } catch (error) {
            console.error('Error adding balance:', error);
            showToast('Error adding balance', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function subtractBalance(userId, userName) {
        const amount = prompt(`Enter amount to subtract from ${userName}:`, '10');
        if (!amount) return;
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast('Invalid amount', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/user/balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, amount: amountNum, is_add: false })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Subtracted ${amountNum} TON from ${userName}`, 'success');
                closeModal();
                loadUsers();
            } else {
                showToast(data.error || 'Failed to subtract balance', 'error');
            }
        } catch (error) {
            console.error('Error subtracting balance:', error);
            showToast('Error subtracting balance', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== USERNAMES MANAGEMENT ====================
    
    async function loadUsernames(searchTerm = '') {
        if (!usernamesTableBody) return;
        
        showLoading(true);
        usernamesTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder"><div class="loading-spinner"></div>Loading usernames...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/usernames`);
            const data = await response.json();
            
            if (data.success && data.usernames) {
                let usernames = data.usernames;
                
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    usernames = usernames.filter(u => 
                        u.username.toLowerCase().includes(term) ||
                        (u.based_on && u.based_on.toLowerCase().includes(term))
                    );
                }
                
                if (usernames.length === 0) {
                    usernamesTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">No usernames found</td></tr>';
                    return;
                }
                
                usernamesTableBody.innerHTML = usernames.map(u => `
                    <tr>
                        <td>@${escapeHtml(u.username)}</td>
                        <td>${escapeHtml(u.based_on || '-')}</td>
                        <td>${formatNumber(u.price)} TON</td>
                        <td><span class="badge ${u.status === 'available' ? 'badge-success' : u.status === 'unlisted' ? 'badge-warning' : u.status === 'on_auction' ? 'badge-info' : 'badge-danger'}">${u.status}</span></td>
                        <td>${escapeHtml(u.seller_username || u.seller_name || '-')}</td>
                        <td>${escapeHtml(u.buyer_username || '-')}</td>
                        <td>${formatDate(u.created_at)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn danger" onclick="window.deleteUsernameAdmin(${u.id}, '${escapeHtml(u.username)}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            } else {
                usernamesTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">Failed to load usernames</td></tr>';
            }
        } catch (error) {
            console.error('Error loading usernames:', error);
            usernamesTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">Error loading usernames</td></tr>';
            showToast('Error loading usernames', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function deleteUsernameAdmin(usernameId, username) {
        if (!confirm(`Are you sure you want to delete username @${username}?`)) return;
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/username/delete/${usernameId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Username @${username} deleted`, 'success');
                loadUsernames();
                loadDashboard();
            } else {
                showToast(data.error || 'Failed to delete username', 'error');
            }
        } catch (error) {
            console.error('Error deleting username:', error);
            showToast('Error deleting username', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== PENDING MANAGEMENT ====================
    
    async function loadPendingUsernames(searchTerm = '') {
        if (!pendingTableBody) return;
        
        showLoading(true);
        pendingTableBody.innerHTML = '<tr><td colspan="7" class="loading-placeholder"><div class="loading-spinner"></div>Loading pending...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/pending-usernames`);
            const data = await response.json();
            
            if (data.success && data.pendings) {
                let pendings = data.pendings;
                
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    pendings = pendings.filter(p => 
                        p.username.toLowerCase().includes(term) ||
                        (p.based_on && p.based_on.toLowerCase().includes(term))
                    );
                }
                
                if (pendings.length === 0) {
                    pendingTableBody.innerHTML = '<tr><td colspan="7" class="loading-placeholder">No pending usernames</td></tr>';
                    return;
                }
                
                pendingTableBody.innerHTML = pendings.map(p => `
                    <tr>
                        <td>@${escapeHtml(p.username)}</td>
                        <td>${escapeHtml(p.based_on || '-')}</td>
                        <td>${formatNumber(p.price)} TON</td>
                        <td>${escapeHtml(p.verification_type || 'auto')}</td>
                        <td>${escapeHtml(p.seller_username || p.seller_name || '-')}</td>
                        <td>${formatDate(p.created_at)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn success" onclick="window.confirmPendingAdmin(${p.id}, '${escapeHtml(p.username)}')">
                                    <i class="fas fa-check"></i> Confirm
                                </button>
                                <button class="action-btn danger" onclick="window.rejectPendingAdmin(${p.id}, '${escapeHtml(p.username)}')">
                                    <i class="fas fa-times"></i> Reject
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            } else {
                pendingTableBody.innerHTML = '<tr><td colspan="7" class="loading-placeholder">Failed to load pending</td></tr>';
            }
        } catch (error) {
            console.error('Error loading pending:', error);
            pendingTableBody.innerHTML = '<tr><td colspan="7" class="loading-placeholder">Error loading pending</td></tr>';
            showToast('Error loading pending', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function confirmPendingAdmin(pendingId, username) {
        if (!confirm(`Confirm username @${username}? This will add it to marketplace.`)) return;
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/username/confirm-pending/${pendingId}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Username @${username} confirmed and added to marketplace`, 'success');
                loadPendingUsernames();
                loadDashboard();
            } else {
                showToast(data.error || 'Failed to confirm', 'error');
            }
        } catch (error) {
            console.error('Error confirming pending:', error);
            showToast('Error confirming pending', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async function rejectPendingAdmin(pendingId, username) {
        if (!confirm(`Reject username @${username}?`)) return;
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/username/reject-pending/${pendingId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Username @${username} rejected`, 'warning');
                loadPendingUsernames();
                loadDashboard();
            } else {
                showToast(data.error || 'Failed to reject', 'error');
            }
        } catch (error) {
            console.error('Error rejecting pending:', error);
            showToast('Error rejecting pending', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== AUCTIONS MANAGEMENT ====================
    
    async function loadAuctions(searchTerm = '') {
        if (!auctionsTableBody) return;
        
        showLoading(true);
        auctionsTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder"><div class="loading-spinner"></div>Loading auctions...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/auctions`);
            const data = await response.json();
            
            if (data.success && data.auctions) {
                let auctions = data.auctions;
                
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    auctions = auctions.filter(a => 
                        a.username && a.username.toLowerCase().includes(term)
                    );
                }
                
                if (auctions.length === 0) {
                    auctionsTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">No auctions found</td></tr>';
                    return;
                }
                
                auctionsTableBody.innerHTML = auctions.map(a => `
                    <tr>
                        <td>@${escapeHtml(a.username || '-')}</td>
                        <td>${formatNumber(a.start_price)} TON</td>
                        <td>${formatNumber(a.current_price)} TON</td>
                        <td>${a.bid_count || 0}</td>
                        <td><span class="badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                        <td>${escapeHtml(a.owner_username || a.owner_name || '-')}</td>
                        <td>${escapeHtml(a.winner_username || '-')}</td>
                        <td>${formatDate(a.created_at)}</td>
                    </tr>
                `).join('');
            } else {
                auctionsTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">Failed to load auctions</td></tr>';
            }
        } catch (error) {
            console.error('Error loading auctions:', error);
            auctionsTableBody.innerHTML = '<tr><td colspan="8" class="loading-placeholder">Error loading auctions</td></tr>';
            showToast('Error loading auctions', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== LOGS ====================
    
    async function loadLogs() {
        if (!logsTableBody) return;
        
        showLoading(true);
        logsTableBody.innerHTML = '<tr><td colspan="5" class="loading-placeholder"><div class="loading-spinner"></div>Loading logs...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/admin/logs`);
            const data = await response.json();
            
            if (data.success && data.logs) {
                const logs = data.logs;
                
                if (logs.length === 0) {
                    logsTableBody.innerHTML = '<tr><td colspan="5" class="loading-placeholder">No admin logs</td></tr>';
                    return;
                }
                
                logsTableBody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${formatDate(log.created_at)}</td>
                        <td>${escapeHtml(log.first_name || log.username || `Admin ${log.admin_id}`)}</td>
                        <td><span class="badge badge-primary">${escapeHtml(log.action)}</span></td>
                        <td>${escapeHtml(log.target_type || '-')}</td>
                        <td>${escapeHtml(log.target_id || '-')}</td>
                    </tr>
                `).join('');
            } else {
                logsTableBody.innerHTML = '<tr><td colspan="5" class="loading-placeholder">Failed to load logs</td></tr>';
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            logsTableBody.innerHTML = '<tr><td colspan="5" class="loading-placeholder">Error loading logs</td></tr>';
            showToast('Error loading logs', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== MODAL ====================
    
    let currentModal = null;
    
    function showModal(title, content, buttons = []) {
        closeModal();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h3><i class="fas fa-info-circle"></i> ${title}</h3>
                ${content}
                <div class="modal-buttons">
                    ${buttons.map(btn => `
                        <button class="${btn.class}" onclick="${btn.onClick}">${btn.text}</button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        currentModal = modal;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    function closeModal() {
        if (currentModal) {
            currentModal.remove();
            currentModal = null;
        }
    }
    
    // ==================== TAB SWITCHING ====================
    
    function switchTab(tabId) {
        currentTab = tabId;
        
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`${tabId}Tab`);
        if (activeContent) activeContent.classList.add('active');
        
        // Load data for tab
        switch(tabId) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'users':
                loadUsers();
                break;
            case 'usernames':
                loadUsernames();
                break;
            case 'pending':
                loadPendingUsernames();
                break;
            case 'auctions':
                loadAuctions();
                break;
            case 'logs':
                loadLogs();
                break;
        }
    }
    
    // ==================== SEARCH ====================
    
    function setupSearch() {
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const term = searchInput?.value || '';
                switch(currentTab) {
                    case 'users':
                        loadUsers(term);
                        break;
                    case 'usernames':
                        loadUsernames(term);
                        break;
                    case 'pending':
                        loadPendingUsernames(term);
                        break;
                    case 'auctions':
                        loadAuctions(term);
                        break;
                }
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const term = searchInput.value || '';
                    switch(currentTab) {
                        case 'users':
                            loadUsers(term);
                            break;
                        case 'usernames':
                            loadUsernames(term);
                            break;
                        case 'pending':
                            loadPendingUsernames(term);
                            break;
                        case 'auctions':
                            loadAuctions(term);
                            break;
                    }
                }
            });
        }
    }
    
    // ==================== INITIALIZATION ====================
    
    function init() {
        // Get DOM elements
        loginContainer = document.getElementById('loginContainer');
        adminContainer = document.getElementById('adminContainer');
        loginForm = document.getElementById('loginForm');
        loginError = document.getElementById('loginError');
        statsContainer = document.getElementById('statsContainer');
        usersTableBody = document.getElementById('usersTableBody');
        usernamesTableBody = document.getElementById('usernamesTableBody');
        pendingTableBody = document.getElementById('pendingTableBody');
        auctionsTableBody = document.getElementById('auctionsTableBody');
        logsTableBody = document.getElementById('logsTableBody');
        searchInput = document.getElementById('searchInput');
        searchBtn = document.getElementById('searchBtn');
        
        // Setup login form
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Setup tab buttons
        document.querySelectorAll('.admin-tab').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
        
        // Setup search
        setupSearch();
        
        // Export global functions for onclick handlers
        window.viewUserDetail = viewUserDetail;
        window.adjustUserBalance = adjustUserBalance;
        window.addBalance = addBalance;
        window.subtractBalance = subtractBalance;
        window.deleteUsernameAdmin = deleteUsernameAdmin;
        window.confirmPendingAdmin = confirmPendingAdmin;
        window.rejectPendingAdmin = rejectPendingAdmin;
        window.closeModal = closeModal;
        
        // Start authentication
        initAuth();
    }
    
    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
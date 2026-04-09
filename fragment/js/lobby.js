// lobby.js - JavaScript untuk halaman lobby

(function() {
    'use strict';
    
    console.log('🚀 Lobby - Initializing...');
    
    let currentUser = null;
    let selectedPlan = null;
    let salesChart = null;
    
    const API_BASE_URL = window.location.origin;
    
    // Pricing plans
    const plans = {
        basic: { name: 'Basic', price: 100000, price_idr: 'Rp 100K' },
        pro: { name: 'Pro', price: 250000, price_idr: 'Rp 250K' },
        enterprise: { name: 'Enterprise', price: 500000, price_idr: 'Rp 500K' }
    };
    
    // ==================== FUNGSI VIBRATE ====================
    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }
    
    // ==================== FUNGSI TOAST ====================
    function showToast(message, type = 'success', duration = 3000) {
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
            font-size: 13px;
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
        if (!name) return 'https://ui-avatars.com/api/?name=U&size=120&background=40a7e3&color=fff';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0).toUpperCase())}&size=120&background=40a7e3&color=fff`;
    }
    
    // ==================== FUNGSI FORMAT ====================
    function formatNumber(num) { return (num || 0).toLocaleString(); }
    function formatDate(dateStr) { return dateStr ? new Date(dateStr).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'; }
    function formatDateShort(dateStr) { return dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : '-'; }
    function escapeHtml(text) { if (!text) return ''; return String(text).replace(/[&<>]/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; }); }
    
    // ==================== API CALLS ====================
    async function apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        const sessionToken = localStorage.getItem('session_token');
        if (sessionToken) {
            options.headers['X-Session-Token'] = sessionToken;
        }
        
        if (data) options.body = JSON.stringify(data);
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Request failed');
        }
        
        if (result.session_token) {
            localStorage.setItem('session_token', result.session_token);
        }
        
        return result;
    }
    
    // ==================== DASHBOARD FUNCTIONS ====================
    async function loadDashboard() {
        try {
            const result = await apiCall('/api/fragment/lobby/dashboard/stats');
            if (result.success) {
                document.getElementById('statTotalUsers').textContent = formatNumber(result.stats.total_users);
                document.getElementById('statTotalBots').textContent = formatNumber(result.stats.total_bots);
                document.getElementById('statTotalStars').textContent = formatNumber(result.stats.total_stars);
                document.getElementById('statTotalVolume').textContent = result.stats.total_volume.toFixed(2);
                
                if (salesChart) salesChart.destroy();
                
                const ctx = document.getElementById('salesChart').getContext('2d');
                salesChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: result.chart.labels,
                        datasets: [{
                            label: 'Stars',
                            data: result.chart.values,
                            borderColor: '#40a7e3',
                            backgroundColor: 'rgba(64, 167, 227, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 2,
                            borderWidth: 1.5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { labels: { color: '#fff', font: { size: 10 } } }
                        },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff', font: { size: 9 } } },
                            x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff', font: { size: 9 } } }
                        }
                    }
                });
                
                const activityList = document.getElementById('activityList');
                if (result.activities && result.activities.length > 0) {
                    activityList.innerHTML = result.activities.map(a => `
                        <div class="activity-item">
                            <div class="activity-icon"><i class="fas fa-${a.icon || 'bell'}"></i></div>
                            <div class="activity-info">
                                <div class="activity-action">${escapeHtml(a.message)}</div>
                                <div class="activity-time">${formatDate(a.timestamp)}</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    activityList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada aktivitas</p></div>';
                }
            }
        } catch (error) {
            console.error('Load dashboard error:', error);
        }
    }
    
    // ==================== PROFILE FUNCTIONS ====================
    async function loadProfile() {
        const profileContent = document.getElementById('profileContent');
        
        if (!currentUser) {
            profileContent.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px;">
                    <i class="fas fa-user-circle" style="font-size: 64px; color: var(--text-muted);"></i>
                    <p style="margin-top: 16px;">Silakan login untuk melihat profil</p>
                    <button class="login-btn" style="margin-top: 20px; max-width: 200px;" onclick="window.handleLogin()">
                        <i class="fab fa-telegram"></i> Login dengan Telegram
                    </button>
                </div>
            `;
            return;
        }
        
        try {
            const result = await apiCall('/api/fragment/lobby/profile');
            if (result.success && result.profile) {
                const p = result.profile;
                const tgUser = result.telegram_user || currentUser;
                
                // Get photo URL
                const photoUrl = tgUser.photo_url || generateAvatarUrl(tgUser.first_name || p.username || 'User');
                const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || p.owner_name || p.username;
                const username = tgUser.username || p.username;
                const telegramId = tgUser.id || p.telegram_id || p.id;
                
                profileContent.innerHTML = `
                    <div class="profile-section">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                <img src="${photoUrl}" alt="Profile Photo" onerror="this.src='${generateAvatarUrl(fullName)}'">
                            </div>
                            <div class="profile-info">
                                <h3>${escapeHtml(fullName)}</h3>
                                <p>@${escapeHtml(username)}</p>
                                <p style="font-size: 10px; color: var(--text-muted);">ID: ${telegramId}</p>
                            </div>
                        </div>
                        <div class="detail-row"><span class="detail-label">Username Login</span><span>${escapeHtml(p.username || '-')}</span></div>
                        <div class="detail-row"><span class="detail-label">Nama Owner</span><span>${escapeHtml(p.owner_name || '-')}</span></div>
                        <div class="detail-row"><span class="detail-label">Email</span><span>${escapeHtml(p.email || '-')}</span></div>
                        <div class="detail-row"><span class="detail-label">Saldo</span><span style="color: var(--success); font-weight: 600;">Rp ${(p.balance || 0).toLocaleString()}</span></div>
                        <div class="detail-row"><span class="detail-label">Terdaftar</span><span>${formatDateShort(p.created_at)}</span></div>
                        <div class="detail-row"><span class="detail-label">Expired</span><span>${p.expires_at ? formatDateShort(p.expires_at) : 'Permanent'}</span></div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="font-size: 14px; margin-bottom: 12px;">Bot Saya</h3>
                        <div id="userBots"></div>
                    </div>
                `;
                
                // Load bots
                const userBotsDiv = document.getElementById('userBots');
                if (result.bots && result.bots.length > 0) {
                    userBotsDiv.innerHTML = result.bots.map(b => `
                        <div style="background: var(--dark-card); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>@${escapeHtml(b.bot_username)}</strong>
                                    <p style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(b.bot_name)}</p>
                                </div>
                                <span style="background: ${b.status === 'running' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${b.status === 'running' ? '#10b981' : '#ef4444'}; padding: 2px 8px; border-radius: 12px; font-size: 10px;">
                                    ${b.status === 'running' ? 'Running' : 'Stopped'}
                                </span>
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">
                                Expired: ${b.expires_at ? formatDateShort(b.expires_at) : 'Permanent'}
                            </div>
                        </div>
                    `).join('');
                } else {
                    userBotsDiv.innerHTML = `
                        <div class="empty-state" style="padding: 40px;">
                            <i class="fas fa-robot" style="font-size: 48px;"></i>
                            <p>Belum ada bot</p>
                            <button class="select-plan-btn" style="margin-top: 12px; max-width: 150px;" onclick="window.navigateTo('pricing')">
                                Sewa Bot
                            </button>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Load profile error:', error);
            profileContent.innerHTML = '<div class="empty-state">Gagal memuat profil</div>';
        }
    }
    
    // ==================== TELEGRAM AUTH ====================
    async function initTelegramAuth() {
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            console.log('📱 Running inside Telegram Web App');
            
            webApp.expand();
            webApp.ready();
            
            applyTelegramTheme(webApp);
            
            if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
                const telegramUser = webApp.initDataUnsafe.user;
                console.log('📱 Telegram user data:', telegramUser);
                
                // Set current user from Telegram
                currentUser = {
                    id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name,
                    username: telegramUser.username,
                    photo_url: telegramUser.photo_url,
                    language_code: telegramUser.language_code
                };
                
                updateUserUI();
                showToast(`Welcome, ${currentUser.first_name || currentUser.username}!`, 'success');
                
                // Try to authenticate with backend
                try {
                    const initData = webApp.initData;
                    if (initData) {
                        const result = await apiCall('/api/fragment/lobby/telegram-auth', 'POST', { init_data: initData });
                        if (result.success && result.user) {
                            currentUser = { ...currentUser, ...result.user };
                            updateUserUI();
                            showToast(`Login successful!`, 'success');
                        }
                    }
                } catch (error) {
                    console.error('Backend auth error:', error);
                    // Still show as logged in with Telegram data
                }
                
                // Load dashboard data after login
                if (document.getElementById('page-home').classList.contains('active')) {
                    loadDashboard();
                }
            } else {
                console.log('📱 No user data from Telegram WebApp');
                // Check for existing session
                await checkExistingSession();
            }
        } else {
            console.log('🌐 Running in standalone web browser');
            await checkExistingSession();
        }
    }
    
    async function checkExistingSession() {
        try {
            const result = await apiCall('/api/fragment/lobby/me');
            if (result.success && result.user) {
                currentUser = result.user;
                updateUserUI();
                console.log('✅ Session restored:', currentUser);
            }
        } catch (error) {
            console.log('No existing session');
        }
    }
    
    function handleLogin() {
        // If in Telegram, trigger auth
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
                initTelegramAuth();
            } else {
                showToast('Please open this page inside Telegram', 'warning');
            }
        } else {
            showToast('Please open this page inside Telegram app', 'warning');
        }
    }
    
    async function handleLogout() {
        try {
            await apiCall('/api/fragment/lobby/logout', 'POST');
        } catch (e) {}
        localStorage.removeItem('session_token');
        currentUser = null;
        updateUserUI();
        showToast('Logout berhasil', 'success');
        loadDashboard();
        
        // Reload profile if visible
        if (document.getElementById('page-profile').classList.contains('active')) {
            loadProfile();
        }
    }
    
    function updateUserUI() {
        const userInfoDiv = document.getElementById('userInfo');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userNameSpan = document.getElementById('userName');
        const userUsernameSpan = document.getElementById('userUsername');
        const userAvatarDiv = document.getElementById('userAvatar');
        
        if (currentUser) {
            userInfoDiv.style.display = 'flex';
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'flex';
            
            const displayName = currentUser.first_name || currentUser.username || currentUser.owner_name || 'User';
            const displayUsername = currentUser.username || 'user';
            
            userNameSpan.textContent = displayName;
            userUsernameSpan.textContent = '@' + displayUsername;
            
            // Update avatar
            if (currentUser.photo_url) {
                userAvatarDiv.innerHTML = `<img src="${currentUser.photo_url}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                userAvatarDiv.innerHTML = `<i class="fas fa-user-circle"></i>`;
            }
        } else {
            userInfoDiv.style.display = 'none';
            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
    }
    
    // ==================== MODAL FUNCTIONS ====================
    function showCloneModal(plan) {
        if (!currentUser) {
            showToast('Silakan login terlebih dahulu', 'warning');
            handleLogin();
            return;
        }
        
        selectedPlan = plan;
        document.getElementById('modalTitle').textContent = `Clone Bot - ${plans[plan].name}`;
        document.getElementById('modalPlan').innerHTML = `<strong>${plans[plan].name}</strong> - ${plans[plan].price_idr}`;
        
        document.getElementById('botToken').value = '';
        document.getElementById('telegramId').value = currentUser.id || '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('confirmPassword').value = '';
        
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
        
        document.getElementById('cloneModal').classList.add('active');
        vibrate(10);
    }
    
    function closeModal() {
        document.getElementById('cloneModal').classList.remove('active');
        selectedPlan = null;
    }
    
    function validateForm() {
        let isValid = true;
        const botToken = document.getElementById('botToken');
        const telegramId = document.getElementById('telegramId');
        const username = document.getElementById('username');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (!botToken.value.trim()) {
            showError(botToken, 'Bot token wajib');
            isValid = false;
        } else if (botToken.value.split(':').length !== 2) {
            showError(botToken, 'Format tidak valid');
            isValid = false;
        } else {
            clearError(botToken);
        }
        
        if (!telegramId.value.trim()) {
            showError(telegramId, 'Telegram ID wajib');
            isValid = false;
        } else if (!/^\d+$/.test(telegramId.value.trim())) {
            showError(telegramId, 'Harus angka');
            isValid = false;
        } else {
            clearError(telegramId);
        }
        
        if (!username.value.trim()) {
            showError(username, 'Username wajib');
            isValid = false;
        } else if (username.value.length < 3) {
            showError(username, 'Min 3 karakter');
            isValid = false;
        } else {
            clearError(username);
        }
        
        if (!password.value) {
            showError(password, 'Password wajib');
            isValid = false;
        } else if (password.value.length < 6) {
            showError(password, 'Min 6 karakter');
            isValid = false;
        } else {
            clearError(password);
        }
        
        if (password.value !== confirmPassword.value) {
            showError(confirmPassword, 'Password tidak cocok');
            isValid = false;
        } else {
            clearError(confirmPassword);
        }
        
        return isValid;
    }
    
    function showError(input, msg) {
        input.classList.add('error');
        const span = input.parentElement.querySelector('.error-text');
        if (span) span.textContent = msg;
    }
    
    function clearError(input) {
        input.classList.remove('error');
        const span = input.parentElement.querySelector('.error-text');
        if (span) span.textContent = '';
    }
    
    async function handleSubmitClone() {
        if (!validateForm()) return;
        
        const submitBtn = document.querySelector('.btn-submit');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const data = {
                plan: selectedPlan,
                bot_token: document.getElementById('botToken').value.trim(),
                telegram_id: parseInt(document.getElementById('telegramId').value.trim()),
                username: document.getElementById('username').value.trim().toLowerCase(),
                password: document.getElementById('password').value,
                price: plans[selectedPlan].price
            };
            
            const result = await apiCall('/api/fragment/lobby/create-bot', 'POST', data);
            
            if (result.success) {
                showToast('Bot berhasil dibuat!', 'success');
                closeModal();
                if (result.user) {
                    currentUser = result.user;
                    updateUserUI();
                }
                if (document.getElementById('page-profile').classList.contains('active')) {
                    loadProfile();
                }
            } else {
                showToast(result.error || 'Gagal membuat bot', 'error');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
    
    // ==================== NAVIGATION ====================
    function navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) item.classList.add('active');
        });
        
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('mobile-open');
        }
        
        // Load data based on page
        if (page === 'home') {
            loadDashboard();
        } else if (page === 'profile') {
            loadProfile();
        }
    }
    
    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('mobileMenuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('mobileMenuToggle');
            if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
                if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(item.dataset.page);
            });
        });
        
        // Login/Logout
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        
        // Modal
        document.getElementById('modalClose').addEventListener('click', closeModal);
        document.getElementById('modalCancel').addEventListener('click', closeModal);
        document.getElementById('modalSubmit').addEventListener('click', handleSubmitClone);
        
        document.getElementById('cloneModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cloneModal')) closeModal();
        });
        
        // Select plan buttons
        document.querySelectorAll('.select-plan-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showCloneModal(btn.dataset.plan);
            });
        });
    }
    
    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing Lobby...');
        setupEventListeners();
        
        // Initialize Telegram WebApp
        await initTelegramAuth();
        
        // Show home page by default
        navigateTo('home');
        
        console.log('✅ Lobby initialized');
    }
    
    // Expose global functions
    window.navigateTo = navigateTo;
    window.handleLogin = handleLogin;
    window.showCloneModal = showCloneModal;
    window.closeModal = closeModal;
    
    // Start
    init();
})();
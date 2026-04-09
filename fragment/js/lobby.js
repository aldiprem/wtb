// lobby.js - JavaScript untuk halaman lobby

(function() {
    'use strict';
    
    console.log('🚀 Lobby - Initializing...');
    
    let currentUser = null;
    let selectedPlan = null;
    let salesChart = null;
    
    const API_BASE = window.location.origin;
    
    // Pricing plans
    const plans = {
        basic: { name: 'Basic', price: 100000, price_idr: 'Rp 100K' },
        pro: { name: 'Pro', price: 250000, price_idr: 'Rp 250K' },
        enterprise: { name: 'Enterprise', price: 500000, price_idr: 'Rp 500K' }
    };
    
    // Helper functions
    function showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        document.body.appendChild(toast);
        toast.querySelector('.toast-close').onclick = () => toast.remove();
        setTimeout(() => toast.remove(), 3000);
    }
    
    function showLoading(btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        return () => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        };
    }
    
    async function apiCall(endpoint, method = 'GET', data = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        
        const sessionToken = localStorage.getItem('session_token');
        if (sessionToken) {
            options.headers['X-Session-Token'] = sessionToken;
        }
        
        if (data) options.body = JSON.stringify(data);
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Request failed');
        }
        
        if (result.session_token) {
            localStorage.setItem('session_token', result.session_token);
        }
        
        return result;
    }
    
    // Dashboard functions
    async function loadDashboard() {
        try {
            const result = await apiCall('/api/fragment/lobby/dashboard/stats');
            if (result.success) {
                document.getElementById('statTotalUsers').textContent = formatNumber(result.stats.total_users);
                document.getElementById('statTotalBots').textContent = formatNumber(result.stats.total_bots);
                document.getElementById('statTotalStars').textContent = formatNumber(result.stats.total_stars);
                document.getElementById('statTotalVolume').textContent = result.stats.total_volume.toFixed(2);
                
                // Render chart
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
                
                // Render activities
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
    
    // Profile functions
    async function loadProfile() {
        if (!currentUser) {
            document.getElementById('profileContent').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-circle"></i>
                    <p>Login untuk melihat profil</p>
                    <button class="login-btn" style="margin-top: 12px; max-width: 150px;" onclick="handleLogin()">
                        <i class="fab fa-telegram"></i> Login
                    </button>
                </div>
            `;
            return;
        }
        
        try {
            const result = await apiCall('/api/fragment/lobby/profile');
            if (result.success && result.profile) {
                const p = result.profile;
                const userData = result.telegram_user || {};
                
                document.getElementById('profileContent').innerHTML = `
                    <div class="profile-section">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                ${userData.photo_url ? `<img src="${userData.photo_url}" alt="Photo">` : '<i class="fas fa-user-circle"></i>'}
                            </div>
                            <div class="profile-info">
                                <h3>${escapeHtml(userData.first_name || '')} ${escapeHtml(userData.last_name || '')}</h3>
                                <p>@${escapeHtml(userData.username || p.username || '-')}</p>
                                <p style="font-size: 10px;">ID: ${userData.id || p.id || '-'}</p>
                            </div>
                        </div>
                        <div class="detail-row"><span class="detail-label">Username</span><span>${escapeHtml(p.username || '-')}</span></div>
                        <div class="detail-row"><span class="detail-label">Nama</span><span>${escapeHtml(p.owner_name || '-')}</span></div>
                        <div class="detail-row"><span class="detail-label">Saldo</span><span style="color: var(--success);">Rp ${(p.balance || 0).toLocaleString()}</span></div>
                        <div class="detail-row"><span class="detail-label">Terdaftar</span><span>${formatDateShort(p.created_at)}</span></div>
                        <div class="detail-row"><span class="detail-label">Expired</span><span>${p.expires_at ? formatDateShort(p.expires_at) : 'Permanent'}</span></div>
                    </div>
                    <div style="margin-top: 20px;">
                        <h3 style="font-size: 14px; margin-bottom: 12px;">Bot Saya</h3>
                        <div id="userBots"></div>
                    </div>
                `;
                
                // Load bots
                if (result.bots && result.bots.length > 0) {
                    document.getElementById('userBots').innerHTML = result.bots.map(b => `
                        <div style="background: var(--dark-card); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>@${escapeHtml(b.bot_username)}</strong><p style="font-size: 10px; color: var(--text-muted);">${escapeHtml(b.bot_name)}</p></div>
                                <span style="background: ${b.status === 'running' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${b.status === 'running' ? '#10b981' : '#ef4444'}; padding: 2px 8px; border-radius: 12px; font-size: 10px;">${b.status === 'running' ? 'Running' : 'Stopped'}</span>
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">Expired: ${b.expires_at ? formatDateShort(b.expires_at) : 'Permanent'}</div>
                        </div>
                    `).join('');
                } else {
                    document.getElementById('userBots').innerHTML = `
                        <div class="empty-state"><i class="fas fa-robot"></i><p>Belum ada bot</p>
                        <button class="select-plan-btn" style="margin-top: 12px; max-width: 150px;" onclick="navigateTo('pricing')">Sewa Bot</button></div>
                    `;
                }
            }
        } catch (error) {
            console.error('Load profile error:', error);
            document.getElementById('profileContent').innerHTML = '<div class="empty-state">Gagal memuat profil</div>';
        }
    }
    
    // Helper functions
    function formatNumber(num) { return (num || 0).toLocaleString(); }
    function formatDate(dateStr) { return dateStr ? new Date(dateStr).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'; }
    function formatDateShort(dateStr) { return dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : '-'; }
    function escapeHtml(text) { if (!text) return ''; return String(text).replace(/[&<>]/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; }); }
    
    // Telegram Auth
    async function initTelegramAuth() {
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            const initData = webApp.initData;
            if (initData) {
                try {
                    const result = await apiCall('/api/fragment/lobby/telegram-auth', 'POST', { init_data: initData });
                    if (result.success) {
                        currentUser = result.user;
                        updateUserUI();
                        showToast(`Welcome, ${currentUser.first_name || currentUser.username}!`);
                        loadDashboard();
                    }
                } catch (error) { console.error('Telegram auth error:', error); }
            }
        }
    }
    
    async function handleLogin() { window.location.href = '/fragment/login'; }
    
    async function handleLogout() {
        try { await apiCall('/api/fragment/lobby/logout', 'POST'); } catch(e) {}
        localStorage.removeItem('session_token');
        currentUser = null;
        updateUserUI();
        showToast('Logout berhasil');
        loadDashboard();
    }
    
    function updateUserUI() {
        const userInfoDiv = document.getElementById('userInfo');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (currentUser) {
            userInfoDiv.style.display = 'flex';
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'flex';
            document.getElementById('userName').textContent = currentUser.first_name || currentUser.username || 'User';
            document.getElementById('userUsername').textContent = '@' + (currentUser.username || 'user');
            if (currentUser.photo_url) {
                document.getElementById('userAvatar').innerHTML = `<img src="${currentUser.photo_url}" style="width:100%;height:100%;object-fit:cover;">`;
            }
        } else {
            userInfoDiv.style.display = 'none';
            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
    }
    
    // Modal functions
    function showCloneModal(plan) {
        if (!currentUser) { showToast('Login dulu ya!', 'warning'); handleLogin(); return; }
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
    }
    
    function closeModal() { document.getElementById('cloneModal').classList.remove('active'); selectedPlan = null; }
    
    function validateForm() {
        let isValid = true;
        const botToken = document.getElementById('botToken');
        const telegramId = document.getElementById('telegramId');
        const username = document.getElementById('username');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (!botToken.value.trim()) { showError(botToken, 'Bot token wajib'); isValid = false; }
        else if (botToken.value.split(':').length !== 2) { showError(botToken, 'Format tidak valid'); isValid = false; }
        else { clearError(botToken); }
        
        if (!telegramId.value.trim()) { showError(telegramId, 'Telegram ID wajib'); isValid = false; }
        else if (!/^\d+$/.test(telegramId.value.trim())) { showError(telegramId, 'Harus angka'); isValid = false; }
        else { clearError(telegramId); }
        
        if (!username.value.trim()) { showError(username, 'Username wajib'); isValid = false; }
        else if (username.value.length < 3) { showError(username, 'Min 3 karakter'); isValid = false; }
        else { clearError(username); }
        
        if (!password.value) { showError(password, 'Password wajib'); isValid = false; }
        else if (password.value.length < 6) { showError(password, 'Min 6 karakter'); isValid = false; }
        else { clearError(password); }
        
        if (password.value !== confirmPassword.value) { showError(confirmPassword, 'Password tidak cocok'); isValid = false; }
        else { clearError(confirmPassword); }
        
        return isValid;
    }
    
    function showError(input, msg) { input.classList.add('error'); const span = input.parentElement.querySelector('.error-text'); if (span) span.textContent = msg; }
    function clearError(input) { input.classList.remove('error'); const span = input.parentElement.querySelector('.error-text'); if (span) span.textContent = ''; }
    
    async function handleSubmitClone() {
        if (!validateForm()) return;
        const submitBtn = document.querySelector('.btn-submit');
        const resetLoading = showLoading(submitBtn);
        
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
                showToast('Bot berhasil dibuat!');
                closeModal();
                if (result.user) { currentUser = result.user; updateUserUI(); }
                if (document.getElementById('page-profile').classList.contains('active')) loadProfile();
            } else { showToast(result.error || 'Gagal', 'error'); }
        } catch (error) { showToast(error.message, 'error'); }
        finally { resetLoading(); }
    }
    
    // Navigation
    function navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) item.classList.add('active');
        });
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-open');
        
        if (page === 'home') loadDashboard();
        else if (page === 'profile') loadProfile();
    }
    
    // Event listeners
    function setupEventListeners() {
        document.getElementById('mobileMenuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('mobile-open'));
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('mobileMenuToggle');
            if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        });
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.dataset.page); });
        });
        
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        document.getElementById('modalClose').addEventListener('click', closeModal);
        document.getElementById('modalCancel').addEventListener('click', closeModal);
        document.getElementById('modalSubmit').addEventListener('click', handleSubmitClone);
        document.getElementById('cloneModal').addEventListener('click', (e) => { if (e.target === document.getElementById('cloneModal')) closeModal(); });
        
        document.querySelectorAll('.select-plan-btn').forEach(btn => {
            btn.addEventListener('click', () => showCloneModal(btn.dataset.plan));
        });
    }
    
    // Initialize
    async function init() {
        setupEventListeners();
        try {
            const result = await apiCall('/api/fragment/lobby/me');
            if (result.success && result.user) { currentUser = result.user; updateUserUI(); }
        } catch (error) { console.log('Not logged in'); }
        
        if (window.Telegram && window.Telegram.WebApp) await initTelegramAuth();
        
        navigateTo('home');
        console.log('✅ Lobby initialized');
    }
    
    window.navigateTo = navigateTo;
    window.handleLogin = handleLogin;
    window.showCloneModal = showCloneModal;
    window.closeModal = closeModal;
    
    init();
})();
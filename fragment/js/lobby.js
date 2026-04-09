// lobby.js - JavaScript untuk halaman lobby

(function() {
    'use strict';
    
    console.log('🚀 Lobby - Initializing...');
    
    // State
    let currentUser = null;
    let selectedPlan = null;
    
    // API Base URL
    const API_BASE = window.location.origin;
    
    // Pricing plans
    const plans = {
        basic: {
            name: 'Basic Bot',
            price: 100000,
            price_idr: 'Rp 100.000',
            features: [
                '1 Bot Clone',
                'Valid 30 hari',
                'Support 24/7',
                'Update gratis'
            ],
            icon: 'fa-robot'
        },
        pro: {
            name: 'Pro Bot',
            price: 250000,
            price_idr: 'Rp 250.000',
            features: [
                '3 Bot Clone',
                'Valid 90 hari',
                'Support Priority',
                'Update gratis',
                'Custom fitur',
                'Analytics dashboard'
            ],
            icon: 'fa-crown'
        },
        enterprise: {
            name: 'Enterprise',
            price: 500000,
            price_idr: 'Rp 500.000',
            features: [
                '10+ Bot Clone',
                'Valid 365 hari',
                'Dedicated support',
                'Update gratis',
                'Custom development',
                'API access',
                'White-label option'
            ],
            icon: 'fa-building'
        }
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
        
        setTimeout(() => toast.remove(), 4000);
    }
    
    function showLoading(btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        return () => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        };
    }
    
    // API calls
    async function apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    }
    
    async function initTelegramAuth() {
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            const initData = webApp.initData;
            
            if (initData) {
                try {
                    const result = await apiCall('/api/lobby/telegram-auth', 'POST', { init_data: initData });
                    if (result.success) {
                        currentUser = result.user;
                        updateUserUI();
                        showToast(`Selamat datang, ${currentUser.first_name || currentUser.username}!`, 'success');
                    }
                } catch (error) {
                    console.error('Telegram auth error:', error);
                }
            }
        }
    }
    
    async function handleLogin() {
        window.location.href = '/fragment/login';
    }
    
    async function handleLogout() {
        try {
            await apiCall('/api/lobby/logout', 'POST');
            currentUser = null;
            updateUserUI();
            showToast('Berhasil logout', 'success');
        } catch (error) {
            console.error('Logout error:', error);
        }
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
        } else {
            userInfoDiv.style.display = 'none';
            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
    }
    
    // Modal functions
    function showCloneModal(plan) {
        selectedPlan = plan;
        const modal = document.getElementById('cloneModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalPlan = document.getElementById('modalPlan');
        
        modalTitle.textContent = `Clone Bot - ${plans[plan].name}`;
        modalPlan.textContent = `Paket: ${plans[plan].name} - ${plans[plan].price_idr}`;
        
        // Clear form
        document.getElementById('botToken').value = '';
        document.getElementById('telegramId').value = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('confirmPassword').value = '';
        
        // Clear errors
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
        
        modal.classList.add('active');
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
        
        // Bot token validation
        if (!botToken.value.trim()) {
            showError(botToken, 'Bot token wajib diisi');
            isValid = false;
        } else if (!botToken.value.startsWith('') || botToken.value.split(':').length !== 2) {
            showError(botToken, 'Format bot token tidak valid');
            isValid = false;
        } else {
            clearError(botToken);
        }
        
        // Telegram ID validation
        if (!telegramId.value.trim()) {
            showError(telegramId, 'Telegram ID wajib diisi');
            isValid = false;
        } else if (!/^\d+$/.test(telegramId.value.trim())) {
            showError(telegramId, 'Telegram ID harus berupa angka');
            isValid = false;
        } else {
            clearError(telegramId);
        }
        
        // Username validation
        if (!username.value.trim()) {
            showError(username, 'Username wajib diisi');
            isValid = false;
        } else if (username.value.length < 3) {
            showError(username, 'Username minimal 3 karakter');
            isValid = false;
        } else {
            clearError(username);
        }
        
        // Password validation
        if (!password.value) {
            showError(password, 'Password wajib diisi');
            isValid = false;
        } else if (password.value.length < 6) {
            showError(password, 'Password minimal 6 karakter');
            isValid = false;
        } else {
            clearError(password);
        }
        
        // Confirm password
        if (password.value !== confirmPassword.value) {
            showError(confirmPassword, 'Password tidak cocok');
            isValid = false;
        } else {
            clearError(confirmPassword);
        }
        
        return isValid;
    }
    
    function showError(input, message) {
        input.classList.add('error');
        const errorSpan = input.parentElement.querySelector('.error-text');
        if (errorSpan) {
            errorSpan.textContent = message;
        }
    }
    
    function clearError(input) {
        input.classList.remove('error');
        const errorSpan = input.parentElement.querySelector('.error-text');
        if (errorSpan) {
            errorSpan.textContent = '';
        }
    }
    
    async function handleSubmitClone() {
        if (!currentUser) {
            showToast('Silakan login terlebih dahulu', 'warning');
            closeModal();
            window.location.href = '/fragment/login';
            return;
        }
        
        if (!validateForm()) {
            return;
        }
        
        const submitBtn = document.querySelector('.btn-submit');
        const resetLoading = showLoading(submitBtn);
        
        try {
            const data = {
                plan: selectedPlan,
                bot_token: document.getElementById('botToken').value.trim(),
                telegram_id: parseInt(document.getElementById('telegramId').value.trim()),
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value,
                price: plans[selectedPlan].price
            };
            
            const result = await apiCall('/api/lobby/create-bot', 'POST', data);
            
            if (result.success) {
                showToast(`Bot berhasil dibuat! ${result.message}`, 'success');
                closeModal();
                
                // Refresh user info
                if (result.user) {
                    currentUser = result.user;
                    updateUserUI();
                }
            } else {
                showToast(result.error || 'Gagal membuat bot', 'error');
            }
        } catch (error) {
            console.error('Create bot error:', error);
            showToast(error.message || 'Terjadi kesalahan', 'error');
        } finally {
            resetLoading();
        }
    }
    
    // Navigation
    function navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        // Update page title for mobile
        const titles = {
            pricing: 'Harga Sewa Bot',
            penjelasan: 'Tentang Layanan',
            support: 'Dukungan',
            privacy: 'Kebijakan Privasi',
            profile: 'Profil Saya'
        };
        
        if (window.innerWidth <= 768) {
            document.title = `${titles[page]} - Fragment Bot`;
        }
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('mobile-open');
        }
    }
    
    async function loadProfile() {
        if (!currentUser) {
            document.getElementById('profileContent').innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px;">
                    <i class="fas fa-user-circle" style="font-size: 64px; color: var(--text-muted);"></i>
                    <p style="margin-top: 16px;">Silakan login untuk melihat profil</p>
                    <button class="login-btn" style="margin-top: 20px; max-width: 200px;" onclick="handleLogin()">
                        <i class="fab fa-telegram"></i> Login dengan Telegram
                    </button>
                </div>
            `;
            return;
        }
        
        try {
            const result = await apiCall('/api/lobby/profile');
            if (result.success && result.profile) {
                const profile = result.profile;
                document.getElementById('profileContent').innerHTML = `
                    <div style="background: var(--dark-card); border-radius: 16px; padding: 24px;">
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px; flex-wrap: wrap;">
                            <div class="user-avatar" style="width: 80px; height: 80px;">
                                <i class="fas fa-user-circle" style="font-size: 48px;"></i>
                            </div>
                            <div>
                                <h3 style="font-size: 24px;">${profile.username || '-'}</h3>
                                <p style="color: var(--text-muted);">User ID: ${profile.id || '-'}</p>
                            </div>
                        </div>
                        <div class="detail-row" style="display: flex; padding: 12px 0; border-bottom: 1px solid var(--border);">
                            <span style="width: 120px; color: var(--text-muted);">Nama:</span>
                            <span>${profile.owner_name || '-'}</span>
                        </div>
                        <div class="detail-row" style="display: flex; padding: 12px 0; border-bottom: 1px solid var(--border);">
                            <span style="width: 120px; color: var(--text-muted);">Email:</span>
                            <span>${profile.email || '-'}</span>
                        </div>
                        <div class="detail-row" style="display: flex; padding: 12px 0; border-bottom: 1px solid var(--border);">
                            <span style="width: 120px; color: var(--text-muted);">Saldo:</span>
                            <span style="color: var(--success); font-weight: 600;">Rp ${(profile.balance || 0).toLocaleString()}</span>
                        </div>
                        <div class="detail-row" style="display: flex; padding: 12px 0; border-bottom: 1px solid var(--border);">
                            <span style="width: 120px; color: var(--text-muted);">Terdaftar:</span>
                            <span>${new Date(profile.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div class="detail-row" style="display: flex; padding: 12px 0;">
                            <span style="width: 120px; color: var(--text-muted);">Expired:</span>
                            <span>${profile.expires_at ? new Date(profile.expires_at).toLocaleDateString('id-ID') : 'Permanent'}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 24px;">
                        <h3 style="margin-bottom: 16px;">Bot Saya</h3>
                        <div id="userBots"></div>
                    </div>
                `;
                
                // Load user's bots
                if (result.bots && result.bots.length > 0) {
                    let botsHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
                    result.bots.forEach(bot => {
                        botsHtml += `
                            <div style="background: var(--dark-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                                    <div>
                                        <strong>@${bot.bot_username}</strong>
                                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${bot.bot_name}</p>
                                    </div>
                                    <span style="background: ${bot.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; 
                                                 color: ${bot.status === 'running' ? '#10b981' : '#ef4444'}; 
                                                 padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                                        ${bot.status === 'running' ? 'Running' : 'Stopped'}
                                    </span>
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
                                    Expired: ${bot.expires_at ? new Date(bot.expires_at).toLocaleDateString('id-ID') : 'Permanent'}
                                </div>
                            </div>
                        `;
                    });
                    botsHtml += '</div>';
                    document.getElementById('userBots').innerHTML = botsHtml;
                } else {
                    document.getElementById('userBots').innerHTML = `
                        <div style="text-align: center; padding: 40px; background: var(--dark-card); border-radius: 12px;">
                            <i class="fas fa-robot" style="font-size: 48px; color: var(--text-muted);"></i>
                            <p style="margin-top: 12px;">Belum ada bot</p>
                            <button class="select-plan-btn" style="margin-top: 16px; max-width: 200px;" onclick="navigateTo('pricing')">
                                Sewa Bot Sekarang
                            </button>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Load profile error:', error);
            document.getElementById('profileContent').innerHTML = '<div class="empty-state">Gagal memuat profil</div>';
        }
    }
    
    // Event listeners
    function setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('mobileMenuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        // Close sidebar when clicking outside on mobile
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
                const page = item.dataset.page;
                navigateTo(page);
                if (page === 'profile') {
                    loadProfile();
                }
            });
        });
        
        // Login/Logout
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        
        // Modal
        document.getElementById('modalClose').addEventListener('click', closeModal);
        document.getElementById('modalCancel').addEventListener('click', closeModal);
        document.getElementById('modalSubmit').addEventListener('click', handleSubmitClone);
        
        // Close modal on outside click
        document.getElementById('cloneModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cloneModal')) {
                closeModal();
            }
        });
        
        // Select plan buttons
        document.querySelectorAll('.select-plan-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = btn.dataset.plan;
                if (!currentUser) {
                    showToast('Silakan login terlebih dahulu', 'warning');
                    handleLogin();
                    return;
                }
                showCloneModal(plan);
            });
        });
    }
    
    // Initialize
    async function init() {
        setupEventListeners();
        
        // Try to get user from session
        try {
            const result = await apiCall('/api/lobby/me');
            if (result.success && result.user) {
                currentUser = result.user;
                updateUserUI();
            }
        } catch (error) {
            console.log('Not logged in');
        }
        
        // Initialize Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            await initTelegramAuth();
        }
        
        // Show pricing page by default
        navigateTo('pricing');
        
        console.log('✅ Lobby initialized');
    }
    
    // Expose functions globally
    window.navigateTo = navigateTo;
    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;
    window.showCloneModal = showCloneModal;
    window.closeModal = closeModal;
    
    init();
})();
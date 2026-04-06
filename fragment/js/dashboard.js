// fragment/js/dashboard.js - JavaScript untuk dashboard

(function() {
    'use strict';
    
    console.log('📊 Dashboard - Initializing...');

    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    let salesChart = null;
    let sessionToken = null;

    // Get session token
    sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
        window.location.href = '/fragment/login';
    }

    // Utility functions
    function formatNumber(num) {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatTon(amount) {
        if (!amount) return '0 TON';
        return amount.toFixed(2) + ' TON';
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    }

    async function fetchAPI(endpoint, options = {}) {
        const response = await fetch(`${API_BASE_URL}/api/fragment${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('session_token');
            window.location.href = '/fragment/login';
            throw new Error('Unauthorized');
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Request failed');
        }
        return data;
    }

    // Load dashboard data
    async function loadDashboard() {
        try {
            const data = await fetchAPI('/dashboard/stats');
            
            document.getElementById('statTotalBots').textContent = formatNumber(data.stats.total_bots);
            document.getElementById('statTotalUsers').textContent = formatNumber(data.stats.total_users);
            document.getElementById('statTotalStars').textContent = formatNumber(data.stats.total_stars);
            document.getElementById('statTotalVolume').textContent = formatTon(data.stats.total_volume);
            
            // Render chart
            if (salesChart) {
                salesChart.destroy();
            }
            
            const ctx = document.getElementById('salesChart').getContext('2d');
            salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.chart.labels,
                    datasets: [{
                        label: 'Stars Terjual',
                        data: data.chart.values,
                        borderColor: '#40a7e3',
                        backgroundColor: 'rgba(64, 167, 227, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        },
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        }
                    }
                }
            });
            
            // Render activities
            const activityList = document.getElementById('activityList');
            if (data.activities && data.activities.length > 0) {
                let html = '';
                data.activities.forEach(activity => {
                    html += `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <i class="fas fa-${activity.icon || 'bell'}"></i>
                            </div>
                            <div class="activity-info">
                                <div class="activity-action">${escapeHtml(activity.message)}</div>
                                <div class="activity-time">${formatDate(activity.timestamp)}</div>
                            </div>
                        </div>
                    `;
                });
                activityList.innerHTML = html;
            } else {
                activityList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada aktivitas terbaru</p></div>';
            }
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async function loadProfile() {
        try {
            const data = await fetchAPI('/profile');
            const profileInfo = document.getElementById('profileInfo');
            profileInfo.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Username:</span>
                    <span class="detail-value">${escapeHtml(data.profile.username)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Bot Token:</span>
                    <span class="detail-value" style="font-family: monospace; font-size: 12px;">${escapeHtml(data.profile.bot_token || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Terdaftar:</span>
                    <span class="detail-value">${formatDate(data.profile.created_at)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Login:</span>
                    <span class="detail-value">${formatDate(data.profile.last_login)}</span>
                </div>
            `;
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    async function loadBotInfo() {
        try {
            const data = await fetchAPI('/bot/info');
            const botInfo = document.getElementById('botInfo');
            if (data.bot) {
                botInfo.innerHTML = `
                    <div class="detail-row">
                        <span class="detail-label">Nama Bot:</span>
                        <span class="detail-value">${escapeHtml(data.bot.bot_name || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Username:</span>
                        <span class="detail-value">@${escapeHtml(data.bot.bot_username || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">
                            <span style="background: ${data.bot.status === 'running' ? '#10b981' : '#ef4444'}; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                                ${data.bot.status === 'running' ? 'Running' : 'Stopped'}
                            </span>
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Token:</span>
                        <span class="detail-value" style="font-family: monospace; font-size: 11px; word-break: break-all;">${escapeHtml(data.bot.bot_token || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Dibuat:</span>
                        <span class="detail-value">${formatDate(data.bot.created_at)}</span>
                    </div>
                `;
            } else {
                botInfo.innerHTML = '<div class="empty-state"><i class="fas fa-robot"></i><p>Belum ada bot yang terdaftar</p></div>';
            }
        } catch (error) {
            console.error('Error loading bot info:', error);
        }
    }

    async function loadUsers() {
        try {
            const data = await fetchAPI('/users/list?limit=50');
            const usersList = document.getElementById('usersList');
            if (data.users && data.users.length > 0) {
                let html = '<div class="users-table-container"><table class="users-table"><thead><tr>';
                html += '<th>User ID</th><th>Username</th><th>Nama</th><th>Stars</th><th>Pembelian</th>';
                html += '</tr></thead><tbody>';
                
                data.users.forEach(user => {
                    html += `
                        <tr>
                            <td>${user.user_id}</td>
                            <td>${user.username ? '@' + escapeHtml(user.username) : '-'}</td>
                            <td>${escapeHtml(user.first_name || '-')} ${escapeHtml(user.last_name || '')}</td>
                            <td>${formatNumber(user.total_stars)}</td>
                            <td>${formatNumber(user.total_purchases)}</td>
                        </tr>
                    `;
                });
                html += '</tbody></table></div>';
                usersList.innerHTML = html;
            } else {
                usersList.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Belum ada user</p></div>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Page navigation
    let currentPage = 'dashboard';

    function showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.getElementById(`page-${page}`).style.display = 'block';
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        document.getElementById('pageTitle').textContent = 
            page === 'dashboard' ? 'Dashboard' :
            page === 'profile' ? 'Profil' :
            page === 'bot' ? 'Bot Clone' :
            page === 'users' ? 'User' : 'Pengaturan';
        
        currentPage = page;
        
        if (page === 'dashboard') loadDashboard();
        else if (page === 'profile') loadProfile();
        else if (page === 'bot') loadBotInfo();
        else if (page === 'users') loadUsers();
    }

    // Sidebar functions
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        sidebar.classList.toggle('active');
        mainContent.classList.toggle('sidebar-open');
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        sidebar.classList.remove('active');
        mainContent.classList.remove('sidebar-open');
    }

    async function logout() {
        try {
            await fetchAPI('/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem('session_token');
        window.location.href = '/fragment/login';
    }

    async function loadUserInfo() {
        try {
            const data = await fetchAPI('/profile');
            document.getElementById('userName').textContent = data.profile.username || 'Admin';
            document.getElementById('userUsername').textContent = '@' + (data.profile.username || 'admin');
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    // Event listeners
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) showPage(page);
            closeSidebar();
        });
    });
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menuToggle');
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                closeSidebar();
            }
        }
    });
    
    // Initialize
    loadUserInfo();
    showPage('dashboard');
})();
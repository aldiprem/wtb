// fragment/js/frag.js - JavaScript untuk Fragment Bot Admin Panel

(function() {
    'use strict';
    
    console.log('🤖 Fragment Bot Admin Panel - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    
    // State
    let currentUser = null;
    let allBots = [];
    let isLoading = false;

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        refreshBtn: document.getElementById('refreshBtn'),
        userAvatar: document.getElementById('userAvatar'),
        statTotalBots: document.getElementById('statTotalBots'),
        statRunningBots: document.getElementById('statRunningBots'),
        statTotalUsers: document.getElementById('statTotalUsers'),
        statTotalStars: document.getElementById('statTotalStars'),
        statTotalVolume: document.getElementById('statTotalVolume'),
        statWalletBalance: document.getElementById('statWalletBalance'),
        fragmentApiStatus: document.getElementById('fragmentApiStatus'),
        walletApiStatus: document.getElementById('walletApiStatus'),
        addBotForm: document.getElementById('addBotForm'),
        botToken: document.getElementById('botToken'),
        botUsername: document.getElementById('botUsername'),
        addBotBtn: document.getElementById('addBotBtn'),
        refreshBotsBtn: document.getElementById('refreshBotsBtn'),
        botsGrid: document.getElementById('botsGrid'),
        refreshLogsBtn: document.getElementById('refreshLogsBtn'),
        logsContainer: document.getElementById('logsContainer'),
        botDetailModal: document.getElementById('botDetailModal'),
        botLogModal: document.getElementById('botLogModal')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        isLoading = show;
    }

    function formatNumber(num) {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatTon(amount) {
        if (!amount) return '0 TON';
        return amount.toFixed(4) + ' TON';
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function fetchAPI(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/fragment${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showToast(error.message, 'error');
            throw error;
        }
    }

    // ==================== LOAD FUNCTIONS ====================
    async function loadStats() {
        try {
            const response = await fetchAPI('/admin/stats');
            if (response.success) {
                if (elements.statTotalBots) {
                    elements.statTotalBots.textContent = formatNumber(response.stats.total_bots);
                }
                if (elements.statRunningBots) {
                    elements.statRunningBots.textContent = formatNumber(response.stats.running_bots);
                }
                if (elements.statTotalUsers) {
                    elements.statTotalUsers.textContent = formatNumber(response.stats.total_users);
                }
                if (elements.statTotalStars) {
                    elements.statTotalStars.textContent = formatNumber(response.stats.total_stars);
                }
                if (elements.statTotalVolume) {
                    elements.statTotalVolume.textContent = formatTon(response.stats.total_volume);
                }
                if (elements.statWalletBalance) {
                    elements.statWalletBalance.textContent = formatTon(response.stats.wallet_balance);
                }
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async function loadStatus() {
        try {
            const response = await fetchAPI('/status');
            if (response.success) {
                if (elements.fragmentApiStatus) {
                    elements.fragmentApiStatus.textContent = response.status.fragment_ok ? '✅ Online' : '❌ Offline';
                    elements.fragmentApiStatus.className = `status-value ${response.status.fragment_ok ? 'online' : 'offline'}`;
                }
                if (elements.walletApiStatus) {
                    elements.walletApiStatus.textContent = response.status.wallet_ok ? '✅ Online' : '❌ Offline';
                    elements.walletApiStatus.className = `status-value ${response.status.wallet_ok ? 'online' : 'offline'}`;
                }
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    async function loadBots() {
        try {
            const response = await fetchAPI('/bots');
            if (response.success) {
                allBots = response.bots;
                renderBotsGrid();
            }
        } catch (error) {
            console.error('Failed to load bots:', error);
            renderBotsGrid(true);
        }
    }

    function renderBotsGrid(error = false) {
        if (!elements.botsGrid) return;
        
        if (error) {
            elements.botsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat daftar bot</p>
                </div>
            `;
            return;
        }
        
        if (!allBots || allBots.length === 0) {
            elements.botsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>Belum ada bot clone</p>
                    <small>Gunakan form di atas untuk clone bot baru</small>
                </div>
            `;
            return;
        }
        
        let html = '';
        allBots.forEach(bot => {
            const statusClass = bot.status === 'running' ? 'status-running' : 
                               bot.status === 'stopped' ? 'status-stopped' : 'status-error';
            const statusText = bot.status === 'running' ? 'Running' : 
                              bot.status === 'stopped' ? 'Stopped' : 'Error';
            
            html += `
                <div class="bot-card" data-bot-id="${bot.id}">
                    <div class="bot-header">
                        <div class="bot-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="bot-info">
                            <div class="bot-name">${escapeHtml(bot.bot_name || 'Fragment Bot')}</div>
                            <div class="bot-username">@${escapeHtml(bot.bot_username || 'unknown')}</div>
                        </div>
                        <div>
                            <span class="bot-status-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="bot-stats">
                        <div class="bot-stat">
                            <span class="bot-stat-value">${formatNumber(bot.total_users || 0)}</span>
                            <span class="bot-stat-label">Users</span>
                        </div>
                        <div class="bot-stat">
                            <span class="bot-stat-value">${formatNumber(bot.total_purchases || 0)}</span>
                            <span class="bot-stat-label">Purchases</span>
                        </div>
                        <div class="bot-stat">
                            <span class="bot-stat-value">${formatNumber(bot.total_stars || 0)}</span>
                            <span class="bot-stat-label">Stars</span>
                        </div>
                    </div>
                    <div class="bot-actions">
                        ${bot.status !== 'running' ? 
                            `<button class="bot-action-btn start" onclick="window.frag.startBot(${bot.id})">
                                <i class="fas fa-play"></i> Start
                            </button>` : 
                            `<button class="bot-action-btn stop" onclick="window.frag.stopBot(${bot.id})">
                                <i class="fas fa-stop"></i> Stop
                            </button>`
                        }
                        <button class="bot-action-btn detail" onclick="window.frag.showBotDetail(${bot.id})">
                            <i class="fas fa-info-circle"></i> Detail
                        </button>
                        <button class="bot-action-btn log" onclick="window.frag.showBotLogs(${bot.id})">
                            <i class="fas fa-scroll"></i> Logs
                        </button>
                        <button class="bot-action-btn delete" onclick="window.frag.deleteBot(${bot.id})">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.botsGrid.innerHTML = html;
    }

    async function loadLogs() {
        try {
            const response = await fetchAPI('/logs/recent?limit=30');
            if (response.success) {
                renderLogs(response.logs);
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }

    function renderLogs(logs) {
        if (!elements.logsContainer) return;
        
        if (!logs || logs.length === 0) {
            elements.logsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Belum ada log aktivitas</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        logs.forEach(log => {
            const levelClass = log.log_level === 'INFO' ? 'INFO' :
                              log.log_level === 'WARNING' ? 'WARNING' : 'ERROR';
            
            html += `
                <div class="log-item">
                    <span class="log-time">${formatDate(log.timestamp)}</span>
                    <span class="log-level ${levelClass}">${log.log_level}</span>
                    <span class="log-message">${escapeHtml(log.message)}</span>
                </div>
            `;
        });
        
        elements.logsContainer.innerHTML = html;
    }

    // ==================== BOT ACTIONS ====================
    async function addBot() {
        const token = elements.botToken?.value.trim();
        const username = elements.botUsername?.value.trim();
        
        if (!token) {
            showToast('Masukkan Bot Token', 'warning');
            return;
        }
        
        if (!token.includes(':')) {
            showToast('Format Bot Token tidak valid', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchAPI('/bots/add', {
                method: 'POST',
                body: JSON.stringify({
                    bot_token: token,
                    bot_username: username || null
                })
            });
            
            if (response.success) {
                showToast(`✅ Bot ${response.bot_username} berhasil di-clone!`, 'success');
                elements.botToken.value = '';
                elements.botUsername.value = '';
                await Promise.all([loadBots(), loadStats(), loadLogs()]);
            } else {
                showToast(response.error || 'Gagal menambah bot', 'error');
            }
        } catch (error) {
            console.error('Add bot error:', error);
        } finally {
            showLoading(false);
        }
    }

    async function startBot(botId) {
        showLoading(true);
        
        try {
            const response = await fetchAPI(`/bots/${botId}/start`, {
                method: 'POST'
            });
            
            if (response.success) {
                showToast(`✅ Bot ${response.bot_username} berhasil dijalankan`, 'success');
                await Promise.all([loadBots(), loadStats(), loadLogs()]);
            } else {
                showToast(response.error || 'Gagal menjalankan bot', 'error');
            }
        } catch (error) {
            console.error('Start bot error:', error);
        } finally {
            showLoading(false);
        }
    }

    async function stopBot(botId) {
        if (!confirm('Yakin ingin menghentikan bot ini?')) return;
        
        showLoading(true);
        
        try {
            const response = await fetchAPI(`/bots/${botId}/stop`, {
                method: 'POST'
            });
            
            if (response.success) {
                showToast(`✅ Bot ${response.bot_username} berhasil dihentikan`, 'success');
                await Promise.all([loadBots(), loadStats(), loadLogs()]);
            } else {
                showToast(response.error || 'Gagal menghentikan bot', 'error');
            }
        } catch (error) {
            console.error('Stop bot error:', error);
        } finally {
            showLoading(false);
        }
    }

    async function deleteBot(botId) {
        const bot = allBots.find(b => b.id === botId);
        if (!confirm(`Yakin ingin menghapus bot @${bot?.bot_username || botId}?`)) return;
        
        showLoading(true);
        
        try {
            const response = await fetchAPI(`/bots/${botId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                showToast(`✅ Bot berhasil dihapus`, 'success');
                await Promise.all([loadBots(), loadStats(), loadLogs()]);
            } else {
                showToast(response.error || 'Gagal menghapus bot', 'error');
            }
        } catch (error) {
            console.error('Delete bot error:', error);
        } finally {
            showLoading(false);
        }
    }

    async function showBotDetail(botId) {
        const bot = allBots.find(b => b.id === botId);
        if (!bot) return;
        
        const modalBody = document.getElementById('botDetailBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Informasi Bot</h4>
                <div class="detail-row">
                    <span class="detail-label">ID:</span>
                    <span class="detail-value">#${bot.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Nama:</span>
                    <span class="detail-value">${escapeHtml(bot.bot_name || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Username:</span>
                    <span class="detail-value">@${escapeHtml(bot.bot_username || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${bot.status === 'running' ? '🟢 Running' : bot.status === 'stopped' ? '🔴 Stopped' : '🟡 Error'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Dibuat:</span>
                    <span class="detail-value">${formatDate(bot.created_at)}</span>
                </div>
                ${bot.last_started ? `
                <div class="detail-row">
                    <span class="detail-label">Terakhir Start:</span>
                    <span class="detail-value">${formatDate(bot.last_started)}</span>
                </div>
                ` : ''}
                ${bot.last_stopped ? `
                <div class="detail-row">
                    <span class="detail-label">Terakhir Stop:</span>
                    <span class="detail-value">${formatDate(bot.last_stopped)}</span>
                </div>
                ` : ''}
                ${bot.pid ? `
                <div class="detail-row">
                    <span class="detail-label">PID:</span>
                    <span class="detail-value">${bot.pid}</span>
                </div>
                ` : ''}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-chart-bar"></i> Statistik</h4>
                <div class="detail-row">
                    <span class="detail-label">Total Users:</span>
                    <span class="detail-value">${formatNumber(bot.total_users || 0)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Pembelian:</span>
                    <span class="detail-value">${formatNumber(bot.total_purchases || 0)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Stars:</span>
                    <span class="detail-value">${formatNumber(bot.total_stars || 0)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Volume:</span>
                    <span class="detail-value">${formatTon(bot.total_volume || 0)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Hari Ini:</span>
                    <span class="detail-value">${formatNumber(bot.today_purchases || 0)} pembelian (${formatNumber(bot.today_stars || 0)} stars)</span>
                </div>
            </div>
        `;
        
        document.getElementById('modalBotName').textContent = bot.bot_name || 'Detail Bot';
        
        if (elements.botDetailModal) {
            elements.botDetailModal.classList.add('active');
            
            const closeBtn = elements.botDetailModal.querySelector('.modal-close');
            const closeModalBtn = document.getElementById('closeModalBtn');
            
            const closeModal = () => elements.botDetailModal.classList.remove('active');
            if (closeBtn) closeBtn.onclick = closeModal;
            if (closeModalBtn) closeModalBtn.onclick = closeModal;
            
            elements.botDetailModal.addEventListener('click', (e) => {
                if (e.target === elements.botDetailModal) closeModal();
            });
        }
    }

    async function showBotLogs(botId) {
        const bot = allBots.find(b => b.id === botId);
        if (!bot) return;
        
        showLoading(true);
        
        try {
            const response = await fetchAPI(`/bots/${botId}/logs?limit=50`);
            
            const modalBody = document.getElementById('botLogBody');
            if (!modalBody) return;
            
            if (response.success && response.logs && response.logs.length > 0) {
                let logsHtml = '';
                response.logs.forEach(log => {
                    const levelClass = log.log_level === 'INFO' ? 'INFO' :
                                      log.log_level === 'WARNING' ? 'WARNING' : 'ERROR';
                    logsHtml += `
                        <div class="log-item">
                            <span class="log-time">${formatDate(log.timestamp)}</span>
                            <span class="log-level ${levelClass}">${log.log_level}</span>
                            <span class="log-message">${escapeHtml(log.message)}</span>
                        </div>
                    `;
                });
                modalBody.innerHTML = logsHtml;
            } else {
                modalBody.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-scroll"></i>
                        <p>Belum ada log untuk bot ini</p>
                    </div>
                `;
            }
            
            document.getElementById('logModalTitle').textContent = `Log Bot @${bot.bot_username || bot.bot_name}`;
            
            if (elements.botLogModal) {
                elements.botLogModal.classList.add('active');
                
                const closeBtn = elements.botLogModal.querySelector('.modal-close');
                const closeModalBtn = document.getElementById('closeLogModalBtn');
                
                const closeModal = () => elements.botLogModal.classList.remove('active');
                if (closeBtn) closeBtn.onclick = closeModal;
                if (closeModalBtn) closeModalBtn.onclick = closeModal;
                
                elements.botLogModal.addEventListener('click', (e) => {
                    if (e.target === elements.botLogModal) closeModal();
                });
            }
        } catch (error) {
            console.error('Show logs error:', error);
            showToast('Gagal memuat log', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        if (elements.addBotForm) {
            elements.addBotForm.addEventListener('submit', (e) => {
                e.preventDefault();
                addBot();
            });
        }
        
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', async () => {
                showToast('Memuat ulang data...', 'info');
                await Promise.all([loadStats(), loadStatus(), loadBots(), loadLogs()]);
                showToast('Data berhasil dimuat ulang', 'success');
            });
        }
        
        if (elements.refreshBotsBtn) {
            elements.refreshBotsBtn.addEventListener('click', loadBots);
        }
        
        if (elements.refreshLogsBtn) {
            elements.refreshLogsBtn.addEventListener('click', loadLogs);
        }
        
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (elements.botDetailModal?.classList.contains('active')) {
                    elements.botDetailModal.classList.remove('active');
                }
                if (elements.botLogModal?.classList.contains('active')) {
                    elements.botLogModal.classList.remove('active');
                }
            }
        });
    }

    // ==================== LOAD USER DATA ====================
    async function loadUserData() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const user = window.Telegram.WebApp.initDataUnsafe.user;
            currentUser = user;
            
            if (elements.userAvatar) {
                elements.userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=Admin&size=40&background=40a7e3&color=fff`;
            }
            
            window.Telegram.WebApp.expand();
            window.Telegram.WebApp.ready();
        }
    }

    // ==================== INIT ====================
    async function init() {
        showLoading(true);
        
        try {
            await loadUserData();
            await Promise.all([
                loadStats(),
                loadStatus(),
                loadBots(),
                loadLogs()
            ]);
            setupEventListeners();
            console.log('✅ Fragment Bot Admin Panel initialized');
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat panel admin', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    init();
    
    // Expose global functions
    window.frag = {
        startBot,
        stopBot,
        deleteBot,
        showBotDetail,
        showBotLogs
    };
})();
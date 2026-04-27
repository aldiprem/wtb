// js/panel.js - ScamAction Panel JavaScript

// Telegram WebApp initialization
const tg = window.Telegram?.WebApp;
let currentUserId = null;
let currentMonitorChatId = null;

// Initialize Telegram WebApp
if (tg) {
    tg.expand();
    tg.ready();
    if (tg.initDataUnsafe?.user) {
        currentUserId = tg.initDataUnsafe.user.id;
        document.getElementById('userId').textContent = currentUserId;
        document.getElementById('userName').textContent = 
            tg.initDataUnsafe.user.first_name + ' ' + (tg.initDataUnsafe.user.last_name || '');
    }
}

// State
let currentPage = 'dashboard';

// DOM Elements
const pages = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('pageTitle');
const refreshBtn = document.getElementById('refreshBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        switchPage(page);
    });
});

function switchPage(page) {
    currentPage = page;
    
    // Update active nav
    navItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update active page
    pages.forEach(p => {
        if (p.id === `${page}-page`) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        channels: 'Scan Channels',
        scanned: 'Scanned IDs',
        monitors: 'Monitor',
        reports: 'Laporan',
        alerts: 'Alert Logs',
        users: 'Users'
    };
    pageTitle.textContent = titles[page] || page;
    
    // Load page data
    loadPageData(page);
}

// Load data based on page
function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'channels':
            loadChannels();
            break;
        case 'scanned':
            loadScannedIds();
            break;
        case 'monitors':
            loadMonitors();
            break;
        case 'reports':
            loadReports();
            break;
        case 'alerts':
            loadAlerts();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/scamaction/api/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            document.getElementById('totalScammers').textContent = stats.total_scanned_ids || 0;
            document.getElementById('totalScanChannels').textContent = stats.total_scan_channels || 0;
            document.getElementById('totalMonitorActive').textContent = stats.total_monitor_channels || 0;
            document.getElementById('totalAlerts').textContent = stats.total_alerts || 0;
            document.getElementById('totalReports').textContent = stats.total_reports || 0;
            
            // Load users count separately
            const usersRes = await fetch('/scamaction/api/users');
            const usersResult = await usersRes.json();
            if (usersResult.success) {
                document.getElementById('totalUsers').textContent = usersResult.data.length;
            }
        }
        
        // Load recent alerts
        const alertsRes = await fetch('/scamaction/api/alerts');
        const alertsResult = await alertsRes.json();
        if (alertsResult.success) {
            const alerts = alertsResult.data.slice(0, 10);
            const tbody = document.getElementById('recentAlertsBody');
            if (alerts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No alerts</td></tr>';
            } else {
                tbody.innerHTML = alerts.map(alert => `
                    <tr>
                        <td>${alert.user_id}</td>
                        <td>${alert.chat_name || '-'}</td>
                        <td>${new Date(alert.triggered_at).toLocaleString()}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Channels
async function loadChannels() {
    try {
        const response = await fetch('/scamaction/api/channels');
        const result = await response.json();
        
        const tbody = document.getElementById('channelsBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No channels</td></tr>';
            return;
        }
        
        tbody.innerHTML = result.data.map(ch => `
            <tr>
                <td>${ch.channel_id}</td>
                <td>${ch.channel_name || '-'}</td>
                <td>${ch.username ? '@' + ch.username : '-'}</td>
                <td>${new Date(ch.added_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteChannel(${ch.channel_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

async function deleteChannel(channelId) {
    if (!confirm('Hapus channel ini?')) return;
    
    try {
        const response = await fetch(`/scamaction/api/channels/${channelId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            loadChannels();
        } else {
            alert('Gagal menghapus channel');
        }
    } catch (error) {
        console.error('Error deleting channel:', error);
    }
}

// Add Channel Modal
document.getElementById('addChannelBtn')?.addEventListener('click', () => {
    document.getElementById('addChannelModal').classList.add('active');
});

document.getElementById('saveChannelBtn')?.addEventListener('click', async () => {
    const channelId = document.getElementById('channelIdInput').value;
    const channelName = document.getElementById('channelNameInput').value;
    const username = document.getElementById('channelUsernameInput').value;
    
    if (!channelId) {
        alert('Channel ID required');
        return;
    }
    
    try {
        const response = await fetch('/scamaction/api/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel_id: parseInt(channelId),
                channel_name: channelName,
                username: username.replace('@', '')
            })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('addChannelModal').classList.remove('active');
            document.getElementById('channelIdInput').value = '';
            document.getElementById('channelNameInput').value = '';
            document.getElementById('channelUsernameInput').value = '';
            loadChannels();
        } else {
            alert('Gagal menambahkan channel');
        }
    } catch (error) {
        console.error('Error adding channel:', error);
    }
});

document.getElementById('resetChannelsBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset semua channel scan?')) return;
    
    try {
        const response = await fetch('/scamaction/api/channels/reset', {
            method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
            loadChannels();
        }
    } catch (error) {
        console.error('Error resetting channels:', error);
    }
});

// Scanned IDs
async function loadScannedIds(search = '') {
    try {
        const response = await fetch('/scamaction/api/scanned');
        const result = await response.json();
        
        const tbody = document.getElementById('scannedBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center">No scanned IDs</td></tr>';
            return;
        }
        
        let ids = result.data;
        if (search) {
            ids = ids.filter(id => id.toString().includes(search));
        }
        
        tbody.innerHTML = ids.map(userId => `
            <tr>
                <td>${userId}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewScammerDetail(${userId})">
                        <i class="fas fa-eye"></i> Detail
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading scanned IDs:', error);
    }
}

document.getElementById('searchUserId')?.addEventListener('input', (e) => {
    loadScannedIds(e.target.value);
});

async function viewScammerDetail(userId) {
    try {
        const response = await fetch(`/scamaction/api/scanned/${userId}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('detailUserId').textContent = userId;
            const refsList = document.getElementById('referencesList');
            
            if (result.data.length === 0) {
                refsList.innerHTML = '<p>Tidak ada referensi</p>';
            } else {
                refsList.innerHTML = result.data.map(ref => `
                    <div class="reference-item">
                        <span>${ref.channel_name || ref.channel_id}</span>
                        <a href="https://t.me/c/${String(ref.channel_id).replace('-100', '')}/${ref.msg_id}" target="_blank">
                            Lihat Pesan #${ref.msg_id}
                        </a>
                    </div>
                `).join('');
            }
            
            document.getElementById('scammerDetailModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading scammer detail:', error);
    }
}

// Monitors
async function loadMonitors() {
    try {
        const url = currentUserId ? `/scamaction/api/monitor?added_by=${currentUserId}` : '/scamaction/api/monitor';
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.getElementById('monitorsBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No monitors</td></tr>';
            return;
        }
        
        tbody.innerHTML = result.data.map(mon => `
            <tr>
                <td>${mon.chat_id}</td>
                <td>${mon.chat_name || '-'}</td>
                <td class="${mon.is_active ? 'status-active' : 'status-inactive'}">
                    ${mon.is_active ? 'Active' : 'Inactive'}
                </td>
                <td>${mon.added_by}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewMonitorDetail(${mon.chat_id})">
                        <i class="fas fa-cog"></i> Manage
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading monitors:', error);
    }
}

async function viewMonitorDetail(chatId) {
    currentMonitorChatId = chatId;
    
    try {
        const response = await fetch(`/scamaction/api/monitor/${chatId}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('monitorDetailTitle').textContent = `Monitor: ${data.chat_name}`;
            document.getElementById('monitorChatId').textContent = data.chat_id;
            document.getElementById('monitorChatName').textContent = data.chat_name || '-';
            document.getElementById('monitorChatUsername').textContent = data.chat_username ? '@' + data.chat_username : '-';
            document.getElementById('monitorStatus').textContent = data.is_active ? 'Active' : 'Inactive';
            document.getElementById('monitorAddedBy').textContent = data.added_by;
            
            // Load admins
            loadAdmins(chatId);
            
            document.getElementById('monitorDetailModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading monitor detail:', error);
    }
}

async function loadAdmins(chatId) {
    try {
        const response = await fetch(`/scamaction/api/monitor/${chatId}/admins`);
        const result = await response.json();
        
        const adminList = document.getElementById('adminList');
        if (!result.success || result.data.length === 0) {
            adminList.innerHTML = '<p>Tidak ada admin</p>';
            return;
        }
        
        adminList.innerHTML = result.data.map(admin => `
            <div class="admin-item">
                <span>User ID: ${admin.user_id}</span>
                <button onclick="removeAdmin(${chatId}, ${admin.user_id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

async function removeAdmin(chatId, userId) {
    try {
        const response = await fetch(`/scamaction/api/monitor/${chatId}/admins/${userId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            loadAdmins(chatId);
        }
    } catch (error) {
        console.error('Error removing admin:', error);
    }
}

document.getElementById('toggleMonitorBtn')?.addEventListener('click', async () => {
    if (!currentMonitorChatId) return;
    
    try {
        const response = await fetch(`/scamaction/api/monitor/${currentMonitorChatId}/toggle`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
            viewMonitorDetail(currentMonitorChatId);
            loadMonitors();
        }
    } catch (error) {
        console.error('Error toggling monitor:', error);
    }
});

document.getElementById('addAdminBtn')?.addEventListener('click', async () => {
    const userId = document.getElementById('newAdminId').value;
    if (!userId || !currentMonitorChatId) return;
    
    try {
        const response = await fetch(`/scamaction/api/monitor/${currentMonitorChatId}/admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId) })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('newAdminId').value = '';
            loadAdmins(currentMonitorChatId);
        } else {
            alert('Gagal menambahkan admin');
        }
    } catch (error) {
        console.error('Error adding admin:', error);
    }
});

document.getElementById('resetAdminsBtn')?.addEventListener('click', async () => {
    if (!currentMonitorChatId || !confirm('Reset semua admin?')) return;
    
    try {
        const response = await fetch(`/scamaction/api/monitor/${currentMonitorChatId}/admins/reset`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
            loadAdmins(currentMonitorChatId);
        }
    } catch (error) {
        console.error('Error resetting admins:', error);
    }
});

// Reports
async function loadReports() {
    try {
        const url = currentUserId ? `/scamaction/api/reports?user_id=${currentUserId}` : '/scamaction/api/reports';
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.getElementById('reportsBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No reports</td></tr>';
            return;
        }
        
        tbody.innerHTML = result.data.map(report => `
            <tr>
                <td>${report.id}</td>
                <td>${report.user_id}</td>
                <td>${report.status}</td>
                <td>${new Date(report.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// Alerts
async function loadAlerts() {
    try {
        const response = await fetch('/scamaction/api/alerts');
        const result = await response.json();
        
        const tbody = document.getElementById('alertsBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No alerts</td></tr>';
            return;
        }
        
        tbody.innerHTML = result.data.map(alert => `
            <tr>
                <td>${alert.user_id}</td>
                <td>${alert.chat_name || '-'}</td>
                <td>${new Date(alert.triggered_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// Users
async function loadUsers() {
    try {
        const response = await fetch('/scamaction/api/users');
        const result = await response.json();
        
        const tbody = document.getElementById('usersBody');
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users</td></tr>';
            return;
        }
        
        tbody.innerHTML = result.data.map(user => `
            <tr>
                <td>${user.user_id}</td>
                <td>${user.fullname || '-'}</td>
                <td>${user.username ? '@' + user.username : '-'}</td>
                <td>${new Date(user.first_start).toLocaleString()}</td>
                <td>${new Date(user.last_start).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Refresh
refreshBtn.addEventListener('click', () => {
    loadPageData(currentPage);
});

// Modal close handlers
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Menu toggle for mobile
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Initial load
loadDashboard();

// Global functions for inline buttons
window.deleteChannel = deleteChannel;
window.viewScammerDetail = viewScammerDetail;
window.viewMonitorDetail = viewMonitorDetail;
window.removeAdmin = removeAdmin;
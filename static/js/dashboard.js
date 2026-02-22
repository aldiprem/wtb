// ===== DASHBOARD JS - OWNER PANEL =====

// Base URL dari tunnel
const BASE_URL = 'https://formerly-colors-imposed-salem.trycloudflare.com';

// State management
let currentWebsite = null;
let notifications = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeNotifications();
    loadDashboardData();
    setupEventListeners();
});

// ===== SIDEBAR =====
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuItems = document.querySelectorAll('.sidebar-nav a');
    
    // Set active menu based on current URL
    const currentPath = window.location.pathname;
    menuItems.forEach(item => {
        if (item.getAttribute('href') === currentPath) {
            item.classList.add('active');
        }
    });
    
    // Toggle sidebar on mobile
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    if (window.innerWidth <= 768) {
        document.querySelector('.content-header').prepend(menuToggle);
    }
}

// ===== NOTIFICATIONS =====
function initializeNotifications() {
    const notificationBtn = document.querySelector('.notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', showNotifications);
    }
    
    // Fetch notifications periodically
    fetchNotifications();
    setInterval(fetchNotifications, 30000); // Every 30 seconds
}

async function fetchNotifications() {
    try {
        const response = await fetch(`${BASE_URL}/api/owner/notifications`);
        const data = await response.json();
        
        if (data.success) {
            notifications = data.notifications;
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        const unread = notifications.filter(n => !n.read).length;
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function showNotifications() {
    // Create modal for notifications
    const modal = createModal({
        title: 'Notifikasi',
        content: `
            <div class="notifications-list">
                ${notifications.length ? notifications.map(n => `
                    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                        <div class="notification-icon">
                            <i class="fas ${n.icon || 'fa-bell'}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-title">${n.title}</div>
                            <div class="notification-message">${n.message}</div>
                            <div class="notification-time">${formatTime(n.created_at)}</div>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-gray-500">Tidak ada notifikasi</p>'}
            </div>
        `,
        actions: [
            {
                label: 'Tandai Semua Dibaca',
                class: 'btn-secondary',
                onClick: markAllNotificationsRead
            }
        ]
    });
    
    modal.classList.add('active');
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch(`${BASE_URL}/api/owner/notifications/read-all`, {
            method: 'POST'
        });
        
        if (response.ok) {
            notifications.forEach(n => n.read = true);
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
}

// ===== DASHBOARD DATA =====
async function loadDashboardData() {
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/api/owner/dashboard`);
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.stats);
            updateRecentWebsites(data.recent_websites);
            updateCharts(data.charts);
        }
    } catch (error) {
        showAlert('Gagal memuat data dashboard', 'danger');
        console.error('Error loading dashboard data:', error);
    } finally {
        hideLoading();
    }
}

function updateStats(stats) {
    // Update stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
        const type = card.dataset.stat;
        if (type && stats[type]) {
            const valueEl = card.querySelector('.stat-value');
            const changeEl = card.querySelector('.stat-change');
            
            if (valueEl) valueEl.textContent = stats[type].value;
            if (changeEl) {
                const change = stats[type].change;
                changeEl.innerHTML = `
                    <i class="fas fa-arrow-${change > 0 ? 'up' : 'down'}"></i>
                    ${Math.abs(change)}% dari bulan lalu
                `;
                changeEl.className = `stat-change ${change > 0 ? 'positive' : 'negative'}`;
            }
        }
    });
}

function updateRecentWebsites(websites) {
    const tbody = document.querySelector('#recent-websites tbody');
    if (!tbody) return;
    
    if (!websites || websites.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500">
                    <i class="fas fa-globe text-4xl mb-3 text-gray-300"></i>
                    <p>Belum ada website</p>
                    <a href="/owner/websites/create" class="inline-block mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">
                        Buat Website
                    </a>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = websites.map(website => `
        <tr>
            <td class="py-3 px-4">
                <div class="font-medium">${escapeHtml(website.name)}</div>
                <div class="text-sm text-gray-600">${escapeHtml(website.description || '').substring(0, 50)}</div>
            </td>
            <td class="py-3 px-4">
                <code class="bg-gray-100 px-2 py-1 rounded text-sm">${escapeHtml(website.endpoint)}</code>
            </td>
            <td class="py-3 px-4">${website.products_count || 0}</td>
            <td class="py-3 px-4">${website.orders_count || 0}</td>
            <td class="py-3 px-4">
                ${website.is_active ? 
                    '<span class="status-badge active">Active</span>' : 
                    '<span class="status-badge inactive">Inactive</span>'}
            </td>
            <td class="py-3 px-4 text-sm">${formatDate(website.created_at)}</td>
            <td class="py-3 px-4">
                <a href="/owner/websites/${website.id}/edit" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </a>
                <a href="/store/${website.endpoint}" target="_blank" class="text-green-600 hover:text-green-800">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </td>
        </tr>
    `).join('');
}

function updateCharts(charts) {
    // This would integrate with a charting library like Chart.js
    console.log('Charts data:', charts);
}

// ===== WEBSITE MANAGEMENT =====
async function createWebsite(formData) {
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/owner/websites/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Website berhasil dibuat!', 'success');
            setTimeout(() => {
                window.location.href = data.redirect;
            }, 1500);
        } else {
            showAlert(data.message || 'Gagal membuat website', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function updateWebsite(id, formData) {
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/owner/websites/${id}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Website berhasil diupdate!', 'success');
        } else {
            showAlert(data.message || 'Gagal mengupdate website', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteWebsite(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus website ini? Semua data akan hilang!')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/owner/websites/${id}/delete`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Website berhasil dihapus!', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showAlert(data.message || 'Gagal menghapus website', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// ===== PRODUCT MANAGEMENT =====
async function loadProducts(websiteId) {
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/api/owner/websites/${websiteId}/products`);
        const products = await response.json();
        
        renderProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Gagal memuat produk', 'danger');
    } finally {
        hideLoading();
    }
}

function renderProducts(products) {
    const container = document.querySelector('#products-container');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-box-open text-5xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Belum ada produk</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-item bg-white rounded-lg p-4 shadow-sm">
            <div class="flex items-center gap-4">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" class="w-16 h-16 object-cover rounded">` : 
                    `<div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                        <i class="fas fa-image text-gray-400"></i>
                    </div>`
                }
                <div class="flex-1">
                    <h4 class="font-semibold">${escapeHtml(product.name)}</h4>
                    <p class="text-sm text-gray-600">${escapeHtml(product.description || '').substring(0, 50)}</p>
                    <div class="flex items-center gap-4 mt-2">
                        <span class="text-purple-600 font-bold">${formatCurrency(product.price)}</span>
                        <span class="text-sm">Stok: ${product.stock}</span>
                        <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                            ${product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editProduct(${product.id})" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== ORDER MANAGEMENT =====
async function updateOrderStatus(orderId, status) {
    showLoading();
    
    try {
        const response = await fetch(`${BASE_URL}/api/owner/orders/${orderId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Status pesanan berhasil diupdate!', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showAlert(data.message || 'Gagal mengupdate status', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// ===== UI HELPERS =====
function showLoading() {
    let loader = document.querySelector('.global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.querySelector('.global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                           type === 'danger' ? 'exclamation-circle' : 
                           'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    const container = document.querySelector('.content-area') || document.body;
    container.prepend(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function createModal({ title, content, actions = [] }) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${actions.length ? `
                <div class="modal-footer">
                    ${actions.map(action => `
                        <button class="${action.class}">${action.label}</button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Close button
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });
    
    // Action buttons
    actions.forEach((action, index) => {
        const btn = modal.querySelectorAll('.modal-footer button')[index];
        if (btn) {
            btn.addEventListener('click', () => {
                action.onClick();
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            });
        }
    });
    
    document.body.appendChild(modal);
    return modal;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // difference in seconds
    
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
    return formatDate(dateString);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Profile dropdown
    const profileDropdown = document.querySelector('.profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', toggleProfileMenu);
    }
    
    // Search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 500);
        });
    }
}

function toggleProfileMenu() {
    // Implement profile dropdown menu
    console.log('Profile menu clicked');
}

async function performSearch(query) {
    if (!query || query.length < 3) return;
    
    try {
        const response = await fetch(`${BASE_URL}/api/owner/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        // Display search results
        console.log('Search results:', results);
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Export functions for use in HTML
window.createWebsite = createWebsite;
window.updateWebsite = updateWebsite;
window.deleteWebsite = deleteWebsite;
window.updateOrderStatus = updateOrderStatus;
window.formatCurrency = formatCurrency;

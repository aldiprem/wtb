// ===== DASHBOARD JS - OWNER PANEL =====
// DETECT ENVIRONMENT - TAMBAHKAN INI DI PALING ATAS
const isFlask = !window.location.hostname.includes('github.io') && 
                !window.location.hostname.includes('127.0.0.1') && 
                window.location.port !== '';
const BASE_URL = isFlask ? '' : 'https://aldiprem.github.io/wtb';

console.log('Dashboard JS running in', isFlask ? 'Flask' : 'GitHub Pages', 'mode');
console.log('BASE_URL:', BASE_URL);

// State management
let currentWebsite = null;
let notifications = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard JS initialized');
    initializeSidebar();
    initializeNotifications();
    loadDashboardData();
    setupEventListeners();
});

// ===== SIDEBAR =====
function initializeSidebar() {
    console.log('Initializing sidebar');
    const sidebar = document.querySelector('.sidebar');
    const menuItems = document.querySelectorAll('.sidebar-nav a');
    
    // Set active menu based on current URL
    const currentPath = window.location.pathname;
    menuItems.forEach(item => {
        const href = item.getAttribute('href');
        // Untuk Flask, href bisa berupa url_for yang sudah diproses
        if (href === currentPath || currentPath.includes(href)) {
            item.classList.add('active');
        }
    });
    
    // Toggle sidebar on mobile
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    menuToggle.style.cssText = 'background: none; border: none; font-size: 1.5rem; color: var(--gray); cursor: pointer; margin-right: 1rem;';
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    if (window.innerWidth <= 768) {
        const header = document.querySelector('.content-header');
        if (header) {
            header.insertBefore(menuToggle, header.firstChild);
        }
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
        if (isFlask) {
            // Di Flask, panggil API real
            const response = await fetch(`/api/owner/notifications`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    notifications = data.notifications;
                    updateNotificationBadge();
                }
            }
        } else {
            // Di GitHub Pages, gunakan mock data
            notifications = [];
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error fetching notifications:', error);
        // Fallback ke mock data
        notifications = [];
        updateNotificationBadge();
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
                    <div class="notification-item ${n.read ? '' : 'unread'}" style="padding: 1rem; border-bottom: 1px solid #f3f4f6; display: flex; gap: 1rem;">
                        <div class="notification-icon" style="width: 40px; height: 40px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${n.icon || 'fa-bell'}" style="color: var(--primary);"></i>
                        </div>
                        <div class="notification-content" style="flex: 1;">
                            <div class="notification-title" style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(n.title)}</div>
                            <div class="notification-message" style="color: var(--gray); font-size: 0.9rem; margin-bottom: 0.25rem;">${escapeHtml(n.message)}</div>
                            <div class="notification-time" style="color: var(--gray); font-size: 0.8rem;">${formatTime(n.created_at)}</div>
                        </div>
                    </div>
                `).join('') : '<p class="text-center" style="color: var(--gray); padding: 2rem;">Tidak ada notifikasi</p>'}
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
        if (isFlask) {
            const response = await fetch(`/api/owner/notifications/read-all`, {
                method: 'POST'
            });
            
            if (response.ok) {
                notifications.forEach(n => n.read = true);
                updateNotificationBadge();
                showAlert('Semua notifikasi telah ditandai dibaca', 'success');
            }
        } else {
            notifications.forEach(n => n.read = true);
            updateNotificationBadge();
            showAlert('Semua notifikasi telah ditandai dibaca (mock)', 'success');
        }
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        showAlert('Gagal menandai notifikasi', 'danger');
    }
}

// ===== DASHBOARD DATA =====
async function loadDashboardData() {
    showLoading();
    
    try {
        if (isFlask) {
            const response = await fetch(`/api/owner/dashboard`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    updateStats(data.stats);
                    updateRecentWebsites(data.recent_websites);
                    updateCharts(data.charts);
                }
            }
        } else {
            // Mock data for GitHub Pages - ambil dari HTML
            console.log('Using static data from HTML');
            const stats = {
                websites: { value: document.querySelector('[data-stat="websites"] .stat-value')?.textContent || '0', change: 12 },
                products: { value: document.querySelector('[data-stat="products"] .stat-value')?.textContent || '0', change: 8 },
                orders: { value: document.querySelector('[data-stat="orders"] .stat-value')?.textContent || '0', change: 23 },
                customers: { value: document.querySelector('[data-stat="customers"] .stat-value')?.textContent || '0', change: 5 }
            };
            updateStats(stats);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Gagal memuat data dashboard', 'danger');
    } finally {
        hideLoading();
    }
}

function updateStats(stats) {
    document.querySelectorAll('.stat-card').forEach(card => {
        const type = card.dataset.stat;
        if (type && stats[type]) {
            const valueEl = card.querySelector('.stat-value');
            const changeEl = card.querySelector('.stat-change');
            
            if (valueEl && stats[type].value) {
                valueEl.textContent = stats[type].value;
            }
            
            if (changeEl) {
                const change = stats[type].change || 0;
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
        return; // Keep existing HTML
    }
    
    tbody.innerHTML = websites.map(website => `
        <tr>
            <td class="py-3 px-4">
                <div class="font-medium">${escapeHtml(website.name)}</div>
                <div class="text-sm" style="color: var(--gray);">${escapeHtml(website.description || '').substring(0, 50)}</div>
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
    console.log('Charts data:', charts);
}

// ===== WEBSITE MANAGEMENT =====
async function createWebsite(formData) {
    showLoading();
    
    try {
        // PERBAIKAN: Gunakan path yang benar untuk API
        const url = isFlask ? '/owner/websites/create' : `${BASE_URL}/owner/websites/create`;
        
        const response = await fetch(url, {
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
        console.error('Create website error:', error);
    } finally {
        hideLoading();
    }
}

async function updateWebsite(id, formData) {
    showLoading();
    
    try {
        const url = isFlask ? `/owner/websites/${id}/edit` : `${BASE_URL}/owner/websites/${id}/edit`;
        
        const response = await fetch(url, {
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
        const url = isFlask ? `/owner/websites/${id}/delete` : `${BASE_URL}/owner/websites/${id}/delete`;
        
        const response = await fetch(url, {
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
        const url = isFlask ? `/api/owner/websites/${websiteId}/products` : `${BASE_URL}/api/owner/websites/${websiteId}/products`;
        
        const response = await fetch(url);
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
                <i class="fas fa-box-open text-5xl" style="color: var(--gray); opacity: 0.5; margin-bottom: 1rem;"></i>
                <p style="color: var(--gray);">Belum ada produk</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-item" style="background: white; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px;">` : 
                    `<div style="width: 64px; height: 64px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-image" style="color: var(--gray);"></i>
                    </div>`
                }
                <div style="flex: 1;">
                    <h4 style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(product.name)}</h4>
                    <p style="font-size: 0.9rem; color: var(--gray); margin-bottom: 0.5rem;">${escapeHtml(product.description || '').substring(0, 50)}</p>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="color: var(--primary); font-weight: 600;">${formatCurrency(product.price)}</span>
                        <span style="font-size: 0.9rem;">Stok: ${product.stock}</span>
                        <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                            ${product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editProduct(${product.id})" style="background: none; border: none; color: #2563eb; cursor: pointer;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct(${product.id})" style="background: none; border: none; color: #dc2626; cursor: pointer;">
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
        const url = isFlask ? `/api/owner/orders/${orderId}/status` : `${BASE_URL}/api/owner/orders/${orderId}/status`;
        
        const response = await fetch(url, {
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
        loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: none; align-items: center; justify-content: center; z-index: 9999;';
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
    // Cek apakah alert dengan pesan sama sudah ada
    const existingAlerts = document.querySelectorAll('.alert');
    for (let alert of existingAlerts) {
        if (alert.querySelector('span')?.textContent === message) {
            return; // Jangan duplikasi
        }
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; display: flex; align-items: center; gap: 0.75rem; min-width: 300px; animation: slideIn 0.3s ease;';
    
    let bgColor, textColor, icon;
    switch(type) {
        case 'success':
            bgColor = '#d1fae5';
            textColor = '#059669';
            icon = 'check-circle';
            break;
        case 'danger':
            bgColor = '#fee2e2';
            textColor = '#dc2626';
            icon = 'exclamation-circle';
            break;
        case 'warning':
            bgColor = '#fef3c7';
            textColor = '#d97706';
            icon = 'exclamation-triangle';
            break;
        default:
            bgColor = '#dbeafe';
            textColor = '#2563eb';
            icon = 'info-circle';
    }
    
    alert.style.backgroundColor = bgColor;
    alert.style.color = textColor;
    
    alert.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button style="margin-left: auto; background: none; border: none; color: ${textColor}; cursor: pointer; font-size: 1.2rem;" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.3s';
            setTimeout(() => alert.remove(), 300);
        }
    }, 5000);
}

function createModal({ title, content, actions = [] }) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between;">
                <h3 style="font-size: 1.2rem; font-weight: 600;">${title}</h3>
                <button class="modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                ${content}
            </div>
            ${actions.length ? `
                <div class="modal-footer" style="padding: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem;">
                    ${actions.map(action => `
                        <button class="${action.class}" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; ${action.class === 'btn-primary' ? 'background: var(--primary); color: white;' : 'background: #e5e7eb; color: var(--gray);'}">${action.label}</button>
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
    if (amount === undefined || amount === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return '-';
    }
}

function formatTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // difference in seconds
        
        if (diff < 60) return 'baru saja';
        if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
        return formatDate(dateString);
    } catch (e) {
        return '-';
    }
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
}

function toggleProfileMenu() {
    console.log('Profile menu clicked');
    // Implement profile dropdown menu jika diperlukan
}

// Export functions for use in HTML
window.createWebsite = createWebsite;
window.updateWebsite = updateWebsite;
window.deleteWebsite = deleteWebsite;
window.updateOrderStatus = updateOrderStatus;
window.formatCurrency = formatCurrency;
window.updateStats = updateStats;
window.showAlert = showAlert;

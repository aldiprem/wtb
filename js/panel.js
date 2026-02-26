// panel.js - Panel Dashboard untuk User Website
(function() {
    'use strict';
    
    console.log('📊 Panel Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    
    const SESSION_KEYS = {
      CURRENT_PAGE: 'panel_current_page',
      WEBSITE_ENDPOINT: 'panel_website_endpoint',
      LAST_VISIT: 'panel_last_visit',
      WEBSITE_DATA: 'panel_website_data' // Tambahkan untuk cache data website
    };

    // ==================== STATE ====================
    let currentUser = null;
    let userWebsites = [];
    let allProducts = [];
    let allOrders = [];
    let allCustomers = [];
    let filteredProducts = [];
    let currentProductFilter = 'all';
    let productSearchTerm = '';
    let currentWebsiteEndpoint = null;
    let ptrState = {
      enabled: true,
      pulling: false,
      startY: 0,
      currentY: 0,
      threshold: 80,
      spinner: null,
      container: null
    };

    // ==================== DOM ELEMENTS ====================
    const elements = {
      loadingOverlay: document.getElementById('loadingOverlay'),
      toastContainer: document.getElementById('toastContainer'),
      websiteBadge: document.getElementById('websiteBadge'),
    
      // Header
      menuToggle: document.getElementById('menuToggle'),
      refreshBtn: document.getElementById('refreshBtn'),
      userProfile: document.getElementById('userProfile'),
      userAvatar: document.getElementById('userAvatar'),
    
      // Sidebar
      sidebar: document.getElementById('sidebar'),
      sidebarClose: document.getElementById('sidebarClose'),
      sidebarName: document.getElementById('sidebarName'),
      sidebarUsername: document.getElementById('sidebarUsername'),
      sidebarAvatar: document.getElementById('sidebarAvatar'),
      sidebarTotalWebsites: document.getElementById('sidebarTotalWebsites'),
      sidebarTotalProducts: document.getElementById('sidebarTotalProducts'),
      menuWebsitesBadge: document.getElementById('menuWebsitesBadge'),
      menuOrdersBadge: document.getElementById('menuOrdersBadge'),
      logoutBtn: document.getElementById('logoutBtn'),
    
      // Navigation
      menuItems: document.querySelectorAll('.menu-item'),
      pages: document.querySelectorAll('.page'),
    
      // Dashboard Stats
      statTotalWebsites: document.getElementById('statTotalWebsites'),
      statTotalProducts: document.getElementById('statTotalProducts'),
      statTotalOrders: document.getElementById('statTotalOrders'),
      statTotalRevenue: document.getElementById('statTotalRevenue'),
      statTotalCustomers: document.getElementById('statTotalCustomers'),
      statActiveWebsites: document.getElementById('statActiveWebsites'),
    
      // Quick Actions
      quickActions: document.getElementById('quickActions'),
    
      // Recent Orders
      recentOrders: document.getElementById('recentOrders'),
    
      // Top Products
      topProducts: document.getElementById('topProducts'),
    
      // Websites
      websitesGrid: document.getElementById('websitesGrid'),
      websitesEmptyState: document.getElementById('websitesEmptyState'),
      createWebsiteBtn: document.getElementById('createWebsiteBtn'),
    
      // Products
      productWebsiteSelector: document.getElementById('productWebsiteSelector'),
      manageProductsBtn: document.getElementById('manageProductsBtn'),
      productsSummary: document.getElementById('productsSummary'),
      productsListContainer: document.getElementById('productsListContainer'),
      productsEmptyState: document.getElementById('productsEmptyState'),
    
      // Orders
      orderStatusFilter: document.getElementById('orderStatusFilter'),
      ordersTableBody: document.getElementById('ordersTableBody'),
      ordersEmptyState: document.getElementById('ordersEmptyState'),
    
      // Transactions
      transactionPeriod: document.getElementById('transactionPeriod'),
      transactionTotal: document.getElementById('transactionTotal'),
      transactionCount: document.getElementById('transactionCount'),
      transactionAverage: document.getElementById('transactionAverage'),
      transactionsList: document.getElementById('transactionsList'),
    
      // Customers
      customerSearch: document.getElementById('customerSearch'),
      customersGrid: document.getElementById('customersGrid'),
    
      // Settings Links
      appearanceSettings: document.getElementById('appearanceSettings'),
      socialSettings: document.getElementById('socialSettings'),
      paymentSettings: document.getElementById('paymentSettings'),
      notificationSettings: document.getElementById('notificationSettings'),
      voucherSettings: document.getElementById('voucherSettings'),
      integrationSettings: document.getElementById('integrationSettings')
    };
    
    // ==================== SESSION STORAGE FUNCTIONS ====================
    
    /**
     * Menyimpan halaman aktif ke session storage
     * @param {string} pageId - ID halaman (dashboard, websites, products, dll)
     */
    function saveCurrentPage(pageId) {
        try {
            sessionStorage.setItem(SESSION_KEYS.CURRENT_PAGE, pageId);
            sessionStorage.setItem(SESSION_KEYS.LAST_VISIT, new Date().toISOString());
            console.log(`💾 Session saved: current page = ${pageId}`);
        } catch (e) {
            console.warn('⚠️ Failed to save session:', e);
        }
    }

    /**
     * Mengambil halaman terakhir dari session storage
     * @returns {string|null} pageId atau null jika tidak ada
     */
    function getLastPage() {
        try {
            const page = sessionStorage.getItem(SESSION_KEYS.CURRENT_PAGE);
            return page || null;
        } catch (e) {
            console.warn('⚠️ Failed to load session:', e);
            return null;
        }
    }

    /**
     * Menyimpan endpoint website yang sedang aktif
     * @param {string} endpoint - Endpoint website
     */
    function saveWebsiteEndpoint(endpoint) {
        try {
            sessionStorage.setItem(SESSION_KEYS.WEBSITE_ENDPOINT, endpoint);
        } catch (e) {
            console.warn('⚠️ Failed to save website endpoint:', e);
        }
    }

    /**
     * Mengambil endpoint website terakhir
     * @returns {string|null} endpoint atau null jika tidak ada
     */
    function getLastWebsiteEndpoint() {
        try {
            return sessionStorage.getItem(SESSION_KEYS.WEBSITE_ENDPOINT);
        } catch (e) {
            console.warn('⚠️ Failed to load website endpoint:', e);
            return null;
        }
    }

    /**
     * Menghapus semua session (saat logout)
     */
    function clearSession() {
        try {
            sessionStorage.removeItem(SESSION_KEYS.CURRENT_PAGE);
            sessionStorage.removeItem(SESSION_KEYS.WEBSITE_ENDPOINT);
            sessionStorage.removeItem(SESSION_KEYS.LAST_VISIT);
            console.log('🗑️ Session cleared');
        } catch (e) {
            console.warn('⚠️ Failed to clear session:', e);
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function formatRupiah(angka) {
        if (!angka) return 'Rp 0';
        return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }

    function generateAvatarUrl(name) {
        if (!name) return `https://ui-avatars.com/api/?name=U&size=80&background=40a7e3&color=fff`;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0).toUpperCase())}&size=80&background=40a7e3&color=fff`;
    }

    async function fetchWithRetry(url, options, retries = 2) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Not Found', { cause: '404' });
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.cause === '404' || error.name === 'AbortError') {
                throw error;
            }
            
            if (retries > 0) {
                console.log(`🔄 Retry... ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function loadUserData() {
        let userId = null;
        let userData = null;
        
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            userData = window.Telegram.WebApp.initDataUnsafe.user;
            userId = userData.id;
            
            localStorage.setItem('panel_user', JSON.stringify({
                id: userId,
                first_name: userData.first_name,
                last_name: userData.last_name,
                username: userData.username,
                photo_url: userData.photo_url
            }));
        } else {
            const savedUser = localStorage.getItem('panel_user');
            if (savedUser) {
                userData = JSON.parse(savedUser);
                userId = userData.id;
            } else {
                userData = {
                    id: 123456789,
                    first_name: 'User',
                    last_name: '',
                    username: 'user'
                };
                userId = userData.id;
            }
        }
        
        currentUser = userData;
        
        const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || 'User';
        const username = userData.username ? `@${userData.username}` : '@user';
        
        if (elements.sidebarName) elements.sidebarName.textContent = fullName;
        if (elements.sidebarUsername) elements.sidebarUsername.textContent = username;
        
        const avatarUrl = userData.photo_url || generateAvatarUrl(fullName);
        
        if (elements.userAvatar) elements.userAvatar.src = avatarUrl;
        if (elements.sidebarAvatar) {
            const img = elements.sidebarAvatar.querySelector('img');
            if (img) img.src = avatarUrl;
        }
        
        return userId;
    }

    // ==================== UPDATE FUNGSI LOADPRODUCTSANDORDERS ====================
    async function loadProductsAndOrders() {
      if (!userWebsites || userWebsites.length === 0) return;
    
      showLoading(true);
    
      try {
        let totalProducts = 0;
        let totalOrders = 0;
        let totalRevenue = 0;
        let allOrdersList = [];
        let allProductsList = [];
        let customersSet = new Map();
    
        const batchSize = 2;
        for (let i = 0; i < userWebsites.length; i += batchSize) {
          const batch = userWebsites.slice(i, i + batchSize);
    
          await Promise.all(batch.map(async (website) => {
            try {
              console.log(`📦 Loading products for website ${website.id}...`);
              const productsResponse = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${website.id}`, {
                method: 'GET'
              }).catch(err => {
                console.log(`⚠️ No products for website ${website.id}:`, err.message);
                return { success: false, data: [] };
              });
    
              if (productsResponse.success && productsResponse.data) {
                totalProducts += productsResponse.data.length || 0;
    
                productsResponse.data.forEach(layanan => {
                  if (layanan.aplikasi) {
                    layanan.aplikasi.forEach(aplikasi => {
                      if (aplikasi.items) {
                        aplikasi.items.forEach(item => {
                          allProductsList.push({
                            ...item,
                            website_name: website.endpoint,
                            website_id: website.id,
                            layanan_nama: layanan.layanan_nama,
                            layanan_gambar: layanan.layanan_gambar,
                            layanan_desc: layanan.layanan_desc,
                            aplikasi_nama: aplikasi.aplikasi_nama,
                            aplikasi_gambar: aplikasi.aplikasi_gambar,
                            aplikasi_desc: aplikasi.aplikasi_desc
                          });
                        });
                      }
                    });
                  }
                });
              }
    
              console.log(`📦 Loading orders for website ${website.id}...`);
              try {
                const ordersResponse = await fetchWithRetry(`${API_BASE_URL}/api/orders/website/${website.id}`, {
                  method: 'GET'
                });
    
                if (ordersResponse.success && ordersResponse.orders) {
                  totalOrders += ordersResponse.orders.length;
    
                  ordersResponse.orders.forEach(order => {
                    totalRevenue += order.total || 0;
                    allOrdersList.push({
                      ...order,
                      website_endpoint: website.endpoint
                    });
    
                    if (order.customer_id && !customersSet.has(order.customer_id)) {
                      customersSet.set(order.customer_id, {
                        id: order.customer_id,
                        name: order.customer_name || 'Customer',
                        orders: 1,
                        total_spent: order.total || 0
                      });
                    } else if (order.customer_id) {
                      const customer = customersSet.get(order.customer_id);
                      customer.orders += 1;
                      customer.total_spent += order.total || 0;
                    }
                  });
                }
              } catch (orderError) {
                console.log(`ℹ️ Orders endpoint not available for website ${website.id} (coming soon)`);
              }
    
            } catch (websiteError) {
              console.error(`❌ Error loading data for website:`, website.endpoint, websiteError);
            }
          }));
    
          if (i + batchSize < userWebsites.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
    
        allProducts = allProductsList;
        allOrders = allOrdersList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        allCustomers = Array.from(customersSet.values());
    
        if (elements.statTotalWebsites) {
          elements.statTotalWebsites.textContent = userWebsites.length;
        }
        if (elements.statTotalProducts) {
          elements.statTotalProducts.textContent = totalProducts;
        }
        if (elements.sidebarTotalProducts) {
          elements.sidebarTotalProducts.textContent = totalProducts;
        }
        if (elements.statTotalOrders) {
          elements.statTotalOrders.textContent = totalOrders;
        }
        if (elements.statTotalRevenue) {
          elements.statTotalRevenue.textContent = formatRupiah(totalRevenue);
        }
        if (elements.statTotalCustomers) {
          elements.statTotalCustomers.textContent = allCustomers.length;
        }
        if (elements.menuOrdersBadge) {
          elements.menuOrdersBadge.textContent = totalOrders;
        }
    
        renderQuickActions();
        renderRecentOrders();
        renderTopProducts();
        renderWebsitesGrid();
        renderProductSelector();
        renderOrdersTable();
        renderTransactions(totalRevenue, allOrdersList.length);
        renderCustomersGrid();
    
        // RENDER PRODUK LIST UNTUK HALAMAN PRODUK
        renderProductsList();
    
      } catch (error) {
        console.error('❌ Error loading products and orders:', error);
      } finally {
        showLoading(false);
      }
    }

    function renderQuickActions() {
        if (!elements.quickActions) return;
        
        let html = '';
        
        if (userWebsites.length > 0) {
            userWebsites.slice(0, 4).forEach(website => {
                html += `
                    <a href="/wtb/html/produk.html?website=${website.endpoint}" class="quick-action-card">
                        <i class="fas fa-box"></i>
                        <span>Kelola Produk</span>
                        <small>/${website.endpoint}</small>
                    </a>
                    <a href="/wtb/html/tampilan.html?website=${website.endpoint}" class="quick-action-card">
                        <i class="fas fa-paint-brush"></i>
                        <span>Atur Tampilan</span>
                        <small>/${website.endpoint}</small>
                    </a>
                `;
            });
        } else {
            html = `
                <a href="/wtb/html/format.html" class="quick-action-card">
                    <i class="fas fa-plus-circle"></i>
                    <span>Buat Website Baru</span>
                </a>
            `;
        }
        
        elements.quickActions.innerHTML = html;
    }

    function renderRecentOrders() {
        if (!elements.recentOrders) return;
        
        if (allOrders.length === 0) {
            elements.recentOrders.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Belum ada pesanan</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        const recent = allOrders.slice(0, 5);
        
        recent.forEach(order => {
            const statusClass = `status-${order.status || 'pending'}`;
            const statusText = order.status || 'Pending';
            
            html += `
                <div class="order-item">
                    <div class="order-info">
                        <div class="order-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="order-details">
                            <h4>${escapeHtml(order.customer_name || 'Customer')}</h4>
                            <div class="order-meta">
                                <span><i class="fas fa-tag"></i> ${order.id || 'ORD-' + Math.floor(Math.random() * 1000)}</span>
                                <span><i class="fas fa-globe"></i> ${order.website_endpoint || '-'}</span>
                                <span class="order-status ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="order-amount">${formatRupiah(order.total || 0)}</div>
                </div>
            `;
        });
        
        elements.recentOrders.innerHTML = html;
    }

    function renderTopProducts() {
        if (!elements.topProducts) return;
        
        if (allProducts.length === 0) {
            elements.topProducts.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-box"></i>
                    <p>Belum ada produk</p>
                </div>
            `;
            return;
        }
        
        const top = allProducts.slice(0, 4);
        
        let html = '';
        top.forEach(product => {
            html += `
                <div class="top-product-card">
                    <div class="product-image">
                        <img src="${product.item_gambar || 'https://via.placeholder.com/120x120/40a7e3/ffffff?text=Product'}" alt="${escapeHtml(product.item_nama)}" onerror="this.src='https://via.placeholder.com/120x120/40a7e3/ffffff?text=Product';">
                    </div>
                    <div class="product-info">
                        <h4>${escapeHtml(product.item_nama || 'Produk')}</h4>
                        <div class="product-category">${escapeHtml(product.layanan_nama || '')} / ${escapeHtml(product.aplikasi_nama || '')}</div>
                        <div class="product-stats">
                            <span class="product-sold">
                                <i class="fas fa-shopping-bag"></i> ${product.sold || 0}
                            </span>
                            <span class="product-revenue">${formatRupiah(product.item_harga || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.topProducts.innerHTML = html;
    }

    function renderWebsitesGrid() {
        if (!elements.websitesGrid || !elements.websitesEmptyState) return;
        
        if (userWebsites.length === 0) {
            elements.websitesGrid.innerHTML = '';
            elements.websitesEmptyState.style.display = 'block';
            return;
        }
        
        elements.websitesEmptyState.style.display = 'none';
        
        let html = '';
        
        userWebsites.forEach(website => {
            const status = website.status === 'active' ?
                '<span class="status-badge status-active">Active</span>' :
                '<span class="status-badge status-inactive">Inactive</span>';
            
            html += `
                <div class="website-card">
                    <div class="website-header">
                        <div class="website-icon">
                            <i class="fas fa-globe"></i>
                        </div>
                        <div class="website-info">
                            <h3>${escapeHtml(website.username || 'Website')}</h3>
                            <div class="website-endpoint">
                                <i class="fas fa-link"></i>
                                <span>/${escapeHtml(website.endpoint)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="website-body">
                        <div class="website-stats">
                            <div class="website-stat">
                                <span class="stat-value">0</span>
                                <span class="stat-label">Produk</span>
                            </div>
                            <div class="website-stat">
                                <span class="stat-value">0</span>
                                <span class="stat-label">Pesanan</span>
                            </div>
                        </div>
                        
                        <div class="website-actions">
                            <a href="/wtb/html/produk.html?website=${website.endpoint}" class="website-btn primary">
                                <i class="fas fa-box"></i> Produk
                            </a>
                            <a href="/wtb/html/tampilan.html?website=${website.endpoint}" class="website-btn secondary">
                                <i class="fas fa-paint-brush"></i> Tampilan
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.websitesGrid.innerHTML = html;
    }

    function renderProductSelector() {
        if (!elements.productWebsiteSelector) return;
        
        let options = '<option value="">Pilih Website</option>';
        
        userWebsites.forEach(website => {
            options += `<option value="${website.endpoint}">/${website.endpoint}</option>`;
        });
        
        elements.productWebsiteSelector.innerHTML = options;
        
        elements.productWebsiteSelector.addEventListener('change', (e) => {
            const endpoint = e.target.value;
            if (endpoint) {
                elements.manageProductsBtn.href = `/wtb/html/produk?website=${endpoint}`;
            } else {
                elements.manageProductsBtn.href = '#';
            }
        });
    }

    function renderOrdersTable() {
        if (!elements.ordersTableBody || !elements.ordersEmptyState) return;
        
        if (allOrders.length === 0) {
            elements.ordersTableBody.innerHTML = '';
            elements.ordersEmptyState.style.display = 'block';
            return;
        }
        
        elements.ordersEmptyState.style.display = 'none';
        
        let html = '';
        const filteredOrders = filterOrdersByStatus();
        
        filteredOrders.forEach(order => {
            const statusClass = `status-${order.status || 'pending'}`;
            const statusText = order.status || 'Pending';
            
            html += `
                <tr>
                    <td>#${order.id || 'ORD' + Math.floor(Math.random() * 10000)}</td>
                    <td>${escapeHtml(order.customer_name || 'Customer')}</td>
                    <td>${escapeHtml(order.product_name || '-')}</td>
                    <td>${formatRupiah(order.total || 0)}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>${formatDate(order.created_at)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="table-btn" onclick="window.panel.viewOrder('${order.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="table-btn" onclick="window.panel.updateOrderStatus('${order.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        elements.ordersTableBody.innerHTML = html;
    }

    function filterOrdersByStatus() {
        const filter = elements.orderStatusFilter?.value || 'all';
        
        if (filter === 'all') return allOrders;
        
        return allOrders.filter(order => (order.status || 'pending') === filter);
    }

    function renderTransactions(totalRevenue, totalCount) {
        if (!elements.transactionTotal || !elements.transactionCount || !elements.transactionAverage) return;
        
        elements.transactionTotal.textContent = formatRupiah(totalRevenue);
        elements.transactionCount.textContent = totalCount;
        
        const average = totalCount > 0 ? totalRevenue / totalCount : 0;
        elements.transactionAverage.textContent = formatRupiah(Math.round(average));
        
        if (elements.transactionsList) {
            if (allOrders.length === 0) {
                elements.transactionsList.innerHTML = `
                    <div class="empty-state" style="padding: 40px 20px;">
                        <i class="fas fa-credit-card"></i>
                        <p>Belum ada transaksi</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            allOrders.slice(0, 10).forEach(order => {
                html += `
                    <div class="transaction-item">
                        <div class="transaction-info">
                            <div class="transaction-icon">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div class="transaction-details">
                                <h4>${escapeHtml(order.customer_name || 'Customer')}</h4>
                                <div class="transaction-meta">
                                    <span>${formatDate(order.created_at)}</span>
                                    <span>• ${order.website_endpoint || '-'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="transaction-amount">${formatRupiah(order.total || 0)}</div>
                    </div>
                `;
            });
            
            elements.transactionsList.innerHTML = html;
        }
    }

    function renderCustomersGrid() {
        if (!elements.customersGrid) return;
        
        if (allCustomers.length === 0) {
            elements.customersGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Belum Ada Pelanggan</h3>
                    <p>Pelanggan akan muncul setelah ada pesanan</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        allCustomers.slice(0, 6).forEach(customer => {
            html += `
                <div class="customer-card">
                    <div class="customer-avatar">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name.charAt(0))}&size=56&background=40a7e3&color=fff" alt="${escapeHtml(customer.name)}">
                    </div>
                    <div class="customer-info">
                        <h4>${escapeHtml(customer.name)}</h4>
                        <div class="customer-username">ID: ${customer.id}</div>
                        <div class="customer-stats">
                            <span><i class="fas fa-shopping-bag"></i> ${customer.orders || 0}</span>
                            <span><i class="fas fa-credit-card"></i> ${formatRupiah(customer.total_spent || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.customersGrid.innerHTML = html;
    }

    // ==================== NAVIGATION ====================
    function showPage(pageId) {
        elements.pages.forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        elements.menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            }
        });
        
        // Simpan halaman aktif ke session storage
        saveCurrentPage(pageId);
        
        vibrate(10);
    }

    /**
     * Memulihkan halaman terakhir dari session storage
     * Jika tidak ada, default ke dashboard
     */
    function restoreLastPage() {
        const lastPage = getLastPage();
        
        // Validasi apakah pageId valid
        const validPages = ['dashboard', 'websites', 'products', 'orders', 'transactions', 'customers', 'settings', 'help'];
        
        if (lastPage && validPages.includes(lastPage)) {
            console.log(`🔄 Restoring last page: ${lastPage}`);
            showPage(lastPage);
        } else {
            console.log('🔄 No saved page, showing dashboard');
            showPage('dashboard');
        }
    }

    function toggleSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.toggle('active');
        }
    }

    function closeSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.remove('active');
        }
    }

    // ==================== FUNGSI RENDER PRODUK ====================
    function renderProductsList() {
      if (!elements.productsListContainer || !elements.productsEmptyState) return;
    
      if (!allProducts || allProducts.length === 0) {
        elements.productsListContainer.innerHTML = '';
        elements.productsEmptyState.style.display = 'block';
        return;
      }
    
      elements.productsEmptyState.style.display = 'none';
    
      // Filter products berdasarkan pencarian dan filter aktif
      let filtered = filterProductsBySearch(allProducts);
      filtered = filterProductsByType(filtered);
    
      // Group by layanan
      const groupedByLayanan = {};
      filtered.forEach(product => {
        const key = product.layanan_nama || 'Lainnya';
        if (!groupedByLayanan[key]) {
          groupedByLayanan[key] = {
            layanan_nama: key,
            layanan_gambar: product.layanan_gambar,
            layanan_desc: product.layanan_desc,
            aplikasi: {}
          };
        }
    
        const appKey = product.aplikasi_nama || 'Lainnya';
        if (!groupedByLayanan[key].aplikasi[appKey]) {
          groupedByLayanan[key].aplikasi[appKey] = {
            aplikasi_nama: appKey,
            aplikasi_gambar: product.aplikasi_gambar,
            aplikasi_desc: product.aplikasi_desc,
            items: []
          };
        }
    
        groupedByLayanan[key].aplikasi[appKey].items.push(product);
      });
    
      let html = '';
    
      Object.values(groupedByLayanan).forEach(layanan => {
        const totalAplikasi = Object.keys(layanan.aplikasi).length;
        const totalItems = Object.values(layanan.aplikasi).reduce((sum, app) => sum + app.items.length, 0);
    
        html += `
                <div class="layanan-card">
                    <div class="layanan-header">
                        <div class="layanan-icon">
                            ${layanan.layanan_gambar ? 
                                `<img src="${escapeHtml(layanan.layanan_gambar)}" alt="${escapeHtml(layanan.layanan_nama)}">` : 
                                `<i class="fas fa-layer-group"></i>`
                            }
                        </div>
                        <div class="layanan-info">
                            <div class="layanan-nama">${escapeHtml(layanan.layanan_nama)}</div>
                            ${layanan.layanan_desc ? `<div class="layanan-desc">${escapeHtml(layanan.layanan_desc)}</div>` : ''}
                        </div>
                        <div class="layanan-stats">
                            <span><i class="fas fa-mobile-alt"></i> ${totalAplikasi}</span>
                            <span><i class="fas fa-box"></i> ${totalItems}</span>
                        </div>
                    </div>
                    
                    <div class="aplikasi-container">
            `;
    
        Object.values(layanan.aplikasi).forEach(aplikasi => {
          const itemsToShow = aplikasi.items.slice(0, 3);
          const remainingItems = aplikasi.items.length - 3;
    
          html += `
                    <div class="aplikasi-card">
                        <div class="aplikasi-header">
                            <div class="aplikasi-logo">
                                ${aplikasi.aplikasi_gambar ? 
                                    `<img src="${escapeHtml(aplikasi.aplikasi_gambar)}" alt="${escapeHtml(aplikasi.aplikasi_nama)}">` : 
                                    `<i class="fas fa-mobile-alt"></i>`
                                }
                            </div>
                            <div class="aplikasi-info">
                                <div class="aplikasi-nama">${escapeHtml(aplikasi.aplikasi_nama)}</div>
                                ${aplikasi.aplikasi_desc ? `<div class="aplikasi-desc">${escapeHtml(aplikasi.aplikasi_desc)}</div>` : ''}
                            </div>
                            <div class="aplikasi-stats">
                                <span><i class="fas fa-box"></i> ${aplikasi.items.length}</span>
                            </div>
                        </div>
                        
                        <div class="items-preview">
                `;
    
          itemsToShow.forEach(item => {
            const readyClass = item.item_ready ? 'ready' : 'sold';
            const stokCount = item.item_stok?.length || 0;
    
            html += `
                        <div class="item-preview-card">
                            <div class="item-preview-info">
                                <span class="item-preview-name">${escapeHtml(item.item_nama || 'Item')}</span>
                                <span class="item-preview-price">${formatRupiah(item.item_harga || 0)}</span>
                            </div>
                            <span class="item-preview-badge ${readyClass}">
                                <i class="fas fa-${item.item_ready ? 'check-circle' : 'times-circle'}"></i>
                                ${item.item_ready ? 'Ready' : 'Sold'}
                            </span>
                        </div>
                    `;
          });
    
          if (remainingItems > 0) {
            html += `
                        <div class="more-items">
                            +${remainingItems} item lainnya...
                        </div>
                    `;
          }
    
          html += `
                        </div>
                    </div>
                `;
        });
    
        html += `
                    </div>
                </div>
            `;
      });
    
      elements.productsListContainer.innerHTML = html;
    }
    
    function filterProductsBySearch(products) {
      if (!productSearchTerm) return products;
    
      const term = productSearchTerm.toLowerCase();
      return products.filter(product => {
        return (product.layanan_nama && product.layanan_nama.toLowerCase().includes(term)) ||
          (product.aplikasi_nama && product.aplikasi_nama.toLowerCase().includes(term)) ||
          (product.item_nama && product.item_nama.toLowerCase().includes(term));
      });
    }
    
    function filterProductsByType(products) {
      switch (currentProductFilter) {
        case 'tersedia':
          return products.filter(p => p.item_ready === true);
    
        case 'stok-terbanyak':
          return [...products].sort((a, b) => {
            const stokA = a.item_stok?.length || 0;
            const stokB = b.item_stok?.length || 0;
            return stokB - stokA;
          });
    
        case 'item-terbanyak':
          // Group by layanan dan hitung total items per layanan
          const layananItemCount = {};
          products.forEach(p => {
            const key = p.layanan_nama || 'Lainnya';
            if (!layananItemCount[key]) layananItemCount[key] = 0;
            layananItemCount[key]++;
          });
    
          // Sort by count descending
          return [...products].sort((a, b) => {
            const countA = layananItemCount[a.layanan_nama || 'Lainnya'] || 0;
            const countB = layananItemCount[b.layanan_nama || 'Lainnya'] || 0;
            return countB - countA;
          });
    
        case 'layanan-aplikasi':
          // Prioritaskan item yang merupakan layanan atau aplikasi (tanpa item)
          return [...products].sort((a, b) => {
            const aIsCategory = !a.item_nama && (a.layanan_nama || a.aplikasi_nama);
            const bIsCategory = !b.item_nama && (b.layanan_nama || b.aplikasi_nama);
            return (bIsCategory ? 1 : 0) - (aIsCategory ? 1 : 0);
          });
    
        case 'selengkapnya':
          // Tampilkan semua produk dengan urutan default
          return products;
    
        default:
          return products;
      }
    }
    
    // ==================== SETUP FILTER DROPDOWN ====================
    function setupProductFilters() {
      const filterDropdown = document.querySelector('.filter-dropdown');
      const filterBtn = document.getElementById('filterDropdownBtn');
      const filterMenu = document.getElementById('filterDropdownMenu');
      const filterOptions = document.querySelectorAll('.filter-option');
      const selectedFilterText = document.getElementById('selectedFilterText');
    
      if (!filterBtn || !filterMenu || !filterDropdown) return;
    
      // Toggle dropdown saat tombol diklik
      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('active');
      });
    
      // Pilih filter option
      filterOptions.forEach(option => {
        option.addEventListener('click', () => {
          // Update active state
          filterOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
    
          // Update filter text
          const filterText = option.textContent.trim();
          if (selectedFilterText) {
            selectedFilterText.textContent = filterText;
          }
    
          // Update filter value
          currentProductFilter = option.dataset.filter;
    
          // Render ulang produk
          renderProductsList();
    
          // Tutup dropdown
          filterDropdown.classList.remove('active');
        });
      });
    
      // Tutup dropdown saat klik di luar
      document.addEventListener('click', (e) => {
        if (!filterBtn.contains(e.target) && !filterMenu.contains(e.target)) {
          filterDropdown.classList.remove('active');
        }
      });
    
      // Tutup dropdown dengan tombol Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          filterDropdown.classList.remove('active');
        }
      });
    }
    
    // ==================== SETUP SEARCH ====================
    function setupProductSearch() {
      const searchInput = document.getElementById('productSearch');
      if (!searchInput) return;
    
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          productSearchTerm = e.target.value;
          renderProductsList();
        }, 300);
      });
    }
    
    // ==================== UPDATE SETUP SETTINGS LINKS ====================
    function setupSettingsLinks() {
        if (elements.appearanceSettings && userWebsites.length > 0) {
            elements.appearanceSettings.href = `/wtb/html/tampilan.html?website=${userWebsites[0].endpoint}`;
        }
        
        if (elements.manageProductsBtn && userWebsites.length > 0) {
            elements.manageProductsBtn.href = `/wtb/html/produk.html?website=${userWebsites[0].endpoint}`;
        }
        
        // Tambahkan juga untuk empty state manage button
        const emptyStateManageBtn = document.getElementById('emptyStateManageBtn');
        if (emptyStateManageBtn && userWebsites.length > 0) {
            emptyStateManageBtn.href = `/wtb/html/produk.html?website=${userWebsites[0].endpoint}`;
        }
        
        if (elements.socialSettings && userWebsites.length > 0) {
            elements.socialSettings.href = `/wtb/html/sosial.html?website=${userWebsites[0].endpoint}`;
        }
        
        if (elements.paymentSettings && userWebsites.length > 0) {
            elements.paymentSettings.href = `/wtb/html/pembayaran.html?website=${userWebsites[0].endpoint}`;
        }
        
        if (elements.notificationSettings) {
            elements.notificationSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
        
        if (elements.voucherSettings && userWebsites.length > 0) {
          elements.voucherSettings.href = `/wtb/html/voucher.html?website=${userWebsites[0].endpoint}`;
        }
        
        if (elements.integrationSettings) {
            elements.integrationSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        if (elements.menuToggle) {
            elements.menuToggle.addEventListener('click', toggleSidebar);
        }
        
        if (elements.sidebarClose) {
            elements.sidebarClose.addEventListener('click', closeSidebar);
        }
        
        if (elements.refreshBtn) {
          elements.refreshBtn.addEventListener('click', async () => {
            vibrate(10);
            const currentEndpoint = getLastWebsiteEndpoint() || (userWebsites[0]?.endpoint);
            if (currentEndpoint) {
              showToast(`Memuat ulang data untuk /${currentEndpoint}...`, 'info');
              await reloadForWebsite(currentEndpoint);
            } else {
              showToast('Tidak ada website yang dipilih', 'warning');
            }
          });
        }
        
        elements.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    showPage(page);
                }
                closeSidebar();
            });
        });
        
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clearSession(); // Hapus session saat logout
                localStorage.removeItem('panel_user');
                window.location.href = '/';
            });
        }
        
        if (elements.orderStatusFilter) {
            elements.orderStatusFilter.addEventListener('change', renderOrdersTable);
        }
        
        if (elements.customerSearch) {
            elements.customerSearch.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                // Implement search functionality
            });
        }
        
        if (elements.transactionPeriod) {
            elements.transactionPeriod.addEventListener('change', () => {
                showToast('Fitur filter periode akan segera tersedia', 'info');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (elements.sidebar?.classList.contains('active')) {
                if (!elements.sidebar.contains(e.target) && !elements.menuToggle?.contains(e.target)) {
                    closeSidebar();
                }
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSidebar();
            }
        });
        
        // Simpan state saat user akan meninggalkan halaman (opsional)
        window.addEventListener('beforeunload', () => {
            // Tidak perlu melakukan apa-apa, session storage sudah tersimpan
        });
    }

    // ==================== PULL TO REFRESH ====================
    function initPullToRefresh() {
      // Buat elemen spinner
      ptrState.container = document.createElement('div');
      ptrState.container.className = 'ptr-container';
    
      ptrState.spinner = document.createElement('div');
      ptrState.spinner.className = 'ptr-spinner';
      ptrState.spinner.innerHTML = '<i class="fas fa-arrow-down"></i>';
    
      ptrState.container.appendChild(ptrState.spinner);
      document.body.appendChild(ptrState.container);
    
      // Event listeners
      const content = document.querySelector('.panel-content');
      if (!content) return;
    
      let touchStartY = 0;
      let touchStartX = 0;
    
      content.addEventListener('touchstart', (e) => {
        // Simpan posisi awal sentuhan
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
    
        // Reset state
        ptrState.pulling = false;
        ptrState.spinner.style.top = '-60px';
        ptrState.spinner.classList.remove('pull-down', 'active', 'loading');
      }, { passive: true });
    
      content.addEventListener('touchmove', (e) => {
        // Cek apakah di posisi paling atas
        if (content.scrollTop > 5) return;
    
        const touchY = e.touches[0].clientY;
        const touchX = e.touches[0].clientX;
    
        // Hitung jarak tarikan vertikal
        const diffY = touchY - touchStartY;
    
        // Hitung jarak horizontal untuk deteksi scroll horizontal
        const diffX = Math.abs(touchX - touchStartX);
    
        // Hanya proses jika:
        // 1. Scroll vertikal ke bawah (diffY > 0)
        // 2. Bukan scroll horizontal (diffX < 10)
        // 3. Di posisi paling atas
        if (diffY > 0 && diffX < 10 && content.scrollTop <= 5) {
          e.preventDefault();
    
          ptrState.pulling = true;
    
          // Batasi jarak tarikan
          const pullDistance = Math.min(diffY, 100);
    
          // Update posisi spinner
          ptrState.spinner.style.top = `${10 + pullDistance}px`;
          ptrState.spinner.classList.add('pull-down');
    
          // Rotasi icon berdasarkan jarak
          const rotation = Math.min(pullDistance / 80 * 180, 180);
          const icon = ptrState.spinner.querySelector('i');
          if (icon) {
            icon.style.transform = `rotate(${rotation}deg)`;
          }
    
          // Ganti icon jika mencapai threshold
          if (pullDistance >= 80) {
            ptrState.spinner.classList.add('active');
            ptrState.spinner.innerHTML = '<i class="fas fa-check"></i>';
          } else {
            ptrState.spinner.classList.remove('active');
            ptrState.spinner.innerHTML = '<i class="fas fa-arrow-down"></i>';
          }
        }
      }, { passive: false });
    
      content.addEventListener('touchend', async (e) => {
        if (!ptrState.pulling) return;
    
        const touchY = e.changedTouches[0].clientY;
        const diffY = touchY - touchStartY;
    
        // Refresh jika mencapai threshold
        if (diffY >= 80 && content.scrollTop <= 5) {
          // Tampilkan loading
          ptrState.spinner.classList.remove('pull-down', 'active');
          ptrState.spinner.classList.add('loading');
          ptrState.spinner.innerHTML = '<i class="fas fa-sync-alt"></i>';
          ptrState.spinner.style.top = '60px';
    
          // Lakukan refresh
          await refreshPage();
    
          // Sembunyikan spinner
          setTimeout(() => {
            ptrState.spinner.style.top = '-60px';
            ptrState.spinner.classList.remove('loading');
          }, 500);
        } else {
          // Reset tanpa refresh
          ptrState.spinner.style.top = '-60px';
          ptrState.spinner.classList.remove('pull-down', 'active', 'loading');
        }
    
        ptrState.pulling = false;
      }, { passive: true });
    
      content.addEventListener('touchcancel', () => {
        ptrState.pulling = false;
        ptrState.spinner.style.top = '-60px';
        ptrState.spinner.classList.remove('pull-down', 'active', 'loading');
      }, { passive: true });
    }
    
    async function refreshPage() {
      showToast('Menyegarkan halaman...', 'info');
    
      const currentPage = getLastPage() || 'dashboard';
      const currentEndpoint = getLastWebsiteEndpoint();
    
      try {
        if (currentEndpoint) {
          await reloadForWebsite(currentEndpoint, false);
        } else {
          const userId = await loadUserData();
          await loadUserWebsites(userId);
          await loadProductsAndOrders();
        }
    
        showToast('Halaman berhasil disegarkan', 'success');
        showPage(currentPage);
    
      } catch (error) {
        console.error('❌ Refresh error:', error);
        showToast('Gagal menyegarkan halaman', 'error');
      }
    }
    
    function setupWebsiteSelector() {
      const dropdown = document.querySelector('.website-selector-dropdown');
      const btn = document.getElementById('websiteSelectorBtn');
      const menu = document.getElementById('websiteSelectorMenu');
      const selectedText = document.getElementById('selectedWebsiteEndpoint');
    
      if (!btn || !menu || !dropdown) return;
    
      // Render menu options
      renderWebsiteOptions();
    
      // Toggle dropdown
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
    
      // Pilih website
      menu.addEventListener('click', (e) => {
        const option = e.target.closest('.website-option');
        if (!option) return;
    
        const endpoint = option.dataset.endpoint;
        if (!endpoint) return;
    
        // Update selected
        document.querySelectorAll('.website-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
    
        // Update text
        selectedText.textContent = '/' + endpoint;
    
        // Save to session
        saveWebsiteEndpoint(endpoint);
        currentWebsiteEndpoint = endpoint;
    
        // Update all settings links
        updateAllSettingsLinks(endpoint);
    
        // Close dropdown
        dropdown.classList.remove('active');
    
        // Reload data for selected website
        reloadForWebsite(endpoint);
    
        showToast(`Website: /${endpoint}`, 'success');
      });
    
      // Tutup dropdown saat klik di luar
      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
    
      // Load saved endpoint
      const savedEndpoint = getLastWebsiteEndpoint();
      if (savedEndpoint) {
        currentWebsiteEndpoint = savedEndpoint;
        selectedText.textContent = '/' + savedEndpoint;
      }
    }
    
    function renderWebsiteOptions() {
      const menu = document.getElementById('websiteSelectorMenu');
      if (!menu) return;
    
      if (userWebsites.length === 0) {
        menu.innerHTML = `
                <button class="website-option" data-endpoint="">
                    <i class="fas fa-plus-circle"></i>
                    <span>Tidak ada website</span>
                </button>
            `;
        return;
      }
    
      let html = '';
      const currentEndpoint = getLastWebsiteEndpoint() || (userWebsites[0]?.endpoint);
    
      userWebsites.forEach(website => {
        const isActive = website.endpoint === currentEndpoint;
        html += `
                <button class="website-option ${isActive ? 'active' : ''}" data-endpoint="${website.endpoint}">
                    <i class="fas fa-globe"></i>
                    <span>/${website.endpoint}</span>
                </button>
            `;
      });
    
      menu.innerHTML = html;
    }
    
    function updateAllSettingsLinks(endpoint) {
      // Update semua link settings dengan endpoint yang dipilih
      const settingLinks = {
        appearanceSettings: '/wtb/html/tampilan.html?website=' + endpoint,
        socialSettings: '/wtb/html/sosial.html?website=' + endpoint,
        paymentSettings: '/wtb/html/pembayaran.html?website=' + endpoint,
        voucherSettings: '/wtb/html/voucher.html?website=' + endpoint,
        manageProductsBtn: '/wtb/html/produk.html?website=' + endpoint,
        emptyStateManageBtn: '/wtb/html/produk.html?website=' + endpoint
      };
    
      for (const [id, url] of Object.entries(settingLinks)) {
        const element = document.getElementById(id);
        if (element) {
          element.href = url;
        }
      }
    
      // Update juga quick actions
      updateQuickActions(endpoint);
    }
    
    function updateQuickActions(endpoint) {
      if (!elements.quickActions) return;
    
      let html = '';
    
      if (userWebsites.length > 0) {
        html += `
                <a href="/wtb/html/produk.html?website=${endpoint}" class="quick-action-card">
                    <i class="fas fa-box"></i>
                    <span>Kelola Produk</span>
                    <small>/${endpoint}</small>
                </a>
                <a href="/wtb/html/tampilan.html?website=${endpoint}" class="quick-action-card">
                    <i class="fas fa-paint-brush"></i>
                    <span>Atur Tampilan</span>
                    <small>/${endpoint}</small>
                </a>
            `;
      } else {
        html = `
                <a href="/wtb/html/format.html" class="quick-action-card">
                    <i class="fas fa-plus-circle"></i>
                    <span>Buat Website Baru</span>
                </a>
            `;
      }
    
      elements.quickActions.innerHTML = html;
    }
    
    // Update fungsi loadUserWebsites untuk memanggil setupWebsiteSelector
    async function loadUserWebsites(userId) {
      try {
        showLoading(true);
    
        const response = await fetchWithRetry(`${API_BASE_URL}/api/websites`, {
          method: 'GET'
        });
    
        if (response.success && response.websites) {
          userWebsites = response.websites.filter(w => w.owner_id === userId);
    
          if (elements.menuWebsitesBadge) {
            elements.menuWebsitesBadge.textContent = userWebsites.length;
          }
          if (elements.sidebarTotalWebsites) {
            elements.sidebarTotalWebsites.textContent = userWebsites.length;
          }
    
          const activeCount = userWebsites.filter(w => w.status === 'active').length;
          if (elements.statActiveWebsites) {
            elements.statActiveWebsites.textContent = activeCount;
          }
    
          // Setup website selector setelah data websites dimuat
          setupWebsiteSelector();
    
          // Simpan endpoint pertama jika belum ada
          if (userWebsites.length > 0 && !getLastWebsiteEndpoint()) {
            saveWebsiteEndpoint(userWebsites[0].endpoint);
            currentWebsiteEndpoint = userWebsites[0].endpoint;
          }
    
          return userWebsites;
        } else {
          userWebsites = [];
          return [];
        }
      } catch (error) {
        console.error('❌ Error loading websites:', error);
        showToast('Gagal memuat data website', 'error');
        userWebsites = [];
        return [];
      } finally {
        showLoading(false);
      }
    }

    // Fungsi untuk menyimpan data website ke session
    function cacheWebsiteData(websiteId, data) {
      try {
        const cacheKey = `website_${websiteId}_data`;
        const cacheData = {
          timestamp: Date.now(),
          data: data
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.warn('⚠️ Failed to cache website data:', e);
      }
    }
    
    // Fungsi untuk mengambil data website dari cache
    function getCachedWebsiteData(websiteId, maxAge = 5 * 60 * 1000) { // 5 menit default
      try {
        const cacheKey = `website_${websiteId}_data`;
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return null;
    
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > maxAge) {
          sessionStorage.removeItem(cacheKey);
          return null;
        }
    
        return data;
      } catch (e) {
        return null;
      }
    }
    
    // Update fungsi reloadForWebsite untuk menggunakan cache
    async function reloadForWebsite(endpoint, useCache = true) {
      showLoading(true);
    
      try {
        const website = userWebsites.find(w => w.endpoint === endpoint);
        if (!website) return;
    
        // Cek cache jika diizinkan
        if (useCache) {
          const cached = getCachedWebsiteData(website.id);
          if (cached) {
            allProducts = cached;
            renderProductsList();
            if (elements.sidebarTotalProducts) {
              elements.sidebarTotalProducts.textContent = allProducts.length;
            }
            showLoading(false);
            return;
          }
        }
    
        // Load dari API jika tidak ada cache
        const productsResponse = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${website.id}`, {
          method: 'GET'
        }).catch(() => ({ success: false, data: [] }));
    
        if (productsResponse.success && productsResponse.data) {
          allProducts = [];
          productsResponse.data.forEach(layanan => {
            if (layanan.aplikasi) {
              layanan.aplikasi.forEach(aplikasi => {
                if (aplikasi.items) {
                  aplikasi.items.forEach(item => {
                    allProducts.push({
                      ...item,
                      website_name: website.endpoint,
                      website_id: website.id,
                      layanan_nama: layanan.layanan_nama,
                      layanan_gambar: layanan.layanan_gambar,
                      layanan_desc: layanan.layanan_desc,
                      aplikasi_nama: aplikasi.aplikasi_nama,
                      aplikasi_gambar: aplikasi.aplikasi_gambar,
                      aplikasi_desc: aplikasi.aplikasi_desc
                    });
                  });
                }
              });
            }
          });
    
          // Cache data
          cacheWebsiteData(website.id, allProducts);
        }
    
        renderProductsList();
    
        if (elements.sidebarTotalProducts) {
          elements.sidebarTotalProducts.textContent = allProducts.length;
        }
    
      } catch (error) {
        console.error('❌ Error reloading for website:', error);
      } finally {
        showLoading(false);
      }
    }

    async function init() {
      showLoading(true);
    
      try {
        const userId = await loadUserData();
        await loadUserWebsites(userId);
        await loadProductsAndOrders();
    
        setupSettingsLinks();
        setupEventListeners();
        setupProductFilters();
        setupProductSearch();
        initPullToRefresh();
    
        setupWebsiteSelector();
    
        const savedEndpoint = getLastWebsiteEndpoint();
        if (savedEndpoint && userWebsites.length > 0) {
          currentWebsiteEndpoint = savedEndpoint;
          document.getElementById('selectedWebsiteEndpoint').textContent = '/' + savedEndpoint;
          await reloadForWebsite(savedEndpoint, true);
        } else if (userWebsites.length > 0) {
          const firstEndpoint = userWebsites[0].endpoint;
          saveWebsiteEndpoint(firstEndpoint);
          currentWebsiteEndpoint = firstEndpoint;
          document.getElementById('selectedWebsiteEndpoint').textContent = '/' + firstEndpoint;
        }
    
        restoreLastPage();
    
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.expand();
          tg.ready();
        }
    
        console.log('✅ Panel initialized with session storage');
    
      } catch (error) {
        console.error('❌ Init error:', error);
        showToast('Gagal memuat dashboard', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.panel = {
        viewOrder: (orderId) => {
            showToast(`Melihat detail pesanan #${orderId}`, 'info');
        },
        updateOrderStatus: (orderId) => {
            showToast(`Fitur update status akan segera tersedia`, 'info');
        }
    };

    // ==================== START ====================
    init();
})();
// panel.js - Panel Dashboard untuk User Website
(function() {
    'use strict';
    
    console.log('📊 Panel Dashboard - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentUser = null;
    let userWebsites = [];
    let allProducts = [];
    let allOrders = [];
    let allCustomers = [];

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
        profileSettings: document.getElementById('profileSettings'),
        paymentSettings: document.getElementById('paymentSettings'),
        notificationSettings: document.getElementById('notificationSettings'),
        seoSettings: document.getElementById('seoSettings'),
        integrationSettings: document.getElementById('integrationSettings')
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

    async function fetchWithRetry(url, options, retries = 2) { // Kurangi dari 3 ke 2
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5 detik
    
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
          // Jika 404, jangan retry
          if (response.status === 404) {
            throw new Error('Not Found', { cause: '404' });
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
    
        return await response.json();
      } catch (error) {
        // Jika 404 atau AbortError, jangan retry
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
        // Cek user dari Telegram atau localStorage
        let userId = null;
        let userData = null;
        
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            userData = window.Telegram.WebApp.initDataUnsafe.user;
            userId = userData.id;
            
            // Simpan ke localStorage
            localStorage.setItem('panel_user', JSON.stringify({
                id: userId,
                first_name: userData.first_name,
                last_name: userData.last_name,
                username: userData.username,
                photo_url: userData.photo_url
            }));
        } else {
            // Coba ambil dari localStorage
            const savedUser = localStorage.getItem('panel_user');
            if (savedUser) {
                userData = JSON.parse(savedUser);
                userId = userData.id;
            } else {
                // Default untuk testing
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
        
        // Update UI dengan data user
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

    async function loadUserWebsites(userId) {
        try {
            showLoading(true);
            
            // Ambil semua websites
            const response = await fetchWithRetry(`${API_BASE_URL}/api/websites`, {
                method: 'GET'
            });
            
            if (response.success && response.websites) {
                // Filter berdasarkan user ID
                userWebsites = response.websites.filter(w => w.owner_id === userId);
                
                // Update badge
                if (elements.menuWebsitesBadge) {
                    elements.menuWebsitesBadge.textContent = userWebsites.length;
                }
                if (elements.sidebarTotalWebsites) {
                    elements.sidebarTotalWebsites.textContent = userWebsites.length;
                }
                
                // Hitung website aktif
                const activeCount = userWebsites.filter(w => w.status === 'active').length;
                if (elements.statActiveWebsites) {
                    elements.statActiveWebsites.textContent = activeCount;
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
    
        // Batasi jumlah request concurrent
        const batchSize = 2; // Proses 2 website sekaligus
        for (let i = 0; i < userWebsites.length; i += batchSize) {
          const batch = userWebsites.slice(i, i + batchSize);
    
          // Proses batch secara concurrent
          await Promise.all(batch.map(async (website) => {
            try {
              // Ambil produk
              console.log(`📦 Loading products for website ${website.id}...`);
              const productsResponse = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${website.id}`, {
                method: 'GET'
              }).catch(err => {
                console.log(`⚠️ No products for website ${website.id}:`, err.message);
                return { success: false, data: [] };
              });
    
              if (productsResponse.success && productsResponse.data) {
                totalProducts += productsResponse.data.length || 0;
    
                // Kumpulkan produk untuk top products
                productsResponse.data.forEach(layanan => {
                  if (layanan.aplikasi) {
                    layanan.aplikasi.forEach(aplikasi => {
                      if (aplikasi.items) {
                        aplikasi.items.forEach(item => {
                          allProductsList.push({
                            ...item,
                            website_name: website.endpoint,
                            layanan_nama: layanan.layanan_nama,
                            aplikasi_nama: aplikasi.aplikasi_nama
                          });
                        });
                      }
                    });
                  }
                });
              }
    
              // Ambil orders - dengan error handling yang lebih baik
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
                // Ini normal karena endpoint orders mungkin belum ada
                console.log(`ℹ️ Orders endpoint not available for website ${website.id} (coming soon)`);
              }
    
            } catch (websiteError) {
              console.error(`❌ Error loading data for website:`, website.endpoint, websiteError);
            }
          }));
    
          // Beri jeda antar batch untuk mengurangi beban
          if (i + batchSize < userWebsites.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
    
        allProducts = allProductsList;
        allOrders = allOrdersList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        allCustomers = Array.from(customersSet.values());
    
        // Update stats
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
    
        // Render sections
        renderQuickActions();
        renderRecentOrders();
        renderTopProducts();
        renderWebsitesGrid();
        renderProductSelector();
        renderOrdersTable();
        renderTransactions(totalRevenue, allOrdersList.length);
        renderCustomersGrid();
    
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
        // Tampilkan actions untuk setiap website
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
        
        // Sort by sold count (asumsi) and take top 4
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
        
        vibrate(10);
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

    // ==================== SETTINGS NAVIGATION ====================
    function setupSettingsLinks() {
        // Appearance Settings - Link ke tampilan.html
        if (elements.appearanceSettings && userWebsites.length > 0) {
            elements.appearanceSettings.href = `/html/tampilan?website=${userWebsites[0].endpoint}`;
        }
        
        // Product Management - Link ke produk.html
        if (elements.manageProductsBtn && userWebsites.length > 0) {
            elements.manageProductsBtn.href = `/wtb/html/produk?website=${userWebsites[0].endpoint}`;
        }
        
        // Profile Settings
        if (elements.profileSettings) {
            elements.profileSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
        
        if (elements.paymentSettings && userWebsites.length > 0) {
          elements.paymentSettings.href = `/wtb/html/pembayaran.html?website=${userWebsites[0].endpoint}`;
        }
        
        // Notification Settings
        if (elements.notificationSettings) {
            elements.notificationSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
        
        // SEO Settings
        if (elements.seoSettings) {
            elements.seoSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
        
        // Integration Settings
        if (elements.integrationSettings) {
            elements.integrationSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Fitur ini akan segera tersedia', 'info');
            });
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Menu toggle
        if (elements.menuToggle) {
            elements.menuToggle.addEventListener('click', toggleSidebar);
        }
        
        // Sidebar close
        if (elements.sidebarClose) {
            elements.sidebarClose.addEventListener('click', closeSidebar);
        }
        
        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', async () => {
                vibrate(10);
                showToast('Menyegarkan data...', 'info');
                await loadUserWebsites(currentUser?.id);
                await loadProductsAndOrders();
                showToast('Data diperbarui', 'success');
            });
        }
        
        // Navigation
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
        
        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('panel_user');
                window.location.href = '/';
            });
        }
        
        // Order status filter
        if (elements.orderStatusFilter) {
            elements.orderStatusFilter.addEventListener('change', renderOrdersTable);
        }
        
        // Customer search
        if (elements.customerSearch) {
            elements.customerSearch.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                // Implement search functionality
            });
        }
        
        // Transaction period
        if (elements.transactionPeriod) {
            elements.transactionPeriod.addEventListener('change', () => {
                // Implement period filter
                showToast('Fitur filter periode akan segera tersedia', 'info');
            });
        }
        
        // Click outside to close sidebar
        document.addEventListener('click', (e) => {
            if (elements.sidebar?.classList.contains('active')) {
                if (!elements.sidebar.contains(e.target) && !elements.menuToggle?.contains(e.target)) {
                    closeSidebar();
                }
            }
        });
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSidebar();
            }
        });
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            // Load user data
            const userId = await loadUserData();
            
            // Load user websites
            await loadUserWebsites(userId);
            
            // Load products and orders
            await loadProductsAndOrders();
            
            // Setup settings links
            setupSettingsLinks();
            
            // Setup event listeners
            setupEventListeners();
            
            // Apply Telegram theme if available
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                
                if (tg.themeParams) {
                    const theme = tg.themeParams;
                    if (theme.bg_color) {
                        document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
                    }
                    if (theme.text_color) {
                        document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
                    }
                }
            }
            
            console.log('✅ Panel initialized');
            
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

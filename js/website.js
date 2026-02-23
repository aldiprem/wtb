// Website JavaScript for Public Store
(function() {
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://your-api-url.com'; // GANTI DENGAN URL API ANDA
    const DEFAULT_ENDPOINT = 'default-store';

    // ==================== DOM ELEMENTS ====================
    const elements = {
        // Dynamic meta
        dynamicTitle: document.getElementById('dynamicTitle'),
        dynamicDescription: document.getElementById('dynamicDescription'),
        dynamicKeywords: document.getElementById('dynamicKeywords'),
        
        // Sidebar
        sidebar: document.getElementById('sidebar'),
        sidebarClose: document.getElementById('sidebarClose'),
        menuToggle: document.getElementById('menuToggle'),
        sidebarStoreName: document.getElementById('sidebarStoreName'),
        sidebarAvatar: document.getElementById('sidebarAvatar'),
        sidebarName: document.getElementById('sidebarName'),
        sidebarUsername: document.getElementById('sidebarUsername'),
        loginBtn: document.getElementById('loginBtn'),
        orderBadge: document.getElementById('orderBadge'),
        
        // Header
        storeName: document.getElementById('storeName'),
        searchToggle: document.getElementById('searchToggle'),
        cartBtn: document.getElementById('cartBtn'),
        cartBadge: document.getElementById('cartBadge'),
        
        // Search
        searchBar: document.getElementById('searchBar'),
        searchInput: document.getElementById('searchInput'),
        searchClose: document.getElementById('searchClose'),
        
        // Banner
        bannerSlider: document.getElementById('bannerSlider'),
        sliderContainer: document.getElementById('sliderContainer'),
        sliderDots: document.getElementById('sliderDots'),
        
        // Categories
        categoriesGrid: document.getElementById('categoriesGrid'),
        
        // Products
        featuredProducts: document.getElementById('featuredProducts'),
        popularProducts: document.getElementById('popularProducts'),
        
        // Promo
        promoBanner: document.getElementById('promoBanner'),
        
        // Payment
        paymentIcons: document.getElementById('paymentIcons'),
        
        // Footer
        footerDescription: document.getElementById('footerDescription'),
        contactWhatsApp: document.getElementById('contactWhatsApp'),
        contactTelegram: document.getElementById('contactTelegram'),
        footerStoreName: document.getElementById('footerStoreName'),
        sidebarYear: document.getElementById('sidebarYear'),
        
        // Cart
        cartSidebar: document.getElementById('cartSidebar'),
        cartClose: document.getElementById('cartClose'),
        cartItems: document.getElementById('cartItems'),
        cartEmpty: document.getElementById('cartEmpty'),
        cartFooter: document.getElementById('cartFooter'),
        cartTotal: document.getElementById('cartTotal'),
        shopNowBtn: document.getElementById('shopNowBtn'),
        checkoutBtn: document.getElementById('checkoutBtn'),
        
        // Modals
        productModal: document.getElementById('productModal'),
        checkoutModal: document.getElementById('checkoutModal'),
        loginModal: document.getElementById('loginModal'),
        closeProductModal: document.getElementById('closeProductModal'),
        closeCheckoutModal: document.getElementById('closeCheckoutModal'),
        closeLoginModal: document.getElementById('closeLoginModal'),
        productDetail: document.getElementById('productDetail'),
        checkoutBody: document.getElementById('checkoutBody'),
        
        // Login buttons
        telegramLogin: document.getElementById('telegramLogin'),
        guestLogin: document.getElementById('guestLogin'),
        
        // Toast
        toastContainer: document.getElementById('toastContainer')
    };

    // ==================== STATE ====================
    let currentEndpoint = null;
    let websiteData = null;
    let products = [];
    let categories = [];
    let cart = [];
    let currentUser = null;
    let currentProduct = null;
    let bannerInterval = null;
    let currentBannerIndex = 0;

    // ==================== FUNGSI UTILITY ====================
    function getEndpointFromUrl() {
        const path = window.location.pathname;
        const matches = path.match(/\/website\/([^\/]+)/);
        return matches ? matches[1] : DEFAULT_ENDPOINT;
    }

    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatPrice(price) {
        return `Rp ${formatNumber(price)}`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== FUNGSI TOAST ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // ==================== FUNGSI LOAD WEBSITE DATA ====================
    async function loadWebsiteData(endpoint) {
        try {
            console.log(`📡 Loading website data for endpoint: ${endpoint}`);
            
            // Simulasi API call - ganti dengan endpoint real
            // const response = await fetch(`${API_BASE_URL}/api/website/${endpoint}`);
            // const data = await response.json();
            
            // Data dummy untuk testing
            const data = getDummyWebsiteData(endpoint);
            
            websiteData = data;
            updateWebsiteUI(data);
            
            // Load products
            await loadProducts(endpoint);
            
            // Load categories
            await loadCategories(endpoint);
            
            return data;
            
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat data website', 'error');
            
            // Data dummy fallback
            const dummyData = getDummyWebsiteData(endpoint);
            websiteData = dummyData;
            updateWebsiteUI(dummyData);
        }
    }

    function getDummyWebsiteData(endpoint) {
        return {
            id: 1,
            endpoint: endpoint,
            name: 'Toko TopUp Game',
            title: 'Toko TopUp Game - Termurah dan Terpercaya',
            description: 'Toko topup game termurah dan terpercaya. Support berbagai game populer.',
            keywords: 'topup, game, voucher, diamond, ml, ff, pubg',
            banner: [
                'https://via.placeholder.com/800x300/40a7e3/ffffff?text=Promo+Spesial+50%25',
                'https://via.placeholder.com/800x300/10b981/ffffff?text=TopUp+Instant',
                'https://via.placeholder.com/800x300/f59e0b/ffffff?text=Bonus+Setiap+Pembelian'
            ],
            promo_banner: 'https://via.placeholder.com/800x100/FFD700/000000?text=Diskon+10%25+Untuk+Member+Baru',
            colors: {
                primary: '#40a7e3',
                secondary: '#FFD700',
                background: '#0f0f0f',
                text: '#ffffff',
                card: '#1a1a1a',
                accent: '#10b981'
            },
            font: {
                family: 'Inter',
                size: 14
            },
            contact: {
                whatsapp: '6281234567890',
                telegram: '@tokotopup'
            },
            payments: {
                bank: [
                    { name: 'BCA', icon: 'https://via.placeholder.com/40x40/0066b3/ffffff?text=BCA' },
                    { name: 'Mandiri', icon: 'https://via.placeholder.com/40x40/0033a0/ffffff?text=Mandiri' },
                    { name: 'BNI', icon: 'https://via.placeholder.com/40x40/ff6600/ffffff?text=BNI' },
                    { name: 'BRI', icon: 'https://via.placeholder.com/40x40/0066b3/ffffff?text=BRI' }
                ],
                ewallet: [
                    { name: 'DANA', icon: 'https://via.placeholder.com/40x40/00a36c/ffffff?text=DANA' },
                    { name: 'OVO', icon: 'https://via.placeholder.com/40x40/4b0082/ffffff?text=OVO' },
                    { name: 'GoPay', icon: 'https://via.placeholder.com/40x40/00aef0/ffffff?text=GoPay' },
                    { name: 'ShopeePay', icon: 'https://via.placeholder.com/40x40/ee4d2d/ffffff?text=ShopeePay' }
                ],
                qris: true
            },
            footer: {
                description: 'Toko topup game terpercaya sejak 2024. Melayani berbagai kebutuhan gaming Anda.',
                copyright: 'Toko TopUp Game'
            },
            social: {
                instagram: '#',
                facebook: '#',
                tiktok: '#'
            }
        };
    }

    // ==================== FUNGSI LOAD PRODUCTS ====================
    async function loadProducts(endpoint) {
        try {
            console.log(`📡 Loading products for endpoint: ${endpoint}`);
            
            // Simulasi API call
            // const response = await fetch(`${API_BASE_URL}/api/website/${endpoint}/products`);
            // const data = await response.json();
            
            // Data dummy
            products = getDummyProducts();
            
            renderFeaturedProducts();
            renderPopularProducts();
            
        } catch (error) {
            console.error('❌ Error loading products:', error);
            products = getDummyProducts();
            renderFeaturedProducts();
            renderPopularProducts();
        }
    }

    function getDummyProducts() {
        return [
            {
                id: 1,
                name: 'Diamond Mobile Legends',
                description: 'Diamond untuk Mobile Legends',
                price: 15000,
                original_price: 20000,
                stock: 999,
                sold: 1523,
                category: 'Mobile Legends',
                image: 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=ML+120+Diamond',
                images: [
                    'https://via.placeholder.com/400x400/40a7e3/ffffff?text=ML+1',
                    'https://via.placeholder.com/400x400/40a7e3/ffffff?text=ML+2'
                ],
                rating: 4.8,
                reviews: 234,
                featured: true,
                popular: true,
                variants: [
                    { name: '86 Diamond', price: 15000 },
                    { name: '172 Diamond', price: 29000 },
                    { name: '257 Diamond', price: 43000 },
                    { name: '344 Diamond', price: 57000 }
                ],
                notes: 'Proses otomatis 1-5 menit. Pastikan ID benar.'
            },
            {
                id: 2,
                name: 'UC PUBG Mobile',
                description: 'Unknown Cash untuk PUBG Mobile',
                price: 12000,
                original_price: 15000,
                stock: 500,
                sold: 876,
                category: 'PUBG Mobile',
                image: 'https://via.placeholder.com/300x200/10b981/ffffff?text=UC+60',
                images: [
                    'https://via.placeholder.com/400x400/10b981/ffffff?text=UC+1',
                    'https://via.placeholder.com/400x400/10b981/ffffff?text=UC+2'
                ],
                rating: 4.7,
                reviews: 156,
                featured: true,
                popular: true,
                variants: [
                    { name: '60 UC', price: 12000 },
                    { name: '180 UC', price: 35000 },
                    { name: '325 UC', price: 62000 },
                    { name: '660 UC', price: 125000 }
                ],
                notes: 'Proses cepat. Masukkan User ID dengan benar.'
            },
            {
                id: 3,
                name: 'Voucher Google Play',
                description: 'Voucher Google Play Indonesia',
                price: 50000,
                stock: 200,
                sold: 654,
                category: 'Voucher',
                image: 'https://via.placeholder.com/300x200/f59e0b/ffffff?text=Google+Play+50rb',
                images: [
                    'https://via.placeholder.com/400x400/f59e0b/ffffff?text=GP+1'
                ],
                rating: 4.9,
                reviews: 189,
                featured: true,
                popular: false,
                variants: [
                    { name: 'Rp 50.000', price: 50000 },
                    { name: 'Rp 100.000', price: 98000 },
                    { name: 'Rp 200.000', price: 195000 },
                    { name: 'Rp 500.000', price: 485000 }
                ],
                notes: 'Kode dikirim via email dan Telegram.'
            },
            {
                id: 4,
                name: 'Diamond Free Fire',
                description: 'Diamond untuk Free Fire',
                price: 10000,
                stock: 800,
                sold: 432,
                category: 'Free Fire',
                image: 'https://via.placeholder.com/300x200/ef4444/ffffff?text=FF+100+Diamond',
                images: [
                    'https://via.placeholder.com/400x400/ef4444/ffffff?text=FF+1'
                ],
                rating: 4.6,
                reviews: 98,
                featured: false,
                popular: true,
                variants: [
                    { name: '100 Diamond', price: 10000 },
                    { name: '210 Diamond', price: 20000 },
                    { name: '355 Diamond', price: 33000 },
                    { name: '530 Diamond', price: 49000 }
                ],
                notes: 'Topup otomatis via ID.'
            },
            {
                id: 5,
                name: 'Voucher Steam',
                description: 'Voucher Wallet Steam',
                price: 100000,
                stock: 150,
                sold: 321,
                category: 'Voucher',
                image: 'https://via.placeholder.com/300x200/1b2838/ffffff?text=Steam+$10',
                images: [
                    'https://via.placeholder.com/400x400/1b2838/ffffff?text=Steam+1'
                ],
                rating: 4.8,
                reviews: 76,
                featured: false,
                popular: true,
                variants: [
                    { name: '$10', price: 100000 },
                    { name: '$20', price: 200000 },
                    { name: '$50', price: 500000 },
                    { name: '$100', price: 1000000 }
                ],
                notes: 'Kode dikirim via email.'
            },
            {
                id: 6,
                name: 'Membership Spotify',
                description: 'Premium Spotify 1 bulan',
                price: 25000,
                original_price: 35000,
                stock: 300,
                sold: 567,
                category: 'Membership',
                image: 'https://via.placeholder.com/300x200/1db954/ffffff?text=Spotify',
                images: [
                    'https://via.placeholder.com/400x400/1db954/ffffff?text=Spotify+1'
                ],
                rating: 4.7,
                reviews: 145,
                featured: true,
                popular: false,
                variants: [
                    { name: '1 Bulan', price: 25000 },
                    { name: '3 Bulan', price: 70000 },
                    { name: '6 Bulan', price: 135000 },
                    { name: '12 Bulan', price: 250000 }
                ],
                notes: 'Akun pribadi, bukan family.'
            }
        ];
    }

    // ==================== FUNGSI LOAD CATEGORIES ====================
    async function loadCategories(endpoint) {
        try {
            // Simulasi categories
            categories = [
                { id: 1, name: 'Mobile Legends', icon: 'fas fa-gamepad', count: 12, color: '#40a7e3' },
                { id: 2, name: 'PUBG Mobile', icon: 'fas fa-crosshairs', count: 8, color: '#10b981' },
                { id: 3, name: 'Free Fire', icon: 'fas fa-fire', count: 6, color: '#ef4444' },
                { id: 4, name: 'Voucher', icon: 'fas fa-ticket-alt', count: 15, color: '#f59e0b' },
                { id: 5, name: 'Membership', icon: 'fas fa-crown', count: 7, color: '#8b5cf6' },
                { id: 6, name: 'Pulsa', icon: 'fas fa-phone-alt', count: 9, color: '#ec4899' }
            ];
            
            renderCategories();
            
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // ==================== FUNGSI UPDATE UI ====================
    function updateWebsiteUI(data) {
        // Update meta tags
        if (elements.dynamicTitle) {
            elements.dynamicTitle.textContent = data.title || 'Toko Online';
        }
        if (elements.dynamicDescription) {
            elements.dynamicDescription.content = data.description || 'Toko online terpercaya';
        }
        if (elements.dynamicKeywords) {
            elements.dynamicKeywords.content = data.keywords || 'toko, online, topup';
        }
        
        // Update store names
        const storeName = data.name || 'Toko Online';
        if (elements.storeName) elements.storeName.textContent = storeName;
        if (elements.sidebarStoreName) elements.sidebarStoreName.textContent = storeName;
        if (elements.footerStoreName) elements.footerStoreName.textContent = storeName;
        
        // Update footer
        if (elements.footerDescription) {
            elements.footerDescription.textContent = data.footer?.description || '';
        }
        if (elements.contactWhatsApp && data.contact?.whatsapp) {
            elements.contactWhatsApp.textContent = data.contact.whatsapp;
        }
        if (elements.contactTelegram && data.contact?.telegram) {
            elements.contactTelegram.textContent = data.contact.telegram;
        }
        
        // Update year
        if (elements.sidebarYear) {
            elements.sidebarYear.textContent = new Date().getFullYear();
        }
        
        // Update banner
        if (data.banner && data.banner.length > 0) {
            renderBanners(data.banner);
        }
        
        // Update promo banner
        if (data.promo_banner && elements.promoBanner) {
            elements.promoBanner.innerHTML = `<img src="${data.promo_banner}" alt="Promo">`;
        }
        
        // Update payment methods
        if (data.payments) {
            renderPaymentMethods(data.payments);
        }
        
        // Apply theme colors
        if (data.colors) {
            applyThemeColors(data.colors);
        }
        
        // Apply font
        if (data.font) {
            applyFont(data.font);
        }
    }

    function applyThemeColors(colors) {
        const root = document.documentElement;
        if (colors.primary) root.style.setProperty('--primary-color', colors.primary);
        if (colors.secondary) root.style.setProperty('--secondary-color', colors.secondary);
        if (colors.background) root.style.setProperty('--bg-color', colors.background);
        if (colors.text) root.style.setProperty('--text-color', colors.text);
        if (colors.card) root.style.setProperty('--card-bg', colors.card);
        if (colors.accent) root.style.setProperty('--accent-color', colors.accent);
    }

    function applyFont(font) {
        const root = document.documentElement;
        if (font.family) {
            root.style.setProperty('--font-family', font.family);
            document.body.style.fontFamily = font.family;
        }
        if (font.size) {
            root.style.setProperty('--font-size', `${font.size}px`);
        }
    }

    // ==================== FUNGSI RENDER BANNER ====================
    function renderBanners(banners) {
        if (!elements.sliderContainer || !elements.sliderDots) return;
        
        // Render images
        let slidesHtml = '';
        let dotsHtml = '';
        
        banners.forEach((banner, index) => {
            slidesHtml += `
                <div class="slider-slide ${index === 0 ? 'active' : ''}">
                    <img src="${banner}" alt="Banner ${index + 1}">
                </div>
            `;
            
            dotsHtml += `
                <span class="slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
            `;
        });
        
        elements.sliderContainer.innerHTML = slidesHtml;
        elements.sliderDots.innerHTML = dotsHtml;
        
        // Add click events to dots
        document.querySelectorAll('.slider-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                goToSlide(index);
            });
        });
        
        // Start auto slide
        startBannerAutoSlide(banners.length);
    }

    function startBannerAutoSlide(totalSlides) {
        if (bannerInterval) clearInterval(bannerInterval);
        
        bannerInterval = setInterval(() => {
            const nextIndex = (currentBannerIndex + 1) % totalSlides;
            goToSlide(nextIndex);
        }, 5000);
    }

    function goToSlide(index) {
        const slides = document.querySelectorAll('.slider-slide');
        const dots = document.querySelectorAll('.slider-dot');
        
        if (!slides.length || !dots.length) return;
        
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        
        currentBannerIndex = index;
    }

    // ==================== FUNGSI RENDER CATEGORIES ====================
    function renderCategories() {
        if (!elements.categoriesGrid) return;
        
        let html = '';
        categories.forEach(cat => {
            html += `
                <div class="category-card" data-category="${cat.id}">
                    <div class="category-icon" style="background: ${cat.color}20; color: ${cat.color}">
                        <i class="${cat.icon}"></i>
                    </div>
                    <div class="category-info">
                        <h4>${escapeHtml(cat.name)}</h4>
                        <span>${cat.count} produk</span>
                    </div>
                </div>
            `;
        });
        
        elements.categoriesGrid.innerHTML = html;
        
        // Add click events
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const categoryId = card.dataset.category;
                filterByCategory(categoryId);
            });
        });
    }

    // ==================== FUNGSI RENDER PRODUCTS ====================
    function renderFeaturedProducts() {
        if (!elements.featuredProducts) return;
        
        const featured = products.filter(p => p.featured).slice(0, 4);
        renderProductGrid(elements.featuredProducts, featured);
    }

    function renderPopularProducts() {
        if (!elements.popularProducts) return;
        
        const popular = products.filter(p => p.popular).slice(0, 4);
        renderProductGrid(elements.popularProducts, popular);
    }

    function renderProductGrid(container, productsToRender) {
        if (!container) return;
        
        if (!productsToRender || productsToRender.length === 0) {
            container.innerHTML = '<div class="empty-message">Tidak ada produk</div>';
            return;
        }
        
        let html = '';
        productsToRender.forEach(product => {
            const discount = product.original_price ? 
                Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
            
            html += `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-image">
                        <img src="${product.image}" alt="${escapeHtml(product.name)}">
                        ${discount > 0 ? `<span class="product-discount">-${discount}%</span>` : ''}
                        ${product.stock <= 0 ? '<span class="product-soldout">Habis</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h3>${escapeHtml(product.name)}</h3>
                        <p class="product-desc">${escapeHtml(product.description.substring(0, 30))}...</p>
                        <div class="product-price">
                            <span class="price">${formatPrice(product.price)}</span>
                            ${product.original_price ? 
                                `<span class="original-price">${formatPrice(product.original_price)}</span>` : ''}
                        </div>
                        <div class="product-meta">
                            <span class="rating">
                                <i class="fas fa-star"></i> ${product.rating}
                            </span>
                            <span class="sold">
                                <i class="fas fa-shopping-bag"></i> ${product.sold} terjual
                            </span>
                        </div>
                        <button class="btn-add-cart" onclick="event.stopPropagation(); window.website.addToCart(${product.id})">
                            <i class="fas fa-cart-plus"></i>
                            <span>Tambah</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click events to product cards
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.id;
                if (productId) {
                    openProductModal(parseInt(productId));
                }
            });
        });
    }

    // ==================== FUNGSI RENDER PAYMENT METHODS ====================
    function renderPaymentMethods(payments) {
        if (!elements.paymentIcons) return;
        
        let html = '';
        
        // Bank
        if (payments.bank && payments.bank.length > 0) {
            payments.bank.forEach(bank => {
                html += `
                    <div class="payment-icon">
                        <img src="${bank.icon}" alt="${bank.name}">
                        <span>${bank.name}</span>
                    </div>
                `;
            });
        }
        
        // E-Wallet
        if (payments.ewallet && payments.ewallet.length > 0) {
            payments.ewallet.forEach(wallet => {
                html += `
                    <div class="payment-icon">
                        <img src="${wallet.icon}" alt="${wallet.name}">
                        <span>${wallet.name}</span>
                    </div>
                `;
            });
        }
        
        // QRIS
        if (payments.qris) {
            html += `
                <div class="payment-icon">
                    <i class="fas fa-qrcode"></i>
                    <span>QRIS</span>
                </div>
            `;
        }
        
        elements.paymentIcons.innerHTML = html;
    }

    // ==================== FUNGSI CART ====================
    function loadCart() {
        const savedCart = localStorage.getItem(`cart_${currentEndpoint}`);
        if (savedCart) {
            try {
                cart = JSON.parse(savedCart);
            } catch {
                cart = [];
            }
        } else {
            cart = [];
        }
        
        updateCartUI();
    }

    function saveCart() {
        localStorage.setItem(`cart_${currentEndpoint}`, JSON.stringify(cart));
    }

    function addToCart(productId, variant = null, quantity = 1) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        if (product.stock <= 0) {
            showToast('Stok habis', 'error');
            return;
        }
        
        const cartItem = {
            id: productId,
            name: product.name,
            price: variant ? variant.price : product.price,
            variant: variant ? variant.name : null,
            quantity: quantity,
            image: product.image,
            maxStock: product.stock
        };
        
        // Check if item already in cart
        const existingIndex = cart.findIndex(item => 
            item.id === productId && item.variant === cartItem.variant
        );
        
        if (existingIndex >= 0) {
            const newQty = cart[existingIndex].quantity + quantity;
            if (newQty > product.stock) {
                showToast('Stok tidak mencukupi', 'error');
                return;
            }
            cart[existingIndex].quantity = newQty;
        } else {
            cart.push(cartItem);
        }
        
        saveCart();
        updateCartUI();
        showToast('Produk ditambahkan ke keranjang', 'success');
        vibrate(10);
    }

    function removeFromCart(index) {
        cart.splice(index, 1);
        saveCart();
        updateCartUI();
        showToast('Produk dihapus dari keranjang', 'info');
        vibrate(10);
    }

    function updateCartQuantity(index, newQuantity) {
        if (newQuantity <= 0) {
            removeFromCart(index);
            return;
        }
        
        const product = products.find(p => p.id === cart[index].id);
        if (product && newQuantity <= product.stock) {
            cart[index].quantity = newQuantity;
            saveCart();
            updateCartUI();
        } else {
            showToast('Stok tidak mencukupi', 'error');
        }
    }

    function updateCartUI() {
        // Update cart badge
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (elements.cartBadge) {
            elements.cartBadge.textContent = totalItems;
            elements.cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        
        // Update cart sidebar
        if (!elements.cartItems || !elements.cartEmpty || !elements.cartFooter) return;
        
        if (cart.length === 0) {
            elements.cartItems.style.display = 'none';
            elements.cartEmpty.style.display = 'flex';
            elements.cartFooter.style.display = 'none';
        } else {
            elements.cartItems.style.display = 'block';
            elements.cartEmpty.style.display = 'none';
            elements.cartFooter.style.display = 'block';
            
            let cartHtml = '';
            let total = 0;
            
            cart.forEach((item, index) => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                
                cartHtml += `
                    <div class="cart-item" data-index="${index}">
                        <img src="${item.image}" alt="${escapeHtml(item.name)}">
                        <div class="cart-item-details">
                            <h4>${escapeHtml(item.name)}</h4>
                            ${item.variant ? `<p class="cart-item-variant">${escapeHtml(item.variant)}</p>` : ''}
                            <div class="cart-item-price">${formatPrice(item.price)}</div>
                            <div class="cart-item-quantity">
                                <button class="qty-btn minus" onclick="window.website.updateCartQuantity(${index}, ${item.quantity - 1})">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span>${item.quantity}</span>
                                <button class="qty-btn plus" onclick="window.website.updateCartQuantity(${index}, ${item.quantity + 1})">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        <button class="cart-item-remove" onclick="window.website.removeFromCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
            
            elements.cartItems.innerHTML = cartHtml;
            if (elements.cartTotal) {
                elements.cartTotal.textContent = formatPrice(total);
            }
        }
    }

    // ==================== FUNGSI PRODUCT MODAL ====================
    function openProductModal(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        currentProduct = product;
        
        let variantsHtml = '';
        if (product.variants && product.variants.length > 0) {
            variantsHtml = `
                <div class="product-variants">
                    <h4>Pilih Varian</h4>
                    <div class="variant-list">
            `;
            
            product.variants.forEach((variant, index) => {
                variantsHtml += `
                    <button class="variant-btn ${index === 0 ? 'active' : ''}" data-variant='${JSON.stringify(variant)}'>
                        <span class="variant-name">${escapeHtml(variant.name)}</span>
                        <span class="variant-price">${formatPrice(variant.price)}</span>
                    </button>
                `;
            });
            
            variantsHtml += `
                    </div>
                </div>
            `;
        }
        
        const productHtml = `
            <div class="product-detail-images">
                <div class="main-image">
                    <img src="${product.image}" alt="${escapeHtml(product.name)}" id="mainProductImage">
                </div>
                <div class="thumbnail-images">
                    ${product.images ? product.images.map(img => 
                        `<img src="${img}" alt="Thumb" onclick="document.getElementById('mainProductImage').src='${img}'">`
                    ).join('') : ''}
                </div>
            </div>
            <div class="product-detail-info">
                <h2>${escapeHtml(product.name)}</h2>
                <div class="product-rating">
                    <div class="stars">
                        ${Array(5).fill(0).map((_, i) => 
                            `<i class="fas fa-star${i < Math.floor(product.rating) ? '' : i < product.rating ? '-half-alt' : '-o'}"></i>`
                        ).join('')}
                    </div>
                    <span>${product.rating} (${product.reviews} ulasan)</span>
                </div>
                <div class="product-price-detail">
                    <span class="current-price">${formatPrice(product.price)}</span>
                    ${product.original_price ? 
                        `<span class="old-price">${formatPrice(product.original_price)}</span>
                         <span class="discount-badge">-${Math.round(((product.original_price - product.price) / product.original_price) * 100)}%</span>` 
                        : ''}
                </div>
                <div class="product-stock">
                    <i class="fas fa-cubes"></i>
                    <span>Stok: <strong>${product.stock}</strong></span>
                    <span class="sold-count"><i class="fas fa-shopping-bag"></i> ${product.sold} terjual</span>
                </div>
                <div class="product-description">
                    <h4>Deskripsi</h4>
                    <p>${escapeHtml(product.description)}</p>
                </div>
                ${variantsHtml}
                <div class="product-notes">
                    <h4>Catatan</h4>
                    <p>${escapeHtml(product.notes)}</p>
                </div>
                <div class="product-actions-detail">
                    <div class="quantity-selector">
                        <button class="qty-btn" id="detailQtyMinus">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" id="detailQty" value="1" min="1" max="${product.stock}">
                        <button class="qty-btn" id="detailQtyPlus">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn-add-to-cart" id="detailAddToCart">
                        <i class="fas fa-cart-plus"></i>
                        <span>Tambah ke Keranjang</span>
                    </button>
                    <button class="btn-buy-now" id="detailBuyNow">
                        <i class="fas fa-bolt"></i>
                        Beli Sekarang
                    </button>
                </div>
            </div>
        `;
        
        if (elements.productDetail) {
            elements.productDetail.innerHTML = productHtml;
        }
        
        elements.productModal.classList.add('active');
        
        // Add event listeners for variant buttons
        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Quantity buttons
        const qtyInput = document.getElementById('detailQty');
        const qtyMinus = document.getElementById('detailQtyMinus');
        const qtyPlus = document.getElementById('detailQtyPlus');
        
        if (qtyMinus && qtyInput) {
            qtyMinus.addEventListener('click', () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val > 1) {
                    qtyInput.value = val - 1;
                }
            });
        }
        
        if (qtyPlus && qtyInput) {
            qtyPlus.addEventListener('click', () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val < product.stock) {
                    qtyInput.value = val + 1;
                }
            });
        }
        
        // Add to cart button
        const addToCartBtn = document.getElementById('detailAddToCart');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                const qty = parseInt(qtyInput?.value) || 1;
                const activeVariant = document.querySelector('.variant-btn.active');
                let variant = null;
                
                if (activeVariant && activeVariant.dataset.variant) {
                    try {
                        variant = JSON.parse(activeVariant.dataset.variant);
                    } catch (e) {
                        console.error('Error parsing variant', e);
                    }
                }
                
                addToCart(product.id, variant, qty);
                vibrate(10);
            });
        }
        
        // Buy now button
        const buyNowBtn = document.getElementById('detailBuyNow');
        if (buyNowBtn) {
            buyNowBtn.addEventListener('click', () => {
                const qty = parseInt(qtyInput?.value) || 1;
                const activeVariant = document.querySelector('.variant-btn.active');
                let variant = null;
                
                if (activeVariant && activeVariant.dataset.variant) {
                    try {
                        variant = JSON.parse(activeVariant.dataset.variant);
                    } catch (e) {
                        console.error('Error parsing variant', e);
                    }
                }
                
                addToCart(product.id, variant, qty);
                closeProductModal();
                openCart();
                vibrate(10);
            });
        }
        
        vibrate(10);
    }

    function closeProductModal() {
        if (elements.productModal) {
            elements.productModal.classList.remove('active');
        }
        currentProduct = null;
    }

    // ==================== FUNGSI CART SIDEBAR ====================
    function openCart() {
        if (elements.cartSidebar) {
            elements.cartSidebar.classList.add('active');
        }
        if (elements.sidebar) {
            elements.sidebar.classList.remove('active');
        }
        vibrate(10);
    }

    function closeCart() {
        if (elements.cartSidebar) {
            elements.cartSidebar.classList.remove('active');
        }
    }

    // ==================== FUNGSI SIDEBAR ====================
    function toggleSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.toggle('active');
            vibrate(10);
        }
    }

    function closeSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.remove('active');
        }
    }

    // ==================== FUNGSI SEARCH ====================
    function toggleSearch() {
        if (elements.searchBar) {
            elements.searchBar.classList.toggle('active');
            if (elements.searchBar.classList.contains('active')) {
                elements.searchInput.focus();
            }
        }
    }

    // ==================== FUNGSI FILTER ====================
    function filterByCategory(categoryId) {
        console.log('Filter by category:', categoryId);
        showToast('Fitur filter akan segera hadir', 'info');
    }

    // ==================== FUNGSI LOGIN ====================
    function openLoginModal() {
        if (elements.loginModal) {
            elements.loginModal.classList.add('active');
        }
        vibrate(10);
    }

    function closeLoginModal() {
        if (elements.loginModal) {
            elements.loginModal.classList.remove('active');
        }
    }

    function loginWithTelegram() {
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            if (tg.initDataUnsafe?.user) {
                const user = tg.initDataUnsafe.user;
                setUser(user);
                showToast(`Selamat datang, ${user.first_name}!`, 'success');
                closeLoginModal();
            } else {
                showToast('Silakan buka melalui Telegram', 'warning');
            }
        } else {
            // Simulasi login untuk testing
            const guestUser = {
                id: 999999,
                first_name: 'Guest',
                username: 'guest_user',
                is_premium: false
            };
            setUser(guestUser);
            showToast('Login sebagai Guest', 'info');
            closeLoginModal();
        }
    }

    function loginAsGuest() {
        const guestUser = {
            id: Date.now(),
            first_name: 'Guest',
            username: `guest_${Math.floor(Math.random() * 1000)}`,
            is_premium: false
        };
        setUser(guestUser);
        showToast('Lanjut sebagai Tamu', 'info');
        closeLoginModal();
    }

    function setUser(user) {
        currentUser = user;
        
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        const username = user.username ? `@${user.username}` : '(no username)';
        
        if (elements.sidebarName) {
            elements.sidebarName.textContent = fullName;
        }
        if (elements.sidebarUsername) {
            elements.sidebarUsername.textContent = username;
        }
        if (elements.sidebarAvatar) {
            const img = elements.sidebarAvatar.querySelector('img');
            if (img) {
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=80&background=40a7e3&color=fff`;
            }
        }
        if (elements.loginBtn) {
            elements.loginBtn.innerHTML = '<i class="fas fa-user"></i> Profile';
        }
        
        // Save to localStorage
        localStorage.setItem(`user_${currentEndpoint}`, JSON.stringify(user));
    }

    function loadUser() {
        const savedUser = localStorage.getItem(`user_${currentEndpoint}`);
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setUser(user);
            } catch (e) {
                console.error('Error loading user', e);
            }
        }
    }

    // ==================== FUNGSI INIT ====================
    async function init() {
        console.log('🏪 Initializing Website Store...');
        
        // Get endpoint from URL
        currentEndpoint = getEndpointFromUrl();
        console.log('📍 Endpoint:', currentEndpoint);
        
        // Load website data
        await loadWebsiteData(currentEndpoint);
        
        // Load cart
        loadCart();
        
        // Load user
        loadUser();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check Telegram Web App
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            
            // Auto login if Telegram user available
            if (tg.initDataUnsafe?.user && !currentUser) {
                setUser(tg.initDataUnsafe.user);
            }
        }
        
        console.log('✅ Website initialized');
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        // Menu toggle
        if (elements.menuToggle) {
            elements.menuToggle.addEventListener('click', toggleSidebar);
        }
        
        // Sidebar close
        if (elements.sidebarClose) {
            elements.sidebarClose.addEventListener('click', closeSidebar);
        }
        
        // Cart toggle
        if (elements.cartBtn) {
            elements.cartBtn.addEventListener('click', openCart);
        }
        
        if (elements.cartClose) {
            elements.cartClose.addEventListener('click', closeCart);
        }
        
        // Search toggle
        if (elements.searchToggle) {
            elements.searchToggle.addEventListener('click', toggleSearch);
        }
        
        if (elements.searchClose) {
            elements.searchClose.addEventListener('click', toggleSearch);
        }
        
        // Search input
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                // Implement search functionality
                console.log('Search:', query);
            });
        }
        
        // Shop now button
        if (elements.shopNowBtn) {
            elements.shopNowBtn.addEventListener('click', () => {
                closeCart();
                // Scroll to products
                document.querySelector('.featured-products').scrollIntoView({ behavior: 'smooth' });
            });
        }
        
        // Modal close buttons
        if (elements.closeProductModal) {
            elements.closeProductModal.addEventListener('click', closeProductModal);
        }
        
        if (elements.closeCheckoutModal) {
            elements.closeCheckoutModal.addEventListener('click', () => {
                elements.checkoutModal.classList.remove('active');
            });
        }
        
        if (elements.closeLoginModal) {
            elements.closeLoginModal.addEventListener('click', closeLoginModal);
        }
        
        // Login buttons
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', openLoginModal);
        }
        
        if (elements.telegramLogin) {
            elements.telegramLogin.addEventListener('click', loginWithTelegram);
        }
        
        if (elements.guestLogin) {
            elements.guestLogin.addEventListener('click', loginAsGuest);
        }
        
        // Checkout button
        if (elements.checkoutBtn) {
            elements.checkoutBtn.addEventListener('click', () => {
                if (cart.length === 0) {
                    showToast('Keranjang belanja kosong', 'warning');
                    return;
                }
                
                if (!currentUser) {
                    openLoginModal();
                    return;
                }
                
                // Open checkout modal
                if (elements.checkoutModal) {
                    // Render checkout form
                    let checkoutHtml = `
                        <div class="checkout-items">
                            <h3>Ringkasan Belanja</h3>
                    `;
                    
                    let total = 0;
                    cart.forEach(item => {
                        const itemTotal = item.price * item.quantity;
                        total += itemTotal;
                        
                        checkoutHtml += `
                            <div class="checkout-item">
                                <span>${escapeHtml(item.name)} ${item.variant ? `(${escapeHtml(item.variant)})` : ''} x${item.quantity}</span>
                                <span>${formatPrice(itemTotal)}</span>
                            </div>
                        `;
                    });
                    
                    checkoutHtml += `
                            <div class="checkout-total">
                                <strong>Total</strong>
                                <strong>${formatPrice(total)}</strong>
                            </div>
                        </div>
                        <div class="checkout-payment">
                            <h3>Metode Pembayaran</h3>
                            <div class="payment-options">
                                ${websiteData?.payments?.bank?.map(bank => `
                                    <label class="payment-option">
                                        <input type="radio" name="payment" value="bank_${bank.name}">
                                        <img src="${bank.icon}" alt="${bank.name}">
                                        <span>${bank.name}</span>
                                    </label>
                                `).join('')}
                                ${websiteData?.payments?.ewallet?.map(wallet => `
                                    <label class="payment-option">
                                        <input type="radio" name="payment" value="ewallet_${wallet.name}">
                                        <img src="${wallet.icon}" alt="${wallet.name}">
                                        <span>${wallet.name}</span>
                                    </label>
                                `).join('')}
                                ${websiteData?.payments?.qris ? `
                                    <label class="payment-option">
                                        <input type="radio" name="payment" value="qris">
                                        <i class="fas fa-qrcode"></i>
                                        <span>QRIS</span>
                                    </label>
                                ` : ''}
                            </div>
                        </div>
                        <div class="checkout-actions">
                            <button class="btn-secondary" onclick="window.website.closeCheckoutModal()">Batal</button>
                            <button class="btn-primary" onclick="window.website.processCheckout()">
                                <i class="fas fa-check"></i> Proses Pembayaran
                            </button>
                        </div>
                    `;
                    
                    elements.checkoutBody.innerHTML = checkoutHtml;
                    elements.checkoutModal.classList.add('active');
                }
            });
        }
        
        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === elements.productModal) {
                closeProductModal();
            }
            if (e.target === elements.checkoutModal) {
                elements.checkoutModal.classList.remove('active');
            }
            if (e.target === elements.loginModal) {
                closeLoginModal();
            }
            if (e.target === elements.cartSidebar) {
                closeCart();
            }
            if (e.target === elements.sidebar) {
                closeSidebar();
            }
        });
        
        // Close sidebar with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSidebar();
                closeCart();
                closeProductModal();
                elements.checkoutModal?.classList.remove('active');
                closeLoginModal();
            }
        });
    }

    // ==================== EXPOSE FUNCTIONS FOR GLOBAL ACCESS ====================
    window.website = {
        addToCart,
        removeFromCart,
        updateCartQuantity,
        closeCheckoutModal: () => {
            if (elements.checkoutModal) {
                elements.checkoutModal.classList.remove('active');
            }
        },
        processCheckout: () => {
            const selectedPayment = document.querySelector('input[name="payment"]:checked');
            if (!selectedPayment) {
                showToast('Pilih metode pembayaran', 'warning');
                return;
            }
            
            showToast('Pesanan sedang diproses', 'success');
            setTimeout(() => {
                elements.checkoutModal.classList.remove('active');
                cart = [];
                saveCart();
                updateCartUI();
                showToast('Pesanan berhasil! Terima kasih telah berbelanja', 'success');
            }, 2000);
        }
    };

    // ==================== START ====================
    init();
})();

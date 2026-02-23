// Website JavaScript for Public Store - GitHub Pages Version
(function() {
    console.log('🏪 Website Store - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com'; // URL backend Flask

    // ==================== FUNGSI GET ENDPOINT DARI URL ====================
    function getEndpointFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('store'); // ?store=premy
        console.log('📍 Endpoint from URL:', endpoint);
        return endpoint;
    }

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
        headerLogo: document.getElementById('headerLogo'), // Ini perlu ditambahkan di HTML
        headerLogoImg: document.getElementById('headerLogoImg'), // Ini perlu ditambahkan di HTML
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
    let tampilanData = null;
    let products = [];
    let categories = [];
    let cart = [];
    let currentUser = null;
    let currentProduct = null;
    let bannerInterval = null;
    let currentBannerIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;

    // ==================== FUNGSI UTILITY ====================
    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function formatNumber(num) {
        return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '0';
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
            
            const response = await fetch(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Website tidak ditemukan');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📥 Website data:', result);
            
            if (result.success && result.website) {
                const data = result.website;
                websiteData = data;
                
                // Load tampilan data untuk website ini
                await loadTampilanData(data.id);
                
                // Set products dari database
                products = data.products || [];
                
                // Set categories dari database (jika ada)
                categories = data.categories || [];
                
                // Update UI dengan data dari database
                updateWebsiteUI(data);
                
                // Render semua komponen
                renderAllComponents();
                
                return data;
            } else {
                throw new Error('Invalid response from server');
            }
            
        } catch (error) {
            console.error('❌ Error loading website:', error);
            
            // Tampilkan pesan error di halaman
            if (elements.storeName) {
                elements.storeName.textContent = 'Website Tidak Ditemukan';
            }
            
            showToast(error.message || 'Gagal memuat data website', 'error');
            
            // Kosongkan semua konten
            clearAllContent();
            
            return null;
        }
    }

    // ==================== FUNGSI LOAD TAMPILAN DATA ====================
    async function loadTampilanData(websiteId) {
        try {
            console.log(`📡 Loading tampilan data for website ID: ${websiteId}`);
            
            const response = await fetch(`${API_BASE_URL}/api/tampilan/${websiteId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            if (response.status === 404) {
                console.log('ℹ️ No tampilan data found, using defaults');
                tampilanData = null;
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📥 Tampilan data:', result);
            
            if (result.success && result.tampilan) {
                tampilanData = result.tampilan;
            }
            
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
            tampilanData = null;
        }
    }

    function clearAllContent() {
        // Kosongkan semua container
        if (elements.sliderContainer) elements.sliderContainer.innerHTML = '';
        if (elements.categoriesGrid) elements.categoriesGrid.innerHTML = '';
        if (elements.featuredProducts) elements.featuredProducts.innerHTML = '';
        if (elements.popularProducts) elements.popularProducts.innerHTML = '';
        if (elements.promoBanner) elements.promoBanner.innerHTML = '';
        if (elements.paymentIcons) elements.paymentIcons.innerHTML = '';
    }

    function renderAllComponents() {
        // Render logo di header
        renderLogo();
        
        // Render banner dari tampilanData
        if (tampilanData?.banners && tampilanData.banners.length > 0) {
            renderBanners(tampilanData.banners);
        } else if (tampilanData?.banner) {
            // Fallback ke banner lama (string)
            const banners = Array.isArray(tampilanData.banner) 
                ? tampilanData.banner 
                : [{ url: tampilanData.banner, positionX: 50, positionY: 50 }];
            renderBanners(banners);
        } else if (websiteData?.settings?.banner) {
            // Fallback ke settings lama
            const banners = Array.isArray(websiteData.settings.banner) 
                ? websiteData.settings.banner.map(b => ({ url: b, positionX: 50, positionY: 50 }))
                : [{ url: websiteData.settings.banner, positionX: 50, positionY: 50 }];
            renderBanners(banners);
        } else {
            if (elements.bannerSlider) elements.bannerSlider.style.display = 'none';
        }
        
        // Render promo banner
        if (tampilanData?.promo_banner && elements.promoBanner) {
            elements.promoBanner.innerHTML = `<img src="${tampilanData.promo_banner}" alt="Promo">`;
        } else if (websiteData?.settings?.promo_banner && elements.promoBanner) {
            elements.promoBanner.innerHTML = `<img src="${websiteData.settings.promo_banner}" alt="Promo">`;
        }
        
        // Render payment methods dari tampilanData
        if (tampilanData) {
            renderPaymentMethodsFromTampilan();
        } else if (websiteData?.settings?.payments) {
            renderPaymentMethods(websiteData.settings.payments);
        }
        
        // Render products
        renderProducts();
        
        // Apply theme dari tampilanData
        if (tampilanData?.colors) {
            applyThemeColors(tampilanData.colors);
        } else if (websiteData?.settings?.colors) {
            applyThemeColors(websiteData.settings.colors);
        }
        
        // Apply font dari tampilanData
        if (tampilanData) {
            applyFont({
                family: tampilanData.font_family || 'Inter',
                size: tampilanData.font_size || 14
            });
        } else if (websiteData?.settings?.font) {
            applyFont(websiteData.settings.font);
        }
    }

    // ==================== FUNGSI RENDER LOGO ====================
    function renderLogo() {
        // Cek apakah elemen header logo ada, jika tidak buat secara dinamis
        let headerLogoContainer = document.querySelector('.header-logo');
        
        if (tampilanData?.logo) {
            // Jika ada logo, tampilkan gambar
            if (headerLogoContainer) {
                headerLogoContainer.innerHTML = `
                    <img src="${tampilanData.logo}" alt="Logo" class="header-logo-img" style="height: 40px; width: auto; object-fit: contain;">
                    <span id="storeName" style="display: none;">${websiteData?.username || 'Toko Online'}</span>
                `;
            }
        } else {
            // Jika tidak ada logo, tampilkan icon dan nama toko
            if (headerLogoContainer) {
                headerLogoContainer.innerHTML = `
                    <i class="fas fa-store"></i>
                    <span id="storeName">${websiteData?.username || 'Toko Online'}</span>
                `;
            }
        }
    }

    // ==================== FUNGSI RENDER PAYMENT METHODS DARI TAMPILAN ====================
    function renderPaymentMethodsFromTampilan() {
        if (!elements.paymentIcons || !tampilanData) return;
        
        let html = '';
        
        // Render bank accounts
        if (tampilanData.banks && tampilanData.banks.length > 0) {
            tampilanData.banks.forEach(bank => {
                if (bank.enabled) {
                    html += `
                        <div class="payment-icon">
                            <i class="fas fa-university"></i>
                            <span>${bank.bank_name || 'Bank'}</span>
                        </div>
                    `;
                }
            });
        }
        
        // Render e-wallet accounts
        if (tampilanData.ewallets && tampilanData.ewallets.length > 0) {
            tampilanData.ewallets.forEach(ewallet => {
                if (ewallet.enabled) {
                    html += `
                        <div class="payment-icon">
                            <i class="fas fa-wallet"></i>
                            <span>${ewallet.provider || 'E-Wallet'}</span>
                        </div>
                    `;
                }
            });
        }
        
        // Render QRIS
        if (tampilanData.qris && tampilanData.qris.enabled) {
            html += `
                <div class="payment-icon">
                    <i class="fas fa-qrcode"></i>
                    <span>QRIS</span>
                </div>
            `;
        }
        
        // Render crypto
        if (tampilanData.crypto && tampilanData.crypto.enabled) {
            html += `
                <div class="payment-icon">
                    <i class="fab fa-bitcoin"></i>
                    <span>Crypto</span>
                </div>
            `;
        }
        
        if (html === '') {
            elements.paymentIcons.innerHTML = '<div class="empty-message">Belum ada metode pembayaran</div>';
        } else {
            elements.paymentIcons.innerHTML = html;
        }
    }

    // ==================== FUNGSI UPDATE UI ====================
    function updateWebsiteUI(data) {
        // Update meta tags dari tampilanData atau settings
        if (elements.dynamicTitle) {
            elements.dynamicTitle.textContent = tampilanData?.seo_title || data.settings?.title || 'Toko Online';
        }
        if (elements.dynamicDescription) {
            elements.dynamicDescription.content = tampilanData?.seo_description || data.settings?.description || 'Toko online terpercaya';
        }
        if (elements.dynamicKeywords) {
            elements.dynamicKeywords.content = tampilanData?.seo_keywords || data.settings?.seo?.keywords || 'toko, online, topup';
        }
        
        // Update store name (akan digunakan jika tidak ada logo)
        const storeName = data.username || 'Toko Online';
        if (elements.storeName) elements.storeName.textContent = storeName;
        if (elements.sidebarStoreName) elements.sidebarStoreName.textContent = storeName;
        if (elements.footerStoreName) elements.footerStoreName.textContent = storeName;
        
        // Update footer description
        if (elements.footerDescription) {
            elements.footerDescription.textContent = tampilanData?.description || data.settings?.description || 'Toko online terpercaya sejak 2024';
        }
        
        // Update contact info
        if (elements.contactWhatsApp) {
            elements.contactWhatsApp.textContent = tampilanData?.contact_whatsapp || data.settings?.contact?.whatsapp || '-';
        }
        if (elements.contactTelegram) {
            elements.contactTelegram.textContent = tampilanData?.contact_telegram || data.settings?.contact?.telegram || '-';
        }
        
        // Update sidebar avatar (tetap pakai avatar user, bukan logo)
        if (elements.sidebarAvatar && currentUser) {
            const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'User';
            const img = elements.sidebarAvatar.querySelector('img');
            if (img) {
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=80&background=40a7e3&color=fff`;
            }
        }
        
        // Update year
        if (elements.sidebarYear) {
            elements.sidebarYear.textContent = new Date().getFullYear();
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
        if (!elements.sliderContainer || !elements.sliderDots || !banners || banners.length === 0) {
            if (elements.bannerSlider) elements.bannerSlider.style.display = 'none';
            return;
        }
        
        elements.bannerSlider.style.display = 'block';
        
        let slidesHtml = '';
        let dotsHtml = '';
        
        banners.forEach((banner, index) => {
            // Banner bisa berupa string URL atau object dengan url dan positionX/positionY
            let bannerUrl = '';
            let positionX = 50;
            let positionY = 50;
            
            if (typeof banner === 'string') {
                bannerUrl = banner;
            } else {
                bannerUrl = banner.url || '';
                positionX = banner.positionX || banner.position || 50;
                positionY = banner.positionY || 50;
            }
            
            slidesHtml += `
                <div class="slider-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                    <div class="banner-image-container">
                        <img src="${bannerUrl}" alt="Banner ${index + 1}" 
                             style="object-position: ${positionX}% ${positionY}%;">
                    </div>
                </div>
            `;
            
            dotsHtml += `
                <span class="slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
            `;
        });
        
        elements.sliderContainer.innerHTML = slidesHtml;
        elements.sliderDots.innerHTML = dotsHtml;
        
        // Setup touch events untuk slider
        setupBannerTouchEvents();
        
        // Setup dot clicks
        document.querySelectorAll('.slider-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                goToSlide(index);
                resetAutoSlide();
            });
        });
        
        startBannerAutoSlide(banners.length);
    }

    // ==================== FUNGSI SETUP TOUCH EVENTS UNTUK BANNER ====================
    function setupBannerTouchEvents() {
        const slider = elements.sliderContainer;
        if (!slider) return;
        
        slider.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        slider.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
        // Juga support mouse untuk testing di desktop
        let mouseDown = false;
        let mouseStartX = 0;
        
        slider.addEventListener('mousedown', (e) => {
            mouseDown = true;
            mouseStartX = e.screenX;
            e.preventDefault();
        });
        
        slider.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            e.preventDefault();
        });
        
        slider.addEventListener('mouseup', (e) => {
            if (!mouseDown) return;
            const mouseEndX = e.screenX;
            const diff = mouseEndX - mouseStartX;
            
            if (Math.abs(diff) > 50) {
                const slides = document.querySelectorAll('.slider-slide');
                const totalSlides = slides.length;
                
                if (diff > 0) {
                    // Swipe kanan (previous)
                    const prevIndex = (currentBannerIndex - 1 + totalSlides) % totalSlides;
                    goToSlide(prevIndex);
                } else {
                    // Swipe kiri (next)
                    const nextIndex = (currentBannerIndex + 1) % totalSlides;
                    goToSlide(nextIndex);
                }
                resetAutoSlide();
            }
            
            mouseDown = false;
        });
        
        slider.addEventListener('mouseleave', () => {
            mouseDown = false;
        });
    }

    function handleSwipe() {
        const diff = touchEndX - touchStartX;
        const slides = document.querySelectorAll('.slider-slide');
        const totalSlides = slides.length;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                // Swipe kanan (previous)
                const prevIndex = (currentBannerIndex - 1 + totalSlides) % totalSlides;
                goToSlide(prevIndex);
            } else {
                // Swipe kiri (next)
                const nextIndex = (currentBannerIndex + 1) % totalSlides;
                goToSlide(nextIndex);
            }
            resetAutoSlide();
        }
    }

    function startBannerAutoSlide(totalSlides) {
        if (bannerInterval) clearInterval(bannerInterval);
        if (totalSlides <= 1) return;
        
        bannerInterval = setInterval(() => {
            const nextIndex = (currentBannerIndex + 1) % totalSlides;
            goToSlide(nextIndex);
        }, 3000); // 3 detik
    }

    function resetAutoSlide() {
        if (bannerInterval) {
            clearInterval(bannerInterval);
            const slides = document.querySelectorAll('.slider-slide');
            startBannerAutoSlide(slides.length);
        }
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

    // ==================== FUNGSI RENDER PRODUCTS ====================
    function renderProducts() {
        if (!elements.featuredProducts || !elements.popularProducts) return;
        
        // Filter produk berdasarkan featured dan popular
        const featured = products.filter(p => p.featured).slice(0, 4);
        const popular = products.filter(p => p.popular).slice(0, 4);
        
        renderProductGrid(elements.featuredProducts, featured);
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
                        <img src="${product.image || 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=No+Image'}" alt="${escapeHtml(product.name)}">
                        ${discount > 0 ? `<span class="product-discount">-${discount}%</span>` : ''}
                        ${product.stock <= 0 ? '<span class="product-soldout">Habis</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h3>${escapeHtml(product.name)}</h3>
                        <p class="product-desc">${escapeHtml(product.description ? product.description.substring(0, 30) : '')}...</p>
                        <div class="product-price">
                            <span class="price">${formatPrice(product.price)}</span>
                            ${product.original_price ? 
                                `<span class="original-price">${formatPrice(product.original_price)}</span>` : ''}
                        </div>
                        <div class="product-meta">
                            <span class="rating">
                                <i class="fas fa-star"></i> ${product.rating || 0}
                            </span>
                            <span class="sold">
                                <i class="fas fa-shopping-bag"></i> ${product.sold || 0} terjual
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
        
        if (payments.bank && payments.bank.length > 0) {
            payments.bank.forEach(bank => {
                html += `
                    <div class="payment-icon">
                        <img src="${bank.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank'}" alt="${bank.name}">
                        <span>${bank.name}</span>
                    </div>
                `;
            });
        }
        
        if (payments.ewallet && payments.ewallet.length > 0) {
            payments.ewallet.forEach(wallet => {
                html += `
                    <div class="payment-icon">
                        <img src="${wallet.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Wallet'}" alt="${wallet.name}">
                        <span>${wallet.name}</span>
                    </div>
                `;
            });
        }
        
        if (payments.qris && payments.qris.enabled) {
            html += `
                <div class="payment-icon">
                    <i class="fas fa-qrcode"></i>
                    <span>QRIS</span>
                </div>
            `;
        }
        
        if (html === '') {
            elements.paymentIcons.innerHTML = '<div class="empty-message">Belum ada metode pembayaran</div>';
        } else {
            elements.paymentIcons.innerHTML = html;
        }
    }

    // ==================== FUNGSI CART ====================
    function loadCart() {
        if (!currentEndpoint) return;
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
        if (!currentEndpoint) return;
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
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (elements.cartBadge) {
            elements.cartBadge.textContent = totalItems;
            elements.cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        
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
                        <img src="${item.image || 'https://via.placeholder.com/60x60/40a7e3/ffffff?text=Product'}" alt="${escapeHtml(item.name)}">
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
                    <img src="${product.image || 'https://via.placeholder.com/400x400/40a7e3/ffffff?text=Product'}" alt="${escapeHtml(product.name)}" id="mainProductImage">
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
                            `<i class="fas fa-star${i < Math.floor(product.rating || 0) ? '' : i < (product.rating || 0) ? '-half-alt' : '-o'}"></i>`
                        ).join('')}
                    </div>
                    <span>${product.rating || 0} (${product.reviews || 0} ulasan)</span>
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
                    <span>Stok: <strong>${product.stock || 0}</strong></span>
                    <span class="sold-count"><i class="fas fa-shopping-bag"></i> ${product.sold || 0} terjual</span>
                </div>
                <div class="product-description">
                    <h4>Deskripsi</h4>
                    <p>${escapeHtml(product.description || 'Tidak ada deskripsi')}</p>
                </div>
                ${variantsHtml}
                <div class="product-notes">
                    <h4>Catatan</h4>
                    <p>${escapeHtml(product.notes || '')}</p>
                </div>
                <div class="product-actions-detail">
                    <div class="quantity-selector">
                        <button class="qty-btn" id="detailQtyMinus">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" id="detailQty" value="1" min="1" max="${product.stock || 999}">
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
        
        // Setup event listeners untuk variant
        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Setup quantity selector
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
                if (val < (product.stock || 999)) {
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
            const guestUser = {
                id: Date.now(),
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
        
        localStorage.setItem(`user_${currentEndpoint}`, JSON.stringify(user));
    }

    function loadUser() {
        if (!currentEndpoint) return;
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
        
        currentEndpoint = getEndpointFromUrl();
        console.log('📍 Endpoint:', currentEndpoint);
        
        if (!currentEndpoint) {
            showToast('Endpoint tidak valid. Gunakan ?store=nama-endpoint', 'error');
            return;
        }
        
        setupKeyboardHandler();
        
        await loadWebsiteData(currentEndpoint);
        
        loadCart();
        loadUser();
        
        setupEventListeners();
        
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            
            if (tg.initDataUnsafe?.user && !currentUser) {
                setUser(tg.initDataUnsafe.user);
            }
        }
        
        console.log('✅ Website initialized');
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
        if (elements.menuToggle) {
            elements.menuToggle.addEventListener('click', toggleSidebar);
        }
        
        if (elements.sidebarClose) {
            elements.sidebarClose.addEventListener('click', closeSidebar);
        }
        
        if (elements.cartBtn) {
            elements.cartBtn.addEventListener('click', openCart);
        }
        
        if (elements.cartClose) {
            elements.cartClose.addEventListener('click', closeCart);
        }
        
        if (elements.searchToggle) {
            elements.searchToggle.addEventListener('click', toggleSearch);
        }
        
        if (elements.searchClose) {
            elements.searchClose.addEventListener('click', toggleSearch);
        }
        
        if (elements.shopNowBtn) {
            elements.shopNowBtn.addEventListener('click', () => {
                closeCart();
                document.querySelector('.featured-products')?.scrollIntoView({ behavior: 'smooth' });
            });
        }
        
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
        
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', openLoginModal);
        }
        
        if (elements.telegramLogin) {
            elements.telegramLogin.addEventListener('click', loginWithTelegram);
        }
        
        if (elements.guestLogin) {
            elements.guestLogin.addEventListener('click', loginAsGuest);
        }
        
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
                
                if (elements.checkoutModal) {
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
                                ${websiteData?.settings?.payments?.bank?.map(bank => `
                                    <label class="payment-option">
                                        <input type="radio" name="payment" value="bank_${bank.name}">
                                        <img src="${bank.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank'}" alt="${bank.name}">
                                        <span>${bank.name}</span>
                                    </label>
                                `).join('')}
                                ${websiteData?.settings?.payments?.ewallet?.map(wallet => `
                                    <label class="payment-option">
                                        <input type="radio" name="payment" value="ewallet_${wallet.name}">
                                        <img src="${wallet.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Wallet'}" alt="${wallet.name}">
                                        <span>${wallet.name}</span>
                                    </label>
                                `).join('')}
                                ${websiteData?.settings?.payments?.qris?.enabled ? `
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

    // ==================== FUNGSI KEYBOARD HANDLER ====================
    function setupKeyboardHandler() {
        function scrollToInput(input) {
            const rect = input.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight * 0.4;
            
            if (rect.bottom > windowHeight - keyboardHeight) {
                const scrollY = window.scrollY + rect.bottom - (windowHeight - keyboardHeight) + 20;
                window.scrollTo({ top: scrollY, behavior: 'smooth' });
            }
        }
        
        const modalInputs = document.querySelectorAll('.modal input, .modal textarea, .modal select');
        
        modalInputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    scrollToInput(input);
                    
                    const modal = input.closest('.modal');
                    if (modal) {
                        modal.classList.add('modal-with-input');
                        const modalContent = modal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.maxHeight = '70vh';
                            modalContent.style.overflowY = 'auto';
                        }
                    }
                }, 300);
            });
            
            input.addEventListener('blur', () => {
                const modal = input.closest('.modal');
                if (modal) {
                    modal.classList.remove('modal-with-input');
                }
            });
        });
        
        document.addEventListener('touchstart', (e) => {
            const activeElement = document.activeElement;
            if (!activeElement) return;
            
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT' ||
                           e.target.closest('.modal-content');
            
            if (!isInput && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                activeElement.blur();
            }
        });
        
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', () => {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                    activeElement.blur();
                }
            });
        });
        
        let viewportHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            const newHeight = window.innerHeight;
            
            if (newHeight < viewportHeight * 0.7) {
                document.body.classList.add('keyboard-visible');
            } else if (newHeight > viewportHeight * 0.8) {
                document.body.classList.remove('keyboard-visible');
            }
            
            viewportHeight = newHeight;
        });
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

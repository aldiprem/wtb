// website.js - Enhanced Version dengan Animasi dan Fitur Modern
(function() {
    'use strict';
    
    console.log('🏪 Website Store Modern - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const ANIMATION_DURATION = 300;

    // ==================== FUNGSI GET ENDPOINT DARI URL ====================
    function getEndpointFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('store');
        console.log('📍 Endpoint from URL:', endpoint);
        return endpoint;
    }

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
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
        profileVerified: document.getElementById('profileVerified'),
        loginBtn: document.getElementById('loginBtn'),
        orderBadge: document.getElementById('orderBadge'),
        
        // Header
        storeName: document.getElementById('storeName'),
        headerLogo: document.getElementById('headerLogo'),
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
        sliderPrev: document.getElementById('sliderPrev'),
        sliderNext: document.getElementById('sliderNext'),
        sliderPagination: document.getElementById('sliderPagination'),
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
        contactEmail: document.getElementById('contactEmail'),
        footerStoreName: document.getElementById('footerStoreName'),
        footerStoreName2: document.getElementById('footerStoreName2'),
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
    let currentWebsite = null;
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
    let retryCount = 0;
    let isLoading = false;
    let structuredProducts = null;

    // ==================== FUNGSI LOADING OVERLAY ====================
    function showLoading(message = 'Memuat website...') {
        if (isLoading) return;
        isLoading = true;
        
        if (elements.loadingOverlay) {
            const loadingText = elements.loadingOverlay.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = message;
            elements.loadingOverlay.style.display = 'flex';
            
            const loadingBar = elements.loadingOverlay.querySelector('.loading-bar');
            if (loadingBar) {
                loadingBar.style.animation = 'none';
                loadingBar.offsetHeight;
                loadingBar.style.animation = 'loading 2s ease-in-out infinite';
            }
        }
    }

    function hideLoading() {
        if (!isLoading) return;
        
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                elements.loadingOverlay.style.display = 'none';
                elements.loadingOverlay.style.opacity = '1';
                isLoading = false;
            }, 500);
        } else {
            isLoading = false;
        }
    }

    // ==================== FUNGSI UTILITY ====================
    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
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

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== FUNGSI TOAST ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 
                     type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        toast.offsetHeight;
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // ==================== FUNGSI FETCH DENGAN RETRY ====================
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                cache: 'no-cache',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (retries > 0 && error.name !== 'AbortError') {
                console.log(`🔄 Retry... ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function loadWebsiteData(endpoint) {
      showLoading('Memuat data website...');
    
      try {
        console.log(`📡 Loading website data for endpoint: ${end}`);
    
        const result = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
    
        console.log('📥 Website data:', result);
    
        if (result.success && result.website) {
          const data = result.website;
          websiteData = data;
          currentWebsite = data; // <-- TAMBAHKAN INI
    
          await loadTampilanData(data.id);
    
          if (data.products && Array.isArray(data.products)) {
            products = data.products;
          } else {
            products = [];
          }
    
          categories = data.categories || [];
    
          updateWebsiteUI(data);
          renderAllComponents();
    
          setTimeout(() => {
            animateElements();
          }, 100);
    
          hideLoading();
          return data;
        } else {
          throw new Error('Invalid response from server');
        }
    
      } catch (error) {
        console.error('❌ Error loading website:', error);
        hideLoading();
    
        if (elements.storeName) {
          elements.storeName.textContent = 'Website Tidak Ditemukan';
        }
    
        showToast(error.message || 'Gagal memuat data website', 'error');
        clearAllContent();
    
        return null;
      }
    }

    function animateElements() {
        document.querySelectorAll('.category-card').forEach((card, index) => {
            card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s forwards`;
        });
        
        document.querySelectorAll('.product-card').forEach((card, index) => {
            card.style.animation = `fadeInUp 0.5s ease ${index * 0.05}s forwards`;
        });
    }

    // ==================== FUNGSI LOAD TAMPILAN DATA ====================
    async function loadTampilanData(websiteId) {
        try {
            console.log(`📡 Loading tampilan data for website ID: ${websiteId}`);
            
            const result = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${websiteId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (result.success && result.tampilan) {
                tampilanData = result.tampilan;
                console.log('📥 Tampilan data:', tampilanData);
            } else {
                console.log('ℹ️ No tampilan data found, using defaults');
                tampilanData = null;
            }
            
        } catch (error) {
            if (error.message.includes('404')) {
                console.log('ℹ️ No tampilan data found, using defaults');
                tampilanData = null;
            } else {
                console.error('❌ Error loading tampilan:', error);
                tampilanData = null;
            }
        }
    }

    function clearAllContent() {
        if (elements.sliderContainer) elements.sliderContainer.innerHTML = '';
        if (elements.categoriesGrid) elements.categoriesGrid.innerHTML = '';
        if (elements.featuredProducts) elements.featuredProducts.innerHTML = '';
        if (elements.popularProducts) elements.popularProducts.innerHTML = '';
        if (elements.promoBanner) elements.promoBanner.innerHTML = '';
        if (elements.paymentIcons) elements.paymentIcons.innerHTML = '';
        
        if (elements.bannerSlider) elements.bannerSlider.style.display = 'none';
    }

    // ==================== FUNGSI-FUNGSI RENDER UTAMA ====================
    
    // 1. FUNGSI RENDER LOGO
    function renderLogo() {
        let headerLogoContainer = elements.headerLogo;
        if (!headerLogoContainer) return;
        
        if (tampilanData?.logo) {
            headerLogoContainer.innerHTML = `
                <img src="${tampilanData.logo}" alt="Logo" class="header-logo-img" 
                     style="height: 40px; width: auto; object-fit: contain;" 
                     onload="this.style.opacity='1';" 
                     style="opacity:0; transition:opacity 0.3s"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="header-logo-fallback" style="display: none; align-items: center; gap: 8px;">
                    <i class="fas fa-store"></i>
                    <span id="storeName">${websiteData?.username || 'Toko Online'}</span>
                </div>
            `;
            
            const logoImg = headerLogoContainer.querySelector('img');
            const fallback = headerLogoContainer.querySelector('.header-logo-fallback');
            
            logoImg.onload = function() {
                this.style.opacity = '1';
            };
            
            logoImg.onerror = function() {
                this.style.display = 'none';
                if (fallback) fallback.style.display = 'flex';
            };
        } else {
            headerLogoContainer.innerHTML = `
                <i class="fas fa-store"></i>
                <span id="storeName">${websiteData?.username || 'Toko Online'}</span>
            `;
        }
    }

    // 2. FUNGSI RENDER PAYMENT METHODS
    function renderPaymentMethods() {
        if (!elements.paymentIcons) return;
        
        let html = '';
        let hasPayments = false;
        
        if (tampilanData?.banks && tampilanData.banks.length > 0) {
            tampilanData.banks.forEach(bank => {
                if (bank.enabled) {
                    hasPayments = true;
                    html += `
                        <div class="payment-icon">
                            <i class="fas fa-university"></i>
                            <span>${bank.bank_name || 'Bank'}</span>
                        </div>
                    `;
                }
            });
        }
        
        if (tampilanData?.ewallets && tampilanData.ewallets.length > 0) {
            tampilanData.ewallets.forEach(ewallet => {
                if (ewallet.enabled) {
                    hasPayments = true;
                    html += `
                        <div class="payment-icon">
                            <i class="fas fa-wallet"></i>
                            <span>${ewallet.provider || 'E-Wallet'}</span>
                        </div>
                    `;
                }
            });
        }
        
        if (tampilanData?.qris && tampilanData.qris.enabled) {
            hasPayments = true;
            html += `
                <div class="payment-icon">
                    <i class="fas fa-qrcode"></i>
                    <span>QRIS</span>
                </div>
            `;
        }
        
        if (tampilanData?.crypto && tampilanData.crypto.enabled) {
            hasPayments = true;
            html += `
                <div class="payment-icon">
                    <i class="fab fa-bitcoin"></i>
                    <span>Crypto</span>
                </div>
            `;
        }
        
        if (!hasPayments && websiteData?.settings?.payments) {
            renderPaymentMethodsFromSettings(websiteData.settings.payments);
            return;
        }
        
        if (!hasPayments) {
            elements.paymentIcons.innerHTML = '<div class="empty-message">Belum ada metode pembayaran</div>';
        } else {
            elements.paymentIcons.innerHTML = html;
        }
    }

    function renderPaymentMethodsFromSettings(payments) {
        if (!elements.paymentIcons) return;
        
        let html = '';
        
        if (payments.bank && payments.bank.length > 0) {
            payments.bank.forEach(bank => {
                html += `
                    <div class="payment-icon">
                        <img src="${bank.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank'}" 
                             alt="${bank.name}" 
                             onerror="this.src='https://via.placeholder.com/40x40/40a7e3/ffffff?text=Bank';">
                        <span>${bank.name}</span>
                    </div>
                `;
            });
        }
        
        if (payments.ewallet && payments.ewallet.length > 0) {
            payments.ewallet.forEach(wallet => {
                html += `
                    <div class="payment-icon">
                        <img src="${wallet.icon || 'https://via.placeholder.com/40x40/40a7e3/ffffff?text=Wallet'}" 
                             alt="${wallet.name}" 
                             onerror="this.src='https://via.placeholder.com/40x40/40a7e3/ffffff?text=Wallet';">
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

    // 3. FUNGSI UPDATE UI
    function updateWebsiteUI(data) {
        if (elements.dynamicTitle) {
            elements.dynamicTitle.textContent = tampilanData?.seo_title || data.settings?.title || 'Toko Online';
        }
        if (elements.dynamicDescription) {
            elements.dynamicDescription.content = tampilanData?.seo_description || data.settings?.description || 'Toko online terpercaya';
        }
        if (elements.dynamicKeywords) {
            elements.dynamicKeywords.content = tampilanData?.seo_keywords || data.settings?.seo?.keywords || 'toko, online, topup';
        }
        
        const storeName = data.username || 'Toko Online';
        if (elements.storeName) elements.storeName.textContent = storeName;
        if (elements.sidebarStoreName) elements.sidebarStoreName.textContent = storeName;
        if (elements.footerStoreName) elements.footerStoreName.textContent = storeName;
        if (elements.footerStoreName2) elements.footerStoreName2.textContent = storeName;
        
        if (elements.footerDescription) {
            elements.footerDescription.textContent = tampilanData?.description || data.settings?.description || 'Toko online terpercaya sejak 2024 dengan ribuan produk berkualitas dan pelayanan terbaik.';
        }
        
        if (elements.contactWhatsApp) {
            elements.contactWhatsApp.textContent = tampilanData?.contact_whatsapp || data.settings?.contact?.whatsapp || '-';
        }
        if (elements.contactTelegram) {
            elements.contactTelegram.textContent = tampilanData?.contact_telegram || data.settings?.contact?.telegram || '-';
        }
        if (elements.contactEmail) {
            elements.contactEmail.textContent = data.email || 'support@example.com';
        }
        
        if (elements.sidebarAvatar && currentUser) {
            const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'User';
            const img = elements.sidebarAvatar.querySelector('img');
            if (img) {
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=80&background=40a7e3&color=fff`;
            }
        }
        
        if (elements.sidebarYear) {
            elements.sidebarYear.textContent = new Date().getFullYear();
        }
    }

    function applyThemeColors(colors) {
        if (!colors) return;
        
        const root = document.documentElement;
        if (colors.primary) root.style.setProperty('--primary-color', colors.primary);
        if (colors.secondary) root.style.setProperty('--secondary-color', colors.secondary);
        if (colors.background) root.style.setProperty('--bg-color', colors.background);
        if (colors.text) root.style.setProperty('--text-color', colors.text);
        if (colors.card) root.style.setProperty('--card-bg', colors.card);
        if (colors.accent) root.style.setProperty('--accent-color', colors.accent);
    }

    function applyFont(font) {
        if (!font) return;
        
        const root = document.documentElement;
        if (font.family) {
            root.style.setProperty('--font-family', font.family);
            document.body.style.fontFamily = font.family;
        }
        if (font.size) {
            root.style.setProperty('--font-size', `${font.size}px`);
        }
    }

    // 4. FUNGSI RENDER BANNER
    function renderBanners(banners) {
        if (!elements.sliderContainer || !banners || banners.length === 0) {
            if (elements.bannerSlider) elements.bannerSlider.style.display = 'none';
            return;
        }
        
        elements.bannerSlider.style.display = 'block';
        
        let slidesHtml = '';
        let paginationHtml = '';
        let dotsHtml = '';
        
        banners.forEach((banner, index) => {
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
                             style="object-position: ${positionX}% ${positionY}%;"
                             onload="this.style.opacity='1'"
                             style="opacity:0; transition:opacity 0.5s"
                             onerror="this.src='https://via.placeholder.com/800x400/40a7e3/ffffff?text=Banner+${index+1}'; this.onload=null;">
                    </div>
                </div>
            `;
            
            paginationHtml += `
                <span class="${index === 0 ? 'active' : ''}" data-index="${index}"></span>
            `;
            
            dotsHtml += `
                <span class="slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
            `;
        });
        
        elements.sliderContainer.innerHTML = slidesHtml;
        if (elements.sliderPagination) elements.sliderPagination.innerHTML = paginationHtml;
        if (elements.sliderDots) elements.sliderDots.innerHTML = dotsHtml;
        
        document.querySelectorAll('.slider-slide img').forEach(img => {
            if (img.complete) {
                img.style.opacity = '1';
            }
        });
        
        setupBannerEvents(banners.length);
    }

    function setupBannerEvents(totalSlides) {
        if (totalSlides <= 1) {
            if (elements.sliderPrev) elements.sliderPrev.style.display = 'none';
            if (elements.sliderNext) elements.sliderNext.style.display = 'none';
            if (elements.sliderPagination) elements.sliderPagination.style.display = 'none';
            return;
        }
        
        if (elements.sliderPrev) {
            elements.sliderPrev.addEventListener('click', () => {
                const prevIndex = (currentBannerIndex - 1 + totalSlides) % totalSlides;
                goToSlide(prevIndex);
                resetAutoSlide();
            });
        }
        
        if (elements.sliderNext) {
            elements.sliderNext.addEventListener('click', () => {
                const nextIndex = (currentBannerIndex + 1) % totalSlides;
                goToSlide(nextIndex);
                resetAutoSlide();
            });
        }
        
        if (elements.sliderPagination) {
            elements.sliderPagination.querySelectorAll('span').forEach(dot => {
                dot.addEventListener('click', () => {
                    const index = parseInt(dot.dataset.index);
                    goToSlide(index);
                    resetAutoSlide();
                });
            });
        }
        
        setupBannerTouchEvents();
        
        startBannerAutoSlide(totalSlides);
    }

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
                    const prevIndex = (currentBannerIndex - 1 + totalSlides) % totalSlides;
                    goToSlide(prevIndex);
                } else {
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
                const prevIndex = (currentBannerIndex - 1 + totalSlides) % totalSlides;
                goToSlide(prevIndex);
            } else {
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
        }, 5000);
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
        const paginationSpans = elements.sliderPagination?.querySelectorAll('span');
        const dots = document.querySelectorAll('.slider-dot');
        
        if (!slides.length) return;
        
        slides.forEach(slide => slide.classList.remove('active'));
        slides[index].classList.add('active');
        
        if (paginationSpans) {
            paginationSpans.forEach(dot => dot.classList.remove('active'));
            paginationSpans[index]?.classList.add('active');
        }
        
        if (dots.length) {
            dots.forEach(dot => dot.classList.remove('active'));
            dots[index]?.classList.add('active');
        }
        
        currentBannerIndex = index;
    }

    // ==================== FUNGSI-FUNGSI RENDER PRODUK DAN LAYANAN (YANG DIPERBAIKI) ====================

    // Fungsi untuk mengambil data produk terstruktur
    async function fetchStructuredProducts(websiteId) {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/products/all/${websiteId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.success && response.data) {
                structuredProducts = response.data;
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching structured products:', error);
            return null;
        }
    }

    // FUNGSI RENDER LAYANAN (KATEGORI)
    function renderCategories() {
        if (!elements.categoriesGrid) return;
        
        let html = '';
        
        // Coba ambil data dari websiteData?.products (array biasa)
        if (websiteData?.products && Array.isArray(websiteData.products) && websiteData.products.length > 0) {
            // Kelompokkan produk berdasarkan kategori/layanan
            const layananMap = new Map();
            
            websiteData.products.forEach(product => {
                const kategori = product.category || 'Lainnya';
                if (!layananMap.has(kategori)) {
                    layananMap.set(kategori, {
                        nama: kategori,
                        count: 0,
                        icon: product.category_icon || 'fa-tag'
                    });
                }
                layananMap.get(kategori).count++;
            });
            
            // Konversi ke array dan ambil 6 pertama
            const layananList = Array.from(layananMap.values()).slice(0, 6);
            
            layananList.forEach(layanan => {
                html += `
                    <div class="category-card" data-layanan="${layanan.nama}">
                        <div class="category-icon">
                            <i class="fas ${layanan.icon}"></i>
                        </div>
                        <div class="category-info">
                            <h4>${escapeHtml(layanan.nama)}</h4>
                            <span><i class="fas fa-box"></i> ${layanan.count} Produk</span>
                        </div>
                    </div>
                `;
            });
            
            elements.categoriesGrid.innerHTML = html;
        } 
        // Coba ambil dari API /api/products/all/{website_id} jika ada
        else if (currentWebsite?.id) {
            fetchStructuredProducts(currentWebsite.id).then(structuredData => {
                if (structuredData && structuredData.length > 0) {
                    renderStructuredCategories(structuredData);
                } else {
                    renderDummyCategories();
                }
            }).catch(() => {
                renderDummyCategories();
            });
            return;
        }
        else {
            renderDummyCategories();
            return;
        }
        
        // Event listener untuk klik kategori
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const layanan = card.dataset.layanan || card.querySelector('h4').textContent;
                showToast(`Layanan: ${layanan}`, 'info');
            });
        });
    }

    // Fungsi untuk render kategori dari data terstruktur
    function renderStructuredCategories(structuredData) {
        if (!elements.categoriesGrid) return;
        
        let html = '';
        
        // Ambil 6 layanan pertama
        structuredData.slice(0, 6).forEach(layanan => {
            const totalAplikasi = layanan.aplikasi?.length || 0;
            const totalItems = layanan.aplikasi?.reduce((sum, app) => sum + (app.items?.length || 0), 0) || 0;
            
            html += `
                <div class="category-card" data-layanan="${layanan.layanan_nama}">
                    <div class="category-icon">
                        ${layanan.layanan_gambar ? 
                            `<img src="${layanan.layanan_gambar}" alt="${layanan.layanan_nama}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                            `<i class="fas fa-layer-group"></i>`
                        }
                    </div>
                    <div class="category-info">
                        <h4>${escapeHtml(layanan.layanan_nama)}</h4>
                        <span><i class="fas fa-mobile-alt"></i> ${totalAplikasi} Aplikasi • ${totalItems} Item</span>
                    </div>
                </div>
            `;
        });
        
        elements.categoriesGrid.innerHTML = html;
        
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const layanan = card.dataset.layanan || card.querySelector('h4').textContent;
                showToast(`Layanan: ${layanan}`, 'info');
            });
        });
    }

    // Fungsi untuk render dummy categories
    function renderDummyCategories() {
        if (!elements.categoriesGrid) return;
        
        const dummyLayanan = [
            { nama: 'Premium Apps', icon: 'fa-crown', count: 12 },
            { nama: 'Game Voucher', icon: 'fa-gamepad', count: 24 },
            { nama: 'Streaming', icon: 'fa-film', count: 8 },
            { nama: 'Software', icon: 'fa-code', count: 15 },
            { nama: 'Top Up Games', icon: 'fa-diamond', count: 32 },
            { nama: 'E-Book', icon: 'fa-book', count: 45 }
        ];
        
        let html = '';
        dummyLayanan.forEach(layanan => {
            html += `
                <div class="category-card">
                    <div class="category-icon">
                        <i class="fas ${layanan.icon}"></i>
                    </div>
                    <div class="category-info">
                        <h4>${layanan.nama}</h4>
                        <span><i class="fas fa-box"></i> ${layanan.count} Produk</span>
                    </div>
                </div>
            `;
        });
        
        elements.categoriesGrid.innerHTML = html;
    }

    // FUNGSI RENDER PRODUK TERLARIS
    function renderPopularProducts() {
        if (!elements.popularProducts) return;
        
        let productsToRender = [];
        
        // Coba dari websiteData.products
        if (websiteData?.products && Array.isArray(websiteData.products) && websiteData.products.length > 0) {
            productsToRender = [...websiteData.products]
                .sort((a, b) => (b.sold || 0) - (a.sold || 0))
                .slice(0, 6)
                .map(p => ({
                    id: p.id,
                    nama: p.name,
                    aplikasi: p.category || 'Aplikasi',
                    icon: 'fa-box',
                    item_count: p.stock || 0,
                    terjual: p.sold || 0,
                    harga: p.price || 25000,
                    gambar: p.image
                }));
        }
        
        // Jika masih kosong, coba dari structured data
        if (productsToRender.length === 0 && currentWebsite?.id) {
            fetchStructuredProducts(currentWebsite.id).then(structuredData => {
                if (structuredData && structuredData.length > 0) {
                    const allItems = [];
                    structuredData.forEach(layanan => {
                        layanan.aplikasi?.forEach(aplikasi => {
                            aplikasi.items?.forEach(item => {
                                allItems.push({
                                    id: item.id,
                                    nama: item.item_nama,
                                    aplikasi: aplikasi.aplikasi_nama,
                                    icon: 'fa-box',
                                    item_count: 1,
                                    terjual: item.terjual || 0,
                                    harga: item.item_harga || 0,
                                    gambar: aplikasi.aplikasi_gambar || layanan.layanan_gambar
                                });
                            });
                        });
                    });
                    
                    const topItems = allItems
                        .sort((a, b) => b.terjual - a.terjual)
                        .slice(0, 6);
                    
                    renderPopularProductsGrid(topItems);
                } else {
                    renderDummyPopularProducts();
                }
            }).catch(() => {
                renderDummyPopularProducts();
            });
            return;
        }
        
        if (productsToRender.length === 0) {
            renderDummyPopularProducts();
        } else {
            renderPopularProductsGrid(productsToRender);
        }
    }

    function renderPopularProductsGrid(products) {
        if (!elements.popularProducts) return;
        
        let html = '';
        products.forEach(product => {
            const icon = product.icon || 'fa-box';
            const gambar = product.gambar || `https://via.placeholder.com/120x80/40a7e3/ffffff?text=${encodeURIComponent(product.nama)}`;
            
            html += `
                <div class="popular-product-card" data-id="${product.id}">
                    <div class="popular-product-image">
                        <img src="${gambar}" alt="${escapeHtml(product.nama)}" 
                             onerror="this.src='https://via.placeholder.com/120x80/40a7e3/ffffff?text=Product';">
                    </div>
                    <div class="popular-product-info">
                        <h3><i class="fas ${icon}"></i> ${escapeHtml(product.nama)}</h3>
                        <div class="popular-product-desc">
                            <i class="fas fa-mobile-alt"></i> ${escapeHtml(product.aplikasi || 'Aplikasi')}
                        </div>
                        <div class="popular-product-stats">
                            <span><i class="fas fa-box"></i> ${product.item_count || 0} item</span>
                            <span><i class="fas fa-shopping-bag"></i> ${product.terjual || 0} terjual</span>
                        </div>
                        <div class="popular-product-price">
                            Mulai ${formatPrice(product.harga || 25000)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.popularProducts.innerHTML = html;
        
        document.querySelectorAll('.popular-product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.id;
                if (productId) {
                    openProductModal(parseInt(productId));
                }
            });
        });
    }

    function renderDummyPopularProducts() {
        const dummyProducts = [
            { 
                id: 1, 
                nama: 'Canva Premium', 
                aplikasi: 'Canva',
                icon: 'fa-paint-brush',
                item_count: 28, 
                terjual: 156,
                harga: 25000,
                gambar: 'https://via.placeholder.com/120x80/40a7e3/ffffff?text=Canva'
            },
            { 
                id: 2, 
                nama: 'Netflix 4K', 
                aplikasi: 'Netflix',
                icon: 'fa-film',
                item_count: 15, 
                terjual: 324,
                harga: 45000,
                gambar: 'https://via.placeholder.com/120x80/e50914/ffffff?text=Netflix'
            },
            { 
                id: 3, 
                nama: 'Spotify Premium', 
                aplikasi: 'Spotify',
                icon: 'fa-music',
                item_count: 42, 
                terjual: 567,
                harga: 35000,
                gambar: 'https://via.placeholder.com/120x80/1DB954/ffffff?text=Spotify'
            },
            { 
                id: 4, 
                nama: 'Disney+ Hotstar', 
                aplikasi: 'Disney+',
                icon: 'fa-magic',
                item_count: 19, 
                terjual: 89,
                harga: 40000,
                gambar: 'https://via.placeholder.com/120x80/113CCF/ffffff?text=Disney'
            },
            { 
                id: 5, 
                nama: 'YouTube Premium', 
                aplikasi: 'YouTube',
                icon: 'fa-youtube',
                item_count: 23, 
                terjual: 432,
                harga: 38000,
                gambar: 'https://via.placeholder.com/120x80/FF0000/ffffff?text=YouTube'
            },
            { 
                id: 6, 
                nama: 'Microsoft 365', 
                aplikasi: 'Office',
                icon: 'fa-microsoft',
                item_count: 11, 
                terjual: 78,
                harga: 55000,
                gambar: 'https://via.placeholder.com/120x80/00A4EF/ffffff?text=Office'
            }
        ];
        
        renderPopularProductsGrid(dummyProducts);
    }

    // FUNGSI RENDER PROMO SLIDER
    function renderPromoSlider() {
        const sliderTrack = document.getElementById('promoSliderTrack');
        const sliderDots = document.getElementById('promoSliderDots');
        const prevBtn = document.getElementById('promoSliderPrev');
        const nextBtn = document.getElementById('promoSliderNext');
        
        if (!sliderTrack) return;
        
        let promos = [];
        let currentPromoIndex = 0;
        
        if (tampilanData?.promos && Array.isArray(tampilanData.promos) && tampilanData.promos.length > 0) {
            promos = tampilanData.promos.filter(p => p.active !== false);
        }
        
        if (promos.length === 0) {
            promos = [
                {
                    id: 1,
                    title: 'Promo Akhir Bulan',
                    banner: 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo+1',
                    description: 'Diskon hingga 50% untuk semua produk premium',
                    end_date: '2024-12-31',
                    never_end: false,
                    notes: 'Minimal pembelian Rp 50.000'
                },
                {
                    id: 2,
                    title: 'Flash Sale',
                    banner: 'https://via.placeholder.com/1280x760/ff6b6b/ffffff?text=Flash+Sale',
                    description: 'Promo spesial 12.12',
                    end_date: '2024-12-12',
                    never_end: false,
                    notes: 'Terbatas untuk 100 pembeli pertama'
                },
                {
                    id: 3,
                    title: 'Promo Spesial',
                    banner: 'https://via.placeholder.com/1280x760/10b981/ffffff?text=Promo+Spesial',
                    description: 'Bonus untuk member baru',
                    never_end: true,
                    notes: 'Khusus pengguna baru'
                }
            ];
        }
        
        let slidesHtml = '';
        let dotsHtml = '';
        
        promos.forEach((promo, index) => {
            const expiryText = promo.never_end 
                ? '<span class="promo-expiry never"><i class="fas fa-infinity"></i> Tidak ada batas</span>'
                : `<span class="promo-expiry"><i class="fas fa-clock"></i> ${formatDate(promo.end_date, promo.end_time)}</span>`;
            
            slidesHtml += `
                <div class="promo-card" data-index="${index}">
                    <div class="promo-banner-wrapper">
                        <img src="${promo.banner || 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo'}" 
                             alt="${escapeHtml(promo.title)}"
                             onerror="this.src='https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Promo';">
                    </div>
                    <div class="promo-content">
                        <h3 class="promo-title">${escapeHtml(promo.title)}</h3>
                        ${promo.description ? `<p class="promo-description">${escapeHtml(promo.description)}</p>` : ''}
                        <div class="promo-meta">
                            ${expiryText}
                            <span class="promo-status active">
                                <i class="fas fa-check-circle"></i> Aktif
                            </span>
                        </div>
                        ${promo.notes ? `
                            <div class="promo-notes">
                                <i class="fas fa-sticky-note"></i> ${escapeHtml(promo.notes)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            dotsHtml += `<span class="promo-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`;
        });
        
        sliderTrack.innerHTML = slidesHtml;
        if (sliderDots) sliderDots.innerHTML = dotsHtml;
        
        if (promos.length > 1) {
            const updateSlider = (index) => {
                currentPromoIndex = index;
                sliderTrack.style.transform = `translateX(-${currentPromoIndex * 100}%)`;
                
                document.querySelectorAll('.promo-dot').forEach((dot, i) => {
                    dot.classList.toggle('active', i === currentPromoIndex);
                });
            };
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    currentPromoIndex = (currentPromoIndex - 1 + promos.length) % promos.length;
                    updateSlider(currentPromoIndex);
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    currentPromoIndex = (currentPromoIndex + 1) % promos.length;
                    updateSlider(currentPromoIndex);
                });
            }
            
            document.querySelectorAll('.promo-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const index = parseInt(dot.dataset.index);
                    updateSlider(index);
                });
            });
        } else {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (sliderDots) sliderDots.style.display = 'none';
        }
    }

    // FUNGSI RENDER ALL COMPONENTS (UPDATE)
    function renderAllComponents() {
        renderLogo();
        
        if (tampilanData?.banners && Array.isArray(tampilanData.banners) && tampilanData.banners.length > 0) {
            renderBanners(tampilanData.banners);
        } else {
            if (elements.bannerSlider) elements.bannerSlider.style.display = 'none';
        }
        
        renderCategories();
        renderPopularProducts();
        renderPromoSlider();
        renderPaymentMethods();
        
        if (tampilanData?.colors) {
            applyThemeColors(tampilanData.colors);
        }
        
        if (tampilanData) {
            applyFont({
                family: tampilanData.font_family || 'Inter',
                size: tampilanData.font_size || 14
            });
        }
        
        setTimeout(() => {
            animateElements();
        }, 100);
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
            
            const stars = generateStars(product.rating || 4.5);
            
            html += `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-image">
                        <img src="${product.image || 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=No+Image'}" 
                             alt="${escapeHtml(product.name)}"
                             loading="lazy"
                             onload="this.style.opacity='1'"
                             style="opacity:0; transition:opacity 0.3s"
                             onerror="this.src='https://via.placeholder.com/300x200/40a7e3/ffffff?text=No+Image'; this.onload=null;">
                        <div class="product-badges">
                            ${discount > 0 ? `<span class="product-discount">-${discount}%</span>` : ''}
                            ${product.stock <= 0 ? '<span class="product-soldout">Habis</span>' : ''}
                        </div>
                    </div>
                    <div class="product-info">
                        <h3>${escapeHtml(product.name)}</h3>
                        <p class="product-desc">${escapeHtml(product.description ? product.description.substring(0, 40) + '...' : 'Produk berkualitas')}</p>
                        <div class="product-price">
                            <span class="price">${formatPrice(product.price)}</span>
                            ${product.original_price ? 
                                `<span class="original-price">${formatPrice(product.original_price)}</span>` : ''}
                        </div>
                        <div class="product-meta">
                            <span class="rating">
                                ${stars} ${product.rating || 0}
                            </span>
                            <span class="sold">
                                <i class="fas fa-shopping-bag"></i> ${product.sold || 0} terjual
                            </span>
                        </div>
                        <button class="btn-add-cart" onclick="event.stopPropagation(); window.website.addToCart(${product.id})">
                            <i class="fas fa-cart-plus"></i>
                            <span>Tambah ke Keranjang</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('.product-image img').forEach(img => {
            imageObserver.observe(img);
        });
        
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.id;
                if (productId) {
                    openProductModal(parseInt(productId));
                }
            });
        });
    }

    function generateStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        if (halfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }

    function formatDate(dateString, timeString) {
        if (!dateString) return 'Tanpa batas waktu';
        try {
            const date = new Date(dateString + 'T' + (timeString || '00:00'));
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

    function getDummyProducts() {
        return [
            {
                id: 1,
                name: 'Paket Premium 1 Bulan',
                description: 'Akses penuh semua fitur premium',
                price: 150000,
                original_price: 200000,
                image: 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=Premium',
                rating: 4.8,
                sold: 156,
                stock: 50
            },
            {
                id: 2,
                name: 'Top Up Diamond Game',
                description: 'Diamond murah dan cepat',
                price: 50000,
                original_price: 65000,
                image: 'https://via.placeholder.com/300x200/10b981/ffffff?text=Diamond',
                rating: 4.9,
                sold: 324,
                stock: 200
            },
            {
                id: 3,
                name: 'Voucher Diskon 50%',
                description: 'Untuk pembelian pertama',
                price: 25000,
                original_price: 50000,
                image: 'https://via.placeholder.com/300x200/f59e0b/ffffff?text=Voucher',
                rating: 4.7,
                sold: 89,
                stock: 25
            },
            {
                id: 4,
                name: 'Membership VIP',
                description: 'Akses eksklusif konten VIP',
                price: 300000,
                original_price: 400000,
                image: 'https://via.placeholder.com/300x200/8b5cf6/ffffff?text=VIP',
                rating: 4.9,
                sold: 67,
                stock: 15
            }
        ];
    }

    // ==================== FUNGSI CART ====================
    function loadCart() {
        if (!currentEndpoint) return;
        try {
            const savedCart = localStorage.getItem(`cart_${currentEndpoint}`);
            if (savedCart) {
                cart = JSON.parse(savedCart);
            } else {
                cart = [];
            }
        } catch (e) {
            console.error('Error loading cart:', e);
            cart = [];
        }
        
        updateCartUI();
    }

    function saveCart() {
        if (!currentEndpoint) return;
        try {
            localStorage.setItem(`cart_${currentEndpoint}`, JSON.stringify(cart));
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    }

    function addToCart(productId, variant = null, quantity = 1) {
        const product = products.find(p => p.id === productId) || getDummyProducts().find(p => p.id === productId);
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
        
        if (elements.cartBtn) {
            elements.cartBtn.classList.add('pulse');
            setTimeout(() => {
                elements.cartBtn.classList.remove('pulse');
            }, 300);
        }
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
        
        if (elements.orderBadge) {
            elements.orderBadge.textContent = totalItems;
            elements.orderBadge.style.display = totalItems > 0 ? 'flex' : 'none';
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
                    <div class="cart-item" data-index="${index}" style="animation-delay: ${index * 0.1}s">
                        <img src="${item.image || 'https://via.placeholder.com/60x60/40a7e3/ffffff?text=Product'}" 
                             alt="${escapeHtml(item.name)}" 
                             onerror="this.src='https://via.placeholder.com/60x60/40a7e3/ffffff?text=Product';">
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
        const product = products.find(p => p.id === productId) || getDummyProducts().find(p => p.id === productId);
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
        
        const stars = generateStars(product.rating || 4.5);
        
        const productHtml = `
            <div class="product-detail-images">
                <div class="main-image">
                    <img src="${product.image || 'https://via.placeholder.com/400x400/40a7e3/ffffff?text=Product'}" 
                         alt="${escapeHtml(product.name)}" 
                         id="mainProductImage"
                         onload="this.style.opacity='1'"
                         style="opacity:0; transition:opacity 0.3s"
                         onerror="this.src='https://via.placeholder.com/400x400/40a7e3/ffffff?text=Product'; this.onload=null;">
                </div>
                <div class="thumbnail-images">
                    ${product.images ? product.images.map(img => 
                        `<img src="${img}" alt="Thumb" onclick="document.getElementById('mainProductImage').src='${img}'; document.querySelectorAll('.thumbnail-images img').forEach(i => i.classList.remove('active')); this.classList.add('active');" 
                              onerror="this.style.display='none';">`
                    ).join('') : ''}
                </div>
            </div>
            <div class="product-detail-info">
                <h2>${escapeHtml(product.name)}</h2>
                <div class="product-rating">
                    <div class="stars">
                        ${stars}
                    </div>
                    <span>${product.rating || 4.5} (${product.reviews || 0} ulasan)</span>
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
                    <p>${escapeHtml(product.description || 'Produk berkualitas dengan harga terbaik. Dapatkan sekarang juga!')}</p>
                </div>
                ${variantsHtml}
                <div class="product-notes">
                    <h4>Catatan</h4>
                    <p>${escapeHtml(product.notes || 'Pastikan data yang dimasukkan benar.')}</p>
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
        document.body.style.overflow = 'hidden';
        
        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
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
            document.body.style.overflow = '';
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
        document.body.style.overflow = 'hidden';
        vibrate(10);
    }

    function closeCart() {
        if (elements.cartSidebar) {
            elements.cartSidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // ==================== FUNGSI SIDEBAR ====================
    function toggleSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.toggle('active');
            if (elements.sidebar.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
            vibrate(10);
        }
    }

    function closeSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // ==================== FUNGSI LOGIN ====================
    function openLoginModal() {
        if (elements.loginModal) {
            elements.loginModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        vibrate(10);
    }

    function closeLoginModal() {
        if (elements.loginModal) {
            elements.loginModal.classList.remove('active');
            document.body.style.overflow = '';
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
        if (elements.profileVerified && user.is_premium) {
            elements.profileVerified.style.display = 'flex';
        }
        if (elements.loginBtn) {
            elements.loginBtn.innerHTML = '<i class="fas fa-user"></i> Profile';
        }
        
        try {
            localStorage.setItem(`user_${currentEndpoint}`, JSON.stringify(user));
        } catch (e) {
            console.error('Error saving user:', e);
        }
    }

    function loadUser() {
        if (!currentEndpoint) return;
        try {
            const savedUser = localStorage.getItem(`user_${currentEndpoint}`);
            if (savedUser) {
                const user = JSON.parse(savedUser);
                setUser(user);
            }
        } catch (e) {
            console.error('Error loading user', e);
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

    function setupSearch() {
        if (!elements.searchInput) return;
        
        const debouncedSearch = debounce((query) => {
            if (query.length > 2) {
                showToast(`Mencari: ${query}`, 'info');
            }
        }, 500);
        
        elements.searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
        
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value;
                if (query.length > 0) {
                    showToast(`Mencari: ${query}`, 'info');
                }
            }
        });
    }

    // ==================== FUNGSI INIT ====================
    async function init() {
        console.log('🏪 Initializing Modern Website Store...');
        
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
        setupSearch();
        
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            tg.enableClosingConfirmation();
            
            if (tg.initDataUnsafe?.user && !currentUser) {
                setUser(tg.initDataUnsafe.user);
            }
            
            if (tg.themeParams) {
                const theme = tg.themeParams;
                if (theme.bg_color) {
                    document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
                }
                if (theme.text_color) {
                    document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
                }
                if (theme.button_color) {
                    document.documentElement.style.setProperty('--tg-button-color', theme.button_color);
                }
            }
        }
        
        console.log('✅ Modern Website initialized');
    }

    // ==================== SETUP KEYBOARD HANDLER ====================
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
                document.body.style.overflow = '';
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
                                <label class="payment-option">
                                    <input type="radio" name="payment" value="bank" checked>
                                    <i class="fas fa-university"></i>
                                    <span>Transfer Bank</span>
                                </label>
                                <label class="payment-option">
                                    <input type="radio" name="payment" value="ewallet">
                                    <i class="fas fa-wallet"></i>
                                    <span>E-Wallet</span>
                                </label>
                                <label class="payment-option">
                                    <input type="radio" name="payment" value="qris">
                                    <i class="fas fa-qrcode"></i>
                                    <span>QRIS</span>
                                </label>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button class="btn-secondary" onclick="window.website.closeCheckoutModal()">Batal</button>
                            <button class="btn-primary" onclick="window.website.processCheckout()">
                                <i class="fas fa-check"></i> Proses Pembayaran
                            </button>
                        </div>
                    `;
                    
                    elements.checkoutBody.innerHTML = checkoutHtml;
                    elements.checkoutModal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            });
        }
        
        window.addEventListener('click', (e) => {
            if (e.target === elements.productModal) {
                closeProductModal();
            }
            if (e.target === elements.checkoutModal) {
                elements.checkoutModal.classList.remove('active');
                document.body.style.overflow = '';
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
                document.body.style.overflow = '';
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
                document.body.style.overflow = '';
            }
        },
        processCheckout: () => {
            const selectedPayment = document.querySelector('input[name="payment"]:checked');
            if (!selectedPayment) {
                showToast('Pilih metode pembayaran', 'warning');
                return;
            }
            
            showToast('Memproses pesanan...', 'info');
            
            setTimeout(() => {
                elements.checkoutModal.classList.remove('active');
                document.body.style.overflow = '';
                cart = [];
                saveCart();
                updateCartUI();
                showToast('✅ Pesanan berhasil! Terima kasih telah berbelanja', 'success');
                vibrate(30);
            }, 2000);
        }
    };

    // ==================== START ====================
    init();
})();
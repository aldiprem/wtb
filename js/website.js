// website.js - Versi Crystal 3D dengan Integrasi API Database (No Dummy Data untuk Endpoint Valid)
(function() {
    'use strict';
    
    // ===== KONFIGURASI GLOBAL =====
    const CONFIG = {
        API_BASE_URL: window.APP_CONFIG?.API_BASE_URL || 'https://supports-lease-honest-potter.trycloudflare.com',
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        ANIMATION_DURATION: 300,
        CACHE_DURATION: 5 * 60 * 1000, // 5 menit
        BANNER_AUTO_SLIDE_INTERVAL: 5000,
        PROMO_AUTO_SLIDE_INTERVAL: 4000,
        TOAST_DURATION: 3000,
        VIBRATE_DURATION: 20,
        MAX_CART_ITEMS: 50,
        CRYSTAL_EFFECTS: true
    };

    // ===== STATE MANAGEMENT =====
    const State = {
        // Data Website
        currentEndpoint: null,
        currentWebsite: null,
        websiteData: null,
        tampilanData: null,
        
        // Produk & Kategori dari database
        products: [],
        layanan: [],
        aplikasi: [],
        structuredProducts: [],
        currentProduct: null,
        
        // Banner & Promo dari database
        banners: [],
        promos: [],
        currentBannerIndex: 0,
        currentPromoIndex: 0,
        bannerInterval: null,
        promoInterval: null,
        
        // Metode Pembayaran dari database
        rekening: [],
        gateway: [],
        
        // Keranjang
        cart: [],
        cartTotal: 0,
        
        // User
        currentUser: null,
        isLoggedIn: false,
        
        // UI State
        isLoading: false,
        isSidebarOpen: false,
        isCartOpen: false,
        isSearchOpen: false,
        activePage: 'home',
        
        // Touch & Mouse
        touchStartX: 0,
        touchEndX: 0,
        mouseX: 0,
        mouseY: 0,
        
        // Cache
        cache: new Map(),
        
        // Data loaded flags
        dataLoaded: {
            website: false,
            tampilan: false,
            products: false,
            promos: false,
            payments: false
        }
    };

    // ===== DOM ELEMENTS CACHE =====
    const DOM = {};

    // ===== UTILITY FUNCTIONS =====
    const Utils = {
        formatRupiah: (angka) => {
            if (!angka && angka !== 0) return 'Rp 0';
            return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        },

        formatDate: (dateString, timeString) => {
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
        },

        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        throttle: (func, limit) => {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        vibrate: (duration = CONFIG.VIBRATE_DURATION) => {
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(duration);
            }
        },

        setCache: (key, data) => {
            State.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        },

        getCache: (key) => {
            const cached = State.cache.get(key);
            if (!cached) return null;
            if (Date.now() - cached.timestamp > CONFIG.CACHE_DURATION) {
                State.cache.delete(key);
                return null;
            }
            return cached.data;
        },

        copyToClipboard: async (text) => {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error('Failed to copy:', err);
                return false;
            }
        },

        isMobile: () => window.innerWidth <= 768,

        getEndpointFromUrl: () => {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('store');
        },

        saveToStorage: (key, data) => {
            try {
                localStorage.setItem(`website_${State.currentEndpoint}_${key}`, JSON.stringify(data));
            } catch (e) {
                console.error('Error saving to storage:', e);
            }
        },

        loadFromStorage: (key) => {
            try {
                const data = localStorage.getItem(`website_${State.currentEndpoint}_${key}`);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('Error loading from storage:', e);
                return null;
            }
        },

        checkDataLoaded: () => {
            // Jika semua data sudah dimuat, sembunyikan loading
            const allLoaded = Object.values(State.dataLoaded).every(v => v === true);
            if (allLoaded && State.isLoading) {
                Loading.hide();
            }
        }
    };

    // ===== TOAST NOTIFICATIONS =====
    const Toast = {
        show: (message, type = 'info', duration = CONFIG.TOAST_DURATION) => {
            if (!DOM.toastContainer) return;
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            
            const icon = type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle';
            
            toast.innerHTML = `
                <i class="fas fa-${icon}"></i>
                <span>${message}</span>
            `;
            
            DOM.toastContainer.appendChild(toast);
            
            toast.addEventListener('mousemove', (e) => {
                const rect = toast.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                toast.style.setProperty('--x', `${x}px`);
                toast.style.setProperty('--y', `${y}px`);
            });
            
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }, duration);
        },

        success: (message) => Toast.show(message, 'success'),
        error: (message) => Toast.show(message, 'error'),
        warning: (message) => Toast.show(message, 'warning'),
        info: (message) => Toast.show(message, 'info')
    };

    // ===== LOADING OVERLAY =====
    const Loading = {
        show: (message = 'Memuat data dari database...') => {
            if (State.isLoading) return;
            State.isLoading = true;
            
            if (DOM.loadingOverlay) {
                const loadingText = DOM.loadingOverlay.querySelector('.loading-text');
                if (loadingText) loadingText.textContent = message;
                DOM.loadingOverlay.style.display = 'flex';
                
                const loader = DOM.loadingOverlay.querySelector('.crystal-loader');
                if (loader) {
                    loader.style.animation = 'none';
                    loader.offsetHeight;
                    loader.style.animation = 'crystalRotate 4s infinite linear';
                }
            }
        },

        hide: () => {
            if (!State.isLoading) return;
            
            if (DOM.loadingOverlay) {
                DOM.loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    DOM.loadingOverlay.style.display = 'none';
                    DOM.loadingOverlay.style.opacity = '1';
                    State.isLoading = false;
                }, 500);
            } else {
                State.isLoading = false;
            }
        },

        progress: (percent) => {
            const bar = DOM.loadingOverlay?.querySelector('.loading-bar');
            if (bar) {
                bar.style.width = `${percent}%`;
            }
        }
    };

    // ===== API SERVICE =====
    const API = {
        fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    ...options,
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                
                if (retries > 0) {
                    console.log(`🔄 Retry... ${CONFIG.MAX_RETRIES - retries + 1}/${CONFIG.MAX_RETRIES}`);
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                    return API.fetchWithRetry(url, options, retries - 1);
                }
                throw error;
            }
        },

        // Website Data
        getWebsite: async (endpoint) => {
            const cacheKey = `website_${endpoint}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/websites/endpoint/${endpoint}`);
                if (data.success && data.website) {
                    Utils.setCache(cacheKey, data.website);
                    State.dataLoaded.website = true;
                    Utils.checkDataLoaded();
                    return data.website;
                }
                throw new Error('Website not found');
            } catch (error) {
                console.error('❌ Error loading website:', error);
                throw error;
            }
        },

        // Tampilan Data
        getTampilan: async (websiteId) => {
            const cacheKey = `tampilan_${websiteId}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/tampilan/${websiteId}`);
                if (data.success && data.tampilan) {
                    Utils.setCache(cacheKey, data.tampilan);
                    State.dataLoaded.tampilan = true;
                    Utils.checkDataLoaded();
                    return data.tampilan;
                }
                return null;
            } catch (error) {
                if (error.message.includes('404')) {
                    State.dataLoaded.tampilan = true;
                    Utils.checkDataLoaded();
                    return null;
                }
                console.error('❌ Error loading tampilan:', error);
                return null;
            }
        },

        // Produk Terstruktur
        getStructuredProducts: async (websiteId) => {
            const cacheKey = `products_${websiteId}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/products/all/${websiteId}`);
                if (data.success && data.data) {
                    Utils.setCache(cacheKey, data.data);
                    State.dataLoaded.products = true;
                    Utils.checkDataLoaded();
                    return data.data;
                }
                State.dataLoaded.products = true;
                Utils.checkDataLoaded();
                return [];
            } catch (error) {
                console.error('❌ Error loading products:', error);
                State.dataLoaded.products = true;
                Utils.checkDataLoaded();
                return [];
            }
        },

        // Promos
        getPromos: async (websiteId) => {
            const cacheKey = `promos_${websiteId}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/tampilan/${websiteId}/promos`);
                if (data.success && data.promos) {
                    Utils.setCache(cacheKey, data.promos);
                    State.dataLoaded.promos = true;
                    Utils.checkDataLoaded();
                    return data.promos;
                }
                State.dataLoaded.promos = true;
                Utils.checkDataLoaded();
                return [];
            } catch (error) {
                console.error('❌ Error loading promos:', error);
                State.dataLoaded.promos = true;
                Utils.checkDataLoaded();
                return [];
            }
        },

        // Metode Pembayaran
        getRekening: async (websiteId) => {
            const cacheKey = `rekening_${websiteId}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/payments/rekening/${websiteId}`);
                if (data.success) {
                    Utils.setCache(cacheKey, data.rekening || []);
                    return data.rekening || [];
                }
                return [];
            } catch (error) {
                console.error('❌ Error loading rekening:', error);
                return [];
            }
        },

        getGateway: async (websiteId) => {
            const cacheKey = `gateway_${websiteId}`;
            const cached = Utils.getCache(cacheKey);
            if (cached) return cached;

            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/payments/gateway/${websiteId}`);
                if (data.success) {
                    Utils.setCache(cacheKey, data.gateway || []);
                    State.dataLoaded.payments = true;
                    Utils.checkDataLoaded();
                    return data.gateway || [];
                }
                State.dataLoaded.payments = true;
                Utils.checkDataLoaded();
                return [];
            } catch (error) {
                console.error('❌ Error loading gateway:', error);
                State.dataLoaded.payments = true;
                Utils.checkDataLoaded();
                return [];
            }
        },

        // Test Connection
        testConnection: async () => {
            try {
                const data = await API.fetchWithRetry(`${CONFIG.API_BASE_URL}/api/health`, { method: 'GET' });
                return data.status === 'healthy';
            } catch (error) {
                console.warn('⚠️ Cannot connect to server:', error.message);
                return false;
            }
        }
    };

    // ===== MOUSE INTERACTION EFFECTS =====
    const MouseEffects = {
        init: () => {
            document.addEventListener('mousemove', (e) => {
                State.mouseX = e.clientX;
                State.mouseY = e.clientY;
                
                document.querySelectorAll('.glow-effect, .crystal-panel, .crystal-3d-btn, .menu-item').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (
                        e.clientX >= rect.left &&
                        e.clientX <= rect.right &&
                        e.clientY >= rect.top &&
                        e.clientY <= rect.bottom
                    ) {
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        el.style.setProperty('--x', x);
                        el.style.setProperty('--y', y);
                    }
                });
            });

            document.querySelectorAll('.category-card, .popular-product-card, .promo-card').forEach(el => {
                el.addEventListener('mousemove', MouseEffects.handleTilt);
                el.addEventListener('mouseleave', MouseEffects.resetTilt);
            });
        },

        handleTilt: (e) => {
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            
            el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        },

        resetTilt: (e) => {
            const el = e.currentTarget;
            el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
        }
    };

    // ===== BANNER SLIDER =====
    const BannerSlider = {
        init: (banners) => {
            if (!DOM.sliderContainer || !banners || banners.length === 0) {
                if (DOM.bannerSlider) DOM.bannerSlider.style.display = 'none';
                return;
            }

            DOM.bannerSlider.style.display = 'block';
            State.banners = banners;
            State.currentBannerIndex = 0;

            BannerSlider.render();
            BannerSlider.setupEvents();
            BannerSlider.startAutoSlide();
        },

        render: () => {
            const banners = State.banners;
            let slidesHtml = '';
            let paginationHtml = '';

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
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\'no-image-placeholder\'><i class=\'fas fa-image\'></i><span>Gambar tidak tersedia</span></div>';">
                        </div>
                    </div>
                `;

                paginationHtml += `
                    <span class="${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                `;
            });

            DOM.sliderContainer.innerHTML = slidesHtml;
            if (DOM.sliderPagination) DOM.sliderPagination.innerHTML = paginationHtml;

            // Load images
            document.querySelectorAll('.slider-slide img').forEach(img => {
                if (img.complete) {
                    img.style.opacity = '1';
                }
            });
        },

        setupEvents: () => {
            if (State.banners.length <= 1) {
                if (DOM.sliderPrev) DOM.sliderPrev.style.display = 'none';
                if (DOM.sliderNext) DOM.sliderNext.style.display = 'none';
                if (DOM.sliderPagination) DOM.sliderPagination.style.display = 'none';
                return;
            }

            if (DOM.sliderPrev) DOM.sliderPrev.addEventListener('click', () => BannerSlider.prev());
            if (DOM.sliderNext) DOM.sliderNext.addEventListener('click', () => BannerSlider.next());

            if (DOM.sliderPagination) {
                DOM.sliderPagination.querySelectorAll('span').forEach(dot => {
                    dot.addEventListener('click', () => {
                        const index = parseInt(dot.dataset.index);
                        BannerSlider.goTo(index);
                    });
                });
            }

            BannerSlider.setupTouchEvents();
        },

        setupTouchEvents: () => {
            if (!DOM.sliderContainer) return;

            DOM.sliderContainer.addEventListener('touchstart', (e) => {
                State.touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            DOM.sliderContainer.addEventListener('touchend', (e) => {
                State.touchEndX = e.changedTouches[0].screenX;
                BannerSlider.handleSwipe();
            }, { passive: true });

            let mouseDown = false;
            let mouseStartX = 0;

            DOM.sliderContainer.addEventListener('mousedown', (e) => {
                mouseDown = true;
                mouseStartX = e.screenX;
                e.preventDefault();
            });

            DOM.sliderContainer.addEventListener('mousemove', (e) => {
                if (!mouseDown) return;
                e.preventDefault();
            });

            DOM.sliderContainer.addEventListener('mouseup', (e) => {
                if (!mouseDown) return;
                const mouseEndX = e.screenX;
                const diff = mouseEndX - mouseStartX;

                if (Math.abs(diff) > 50) {
                    if (diff > 0) BannerSlider.prev();
                    else BannerSlider.next();
                }

                mouseDown = false;
            });

            DOM.sliderContainer.addEventListener('mouseleave', () => {
                mouseDown = false;
            });
        },

        handleSwipe: () => {
            const diff = State.touchEndX - State.touchStartX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) BannerSlider.prev();
                else BannerSlider.next();
            }
        },

        goTo: (index) => {
            const slides = document.querySelectorAll('.slider-slide');
            const paginationSpans = DOM.sliderPagination?.querySelectorAll('span');

            if (!slides.length) return;

            slides.forEach(slide => slide.classList.remove('active'));
            slides[index].classList.add('active');

            if (paginationSpans) {
                paginationSpans.forEach(dot => dot.classList.remove('active'));
                paginationSpans[index]?.classList.add('active');
            }

            State.currentBannerIndex = index;
        },

        next: () => {
            const nextIndex = (State.currentBannerIndex + 1) % State.banners.length;
            BannerSlider.goTo(nextIndex);
            BannerSlider.resetAutoSlide();
        },

        prev: () => {
            const prevIndex = (State.currentBannerIndex - 1 + State.banners.length) % State.banners.length;
            BannerSlider.goTo(prevIndex);
            BannerSlider.resetAutoSlide();
        },

        startAutoSlide: () => {
            if (State.bannerInterval) clearInterval(State.bannerInterval);
            if (State.banners.length <= 1) return;

            State.bannerInterval = setInterval(() => {
                BannerSlider.next();
            }, CONFIG.BANNER_AUTO_SLIDE_INTERVAL);
        },

        resetAutoSlide: () => {
            if (State.bannerInterval) {
                clearInterval(State.bannerInterval);
                BannerSlider.startAutoSlide();
            }
        }
    };

    // ===== PROMO SLIDER =====
    const PromoSlider = {
        init: (promos) => {
            State.promos = promos || [];
            State.currentPromoIndex = 0;

            if (!DOM.promoSliderTrack || State.promos.length === 0) {
                if (DOM.promoSliderContainer) DOM.promoSliderContainer.style.display = 'none';
                return;
            }

            DOM.promoSliderContainer.style.display = 'block';
            PromoSlider.render();
            PromoSlider.setupEvents();
            PromoSlider.startAutoSlide();
        },

        render: () => {
            let slidesHtml = '';
            let dotsHtml = '';

            State.promos.forEach((promo, index) => {
                if (!promo.active) return; // Hanya promo aktif

                const expiryText = promo.never_end 
                    ? '<span class="promo-expiry never"><i class="fas fa-infinity"></i> Tidak ada batas</span>'
                    : `<span class="promo-expiry"><i class="fas fa-clock"></i> ${Utils.formatDate(promo.end_date, promo.end_time)}</span>`;

                const statusClass = promo.active ? 'active' : 'inactive';
                const statusText = promo.active ? 'Aktif' : 'Tidak Aktif';

                slidesHtml += `
                    <div class="promo-card glow-effect" data-index="${index}">
                        <div class="promo-banner-wrapper">
                            <img src="${promo.banner || 'https://via.placeholder.com/1280x720/40a7e3/ffffff?text=Promo'}" 
                                 alt="${Utils.escapeHtml(promo.title)}"
                                 onerror="this.src='https://via.placeholder.com/1280x720/40a7e3/ffffff?text=Promo';">
                        </div>
                        <div class="promo-content">
                            <h3 class="promo-title">${Utils.escapeHtml(promo.title)}</h3>
                            ${promo.description ? `<p class="promo-description">${Utils.escapeHtml(promo.description)}</p>` : ''}
                            <div class="promo-meta">
                                ${expiryText}
                                <span class="promo-status ${statusClass}">
                                    <i class="fas fa-${promo.active ? 'check-circle' : 'times-circle'}"></i> ${statusText}
                                </span>
                            </div>
                            ${promo.notes ? `
                                <div class="promo-notes">
                                    <i class="fas fa-sticky-note"></i> ${Utils.escapeHtml(promo.notes)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;

                dotsHtml += `
                    <span class="promo-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                `;
            });

            if (slidesHtml === '') {
                DOM.promoSliderContainer.style.display = 'none';
                return;
            }

            DOM.promoSliderTrack.innerHTML = slidesHtml;
            if (DOM.promoSliderDots) DOM.promoSliderDots.innerHTML = dotsHtml;

            document.querySelectorAll('.promo-card').forEach(card => {
                card.addEventListener('mousemove', MouseEffects.handleTilt);
                card.addEventListener('mouseleave', MouseEffects.resetTilt);
            });
        },

        setupEvents: () => {
            if (State.promos.length <= 1) {
                if (DOM.promoSliderPrev) DOM.promoSliderPrev.style.display = 'none';
                if (DOM.promoSliderNext) DOM.promoSliderNext.style.display = 'none';
                if (DOM.promoSliderDots) DOM.promoSliderDots.style.display = 'none';
                return;
            }

            if (DOM.promoSliderPrev) DOM.promoSliderPrev.addEventListener('click', () => PromoSlider.prev());
            if (DOM.promoSliderNext) DOM.promoSliderNext.addEventListener('click', () => PromoSlider.next());

            if (DOM.promoSliderDots) {
                DOM.promoSliderDots.querySelectorAll('.promo-dot').forEach(dot => {
                    dot.addEventListener('click', () => {
                        const index = parseInt(dot.dataset.index);
                        PromoSlider.goTo(index);
                    });
                });
            }
        },

        goTo: (index) => {
            if (!DOM.promoSliderTrack) return;

            State.currentPromoIndex = index;
            DOM.promoSliderTrack.style.transform = `translateX(-${index * 100}%)`;

            document.querySelectorAll('.promo-dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        },

        next: () => {
            const nextIndex = (State.currentPromoIndex + 1) % State.promos.length;
            PromoSlider.goTo(nextIndex);
            PromoSlider.resetAutoSlide();
        },

        prev: () => {
            const prevIndex = (State.currentPromoIndex - 1 + State.promos.length) % State.promos.length;
            PromoSlider.goTo(prevIndex);
            PromoSlider.resetAutoSlide();
        },

        startAutoSlide: () => {
            if (State.promoInterval) clearInterval(State.promoInterval);
            if (State.promos.length <= 1) return;

            State.promoInterval = setInterval(() => {
                PromoSlider.next();
            }, CONFIG.PROMO_AUTO_SLIDE_INTERVAL);
        },

        resetAutoSlide: () => {
            if (State.promoInterval) {
                clearInterval(State.promoInterval);
                PromoSlider.startAutoSlide();
            }
        }
    };

    // ===== LAYANAN RENDER =====
    const Layanan = {
        render: (structuredProducts) => {
            if (!DOM.categoriesGrid) return;

            if (!structuredProducts || structuredProducts.length === 0) {
                DOM.categoriesGrid.innerHTML = '<div class="empty-message">Belum ada layanan</div>';
                return;
            }

            let html = '';
            structuredProducts.slice(0, 8).forEach((layanan, index) => {
                const icon = layanan.layanan_gambar || '';
                const itemCount = layanan.aplikasi?.reduce((sum, app) => sum + (app.items?.length || 0), 0) || 0;

                html += `
                    <div class="category-card glow-effect" data-layanan="${Utils.escapeHtml(layanan.layanan_nama)}" style="animation-delay: ${index * 0.1}s">
                        <div class="category-icon">
                            ${icon ? 
                                `<img src="${icon}" alt="${Utils.escapeHtml(layanan.layanan_nama)}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<i class="fas fa-layer-group"></i>`
                            }
                        </div>
                        <div class="category-info">
                            <h4>${Utils.escapeHtml(layanan.layanan_nama)}</h4>
                            <span><i class="fas fa-box"></i> ${itemCount} Produk</span>
                        </div>
                    </div>
                `;
            });

            DOM.categoriesGrid.innerHTML = html;
            Layanan.setupEvents();
        },

        setupEvents: () => {
            document.querySelectorAll('.category-card').forEach(card => {
                card.addEventListener('click', () => {
                    const layanan = card.dataset.layanan;
                    if (layanan) {
                        Toast.info(`Layanan: ${layanan}`);
                        Utils.vibrate();
                        // Di sini bisa redirect ke halaman produk dengan filter layanan
                    }
                });
            });
        }
    };

    // ===== APLIKASI RENDER =====
    const Aplikasi = {
        render: (structuredProducts) => {
            if (!DOM.aplikasiGrid) return;

            // Kumpulkan semua aplikasi unik dari semua layanan
            const allApps = [];
            structuredProducts.forEach(layanan => {
                layanan.aplikasi?.forEach(app => {
                    allApps.push({
                        ...app,
                        layanan_nama: layanan.layanan_nama
                    });
                });
            });

            if (allApps.length === 0) {
                DOM.aplikasiGrid.innerHTML = '<div class="empty-message">Belum ada aplikasi</div>';
                return;
            }

            // Ambil 8 aplikasi pertama
            let html = '';
            allApps.slice(0, 8).forEach((app, index) => {
                const icon = app.aplikasi_gambar || '';

                html += `
                    <div class="category-card glow-effect" data-aplikasi="${Utils.escapeHtml(app.aplikasi_nama)}" data-layanan="${Utils.escapeHtml(app.layanan_nama)}" style="animation-delay: ${index * 0.1}s">
                        <div class="category-icon">
                            ${icon ? 
                                `<img src="${icon}" alt="${Utils.escapeHtml(app.aplikasi_nama)}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<i class="fas fa-mobile-alt"></i>`
                            }
                        </div>
                        <div class="category-info">
                            <h4>${Utils.escapeHtml(app.aplikasi_nama)}</h4>
                            <span><i class="fas fa-tag"></i> ${Utils.escapeHtml(app.layanan_nama)}</span>
                        </div>
                    </div>
                `;
            });

            DOM.aplikasiGrid.innerHTML = html;
            Aplikasi.setupEvents();
        },

        setupEvents: () => {
            document.querySelectorAll('[data-aplikasi]').forEach(card => {
                card.addEventListener('click', () => {
                    const aplikasi = card.dataset.aplikasi;
                    const layanan = card.dataset.layanan;
                    if (aplikasi) {
                        Toast.info(`Aplikasi: ${aplikasi} (${layanan})`);
                        Utils.vibrate();
                    }
                });
            });
        }
    };

    // ===== PRODUK TERLARIS RENDER =====
    const ProdukTerlaris = {
        render: (structuredProducts) => {
            if (!DOM.produkGrid) return;

            // Kumpulkan semua item dari semua aplikasi
            const allItems = [];
            structuredProducts.forEach(layanan => {
                layanan.aplikasi?.forEach(app => {
                    app.items?.forEach(item => {
                        allItems.push({
                            ...item,
                            layanan_nama: layanan.layanan_nama,
                            aplikasi_nama: app.aplikasi_nama,
                            aplikasi_gambar: app.aplikasi_gambar || layanan.layanan_gambar
                        });
                    });
                });
            });

            if (allItems.length === 0) {
                DOM.produkGrid.innerHTML = '<div class="empty-message">Belum ada produk</div>';
                return;
            }

            // Urutkan berdasarkan terjual (desc) dan ambil 6 teratas
            const topItems = allItems
                .sort((a, b) => (b.terjual || 0) - (a.terjual || 0))
                .slice(0, 6);

            let html = '';
            topItems.forEach((item, index) => {
                const gambar = item.item_gambar || item.aplikasi_gambar || `https://via.placeholder.com/300x200/40a7e3/ffffff?text=${encodeURIComponent(item.item_nama)}`;

                html += `
                    <div class="popular-product-card glow-effect" data-item-id="${item.id}" style="animation-delay: ${index * 0.1}s">
                        <div class="popular-product-image">
                            <img src="${gambar}" alt="${Utils.escapeHtml(item.item_nama)}" 
                                 loading="lazy"
                                 onerror="this.src='https://via.placeholder.com/300x200/40a7e3/ffffff?text=Product';">
                        </div>
                        <div class="popular-product-info">
                            <h3>${Utils.escapeHtml(item.item_nama)}</h3>
                            <div class="popular-product-desc">
                                <i class="fas fa-tag"></i> ${Utils.escapeHtml(item.aplikasi_nama || 'Aplikasi')}
                            </div>
                            <div class="popular-product-stats">
                                <span><i class="fas fa-box"></i> ${item.item_stok?.length || 0}</span>
                                <span><i class="fas fa-shopping-bag"></i> ${item.terjual || 0} terjual</span>
                            </div>
                            <div class="popular-product-price">
                                ${Utils.formatRupiah(item.item_harga || 0)}
                            </div>
                        </div>
                    </div>
                `;
            });

            DOM.produkGrid.innerHTML = html;
            ProdukTerlaris.setupEvents();
        },

        setupEvents: () => {
            document.querySelectorAll('.popular-product-card').forEach(card => {
                card.addEventListener('click', () => {
                    const itemId = card.dataset.itemId;
                    if (itemId) {
                        ProductModal.open(parseInt(itemId));
                    }
                });
            });
        }
    };

    // ===== METODE PEMBAYARAN RENDER =====
    const PaymentMethods = {
        render: (rekening, gateway) => {
            if (!DOM.paymentIcons) return;

            let html = '';
            let hasPayments = false;

            // Rekening Bank/E-Wallet
            if (rekening && rekening.length > 0) {
                rekening.forEach(rek => {
                    if (rek.active) {
                        hasPayments = true;
                        html += `
                            <div class="payment-icon glow-effect" title="${Utils.escapeHtml(rek.nama)} - ${Utils.escapeHtml(rek.pemilik)}">
                                <img src="${rek.logo_url}" alt="${Utils.escapeHtml(rek.nama)}" style="width: 40px; height: 40px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/40x40/40a7e3/ffffff?text=${rek.nama.charAt(0)}';">
                                <span>${Utils.escapeHtml(rek.nama)}</span>
                            </div>
                        `;
                    }
                });
            }

            // Gateway QRIS
            if (gateway && gateway.length > 0) {
                gateway.forEach(gw => {
                    if (gw.active) {
                        hasPayments = true;
                        html += `
                            <div class="payment-icon glow-effect" title="QRIS - Cashify">
                                <i class="fas fa-qrcode" style="font-size: 40px; color: ${gw.warna_qr || '#000000'};"></i>
                                <span>QRIS</span>
                            </div>
                        `;
                    }
                });
            }

            if (!hasPayments) {
                DOM.paymentIcons.innerHTML = '<div class="empty-message">Belum ada metode pembayaran</div>';
            } else {
                DOM.paymentIcons.innerHTML = html;
            }
        }
    };

    // ===== PRODUCT MODAL =====
    const ProductModal = {
        open: (itemId) => {
            // Cari item dari structuredProducts
            let foundItem = null;
            let foundLayanan = null;
            let foundAplikasi = null;

            for (const layanan of State.structuredProducts) {
                for (const app of (layanan.aplikasi || [])) {
                    for (const item of (app.items || [])) {
                        if (item.id === itemId) {
                            foundItem = item;
                            foundLayanan = layanan;
                            foundAplikasi = app;
                            break;
                        }
                    }
                    if (foundItem) break;
                }
                if (foundItem) break;
            }

            if (!foundItem) {
                Toast.error('Produk tidak ditemukan');
                return;
            }

            State.currentProduct = { ...foundItem, layanan: foundLayanan, aplikasi: foundAplikasi };
            ProductModal.render(foundItem, foundLayanan, foundAplikasi);
            
            DOM.productModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            Utils.vibrate();
        },

        render: (item, layanan, aplikasi) => {
            if (!DOM.productDetail) return;

            const gambar = item.item_gambar || aplikasi?.aplikasi_gambar || layanan?.layanan_gambar || 'https://via.placeholder.com/500x500/40a7e3/ffffff?text=Product';

            const productHtml = `
                <div class="product-detail-images">
                    <div class="main-image glow-effect">
                        <img src="${gambar}" 
                             alt="${Utils.escapeHtml(item.item_nama)}" 
                             id="mainProductImage"
                             onload="this.style.opacity='1'"
                             style="opacity:0; transition:opacity 0.3s"
                             onerror="this.src='https://via.placeholder.com/500x500/40a7e3/ffffff?text=Product'; this.onload=null;">
                    </div>
                </div>
                <div class="product-detail-info">
                    <h2>${Utils.escapeHtml(item.item_nama)}</h2>
                    
                    <div class="product-price-detail">
                        <span class="current-price">${Utils.formatRupiah(item.item_harga || 0)}</span>
                    </div>
                    
                    <div class="product-stock">
                        <i class="fas fa-cubes crystal-icon"></i>
                        <span>Stok: <strong>${item.item_stok?.length || 0}</strong></span>
                        <span class="sold-count"><i class="fas fa-shopping-bag"></i> ${item.terjual || 0} terjual</span>
                    </div>
                    
                    <div class="product-meta">
                        <p><i class="fas fa-tag"></i> Layanan: ${Utils.escapeHtml(layanan?.layanan_nama || '-')}</p>
                        <p><i class="fas fa-mobile-alt"></i> Aplikasi: ${Utils.escapeHtml(aplikasi?.aplikasi_nama || '-')}</p>
                        ${item.item_durasi_jumlah ? `<p><i class="fas fa-clock"></i> Durasi: ${item.item_durasi_jumlah} ${item.item_durasi_satuan}</p>` : ''}
                    </div>
                    
                    ${aplikasi?.aplikasi_desc ? `
                        <div class="product-description">
                            <h4><i class="fas fa-align-left crystal-icon"></i> Deskripsi</h4>
                            <p>${Utils.escapeHtml(aplikasi.aplikasi_desc)}</p>
                        </div>
                    ` : ''}
                    
                    ${layanan?.layanan_catatan || aplikasi?.aplikasi_catatan ? `
                        <div class="product-notes">
                            <h4><i class="fas fa-sticky-note crystal-icon"></i> Catatan</h4>
                            <p>${Utils.escapeHtml(layanan?.layanan_catatan || aplikasi?.aplikasi_catatan || '')}</p>
                        </div>
                    ` : ''}
                    
                    <div class="product-actions-detail">
                        <div class="quantity-selector">
                            <button class="qty-btn" id="detailQtyMinus">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" id="detailQty" value="1" min="1" max="${item.item_stok?.length || 999}">
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

            DOM.productDetail.innerHTML = productHtml;
            ProductModal.setupEvents(item);
        },

        setupEvents: (item) => {
            const qtyInput = document.getElementById('detailQty');
            const qtyMinus = document.getElementById('detailQtyMinus');
            const qtyPlus = document.getElementById('detailQtyPlus');

            if (qtyMinus && qtyInput) {
                qtyMinus.addEventListener('click', () => {
                    let val = parseInt(qtyInput.value) || 1;
                    if (val > 1) qtyInput.value = val - 1;
                });
            }

            if (qtyPlus && qtyInput) {
                qtyPlus.addEventListener('click', () => {
                    let val = parseInt(qtyInput.value) || 1;
                    if (val < (item.item_stok?.length || 999)) {
                        qtyInput.value = val + 1;
                    }
                });
            }

            const addToCartBtn = document.getElementById('detailAddToCart');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', () => {
                    const qty = parseInt(qtyInput?.value) || 1;
                    Cart.add(item.id, null, qty, item);
                });
            }

            const buyNowBtn = document.getElementById('detailBuyNow');
            if (buyNowBtn) {
                buyNowBtn.addEventListener('click', () => {
                    const qty = parseInt(qtyInput?.value) || 1;
                    Cart.add(item.id, null, qty, item);
                    ProductModal.close();
                    Cart.open();
                });
            }
        },

        close: () => {
            DOM.productModal.classList.remove('active');
            document.body.style.overflow = '';
            State.currentProduct = null;
        },

        setMainImage: (src, element) => {
            const mainImage = document.getElementById('mainProductImage');
            if (mainImage) {
                mainImage.src = src;
                document.querySelectorAll('.thumbnail-images img').forEach(img => {
                    img.classList.remove('active');
                });
                element.classList.add('active');
            }
        }
    };

    // ===== CART MANAGEMENT =====
    const Cart = {
        init: () => {
            const savedCart = Utils.loadFromStorage('cart');
            if (savedCart) State.cart = savedCart;
            Cart.updateUI();
        },

        add: (itemId, variant = null, quantity = 1, itemData = null) => {
            if (!itemData) {
                // Cari item dari structuredProducts
                for (const layanan of State.structuredProducts) {
                    for (const app of (layanan.aplikasi || [])) {
                        for (const item of (app.items || [])) {
                            if (item.id === itemId) {
                                itemData = item;
                                break;
                            }
                        }
                        if (itemData) break;
                    }
                    if (itemData) break;
                }
            }

            if (!itemData) {
                Toast.error('Produk tidak ditemukan');
                return;
            }

            const stokTersedia = itemData.item_stok?.length || 0;
            if (stokTersedia <= 0) {
                Toast.error('Stok habis');
                return;
            }

            const cartItem = {
                id: itemData.id,
                name: itemData.item_nama,
                price: itemData.item_harga || 0,
                quantity: quantity,
                image: itemData.item_gambar || '',
                maxStock: stokTersedia
            };

            const existingIndex = State.cart.findIndex(item => item.id === itemId);

            if (existingIndex >= 0) {
                const newQty = State.cart[existingIndex].quantity + quantity;
                if (newQty > stokTersedia) {
                    Toast.error('Stok tidak mencukupi');
                    return;
                }
                State.cart[existingIndex].quantity = newQty;
            } else {
                State.cart.push(cartItem);
            }

            Utils.saveToStorage('cart', State.cart);
            Cart.updateUI();
            Toast.success('Produk ditambahkan ke keranjang');
            Utils.vibrate();

            if (DOM.cartBtn) {
                DOM.cartBtn.classList.add('pulse');
                setTimeout(() => DOM.cartBtn.classList.remove('pulse'), 300);
            }
        },

        remove: (index) => {
            State.cart.splice(index, 1);
            Utils.saveToStorage('cart', State.cart);
            Cart.updateUI();
            Toast.info('Produk dihapus dari keranjang');
            Utils.vibrate();
        },

        updateQuantity: (index, newQuantity) => {
            if (newQuantity <= 0) {
                Cart.remove(index);
                return;
            }

            State.cart[index].quantity = newQuantity;
            Utils.saveToStorage('cart', State.cart);
            Cart.updateUI();
        },

        clear: () => {
            State.cart = [];
            Utils.saveToStorage('cart', State.cart);
            Cart.updateUI();
        },

        updateUI: () => {
            const totalItems = State.cart.reduce((sum, item) => sum + item.quantity, 0);
            
            if (DOM.cartBadge) {
                DOM.cartBadge.textContent = totalItems;
                DOM.cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
            }

            if (DOM.orderBadge) {
                DOM.orderBadge.textContent = totalItems;
                DOM.orderBadge.style.display = totalItems > 0 ? 'flex' : 'none';
            }

            if (!DOM.cartItems || !DOM.cartEmpty || !DOM.cartFooter) return;

            if (State.cart.length === 0) {
                DOM.cartItems.style.display = 'none';
                DOM.cartEmpty.style.display = 'flex';
                DOM.cartFooter.style.display = 'none';
            } else {
                DOM.cartItems.style.display = 'block';
                DOM.cartEmpty.style.display = 'none';
                DOM.cartFooter.style.display = 'block';

                let cartHtml = '';
                let total = 0;

                State.cart.forEach((item, index) => {
                    const itemTotal = item.price * item.quantity;
                    total += itemTotal;

                    cartHtml += `
                        <div class="cart-item glow-effect" data-index="${index}" style="animation-delay: ${index * 0.1}s">
                            <img src="${item.image || 'https://via.placeholder.com/80x80/40a7e3/ffffff?text=Product'}" 
                                 alt="${Utils.escapeHtml(item.name)}" 
                                 onerror="this.src='https://via.placeholder.com/80x80/40a7e3/ffffff?text=Product';">
                            <div class="cart-item-details">
                                <h4>${Utils.escapeHtml(item.name)}</h4>
                                <div class="cart-item-price">${Utils.formatRupiah(item.price)}</div>
                                <div class="cart-item-quantity">
                                    <button class="qty-btn minus" onclick="window.website.cartUpdateQuantity(${index}, ${item.quantity - 1})">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span>${item.quantity}</span>
                                    <button class="qty-btn plus" onclick="window.website.cartUpdateQuantity(${index}, ${item.quantity + 1})">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                            <button class="cart-item-remove" onclick="window.website.cartRemove(${index})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                });

                DOM.cartItems.innerHTML = cartHtml;
                State.cartTotal = total;
                if (DOM.cartTotal) DOM.cartTotal.textContent = Utils.formatRupiah(total);
            }
        },

        open: () => {
            DOM.cartSidebar.classList.add('active');
            DOM.sidebar.classList.remove('active');
            document.body.style.overflow = 'hidden';
            Utils.vibrate();
        },

        close: () => {
            DOM.cartSidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ===== SIDEBAR MANAGEMENT =====
    const Sidebar = {
        toggle: () => {
            DOM.sidebar.classList.toggle('active');
            document.body.style.overflow = DOM.sidebar.classList.contains('active') ? 'hidden' : '';
            Utils.vibrate();
        },

        close: () => {
            DOM.sidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ===== SEARCH MANAGEMENT =====
    const Search = {
        toggle: () => {
            DOM.searchBar.classList.toggle('active');
            if (DOM.searchBar.classList.contains('active')) {
                DOM.searchInput.focus();
            }
        },

        close: () => DOM.searchBar.classList.remove('active'),

        init: () => {
            const debouncedSearch = Utils.debounce((query) => {
                if (query.length > 2) {
                    // Implement search logic here
                    console.log('Searching for:', query);
                }
            }, 500);

            DOM.searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
            DOM.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = e.target.value;
                    if (query.length > 0) {
                        Toast.info(`Mencari: ${query}`);
                    }
                }
            });
        }
    };

    // ===== USER MANAGEMENT =====
    const User = {
        init: () => {
            const savedUser = Utils.loadFromStorage('user');
            if (savedUser) User.setUser(savedUser);

            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                User.setUser(tgUser);
            }
        },

        setUser: (user) => {
            State.currentUser = user;
            State.isLoggedIn = true;

            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
            const username = user.username ? `@${user.username}` : '(no username)';

            if (DOM.sidebarName) DOM.sidebarName.textContent = fullName;
            if (DOM.sidebarUsername) DOM.sidebarUsername.textContent = username;
            if (DOM.sidebarAvatar) {
                const img = DOM.sidebarAvatar.querySelector('img');
                if (img) img.src = Utils.generateAvatarUrl(fullName);
            }
            if (DOM.profileVerified && user.is_premium) DOM.profileVerified.style.display = 'flex';
            if (DOM.loginBtn) DOM.loginBtn.innerHTML = '<i class="fas fa-user"></i> Profile';

            Utils.saveToStorage('user', user);
        },

        loginWithTelegram: () => {
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                if (tg.initDataUnsafe?.user) {
                    const user = tg.initDataUnsafe.user;
                    User.setUser(user);
                    Toast.success(`Selamat datang, ${user.first_name}!`);
                    LoginModal.close();
                } else {
                    Toast.warning('Silakan buka melalui Telegram');
                }
            } else {
                User.loginAsGuest();
            }
        },

        loginAsGuest: () => {
            const guestUser = {
                id: Date.now(),
                first_name: 'Guest',
                username: `guest_${Math.floor(Math.random() * 1000)}`,
                is_premium: false
            };
            User.setUser(guestUser);
            Toast.info('Lanjut sebagai Tamu');
            LoginModal.close();
        }
    };

    // ===== LOGIN MODAL =====
    const LoginModal = {
        open: () => {
            DOM.loginModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            Utils.vibrate();
        },

        close: () => {
            DOM.loginModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ===== CHECKOUT =====
    const Checkout = {
        open: () => {
            if (State.cart.length === 0) {
                Toast.warning('Keranjang belanja kosong');
                return;
            }

            if (!State.isLoggedIn) {
                LoginModal.open();
                return;
            }

            Checkout.render();
            DOM.checkoutModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        },

        render: () => {
            if (!DOM.checkoutBody) return;

            let checkoutHtml = `
                <div class="checkout-items">
                    <h3><i class="fas fa-shopping-bag crystal-icon"></i> Ringkasan Belanja</h3>
            `;

            let total = 0;
            State.cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;

                checkoutHtml += `
                    <div class="checkout-item">
                        <span>${Utils.escapeHtml(item.name)} x${item.quantity}</span>
                        <span>${Utils.formatRupiah(itemTotal)}</span>
                    </div>
                `;
            });

            checkoutHtml += `
                    <div class="checkout-total">
                        <strong>Total</strong>
                        <strong class="holographic-text">${Utils.formatRupiah(total)}</strong>
                    </div>
                </div>
                <div class="checkout-payment">
                    <h3><i class="fas fa-credit-card crystal-icon"></i> Metode Pembayaran</h3>
                    <div class="payment-options" id="checkoutPaymentOptions"></div>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" id="cancelCheckoutBtn">Batal</button>
                    <button class="btn-primary" id="processCheckoutBtn">
                        <i class="fas fa-check"></i> Proses Pembayaran
                    </button>
                </div>
            `;

            DOM.checkoutBody.innerHTML = checkoutHtml;

            // Render metode pembayaran dari database
            const paymentOptions = document.getElementById('checkoutPaymentOptions');
            if (paymentOptions) {
                let optionsHtml = '';

                State.rekening.filter(r => r.active).forEach(rek => {
                    optionsHtml += `
                        <label class="payment-option glow-effect">
                            <input type="radio" name="payment" value="rekening_${rek.id}">
                            <img src="${rek.logo_url}" alt="${Utils.escapeHtml(rek.nama)}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/32x32/40a7e3/ffffff?text=${rek.nama.charAt(0)}';">
                            <span>${Utils.escapeHtml(rek.nama)}</span>
                        </label>
                    `;
                });

                State.gateway.filter(g => g.active).forEach(gw => {
                    optionsHtml += `
                        <label class="payment-option glow-effect">
                            <input type="radio" name="payment" value="gateway_${gw.id}">
                            <i class="fas fa-qrcode" style="font-size: 32px; color: ${gw.warna_qr || '#000000'};"></i>
                            <span>QRIS (Cashify)</span>
                        </label>
                    `;
                });

                if (optionsHtml === '') {
                    optionsHtml = '<div class="empty-message">Belum ada metode pembayaran aktif</div>';
                }

                paymentOptions.innerHTML = optionsHtml;
            }

            document.getElementById('cancelCheckoutBtn')?.addEventListener('click', Checkout.close);
            document.getElementById('processCheckoutBtn')?.addEventListener('click', Checkout.process);
        },

        process: () => {
            const selectedPayment = document.querySelector('input[name="payment"]:checked');
            if (!selectedPayment) {
                Toast.warning('Pilih metode pembayaran');
                return;
            }

            Toast.info('Memproses pesanan...');
            
            setTimeout(() => {
                Checkout.close();
                Cart.clear();
                Cart.updateUI();
                Toast.success('✅ Pesanan berhasil! Terima kasih telah berbelanja');
                Utils.vibrate(30);
            }, 2000);
        },

        close: () => {
            DOM.checkoutModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ===== THEME MANAGEMENT =====
    const Theme = {
        apply: (tampilan) => {
            if (!tampilan) return;

            const root = document.documentElement;

            // Colors
            if (tampilan.colors) {
                if (tampilan.colors.primary) root.style.setProperty('--primary-color', tampilan.colors.primary);
                if (tampilan.colors.secondary) root.style.setProperty('--secondary-color', tampilan.colors.secondary);
                if (tampilan.colors.background) root.style.setProperty('--bg-deep-space', tampilan.colors.background);
                if (tampilan.colors.text) root.style.setProperty('--text-primary', tampilan.colors.text);
                if (tampilan.colors.card) root.style.setProperty('--glass-bg', tampilan.colors.card);
                if (tampilan.colors.accent) root.style.setProperty('--success-color', tampilan.colors.accent);
            }

            // Font
            if (tampilan.font_family) root.style.setProperty('--font-family', tampilan.font_family);
            if (tampilan.font_size) root.style.setProperty('--font-size', `${tampilan.font_size}px`);

            // Logo
            if (tampilan.logo && DOM.headerLogo) {
                DOM.headerLogo.innerHTML = `
                    <div class="logo-3d-small">
                        <img src="${tampilan.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; transform: rotate(-45deg);">
                    </div>
                    <span id="storeName">${tampilan.store_display_name || State.websiteData?.username || 'Toko Online'}</span>
                `;
            }

            // Store name
            if (tampilan.store_display_name) {
                if (DOM.storeName) DOM.storeName.textContent = tampilan.store_display_name;
                if (DOM.sidebarStoreName) DOM.sidebarStoreName.textContent = tampilan.store_display_name;
                if (DOM.footerStoreName) DOM.footerStoreName.textContent = tampilan.store_display_name;
                if (DOM.footerStoreName2) DOM.footerStoreName2.textContent = tampilan.store_display_name;
            }

            // Description
            if (tampilan.description && DOM.footerDescription) {
                DOM.footerDescription.textContent = tampilan.description;
            }

            // Contacts
            if (tampilan.contact_whatsapp && DOM.contactWhatsApp) {
                DOM.contactWhatsApp.textContent = tampilan.contact_whatsapp;
            }
            if (tampilan.contact_telegram && DOM.contactTelegram) {
                DOM.contactTelegram.textContent = tampilan.contact_telegram;
            }
        }
    };

    // ===== INITIALIZATION =====
    const init = async () => {
        console.log('🏪 Crystal Store 3D - Initializing...');

        initializeDOMCache();

        Loading.show('Memuat data dari database...');

        try {
            State.currentEndpoint = Utils.getEndpointFromUrl();
            if (!State.currentEndpoint) {
                Toast.error('Endpoint tidak valid. Gunakan ?store=nama-endpoint');
                Loading.hide();
                return;
            }

            // Test connection
            const isConnected = await API.testConnection();
            if (!isConnected) {
                Toast.warning('Tidak dapat terhubung ke server');
                Loading.hide();
                return;
            }

            // Load website data
            Loading.progress(10);
            State.websiteData = await API.getWebsite(State.currentEndpoint);
            
            if (!State.websiteData) {
                throw new Error('Website tidak ditemukan');
            }

            // Load all data concurrently
            Loading.progress(30);
            const [tampilan, structuredProducts, promos, rekening, gateway] = await Promise.all([
                API.getTampilan(State.websiteData.id),
                API.getStructuredProducts(State.websiteData.id),
                API.getPromos(State.websiteData.id),
                API.getRekening(State.websiteData.id),
                API.getGateway(State.websiteData.id)
            ]);

            State.tampilanData = tampilan;
            State.structuredProducts = structuredProducts || [];
            State.promos = promos || [];
            State.rekening = rekening || [];
            State.gateway = gateway || [];

            Loading.progress(80);

            // Update UI
            updateUI();
            
            // Render all components
            renderAll();

            // Initialize features
            initFeatures();

            // Mark all data as loaded
            State.dataLoaded.website = true;
            State.dataLoaded.tampilan = true;
            State.dataLoaded.products = true;
            State.dataLoaded.promos = true;
            State.dataLoaded.payments = true;
            Utils.checkDataLoaded();

        } catch (error) {
            console.error('❌ Init error:', error);
            Toast.error(error.message || 'Gagal memuat data');
            Loading.hide();
        }
    };

    // Initialize DOM cache
    const initializeDOMCache = () => {
        const elements = [
            'loadingOverlay', 'dynamicTitle', 'dynamicDescription', 'dynamicKeywords',
            'sidebar', 'sidebarClose', 'menuToggle', 'sidebarStoreName', 'sidebarAvatar',
            'sidebarName', 'sidebarUsername', 'profileVerified', 'loginBtn', 'orderBadge',
            'storeName', 'headerLogo', 'searchToggle', 'cartBtn', 'cartBadge',
            'searchBar', 'searchInput', 'searchClose',
            'bannerSlider', 'sliderContainer', 'sliderPrev', 'sliderNext', 'sliderPagination',
            'categoriesGrid', 'aplikasiGrid', 'produkGrid',
            'promoSliderContainer', 'promoSliderTrack', 'promoSliderPrev', 'promoSliderNext', 'promoSliderDots',
            'paymentIcons',
            'footerDescription', 'contactWhatsApp', 'contactTelegram', 'contactEmail',
            'footerStoreName', 'footerStoreName2', 'sidebarYear',
            'cartSidebar', 'cartClose', 'cartItems', 'cartEmpty', 'cartFooter', 'cartTotal',
            'shopNowBtn', 'checkoutBtn',
            'productModal', 'checkoutModal', 'loginModal', 'closeProductModal',
            'closeCheckoutModal', 'closeLoginModal', 'productDetail', 'checkoutBody',
            'telegramLogin', 'guestLogin', 'toastContainer'
        ];

        elements.forEach(id => {
            DOM[id] = document.getElementById(id);
        });
    };

    // Update UI with data
    const updateUI = () => {
        // Title & Meta
        if (DOM.dynamicTitle) {
            DOM.dynamicTitle.textContent = State.tampilanData?.seo_title || 
                                          State.websiteData?.settings?.title || 
                                          'Toko Online 3D';
        }
        if (DOM.dynamicDescription) {
            DOM.dynamicDescription.content = State.tampilanData?.seo_description || 
                                            State.websiteData?.settings?.description || 
                                            'Toko online terpercaya dengan produk digital berkualitas';
        }

        // Store name
        const storeName = State.tampilanData?.store_display_name || 
                         State.websiteData?.username || 
                         'Toko Online';
        
        if (DOM.storeName) DOM.storeName.textContent = storeName;
        if (DOM.sidebarStoreName) DOM.sidebarStoreName.textContent = storeName;
        if (DOM.footerStoreName) DOM.footerStoreName.textContent = storeName;
        if (DOM.footerStoreName2) DOM.footerStoreName2.textContent = storeName;

        // Footer
        if (DOM.footerDescription) {
            DOM.footerDescription.textContent = State.tampilanData?.description || 
                                                State.websiteData?.settings?.description || 
                                                'Toko online terpercaya sejak 2024 dengan ribuan produk digital berkualitas.';
        }

        // Contacts
        if (DOM.contactWhatsApp) {
            DOM.contactWhatsApp.textContent = State.tampilanData?.contact_whatsapp || 
                                              State.websiteData?.settings?.contact?.whatsapp || 
                                              '-';
        }
        if (DOM.contactTelegram) {
            DOM.contactTelegram.textContent = State.tampilanData?.contact_telegram || 
                                              State.websiteData?.settings?.contact?.telegram || 
                                              '-';
        }
        if (DOM.contactEmail) {
            DOM.contactEmail.textContent = State.websiteData?.email || 'support@example.com';
        }

        // Year
        if (DOM.sidebarYear) DOM.sidebarYear.textContent = new Date().getFullYear();
    };

    // Render all components
    const renderAll = () => {
        // Apply theme
        Theme.apply(State.tampilanData);

        // Banners
        BannerSlider.init(State.tampilanData?.banners || []);

        // Layanan
        Layanan.render(State.structuredProducts);

        // Aplikasi
        Aplikasi.render(State.structuredProducts);

        // Produk Terlaris
        ProdukTerlaris.render(State.structuredProducts);

        // Promos
        PromoSlider.init(State.promos);

        // Payment Methods
        PaymentMethods.render(State.rekening, State.gateway);

        // Cart
        Cart.init();

        // User
        User.init();
    };

    // Initialize features
    const initFeatures = () => {
        MouseEffects.init();
        Search.init();

        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            tg.enableClosingConfirmation();

            if (tg.themeParams) {
                const theme = tg.themeParams;
                if (theme.bg_color) document.documentElement.style.setProperty('--bg-deep-space', theme.bg_color);
                if (theme.text_color) document.documentElement.style.setProperty('--text-primary', theme.text_color);
                if (theme.button_color) document.documentElement.style.setProperty('--primary-color', theme.button_color);
            }
        }

        initKeyboardHandler();
    };

    // Keyboard handler
    const initKeyboardHandler = () => {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Sidebar.close();
                Cart.close();
                ProductModal.close();
                Checkout.close();
                LoginModal.close();
                Search.close();
                document.body.style.overflow = '';
            }

            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                Search.toggle();
            }
        });

        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    };

    // Setup event listeners
    const setupEventListeners = () => {
        // Sidebar
        DOM.menuToggle?.addEventListener('click', Sidebar.toggle);
        DOM.sidebarClose?.addEventListener('click', Sidebar.close);

        // Cart
        DOM.cartBtn?.addEventListener('click', Cart.open);
        DOM.cartClose?.addEventListener('click', Cart.close);
        DOM.shopNowBtn?.addEventListener('click', () => {
            Cart.close();
            document.querySelector('.produk-section')?.scrollIntoView({ behavior: 'smooth' });
        });

        // Search
        DOM.searchToggle?.addEventListener('click', Search.toggle);
        DOM.searchClose?.addEventListener('click', Search.close);

        // Modals
        DOM.closeProductModal?.addEventListener('click', ProductModal.close);
        DOM.closeCheckoutModal?.addEventListener('click', Checkout.close);
        DOM.closeLoginModal?.addEventListener('click', LoginModal.close);

        // Login
        DOM.loginBtn?.addEventListener('click', LoginModal.open);
        DOM.telegramLogin?.addEventListener('click', User.loginWithTelegram);
        DOM.guestLogin?.addEventListener('click', User.loginAsGuest);

        // Checkout
        DOM.checkoutBtn?.addEventListener('click', Checkout.open);

        // Close modals on overlay click
        window.addEventListener('click', (e) => {
            if (e.target === DOM.productModal) ProductModal.close();
            if (e.target === DOM.checkoutModal) Checkout.close();
            if (e.target === DOM.loginModal) LoginModal.close();
            if (e.target === DOM.cartSidebar) Cart.close();
            if (e.target === DOM.sidebar) Sidebar.close();
        });

        // Window resize
        window.addEventListener('resize', Utils.throttle(() => {
            if (!Utils.isMobile()) Sidebar.close();
        }, 200));
    };

    // ===== EXPOSE GLOBAL FUNCTIONS =====
    window.website = {
        cartAdd: Cart.add,
        cartRemove: Cart.remove,
        cartUpdateQuantity: Cart.updateQuantity,
        cartClear: Cart.clear,
        setMainImage: ProductModal.setMainImage,
        vibrate: Utils.vibrate,
        formatRupiah: Utils.formatRupiah
    };

    // ===== START =====
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        init();
    });

})();

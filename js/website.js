// website.js - Versi Crystal 3D dengan Integrasi API Lengkap
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
        
        // Produk & Kategori
        products: [],
        categories: [],
        structuredProducts: null,
        currentProduct: null,
        
        // Banner & Promo
        banners: [],
        promos: [],
        currentBannerIndex: 0,
        currentPromoIndex: 0,
        bannerInterval: null,
        promoInterval: null,
        
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
        
        // Retry
        retryCount: 0
    };

    // ===== DOM ELEMENTS CACHE =====
    const DOM = {};

    // ===== UTILITY FUNCTIONS =====
    const Utils = {
        // Format Rupiah
        formatRupiah: (angka) => {
            if (!angka && angka !== 0) return 'Rp 0';
            return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        },

        // Format Number
        formatNumber: (num) => {
            if (!num && num !== 0) return '0';
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        },

        // Format Date
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

        // Escape HTML
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // Debounce
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

        // Throttle
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

        // Vibrate
        vibrate: (duration = CONFIG.VIBRATE_DURATION) => {
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(duration);
            }
        },

        // Generate Stars
        generateStars: (rating) => {
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
        },

        // Generate Avatar URL
        generateAvatarUrl: (name) => {
            if (!name) return `https://ui-avatars.com/api/?name=U&size=100&background=40a7e3&color=fff&bold=true`;
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0).toUpperCase())}&size=100&background=40a7e3&color=fff&bold=true`;
        },

        // Cache Management
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

        // Copy to Clipboard
        copyToClipboard: async (text) => {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error('Failed to copy:', err);
                return false;
            }
        },

        // Detect Mobile
        isMobile: () => {
            return window.innerWidth <= 768;
        },

        // Get Endpoint from URL
        getEndpointFromUrl: () => {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('store');
        },

        // Save to LocalStorage
        saveToStorage: (key, data) => {
            try {
                localStorage.setItem(`website_${State.currentEndpoint}_${key}`, JSON.stringify(data));
            } catch (e) {
                console.error('Error saving to storage:', e);
            }
        },

        // Load from LocalStorage
        loadFromStorage: (key) => {
            try {
                const data = localStorage.getItem(`website_${State.currentEndpoint}_${key}`);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('Error loading from storage:', e);
                return null;
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
            
            // Add mouse position effect
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
        show: (message = 'Memuat pengalaman 3D...') => {
            if (State.isLoading) return;
            State.isLoading = true;
            
            if (DOM.loadingOverlay) {
                const loadingText = DOM.loadingOverlay.querySelector('.loading-text');
                if (loadingText) loadingText.textContent = message;
                DOM.loadingOverlay.style.display = 'flex';
                
                // Animate crystal loader
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

                const data = await response.json();
                return data;
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
                    return data.tampilan;
                }
                return null;
            } catch (error) {
                if (error.message.includes('404')) {
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
                    return data.data;
                }
                return [];
            } catch (error) {
                console.error('❌ Error loading products:', error);
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
                    return data.promos;
                }
                return [];
            } catch (error) {
                console.error('❌ Error loading promos:', error);
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
                
                // Update glow effects
                document.querySelectorAll('.glow-effect, .crystal-panel, .crystal-3d-btn').forEach(el => {
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

            // 3D Tilt Effect
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
                                 onerror="this.src='https://via.placeholder.com/1280x720/40a7e3/ffffff?text=Banner+${index+1}'; this.onload=null;">
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

            DOM.sliderContainer.innerHTML = slidesHtml;
            if (DOM.sliderPagination) DOM.sliderPagination.innerHTML = paginationHtml;
            if (DOM.sliderDots) DOM.sliderDots.innerHTML = dotsHtml;

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

            if (DOM.sliderPrev) {
                DOM.sliderPrev.addEventListener('click', () => {
                    BannerSlider.prev();
                });
            }

            if (DOM.sliderNext) {
                DOM.sliderNext.addEventListener('click', () => {
                    BannerSlider.next();
                });
            }

            if (DOM.sliderPagination) {
                DOM.sliderPagination.querySelectorAll('span').forEach(dot => {
                    dot.addEventListener('click', () => {
                        const index = parseInt(dot.dataset.index);
                        BannerSlider.goTo(index);
                    });
                });
            }

            // Touch events
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

            // Mouse drag events
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
                    if (diff > 0) {
                        BannerSlider.prev();
                    } else {
                        BannerSlider.next();
                    }
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
                if (diff > 0) {
                    BannerSlider.prev();
                } else {
                    BannerSlider.next();
                }
            }
        },

        goTo: (index) => {
            const slides = document.querySelectorAll('.slider-slide');
            const paginationSpans = DOM.sliderPagination?.querySelectorAll('span');
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

            DOM.promoSliderTrack.innerHTML = slidesHtml;
            if (DOM.promoSliderDots) DOM.promoSliderDots.innerHTML = dotsHtml;

            // Add tilt effects
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

            if (DOM.promoSliderPrev) {
                DOM.promoSliderPrev.addEventListener('click', () => {
                    PromoSlider.prev();
                });
            }

            if (DOM.promoSliderNext) {
                DOM.promoSliderNext.addEventListener('click', () => {
                    PromoSlider.next();
                });
            }

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

    // ===== CATEGORIES RENDER =====
    const Categories = {
        render: (categories) => {
            if (!DOM.categoriesGrid) return;

            if (!categories || categories.length === 0) {
                Categories.renderDummy();
                return;
            }

            let html = '';
            categories.slice(0, 6).forEach((category, index) => {
                html += `
                    <div class="category-card glow-effect" data-category="${category.id || category.name}" style="animation-delay: ${index * 0.1}s">
                        <div class="category-icon">
                            ${category.icon ? 
                                `<img src="${category.icon}" alt="${category.name}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<i class="fas ${category.iconClass || 'fa-tag'}"></i>`
                            }
                        </div>
                        <div class="category-info">
                            <h4>${Utils.escapeHtml(category.name)}</h4>
                            <span><i class="fas fa-box"></i> ${category.count || 0} Produk</span>
                        </div>
                    </div>
                `;
            });

            DOM.categoriesGrid.innerHTML = html;
            Categories.setupEvents();
        },

        renderDummy: () => {
            const dummyCategories = [
                { name: 'Premium Apps', iconClass: 'fa-crown', count: 12 },
                { name: 'Game Voucher', iconClass: 'fa-gamepad', count: 24 },
                { name: 'Streaming', iconClass: 'fa-film', count: 8 },
                { name: 'Software', iconClass: 'fa-code', count: 15 },
                { name: 'Top Up Games', iconClass: 'fa-diamond', count: 32 },
                { name: 'E-Book', iconClass: 'fa-book', count: 45 }
            ];

            let html = '';
            dummyCategories.forEach((cat, index) => {
                html += `
                    <div class="category-card glow-effect" style="animation-delay: ${index * 0.1}s">
                        <div class="category-icon">
                            <i class="fas ${cat.iconClass}"></i>
                        </div>
                        <div class="category-info">
                            <h4>${cat.name}</h4>
                            <span><i class="fas fa-box"></i> ${cat.count} Produk</span>
                        </div>
                    </div>
                `;
            });

            DOM.categoriesGrid.innerHTML = html;
            Categories.setupEvents();
        },

        setupEvents: () => {
            document.querySelectorAll('.category-card').forEach(card => {
                card.addEventListener('click', () => {
                    const category = card.querySelector('h4')?.textContent || 'Kategori';
                    Toast.info(`Layanan: ${category}`);
                    Utils.vibrate();
                });
            });
        }
    };

    // ===== POPULAR PRODUCTS RENDER =====
    const PopularProducts = {
        render: (products) => {
            if (!DOM.popularProducts) return;

            if (!products || products.length === 0) {
                PopularProducts.renderDummy();
                return;
            }

            let html = '';
            products.slice(0, 6).forEach((product, index) => {
                const icon = product.icon || 'fa-box';
                const gambar = product.image || product.gambar || `https://via.placeholder.com/300x200/40a7e3/ffffff?text=${encodeURIComponent(product.name || product.item_nama)}`;

                html += `
                    <div class="popular-product-card glow-effect" data-id="${product.id}" style="animation-delay: ${index * 0.1}s">
                        <div class="popular-product-image">
                            <img src="${gambar}" alt="${Utils.escapeHtml(product.name || product.item_nama)}" 
                                 loading="lazy"
                                 onerror="this.src='https://via.placeholder.com/300x200/40a7e3/ffffff?text=Product';">
                        </div>
                        <div class="popular-product-info">
                            <h3><i class="fas ${icon}"></i> ${Utils.escapeHtml(product.name || product.item_nama || 'Produk')}</h3>
                            <div class="popular-product-desc">
                                <i class="fas fa-mobile-alt"></i> ${Utils.escapeHtml(product.category || product.aplikasi || 'Aplikasi')}
                            </div>
                            <div class="popular-product-stats">
                                <span><i class="fas fa-box"></i> ${product.stock || product.item_count || 0}</span>
                                <span><i class="fas fa-shopping-bag"></i> ${product.sold || product.terjual || 0} terjual</span>
                            </div>
                            <div class="popular-product-price">
                                ${Utils.formatRupiah(product.price || product.harga || 25000)}
                            </div>
                        </div>
                    </div>
                `;
            });

            DOM.popularProducts.innerHTML = html;
            PopularProducts.setupEvents();
        },

        renderDummy: () => {
            const dummyProducts = [
                { id: 1, name: 'Canva Premium', category: 'Canva', icon: 'fa-paint-brush', stock: 28, sold: 156, price: 25000, image: 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=Canva' },
                { id: 2, name: 'Netflix 4K', category: 'Netflix', icon: 'fa-film', stock: 15, sold: 324, price: 45000, image: 'https://via.placeholder.com/300x200/e50914/ffffff?text=Netflix' },
                { id: 3, name: 'Spotify Premium', category: 'Spotify', icon: 'fa-music', stock: 42, sold: 567, price: 35000, image: 'https://via.placeholder.com/300x200/1DB954/ffffff?text=Spotify' },
                { id: 4, name: 'Disney+ Hotstar', category: 'Disney+', icon: 'fa-magic', stock: 19, sold: 89, price: 40000, image: 'https://via.placeholder.com/300x200/113CCF/ffffff?text=Disney' },
                { id: 5, name: 'YouTube Premium', category: 'YouTube', icon: 'fa-youtube', stock: 23, sold: 432, price: 38000, image: 'https://via.placeholder.com/300x200/FF0000/ffffff?text=YouTube' },
                { id: 6, name: 'Microsoft 365', category: 'Office', icon: 'fa-microsoft', stock: 11, sold: 78, price: 55000, image: 'https://via.placeholder.com/300x200/00A4EF/ffffff?text=Office' }
            ];

            PopularProducts.render(dummyProducts);
        },

        setupEvents: () => {
            document.querySelectorAll('.popular-product-card').forEach(card => {
                card.addEventListener('click', () => {
                    const productId = card.dataset.id;
                    if (productId) {
                        ProductModal.open(parseInt(productId));
                    }
                });
            });
        }
    };

    // ===== PAYMENT METHODS RENDER =====
    const PaymentMethods = {
        render: (tampilan) => {
            if (!DOM.paymentIcons) return;

            let html = '';
            let hasPayments = false;

            // Banks
            if (tampilan?.banks && tampilan.banks.length > 0) {
                tampilan.banks.forEach(bank => {
                    if (bank.enabled) {
                        hasPayments = true;
                        html += `
                            <div class="payment-icon glow-effect">
                                <i class="fas fa-university"></i>
                                <span>${bank.bank_name || 'Bank'}</span>
                            </div>
                        `;
                    }
                });
            }

            // E-Wallets
            if (tampilan?.ewallets && tampilan.ewallets.length > 0) {
                tampilan.ewallets.forEach(ewallet => {
                    if (ewallet.enabled) {
                        hasPayments = true;
                        html += `
                            <div class="payment-icon glow-effect">
                                <i class="fas fa-wallet"></i>
                                <span>${ewallet.provider || 'E-Wallet'}</span>
                            </div>
                        `;
                    }
                });
            }

            // QRIS
            if (tampilan?.qris && tampilan.qris.enabled) {
                hasPayments = true;
                html += `
                    <div class="payment-icon glow-effect">
                        <i class="fas fa-qrcode"></i>
                        <span>QRIS</span>
                    </div>
                `;
            }

            // Crypto
            if (tampilan?.crypto && tampilan.crypto.enabled) {
                hasPayments = true;
                html += `
                    <div class="payment-icon glow-effect">
                        <i class="fab fa-bitcoin"></i>
                        <span>Crypto</span>
                    </div>
                `;
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
        open: (productId) => {
            const product = State.products.find(p => p.id === productId) || 
                           PopularProducts.getDummyProduct(productId);
            
            if (!product) return;

            State.currentProduct = product;
            ProductModal.render(product);
            
            DOM.productModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            Utils.vibrate();
        },

        render: (product) => {
            if (!DOM.productDetail) return;

            const stars = Utils.generateStars(product.rating || 4.5);
            const variants = product.variants || [];

            let variantsHtml = '';
            if (variants.length > 0) {
                variantsHtml = `
                    <div class="product-variants">
                        <h4><i class="fas fa-tags crystal-icon"></i> Pilih Varian</h4>
                        <div class="variant-list">
                `;

                variants.forEach((variant, index) => {
                    variantsHtml += `
                        <button class="variant-btn ${index === 0 ? 'active' : ''}" data-variant='${JSON.stringify(variant)}'>
                            <span class="variant-name">${Utils.escapeHtml(variant.name)}</span>
                            <span class="variant-price">${Utils.formatRupiah(variant.price)}</span>
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
                    <div class="main-image glow-effect">
                        <img src="${product.image || 'https://via.placeholder.com/500x500/40a7e3/ffffff?text=Product'}" 
                             alt="${Utils.escapeHtml(product.name)}" 
                             id="mainProductImage"
                             onload="this.style.opacity='1'"
                             style="opacity:0; transition:opacity 0.3s"
                             onerror="this.src='https://via.placeholder.com/500x500/40a7e3/ffffff?text=Product'; this.onload=null;">
                    </div>
                    ${product.images && product.images.length > 0 ? `
                        <div class="thumbnail-images">
                            ${product.images.map((img, i) => 
                                `<img src="${img}" alt="Thumb ${i+1}" onclick="window.website.setMainImage('${img}', this)" 
                                      onerror="this.style.display='none';">`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="product-detail-info">
                    <h2>${Utils.escapeHtml(product.name)}</h2>
                    <div class="product-rating">
                        <div class="stars">
                            ${stars}
                        </div>
                        <span>${product.rating || 4.5} (${product.reviews || 0} ulasan)</span>
                    </div>
                    <div class="product-price-detail">
                        <span class="current-price">${Utils.formatRupiah(product.price)}</span>
                        ${product.original_price ? 
                            `<span class="old-price">${Utils.formatRupiah(product.original_price)}</span>
                             <span class="discount-badge">-${Math.round(((product.original_price - product.price) / product.original_price) * 100)}%</span>` 
                            : ''}
                    </div>
                    <div class="product-stock">
                        <i class="fas fa-cubes crystal-icon"></i>
                        <span>Stok: <strong>${product.stock || 0}</strong></span>
                        <span class="sold-count"><i class="fas fa-shopping-bag"></i> ${product.sold || 0} terjual</span>
                    </div>
                    <div class="product-description">
                        <h4><i class="fas fa-align-left crystal-icon"></i> Deskripsi</h4>
                        <p>${Utils.escapeHtml(product.description || 'Produk berkualitas dengan harga terbaik. Dapatkan sekarang juga!')}</p>
                    </div>
                    ${variantsHtml}
                    <div class="product-notes">
                        <h4><i class="fas fa-sticky-note crystal-icon"></i> Catatan</h4>
                        <p>${Utils.escapeHtml(product.notes || 'Pastikan data yang dimasukkan benar.')}</p>
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

            DOM.productDetail.innerHTML = productHtml;
            ProductModal.setupEvents(product);
        },

        setupEvents: (product) => {
            // Variant selection
            document.querySelectorAll('.variant-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Quantity controls
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

            // Add to cart
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

                    Cart.add(product.id, variant, qty);
                });
            }

            // Buy now
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

                    Cart.add(product.id, variant, qty);
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
            if (savedCart) {
                State.cart = savedCart;
            }
            Cart.updateUI();
        },

        add: (productId, variant = null, quantity = 1) => {
            const product = State.products.find(p => p.id === productId) || 
                           PopularProducts.getDummyProduct(productId);
            
            if (!product) return;

            if (product.stock <= 0) {
                Toast.error('Stok habis');
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

            const existingIndex = State.cart.findIndex(item => 
                item.id === productId && item.variant === cartItem.variant
            );

            if (existingIndex >= 0) {
                const newQty = State.cart[existingIndex].quantity + quantity;
                if (newQty > product.stock) {
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

            // Animate cart button
            if (DOM.cartBtn) {
                DOM.cartBtn.classList.add('pulse');
                setTimeout(() => {
                    DOM.cartBtn.classList.remove('pulse');
                }, 300);
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

            const product = State.products.find(p => p.id === State.cart[index].id);
            if (product && newQuantity <= product.stock) {
                State.cart[index].quantity = newQuantity;
                Utils.saveToStorage('cart', State.cart);
                Cart.updateUI();
            } else {
                Toast.error('Stok tidak mencukupi');
            }
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
                                ${item.variant ? `<p class="cart-item-variant">${Utils.escapeHtml(item.variant)}</p>` : ''}
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
                if (DOM.cartTotal) {
                    DOM.cartTotal.textContent = Utils.formatRupiah(total);
                }
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
            if (DOM.sidebar.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
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

        close: () => {
            DOM.searchBar.classList.remove('active');
        },

        init: () => {
            const debouncedSearch = Utils.debounce((query) => {
                if (query.length > 2) {
                    Toast.info(`Mencari: ${query}`);
                    // Implement search logic here
                }
            }, 500);

            DOM.searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });

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
            if (savedUser) {
                User.setUser(savedUser);
            }

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

            if (DOM.sidebarName) {
                DOM.sidebarName.textContent = fullName;
            }
            if (DOM.sidebarUsername) {
                DOM.sidebarUsername.textContent = username;
            }
            if (DOM.sidebarAvatar) {
                const img = DOM.sidebarAvatar.querySelector('img');
                if (img) {
                    img.src = Utils.generateAvatarUrl(fullName);
                }
            }
            if (DOM.profileVerified && user.is_premium) {
                DOM.profileVerified.style.display = 'flex';
            }
            if (DOM.loginBtn) {
                DOM.loginBtn.innerHTML = '<i class="fas fa-user"></i> Profile';
            }

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
                const guestUser = {
                    id: Date.now(),
                    first_name: 'Guest',
                    username: 'guest_user',
                    is_premium: false
                };
                User.setUser(guestUser);
                Toast.info('Login sebagai Guest');
                LoginModal.close();
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
                        <span>${Utils.escapeHtml(item.name)} ${item.variant ? `(${Utils.escapeHtml(item.variant)})` : ''} x${item.quantity}</span>
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
                    <div class="payment-options">
                        <label class="payment-option glow-effect">
                            <input type="radio" name="payment" value="bank" checked>
                            <i class="fas fa-university"></i>
                            <span>Transfer Bank</span>
                        </label>
                        <label class="payment-option glow-effect">
                            <input type="radio" name="payment" value="ewallet">
                            <i class="fas fa-wallet"></i>
                            <span>E-Wallet</span>
                        </label>
                        <label class="payment-option glow-effect">
                            <input type="radio" name="payment" value="qris">
                            <i class="fas fa-qrcode"></i>
                            <span>QRIS</span>
                        </label>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" id="cancelCheckoutBtn">Batal</button>
                    <button class="btn-primary" id="processCheckoutBtn">
                        <i class="fas fa-check"></i> Proses Pembayaran
                    </button>
                </div>
            `;

            DOM.checkoutBody.innerHTML = checkoutHtml;

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
            if (tampilan.font_family) {
                root.style.setProperty('--font-family', tampilan.font_family);
            }
            if (tampilan.font_size) {
                root.style.setProperty('--font-size', `${tampilan.font_size}px`);
            }

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

        // Initialize DOM cache
        initializeDOMCache();

        // Show loading
        Loading.show('Memuat kristal 3D...');

        try {
            // Get endpoint
            State.currentEndpoint = Utils.getEndpointFromUrl();
            if (!State.currentEndpoint) {
                Toast.error('Endpoint tidak valid. Gunakan ?store=nama-endpoint');
                Loading.hide();
                return;
            }

            // Test connection
            const isConnected = await API.testConnection();
            if (!isConnected) {
                Toast.warning('Mode offline - menggunakan data dummy');
            }

            // Load website data
            Loading.progress(20);
            State.websiteData = await API.getWebsite(State.currentEndpoint);
            
            if (!State.websiteData) {
                throw new Error('Website tidak ditemukan');
            }

            // Load tampilan data
            Loading.progress(40);
            State.tampilanData = await API.getTampilan(State.websiteData.id);

            // Load products
            Loading.progress(60);
            State.structuredProducts = await API.getStructuredProducts(State.websiteData.id);
            
            // Flatten products for easy access
            if (State.structuredProducts) {
                State.structuredProducts.forEach(layanan => {
                    layanan.aplikasi?.forEach(aplikasi => {
                        aplikasi.items?.forEach(item => {
                            State.products.push({
                                ...item,
                                category: layanan.layanan_nama,
                                aplikasi: aplikasi.aplikasi_nama,
                                name: item.item_nama,
                                price: item.item_harga,
                                image: aplikasi.aplikasi_gambar || layanan.layanan_gambar,
                                stock: item.item_stok?.length || 0,
                                sold: item.terjual || 0
                            });
                        });
                    });
                });
            }

            // Load promos
            Loading.progress(80);
            State.promos = await API.getPromos(State.websiteData.id);

            // Update UI
            Loading.progress(90);
            updateUI();
            
            // Render all components
            renderAll();

            // Initialize features
            initFeatures();

            // Hide loading with delay
            setTimeout(() => {
                Loading.hide();
                Toast.success('Selamat datang di Toko 3D!');
            }, 1000);

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
            'bannerSlider', 'sliderContainer', 'sliderPrev', 'sliderNext',
            'sliderPagination', 'sliderDots',
            'categoriesGrid', 'popularProducts',
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
        if (DOM.sidebarYear) {
            DOM.sidebarYear.textContent = new Date().getFullYear();
        }
    };

    // Render all components
    const renderAll = () => {
        // Apply theme
        Theme.apply(State.tampilanData);

        // Banners
        if (State.tampilanData?.banners && State.tampilanData.banners.length > 0) {
            BannerSlider.init(State.tampilanData.banners);
        } else {
            if (DOM.bannerSlider) DOM.bannerSlider.style.display = 'none';
        }

        // Categories
        if (State.structuredProducts && State.structuredProducts.length > 0) {
            const categories = State.structuredProducts.map(l => ({
                id: l.layanan_id,
                name: l.layanan_nama,
                icon: l.layanan_gambar,
                count: l.aplikasi?.length || 0
            }));
            Categories.render(categories);
        } else {
            Categories.renderDummy();
        }

        // Popular Products
        if (State.products.length > 0) {
            const popular = [...State.products]
                .sort((a, b) => (b.sold || 0) - (a.sold || 0))
                .slice(0, 6);
            PopularProducts.render(popular);
        } else {
            PopularProducts.renderDummy();
        }

        // Promos
        PromoSlider.init(State.promos);

        // Payment Methods
        PaymentMethods.render(State.tampilanData);

        // Cart
        Cart.init();

        // User
        User.init();
    };

    // Initialize features
    const initFeatures = () => {
        // Mouse effects
        MouseEffects.init();

        // Search
        Search.init();

        // Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            tg.enableClosingConfirmation();

            if (tg.themeParams) {
                const theme = tg.themeParams;
                if (theme.bg_color) {
                    document.documentElement.style.setProperty('--bg-deep-space', theme.bg_color);
                }
                if (theme.text_color) {
                    document.documentElement.style.setProperty('--text-primary', theme.text_color);
                }
                if (theme.button_color) {
                    document.documentElement.style.setProperty('--primary-color', theme.button_color);
                }
            }
        }

        // Keyboard handler
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

            // Ctrl+K for search
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                Search.toggle();
            }
        });

        // Handle input focus for mobile
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
            document.querySelector('.popular-products')?.scrollIntoView({ behavior: 'smooth' });
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
            if (!Utils.isMobile()) {
                Sidebar.close();
            }
        }, 200));
    };

    // ===== EXPOSE GLOBAL FUNCTIONS =====
    window.website = {
        // Cart
        cartAdd: Cart.add,
        cartRemove: Cart.remove,
        cartUpdateQuantity: Cart.updateQuantity,
        cartClear: Cart.clear,
        
        // Modal
        setMainImage: ProductModal.setMainImage,
        
        // Utility
        vibrate: Utils.vibrate,
        formatRupiah: Utils.formatRupiah
    };

    // ===== START =====
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        init();
    });

})();
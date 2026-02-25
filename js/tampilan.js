// tampilan.js - Pengaturan Tampilan Website (VERSI DENGAN MULTIPLE PROMO)
(function() {
    'use strict';
    
    console.log('🎨 Tampilan Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let selectedFont = 'Inter';
    let selectedAnimation = 'none';
    let animationSettings = {
        duration: 2,
        delay: 0,
        iteration: 'infinite'
    };
    let storeDisplayName = 'Toko Online';
    
    let currentWebsite = null;
    let tampilanData = {};
    
    // Banner state
    let banners = [];
    let hasUnsavedBanners = false;
    let urlChangeTimeout = null;
    
    // Promo state
    let promos = [];
    let hasUnsavedPromos = false;
    let currentPromoId = null;
    let promoToDelete = null;
    
    // Current upload callback
    let currentUploadCallback = null;
    let currentUploadType = null;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        backToPanel: document.getElementById('backToPanel'),
        
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Logo
        logoImage: document.getElementById('logoImage'),
        logoUrl: document.getElementById('logoUrl'),
        uploadLogoBtn: document.getElementById('uploadLogoBtn'),
        saveLogoBtn: document.getElementById('saveLogoBtn'),
        
        // Banner
        bannerTrack: document.getElementById('bannerTrack'),
        emptyBannerMessage: document.getElementById('emptyBannerMessage'),
        addBannerBtn: document.getElementById('addBannerBtn'),
        saveBannersBtn: document.getElementById('saveBannersBtn'),
        
        // Promo
        promoContainer: document.getElementById('promoContainer'),
        emptyPromoMessage: document.getElementById('emptyPromoMessage'),
        addPromoBtn: document.getElementById('addPromoBtn'),
        saveAllPromoBtn: document.getElementById('saveAllPromoBtn'),
        
        // Colors
        primaryColor: document.getElementById('primaryColor'),
        primaryColorHex: document.getElementById('primaryColorHex'),
        secondaryColor: document.getElementById('secondaryColor'),
        secondaryColorHex: document.getElementById('secondaryColorHex'),
        bgColor: document.getElementById('bgColor'),
        bgColorHex: document.getElementById('bgColorHex'),
        textColor: document.getElementById('textColor'),
        textColorHex: document.getElementById('textColorHex'),
        cardColor: document.getElementById('cardColor'),
        cardColorHex: document.getElementById('cardColorHex'),
        accentColor: document.getElementById('accentColor'),
        accentColorHex: document.getElementById('accentColorHex'),
        saveColorsBtn: document.getElementById('saveColorsBtn'),
        
        // Font
        fontFamily: document.getElementById('fontFamily'),
        fontSize: document.getElementById('fontSize'),
        saveFontBtn: document.getElementById('saveFontBtn'),
        
        // FONT & ANIMASI - ELEMEN BARU
        fontGrid: document.getElementById('fontGrid'),
        animationGrid: document.getElementById('animationGrid'),
        animationControlsContainer: document.getElementById('animationControlsContainer'),
        storeDisplayNameInput: document.getElementById('storeDisplayName'),
        saveFontAnimBtn: document.getElementById('saveFontAnimBtn'),
        animPreviewText: document.getElementById('animPreviewText'),
        
        // Save All
        saveAllBtn: document.getElementById('saveAllBtn'),
        
        // Upload Modal
        uploadModal: document.getElementById('uploadModal'),
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        uploadPreview: document.getElementById('uploadPreview'),
        changeImageBtn: document.getElementById('changeImageBtn'),
        confirmUploadBtn: document.getElementById('confirmUploadBtn'),
        closeUploadModal: document.getElementById('closeUploadModal'),
        
        // Promo Modal
        promoModal: document.getElementById('promoModal'),
        promoModalTitle: document.getElementById('promoModalTitle'),
        promoForm: document.getElementById('promoForm'),
        promoId: document.getElementById('promoId'),
        promoTitle: document.getElementById('promoTitle'),
        promoBannerImageSmall: document.getElementById('promoBannerImageSmall'),
        promoBannerUrl: document.getElementById('promoBannerUrl'),
        promoBannerValidation: document.getElementById('promoBannerValidation'),
        promoDescription: document.getElementById('promoDescription'),
        promoEndDate: document.getElementById('promoEndDate'),
        promoEndTime: document.getElementById('promoEndTime'),
        promoNeverEnd: document.getElementById('promoNeverEnd'),
        promoNotes: document.getElementById('promoNotes'),
        promoActive: document.getElementById('promoActive'),
        closePromoModal: document.getElementById('closePromoModal'),
        cancelPromoBtn: document.getElementById('cancelPromoBtn'),
        
        // Delete Modal
        deleteModal: document.getElementById('deleteModal'),
        deleteMessage: document.getElementById('deleteMessage'),
        deleteInfo: document.getElementById('deleteInfo'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    // ==================== KEYBOARD HANDLER ====================
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

    // ==================== API FUNCTIONS ====================
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            setTimeout(() => {
                window.location.href = '/wtb/html/panel.html';
            }, 2000);
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                if (elements.websiteBadge) {
                    elements.websiteBadge.textContent = '/' + data.website.endpoint;
                }
                return data.website;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat data website', 'error');
            return null;
        }
    }

    function goBackToPanel() {
        // Simpan halaman settings ke session storage
        try {
            sessionStorage.setItem('panel_current_page', 'settings');
        } catch (e) {
            console.warn('Failed to save session', e);
        }

        // Redirect ke panel
        window.location.href = '/wtb/html/panel.html';
    }

    async function loadTampilanData() {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success && response.tampilan) {
                tampilanData = response.tampilan;
                updateUI();
            } else {
                console.log('ℹ️ No tampilan data found, using defaults');
                tampilanData = {};
                banners = [];
                promos = [];
                renderBannerTrack();
                renderPromos();
            }
            
            // Load font & animation settings setelah data tampilan dimuat
            loadFontAnimSettings();
            
            // Render font & animation grids jika window.FontAnimations tersedia
            if (window.FontAnimations) {
                renderFontGrid();
                renderAnimationGrid();
                renderAnimationControls();
                updateAnimationPreview();
            }
            
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
            showToast('Gagal memuat data tampilan', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Update UI
    function updateUI() {
        // Update logo
        if (tampilanData.logo) {
            if (elements.logoImage) elements.logoImage.src = tampilanData.logo;
            if (elements.logoUrl) elements.logoUrl.value = tampilanData.logo;
        }
        
        // Update banners
        if (tampilanData.banners && Array.isArray(tampilanData.banners)) {
            banners = tampilanData.banners.map(b => {
                if (typeof b === 'string') {
                    return { url: b, positionX: 50, positionY: 50 };
                } else {
                    return {
                        url: b.url || '',
                        positionX: b.positionX || 50,
                        positionY: b.positionY || 50
                    };
                }
            });
            hasUnsavedBanners = false;
        } else {
            banners = [];
            hasUnsavedBanners = false;
        }
        renderBannerTrack();
        
        // Update promos
        if (tampilanData.promos) {
            console.log('📦 Raw promos data:', tampilanData.promos);
        
            if (Array.isArray(tampilanData.promos)) {
                promos = tampilanData.promos.map(promo => ({
                    id: promo.id || Date.now() + Math.random(),
                    title: promo.title || '',
                    banner: promo.banner || '',
                    description: promo.description || '',
                    end_date: promo.end_date || '',
                    end_time: promo.end_time || '',
                    never_end: promo.never_end || false,
                    notes: promo.notes || '',
                    active: promo.active !== false
                }));
                hasUnsavedPromos = false;
            } else if (typeof tampilanData.promos === 'string') {
                try {
                    const parsed = JSON.parse(tampilanData.promos);
                    if (Array.isArray(parsed)) {
                        promos = parsed.map(promo => ({
                            id: promo.id || Date.now() + Math.random(),
                            title: promo.title || '',
                            banner: promo.banner || '',
                            description: promo.description || '',
                            end_date: promo.end_date || '',
                            end_time: promo.end_time || '',
                            never_end: promo.never_end || false,
                            notes: promo.notes || '',
                            active: promo.active !== false
                        }));
                    } else {
                        promos = [];
                    }
                } catch (e) {
                    console.error('❌ Error parsing promos:', e);
                    promos = [];
                }
                hasUnsavedPromos = false;
            } else {
                promos = [];
                hasUnsavedPromos = false;
            }
        } else if (tampilanData.promo) {
            const oldPromo = tampilanData.promo;
            promos = [{
                id: Date.now(),
                title: oldPromo.title || 'Promo',
                banner: oldPromo.banner || '',
                description: oldPromo.description || '',
                end_date: oldPromo.end_date || '',
                end_time: oldPromo.end_time || '',
                never_end: oldPromo.never_end || false,
                notes: oldPromo.notes || '',
                active: oldPromo.active !== false
            }];
            hasUnsavedPromos = true;
        } else {
            promos = [];
            hasUnsavedPromos = false;
        }
        
        console.log('📦 Processed promos:', promos);
        renderPromos();
        
        // Update colors
        if (tampilanData.colors) {
            const colors = tampilanData.colors;
        
            if (elements.primaryColor) {
                elements.primaryColor.value = colors.primary || '#40a7e3';
                elements.primaryColorHex.value = colors.primary || '#40a7e3';
            }
            if (elements.secondaryColor) {
                elements.secondaryColor.value = colors.secondary || '#FFD700';
                elements.secondaryColorHex.value = colors.secondary || '#FFD700';
            }
            if (elements.bgColor) {
                elements.bgColor.value = colors.background || '#0f0f0f';
                elements.bgColorHex.value = colors.background || '#0f0f0f';
            }
            if (elements.textColor) {
                elements.textColor.value = colors.text || '#ffffff';
                elements.textColorHex.value = colors.text || '#ffffff';
            }
            if (elements.cardColor) {
                elements.cardColor.value = colors.card || '#1a1a1a';
                elements.cardColorHex.value = colors.card || '#1a1a1a';
            }
            if (elements.accentColor) {
                elements.accentColor.value = colors.accent || '#10b981';
                elements.accentColorHex.value = colors.accent || '#10b981';
            }
        }
        
        // Update font
        if (tampilanData.font_family && elements.fontFamily) {
            elements.fontFamily.value = tampilanData.font_family;
        }
        if (tampilanData.font_size && elements.fontSize) {
            elements.fontSize.value = tampilanData.font_size;
        }
    }

    // ==================== BANNER FUNCTIONS ====================
    async function validateImageSize(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                
                console.log(`📏 Image dimensions: ${width}x${height}`);
                
                if (width === 1280 && height === 760) {
                    resolve({ valid: true, width, height });
                } else {
                    reject({ 
                        valid: false, 
                        width, 
                        height,
                        message: `Ukuran gambar harus 1280x760 pixel (saat ini ${width}x${height})`
                    });
                }
            };
            
            img.onerror = () => {
                reject({ 
                    valid: false, 
                    message: 'Gagal memuat gambar. Periksa URL dan pastikan gambar dapat diakses.'
                });
            };
            
            img.src = url;
        });
    }

    async function processBannerUrl(index, url) {
        const banner = banners[index];
        const urlInput = document.getElementById(`banner-url-${index}`);
        const previewWrapper = document.getElementById(`banner-preview-${index}`);
        const validationMsg = document.getElementById(`banner-validation-${index}`);
        const indicator = document.getElementById(`pos-indicator-${index}`);
        
        if (!url || url.trim() === '') {
            banner.url = '';
            if (previewWrapper) {
                previewWrapper.style.backgroundImage = 'none';
                previewWrapper.style.backgroundColor = '#1a1a1a';
                previewWrapper.classList.remove('has-image');
                previewWrapper.classList.add('no-image');
            }
            if (validationMsg) {
                validationMsg.innerHTML = '<i class="fas fa-info-circle"></i> Masukkan URL gambar (wajib 1280x760)';
                validationMsg.className = 'banner-validation-message info';
            }
            hasUnsavedBanners = true;
            return;
        }
        
        if (validationMsg) {
            validationMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memvalidasi gambar...';
            validationMsg.className = 'banner-validation-message info';
        }
        
        try {
            const result = await validateImageSize(url);
            
            banner.url = url;
            
            if (previewWrapper) {
                previewWrapper.style.backgroundImage = `url('${url}')`;
                previewWrapper.style.backgroundColor = 'transparent';
                previewWrapper.classList.add('has-image');
                previewWrapper.classList.remove('no-image');
                
                const placeholder = previewWrapper.querySelector('.no-image-placeholder');
                if (placeholder) placeholder.remove();
            }
            
            if (validationMsg) {
                validationMsg.innerHTML = '<i class="fas fa-check-circle"></i> Ukuran valid: 1280x760 ✓';
                validationMsg.className = 'banner-validation-message success';
            }
            
            if (indicator) {
                indicator.textContent = `X: ${banner.positionX}% Y: ${banner.positionY}%`;
            }
            
            hasUnsavedBanners = true;
            setupBannerLongPress(index);
            
        } catch (error) {
            console.error('❌ Banner validation error:', error);
            
            if (validationMsg) {
                validationMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message || 'Gambar tidak valid'}`;
                validationMsg.className = 'banner-validation-message error';
            }
            
            banner.url = '';
            
            if (previewWrapper) {
                previewWrapper.style.backgroundImage = 'none';
                previewWrapper.style.backgroundColor = '#1a1a1a';
                previewWrapper.classList.remove('has-image');
                previewWrapper.classList.add('no-image');
                
                if (!previewWrapper.querySelector('.no-image-placeholder')) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'no-image-placeholder';
                    placeholder.innerHTML = '<i class="fas fa-image"></i><span>Preview akan tampil di sini</span>';
                    previewWrapper.appendChild(placeholder);
                }
            }
        }
    }

    function addBanner() {
        const hasEmptyBanner = banners.some(b => !b.url);
        
        if (hasEmptyBanner) {
            showToast('⚠️ Ada banner yang belum diisi URL. Selesaikan atau hapus terlebih dahulu.', 'warning');
            return;
        }
        
        banners.push({
            url: '',
            positionX: 50,
            positionY: 50
        });
        
        hasUnsavedBanners = true;
        renderBannerTrack();
        vibrate(10);
        
        setTimeout(() => {
            const lastBannerIndex = banners.length - 1;
            const urlInput = document.getElementById(`banner-url-${lastBannerIndex}`);
            if (urlInput) {
                urlInput.focus();
            }
        }, 100);
    }

    function deleteBanner(index) {
        if (confirm('Hapus banner ini?')) {
            banners.splice(index, 1);
            hasUnsavedBanners = true;
            renderBannerTrack();
            vibrate(10);
        }
    }

    function moveBanner(index, direction) {
        if (direction === 'left' && index > 0) {
            [banners[index - 1], banners[index]] = [banners[index], banners[index - 1]];
            hasUnsavedBanners = true;
        } else if (direction === 'right' && index < banners.length - 1) {
            [banners[index], banners[index + 1]] = [banners[index + 1], banners[index]];
            hasUnsavedBanners = true;
        } else {
            return;
        }
        renderBannerTrack();
        vibrate(10);
    }

    function handleUrlChange(index, url) {
        if (urlChangeTimeout) {
            clearTimeout(urlChangeTimeout);
        }
        
        urlChangeTimeout = setTimeout(() => {
            processBannerUrl(index, url.trim());
        }, 800);
    }

    function setupBannerLongPress(index) {
        const previewWrapper = document.getElementById(`banner-preview-${index}`);
        if (!previewWrapper) return;
        
        let pressTimer;
        let isDragging = false;
        let startX, startY, startPosX, startPosY;
        
        const onTouchStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            
            startX = touch.clientX;
            startY = touch.clientY;
            
            pressTimer = setTimeout(() => {
                isDragging = true;
                startPosX = banners[index].positionX || 50;
                startPosY = banners[index].positionY || 50;
                previewWrapper.classList.add('dragging-active');
                vibrate(30);
            }, 500);
        };
        
        const onTouchMove = (e) => {
            if (!isDragging) {
                clearTimeout(pressTimer);
                return;
            }
            
            e.preventDefault();
            const touch = e.touches[0];
            const rect = previewWrapper.getBoundingClientRect();
            
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            const percentPerPixelX = 100 / rect.width;
            const percentPerPixelY = 100 / rect.height;
            
            let newPosX = startPosX - (deltaX * percentPerPixelX);
            let newPosY = startPosY - (deltaY * percentPerPixelY);
            
            newPosX = Math.max(0, Math.min(100, newPosX));
            newPosY = Math.max(0, Math.min(100, newPosY));
            
            banners[index].positionX = Math.round(newPosX);
            banners[index].positionY = Math.round(newPosY);
            
            previewWrapper.style.backgroundPosition = `${banners[index].positionX}% ${banners[index].positionY}%`;
            
            const indicator = document.getElementById(`pos-indicator-${index}`);
            if (indicator) {
                indicator.textContent = `X: ${banners[index].positionX}% Y: ${banners[index].positionY}%`;
            }
            
            hasUnsavedBanners = true;
        };
        
        const onTouchEnd = () => {
            clearTimeout(pressTimer);
            if (isDragging) {
                isDragging = false;
                previewWrapper.classList.remove('dragging-active');
            }
        };
        
        const onTouchCancel = () => {
            clearTimeout(pressTimer);
            isDragging = false;
            previewWrapper.classList.remove('dragging-active');
        };
        
        previewWrapper.removeEventListener('touchstart', onTouchStart);
        previewWrapper.removeEventListener('touchmove', onTouchMove);
        previewWrapper.removeEventListener('touchend', onTouchEnd);
        previewWrapper.removeEventListener('touchcancel', onTouchCancel);
        
        previewWrapper.addEventListener('touchstart', onTouchStart, { passive: false });
        previewWrapper.addEventListener('touchmove', onTouchMove, { passive: false });
        previewWrapper.addEventListener('touchend', onTouchEnd, { passive: false });
        previewWrapper.addEventListener('touchcancel', onTouchCancel, { passive: false });
    }

    function renderBannerTrack() {
        if (!elements.bannerTrack || !elements.emptyBannerMessage) return;
        
        if (banners.length === 0) {
            elements.bannerTrack.innerHTML = '';
            elements.emptyBannerMessage.style.display = 'flex';
            return;
        }
        
        elements.emptyBannerMessage.style.display = 'none';
        
        let html = '';
        banners.forEach((banner, index) => {
            const hasValidUrl = banner.url && banner.url.trim() !== '';
            const previewStyle = hasValidUrl 
                ? `background-image: url('${banner.url}'); background-position: ${banner.positionX || 50}% ${banner.positionY || 50}%;` 
                : 'background-color: #1a1a1a; background-image: none;';
            
            let validationClass = 'banner-validation-message info';
            let validationIcon = '<i class="fas fa-info-circle"></i>';
            let validationText = 'Masukkan URL gambar (wajib 1280x760)';
            
            if (hasValidUrl) {
                validationClass = 'banner-validation-message success';
                validationIcon = '<i class="fas fa-check-circle"></i>';
                validationText = 'Ukuran valid: 1280x760 ✓';
            }
            
            html += `
                <div class="banner-slide" data-index="${index}">
                    <div class="banner-slide-header">
                        <span class="banner-number">#${index + 1}</span>
                    </div>
                    
                    <div class="banner-url-input-group">
                        <div class="banner-url-input-wrapper">
                            <i class="fas fa-link input-icon"></i>
                            <input 
                                type="url" 
                                id="banner-url-${index}" 
                                class="banner-url-input" 
                                placeholder="https://i.imgur.com/xxxxxxx.jpg"
                                value="${banner.url || ''}"
                                onchange="window.tampilan.handleUrlChange(${index}, this.value)"
                                onblur="window.tampilan.handleUrlChange(${index}, this.value)"
                                onkeyup="window.tampilan.handleUrlChange(${index}, this.value)"
                            >
                        </div>
                        <div id="banner-validation-${index}" class="${validationClass}">
                            ${validationIcon} ${validationText}
                        </div>
                    </div>
                    
                    <div class="banner-preview-area" id="banner-preview-container-${index}">
                        <div 
                            class="banner-image-wrapper ${hasValidUrl ? 'has-image' : 'no-image'}" 
                            id="banner-preview-${index}"
                            style="${previewStyle}"
                            data-index="${index}"
                        >
                            ${!hasValidUrl ? '<div class="no-image-placeholder"><i class="fas fa-image"></i><span>Preview akan tampil di sini</span></div>' : ''}
                        </div>
                        
                        ${hasValidUrl ? `
                            <div class="banner-position-controls">
                                <div class="banner-position-indicator" id="pos-indicator-${index}">
                                    X: ${banner.positionX || 50}% Y: ${banner.positionY || 50}%
                                </div>
                                <div class="banner-position-hint">
                                    <i class="fas fa-hand-pointer"></i> Tekan & tahan gambar untuk menggeser posisi
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="banner-slide-actions-bottom">
                        <button class="btn-icon-small move-left" ${index === 0 ? 'disabled' : ''} onclick="window.tampilan.moveBanner(${index}, 'left')">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="btn-icon-small move-right" ${index === banners.length - 1 ? 'disabled' : ''} onclick="window.tampilan.moveBanner(${index}, 'right')">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <button class="btn-icon-small delete" onclick="window.tampilan.deleteBanner(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.bannerTrack.innerHTML = html;
        
        banners.forEach((banner, index) => {
            if (banner.url && banner.url.trim() !== '') {
                setupBannerLongPress(index);
            }
        });
    }

    // ==================== PROMO FUNCTIONS ====================
    async function validatePromoBanner(url) {
        if (!url || url.trim() === '') {
            if (elements.promoBannerValidation) {
                elements.promoBannerValidation.innerHTML = '<i class="fas fa-exclamation-triangle"></i> URL banner wajib diisi';
                elements.promoBannerValidation.className = 'banner-validation-message error';
            }
            return false;
        }
        
        if (elements.promoBannerValidation) {
            elements.promoBannerValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memvalidasi gambar...';
            elements.promoBannerValidation.className = 'banner-validation-message info';
        }
        
        try {
            const result = await validateImageSize(url);
            
            if (elements.promoBannerValidation) {
                elements.promoBannerValidation.innerHTML = '<i class="fas fa-check-circle"></i> Ukuran valid: 1280x760 ✓';
                elements.promoBannerValidation.className = 'banner-validation-message success';
            }
            
            if (elements.promoBannerImageSmall) {
                elements.promoBannerImageSmall.src = url;
            }
            
            return true;
        } catch (error) {
            if (elements.promoBannerValidation) {
                elements.promoBannerValidation.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message || 'Gambar tidak valid'}`;
                elements.promoBannerValidation.className = 'banner-validation-message error';
            }
            return false;
        }
    }

    function openPromoModal(promo = null) {
        if (promo) {
            elements.promoModalTitle.textContent = 'Edit Promosi';
            elements.promoId.value = promo.id || '';
            elements.promoTitle.value = promo.title || '';
            elements.promoBannerUrl.value = promo.banner || '';
            elements.promoDescription.value = promo.description || '';
            elements.promoEndDate.value = promo.end_date || '';
            elements.promoEndTime.value = promo.end_time || '';
            elements.promoNeverEnd.checked = promo.never_end || false;
            elements.promoNotes.value = promo.notes || '';
            elements.promoActive.checked = promo.active !== false;
            
            if (promo.banner) {
                elements.promoBannerImageSmall.src = promo.banner;
                validatePromoBanner(promo.banner);
            } else {
                elements.promoBannerImageSmall.src = 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Preview+Promo+Banner';
            }
            
            currentPromoId = promo.id;
        } else {
            elements.promoModalTitle.textContent = 'Tambah Promosi';
            elements.promoForm.reset();
            elements.promoId.value = '';
            elements.promoNeverEnd.checked = false;
            elements.promoActive.checked = true;
            elements.promoEndDate.disabled = false;
            elements.promoEndTime.disabled = false;
            elements.promoBannerImageSmall.src = 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=Preview+Promo+Banner';
            
            if (elements.promoBannerValidation) {
                elements.promoBannerValidation.innerHTML = '<i class="fas fa-info-circle"></i> Masukkan URL banner (wajib 1280x760)';
                elements.promoBannerValidation.className = 'banner-validation-message info';
            }
            
            currentPromoId = null;
        }
        
        updatePromoDateFields();
        
        elements.promoModal.classList.add('active');
        vibrate(10);
        
        setTimeout(() => {
            elements.promoTitle.focus();
        }, 300);
    }

    function closePromoModal() {
        elements.promoModal.classList.remove('active');
        currentPromoId = null;
    }

    function updatePromoDateFields() {
        const neverEnd = elements.promoNeverEnd.checked;
        elements.promoEndDate.disabled = neverEnd;
        elements.promoEndTime.disabled = neverEnd;
        
        if (neverEnd) {
            elements.promoEndDate.value = '';
            elements.promoEndTime.value = '';
        }
    }

    async function savePromo(e) {
        e.preventDefault();
        
        const title = elements.promoTitle.value.trim();
        const banner = elements.promoBannerUrl.value.trim();
        const description = elements.promoDescription.value.trim();
        const endDate = elements.promoNeverEnd.checked ? null : elements.promoEndDate.value;
        const endTime = elements.promoNeverEnd.checked ? null : elements.promoEndTime.value;
        const neverEnd = elements.promoNeverEnd.checked;
        const notes = elements.promoNotes.value.trim();
        const active = elements.promoActive.checked;
        
        if (!title) {
            showToast('Judul promosi wajib diisi', 'warning');
            elements.promoTitle.focus();
            return;
        }
        
        if (!banner) {
            showToast('URL banner promosi wajib diisi', 'warning');
            elements.promoBannerUrl.focus();
            return;
        }
        
        const isValid = await validatePromoBanner(banner);
        if (!isValid) {
            showToast('Banner tidak valid. Periksa URL dan ukuran gambar (harus 1280x760)', 'error');
            return;
        }
        
        if (!neverEnd && !endDate) {
            showToast('Tanggal berakhir wajib diisi jika tidak memilih "Tidak ada batas waktu"', 'warning');
            elements.promoEndDate.focus();
            return;
        }
        
        const promoData = {
            id: currentPromoId || Date.now() + Math.random(),
            title: title,
            banner: banner,
            description: description,
            end_date: endDate,
            end_time: endTime,
            never_end: neverEnd,
            notes: notes,
            active: active
        };
        
        if (currentPromoId) {
            const index = promos.findIndex(p => p.id == currentPromoId);
            if (index !== -1) {
                promos[index] = promoData;
            }
        } else {
            promos.push(promoData);
        }
        
        hasUnsavedPromos = true;
        renderPromos();
        closePromoModal();
        showToast(`✅ Promosi ${currentPromoId ? 'diperbarui' : 'ditambahkan'}`, 'success');
        vibrate(10);
    }

    function deletePromo(id) {
        const promo = promos.find(p => p.id == id);
        if (!promo) return;
        
        promoToDelete = { id, title: promo.title };
        
        if (elements.deleteMessage) {
            elements.deleteMessage.textContent = `Hapus promosi "${promo.title}"?`;
        }
        if (elements.deleteInfo) {
            elements.deleteInfo.innerHTML = `<strong>${escapeHtml(promo.title)}</strong>`;
        }
        
        elements.deleteModal.classList.add('active');
        vibrate(10);
    }

    function confirmDeletePromo() {
        if (!promoToDelete) return;
        
        const index = promos.findIndex(p => p.id == promoToDelete.id);
        if (index !== -1) {
            promos.splice(index, 1);
            hasUnsavedPromos = true;
            renderPromos();
            showToast('✅ Promosi dihapus', 'success');
        }
        
        closeDeleteModal();
        vibrate(10);
    }

    function closeDeleteModal() {
        elements.deleteModal.classList.remove('active');
        promoToDelete = null;
    }

    function renderPromos() {
        if (!elements.promoContainer || !elements.emptyPromoMessage) return;
        
        if (promos.length === 0) {
            elements.promoContainer.innerHTML = '';
            elements.emptyPromoMessage.style.display = 'flex';
            return;
        }
        
        elements.emptyPromoMessage.style.display = 'none';
        
        let html = '';
        promos.forEach(promo => {
            const expiryText = promo.never_end 
                ? '<span class="promo-expiry never"><i class="fas fa-infinity"></i> Tidak ada batas waktu</span>'
                : `<span class="promo-expiry"><i class="fas fa-clock"></i> Berakhir: ${formatDate(promo.end_date, promo.end_time)}</span>`;
            
            const statusClass = promo.active ? 'active' : 'inactive';
            const statusText = promo.active ? 'Aktif' : 'Tidak Aktif';
            
            html += `
                <div class="promo-card" data-id="${promo.id}">
                    <div class="promo-banner-wrapper">
                        <img src="${promo.banner || 'https://via.placeholder.com/1280x760/40a7e3/ffffff?text=No+Image'}" 
                             alt="${escapeHtml(promo.title)}"
                             onerror="this.src='https://via.placeholder.com/1280x760/40a7e3/ffffff?text=No+Image';">
                    </div>
                    
                    <div class="promo-content">
                        <h3 class="promo-title">${escapeHtml(promo.title)}</h3>
                        
                        ${promo.description ? `<p class="promo-description">${escapeHtml(promo.description)}</p>` : ''}
                        
                        <div class="promo-meta">
                            ${expiryText}
                            <span class="promo-status ${statusClass}">
                                <i class="fas fa-${promo.active ? 'check-circle' : 'times-circle'}"></i>
                                ${statusText}
                            </span>
                        </div>
                        
                        ${promo.notes ? `
                            <div class="promo-notes">
                                <i class="fas fa-sticky-note"></i>
                                ${escapeHtml(promo.notes)}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="promo-actions">
                        <button class="promo-action-btn edit" onclick="window.tampilan.editPromo('${promo.id}')" title="Edit Promosi">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="promo-action-btn delete" onclick="window.tampilan.deletePromo('${promo.id}')" title="Hapus Promosi">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.promoContainer.innerHTML = html;
    }

    async function saveAllPromos() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        if (promos.length === 0) {
            showToast('Belum ada promosi untuk disimpan', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const cleanPromos = promos.map(promo => ({
                id: promo.id,
                title: promo.title,
                banner: promo.banner,
                description: promo.description || '',
                end_date: promo.end_date || null,
                end_time: promo.end_time || null,
                never_end: promo.never_end || false,
                notes: promo.notes || '',
                active: promo.active !== false
            }));
        
            console.log('📤 Saving promos:', cleanPromos);
        
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/promos`, {
                method: 'POST',
                body: JSON.stringify({ promos: cleanPromos })
            });
        
            console.log('📥 Save response:', response);
        
            if (response.success) {
                showToast(`✅ ${promos.length} promosi disimpan!`, 'success');
                hasUnsavedPromos = false;
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan promosi');
            }
        } catch (error) {
            console.error('❌ Error saving promos:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== FONT & ANIMATION FUNCTIONS ====================
    function renderFontGrid() {
        if (!elements.fontGrid) return;
        if (!window.FontAnimations) {
            console.warn('FontAnimations not loaded');
            return;
        }
        
        const allFonts = window.FontAnimations.getAllFonts();
        let html = '';
        
        allFonts.forEach(font => {
            const isSelected = (font.name === selectedFont);
            html += window.FontAnimations.renderFontCard(font, isSelected);
        });
        
        elements.fontGrid.innerHTML = html;
        
        document.querySelectorAll('.font-card').forEach(card => {
            card.addEventListener('click', () => {
                const fontName = card.dataset.font;
                const fontFamily = card.dataset.family;
                const fontUrl = card.dataset.url;
                
                selectedFont = fontName;
                
                if (fontUrl) {
                    window.FontAnimations.loadFont(fontName, fontUrl);
                }
                
                renderFontGrid();
                updateAnimationPreview();
                
                const previewText = elements.animPreviewText;
                if (previewText) {
                    previewText.style.fontFamily = fontFamily;
                }
                
                vibrate(10);
            });
        });
    }
    
    function renderAnimationGrid() {
        if (!elements.animationGrid) return;
        if (!window.ANIMATION_DATA) {
            console.warn('ANIMATION_DATA not loaded');
            return;
        }
        
        const animations = window.ANIMATION_DATA.animations;
        const previewText = storeDisplayName || 'Toko Online';
        let html = '';
        
        animations.forEach(anim => {
            const isSelected = (anim.id === selectedAnimation);
            html += window.FontAnimations.renderAnimationCard(anim, isSelected, previewText);
        });
        
        elements.animationGrid.innerHTML = html;
        
        animations.forEach(anim => {
            if (anim.css && anim.id !== 'none') {
                if (!document.getElementById(`anim-style-${anim.id}`)) {
                    const style = document.createElement('style');
                    style.id = `anim-style-${anim.id}`;
                    style.textContent = anim.css;
                    document.head.appendChild(style);
                }
            }
        });
        
        document.querySelectorAll('.animation-card').forEach(card => {
            card.addEventListener('click', () => {
                const animId = card.dataset.animation;
                selectedAnimation = animId;
                
                renderAnimationGrid();
                updateAnimationPreview();
                
                vibrate(10);
            });
        });
    }
    
    function renderAnimationControls() {
        if (!elements.animationControlsContainer) return;
        if (!window.FontAnimations) return;
        
        elements.animationControlsContainer.innerHTML = window.FontAnimations.renderAnimationControls(animationSettings);
        
        const durationSelect = document.getElementById('animDuration');
        const delaySelect = document.getElementById('animDelay');
        const iterationSelect = document.getElementById('animIteration');
        
        if (durationSelect) {
            durationSelect.addEventListener('change', (e) => {
                animationSettings.duration = parseFloat(e.target.value);
                updateAnimationPreview();
            });
        }
        
        if (delaySelect) {
            delaySelect.addEventListener('change', (e) => {
                animationSettings.delay = parseFloat(e.target.value);
                updateAnimationPreview();
            });
        }
        
        if (iterationSelect) {
            iterationSelect.addEventListener('change', (e) => {
                animationSettings.iteration = e.target.value;
                updateAnimationPreview();
            });
        }
    }
    
    function updateAnimationPreview() {
        const previewElement = elements.animPreviewText;
        if (!previewElement) return;
        
        const selectedFontCard = document.querySelector(`.font-card[data-font="${selectedFont}"]`);
        if (selectedFontCard) {
            previewElement.style.fontFamily = selectedFontCard.dataset.family;
        }
        
        if (selectedAnimation === 'none') {
            previewElement.style.animation = 'none';
        } else {
            const animName = selectedAnimation.replace('Anim', '');
            const duration = animationSettings.duration;
            const delay = animationSettings.delay;
            const iteration = animationSettings.iteration;
            
            previewElement.style.animation = `${animName} ${duration}s ${delay}s ${iteration}`;
        }
    }
    
    async function saveFontAnimSettings() {
        if (!currentWebsite) return;
        
        const storeName = elements.storeDisplayNameInput?.value || 'Toko Online';
        
        const data = {
            store_display_name: storeName,
            font_family: selectedFont,
            animation: selectedAnimation,
            animation_duration: animationSettings.duration,
            animation_delay: animationSettings.delay,
            animation_iteration: animationSettings.iteration
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font-anim`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Pengaturan font & animasi disimpan!', 'success');
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving font anim:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
    
    function loadFontAnimSettings() {
        if (!tampilanData) return;
        
        if (tampilanData.store_display_name) {
            storeDisplayName = tampilanData.store_display_name;
            if (elements.storeDisplayNameInput) {
                elements.storeDisplayNameInput.value = storeDisplayName;
            }
        }
        
        if (tampilanData.font_family) {
            selectedFont = tampilanData.font_family;
        }
        
        if (tampilanData.animation) {
            selectedAnimation = tampilanData.animation;
        }
        
        if (tampilanData.animation_duration) {
            animationSettings.duration = tampilanData.animation_duration;
        }
        
        if (tampilanData.animation_delay) {
            animationSettings.delay = tampilanData.animation_delay;
        }
        
        if (tampilanData.animation_iteration) {
            animationSettings.iteration = tampilanData.animation_iteration;
        }
    }

    // ==================== SAVE FUNCTIONS ====================
    async function saveLogo() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const logoUrl = elements.logoUrl?.value || elements.logoImage?.src || '';
        
        if (logoUrl && !logoUrl.toLowerCase().endsWith('.png') && !logoUrl.startsWith('data:image/png')) {
            showToast('Logo harus berformat PNG', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/logo`, {
                method: 'POST',
                body: JSON.stringify({ url: logoUrl })
            });
            
            if (response.success) {
                showToast('✅ Logo disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan logo');
            }
        } catch (error) {
            console.error('❌ Error saving logo:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function saveBanners() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const validBanners = banners.filter(b => b.url && b.url.trim() !== '');
        
        if (validBanners.length === 0) {
            showToast('Minimal 1 banner dengan URL gambar yang valid diperlukan', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const bannersToSave = validBanners.map(b => ({
                url: b.url,
                positionX: b.positionX || 50,
                positionY: b.positionY || 50
            }));
            
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/banners`, {
                method: 'POST',
                body: JSON.stringify({ banners: bannersToSave })
            });
            
            if (response.success) {
                showToast(`✅ ${validBanners.length} banner disimpan!`, 'success');
                hasUnsavedBanners = false;
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan banner');
            }
        } catch (error) {
            console.error('❌ Error saving banners:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function saveColors() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const colors = {
            primary: elements.primaryColorHex?.value || '#40a7e3',
            secondary: elements.secondaryColorHex?.value || '#FFD700',
            background: elements.bgColorHex?.value || '#0f0f0f',
            text: elements.textColorHex?.value || '#ffffff',
            card: elements.cardColorHex?.value || '#1a1a1a',
            accent: elements.accentColorHex?.value || '#10b981'
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/colors`, {
                method: 'POST',
                body: JSON.stringify(colors)
            });
            
            if (response.success) {
                showToast('✅ Warna disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan warna');
            }
        } catch (error) {
            console.error('❌ Error saving colors:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function saveFont() {
        if (!currentWebsite) return;
        
        const fontData = {
            family: elements.fontFamily?.value || 'Inter',
            size: parseInt(elements.fontSize?.value) || 14
        };
        
        showLoading(true);
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font`, {
                method: 'POST',
                body: JSON.stringify(fontData)
            });
            if (response.success) {
                showToast('✅ Font disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan font');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function saveAll() {
        await Promise.all([
            saveLogo(),
            saveBanners(),
            saveAllPromos(),
            saveColors(),
            saveFont(),
            saveFontAnimSettings()
        ]);
        showToast('✅ Semua pengaturan telah disimpan!', 'success');
    }

    // ==================== UPLOAD MODAL FUNCTIONS ====================
    function openUploadModal(callback, type) {
        currentUploadCallback = callback;
        currentUploadType = type;
        
        if (elements.uploadPreview) {
            elements.uploadPreview.style.display = 'none';
        }
        if (elements.uploadArea) {
            elements.uploadArea.style.display = 'flex';
        }
        if (elements.fileInput) {
            elements.fileInput.value = '';
            elements.fileInput.accept = 'image/*';
        }
        if (elements.confirmUploadBtn) {
            elements.confirmUploadBtn.disabled = true;
        }
        
        elements.uploadModal.classList.add('active');
    }

    function closeUploadModal() {
        elements.uploadModal.classList.remove('active');
        currentUploadCallback = null;
        currentUploadType = null;
    }

    function handleImageUpload(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            
            if (elements.uploadArea) {
                elements.uploadArea.style.display = 'none';
            }
            
            if (elements.uploadPreview) {
                elements.uploadPreview.style.display = 'block';
                const img = elements.uploadPreview.querySelector('img');
                if (img) {
                    img.src = imageUrl;
                }
            }
            
            if (elements.confirmUploadBtn) {
                elements.confirmUploadBtn.disabled = false;
            }
        };
        
        reader.readAsDataURL(file);
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await loadTampilanData();
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Back to panel
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', (e) => {
                e.preventDefault();
                
                try {
                    sessionStorage.setItem('panel_current_page', 'settings');
                    sessionStorage.setItem('panel_return_from', 'settings');
                } catch (e) {}
                
                window.location.href = '/wtb/html/panel.html';
            });
        }
        
        // Tabs
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                elements.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
                
                vibrate(10);
            });
        });
        
        // Color picker sync
        const colorPairs = [
            { picker: 'primaryColor', hex: 'primaryColorHex' },
            { picker: 'secondaryColor', hex: 'secondaryColorHex' },
            { picker: 'bgColor', hex: 'bgColorHex' },
            { picker: 'textColor', hex: 'textColorHex' },
            { picker: 'cardColor', hex: 'cardColorHex' },
            { picker: 'accentColor', hex: 'accentColorHex' }
        ];
        
        colorPairs.forEach(pair => {
            const picker = document.getElementById(pair.picker);
            const hex = document.getElementById(pair.hex);
            
            if (picker && hex) {
                picker.addEventListener('input', () => {
                    hex.value = picker.value;
                });
                
                hex.addEventListener('input', () => {
                    if (/^#[0-9A-F]{6}$/i.test(hex.value)) {
                        picker.value = hex.value;
                    }
                });
            }
        });
        
        // Logo upload
        if (elements.uploadLogoBtn) {
            elements.uploadLogoBtn.addEventListener('click', () => {
                openUploadModal((imageUrl) => {
                    if (!imageUrl.startsWith('data:image/png') && !imageUrl.toLowerCase().endsWith('.png')) {
                        showToast('Hanya file PNG yang diperbolehkan untuk logo', 'error');
                        return;
                    }
                    if (elements.logoImage) {
                        elements.logoImage.src = imageUrl;
                    }
                    if (elements.logoUrl) {
                        elements.logoUrl.value = imageUrl;
                    }
                    showToast('✅ Logo diperbarui!', 'success');
                }, 'logo');
            });
        }
        
        if (elements.saveLogoBtn) {
            elements.saveLogoBtn.addEventListener('click', saveLogo);
        }
        
        // Banner
        if (elements.addBannerBtn) {
            elements.addBannerBtn.addEventListener('click', addBanner);
        }
        
        if (elements.saveBannersBtn) {
            elements.saveBannersBtn.addEventListener('click', saveBanners);
        }
        
        // Promo
        if (elements.addPromoBtn) {
            elements.addPromoBtn.addEventListener('click', () => openPromoModal());
        }
        
        if (elements.saveAllPromoBtn) {
            elements.saveAllPromoBtn.addEventListener('click', saveAllPromos);
        }
        
        // Promo modal
        if (elements.promoForm) {
            elements.promoForm.addEventListener('submit', savePromo);
        }
        
        if (elements.closePromoModal) {
            elements.closePromoModal.addEventListener('click', closePromoModal);
        }
        
        if (elements.cancelPromoBtn) {
            elements.cancelPromoBtn.addEventListener('click', closePromoModal);
        }
        
        // Promo banner URL validation
        if (elements.promoBannerUrl) {
            let bannerTimeout;
            elements.promoBannerUrl.addEventListener('input', () => {
                clearTimeout(bannerTimeout);
                bannerTimeout = setTimeout(() => {
                    validatePromoBanner(elements.promoBannerUrl.value.trim());
                }, 800);
            });
        }
        
        // Promo never end toggle
        if (elements.promoNeverEnd) {
            elements.promoNeverEnd.addEventListener('change', updatePromoDateFields);
        }
        
        // Delete modal
        if (elements.closeDeleteModal) {
            elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDeletePromo);
        }
        
        // Colors
        if (elements.saveColorsBtn) {
            elements.saveColorsBtn.addEventListener('click', saveColors);
        }
        
        // Font
        if (elements.saveFontBtn) {
            elements.saveFontBtn.addEventListener('click', saveFont);
        }
        
        // Font & Animation
        if (elements.saveFontAnimBtn) {
            elements.saveFontAnimBtn.addEventListener('click', saveFontAnimSettings);
        }
        
        // Store display name input - update preview实时
        if (elements.storeDisplayNameInput) {
            elements.storeDisplayNameInput.addEventListener('input', (e) => {
                storeDisplayName = e.target.value || 'Toko Online';
                if (elements.animPreviewText) {
                    elements.animPreviewText.textContent = storeDisplayName;
                }
                updateAnimationPreview();
            });
        }
        
        // Save All
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', saveAll);
        }
        
        // Upload Modal
        if (elements.uploadArea) {
            elements.uploadArea.addEventListener('click', () => {
                if (elements.fileInput) {
                    elements.fileInput.click();
                }
            });
            
            elements.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                elements.uploadArea.style.borderColor = '#40a7e3';
                elements.uploadArea.style.background = 'rgba(64, 167, 227, 0.1)';
            });
            
            elements.uploadArea.addEventListener('dragleave', () => {
                elements.uploadArea.style.borderColor = 'var(--border-color)';
                elements.uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
            });
            
            elements.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                elements.uploadArea.style.borderColor = 'var(--border-color)';
                elements.uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    handleImageUpload(files[0]);
                }
            });
        }
        
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', () => {
                if (elements.fileInput.files.length > 0) {
                    handleImageUpload(elements.fileInput.files[0]);
                }
            });
        }
        
        if (elements.changeImageBtn) {
            elements.changeImageBtn.addEventListener('click', () => {
                if (elements.fileInput) {
                    elements.fileInput.click();
                }
            });
        }
        
        if (elements.confirmUploadBtn) {
            elements.confirmUploadBtn.addEventListener('click', () => {
                if (currentUploadCallback && elements.uploadPreview) {
                    const img = elements.uploadPreview.querySelector('img');
                    if (img) {
                        currentUploadCallback(img.src);
                    }
                }
                closeUploadModal();
            });
        }
        
        if (elements.closeUploadModal) {
            elements.closeUploadModal.addEventListener('click', closeUploadModal);
        }
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.uploadModal) {
                closeUploadModal();
            }
            if (e.target === elements.promoModal) {
                closePromoModal();
            }
            if (e.target === elements.deleteModal) {
                closeDeleteModal();
            }
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.tampilan = {
        // Banner functions
        handleUrlChange: (index, url) => handleUrlChange(index, url),
        deleteBanner: (index) => deleteBanner(index),
        moveBanner: (index, direction) => moveBanner(index, direction),
        
        // Promo functions
        editPromo: (id) => {
            const promo = promos.find(p => p.id == id);
            if (promo) openPromoModal(promo);
        },
        deletePromo: (id) => deletePromo(id)
    };

    // ==================== START ====================
    setupKeyboardHandler();
    setupEventListeners();
    init();
})();
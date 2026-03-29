// tampilan.js - Pengaturan Tampilan Website (VERSI DENGAN TEMPLATE FONT - REVISED)
(function() {
    'use strict';
    
    console.log('🎨 Tampilan Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
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
    
    // Font Template state
    let savedTemplates = [];
    let currentTemplateCode = null;
    let currentTemplateData = null;
    let storeDisplayName = 'Toko Online';
    let allTemplates = [];
    let searchTimeout = null;
    let injectedFonts = new Set(); // Untuk melacak font yang sudah di-inject
    
    // Font Application state
    let selectedTemplateForApply = null;
    let currentPreviewTarget = 'store_name';
    
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
        
        // Store Display Name
        storeDisplayNameInput: document.getElementById('storeDisplayName'),
        applyFontToStoreBtn: document.getElementById('applyFontToStoreBtn'),
        
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
        
        // Font Template
        createFontTemplateBtn: document.getElementById('createFontTemplateBtn'),
        viewAllTemplatesBtn: document.getElementById('viewAllTemplatesBtn'),
        
        // Form Tambah Template
        templateNameInput: document.getElementById('templateNameInput'),
        templateCodeInput: document.getElementById('templateCodeInput'),
        saveTemplateToWebsiteBtn: document.getElementById('saveTemplateToWebsiteBtn'),
        
        // Font Style Application
        applyFontTemplateSelect: document.getElementById('applyFontTemplateSelect'),
        applyFontTargetSelect: document.getElementById('applyFontTargetSelect'),
        applyFontStyleBtn: document.getElementById('applyFontStyleBtn'),
        previewFontStyleBtn: document.getElementById('previewFontStyleBtn'),
        fontPreviewPanel: document.getElementById('fontPreviewPanel'),
        closePreviewBtn: document.getElementById('closePreviewBtn'),
        previewStoreName: document.getElementById('previewStoreName'),
        previewHeading: document.getElementById('previewHeading'),
        previewBody: document.getElementById('previewBody'),
        
        // Saved Templates Grid
        savedTemplatesGrid: document.getElementById('savedTemplatesGrid'),
        emptySavedTemplates: document.getElementById('emptySavedTemplates'),
        
        // Template Input Tabs (untuk fitur lama)
        templateInputTabs: document.querySelectorAll('.template-input-tab'),
        templateInputPanels: document.querySelectorAll('.template-input-panel'),
        fontTemplateCode: document.getElementById('fontTemplateCode'),
        verifyTemplateCode: document.getElementById('verifyTemplateCode'),
        templateSearchInput: document.getElementById('templateSearchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        templateSearchResults: document.getElementById('templateSearchResults'),
        applyTemplateBtn: document.getElementById('applyTemplateBtn'),
        testTemplateBtn: document.getElementById('testTemplateBtn'),
        saveTemplateCodeBtn: document.getElementById('saveTemplateCodeBtn'),
        templatePreviewCard: document.getElementById('templatePreviewCard'),
        templatePreviewText: document.getElementById('templatePreviewText'),
        previewFontName: document.getElementById('previewFontName'),
        previewAnimName: document.getElementById('previewAnimName'),
        clearTemplatePreview: document.getElementById('clearTemplatePreview'),
        selectedTemplateInfo: document.getElementById('selectedTemplateInfo'),
        selectedTemplateName: document.getElementById('selectedTemplateName'),
        changeTemplateBtn: document.getElementById('changeTemplateBtn'),
        templateValidationMessage: document.getElementById('templateValidationMessage'),
        
        // All Templates Modal
        allTemplatesModal: document.getElementById('allTemplatesModal'),
        closeAllTemplatesModal: document.getElementById('closeAllTemplatesModal'),
        modalTemplateSearch: document.getElementById('modalTemplateSearch'),
        modalTemplateFilter: document.getElementById('modalTemplateFilter'),
        allTemplatesGrid: document.getElementById('allTemplatesGrid'),
        
        // Font Preview Modal
        fontPreviewModal: document.getElementById('fontPreviewModal'),
        closeFontPreviewModal: document.getElementById('closeFontPreviewModal'),
        modalPreviewStoreName: document.getElementById('modalPreviewStoreName'),
        modalPreviewHeading: document.getElementById('modalPreviewHeading'),
        modalPreviewBody: document.getElementById('modalPreviewBody'),
        modalPreviewFontName: document.getElementById('modalPreviewFontName'),
        modalPreviewAnimName: document.getElementById('modalPreviewAnimName'),
        
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

    /**
     * Inject font ke halaman untuk preview
     */
    function injectFontForPreview(fontFamily, fontData) {
        if (!fontData || injectedFonts.has(fontFamily)) return;
        
        const fontFace = `
            @font-face {
                font-family: '${fontFamily}';
                src: url('${fontData}') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
        `;
        
        const oldStyle = document.getElementById(`preview-font-${fontFamily}`);
        if (oldStyle) oldStyle.remove();
        
        const style = document.createElement('style');
        style.id = `preview-font-${fontFamily}`;
        style.textContent = fontFace;
        document.head.appendChild(style);
        
        injectedFonts.add(fontFamily);
        console.log(`✅ Font injected for preview: ${fontFamily}`);
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
                
                // Update create template button href
                if (elements.createFontTemplateBtn) {
                    elements.createFontTemplateBtn.href = `/wtb/html/tampilan/font.html?website=${endpoint}`;
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
        try {
            sessionStorage.setItem('panel_current_page', 'settings');
            sessionStorage.setItem('panel_return_from', 'settings');
        } catch (e) {}
        
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
            
            // Load saved templates
            await loadSavedTemplates();
            
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
        
        // Update store display name
        if (tampilanData.store_display_name) {
            storeDisplayName = tampilanData.store_display_name;
            if (elements.storeDisplayNameInput) {
                elements.storeDisplayNameInput.value = storeDisplayName;
            }
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

    // ==================== FUNGSI UNTUK TEMPLATE TERSIMPAN ====================
    
    async function loadSavedTemplates() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/templates`, {
                method: 'GET'
            });
            
            if (response.success && response.templates) {
                savedTemplates = response.templates;
                renderSavedTemplates();
                populateTemplateSelect();
            } else {
                savedTemplates = [];
                renderSavedTemplates();
                populateTemplateSelect();
            }
        } catch (error) {
            console.error('❌ Error loading saved templates:', error);
            savedTemplates = [];
            renderSavedTemplates();
            populateTemplateSelect();
        }
    }

    function populateTemplateSelect() {
        if (!elements.applyFontTemplateSelect) return;
        
        let options = '<option value="">-- Pilih Template Tersimpan --</option>';
        
        savedTemplates.forEach(template => {
            const templateData = template.template_data || {};
            const fontFamily = templateData.font_family || 'Inter';
            options += `<option value="${template.template_code}" data-font="${fontFamily}" data-anim="${templateData.animation_type || 'none'}">${escapeHtml(template.template_name)} (${fontFamily})</option>`;
        });
        
        elements.applyFontTemplateSelect.innerHTML = options;
    }

    function renderSavedTemplates() {
      if (!elements.savedTemplatesGrid || !elements.emptySavedTemplates) return;
    
      if (savedTemplates.length === 0) {
        elements.savedTemplatesGrid.innerHTML = '';
        elements.emptySavedTemplates.style.display = 'block';
        return;
      }
    
      elements.emptySavedTemplates.style.display = 'none';
    
      let html = '';
      savedTemplates.forEach(template => {
        const templateData = template.template_data || {};
        const fontFamily = templateData.font_family || 'Inter';
        const animationType = templateData.animation_type || 'pulse';
        const previewText = templateData.preview_text || 'Toko Online';
        const previewSubtext = templateData.preview_subtext || 'Premium';
        const textColor = templateData.text_color || '#ffffff';
        const fontSize = templateData.font_size || 24;
        const animDuration = templateData.animation_duration || 2;
        const animDelay = templateData.animation_delay || 0;
        const animIteration = templateData.animation_iteration || 'infinite';
        const templateCode = template.template_code;
        const shortCode = templateCode.substring(0, 15) + '...';
        const createdDate = new Date(template.created_at).toLocaleDateString('id-ID');
    
        // Inject font jika ada file font
        if (templateData.font_file_data) {
          injectFontForPreview(templateData.font_family, templateData.font_file_data);
        }
    
        // Definisikan animasi berdasarkan jenisnya
        let animationCSS = '';
        if (animationType === 'pulse') {
          animationCSS = `animation: pulseAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'bounce') {
          animationCSS = `animation: bounceAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'shake') {
          animationCSS = `animation: shakeAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'fade') {
          animationCSS = `animation: fadeAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'rotate') {
          animationCSS = `animation: rotateAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'slide') {
          animationCSS = `animation: slideAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'float') {
          animationCSS = `animation: floatAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        } else if (animationType === 'wave') {
          animationCSS = `animation: waveAnim ${animDuration}s ${animDelay}s ${animIteration};`;
        }
    
        html += `
                <div class="template-saved-card" data-id="${template.id}" data-code="${templateCode}">
                    <div class="template-preview-border">
                        <div class="template-preview-text-animated" 
                             style="font-family: '${fontFamily}', sans-serif; 
                                    color: ${textColor};
                                    font-size: ${fontSize}px;
                                    ${animationCSS}">
                            ${previewText}
                        </div>
                        <div class="template-preview-subtext-animated" 
                             style="font-family: '${fontFamily}', sans-serif; 
                                    color: ${textColor};
                                    opacity: 0.8;
                                    ${animationType !== 'none' ? `animation: ${animationType}Anim ${animDuration}s ${animDelay}s ${animIteration};` : ''}">
                            ${previewSubtext}
                        </div>
                    </div>
                    <div class="template-info">
                        <div class="template-name">
                            ${escapeHtml(template.template_name || 'Template')}
                            <span class="template-badge">${template.usage_count || 0} digunakan</span>
                        </div>
                        
                        <div class="template-code-display" onclick="window.tampilan.copyTemplateCode('${templateCode}')" title="Klik untuk copy">
                            <code>${shortCode}</code>
                            <i class="fas fa-copy"></i>
                        </div>
                        
                        <div class="template-meta">
                            <span><i class="fas fa-font"></i> Font: ${fontFamily}</span>
                            <span><i class="fas fa-film"></i> Animasi: ${animationType}</span>
                            <span><i class="fas fa-calendar"></i> Dibuat: ${createdDate}</span>
                        </div>
                        
                        <div class="template-actions">
                            <button class="template-action-btn apply" onclick="window.tampilan.applyTemplate('${templateCode}')">
                                <i class="fas fa-check"></i> Terapkan
                            </button>
                            <button class="template-action-btn copy" onclick="window.tampilan.copyTemplateCode('${templateCode}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                            <button class="template-action-btn delete" onclick="window.tampilan.deleteSavedTemplate('${template.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
      });
    
      elements.savedTemplatesGrid.innerHTML = html;
    
      // Verifikasi animasi untuk setiap card
      document.querySelectorAll('.template-saved-card').forEach(card => {
        const previewDiv = card.querySelector('.template-preview-text-animated');
        if (previewDiv) {
          // Pastikan animasi berjalan
          previewDiv.style.animationPlayState = 'running';
        }
      });
    }

    function injectTemplateFont(fontFamily, fontFileData) {
        if (!fontFileData) return;
        
        const fontFace = `
            @font-face {
                font-family: '${fontFamily}';
                src: url('${fontFileData}') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
        `;
        
        const oldStyle = document.getElementById(`template-font-${fontFamily}`);
        if (oldStyle) oldStyle.remove();
        
        const style = document.createElement('style');
        style.id = `template-font-${fontFamily}`;
        style.textContent = fontFace;
        document.head.appendChild(style);
    }

    async function saveTemplateToWebsite() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const templateName = elements.templateNameInput?.value.trim();
        const templateCode = elements.templateCodeInput?.value.trim();
        
        if (!templateName) {
            showToast('Nama template wajib diisi', 'warning');
            return;
        }
        
        if (!templateCode || templateCode.length !== 35) {
            showToast('Kode template harus 35 karakter', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            // Verifikasi dulu apakah template valid
            const verifyResponse = await fetch(`${API_BASE_URL}/api/font-templates/verify/${templateCode}`);
            const verifyData = await verifyResponse.json();
            
            if (!verifyData.success) {
                throw new Error('Template tidak ditemukan');
            }
            
            // Simpan ke database tampilan
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/templates`, {
                method: 'POST',
                body: JSON.stringify({
                    template_code: templateCode,
                    template_name: templateName,
                    template_data: verifyData.template
                })
            });
            
            if (response.success) {
                showToast('✅ Template berhasil disimpan!', 'success');
                
                // Reset form
                elements.templateNameInput.value = '';
                elements.templateCodeInput.value = '';
                
                // Reload daftar template
                await loadSavedTemplates();
                
                // Inject font styles untuk preview
                if (verifyData.template.font_file_data) {
                    injectTemplateFont(verifyData.template.font_family, verifyData.template.font_file_data);
                }
                
                vibrate();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
            
        } catch (error) {
            console.error('❌ Error saving template:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function applyFontStyleToTarget() {
      if (!currentWebsite) {
        showToast('Website tidak ditemukan', 'error');
        return;
      }
    
      const selectedCode = elements.applyFontTemplateSelect?.value;
      const target = elements.applyFontTargetSelect?.value;
    
      if (!selectedCode) {
        showToast('Pilih template terlebih dahulu', 'warning');
        return;
      }
    
      // Cari template yang dipilih
      const selectedTemplate = savedTemplates.find(t => t.template_code === selectedCode);
      if (!selectedTemplate) {
        showToast('Template tidak ditemukan', 'error');
        return;
      }
    
      const templateData = selectedTemplate.template_data || {};
    
      showLoading(true);
    
      try {
        // Siapkan data update berdasarkan target
        let updateData = {
          target: target,
          template_code: selectedCode
        };
    
        // Data font dari template
        const fontData = {
          font_family: templateData.font_family,
          font_size: templateData.font_size,
          font_animation: templateData.animation_type,
          animation_duration: templateData.animation_duration,
          animation_delay: templateData.animation_delay,
          animation_iteration: templateData.animation_iteration
        };
    
        // Gabungkan data
        Object.assign(updateData, fontData);
    
        console.log(`📤 Applying font style to ${target}:`, updateData);
    
        // Simpan ke server melalui endpoint font-style
        const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font-style`, {
          method: 'POST',
          body: JSON.stringify(updateData)
        });
    
        if (response.success) {
          showToast(`✅ Font style diterapkan ke ${getTargetName(target)}`, 'success');
    
          // Update tampilanData lokal
          if (target === 'store_name') {
            tampilanData.store_font_family = templateData.font_family;
            tampilanData.store_font_size = templateData.font_size;
            tampilanData.store_font_animation = templateData.animation_type;
            tampilanData.store_animation_duration = templateData.animation_duration;
            tampilanData.store_animation_delay = templateData.animation_delay;
            tampilanData.store_animation_iteration = templateData.animation_iteration;
          } else if (target === 'headings') {
            tampilanData.heading_font_family = templateData.font_family;
            tampilanData.heading_font_size = templateData.font_size;
            tampilanData.heading_font_animation = templateData.animation_type;
            tampilanData.heading_animation_duration = templateData.animation_duration;
            tampilanData.heading_animation_delay = templateData.animation_delay;
            tampilanData.heading_animation_iteration = templateData.animation_iteration;
          } else if (target === 'body') {
            tampilanData.body_font_family = templateData.font_family;
            tampilanData.body_font_size = templateData.font_size;
            tampilanData.body_font_animation = templateData.animation_type;
            tampilanData.body_animation_duration = templateData.animation_duration;
            tampilanData.body_animation_delay = templateData.animation_delay;
            tampilanData.body_animation_iteration = templateData.animation_iteration;
          } else if (target === 'all_text') {
            tampilanData.font_family = templateData.font_family;
            tampilanData.font_size = templateData.font_size;
            tampilanData.font_animation = templateData.animation_type;
            tampilanData.animation_duration = templateData.animation_duration;
            tampilanData.animation_delay = templateData.animation_delay;
            tampilanData.animation_iteration = templateData.animation_iteration;
    
            tampilanData.store_font_family = templateData.font_family;
            tampilanData.store_font_size = templateData.font_size;
            tampilanData.store_font_animation = templateData.animation_type;
            tampilanData.store_animation_duration = templateData.animation_duration;
            tampilanData.store_animation_delay = templateData.animation_delay;
            tampilanData.store_animation_iteration = templateData.animation_iteration;
    
            tampilanData.heading_font_family = templateData.font_family;
            tampilanData.heading_font_size = templateData.font_size;
            tampilanData.heading_font_animation = templateData.animation_type;
            tampilanData.heading_animation_duration = templateData.animation_duration;
            tampilanData.heading_animation_delay = templateData.animation_delay;
            tampilanData.heading_animation_iteration = templateData.animation_iteration;
    
            tampilanData.body_font_family = templateData.font_family;
            tampilanData.body_font_size = templateData.font_size;
            tampilanData.body_font_animation = templateData.animation_type;
            tampilanData.body_animation_duration = templateData.animation_duration;
            tampilanData.body_animation_delay = templateData.animation_delay;
            tampilanData.body_animation_iteration = templateData.animation_iteration;
          }
    
          // Update preview jika sedang aktif
          if (elements.fontPreviewPanel.style.display === 'block') {
            updatePreviewWithTemplate(templateData, target);
          }
    
          vibrate();
        } else {
          throw new Error(response.error || 'Gagal menyimpan');
        }
    
      } catch (error) {
        console.error('❌ Error applying font style:', error);
        showToast(error.message, 'error');
      } finally {
        showLoading(false);
      }
    }
    
    function getTargetName(target) {
        const names = {
            'store_name': 'Nama Store',
            'all_text': 'Semua Text',
            'headings': 'Heading',
            'body': 'Body Text'
        };
        return names[target] || target;
    }
    
    function showFontPreview() {
        const selectedCode = elements.applyFontTemplateSelect?.value;
        const target = elements.applyFontTargetSelect?.value || 'store_name';
        
        if (!selectedCode) {
            showToast('Pilih template terlebih dahulu', 'warning');
            return;
        }
        
        // Cari template yang dipilih
        const selectedTemplate = savedTemplates.find(t => t.template_code === selectedCode);
        if (!selectedTemplate) {
            showToast('Template tidak ditemukan', 'error');
            return;
        }
        
        const templateData = selectedTemplate.template_data || {};
        const storeName = elements.storeDisplayNameInput?.value || 'Toko Online';
        
        // Inject font jika perlu
        if (templateData.font_file_data) {
            injectFontForPreview(templateData.font_family, templateData.font_file_data);
        }
        
        // Update preview panel
        if (elements.fontPreviewPanel) {
            updatePreviewWithTemplate(templateData, target, storeName);
            elements.fontPreviewPanel.style.display = 'block';
        }
        
        vibrate();
    }
    
    function updatePreviewWithTemplate(templateData, target, storeName) {
        const fontFamily = templateData.font_family || 'Inter';
        const fontSize = templateData.font_size || 16;
        const animationType = templateData.animation_type || 'none';
        const animDuration = templateData.animation_duration || 2;
        const animDelay = templateData.animation_delay || 0;
        const animIteration = templateData.animation_iteration || 'infinite';
        
        // Base style
        const baseStyle = `font-family: '${fontFamily}', sans-serif;`;
        const animStyle = animationType !== 'none' ? `animation: ${animationType}Anim ${animDuration}s ${animDelay}s ${animIteration};` : '';
        
        // Apply ke preview berdasarkan target
        if (target === 'store_name' || target === 'all_text') {
            if (elements.previewStoreName) {
                elements.previewStoreName.style.cssText = `${baseStyle} font-size: 24px; font-weight: 700; ${animStyle}`;
                elements.previewStoreName.textContent = storeName || 'Nama Store Example';
            }
            if (elements.previewHeading) {
                elements.previewHeading.style.cssText = `${baseStyle} font-size: 20px; font-weight: 600; ${animStyle}`;
            }
            if (elements.previewBody) {
                elements.previewBody.style.cssText = `${baseStyle} font-size: 14px; ${animStyle}`;
            }
        } else if (target === 'headings') {
            if (elements.previewHeading) {
                elements.previewHeading.style.cssText = `${baseStyle} font-size: 20px; font-weight: 600; ${animStyle}`;
            }
        } else if (target === 'body') {
            if (elements.previewBody) {
                elements.previewBody.style.cssText = `${baseStyle} font-size: 14px; ${animStyle}`;
            }
        }
        
        // Update selected template info
        selectedTemplateForApply = templateData;
        currentPreviewTarget = target;
    }
    
    function closePreviewPanel() {
        if (elements.fontPreviewPanel) {
            elements.fontPreviewPanel.style.display = 'none';
        }
    }
    
    function openFontPreviewModal() {
        const selectedCode = elements.applyFontTemplateSelect?.value;
        
        if (!selectedCode) {
            showToast('Pilih template terlebih dahulu', 'warning');
            return;
        }
        
        const selectedTemplate = savedTemplates.find(t => t.template_code === selectedCode);
        if (!selectedTemplate) {
            showToast('Template tidak ditemukan', 'error');
            return;
        }
        
        const templateData = selectedTemplate.template_data || {};
        const storeName = elements.storeDisplayNameInput?.value || 'Toko Online';
        
        // Inject font jika perlu
        if (templateData.font_file_data) {
            injectFontForPreview(templateData.font_family, templateData.font_file_data);
        }
        
        // Update modal preview
        const fontFamily = templateData.font_family || 'Inter';
        const fontSize = templateData.font_size || 24;
        const animationType = templateData.animation_type || 'none';
        const animDuration = templateData.animation_duration || 2;
        const animDelay = templateData.animation_delay || 0;
        const animIteration = templateData.animation_iteration || 'infinite';
        
        const baseStyle = `font-family: '${fontFamily}', sans-serif;`;
        const animStyle = animationType !== 'none' ? `animation: ${animationType}Anim ${animDuration}s ${animDelay}s ${animIteration};` : '';
        
        if (elements.modalPreviewStoreName) {
            elements.modalPreviewStoreName.style.cssText = `${baseStyle} font-size: 32px; font-weight: 700; ${animStyle}`;
            elements.modalPreviewStoreName.textContent = storeName;
        }
        if (elements.modalPreviewHeading) {
            elements.modalPreviewHeading.style.cssText = `${baseStyle} font-size: 24px; font-weight: 600; ${animStyle}`;
        }
        if (elements.modalPreviewBody) {
            elements.modalPreviewBody.style.cssText = `${baseStyle} font-size: 16px; ${animStyle}`;
        }
        if (elements.modalPreviewFontName) {
            elements.modalPreviewFontName.textContent = fontFamily;
        }
        if (elements.modalPreviewAnimName) {
            elements.modalPreviewAnimName.textContent = animationType === 'none' ? 'None' : animationType;
        }
        
        // Tampilkan modal
        if (elements.fontPreviewModal) {
            elements.fontPreviewModal.classList.add('active');
        }
        
        vibrate();
    }
    
    function closeFontPreviewModal() {
        if (elements.fontPreviewModal) {
            elements.fontPreviewModal.classList.remove('active');
        }
    }

    async function applyTemplate(templateCode) {
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/apply-template`, {
                method: 'POST',
                body: JSON.stringify({ template_code: templateCode })
            });
            
            if (response.success) {
                showToast('✅ Template diterapkan!', 'success');
                
                // Reload data tampilan untuk melihat perubahan
                await loadTampilanData();
                
                vibrate();
            } else {
                throw new Error(response.error || 'Gagal menerapkan');
            }
            
        } catch (error) {
            console.error('❌ Error applying template:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function deleteSavedTemplate(templateId) {
        if (!confirm('Hapus template ini?')) return;
        
        if (!currentWebsite) return;
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/templates/${templateId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                showToast('✅ Template dihapus!', 'success');
                await loadSavedTemplates();
                vibrate();
            } else {
                throw new Error(response.error || 'Gagal menghapus');
            }
            
        } catch (error) {
            console.error('❌ Error deleting template:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    function copyTemplateCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('✅ Kode template disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin', 'error');
        });
    }

    // ==================== FONT TEMPLATE FUNCTIONS LAMA ====================
    async function loadAllTemplates(filter = 'all', search = '') {
        if (!elements.allTemplatesGrid) return;
        
        elements.allTemplatesGrid.innerHTML = '<div class="template-loading"><i class="fas fa-spinner fa-spin"></i><span>Memuat template...</span></div>';
        
        try {
            let url = `${API_BASE_URL}/api/font-templates?limit=50`;
            
            if (search) {
                url = `${API_BASE_URL}/api/font-templates?search=${encodeURIComponent(search)}`;
            } else if (filter === 'popular') {
                url = `${API_BASE_URL}/api/font-templates?popular=true`;
            } else if (filter === 'public') {
                url = `${API_BASE_URL}/api/font-templates?is_public=true`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                allTemplates = data.templates;
                renderAllTemplates(allTemplates);
            } else {
                throw new Error(data.error || 'Gagal memuat template');
            }
            
        } catch (error) {
            console.error('❌ Error loading templates:', error);
            elements.allTemplatesGrid.innerHTML = `<div class="template-loading error">
                <i class="fas fa-exclamation-circle"></i>
                <span>Gagal memuat template: ${error.message}</span>
            </div>`;
        }
    }

    function renderAllTemplates(templates) {
        if (!elements.allTemplatesGrid) return;
        
        if (templates.length === 0) {
            elements.allTemplatesGrid.innerHTML = `<div class="template-loading">
                <i class="fas fa-folder-open"></i>
                <span>Belum ada template</span>
            </div>`;
            return;
        }
        
        let html = '';
        templates.forEach(template => {
            const date = new Date(template.created_at).toLocaleDateString('id-ID');
            const badgeClass = template.is_public ? 'public' : 'private';
            const badgeText = template.is_public ? 'Public' : 'Private';
            
            html += `
                <div class="template-card" data-code="${template.template_code}" data-name="${template.template_name}">
                    <div class="template-preview">
                        <span class="template-preview-text">Aa</span>
                    </div>
                    <div class="template-info">
                        <div class="template-name">
                            ${template.template_name}
                            <span class="template-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="template-meta">
                            <span><i class="fas fa-font"></i> ${template.font_preview || 'Inter'}</span>
                            <span><i class="fas fa-film"></i> ${template.anim_preview || 'None'}</span>
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                        </div>
                        <div class="template-code-small">
                            <code>${template.template_code.substring(0, 20)}...</code>
                        </div>
                        <div class="template-actions">
                            <button class="template-btn select" onclick="window.tampilan.selectTemplateFromList('${template.template_code}', '${template.template_name}')">
                                <i class="fas fa-check"></i> Pilih
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.allTemplatesGrid.innerHTML = html;
    }

    async function searchTemplates(query) {
        if (!elements.templateSearchResults) return;
        
        if (query.length < 2) {
            elements.templateSearchResults.style.display = 'none';
            elements.templateSearchResults.innerHTML = '';
            if (elements.clearSearchBtn) {
                elements.clearSearchBtn.style.display = 'none';
            }
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/font-templates?search=${encodeURIComponent(query)}&limit=10`);
            const data = await response.json();
            
            if (data.success && data.templates.length > 0) {
                let resultsHtml = '<div class="search-results-header">Hasil pencarian:</div>';
                
                data.templates.forEach(template => {
                    resultsHtml += `
                        <div class="search-result-item" data-code="${template.template_code}" data-name="${template.template_name}">
                            <div class="result-info">
                                <strong>${template.template_name}</strong>
                                <small>${template.template_code.substring(0, 15)}...</small>
                            </div>
                            <div class="result-preview">
                                <span>Font: ${template.font_preview || 'Inter'}</span>
                                <span>Anim: ${template.anim_preview || 'None'}</span>
                            </div>
                        </div>
                    `;
                });
                
                elements.templateSearchResults.innerHTML = resultsHtml;
                elements.templateSearchResults.style.display = 'block';
                
                // Add click handlers
                document.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const code = item.dataset.code;
                        const name = item.dataset.name;
                        selectTemplateFromSearch(code, name);
                    });
                });
                
                if (elements.clearSearchBtn) {
                    elements.clearSearchBtn.style.display = 'flex';
                }
            } else {
                elements.templateSearchResults.innerHTML = '<div class="no-results">Tidak ada template ditemukan</div>';
                elements.templateSearchResults.style.display = 'block';
            }
            
        } catch (error) {
            console.error('❌ Error searching templates:', error);
            elements.templateSearchResults.innerHTML = '<div class="no-results error">Gagal mencari template</div>';
            elements.templateSearchResults.style.display = 'block';
        }
    }

    function selectTemplateFromSearch(code, name) {
        if (elements.fontTemplateCode) {
            elements.fontTemplateCode.value = code;
        }
        if (elements.templateSearchInput) {
            elements.templateSearchInput.value = name;
        }
        
        // Hide search results
        if (elements.templateSearchResults) {
            elements.templateSearchResults.style.display = 'none';
            elements.templateSearchResults.innerHTML = '';
        }
        if (elements.clearSearchBtn) {
            elements.clearSearchBtn.style.display = 'none';
        }
        
        // Auto verify
        verifyTemplateCode(code);
    }

    function selectTemplateFromList(code, name) {
        if (elements.fontTemplateCode) {
            elements.fontTemplateCode.value = code;
        }
        
        closeAllTemplatesModal();
        verifyTemplateCode(code);
        showToast(`Template "${name}" dipilih`, 'success');
    }

    async function verifyTemplateCode(code, silent = false) {
        if (!code || code.length !== 35) {
            if (!silent) {
                showValidationMessage('Kode template harus 35 karakter', 'error');
            }
            disableTemplateActions(true);
            return false;
        }
        
        if (!silent) {
            showValidationMessage('Memverifikasi template...', 'info');
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/font-templates/verify/${code}`);
            const data = await response.json();
            
            if (data.success) {
                currentTemplateData = data.template;
                currentTemplateCode = code;
                
                showValidationMessage(`✅ Template "${data.template.template_name}" ditemukan`, 'success');
                showTemplatePreview(data.template);
                enableTemplateActions();
                
                // Show selected template info
                if (elements.selectedTemplateInfo && elements.selectedTemplateName) {
                    elements.selectedTemplateName.textContent = data.template.template_name;
                    elements.selectedTemplateInfo.style.display = 'block';
                }
                
                return true;
            } else {
                showValidationMessage('❌ Template tidak ditemukan', 'error');
                disableTemplateActions(true);
                hideTemplatePreview();
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error verifying template:', error);
            showValidationMessage('Gagal memverifikasi template', 'error');
            disableTemplateActions(true);
            hideTemplatePreview();
            return false;
        }
    }

    function showTemplatePreview(template) {
        if (!elements.templatePreviewCard) return;
        
        const fontData = template.font_data || {};
        const animData = template.animation_data || {};
        
        // Update preview text
        if (elements.templatePreviewText) {
            elements.templatePreviewText.textContent = template.preview_data?.text || 'Toko Online';
            elements.templatePreviewText.style.fontFamily = fontData.family || 'Inter';
            elements.templatePreviewText.style.fontSize = `${fontData.size || 16}px`;
            elements.templatePreviewText.style.fontWeight = fontData.weight || 400;
            elements.templatePreviewText.style.color = fontData.color || '#ffffff';
        }
        
        // Update info
        if (elements.previewFontName) {
            elements.previewFontName.textContent = (fontData.family || 'Inter').split(',')[0];
        }
        if (elements.previewAnimName) {
            elements.previewAnimName.textContent = animData.name || 'None';
        }
        
        elements.templatePreviewCard.style.display = 'block';
    }

    function hideTemplatePreview() {
        if (elements.templatePreviewCard) {
            elements.templatePreviewCard.style.display = 'none';
        }
    }

    function showValidationMessage(message, type) {
        if (elements.templateValidationMessage) {
            elements.templateValidationMessage.innerHTML = message;
            elements.templateValidationMessage.className = `validation-message ${type}`;
        }
    }

    function disableTemplateActions(disabled = true) {
        if (elements.applyTemplateBtn) {
            elements.applyTemplateBtn.disabled = disabled;
        }
        if (elements.testTemplateBtn) {
            elements.testTemplateBtn.disabled = disabled;
        }
    }

    function enableTemplateActions() {
        disableTemplateActions(false);
    }

    function clearTemplateSelection() {
        currentTemplateCode = null;
        currentTemplateData = null;
        
        if (elements.fontTemplateCode) {
            elements.fontTemplateCode.value = '';
        }
        if (elements.templateSearchInput) {
            elements.templateSearchInput.value = '';
        }
        if (elements.templateSearchResults) {
            elements.templateSearchResults.style.display = 'none';
            elements.templateSearchResults.innerHTML = '';
        }
        if (elements.clearSearchBtn) {
            elements.clearSearchBtn.style.display = 'none';
        }
        if (elements.selectedTemplateInfo) {
            elements.selectedTemplateInfo.style.display = 'none';
        }
        
        hideTemplatePreview();
        showValidationMessage('', 'info');
        disableTemplateActions(true);
    }

    function openAllTemplatesModal() {
        if (elements.allTemplatesModal) {
            elements.allTemplatesModal.classList.add('active');
            loadAllTemplates();
        }
    }

    function closeAllTemplatesModal() {
        if (elements.allTemplatesModal) {
            elements.allTemplatesModal.classList.remove('active');
        }
    }

    async function applyTemplateOld() {
        if (!currentTemplateData || !currentWebsite) return;
        
        showToast(`Template "${currentTemplateData.template_name}" akan diterapkan setelah disimpan`, 'info');
    }

    function testTemplatePreview() {
        if (!currentTemplateData) return;
        
        // Refresh preview
        showTemplatePreview(currentTemplateData);
        showToast('Preview diperbarui', 'success');
        vibrate();
    }

    async function saveTemplateCode() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const templateCode = elements.fontTemplateCode?.value.trim();
        
        if (!templateCode) {
            showToast('Masukkan kode template', 'warning');
            return;
        }
        
        if (templateCode.length !== 35) {
            showToast('Kode template harus 35 karakter', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            // First verify the template exists
            const verified = await verifyTemplateCode(templateCode, true);
            if (!verified) {
                throw new Error('Template tidak valid');
            }
            
            // Save to server
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font-template`, {
                method: 'POST',
                body: JSON.stringify({
                    template_code: templateCode,
                    store_display_name: storeDisplayName
                })
            });
            
            if (response.success) {
                showToast('✅ Kode template disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
            
        } catch (error) {
            console.error('❌ Error saving template code:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== SAVE FUNCTIONS ====================
    async function saveLogo() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const logoUrl = elements.logoUrl?.value || elements.logoImage?.src || '';
        const storeName = elements.storeDisplayNameInput?.value || 'Toko Online';
        
        if (logoUrl && !logoUrl.toLowerCase().endsWith('.png') && !logoUrl.startsWith('data:image/png')) {
            showToast('Logo harus berformat PNG', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            // Save logo
            const logoResponse = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/logo`, {
                method: 'POST',
                body: JSON.stringify({ url: logoUrl })
            });
            
            // Save store name
            const storeResponse = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font-anim`, {
                method: 'POST',
                body: JSON.stringify({
                    store_display_name: storeName
                })
            });
            
            if (logoResponse.success && storeResponse.success) {
                showToast('✅ Logo & Nama Store disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error('Gagal menyimpan');
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

    async function saveAll() {
        await Promise.all([
            saveLogo(),
            saveBanners(),
            saveAllPromos(),
            saveColors(),
            saveTemplateCode()
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
                goBackToPanel();
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
        
        // Template Input Tabs
        elements.templateInputTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const type = tab.dataset.inputType;
                
                elements.templateInputTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                elements.templateInputPanels.forEach(panel => {
                    panel.classList.remove('active');
                });
                
                document.getElementById(`inputBy${type === 'code' ? 'Code' : 'Search'}Panel`).classList.add('active');
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
        
        // Apply font to store button
        if (elements.applyFontToStoreBtn) {
            elements.applyFontToStoreBtn.addEventListener('click', () => {
                // Set target ke store_name dan buka preview
                if (elements.applyFontTargetSelect) {
                    elements.applyFontTargetSelect.value = 'store_name';
                }
                showFontPreview();
            });
        }
        
        // Store display name input
        if (elements.storeDisplayNameInput) {
            elements.storeDisplayNameInput.addEventListener('input', (e) => {
                storeDisplayName = e.target.value || 'Toko Online';
                // Update preview if active
                if (elements.fontPreviewPanel.style.display === 'block' && selectedTemplateForApply) {
                    updatePreviewWithTemplate(selectedTemplateForApply, currentPreviewTarget, storeDisplayName);
                }
            });
        }
        
        // Font Style Application
        if (elements.applyFontStyleBtn) {
            elements.applyFontStyleBtn.addEventListener('click', applyFontStyleToTarget);
        }
        
        if (elements.previewFontStyleBtn) {
            elements.previewFontStyleBtn.addEventListener('click', openFontPreviewModal);
        }
        
        if (elements.closePreviewBtn) {
            elements.closePreviewBtn.addEventListener('click', closePreviewPanel);
        }
        
        if (elements.closeFontPreviewModal) {
            elements.closeFontPreviewModal.addEventListener('click', closeFontPreviewModal);
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
        
        // Font Template Events - Baru
        if (elements.saveTemplateToWebsiteBtn) {
            elements.saveTemplateToWebsiteBtn.addEventListener('click', saveTemplateToWebsite);
        }
        
        // Font Template Events - Lama
        if (elements.viewAllTemplatesBtn) {
            elements.viewAllTemplatesBtn.addEventListener('click', openAllTemplatesModal);
        }
        
        if (elements.closeAllTemplatesModal) {
            elements.closeAllTemplatesModal.addEventListener('click', closeAllTemplatesModal);
        }
        
        if (elements.verifyTemplateCode) {
            elements.verifyTemplateCode.addEventListener('click', () => {
                const code = elements.fontTemplateCode?.value.trim();
                if (code) {
                    verifyTemplateCode(code);
                } else {
                    showToast('Masukkan kode template', 'warning');
                }
            });
        }
        
        if (elements.fontTemplateCode) {
            elements.fontTemplateCode.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const code = e.target.value.trim();
                    if (code) {
                        verifyTemplateCode(code);
                    }
                }
            });
        }
        
        if (elements.templateSearchInput) {
            const debouncedSearch = debounce((e) => {
                searchTemplates(e.target.value);
            }, 500);
            
            elements.templateSearchInput.addEventListener('input', debouncedSearch);
            
            elements.templateSearchInput.addEventListener('focus', () => {
                if (elements.templateSearchInput.value.length >= 2) {
                    searchTemplates(elements.templateSearchInput.value);
                }
            });
        }
        
        if (elements.clearSearchBtn) {
            elements.clearSearchBtn.addEventListener('click', () => {
                if (elements.templateSearchInput) {
                    elements.templateSearchInput.value = '';
                }
                if (elements.templateSearchResults) {
                    elements.templateSearchResults.style.display = 'none';
                    elements.templateSearchResults.innerHTML = '';
                }
                elements.clearSearchBtn.style.display = 'none';
            });
        }
        
        if (elements.applyTemplateBtn) {
            elements.applyTemplateBtn.addEventListener('click', applyTemplateOld);
        }
        
        if (elements.testTemplateBtn) {
            elements.testTemplateBtn.addEventListener('click', testTemplatePreview);
        }
        
        if (elements.saveTemplateCodeBtn) {
            elements.saveTemplateCodeBtn.addEventListener('click', saveTemplateCode);
        }
        
        if (elements.clearTemplatePreview) {
            elements.clearTemplatePreview.addEventListener('click', clearTemplateSelection);
        }
        
        if (elements.changeTemplateBtn) {
            elements.changeTemplateBtn.addEventListener('click', clearTemplateSelection);
        }
        
        // Modal template search and filter
        if (elements.modalTemplateSearch) {
            const debouncedModalSearch = debounce((e) => {
                loadAllTemplates('all', e.target.value);
            }, 500);
            
            elements.modalTemplateSearch.addEventListener('input', debouncedModalSearch);
        }
        
        if (elements.modalTemplateFilter) {
            elements.modalTemplateFilter.addEventListener('change', (e) => {
                loadAllTemplates(e.target.value, elements.modalTemplateSearch?.value || '');
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
            if (e.target === elements.allTemplatesModal) {
                closeAllTemplatesModal();
            }
            if (e.target === elements.fontPreviewModal) {
                closeFontPreviewModal();
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
        deletePromo: (id) => deletePromo(id),
        
        // Template functions - Baru
        saveTemplateToWebsite: saveTemplateToWebsite,
        applyTemplate: applyTemplate,
        deleteSavedTemplate: deleteSavedTemplate,
        copyTemplateCode: copyTemplateCode,
        
        // Template functions - Lama
        selectTemplateFromList: (code, name) => selectTemplateFromList(code, name)
    };

    // ==================== START ====================
    setupKeyboardHandler();
    setupEventListeners();
    init();
})();
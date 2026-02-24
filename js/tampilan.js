// tampilan.js - Pengaturan Tampilan Website
(function() {
    'use strict';
    
    console.log('🎨 Tampilan Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let tampilanData = {};
    
    // Banner state
    let banners = [];
    let hasUnsavedBanners = false;
    let urlChangeTimeout = null;
    
    // Current upload callback
    let currentUploadCallback = null;
    let currentUploadType = null; // 'logo', 'promo'

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
        promoBannerImage: document.getElementById('promoBannerImage'),
        promoBannerUrl: document.getElementById('promoBannerUrl'),
        uploadPromoBtn: document.getElementById('uploadPromoBtn'),
        promoDescription: document.getElementById('promoDescription'),
        promoEndDate: document.getElementById('promoEndDate'),
        promoEndTime: document.getElementById('promoEndTime'),
        promoNeverEnd: document.getElementById('promoNeverEnd'),
        promoNotes: document.getElementById('promoNotes'),
        promoActive: document.getElementById('promoActive'),
        savePromoBtn: document.getElementById('savePromoBtn'),
        
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
        
        // Save All
        saveAllBtn: document.getElementById('saveAllBtn'),
        
        // Upload Modal
        uploadModal: document.getElementById('uploadModal'),
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        uploadPreview: document.getElementById('uploadPreview'),
        changeImageBtn: document.getElementById('changeImageBtn'),
        confirmUploadBtn: document.getElementById('confirmUploadBtn'),
        closeUploadModal: document.getElementById('closeUploadModal')
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
                window.location.href = '/wtb/panel.html';
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
            }
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
            showToast('Gagal memuat data tampilan', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== UPDATE UI ====================
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
        
        // Update promo
        if (tampilanData.promo) {
            const promo = tampilanData.promo;
            
            if (promo.banner) {
                if (elements.promoBannerImage) elements.promoBannerImage.src = promo.banner;
                if (elements.promoBannerUrl) elements.promoBannerUrl.value = promo.banner;
            }
            
            if (elements.promoDescription) elements.promoDescription.value = promo.description || '';
            
            if (promo.end_date) {
                if (elements.promoEndDate) elements.promoEndDate.value = promo.end_date.split('T')[0] || '';
                if (promo.end_time && elements.promoEndTime) elements.promoEndTime.value = promo.end_time;
            }
            
            if (elements.promoNeverEnd) elements.promoNeverEnd.checked = promo.never_end || false;
            if (elements.promoNotes) elements.promoNotes.value = promo.notes || '';
            if (elements.promoActive) elements.promoActive.checked = promo.active !== false;
        }
        
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

    async function savePromo() {
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
        const promoData = {
            banner: elements.promoBannerUrl?.value || elements.promoBannerImage?.src || '',
            description: elements.promoDescription?.value || '',
            end_date: elements.promoNeverEnd?.checked ? null : (elements.promoEndDate?.value || ''),
            end_time: elements.promoNeverEnd?.checked ? null : (elements.promoEndTime?.value || ''),
            never_end: elements.promoNeverEnd?.checked || false,
            notes: elements.promoNotes?.value || '',
            active: elements.promoActive?.checked || false
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/promo`, {
                method: 'POST',
                body: JSON.stringify(promoData)
            });
            
            if (response.success) {
                showToast('✅ Pengaturan promosi disimpan!', 'success');
                await loadTampilanData();
            } else {
                throw new Error(response.error || 'Gagal menyimpan promosi');
            }
        } catch (error) {
            console.error('❌ Error saving promo:', error);
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
        if (!currentWebsite) {
            showToast('Website tidak ditemukan', 'error');
            return;
        }
        
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
            console.error('❌ Error saving font:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async function saveAll() {
        await Promise.all([
            saveLogo(),
            saveBanners(),
            savePromo(),
            saveColors(),
            saveFont()
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
        // Back button
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/wtb/panel.html';
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
        
        // Promo upload
        if (elements.uploadPromoBtn) {
            elements.uploadPromoBtn.addEventListener('click', () => {
                openUploadModal((imageUrl) => {
                    if (elements.promoBannerImage) {
                        elements.promoBannerImage.src = imageUrl;
                    }
                    if (elements.promoBannerUrl) {
                        elements.promoBannerUrl.value = imageUrl;
                    }
                    showToast('✅ Banner promosi diperbarui!', 'success');
                }, 'promo');
            });
        }
        
        // Promo never end toggle
        if (elements.promoNeverEnd) {
            elements.promoNeverEnd.addEventListener('change', () => {
                if (elements.promoEndDate && elements.promoEndTime) {
                    elements.promoEndDate.disabled = elements.promoNeverEnd.checked;
                    elements.promoEndTime.disabled = elements.promoNeverEnd.checked;
                }
            });
        }
        
        if (elements.savePromoBtn) {
            elements.savePromoBtn.addEventListener('click', savePromo);
        }
        
        // Colors
        if (elements.saveColorsBtn) {
            elements.saveColorsBtn.addEventListener('click', saveColors);
        }
        
        // Font
        if (elements.saveFontBtn) {
            elements.saveFontBtn.addEventListener('click', saveFont);
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
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.tampilan = {
        handleUrlChange: (index, url) => handleUrlChange(index, url),
        deleteBanner: (index) => deleteBanner(index),
        moveBanner: (index, direction) => moveBanner(index, direction)
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();

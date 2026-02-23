// Panel JavaScript for Website Management - GitHub Pages Version
(function() {
    console.log('🛠️ Website Panel - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    console.log('🔗 API URL:', API_BASE_URL);

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        errorMessage: document.getElementById('errorMessage'),
        panelContent: document.getElementById('panelContent'),
        noWebsiteMessage: document.getElementById('noWebsiteMessage'),
        websiteBadge: document.getElementById('websiteBadge'),
        websiteAvatar: document.getElementById('websiteAvatar'),
        websiteName: document.getElementById('websiteName'),
        websiteEndpointBadge: document.getElementById('websiteEndpointBadge'),
        websiteOwner: document.getElementById('websiteOwner'),
        websiteCreated: document.getElementById('websiteCreated'),
        websiteStatus: document.getElementById('websiteStatus'),
        
        // Tab elements
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Logo elements
        logoImage: document.getElementById('logoImage'),
        logoUrl: document.getElementById('logoUrl'),
        uploadLogoBtn: document.getElementById('uploadLogoBtn'),
        saveLogoBtn: document.getElementById('saveLogoBtn'),
        
        // Banner elements
        bannerList: document.getElementById('bannerList'),
        addBannerBtn: document.getElementById('addBannerBtn'),
        saveBannersBtn: document.getElementById('saveBannersBtn'),
        
        // Color elements
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
        
        // Font elements
        fontFamily: document.getElementById('fontFamily'),
        fontSize: document.getElementById('fontSize'),
        saveFontBtn: document.getElementById('saveFontBtn'),
        
        // Product elements
        totalProducts: document.getElementById('totalProducts'),
        availableProducts: document.getElementById('availableProducts'),
        lowStockProducts: document.getElementById('lowStockProducts'),
        soldProducts: document.getElementById('soldProducts'),
        productsGrid: document.getElementById('productsGrid'),
        noProductsMessage: document.getElementById('noProductsMessage'),
        addProductBtn: document.getElementById('addProductBtn'),
        
        // Payment elements
        bankEnabled: document.getElementById('bankEnabled'),
        ewalletEnabled: document.getElementById('ewalletEnabled'),
        qrisEnabled: document.getElementById('qrisEnabled'),
        cryptoEnabled: document.getElementById('cryptoEnabled'),
        bankDetails: document.getElementById('bankDetails'),
        ewalletDetails: document.getElementById('ewalletDetails'),
        qrisDetails: document.getElementById('qrisDetails'),
        cryptoDetails: document.getElementById('cryptoDetails'),
        qrisPreview: document.getElementById('qrisPreview'),
        uploadQrisBtn: document.getElementById('uploadQrisBtn'),
        paymentNotes: document.getElementById('paymentNotes'),
        confirmationNotes: document.getElementById('confirmationNotes'),
        savePaymentsBtn: document.getElementById('savePaymentsBtn'),
        savePaymentNotesBtn: document.getElementById('savePaymentNotesBtn'),
        
        // Settings elements
        websiteTitle: document.getElementById('websiteTitle'),
        websiteDescription: document.getElementById('websiteDescription'),
        contactWhatsApp: document.getElementById('contactWhatsApp'),
        contactTelegram: document.getElementById('contactTelegram'),
        metaTitle: document.getElementById('metaTitle'),
        metaDescription: document.getElementById('metaDescription'),
        metaKeywords: document.getElementById('metaKeywords'),
        maintenanceMode: document.getElementById('maintenanceMode'),
        maintenanceMessage: document.getElementById('maintenanceMessage'),
        maintenanceMessageGroup: document.getElementById('maintenanceMessageGroup'),
        saveGeneralBtn: document.getElementById('saveGeneralBtn'),
        saveSeoBtn: document.getElementById('saveSeoBtn'),
        
        // Action buttons
        previewWebsiteBtn: document.getElementById('previewWebsiteBtn'),
        copyEndpointBtn: document.getElementById('copyEndpointBtn'),
        
        // Modals
        productModal: document.getElementById('productModal'),
        deleteProductModal: document.getElementById('deleteProductModal'),
        uploadModal: document.getElementById('uploadModal'),
        modalTitle: document.getElementById('modalTitle'),
        productForm: document.getElementById('productForm'),
        closeProductModal: document.getElementById('closeProductModal'),
        cancelProductBtn: document.getElementById('cancelProductBtn'),
        saveProductBtn: document.getElementById('saveProductBtn'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        deleteProductInfo: document.getElementById('deleteProductInfo'),
        closeUploadModal: document.getElementById('closeUploadModal'),
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        uploadPreview: document.getElementById('uploadPreview'),
        changeImageBtn: document.getElementById('changeImageBtn'),
        confirmUploadBtn: document.getElementById('confirmUploadBtn'),
        
        // Product form fields
        productName: document.getElementById('productName'),
        productDescription: document.getElementById('productDescription'),
        productPrice: document.getElementById('productPrice'),
        productStock: document.getElementById('productStock'),
        productCategory: document.getElementById('productCategory'),
        productImage: document.getElementById('productImage'),
        productNotes: document.getElementById('productNotes'),
        productActive: document.getElementById('productActive'),
        
        // Bank form fields
        bankName: document.getElementById('bankName'),
        bankAccount: document.getElementById('bankAccount'),
        bankHolder: document.getElementById('bankHolder'),
        ewalletProvider: document.getElementById('ewalletProvider'),
        ewalletNumber: document.getElementById('ewalletNumber'),
        qrisUrl: document.getElementById('qrisUrl'),
        cryptoAddress: document.getElementById('cryptoAddress')
    };

    // ==================== STATE ====================
    let currentUser = null;
    let currentWebsite = null;
    let products = [];
    let currentProductId = null;
    let currentUploadCallback = null;
    let banners = []; // Array untuk menyimpan multiple banner {url, position, positionY}
    let logoUrl = '';

    // ==================== FUNGSI VIBRATE ====================
    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    // ==================== FUNGSI TOAST ====================
    function showToast(message, type = 'info', duration = 3000) {
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideUp 0.3s ease;
            pointer-events: auto;
            text-align: center;
        `;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                toast.remove();
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, duration);
    }

    // ==================== FUNGSI APPLY TELEGRAM THEME ====================
    function applyTelegramTheme(tg) {
        if (!tg || !tg.themeParams) return;
        
        try {
            const theme = tg.themeParams;
            console.log('🎨 Applying Telegram theme');
            
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
            }
            if (theme.hint_color) {
                document.documentElement.style.setProperty('--tg-hint-color', theme.hint_color);
            }
            if (theme.link_color) {
                document.documentElement.style.setProperty('--tg-link-color', theme.link_color);
            }
            if (theme.button_color) {
                document.documentElement.style.setProperty('--tg-button-color', theme.button_color);
            }
            if (theme.button_text_color) {
                document.documentElement.style.setProperty('--tg-button-text-color', theme.button_text_color);
            }
        } catch (themeError) {
            console.warn('⚠️ Error applying Telegram theme:', themeError);
        }
    }

    // ==================== FUNGSI FETCH WEBSITE DATA ====================
    async function fetchWebsiteData(userId) {
        try {
            console.log('📡 Fetching website data for user:', userId);
            
            const url = `${API_BASE_URL}/api/websites/user/${userId}`;
            console.log('🔗 Fetch URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Website data:', data);

            if (data.success && data.websites && data.websites.length > 0) {
                return data.websites[0];
            } else {
                return null;
            }

        } catch (error) {
            console.error('❌ Error fetching website:', error);
            return null;
        }
    }

    // ==================== FUNGSI FETCH PRODUCTS ====================
    async function fetchProducts(websiteId) {
        try {
            console.log('📡 Fetching products for website:', websiteId);
            
            const url = `${API_BASE_URL}/api/websites/${websiteId}/products`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.products) {
                return data.products;
            } else {
                return [];
            }

        } catch (error) {
            console.error('❌ Error fetching products:', error);
            return [];
        }
    }

    // ==================== FUNGSI LOAD TAMPILAN ====================
    async function loadTampilan(websiteId) {
        try {
            console.log('📡 Loading tampilan for website:', websiteId);
        
            const response = await fetch(`${API_BASE_URL}/api/tampilan/${websiteId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
        
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // No tampilan yet
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        
            const result = await response.json();
        
            if (result.success && result.tampilan) {
                return result.tampilan;
            } else {
                return null;
            }
        
        } catch (error) {
            console.error('❌ Error loading tampilan:', error);
            return null;
        }
    }

    // ==================== FUNGSI UPDATE WEBSITE UI ====================
    async function updateWebsiteUI(website) {
        currentWebsite = website;
      
        if (elements.websiteBadge) {
            elements.websiteBadge.textContent = `/${website.endpoint}`;
        }
      
        if (elements.websiteName) {
            elements.websiteName.textContent = website.username || 'Website';
        }
      
        if (elements.websiteEndpointBadge) {
            elements.websiteEndpointBadge.textContent = `/${website.endpoint}`;
        }
      
        if (elements.websiteOwner) {
            elements.websiteOwner.innerHTML = `<i class="fas fa-user"></i> Owner ID: ${website.owner_id}`;
        }
      
        if (elements.websiteCreated && website.created_at) {
            const date = new Date(website.created_at);
            elements.websiteCreated.innerHTML = `<i class="fas fa-calendar"></i> Created: ${date.toLocaleDateString('id-ID')}`;
        }
      
        if (elements.websiteAvatar) {
            elements.websiteAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(website.username || 'Website')}&size=120&background=40a7e3&color=fff`;
        }
      
        if (elements.websiteStatus) {
            if (website.status === 'active') {
                elements.websiteStatus.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>';
            } else {
                elements.websiteStatus.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i>';
            }
        }
      
        // Load tampilan data
        const tampilan = await loadTampilan(website.id);
        if (tampilan) {
            website.settings = {
                ...website.settings,
                ...tampilan
            };
        }
      
        if (website.settings) {
            updateSettingsUI(website.settings);
        }
    }

    // ==================== FUNGSI UPDATE SETTINGS UI ====================
    function updateSettingsUI(settings) {
        if (!settings) return;
        
        // Update logo
        if (settings.logo && elements.logoImage) {
            elements.logoImage.src = settings.logo;
        }
        if (settings.logo && elements.logoUrl) {
            elements.logoUrl.value = settings.logo;
        }
        
        // Update banners
        if (settings.banners && Array.isArray(settings.banners)) {
            banners = settings.banners.map(b => {
                if (typeof b === 'string') {
                    return { url: b, position: 50, positionY: 50 };
                } else {
                    return {
                        url: b.url || '',
                        position: b.position || 50,
                        positionY: b.positionY || 50
                    };
                }
            });
        } else {
            banners = [];
        }
        renderBannerList();
        
        // Update colors
        if (settings.colors) {
            const colors = settings.colors;
            
            if (elements.primaryColor) elements.primaryColor.value = colors.primary || '#40a7e3';
            if (elements.primaryColorHex) elements.primaryColorHex.value = colors.primary || '#40a7e3';
            if (elements.secondaryColor) elements.secondaryColor.value = colors.secondary || '#FFD700';
            if (elements.secondaryColorHex) elements.secondaryColorHex.value = colors.secondary || '#FFD700';
            if (elements.bgColor) elements.bgColor.value = colors.background || '#0f0f0f';
            if (elements.bgColorHex) elements.bgColorHex.value = colors.background || '#0f0f0f';
            if (elements.textColor) elements.textColor.value = colors.text || '#ffffff';
            if (elements.textColorHex) elements.textColorHex.value = colors.text || '#ffffff';
            if (elements.cardColor) elements.cardColor.value = colors.card || '#1a1a1a';
            if (elements.cardColorHex) elements.cardColorHex.value = colors.card || '#1a1a1a';
            if (elements.accentColor) elements.accentColor.value = colors.accent || '#10b981';
            if (elements.accentColorHex) elements.accentColorHex.value = colors.accent || '#10b981';
        }
        
        // Update font
        if (settings.font) {
            if (elements.fontFamily) elements.fontFamily.value = settings.font.family || 'Inter';
            if (elements.fontSize) elements.fontSize.value = settings.font.size || 14;
        } else if (settings.font_family || settings.font_size) {
            if (elements.fontFamily) elements.fontFamily.value = settings.font_family || 'Inter';
            if (elements.fontSize) elements.fontSize.value = settings.font_size || 14;
        }
        
        // Update general settings
        if (elements.websiteTitle) elements.websiteTitle.value = settings.title || '';
        if (elements.websiteDescription) elements.websiteDescription.value = settings.description || '';
        if (elements.contactWhatsApp) elements.contactWhatsApp.value = settings.contact_whatsapp || settings.contact?.whatsapp || '';
        if (elements.contactTelegram) elements.contactTelegram.value = settings.contact_telegram || settings.contact?.telegram || '';
        
        // Update SEO
        if (settings.seo) {
            if (elements.metaTitle) elements.metaTitle.value = settings.seo.title || '';
            if (elements.metaDescription) elements.metaDescription.value = settings.seo.description || '';
            if (elements.metaKeywords) elements.metaKeywords.value = settings.seo.keywords || '';
        }
        
        // Update payments
        if (settings.payments) {
            const pm = settings.payments;
            
            if (elements.bankEnabled) elements.bankEnabled.checked = pm.bank?.enabled || false;
            if (pm.bank) {
                if (elements.bankName) elements.bankName.value = pm.bank.name || 'BCA';
                if (elements.bankAccount) elements.bankAccount.value = pm.bank.account || '';
                if (elements.bankHolder) elements.bankHolder.value = pm.bank.holder || '';
            }
            
            if (elements.ewalletEnabled) elements.ewalletEnabled.checked = pm.ewallet?.enabled || false;
            if (pm.ewallet) {
                if (elements.ewalletProvider) elements.ewalletProvider.value = pm.ewallet.provider || 'DANA';
                if (elements.ewalletNumber) elements.ewalletNumber.value = pm.ewallet.number || '';
            }
            
            if (elements.qrisEnabled) elements.qrisEnabled.checked = pm.qris?.enabled || false;
            if (pm.qris?.url && elements.qrisPreview) {
                elements.qrisPreview.src = pm.qris.url;
            }
            if (pm.qris?.url && elements.qrisUrl) {
                elements.qrisUrl.value = pm.qris.url;
            }
            
            if (elements.cryptoEnabled) elements.cryptoEnabled.checked = pm.crypto?.enabled || false;
            if (pm.crypto?.address && elements.cryptoAddress) {
                elements.cryptoAddress.value = pm.crypto.address;
            }
            
            if (elements.paymentNotes) elements.paymentNotes.value = pm.notes?.payment || '';
            if (elements.confirmationNotes) elements.confirmationNotes.value = pm.notes?.confirmation || '';
        }
        
        // Update maintenance
        if (settings.maintenance) {
            if (elements.maintenanceMode) elements.maintenanceMode.checked = settings.maintenance.enabled || false;
            if (elements.maintenanceMessage) elements.maintenanceMessage.value = settings.maintenance.message || '';
            if (elements.maintenanceMessageGroup) {
                elements.maintenanceMessageGroup.style.display = settings.maintenance.enabled ? 'block' : 'none';
            }
        }
    }

    // ==================== FUNGSI RENDER BANNER LIST ====================
    function renderBannerList() {
        if (!elements.bannerList) return;
        
        if (banners.length === 0) {
            elements.bannerList.innerHTML = `
                <div class="empty-banner-message">
                    <i class="fas fa-images"></i>
                    <p>Belum ada banner. Klik "Tambah Banner" untuk menambahkan.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        banners.forEach((banner, index) => {
            html += `
                <div class="banner-item" data-index="${index}">
                    <div class="banner-item-header">
                        <span class="banner-number">Banner ${index + 1}</span>
                        <div class="banner-item-actions">
                            <button class="btn-icon-small move-up" ${index === 0 ? 'disabled' : ''} onclick="window.panel.moveBanner(${index}, 'up')">
                                <i class="fas fa-arrow-up"></i>
                            </button>
                            <button class="btn-icon-small move-down" ${index === banners.length - 1 ? 'disabled' : ''} onclick="window.panel.moveBanner(${index}, 'down')">
                                <i class="fas fa-arrow-down"></i>
                            </button>
                            <button class="btn-icon-small delete" onclick="window.panel.deleteBanner(${index})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="banner-item-content">
                        <div class="banner-preview-small">
                            <img src="${banner.url || 'https://via.placeholder.com/150x80/40a7e3/ffffff?text=Banner'}" alt="Banner ${index + 1}" style="object-position: ${banner.position || 50}% ${banner.positionY || 50}%;">
                        </div>
                        <div class="banner-item-form">
                            <div class="form-group">
                                <label>URL Gambar</label>
                                <input type="url" class="banner-url-input" value="${escapeHtml(banner.url || '')}" placeholder="https://example.com/banner.jpg" data-index="${index}">
                            </div>
                            <div class="form-group">
                                <label>Posisi Horizontal (object-position X)</label>
                                <div class="position-slider-container">
                                    <input type="range" class="position-slider" min="0" max="100" value="${banner.position || 50}" data-index="${index}" data-axis="x">
                                    <span class="position-value">${banner.position || 50}%</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Posisi Vertikal (object-position Y)</label>
                                <div class="position-slider-container">
                                    <input type="range" class="position-slider" min="0" max="100" value="${banner.positionY || 50}" data-index="${index}" data-axis="y">
                                    <span class="position-value">${banner.positionY || 50}%</span>
                                </div>
                            </div>
                            <div class="position-presets">
                                <button class="preset-btn" onclick="window.panel.setBannerPosition(${index}, 'center')">Tengah</button>
                                <button class="preset-btn" onclick="window.panel.setBannerPosition(${index}, 'top')">Atas</button>
                                <button class="preset-btn" onclick="window.panel.setBannerPosition(${index}, 'bottom')">Bawah</button>
                                <button class="preset-btn" onclick="window.panel.setBannerPosition(${index}, 'left')">Kiri</button>
                                <button class="preset-btn" onclick="window.panel.setBannerPosition(${index}, 'right')">Kanan</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.bannerList.innerHTML = html;
        
        // Add event listeners to inputs
        document.querySelectorAll('.banner-url-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                banners[index].url = e.target.value;
                // Update preview
                const previewImg = e.target.closest('.banner-item').querySelector('.banner-preview-small img');
                if (previewImg) previewImg.src = e.target.value || 'https://via.placeholder.com/150x80/40a7e3/ffffff?text=Banner';
            });
        });
        
        document.querySelectorAll('.position-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const axis = e.target.dataset.axis;
                const value = parseInt(e.target.value);
                
                if (axis === 'x') {
                    banners[index].position = value;
                } else {
                    banners[index].positionY = value;
                }
                
                // Update display
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan) {
                    valueSpan.textContent = `${value}%`;
                }
                
                // Update preview position (visual feedback)
                const previewImg = e.target.closest('.banner-item').querySelector('.banner-preview-small img');
                if (previewImg) {
                    previewImg.style.objectPosition = `${banners[index].position || 50}% ${banners[index].positionY || 50}%`;
                }
            });
        });
    }

    // ==================== FUNGSI BANNER ====================
    function addBanner() {
        banners.push({
            url: '',
            position: 50,
            positionY: 50
        });
        renderBannerList();
        vibrate(10);
    }

    function deleteBanner(index) {
        if (confirm('Hapus banner ini?')) {
            banners.splice(index, 1);
            renderBannerList();
            vibrate(10);
        }
    }

    function moveBanner(index, direction) {
        if (direction === 'up' && index > 0) {
            [banners[index - 1], banners[index]] = [banners[index], banners[index - 1]];
        } else if (direction === 'down' && index < banners.length - 1) {
            [banners[index], banners[index + 1]] = [banners[index + 1], banners[index]];
        } else {
            return;
        }
        renderBannerList();
        vibrate(10);
    }

    function setBannerPosition(index, preset) {
        let posX = 50, posY = 50;
        
        switch(preset) {
            case 'center':
                posX = 50; posY = 50;
                break;
            case 'top':
                posX = 50; posY = 0;
                break;
            case 'bottom':
                posX = 50; posY = 100;
                break;
            case 'left':
                posX = 0; posY = 50;
                break;
            case 'right':
                posX = 100; posY = 50;
                break;
        }
        
        banners[index].position = posX;
        banners[index].positionY = posY;
        renderBannerList();
        vibrate(10);
    }

    // ==================== FUNGSI SAVE BANNERS ====================
    async function saveBanners() {
        if (!currentWebsite) {
            showToast('Website not loaded', 'error');
            return;
        }
        
        // Filter out empty banners
        const validBanners = banners.filter(b => b.url && b.url.trim() !== '');
        
        if (validBanners.length === 0) {
            showToast('Tambahkan minimal 1 banner dengan URL', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/banners`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({
                    banners: validBanners,
                    positions: validBanners.map(b => ({ x: b.position || 50, y: b.positionY || 50 }))
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast(`✅ ${validBanners.length} banner saved!`, 'success');
                // Refresh data
                const updatedWebsite = await fetchWebsiteData(currentUser.id);
                if (updatedWebsite) {
                    updateWebsiteUI(updatedWebsite);
                }
            } else {
                throw new Error(result.error || 'Failed to save banners');
            }
        } catch (error) {
            console.error('❌ Error saving banners:', error);
            showToast(error.message || 'Failed to save banners', 'error');
        }
    }

    // ==================== FUNGSI SAVE LOGO ====================
    async function saveLogo() {
        if (!currentWebsite) {
            showToast('Website not loaded', 'error');
            return;
        }
        
        const logoUrl = elements.logoUrl?.value || elements.logoImage?.src || '';
        
        // Validasi PNG (cek dari URL atau data URL)
        if (logoUrl && !logoUrl.toLowerCase().endsWith('.png') && !logoUrl.startsWith('data:image/png')) {
            showToast('Logo harus berformat PNG', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/tampilan/${currentWebsite.id}/logo`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({ url: logoUrl })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('✅ Logo saved!', 'success');
                // Refresh data
                const updatedWebsite = await fetchWebsiteData(currentUser.id);
                if (updatedWebsite) {
                    updateWebsiteUI(updatedWebsite);
                }
            } else {
                throw new Error(result.error || 'Failed to save logo');
            }
        } catch (error) {
            console.error('❌ Error saving logo:', error);
            showToast(error.message || 'Failed to save logo', 'error');
        }
    }

    // ==================== FUNGSI UPDATE PRODUCTS UI ====================
    function updateProductsUI(productsData) {
        products = productsData;
        
        const total = products.length;
        const available = products.filter(p => p.active && p.stock > 0).length;
        const lowStock = products.filter(p => p.active && p.stock > 0 && p.stock <= 5).length;
        const sold = products.reduce((sum, p) => sum + (p.sold || 0), 0);
        
        if (elements.totalProducts) elements.totalProducts.textContent = total;
        if (elements.availableProducts) elements.availableProducts.textContent = available;
        if (elements.lowStockProducts) elements.lowStockProducts.textContent = lowStock;
        if (elements.soldProducts) elements.soldProducts.textContent = sold;
        
        renderProductsGrid(products);
    }

    // ==================== FUNGSI RENDER PRODUCTS GRID ====================
    function renderProductsGrid(products) {
        if (!elements.productsGrid) return;
        
        if (products.length === 0) {
            elements.productsGrid.innerHTML = '';
            if (elements.noProductsMessage) {
                elements.noProductsMessage.style.display = 'flex';
            }
            return;
        }
        
        if (elements.noProductsMessage) {
            elements.noProductsMessage.style.display = 'none';
        }
        
        let html = '';
        products.forEach(product => {
            const statusClass = product.active ? 'active' : 'inactive';
            const stockClass = product.stock <= 5 ? 'low-stock' : '';
            const stockText = product.stock <= 0 ? 'Habis' : `${product.stock} tersisa`;
            
            html += `
                <div class="product-card ${statusClass}" data-id="${product.id}">
                    <div class="product-image">
                        <img src="${product.image || 'https://via.placeholder.com/300x200/40a7e3/ffffff?text=No+Image'}" alt="${escapeHtml(product.name)}">
                        <div class="product-status ${statusClass}">
                            ${product.active ? 'Aktif' : 'Nonaktif'}
                        </div>
                    </div>
                    <div class="product-details">
                        <h4>${escapeHtml(product.name)}</h4>
                        <p class="product-description">${escapeHtml(product.description ? product.description.substring(0, 60) : '')}${product.description && product.description.length > 60 ? '...' : ''}</p>
                        <div class="product-meta">
                            <span class="product-price">Rp ${formatNumber(product.price)}</span>
                            <span class="product-stock ${stockClass}">
                                <i class="fas fa-cubes"></i> ${stockText}
                            </span>
                        </div>
                        ${product.notes ? `<div class="product-notes">📝 ${escapeHtml(product.notes)}</div>` : ''}
                        <div class="product-footer">
                            <span class="product-sold">Terjual: ${product.sold || 0}</span>
                            <div class="product-actions">
                                <button class="product-btn edit" onclick="window.panel.editProduct(${product.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="product-btn delete" onclick="window.panel.deleteProduct(${product.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.productsGrid.innerHTML = html;
    }

    // ==================== FUNGSI FORMAT NUMBER ====================
    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // ==================== FUNGSI ESCAPE HTML ====================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== FUNGSI COPY ENDPOINT ====================
    function copyEndpoint() {
        if (!currentWebsite) return;
        
        const endpoint = `/${currentWebsite.endpoint}`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(endpoint).then(() => {
                showToast('✅ Endpoint copied!', 'success');
            }).catch(() => {
                fallbackCopy(endpoint);
            });
        } else {
            fallbackCopy(endpoint);
        }
    }
    
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showToast('✅ Endpoint copied!', 'success');
        } catch (err) {
            showToast('❌ Failed to copy', 'error');
        }
        
        document.body.removeChild(textarea);
    }

    // ==================== FUNGSI PREVIEW WEBSITE ====================
    function previewWebsite() {
        if (!currentWebsite) return;
        
        const url = `https://aldiprem.github.io/wtb/website?store=${currentWebsite.endpoint}`;
        window.open(url, '_blank');
    }

    // ==================== FUNGSI SAVE SETTINGS ====================
    async function saveSettings(section, data) {
        console.log(`💾 Saving ${section} settings:`, data);
      
        if (!currentWebsite) {
            showToast('Website not loaded', 'error');
            return;
        }
      
        try {
            let url = '';
            let body = data;
      
            switch (section) {
                case 'banner':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/banner`;
                    break;
                case 'colors':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/colors`;
                    break;
                case 'font':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/font`;
                    break;
                case 'general':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/general`;
                    break;
                case 'seo':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/seo`;
                    break;
                case 'payments':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/payments`;
                    break;
                case 'payment-notes':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/payment-notes`;
                    break;
                case 'maintenance':
                    url = `${API_BASE_URL}/api/tampilan/${currentWebsite.id}/maintenance`;
                    body = {
                        enabled: data.enabled,
                        message: data.message
                    };
                    break;
                default:
                    showToast('Unknown section', 'error');
                    return;
            }
      
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify(body)
            });
      
            const result = await response.json();
      
            if (result.success) {
                showToast(`✅ ${section} settings saved!`, 'success');
                // Refresh website data to get updated settings
                const updatedWebsite = await fetchWebsiteData(currentUser.id);
                if (updatedWebsite) {
                    updateWebsiteUI(updatedWebsite);
                }
            } else {
                throw new Error(result.error || 'Failed to save settings');
            }
      
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            showToast(error.message || 'Failed to save settings', 'error');
        }
    }

    // ==================== FUNGSI PRODUCT MODAL ====================
    function openProductModal(product = null) {
        currentProductId = product ? product.id : null;
        
        elements.productForm.reset();
        
        if (product) {
            elements.modalTitle.textContent = 'Edit Produk';
            elements.productName.value = product.name || '';
            elements.productDescription.value = product.description || '';
            elements.productPrice.value = product.price || '';
            elements.productStock.value = product.stock || '';
            elements.productCategory.value = product.category || 'voucher';
            elements.productImage.value = product.image || '';
            elements.productNotes.value = product.notes || '';
            if (elements.productActive) elements.productActive.checked = product.active !== false;
        } else {
            elements.modalTitle.textContent = 'Tambah Produk';
            if (elements.productActive) elements.productActive.checked = true;
        }
        
        elements.productModal.classList.add('active');
        vibrate(10);
    }
    
    function closeProductModal() {
        elements.productModal.classList.remove('active');
        currentProductId = null;
    }
    
    function saveProduct(formData) {
        console.log('💾 Saving product:', formData);
        
        if (!currentWebsite) {
            showToast('Website not loaded', 'error');
            closeProductModal();
            return;
        }
        
        // Here you would normally send to API
        showToast('✅ Product saved!', 'success');
        closeProductModal();
    }
    
    function openDeleteModal(product) {
        if (!product) return;
        
        currentProductId = product.id;
        elements.deleteProductInfo.innerHTML = `
            <strong>${escapeHtml(product.name)}</strong><br>
            <small>ID: ${product.id}</small>
        `;
        
        elements.deleteProductModal.classList.add('active');
        vibrate(10);
    }
    
    function closeDeleteModal() {
        elements.deleteProductModal.classList.remove('active');
        currentProductId = null;
    }
    
    function confirmDelete() {
        if (!currentProductId || !currentWebsite) return;
        
        console.log('🗑️ Deleting product:', currentProductId);
        
        // Here you would normally send to API
        showToast('✅ Product deleted!', 'success');
        closeDeleteModal();
    }
    
    function openUploadModal(callback, acceptType = 'image/*') {
        currentUploadCallback = callback;
        
        if (elements.uploadPreview) {
            elements.uploadPreview.style.display = 'none';
        }
        if (elements.uploadArea) {
            elements.uploadArea.style.display = 'flex';
        }
        if (elements.fileInput) {
            elements.fileInput.value = '';
            elements.fileInput.accept = acceptType;
        }
        if (elements.confirmUploadBtn) {
            elements.confirmUploadBtn.disabled = true;
        }
        
        elements.uploadModal.classList.add('active');
    }
    
    function closeUploadModal() {
        elements.uploadModal.classList.remove('active');
        currentUploadCallback = null;
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

    // ==================== FUNGSI UPDATE UI ====================
    async function updateUI(user) {
        currentUser = user;
        
        if (elements.loading) elements.loading.style.display = 'none';
        
        const website = await fetchWebsiteData(user.id);
        
        if (website) {
            if (elements.error) elements.error.style.display = 'none';
            if (elements.noWebsiteMessage) elements.noWebsiteMessage.style.display = 'none';
            if (elements.panelContent) elements.panelContent.style.display = 'block';
            
            updateWebsiteUI(website);
            
            const productsData = await fetchProducts(website.id);
            updateProductsUI(productsData);
        } else {
            if (elements.error) elements.error.style.display = 'none';
            if (elements.panelContent) elements.panelContent.style.display = 'none';
            if (elements.noWebsiteMessage) elements.noWebsiteMessage.style.display = 'flex';
        }
    }

    // ==================== FUNGSI SHOW ERROR ====================
    function showError(message) {
        vibrate(30);
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.error) {
            elements.error.style.display = 'flex';
            if (elements.errorMessage) {
                elements.errorMessage.textContent = message;
            }
        }
        if (elements.panelContent) {
            elements.panelContent.style.display = 'none';
        }
        if (elements.noWebsiteMessage) {
            elements.noWebsiteMessage.style.display = 'none';
        }
    }

    // ==================== FUNGSI INIT ====================
    async function init() {
        console.log('🛠️ Initializing Panel...');

        try {
            let telegramUserData = null;
            let tg = null;

            if (window.Telegram?.WebApp) {
                console.log('📱 Running inside Telegram Web App');
                tg = window.Telegram.WebApp;
                
                tg.expand();
                tg.ready();
                
                if (tg.initDataUnsafe?.user) {
                    telegramUserData = tg.initDataUnsafe.user;
                    console.log('📱 Telegram user data:', telegramUserData);
                }
                
                applyTelegramTheme(tg);
            } else {
                console.log('🌐 Running in standalone web browser');
                
                telegramUserData = {
                    id: 7998861975,
                    first_name: 'Test',
                    last_name: 'User',
                    username: 'test_user'
                };
            }

            if (!telegramUserData) {
                showError('No user data available');
                return;
            }

            await updateUI(telegramUserData);

        } catch (error) {
            console.error('💥 Fatal error in init:', error);
            showError('Failed to initialize panel');
        }
    }

    // ==================== SETUP EVENT LISTENERS ====================
    function setupEventListeners() {
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
        
        // Logo events
        if (elements.uploadLogoBtn) {
            elements.uploadLogoBtn.addEventListener('click', () => {
                openUploadModal((imageUrl) => {
                    // Validasi PNG
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
                    showToast('✅ Logo updated! (PNG)', 'success');
                }, 'image/png'); // Hanya terima PNG
            });
        }
        
        if (elements.saveLogoBtn) {
            elements.saveLogoBtn.addEventListener('click', saveLogo);
        }
        
        // Banner events
        if (elements.addBannerBtn) {
            elements.addBannerBtn.addEventListener('click', addBanner);
        }
        
        if (elements.saveBannersBtn) {
            elements.saveBannersBtn.addEventListener('click', saveBanners);
        }
        
        if (elements.saveColorsBtn) {
            elements.saveColorsBtn.addEventListener('click', () => {
                const colors = {
                    primary: elements.primaryColorHex?.value || '#40a7e3',
                    secondary: elements.secondaryColorHex?.value || '#FFD700',
                    background: elements.bgColorHex?.value || '#0f0f0f',
                    text: elements.textColorHex?.value || '#ffffff',
                    card: elements.cardColorHex?.value || '#1a1a1a',
                    accent: elements.accentColorHex?.value || '#10b981'
                };
                saveSettings('colors', colors);
            });
        }
        
        if (elements.saveFontBtn) {
            elements.saveFontBtn.addEventListener('click', () => {
                const font = {
                    family: elements.fontFamily?.value || 'Inter',
                    size: parseInt(elements.fontSize?.value) || 14
                };
                saveSettings('font', font);
            });
        }
        
        if (elements.saveGeneralBtn) {
            elements.saveGeneralBtn.addEventListener('click', () => {
                const general = {
                    title: elements.websiteTitle?.value || '',
                    description: elements.websiteDescription?.value || '',
                    contact: {
                        whatsapp: elements.contactWhatsApp?.value || '',
                        telegram: elements.contactTelegram?.value || ''
                    }
                };
                saveSettings('general', general);
            });
        }
        
        if (elements.saveSeoBtn) {
            elements.saveSeoBtn.addEventListener('click', () => {
                const seo = {
                    title: elements.metaTitle?.value || '',
                    description: elements.metaDescription?.value || '',
                    keywords: elements.metaKeywords?.value || ''
                };
                saveSettings('seo', seo);
            });
        }
        
        if (elements.savePaymentsBtn) {
            elements.savePaymentsBtn.addEventListener('click', () => {
                const payments = {
                    bank: {
                        enabled: elements.bankEnabled?.checked || false,
                        name: elements.bankName?.value || 'BCA',
                        account: elements.bankAccount?.value || '',
                        holder: elements.bankHolder?.value || ''
                    },
                    ewallet: {
                        enabled: elements.ewalletEnabled?.checked || false,
                        provider: elements.ewalletProvider?.value || 'DANA',
                        number: elements.ewalletNumber?.value || ''
                    },
                    qris: {
                        enabled: elements.qrisEnabled?.checked || false,
                        url: elements.qrisPreview?.src || elements.qrisUrl?.value || ''
                    },
                    crypto: {
                        enabled: elements.cryptoEnabled?.checked || false,
                        address: elements.cryptoAddress?.value || ''
                    }
                };
                saveSettings('payments', payments);
            });
        }
        
        if (elements.savePaymentNotesBtn) {
            elements.savePaymentNotesBtn.addEventListener('click', () => {
                const notes = {
                    payment: elements.paymentNotes?.value || '',
                    confirmation: elements.confirmationNotes?.value || ''
                };
                saveSettings('payment-notes', notes);
            });
        }
        
        if (elements.bankEnabled) {
            elements.bankEnabled.addEventListener('change', () => {
                if (elements.bankDetails) {
                    elements.bankDetails.style.opacity = elements.bankEnabled.checked ? '1' : '0.5';
                }
            });
        }
        
        if (elements.ewalletEnabled) {
            elements.ewalletEnabled.addEventListener('change', () => {
                if (elements.ewalletDetails) {
                    elements.ewalletDetails.style.opacity = elements.ewalletEnabled.checked ? '1' : '0.5';
                }
            });
        }
        
        if (elements.qrisEnabled) {
            elements.qrisEnabled.addEventListener('change', () => {
                if (elements.qrisDetails) {
                    elements.qrisDetails.style.opacity = elements.qrisEnabled.checked ? '1' : '0.5';
                }
            });
        }
        
        if (elements.cryptoEnabled) {
            elements.cryptoEnabled.addEventListener('change', () => {
                if (elements.cryptoDetails) {
                    elements.cryptoDetails.style.display = elements.cryptoEnabled.checked ? 'block' : 'none';
                }
            });
        }
        
        if (elements.uploadQrisBtn) {
            elements.uploadQrisBtn.addEventListener('click', () => {
                openUploadModal((imageUrl) => {
                    if (elements.qrisPreview) {
                        elements.qrisPreview.src = imageUrl;
                    }
                    if (elements.qrisUrl) {
                        elements.qrisUrl.value = imageUrl;
                    }
                    showToast('✅ QRIS updated!', 'success');
                });
            });
        }
        
        if (elements.maintenanceMode) {
            elements.maintenanceMode.addEventListener('change', () => {
                if (elements.maintenanceMessageGroup) {
                    elements.maintenanceMessageGroup.style.display = elements.maintenanceMode.checked ? 'block' : 'none';
                }
            });
        }
        
        if (elements.previewWebsiteBtn) {
            elements.previewWebsiteBtn.addEventListener('click', previewWebsite);
        }
        
        if (elements.copyEndpointBtn) {
            elements.copyEndpointBtn.addEventListener('click', copyEndpoint);
        }
        
        if (elements.addProductBtn) {
            elements.addProductBtn.addEventListener('click', () => {
                openProductModal();
            });
        }
        
        if (elements.closeProductModal) {
            elements.closeProductModal.addEventListener('click', closeProductModal);
        }
        
        if (elements.cancelProductBtn) {
            elements.cancelProductBtn.addEventListener('click', closeProductModal);
        }
        
        if (elements.productForm) {
            elements.productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = {
                    id: currentProductId,
                    name: elements.productName.value,
                    description: elements.productDescription.value,
                    price: parseInt(elements.productPrice.value) || 0,
                    stock: parseInt(elements.productStock.value) || 0,
                    category: elements.productCategory.value,
                    image: elements.productImage.value,
                    notes: elements.productNotes.value,
                    active: elements.productActive.checked
                };
                
                saveProduct(formData);
            });
        }
        
        if (elements.closeDeleteModal) {
            elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }
        
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
        
        if (elements.closeUploadModal) {
            elements.closeUploadModal.addEventListener('click', closeUploadModal);
        }
        
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
        
        window.addEventListener('click', (e) => {
            if (e.target === elements.productModal) {
                closeProductModal();
            }
            if (e.target === elements.deleteProductModal) {
                closeDeleteModal();
            }
            if (e.target === elements.uploadModal) {
                closeUploadModal();
            }
        });
    }

    // ==================== EXPOSE FUNCTIONS FOR GLOBAL ACCESS ====================
    window.panel = {
        editProduct: (id) => {
            const product = products.find(p => p.id === id);
            if (product) {
                openProductModal(product);
            }
        },
        deleteProduct: (id) => {
            const product = products.find(p => p.id === id);
            if (product) {
                openDeleteModal(product);
            }
        },
        moveBanner: (index, direction) => moveBanner(index, direction),
        deleteBanner: (index) => deleteBanner(index),
        setBannerPosition: (index, preset) => setBannerPosition(index, preset)
    };

    // ==================== START ====================
    setupEventListeners();
    init();
})();

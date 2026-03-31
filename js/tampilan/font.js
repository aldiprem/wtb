// Font Studio - Versi Final untuk Flask/Database
(function() {
    'use strict';
    
    console.log('🎨 Font Studio - Initializing...');
    
    // ==================== KONFIGURASI ====================
    // Deteksi environment
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    // Tentukan API Base URL
    let API_BASE_URL;
    
    if (isGitHubPages) {
        // Di GitHub Pages, gunakan URL tunnel
        API_BASE_URL = 'https://companel.shop';
    } else if (isLocalhost) {
        // Di localhost, gunakan port 5050
        API_BASE_URL = 'https://localhost:5050';
    } else {
        // Di server dengan domain, gunakan origin
        API_BASE_URL = window.location.origin;
    }
    
    console.log('🌍 Environment:', isGitHubPages ? 'GitHub Pages' : (isLocalhost ? 'Localhost' : 'Server'));
    console.log('🔗 API Base URL:', API_BASE_URL);
    
    // ANIMASI PRESETS (tetap sama)
    const ANIMATIONS = {
        none: { name: 'Tidak Ada' },
        fade: { name: 'Fade', keyframes: '@keyframes fadeAnim { 0%{opacity:0.5} 50%{opacity:1} 100%{opacity:0.5} }' },
        bounce: { name: 'Bounce', keyframes: '@keyframes bounceAnim { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }' },
        pulse: { name: 'Pulse', keyframes: '@keyframes pulseAnim { 0%{transform:scale(1)} 50%{transform:scale(1.1)} 100%{transform:scale(1)} }' },
        shake: { name: 'Shake', keyframes: '@keyframes shakeAnim { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }' },
        float: { name: 'Float', keyframes: '@keyframes floatAnim { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-15px)} }' },
        rotate: { name: 'Rotate', keyframes: '@keyframes rotateAnim { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }' },
        wave: { name: 'Wave', keyframes: '@keyframes waveAnim { 0%{transform:skew(0deg)} 25%{transform:skew(5deg)} 75%{transform:skew(-5deg)} 100%{transform:skew(0deg)} }' }
    };
    
    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        backToPanel: document.getElementById('backToPanel'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        
        fontUploadArea: document.getElementById('fontUploadArea'),
        fontFileInput: document.getElementById('fontFileInput'),
        uploadedFileInfo: document.getElementById('uploadedFileInfo'),
        uploadedFileName: document.getElementById('uploadedFileName'),
        removeFontBtn: document.getElementById('removeFontBtn'),
        fontFamily: document.getElementById('fontFamily'),
        loadFontBtn: document.getElementById('loadFontBtn'),
        fontWeight: document.getElementById('fontWeight'),
        fontStyle: document.getElementById('fontStyle'),
        fontSize: document.getElementById('fontSize'),
        textColor: document.getElementById('textColor'),
        textColorHex: document.getElementById('textColorHex'),
        
        animationType: document.getElementById('animationType'),
        animDuration: document.getElementById('animDuration'),
        animDurationValue: document.getElementById('animDurationValue'),
        animDelay: document.getElementById('animDelay'),
        animDelayValue: document.getElementById('animDelayValue'),
        animIteration: document.getElementById('animIteration'),
        
        templateName: document.getElementById('templateName'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        savedCodeDisplay: document.getElementById('savedCodeDisplay'),
        generatedCode: document.getElementById('generatedCode'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        
        previewText: document.getElementById('previewText'),
        previewTextDisplay: document.getElementById('previewTextDisplay'),
        previewCanvas: document.getElementById('previewCanvas'),
        
        playAnimation: document.getElementById('playAnimation'),
        pauseAnimation: document.getElementById('pauseAnimation'),
        restartAnimation: document.getElementById('restartAnimation'),
        fullscreenPreview: document.getElementById('fullscreenPreview'),
        
        viewAllTemplatesBtn: document.getElementById('viewAllTemplatesBtn'),
        allTemplatesModal: document.getElementById('allTemplatesModal'),
        closeAllTemplatesModal: document.getElementById('closeAllTemplatesModal'),
        modalTemplateSearch: document.getElementById('modalTemplateSearch'),
        modalTemplateFilter: document.getElementById('modalTemplateFilter'),
        allTemplatesGrid: document.getElementById('allTemplatesGrid'),
        
        toastContainer: document.getElementById('toastContainer'),
        sectionHeaders: document.querySelectorAll('.section-header')
    };
    
    // ==================== STATE ====================
    let currentFontFamily = 'Inter, sans-serif';
    let currentFontFile = null;
    let currentFontDataUrl = null;
    let animationStyleElement = null;
    let isAnimating = false;
    let savedTemplates = [];
    let injectedFonts = new Set(); // Untuk melacak font yang sudah di-inject
    
    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => { 
            toast.style.animation = 'fadeOut 0.3s ease'; 
            setTimeout(() => toast.remove(), 300); 
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
    
    function generateTemplateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 35; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
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
        
        // Hapus style lama jika ada
        const oldStyle = document.getElementById(`preview-font-${fontFamily}`);
        if (oldStyle) oldStyle.remove();
        
        const style = document.createElement('style');
        style.id = `preview-font-${fontFamily}`;
        style.textContent = fontFace;
        document.head.appendChild(style);
        
        injectedFonts.add(fontFamily);
        console.log(`✅ Font injected for preview: ${fontFamily}`);
    }
    
    // ==================== ANIMATION FUNCTIONS ====================
    function injectAnimationStyles() {
        if (animationStyleElement) animationStyleElement.remove();
        animationStyleElement = document.createElement('style');
        let css = '';
        Object.values(ANIMATIONS).forEach(anim => { 
            if (anim.keyframes) css += anim.keyframes + '\n'; 
        });
        animationStyleElement.textContent = css;
        document.head.appendChild(animationStyleElement);
    }
    
    // ==================== FONT FUNCTIONS ====================
    function setupFontUpload() {
        if (!elements.fontUploadArea || !elements.fontFileInput) return;
        
        elements.fontUploadArea.addEventListener('click', () => elements.fontFileInput.click());
        
        elements.fontUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.fontUploadArea.style.borderColor = '#40a7e3';
            elements.fontUploadArea.style.background = 'rgba(64,167,227,0.1)';
        });
        
        elements.fontUploadArea.addEventListener('dragleave', () => {
            elements.fontUploadArea.style.borderColor = 'rgba(255,255,255,0.1)';
            elements.fontUploadArea.style.background = 'rgba(255,255,255,0.02)';
        });
        
        elements.fontUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.fontUploadArea.style.borderColor = 'rgba(255,255,255,0.1)';
            elements.fontUploadArea.style.background = 'rgba(255,255,255,0.02)';
            if (e.dataTransfer.files.length > 0) handleFontFile(e.dataTransfer.files[0]);
        });
        
        elements.fontFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFontFile(e.target.files[0]);
        });
        
        if (elements.removeFontBtn) {
            elements.removeFontBtn.addEventListener('click', removeFontFile);
        }
    }
    
    function handleFontFile(file) {
        if (!file.name.toLowerCase().endsWith('.ttf')) {
            showToast('Hanya file .ttf yang diperbolehkan', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Ukuran file maksimal 5MB', 'error');
            return;
        }
        
        showLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            currentFontFile = file;
            currentFontDataUrl = e.target.result;
            
            if (elements.uploadedFileName) elements.uploadedFileName.textContent = file.name;
            if (elements.uploadedFileInfo) elements.uploadedFileInfo.style.display = 'flex';
            if (elements.fontUploadArea) elements.fontUploadArea.style.display = 'none';
            
            const fontName = file.name.replace(/\.ttf$/i, '');
            if (elements.fontFamily) elements.fontFamily.value = fontName;
            
            showLoading(false);
            showToast(`File ${file.name} siap dimuat`, 'success');
        };
        reader.onerror = () => { 
            showLoading(false); 
            showToast('Gagal membaca file', 'error'); 
        };
        reader.readAsDataURL(file);
    }
    
    function removeFontFile() {
        currentFontFile = null;
        currentFontDataUrl = null;
        
        if (elements.uploadedFileInfo) elements.uploadedFileInfo.style.display = 'none';
        if (elements.fontUploadArea) elements.fontUploadArea.style.display = 'block';
        if (elements.fontFileInput) elements.fontFileInput.value = '';
        
        const fontFamily = elements.fontFamily?.value.trim() || 'MyCustomFont';
        const oldStyle = document.getElementById(`font-${fontFamily}`);
        if (oldStyle) oldStyle.remove();
        
        currentFontFamily = 'Inter, sans-serif';
        updatePreview();
        showToast('Font dihapus', 'info');
    }
    
    async function loadFont() {
        const family = elements.fontFamily?.value.trim();
        if (!family) {
            showToast('Nama font family wajib diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            const oldStyle = document.getElementById(`font-${family}`);
            if (oldStyle) oldStyle.remove();
            
            let fontFace = '';
            
            if (currentFontDataUrl) {
                fontFace = `@font-face { 
                    font-family: '${family}'; 
                    src: url('${currentFontDataUrl}') format('truetype'); 
                    font-weight: normal; 
                    font-style: normal; 
                    font-display: swap; 
                }`;
            } else {
                showToast('Upload file font terlebih dahulu', 'warning');
                showLoading(false);
                return;
            }
            
            const style = document.createElement('style');
            style.id = `font-${family}`;
            style.textContent = fontFace;
            document.head.appendChild(style);
            
            currentFontFamily = `'${family}', sans-serif`;
            updatePreview();
            
            showToast(`Font ${family} berhasil dimuat!`, 'success');
            vibrate();
        } catch (error) {
            console.error('Error loading font:', error);
            showToast('Gagal memuat font', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== UPDATE PREVIEW ====================
    function updatePreview() {
        const text = elements.previewText?.value || 'Toko Online';
        const weight = elements.fontWeight?.value || 400;
        const style = elements.fontStyle?.value || 'normal';
        const size = elements.fontSize?.value || 48;
        const color = elements.textColor?.value || '#ffffff';
        const animType = elements.animationType?.value || 'none';
        const duration = elements.animDuration?.value || 2;
        const delay = elements.animDelay?.value || 0;
        const iteration = elements.animIteration?.value || 'infinite';
        
        if (elements.animDurationValue) {
            elements.animDurationValue.textContent = `${duration}s`;
        }
        if (elements.animDelayValue) {
            elements.animDelayValue.textContent = `${delay}s`;
        }
        
        if (elements.previewTextDisplay) {
            elements.previewTextDisplay.textContent = text;
            elements.previewTextDisplay.style.fontFamily = currentFontFamily;
            elements.previewTextDisplay.style.fontWeight = weight;
            elements.previewTextDisplay.style.fontStyle = style;
            elements.previewTextDisplay.style.fontSize = `${size}px`;
            elements.previewTextDisplay.style.color = color;
            
            if (animType !== 'none' && ANIMATIONS[animType]) {
                elements.previewTextDisplay.style.animation = `${animType}Anim ${duration}s ${delay}s ${iteration}`;
            } else {
                elements.previewTextDisplay.style.animation = 'none';
            }
        }
    }
    
    async function saveTemplate() {
        const name = elements.templateName?.value.trim();
        if (!name) {
            showToast('Nama template wajib diisi', 'warning');
            return;
        }
        
        if (!currentFontDataUrl) {
            showToast('Upload dan load font terlebih dahulu', 'warning');
            return;
        }
        
        showLoading(true);
        
        try {
            // ==================== AMBIL WEBSITE ID DARI URL ====================
            const urlParams = new URLSearchParams(window.location.search);
            const websiteParam = urlParams.get('website');
            let websiteId = null;
            
            console.log('🌐 Website endpoint dari URL:', websiteParam);
            
            if (websiteParam) {
                try {
                    // Ambil website_id dari endpoint melalui API
                    const response = await fetch(`${API_BASE_URL}/api/websites/endpoint/${websiteParam}`);
                    const data = await response.json();
                    if (data.success && data.website) {
                        websiteId = data.website.id;
                        console.log('🌐 Website ID dari endpoint:', websiteId);
                    } else {
                        console.warn('⚠️ Gagal mendapatkan website_id untuk endpoint:', websiteParam);
                    }
                } catch (e) {
                    console.error('❌ Error fetching website_id:', e);
                }
            } else {
                console.log('⚠️ Tidak ada parameter website di URL');
            }
            
            // Siapkan data template dengan website_id (bukan user_id)
            const templateData = {
                template_name: name,
                font_family: elements.fontFamily?.value || 'MyCustomFont',
                font_file_data: currentFontDataUrl,
                font_file_name: currentFontFile?.name,
                font_weight: parseInt(elements.fontWeight?.value) || 400,
                font_style: elements.fontStyle?.value || 'normal',
                font_size: parseInt(elements.fontSize?.value) || 48,
                text_color: elements.textColor?.value || '#ffffff',
                animation_type: elements.animationType?.value || 'none',
                animation_duration: parseFloat(elements.animDuration?.value) || 2,
                animation_delay: parseFloat(elements.animDelay?.value) || 0,
                animation_iteration: elements.animIteration?.value || 'infinite',
                preview_text: elements.previewText?.value || 'Toko Online',
                is_public: false,
                website_id: websiteId  // ← KIRIM WEBSITE_ID, BUKAN USER_ID
            };
            
            console.log('📤 Saving template with website_id:', websiteId);
            console.log('📤 Template name:', name);
            console.log('📤 Font family:', templateData.font_family);
            console.log('📤 Font file:', templateData.font_file_name || 'none');
            
            const response = await fetch(`${API_BASE_URL}/api/font-templates/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData),
                mode: 'cors'
            });
            
            console.log('📥 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📥 Response data:', result);
            
            if (result.success) {
                if (elements.generatedCode) {
                    elements.generatedCode.textContent = result.template_code;
                }
                if (elements.savedCodeDisplay) {
                    elements.savedCodeDisplay.style.display = 'block';
                }
                showToast(`✅ Template "${name}" disimpan!`, 'success');
                vibrate();
                
                // Reset form setelah sukses
                elements.templateName.value = '';
            } else {
                throw new Error(result.error || 'Gagal menyimpan template');
            }
        } catch (error) {
            console.error('❌ Error saving template:', error);
            showToast(error.message || 'Gagal menyimpan template', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    function copyTemplateCode() {
        const code = elements.generatedCode?.textContent;
        if (!code) return;
        navigator.clipboard.writeText(code)
            .then(() => showToast('Kode template disalin!', 'success'))
            .catch(() => showToast('Gagal menyalin', 'error'));
    }
    
    // ==================== ANIMATION CONTROLS ====================
    function playPreviewAnimation() {
        if (isAnimating) return;
        const animType = elements.animationType?.value || 'none';
        if (animType === 'none') {
            showToast('Pilih animasi terlebih dahulu', 'info');
            return;
        }
        isAnimating = true;
        if (elements.previewTextDisplay) {
            elements.previewTextDisplay.style.animationPlayState = 'running';
        }
    }
    
    function pausePreviewAnimation() {
        isAnimating = false;
        if (elements.previewTextDisplay) {
            elements.previewTextDisplay.style.animationPlayState = 'paused';
        }
    }
    
    function restartPreviewAnimation() {
        if (elements.previewTextDisplay) {
            elements.previewTextDisplay.style.animation = 'none';
            elements.previewTextDisplay.offsetHeight; // Trigger reflow
            updatePreview();
            isAnimating = true;
        }
    }
    
    // ==================== LOAD ALL TEMPLATES ====================
    async function loadAllTemplates(search = '') {
        if (!elements.allTemplatesGrid) return;
        
        elements.allTemplatesGrid.innerHTML = '<div class="template-loading"><i class="fas fa-spinner fa-spin"></i><span>Memuat template...</span></div>';
        
        try {
            // ==================== AMBIL WEBSITE ID DARI URL ====================
            const urlParams = new URLSearchParams(window.location.search);
            const websiteParam = urlParams.get('website');
            let currentWebsiteId = null;
            
            console.log('🌐 Website endpoint dari URL:', websiteParam);
            
            if (websiteParam) {
                try {
                    // Ambil website_id dari endpoint melalui API
                    const websiteResponse = await fetch(`${API_BASE_URL}/api/websites/endpoint/${websiteParam}`);
                    const websiteData = await websiteResponse.json();
                    if (websiteData.success && websiteData.website) {
                        currentWebsiteId = websiteData.website.id;
                        console.log('🌐 Current Website ID:', currentWebsiteId);
                        // Simpan ke window global untuk digunakan di fungsi lain
                        window.currentWebsiteId = currentWebsiteId;
                        window.currentWebsiteEndpoint = websiteParam;
                    } else {
                        console.warn('⚠️ Gagal mendapatkan website_id untuk endpoint:', websiteParam);
                    }
                } catch (e) {
                    console.error('❌ Error fetching website_id:', e);
                }
            } else {
                console.log('⚠️ Tidak ada parameter website di URL');
            }
            
            // ==================== AMBIL SEMUA TEMPLATE ====================
            let url = `${API_BASE_URL}/api/font-templates?limit=50`;
            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
            }
            
            console.log('📡 Fetching templates from:', url);
            
            // Test koneksi ke API health check dulu
            const healthCheck = await fetch(`${API_BASE_URL}/api/health`).catch(err => {
                console.error('❌ Health check failed:', err);
                return null;
            });
            
            if (!healthCheck) {
                throw new Error('Tidak dapat terhubung ke server. Pastikan Flask berjalan di port 5050');
            }
            
            if (!healthCheck.ok) {
                console.warn('⚠️ Health check response:', healthCheck.status);
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            console.log('📥 Response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Endpoint tidak ditemukan: ${url}`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📥 Response data:', data);
            
            if (data.success) {
                savedTemplates = data.templates || [];
                console.log(`✅ Loaded ${savedTemplates.length} templates`);
                
                // Inject font untuk setiap template sebelum render
                for (const template of savedTemplates) {
                    if (template.font_file_data) {
                        injectFontForPreview(template.font_family, template.font_file_data);
                    }
                }
                
                // Render dengan website_id yang sudah didapat
                renderAllTemplatesByWebsite(savedTemplates, currentWebsiteId);
            } else {
                throw new Error(data.error || 'Gagal memuat template');
            }
        } catch (error) {
            console.error('❌ Error loading templates:', error);
            
            let errorMessage = error.message;
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Tidak dapat terhubung ke server. Pastikan Flask berjalan di http://localhost:5050';
            }
            
            elements.allTemplatesGrid.innerHTML = `<div class="template-loading error">
                <i class="fas fa-exclamation-circle"></i>
                <span>Gagal memuat template: ${errorMessage}</span>
                <button onclick="window.location.reload()" style="margin-top:10px; padding:8px 16px; background:#40a7e3; border:none; border-radius:8px; color:white; cursor:pointer;">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>`;
        }
    }

    function renderAllTemplatesByWebsite(templates, currentWebsiteId) {
        if (!elements.allTemplatesGrid) return;
        
        if (templates.length === 0) {
            elements.allTemplatesGrid.innerHTML = '<div class="template-loading"><i class="fas fa-folder-open"></i><span>Belum ada template</span></div>';
            return;
        }
        
        let html = '';
        templates.forEach(template => {
            const shortCode = template.template_code.substring(0, 10) + '...';
            const previewText = template.preview_text || template.template_name || 'Aa';
            const fontFamily = template.font_family || 'Inter';
            const animType = template.animation_type || 'pulse';
            
            // ==================== CEK KEPEMILIKAN BERDASARKAN WEBSITE_ID ====================
            const isOwner = (template.website_id === currentWebsiteId && currentWebsiteId !== null);
            
            // Badge untuk menunjukkan kepemilikan
            let ownerBadge = '';
            if (isOwner) {
                ownerBadge = '<span class="owner-badge"><i class="fas fa-store"></i> Milik Website Ini</span>';
            } else if (template.website_id) {
                ownerBadge = `<span class="other-badge"><i class="fas fa-globe"></i> Website ID: ${template.website_id}</span>`;
            }
            
            html += `
                <div class="template-card" data-code="${template.template_code}" data-font="${fontFamily}" data-website="${template.website_id || 0}">
                    <div class="template-preview" style="background: linear-gradient(135deg, #1a1a1a, #2a2a2a);">
                        <div class="template-preview-text" style="font-family: '${fontFamily}', sans-serif; animation: ${animType}Anim 2s infinite; font-size: 24px; color: ${template.text_color || '#ffffff'};">
                            ${escapeHtml(previewText)}
                        </div>
                    </div>
                    <div class="template-info">
                        <div class="template-name">
                            ${escapeHtml(template.template_name)}
                            ${ownerBadge}
                        </div>
                        <div class="template-code" onclick="window.fontStudio.copyTemplateCode('${template.template_code}')">
                            <code>${shortCode}</code>
                            <i class="fas fa-copy"></i>
                        </div>
                        <div class="template-actions">
                            <button class="template-btn load" onclick="window.fontStudio.loadTemplate('${template.template_code}')">
                                <i class="fas fa-download"></i> Load
                            </button>
            `;
            
            // ==================== TOMBOL HAPUS HANYA UNTUK PEMILIK WEBSITE ====================
            if (isOwner) {
                html += `
                            <button class="template-btn delete" onclick="window.fontStudio.deleteTemplate('${template.template_code}', '${escapeHtml(template.template_name)}')">
                                <i class="fas fa-trash-alt"></i> Hapus
                            </button>
                `;
            }
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.allTemplatesGrid.innerHTML = html;
        
        // Verifikasi font untuk setiap card
        document.querySelectorAll('.template-card').forEach(card => {
            const fontFamily = card.dataset.font;
            const previewDiv = card.querySelector('.template-preview-text');
            if (previewDiv) {
                previewDiv.style.fontFamily = `'${fontFamily}', sans-serif`;
            }
        });
    }

    function renderAllTemplates(templates) {
        if (!elements.allTemplatesGrid) return;
        
        if (templates.length === 0) {
            elements.allTemplatesGrid.innerHTML = '<div class="template-loading"><i class="fas fa-folder-open"></i><span>Belum ada template</span></div>';
            return;
        }
        
        const currentUserId = getCurrentUserId();
        console.log('👤 Current User ID:', currentUserId);
        
        let html = '';
        templates.forEach(template => {
            const shortCode = template.template_code.substring(0, 10) + '...';
            const previewText = template.preview_text || template.template_name || 'Aa';
            const fontFamily = template.font_family || 'Inter';
            const animType = template.animation_type || 'pulse';
            
            // Cek apakah user yang login adalah pembuat template
            const isOwner = (template.user_id === currentUserId && currentUserId !== 0);
            const isPublic = template.is_public === 1;
            
            // Badge untuk menunjukkan kepemilikan
            let ownerBadge = '';
            if (isOwner) {
                ownerBadge = '<span class="owner-badge"><i class="fas fa-user-check"></i> Milik Saya</span>';
            } else if (isPublic) {
                ownerBadge = '<span class="public-badge"><i class="fas fa-globe"></i> Public</span>';
            }
            
            html += `
                <div class="template-card" data-code="${template.template_code}" data-font="${fontFamily}" data-owner="${template.user_id || 0}">
                    <div class="template-preview" style="background: linear-gradient(135deg, #1a1a1a, #2a2a2a);">
                        <div class="template-preview-text" style="font-family: '${fontFamily}', sans-serif; animation: ${animType}Anim 2s infinite; font-size: 24px; color: ${template.text_color || '#ffffff'};">
                            ${escapeHtml(previewText)}
                        </div>
                    </div>
                    <div class="template-info">
                        <div class="template-name">
                            ${escapeHtml(template.template_name)}
                            ${ownerBadge}
                        </div>
                        <div class="template-code" onclick="window.fontStudio.copyTemplateCode('${template.template_code}')">
                            <code>${shortCode}</code>
                            <i class="fas fa-copy"></i>
                        </div>
                        <div class="template-actions">
                            <button class="template-btn load" onclick="window.fontStudio.loadTemplate('${template.template_code}')">
                                <i class="fas fa-download"></i> Load
                            </button>
                `;
            
            // Tambahkan tombol hapus hanya jika user adalah pemilik
            if (isOwner) {
                html += `
                            <button class="template-btn delete" onclick="window.fontStudio.deleteTemplate('${template.template_code}', '${escapeHtml(template.template_name)}')">
                                <i class="fas fa-trash-alt"></i> Hapus
                            </button>
                `;
            }
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.allTemplatesGrid.innerHTML = html;
        
        // Verifikasi font untuk setiap card
        document.querySelectorAll('.template-card').forEach(card => {
            const fontFamily = card.dataset.font;
            const previewDiv = card.querySelector('.template-preview-text');
            if (previewDiv) {
                previewDiv.style.fontFamily = `'${fontFamily}', sans-serif`;
            }
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function loadTemplateFromList(code) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/font-templates/${code}`);
            const result = await response.json();
            
            if (result.success) {
                const data = result.template;
                
                // Load font dari data yang disimpan
                if (data.font_file_data) {
                    currentFontDataUrl = data.font_file_data;
                    currentFontFile = { name: data.font_file_name || 'font.ttf' };
                    
                    const family = data.font_family;
                    
                    // Inject font ke halaman utama
                    const fontFace = `@font-face { 
                        font-family: '${family}'; 
                        src: url('${data.font_file_data}') format('truetype'); 
                        font-weight: normal; 
                        font-style: normal; 
                        font-display: swap; 
                    }`;
                    
                    const oldStyle = document.getElementById(`font-${family}`);
                    if (oldStyle) oldStyle.remove();
                    
                    const style = document.createElement('style');
                    style.id = `font-${family}`;
                    style.textContent = fontFace;
                    document.head.appendChild(style);
                    
                    currentFontFamily = `'${family}', sans-serif`;
                    
                    if (elements.uploadedFileName) {
                        elements.uploadedFileName.textContent = data.font_file_name || `${family}.ttf`;
                    }
                    if (elements.uploadedFileInfo) {
                        elements.uploadedFileInfo.style.display = 'flex';
                    }
                    if (elements.fontUploadArea) {
                        elements.fontUploadArea.style.display = 'none';
                    }
                    
                    // Tambahkan ke injectedFonts
                    injectedFonts.add(family);
                }
                
                // Apply data ke form
                if (elements.fontFamily) elements.fontFamily.value = data.font_family || 'MyCustomFont';
                if (elements.fontWeight) elements.fontWeight.value = data.font_weight || 400;
                if (elements.fontStyle) elements.fontStyle.value = data.font_style || 'normal';
                if (elements.fontSize) elements.fontSize.value = data.font_size || 48;
                if (elements.textColor) elements.textColor.value = data.text_color || '#ffffff';
                if (elements.textColorHex) elements.textColorHex.value = data.text_color || '#ffffff';
                if (elements.animationType) elements.animationType.value = data.animation_type || 'none';
                if (elements.animDuration) elements.animDuration.value = data.animation_duration || 2;
                if (elements.animDelay) elements.animDelay.value = data.animation_delay || 0;
                if (elements.animIteration) elements.animIteration.value = data.animation_iteration || 'infinite';
                if (elements.previewText) elements.previewText.value = data.preview_text || 'Toko Online';
                
                if (elements.animDurationValue) {
                    elements.animDurationValue.textContent = `${data.animation_duration || 2}s`;
                }
                if (elements.animDelayValue) {
                    elements.animDelayValue.textContent = `${data.animation_delay || 0}s`;
                }
                
                updatePreview();
                
                // Close modal
                if (elements.allTemplatesModal) {
                    elements.allTemplatesModal.classList.remove('active');
                }
                
                showToast(`✅ Template "${data.template_name}" dimuat!`, 'success');
            }
        } catch (error) {
            console.error('Error loading template:', error);
            showToast('Gagal memuat template', 'error');
        }
    }
    
    function copyTemplateCodeFromList(code) {
        navigator.clipboard.writeText(code)
            .then(() => showToast('Kode template disalin!', 'success'))
            .catch(() => showToast('Gagal menyalin', 'error'));
    }
    
    // ==================== SAVE ALL ====================
    function saveAll() {
        // Simpan pengaturan ke localStorage sebagai backup
        const settings = {
            fontFamily: elements.fontFamily?.value,
            fontWeight: elements.fontWeight?.value,
            fontStyle: elements.fontStyle?.value,
            fontSize: elements.fontSize?.value,
            textColor: elements.textColor?.value,
            animationType: elements.animationType?.value,
            animationDuration: elements.animDuration?.value,
            animationDelay: elements.animDelay?.value,
            animationIteration: elements.animIteration?.value,
            previewText: elements.previewText?.value
        };
        
        try {
            localStorage.setItem('fontStudioSettings', JSON.stringify(settings));
            showToast('✅ Pengaturan disimpan di browser!', 'success');
            vibrate();
        } catch (e) {
            showToast('Gagal menyimpan', 'error');
        }
    }
    
    // ==================== SECTION TOGGLES ====================
    function initSectionToggles() {
        elements.sectionHeaders?.forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isExpanded = header.getAttribute('data-expanded') === 'true';
                
                header.setAttribute('data-expanded', !isExpanded);
                if (content) {
                    if (isExpanded) {
                        content.classList.add('hidden');
                    } else {
                        content.classList.remove('hidden');
                    }
                }
            });
        });
    }
    
    // ==================== NAVIGATION ====================
    function goBack() {
        if (document.referrer) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
    }
    
    // ==================== LOAD SAVED SETTINGS ====================
    function loadSavedSettings() {
        try {
            const saved = localStorage.getItem('fontStudioSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (elements.fontFamily) elements.fontFamily.value = settings.fontFamily || 'MyCustomFont';
                if (elements.fontWeight) elements.fontWeight.value = settings.fontWeight || 400;
                if (elements.fontStyle) elements.fontStyle.value = settings.fontStyle || 'normal';
                if (elements.fontSize) elements.fontSize.value = settings.fontSize || 48;
                if (elements.textColor) elements.textColor.value = settings.textColor || '#ffffff';
                if (elements.textColorHex) elements.textColorHex.value = settings.textColor || '#ffffff';
                if (elements.animationType) elements.animationType.value = settings.animationType || 'none';
                if (elements.animDuration) elements.animDuration.value = settings.animationDuration || 2;
                if (elements.animDelay) elements.animDelay.value = settings.animationDelay || 0;
                if (elements.animIteration) elements.animIteration.value = settings.animationIteration || 'infinite';
                if (elements.previewText) elements.previewText.value = settings.previewText || 'Toko Online';
                
                updatePreview();
                console.log('📂 Loaded saved settings from localStorage');
            }
        } catch (e) {
            console.warn('Failed to load saved settings:', e);
        }
    }

    // ==================== GET CURRENT USER ID ====================
    function getCurrentUserId() {
        try {
            console.log('🔍 ========== GETTING USER ID ==========');
            
            // ==================== 1. CEK TELEGRAM WEBAPP ====================
            console.log('📱 Checking Telegram WebApp...');
            console.log('window.Telegram exists:', !!window.Telegram);
            
            if (window.Telegram && window.Telegram.WebApp) {
                console.log('✅ Telegram.WebApp found');
                
                const webApp = window.Telegram.WebApp;
                console.log('WebApp version:', webApp.version);
                console.log('WebApp platform:', webApp.platform);
                console.log('WebApp colorScheme:', webApp.colorScheme);
                
                // Cek initDataUnsafe
                const initDataUnsafe = webApp.initDataUnsafe;
                console.log('initDataUnsafe exists:', !!initDataUnsafe);
                
                if (initDataUnsafe) {
                    console.log('initDataUnsafe keys:', Object.keys(initDataUnsafe));
                    const user = initDataUnsafe.user;
                    
                    if (user) {
                        console.log('✅ User object found:', user);
                        console.log('User ID:', user.id);
                        console.log('Username:', user.username);
                        console.log('First name:', user.first_name);
                        console.log('Last name:', user.last_name);
                        console.log('Language:', user.language_code);
                        
                        if (user.id) {
                            console.log('🎯 Returning User ID from Telegram:', user.id);
                            return user.id;
                        }
                    } else {
                        console.log('⚠️ User object not found in initDataUnsafe');
                        console.log('initDataUnsafe content:', initDataUnsafe);
                    }
                }
                
                // ==================== 2. PARSE INITDATA (FALLBACK) ====================
                const initData = webApp.initData;
                if (initData) {
                    console.log('📦 initData found, length:', initData.length);
                    console.log('initData preview:', initData.substring(0, 200) + '...');
                    
                    try {
                        // Parse initData sebagai query string
                        const params = new URLSearchParams(initData);
                        const userStr = params.get('user');
                        
                        if (userStr) {
                            console.log('📦 user param found in initData');
                            const userObj = JSON.parse(decodeURIComponent(userStr));
                            console.log('Parsed user object:', userObj);
                            
                            if (userObj && userObj.id) {
                                console.log('🎯 Returning User ID from parsed initData:', userObj.id);
                                return userObj.id;
                            }
                        } else {
                            console.log('⚠️ No user param in initData');
                            console.log('Available params:', Array.from(params.keys()));
                        }
                    } catch (parseError) {
                        console.error('❌ Failed to parse initData:', parseError);
                    }
                } else {
                    console.log('⚠️ initData is empty');
                }
            } else {
                console.log('❌ Telegram.WebApp not available');
                if (window.Telegram) {
                    console.log('window.Telegram exists but WebApp is missing');
                    console.log('window.Telegram keys:', Object.keys(window.Telegram));
                }
            }
            
            // ==================== 3. FALLBACK: URL PARAMETER ====================
            const urlParams = new URLSearchParams(window.location.search);
            const urlUserId = urlParams.get('user_id');
            if (urlUserId) {
                console.log('👤 User ID from URL parameter:', urlUserId);
                const parsedId = parseInt(urlUserId);
                if (!isNaN(parsedId) && parsedId > 0) {
                    console.log('🎯 Returning User ID from URL:', parsedId);
                    return parsedId;
                }
            }
            
            // ==================== 4. FALLBACK: LOCALSTORAGE ====================
            const savedUserId = localStorage.getItem('fontStudioUserId');
            if (savedUserId) {
                console.log('👤 User ID from localStorage:', savedUserId);
                const parsedId = parseInt(savedUserId);
                if (!isNaN(parsedId) && parsedId > 0) {
                    console.log('🎯 Returning User ID from localStorage:', parsedId);
                    return parsedId;
                }
            }
            
            // ==================== 5. FALLBACK: SESSIONSTORAGE ====================
            const sessionUserId = sessionStorage.getItem('fontStudioUserId');
            if (sessionUserId) {
                console.log('👤 User ID from sessionStorage:', sessionUserId);
                const parsedId = parseInt(sessionUserId);
                if (!isNaN(parsedId) && parsedId > 0) {
                    console.log('🎯 Returning User ID from sessionStorage:', parsedId);
                    return parsedId;
                }
            }
            
            // ==================== 6. FALLBACK: COOKIE ====================
            const getCookie = (name) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            };
            const cookieUserId = getCookie('telegram_user_id');
            if (cookieUserId) {
                console.log('👤 User ID from cookie:', cookieUserId);
                const parsedId = parseInt(cookieUserId);
                if (!isNaN(parsedId) && parsedId > 0) {
                    console.log('🎯 Returning User ID from cookie:', parsedId);
                    return parsedId;
                }
            }
            
            // ==================== 7. FALLBACK: META TAG ====================
            const metaUserId = document.querySelector('meta[name="telegram-user-id"]')?.getAttribute('content');
            if (metaUserId) {
                console.log('👤 User ID from meta tag:', metaUserId);
                const parsedId = parseInt(metaUserId);
                if (!isNaN(parsedId) && parsedId > 0) {
                    console.log('🎯 Returning User ID from meta tag:', parsedId);
                    return parsedId;
                }
            }
            
            // ==================== 8. DEBUG: LIST ALL STORAGE ITEMS ====================
            console.log('🔍 LocalStorage contents:');
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                console.log(`   ${key}:`, localStorage.getItem(key));
            }
            
            console.log('🔍 SessionStorage contents:');
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                console.log(`   ${key}:`, sessionStorage.getItem(key));
            }
            
            console.log('🔍 URL Parameters:');
            for (const [key, value] of urlParams.entries()) {
                console.log(`   ${key}:`, value);
            }
            
            console.log('⚠️ No user ID found in any source, using 0');
            console.log('💡 Tips:');
            console.log('   - Akses halaman melalui bot Telegram untuk mendapatkan user ID otomatis');
            console.log('   - Atau set manual: localStorage.setItem("fontStudioUserId", "7998861975")');
            console.log('   - Kemudian refresh halaman');
            
            return 0;
            
        } catch (error) {
            console.error('❌ Error in getCurrentUserId:', error);
            console.error('Error stack:', error.stack);
            return 0;
        }
    }

    // Simpan user ID ke localStorage (opsional)
    function saveCurrentUserId(userId) {
        if (userId) localStorage.setItem('fontStudioUserId', userId);
    }

    // ==================== DELETE TEMPLATE ====================
    async function deleteTemplate(templateCode, templateName) {
        if (!confirm(`Hapus template "${templateName}"? Tindakan ini tidak dapat dibatalkan!`)) {
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/font-templates/${templateCode}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast(`✅ Template "${templateName}" dihapus!`, 'success');
                // Refresh daftar template
                await loadAllTemplates(elements.modalTemplateSearch?.value || '');
            } else {
                throw new Error(result.error || 'Gagal menghapus template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            showToast(error.message || 'Gagal menghapus template', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== INIT ====================
    function init() {
        showLoading(true);
        
        try {
            injectAnimationStyles();
            setupFontUpload();
            loadSavedSettings();
            
            if (elements.fontSize) elements.fontSize.value = 48;
            if (elements.animDuration) elements.animDuration.value = 2;
            if (elements.animDelay) elements.animDelay.value = 0;
            
            // ==================== AMBIL WEBSITE ID DARI URL ====================
            const urlParams = new URLSearchParams(window.location.search);
            const websiteParam = urlParams.get('website');
            let currentWebsiteId = null;
            
            console.log('🔍 ========== WEBSITE DEBUGGING ==========');
            console.log('📱 Current URL:', window.location.href);
            console.log('🌐 Website endpoint dari URL:', websiteParam);
            
            // Fungsi untuk mengambil website_id dari endpoint
            async function fetchWebsiteId(endpoint) {
                if (!endpoint) return null;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`);
                    const data = await response.json();
                    if (data.success && data.website) {
                        console.log('🌐 Website ID dari endpoint:', data.website.id);
                        console.log('🌐 Website endpoint:', data.website.endpoint);
                        return data.website.id;
                    }
                    return null;
                } catch (error) {
                    console.error('❌ Error fetching website_id:', error);
                    return null;
                }
            }
            
            // Ambil website_id secara async
            if (websiteParam) {
                fetchWebsiteId(websiteParam).then(websiteId => {
                    if (websiteId) {
                        currentWebsiteId = websiteId;
                        window.currentWebsiteId = websiteId;
                        window.currentWebsiteEndpoint = websiteParam;
                        console.log('💾 Website ID saved:', currentWebsiteId);
                        
                        // Simpan ke localStorage untuk penggunaan berikutnya
                        localStorage.setItem('fontStudioWebsiteId', currentWebsiteId);
                        localStorage.setItem('fontStudioWebsiteEndpoint', websiteParam);
                    }
                }).catch(err => {
                    console.warn('⚠️ Gagal mengambil website_id:', err);
                });
            } else {
                console.log('⚠️ Tidak ada parameter website di URL');
                // Cek dari localStorage sebagai fallback
                const savedWebsiteId = localStorage.getItem('fontStudioWebsiteId');
                const savedWebsiteEndpoint = localStorage.getItem('fontStudioWebsiteEndpoint');
                if (savedWebsiteId && savedWebsiteEndpoint) {
                    console.log('💾 Menggunakan website_id dari localStorage:', savedWebsiteId);
                    window.currentWebsiteId = parseInt(savedWebsiteId);
                    window.currentWebsiteEndpoint = savedWebsiteEndpoint;
                }
            }
            
            // ==================== AMBIL USER ID (OPSIONAL, UNTUK KEPERLUAN LAIN) ====================
            let userId = 0;
            
            console.log('🔍 ========== USER ID DEBUGGING ==========');
            
            // 1. Cek dari Telegram WebApp (jika diakses melalui bot)
            if (window.Telegram && window.Telegram.WebApp) {
                console.log('✅ Telegram.WebApp ditemukan');
                const webApp = window.Telegram.WebApp;
                console.log('📦 WebApp version:', webApp.version);
                console.log('📦 WebApp platform:', webApp.platform);
                console.log('📦 WebApp colorScheme:', webApp.colorScheme);
                console.log('📦 WebApp isExpanded:', webApp.isExpanded);
                
                const initData = webApp.initDataUnsafe;
                console.log('📦 initDataUnsafe:', JSON.stringify(initData, null, 2));
                
                // Cek apakah ada user data
                if (initData && initData.user) {
                    userId = initData.user.id;
                    console.log('✅ User ID dari Telegram:', userId);
                    console.log('📝 User Info:', {
                        id: initData.user.id,
                        username: initData.user.username,
                        first_name: initData.user.first_name,
                        last_name: initData.user.last_name,
                        language_code: initData.user.language_code,
                        is_premium: initData.user.is_premium
                    });
                    
                    // Simpan ke localStorage
                    if (userId > 0) {
                        localStorage.setItem('fontStudioUserId', userId);
                        localStorage.setItem('fontStudioUserName', initData.user.username || '');
                        localStorage.setItem('fontStudioUserFirstName', initData.user.first_name || '');
                        console.log('💾 User data saved to localStorage');
                    }
                } else {
                    console.log('⚠️ initDataUnsafe.user tidak ditemukan');
                    console.log('📦 initDataUnsafe keys:', initData ? Object.keys(initData) : 'undefined');
                    
                    if (initData) {
                        console.log('📦 Available keys:', Object.keys(initData));
                        if (initData.auth_date) console.log('📦 auth_date:', initData.auth_date);
                        if (initData.query_id) console.log('📦 query_id:', initData.query_id);
                        if (initData.hash) console.log('📦 hash:', initData.hash);
                    }
                }
                
                // 2. Alternatif: Parse initData string
                const initDataString = webApp.initData;
                if (initDataString && !userId) {
                    console.log('📦 initData string exists, length:', initDataString.length);
                    console.log('📦 initData preview:', initDataString.substring(0, 200) + (initDataString.length > 200 ? '...' : ''));
                    
                    try {
                        const params = new URLSearchParams(initDataString);
                        console.log('📦 Available params:', Array.from(params.keys()));
                        
                        const userStr = params.get('user');
                        if (userStr) {
                            console.log('📦 user param found, length:', userStr.length);
                            const userObj = JSON.parse(decodeURIComponent(userStr));
                            console.log('📦 Parsed user object:', userObj);
                            
                            if (userObj && userObj.id) {
                                userId = userObj.id;
                                console.log('✅ User ID dari parsed initData:', userId);
                                
                                localStorage.setItem('fontStudioUserId', userId);
                                if (userObj.username) localStorage.setItem('fontStudioUserName', userObj.username);
                                if (userObj.first_name) localStorage.setItem('fontStudioUserFirstName', userObj.first_name);
                            }
                        } else {
                            console.log('⚠️ No "user" param in initData');
                        }
                    } catch (parseError) {
                        console.error('❌ Failed to parse initData:', parseError);
                    }
                }
            } else {
                console.log('❌ Telegram.WebApp tidak tersedia');
                console.log('📦 window.Telegram exists:', !!window.Telegram);
                if (window.Telegram) {
                    console.log('📦 window.Telegram keys:', Object.keys(window.Telegram));
                }
            }
            
            // 3. Fallback: cek dari URL parameter
            if (userId === 0) {
                console.log('🔍 URL Parameters:');
                for (const [key, value] of urlParams.entries()) {
                    console.log(`   ${key}: ${value}`);
                }
                
                const urlUserId = urlParams.get('user_id');
                if (urlUserId) {
                    userId = parseInt(urlUserId);
                    console.log('👤 User ID dari URL parameter:', userId);
                }
            }
            
            // 4. Fallback: cek dari localStorage
            if (userId === 0) {
                const savedUserId = localStorage.getItem('fontStudioUserId');
                if (savedUserId) {
                    userId = parseInt(savedUserId);
                    console.log('👤 User ID dari localStorage:', userId);
                }
            }
            
            // Simpan user ID jika ada
            if (userId > 0) {
                localStorage.setItem('fontStudioUserId', userId.toString());
                sessionStorage.setItem('fontStudioUserId', userId.toString());
                
                const expires = new Date();
                expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
                document.cookie = `telegram_user_id=${userId}; expires=${expires.toUTCString()}; path=/`;
                
                console.log('💾 User ID saved:', userId);
            } else {
                console.log('ℹ️ User ID tidak ditemukan (tidak masalah, kepemilikan berdasarkan website_id)');
            }
            
            // Simpan ke hidden input jika ada
            const hiddenUserId = document.getElementById('telegramUserId');
            if (hiddenUserId) {
                hiddenUserId.value = userId;
            }
            
            // Log final website dan user ID
            console.log('🎯 FINAL Website ID:', window.currentWebsiteId || 'belum diambil');
            console.log('🎯 FINAL Website Endpoint:', window.currentWebsiteEndpoint || 'tidak ada');
            console.log('🎯 FINAL User ID:', userId);
            console.log('🔍 ========== END DEBUGGING ==========');
            
            // Simpan ke global variable
            window.currentFontStudioUserId = userId;
            
            // Update preview
            updatePreview();
            setupEventListeners();
            initSectionToggles();
            
            // Inisialisasi Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                console.log('📱 Telegram WebApp siap, theme:', tg.colorScheme);
                
                if (userId > 0) {
                    try {
                        tg.sendData(JSON.stringify({ action: 'user_id', user_id: userId }));
                    } catch(e) { console.warn('Cannot sendData:', e); }
                }
            } else {
                console.log('🌐 Running in browser mode');
            }
            
            // Test koneksi ke API
            fetch(`${API_BASE_URL}/api/health`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'healthy') {
                        console.log('✅ API Connected');
                        showToast('Terhubung ke server', 'success');
                    }
                })
                .catch(err => {
                    console.warn('⚠️ API not available, using localStorage only');
                    showToast('Menggunakan mode offline', 'warning');
                });
            
            showToast('Font Studio siap!', 'success');
            
        } catch (error) {
            console.error('Init error:', error);
            showToast('Gagal memuat studio', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', goBack);
        }
        
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', saveAll);
        }
        
        if (elements.loadFontBtn) {
            elements.loadFontBtn.addEventListener('click', loadFont);
        }
        
        const fontControls = [
            elements.fontWeight, 
            elements.fontStyle, 
            elements.fontSize, 
            elements.animationType, 
            elements.animDuration, 
            elements.animDelay, 
            elements.animIteration
        ];
        
        fontControls.forEach(control => {
            if (control) {
                control.addEventListener('input', updatePreview);
                control.addEventListener('change', updatePreview);
            }
        });
        
        if (elements.textColor) {
            elements.textColor.addEventListener('input', (e) => {
                if (elements.textColorHex) elements.textColorHex.value = e.target.value;
                updatePreview();
            });
        }
        
        if (elements.textColorHex) {
            elements.textColorHex.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    if (elements.textColor) elements.textColor.value = e.target.value;
                    updatePreview();
                }
            });
        }
        
        const debouncedUpdate = debounce(updatePreview, 300);
        if (elements.previewText) {
            elements.previewText.addEventListener('input', debouncedUpdate);
        }
        
        if (elements.saveTemplateBtn) {
            elements.saveTemplateBtn.addEventListener('click', saveTemplate);
        }
        
        if (elements.copyCodeBtn) {
            elements.copyCodeBtn.addEventListener('click', copyTemplateCode);
        }
        
        if (elements.playAnimation) {
            elements.playAnimation.addEventListener('click', playPreviewAnimation);
        }
        
        if (elements.pauseAnimation) {
            elements.pauseAnimation.addEventListener('click', pausePreviewAnimation);
        }
        
        if (elements.restartAnimation) {
            elements.restartAnimation.addEventListener('click', restartPreviewAnimation);
        }
        
        if (elements.fullscreenPreview && elements.previewCanvas) {
            elements.fullscreenPreview.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    elements.previewCanvas.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }
        
        // Modal handlers
        if (elements.viewAllTemplatesBtn) {
            elements.viewAllTemplatesBtn.addEventListener('click', () => {
                if (elements.allTemplatesModal) {
                    elements.allTemplatesModal.classList.add('active');
                    loadAllTemplates();
                }
            });
        }
        
        if (elements.closeAllTemplatesModal) {
            elements.closeAllTemplatesModal.addEventListener('click', () => {
                elements.allTemplatesModal.classList.remove('active');
            });
        }
        
        if (elements.modalTemplateSearch) {
            const debouncedSearch = debounce((e) => loadAllTemplates(e.target.value), 500);
            elements.modalTemplateSearch.addEventListener('input', debouncedSearch);
        }
        
        if (elements.modalTemplateFilter) {
            elements.modalTemplateFilter.addEventListener('change', () => loadAllTemplates());
        }
        
        window.addEventListener('click', (e) => {
            if (e.target === elements.allTemplatesModal) {
                elements.allTemplatesModal.classList.remove('active');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && !e.target.matches('input, textarea, button')) {
                e.preventDefault();
                if (isAnimating) {
                    pausePreviewAnimation();
                } else {
                    playPreviewAnimation();
                }
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveAll();
            }
        });
    }
    
    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.fontStudio = {
        loadTemplate: loadTemplateFromList,
        copyTemplateCode: copyTemplateCodeFromList
    };
    
    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
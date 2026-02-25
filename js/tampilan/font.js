// Font Studio - Versi Lengkap dengan Upload File TTF
(function() {
    'use strict';
    
    console.log('🎨 Font Studio - Initializing...');
    
    // ==================== ANIMASI PRESETS ====================
    const ANIMATIONS = {
        none: {
            name: 'Tidak Ada',
            css: 'none'
        },
        fade: {
            name: 'Fade',
            keyframes: '@keyframes fadeAnim { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }'
        },
        bounce: {
            name: 'Bounce',
            keyframes: '@keyframes bounceAnim { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }'
        },
        pulse: {
            name: 'Pulse',
            keyframes: '@keyframes pulseAnim { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }'
        },
        shake: {
            name: 'Shake',
            keyframes: '@keyframes shakeAnim { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }'
        },
        float: {
            name: 'Float',
            keyframes: '@keyframes floatAnim { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }'
        },
        rotate: {
            name: 'Rotate',
            keyframes: '@keyframes rotateAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
        },
        wave: {
            name: 'Wave',
            keyframes: '@keyframes waveAnim { 0% { transform: skew(0deg); } 25% { transform: skew(5deg); } 75% { transform: skew(-5deg); } 100% { transform: skew(0deg); } }'
        },
        glitch: {
            name: 'Glitch',
            keyframes: '@keyframes glitchAnim { 0% { text-shadow: 2px 0 red, -2px 0 blue; } 50% { text-shadow: -2px 0 red, 2px 0 blue; } 100% { text-shadow: 2px 0 red, -2px 0 blue; } }'
        },
        rainbow: {
            name: 'Rainbow',
            keyframes: '@keyframes rainbowAnim { 0% { color: #ff0000; } 20% { color: #ff8800; } 40% { color: #ffff00; } 60% { color: #00ff00; } 80% { color: #0088ff; } 100% { color: #ff0000; } }'
        },
        heartbeat: {
            name: 'Heartbeat',
            keyframes: '@keyframes heartbeatAnim { 0% { transform: scale(1); } 25% { transform: scale(1.1); } 50% { transform: scale(1); } 75% { transform: scale(1.1); } 100% { transform: scale(1); } }'
        }
    };
    
    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        backToPanel: document.getElementById('backToPanel'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        
        // Font Controls
        fontUploadArea: document.getElementById('fontUploadArea'),
        fontFileInput: document.getElementById('fontFileInput'),
        uploadedFileInfo: document.getElementById('uploadedFileInfo'),
        uploadedFileName: document.getElementById('uploadedFileName'),
        removeFontBtn: document.getElementById('removeFontBtn'),
        fontFamily: document.getElementById('fontFamily'),
        fontUrl: document.getElementById('fontUrl'),
        loadFontBtn: document.getElementById('loadFontBtn'),
        fontWeight: document.getElementById('fontWeight'),
        fontStyle: document.getElementById('fontStyle'),
        fontSize: document.getElementById('fontSize'),
        textColor: document.getElementById('textColor'),
        textColorHex: document.getElementById('textColorHex'),
        
        // Animation Controls
        animationType: document.getElementById('animationType'),
        animDuration: document.getElementById('animDuration'),
        animDurationValue: document.getElementById('animDurationValue'),
        animDelay: document.getElementById('animDelay'),
        animDelayValue: document.getElementById('animDelayValue'),
        animIteration: document.getElementById('animIteration'),
        
        // Template Controls
        templateName: document.getElementById('templateName'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        savedCodeDisplay: document.getElementById('savedCodeDisplay'),
        generatedCode: document.getElementById('generatedCode'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        loadTemplateCode: document.getElementById('loadTemplateCode'),
        loadTemplateBtn: document.getElementById('loadTemplateBtn'),
        
        // Preview
        previewText: document.getElementById('previewText'),
        previewSubtext: document.getElementById('previewSubtext'),
        previewTextDisplay: document.getElementById('previewTextDisplay'),
        previewSubtextDisplay: document.getElementById('previewSubtextDisplay'),
        previewCanvas: document.getElementById('previewCanvas'),
        
        // Timeline Controls
        playAnimation: document.getElementById('playAnimation'),
        pauseAnimation: document.getElementById('pauseAnimation'),
        restartAnimation: document.getElementById('restartAnimation'),
        fullscreenPreview: document.getElementById('fullscreenPreview'),
        
        // Info Panel
        infoFont: document.getElementById('infoFont'),
        infoWeight: document.getElementById('infoWeight'),
        infoSize: document.getElementById('infoSize'),
        infoAnimasi: document.getElementById('infoAnimasi'),
        cssCode: document.getElementById('cssCode'),
        
        // Toast
        toastContainer: document.getElementById('toastContainer'),
        
        // Section Toggles
        sectionHeaders: document.querySelectorAll('.section-header')
    };
    
    // ==================== STATE ====================
    let currentFontFamily = 'Inter, sans-serif';
    let currentFontFile = null;
    let currentFontDataUrl = null;
    let animationStyleElement = null;
    let isAnimating = false;
    
    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        }[type] || 'info-circle';
        
        toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutToast 0.3s ease';
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
    
    // ==================== ANIMATION FUNCTIONS ====================
    function injectAnimationStyles() {
        if (animationStyleElement) {
            animationStyleElement.remove();
        }
        
        animationStyleElement = document.createElement('style');
        let css = '';
        
        Object.values(ANIMATIONS).forEach(anim => {
            if (anim.keyframes) {
                css += anim.keyframes + '\n';
            }
        });
        
        animationStyleElement.textContent = css;
        document.head.appendChild(animationStyleElement);
    }
    
    // ==================== FONT FUNCTIONS ====================
    function setupFontUpload() {
        if (!elements.fontUploadArea || !elements.fontFileInput) return;
        
        // Click to upload
        elements.fontUploadArea.addEventListener('click', () => {
            elements.fontFileInput.click();
        });
        
        // Drag & drop
        elements.fontUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.fontUploadArea.style.borderColor = 'var(--primary-color)';
            elements.fontUploadArea.style.background = 'rgba(64, 167, 227, 0.1)';
        });
        
        elements.fontUploadArea.addEventListener('dragleave', () => {
            elements.fontUploadArea.style.borderColor = 'var(--border-color)';
            elements.fontUploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
        });
        
        elements.fontUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.fontUploadArea.style.borderColor = 'var(--border-color)';
            elements.fontUploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFontFile(files[0]);
            }
        });
        
        // File input change
        elements.fontFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFontFile(e.target.files[0]);
            }
        });
        
        // Remove font button
        if (elements.removeFontBtn) {
            elements.removeFontBtn.addEventListener('click', removeFontFile);
        }
    }
    
    function handleFontFile(file) {
        // Check if it's a TTF file
        if (!file.name.toLowerCase().endsWith('.ttf')) {
            showToast('Hanya file .ttf yang diperbolehkan', 'error');
            return;
        }
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Ukuran file maksimal 5MB', 'error');
            return;
        }
        
        showLoading(true);
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            currentFontFile = file;
            currentFontDataUrl = e.target.result;
            
            // Display uploaded file info
            if (elements.uploadedFileName) {
                elements.uploadedFileName.textContent = file.name;
            }
            if (elements.uploadedFileInfo) {
                elements.uploadedFileInfo.style.display = 'flex';
            }
            if (elements.fontUploadArea) {
                elements.fontUploadArea.style.display = 'none';
            }
            
            // Auto-fill font family name from filename (remove .ttf)
            const fontName = file.name.replace(/\.ttf$/i, '');
            if (elements.fontFamily) {
                elements.fontFamily.value = fontName;
            }
            
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
        
        if (elements.uploadedFileInfo) {
            elements.uploadedFileInfo.style.display = 'none';
        }
        if (elements.fontUploadArea) {
            elements.fontUploadArea.style.display = 'block';
        }
        if (elements.fontFileInput) {
            elements.fontFileInput.value = '';
        }
        
        // Remove font from preview
        const fontFamily = elements.fontFamily?.value.trim() || 'MyCustomFont';
        const oldStyle = document.getElementById(`font-${fontFamily}`);
        if (oldStyle) oldStyle.remove();
        
        // Reset to default font
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
            // Hapus style font lama jika ada
            const oldStyle = document.getElementById(`font-${family}`);
            if (oldStyle) oldStyle.remove();
            
            let fontFace = '';
            
            // Prioritaskan file upload
            if (currentFontDataUrl) {
                // Gunakan data URL dari file upload
                fontFace = `
                    @font-face {
                        font-family: '${family}';
                        src: url('${currentFontDataUrl}') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: swap;
                    }
                `;
            } 
            // Alternatif: URL font
            else if (elements.fontUrl?.value.trim()) {
                const fontUrl = elements.fontUrl.value.trim();
                if (!fontUrl.toLowerCase().endsWith('.ttf')) {
                    showToast('URL harus mengarah ke file .ttf', 'warning');
                    showLoading(false);
                    return;
                }
                
                fontFace = `
                    @font-face {
                        font-family: '${family}';
                        src: url('${fontUrl}') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: swap;
                    }
                `;
            } 
            // Tidak ada sumber font
            else {
                showToast('Upload file font atau masukkan URL font terlebih dahulu', 'warning');
                showLoading(false);
                return;
            }
            
            // Tambahkan style ke head
            const style = document.createElement('style');
            style.id = `font-${family}`;
            style.textContent = fontFace;
            document.head.appendChild(style);
            
            // Update current font family
            currentFontFamily = `'${family}', sans-serif`;
            
            // Update preview
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
        const text = elements.previewText?.value || 'Toko Online Premium';
        const subtext = elements.previewSubtext?.value || 'dengan Layanan Terbaik 24/7';
        const weight = elements.fontWeight?.value || 400;
        const style = elements.fontStyle?.value || 'normal';
        const size = elements.fontSize?.value || 48;
        const color = elements.textColor?.value || '#ffffff';
        const animType = elements.animationType?.value || 'none';
        const duration = elements.animDuration?.value || 2;
        const delay = elements.animDelay?.value || 0;
        const iteration = elements.animIteration?.value || 'infinite';
        
        // Update range values
        if (elements.animDurationValue) {
            elements.animDurationValue.textContent = `${duration}s`;
        }
        if (elements.animDelayValue) {
            elements.animDelayValue.textContent = `${delay}s`;
        }
        
        // Update display text
        if (elements.previewTextDisplay) {
            elements.previewTextDisplay.textContent = text;
        }
        if (elements.previewSubtextDisplay) {
            elements.previewSubtextDisplay.textContent = subtext;
        }
        
        // Apply font styles
        const previewElements = [
            elements.previewTextDisplay,
            elements.previewSubtextDisplay
        ];
        
        previewElements.forEach(el => {
            if (!el) return;
            
            el.style.fontFamily = currentFontFamily;
            el.style.fontWeight = weight;
            el.style.fontStyle = style;
            el.style.fontSize = `${size}px`;
            el.style.color = color;
            
            // Apply animation
            if (animType !== 'none' && ANIMATIONS[animType]) {
                el.style.animation = `${animType}Anim ${duration}s ${delay}s ${iteration}`;
            } else {
                el.style.animation = 'none';
            }
        });
        
        // Update info panel
        if (elements.infoFont) {
            const fontName = currentFontFamily.replace(/['"]/g, '').split(',')[0];
            elements.infoFont.textContent = fontName || 'Inter';
        }
        if (elements.infoWeight) {
            elements.infoWeight.textContent = weight;
        }
        if (elements.infoSize) {
            elements.infoSize.textContent = `${size}px`;
        }
        if (elements.infoAnimasi) {
            elements.infoAnimasi.textContent = ANIMATIONS[animType]?.name || 'Tidak Ada';
        }
        
        // Update CSS output
        updateCSSOutput();
    }
    
    function updateCSSOutput() {
        if (!elements.cssCode) return;
        
        const family = elements.fontFamily?.value.trim() || 'MyCustomFont';
        const weight = elements.fontWeight?.value || 400;
        const size = elements.fontSize?.value || 48;
        const color = elements.textColor?.value || '#ffffff';
        const animType = elements.animationType?.value || 'none';
        const duration = elements.animDuration?.value || 2;
        const delay = elements.animDelay?.value || 0;
        const iteration = elements.animIteration?.value || 'infinite';
        
        let css = `/* Font & Animation CSS */\n\n`;
        
        // @font-face jika ada font custom
        if (currentFontFile || elements.fontUrl?.value.trim()) {
            css += `@font-face {\n`;
            css += `    font-family: '${family}';\n`;
            
            if (currentFontDataUrl) {
                css += `    src: url('data:font/ttf;base64,${currentFontDataUrl.split(',')[1]}') format('truetype');\n`;
            } else if (elements.fontUrl?.value.trim()) {
                css += `    src: url('${elements.fontUrl.value.trim()}') format('truetype');\n`;
            }
            
            css += `    font-weight: normal;\n`;
            css += `    font-style: normal;\n`;
            css += `    font-display: swap;\n`;
            css += `}\n\n`;
        }
        
        css += `.preview-text {\n`;
        css += `    font-family: '${family}', sans-serif;\n`;
        css += `    font-size: ${size}px;\n`;
        css += `    font-weight: ${weight};\n`;
        css += `    color: ${color};\n`;
        
        if (animType !== 'none') {
            css += `    animation: ${animType}Anim ${duration}s ${delay}s ${iteration};\n`;
        }
        
        css += `}\n\n`;
        
        if (ANIMATIONS[animType]?.keyframes) {
            css += ANIMATIONS[animType].keyframes;
        }
        
        elements.cssCode.textContent = css;
    }
    
    // ==================== TEMPLATE FUNCTIONS ====================
    async function saveTemplate() {
      const name = elements.templateName?.value.trim();
    
      if (!name) {
        showToast('Nama template wajib diisi', 'warning');
        return;
      }
    
      showLoading(true);
    
      try {
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
          preview_text: elements.previewText?.value || 'Toko Online Premium',
          preview_subtext: elements.previewSubtext?.value || 'dengan Layanan Terbaik 24/7',
          website_id: null, // Bisa diisi dari session
          user_id: null, // Bisa diisi dari Telegram
          is_public: false
        };
    
        const response = await fetch('/api/font-templates/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templateData)
        });
    
        const result = await response.json();
    
        if (result.success) {
          // Tampilkan kode
          if (elements.generatedCode) {
            elements.generatedCode.textContent = result.template_code;
          }
          if (elements.savedCodeDisplay) {
            elements.savedCodeDisplay.style.display = 'block';
          }
    
          showToast(`✅ Template "${name}" disimpan!`, 'success');
          vibrate();
        } else {
          throw new Error(result.error || 'Gagal menyimpan template');
        }
    
      } catch (error) {
        console.error('Error saving template:', error);
        showToast(error.message, 'error');
      } finally {
        showLoading(false);
      }
    }
    
    async function loadTemplate() {
      const code = elements.loadTemplateCode?.value.trim();
    
      if (!code || code.length !== 35) {
        showToast('Kode template harus 35 karakter', 'warning');
        return;
      }
    
      showLoading(true);
    
      try {
        const response = await fetch(`/api/font-templates/${code}`);
        const result = await response.json();
    
        if (result.success) {
          const data = result.template;
    
          // Load font file jika ada
          if (data.font_file_data) {
            currentFontDataUrl = data.font_file_data;
            currentFontFile = { name: data.font_file_name || 'font.ttf' };
    
            // Buat @font-face
            const family = data.font_family;
            const fontFace = `
                        @font-face {
                            font-family: '${family}';
                            src: url('${data.font_file_data}') format('truetype');
                            font-weight: normal;
                            font-style: normal;
                            font-display: swap;
                        }
                    `;
    
            const oldStyle = document.getElementById(`font-${family}`);
            if (oldStyle) oldStyle.remove();
    
            const style = document.createElement('style');
            style.id = `font-${family}`;
            style.textContent = fontFace;
            document.head.appendChild(style);
    
            currentFontFamily = `'${family}', sans-serif`;
    
            // Update UI upload
            if (elements.uploadedFileName) {
              elements.uploadedFileName.textContent = data.font_file_name || `${family}.ttf`;
            }
            if (elements.uploadedFileInfo) {
              elements.uploadedFileInfo.style.display = 'flex';
            }
            if (elements.fontUploadArea) {
              elements.fontUploadArea.style.display = 'none';
            }
          }
    
          // Apply template data
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
          if (elements.previewText) elements.previewText.value = data.preview_text || 'Toko Online Premium';
          if (elements.previewSubtext) elements.previewSubtext.value = data.preview_subtext || 'dengan Layanan Terbaik 24/7';
    
          // Update range displays
          if (elements.animDurationValue) {
            elements.animDurationValue.textContent = `${data.animation_duration || 2}s`;
          }
          if (elements.animDelayValue) {
            elements.animDelayValue.textContent = `${data.animation_delay || 0}s`;
          }
    
          // Update preview
          updatePreview();
    
          showToast(`✅ Template "${data.template_name}" dimuat!`, 'success');
          vibrate();
    
        } else {
          throw new Error(result.error || 'Template tidak ditemukan');
        }
    
      } catch (error) {
        console.error('Error loading template:', error);
        showToast(error.message, 'error');
      } finally {
        showLoading(false);
      }
    }
    
    function copyTemplateCode() {
        const code = elements.generatedCode?.textContent;
        if (!code) return;
        
        navigator.clipboard.writeText(code).then(() => {
            showToast('Kode template disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin', 'error');
        });
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
        
        const previewElements = [
            elements.previewTextDisplay,
            elements.previewSubtextDisplay
        ];
        
        previewElements.forEach(el => {
            if (!el) return;
            el.style.animationPlayState = 'running';
        });
    }
    
    function pausePreviewAnimation() {
        isAnimating = false;
        
        const previewElements = [
            elements.previewTextDisplay,
            elements.previewSubtextDisplay
        ];
        
        previewElements.forEach(el => {
            if (!el) return;
            el.style.animationPlayState = 'paused';
        });
    }
    
    function restartPreviewAnimation() {
        const previewElements = [
            elements.previewTextDisplay,
            elements.previewSubtextDisplay
        ];
        
        previewElements.forEach(el => {
            if (!el) return;
            el.style.animation = 'none';
            el.offsetHeight; // Trigger reflow
        });
        
        // Re-apply animation
        updatePreview();
        
        isAnimating = true;
    }
    
    // ==================== SAVE ALL ====================
    function saveAll() {
        showLoading(true);
        
        // Simulasi save
        setTimeout(() => {
            showLoading(false);
            showToast('✅ Pengaturan disimpan!', 'success');
            vibrate();
        }, 500);
    }
    
    // ==================== INIT SECTION TOGGLES ====================
    function initSectionToggles() {
        elements.sectionHeaders?.forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isExpanded = header.getAttribute('data-expanded') !== 'false';
                
                header.setAttribute('data-expanded', !isExpanded);
                content.classList.toggle('hidden', isExpanded);
            });
        });
    }
    
    // ==================== INIT ====================
    function init() {
        showLoading(true);
        
        try {
            // Initialize animation styles
            injectAnimationStyles();
            
            // Setup font upload
            setupFontUpload();
            
            // Set default values
            if (elements.fontSize) elements.fontSize.value = 48;
            if (elements.animDuration) elements.animDuration.value = 2;
            if (elements.animDelay) elements.animDelay.value = 0;
            
            // Initial preview
            updatePreview();
            
            // Setup event listeners
            setupEventListeners();
            
            // Section toggles
            initSectionToggles();
            
            // Apply Telegram theme if available
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
            }
            
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
        // Back button
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', () => {
                window.location.href = '/wtb/html/panel.html';
            });
        }
        
        // Save all
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', saveAll);
        }
        
        // Load font
        if (elements.loadFontBtn) {
            elements.loadFontBtn.addEventListener('click', loadFont);
        }
        
        // Font controls - update preview
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
        
        // Text color
        if (elements.textColor) {
            elements.textColor.addEventListener('input', (e) => {
                if (elements.textColorHex) {
                    elements.textColorHex.value = e.target.value;
                }
                updatePreview();
            });
        }
        
        if (elements.textColorHex) {
            elements.textColorHex.addEventListener('input', (e) => {
                const hex = e.target.value;
                if (/^#[0-9A-F]{6}$/i.test(hex)) {
                    if (elements.textColor) {
                        elements.textColor.value = hex;
                    }
                    updatePreview();
                }
            });
        }
        
        // Preview text - debounced update
        const debouncedUpdate = debounce(updatePreview, 300);
        
        if (elements.previewText) {
            elements.previewText.addEventListener('input', debouncedUpdate);
        }
        
        if (elements.previewSubtext) {
            elements.previewSubtext.addEventListener('input', debouncedUpdate);
        }
        
        // Template
        if (elements.saveTemplateBtn) {
            elements.saveTemplateBtn.addEventListener('click', saveTemplate);
        }
        
        if (elements.loadTemplateBtn) {
            elements.loadTemplateBtn.addEventListener('click', loadTemplate);
        }
        
        if (elements.copyCodeBtn) {
            elements.copyCodeBtn.addEventListener('click', copyTemplateCode);
        }
        
        // Animation controls
        if (elements.playAnimation) {
            elements.playAnimation.addEventListener('click', playPreviewAnimation);
        }
        
        if (elements.pauseAnimation) {
            elements.pauseAnimation.addEventListener('click', pausePreviewAnimation);
        }
        
        if (elements.restartAnimation) {
            elements.restartAnimation.addEventListener('click', restartPreviewAnimation);
        }
        
        // Fullscreen
        if (elements.fullscreenPreview && elements.previewCanvas) {
            elements.fullscreenPreview.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    elements.previewCanvas.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space: Play/Pause
            if (e.key === ' ' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                if (isAnimating) {
                    pausePreviewAnimation();
                } else {
                    playPreviewAnimation();
                }
            }
            
            // Ctrl+S: Save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveAll();
            }
        });
    }
    
    // ==================== START ====================
    document.addEventListener('DOMContentLoaded', init);
    
})();
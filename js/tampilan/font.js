// ============================================
// FONT & ANIMATION STUDIO JAVASCRIPT - FIXED VERSION
// ============================================

(function() {
    'use strict';
    
    console.log('🎨 Font & Animation Studio - Starting...');

    // ==================== SIMPLE STATE OBJECT ====================
    const AppState = {
        website: null,
        currentFont: 'Inter',
        currentAnimation: 'none',
        previewText: 'Toko Online Premium'
    };

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        backToPanel: document.getElementById('backToPanel'),
        websiteBadge: document.getElementById('websiteBadge'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        checkTemplateBtn: document.getElementById('checkTemplateBtn'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        
        // Google Fonts
        googleFontGrid: document.getElementById('googleFontGrid'),
        googleFontSearch: document.getElementById('googleFontSearch'),
        applyGoogleFont: document.getElementById('applyGoogleFont'),
        
        // Dafont
        dafontUrl: document.getElementById('dafontUrl'),
        dafontFamily: document.getElementById('dafontFamily'),
        dafontFileUrl: document.getElementById('dafontFileUrl'),
        applyDafont: document.getElementById('applyDafont'),
        
        // Custom Font
        customFontCss: document.getElementById('customFontCss'),
        customFontFamily: document.getElementById('customFontFamily'),
        applyCustomFont: document.getElementById('applyCustomFont'),
        
        // Font Controls
        fontSize: document.getElementById('fontSize'),
        fontWeight: document.getElementById('fontWeight'),
        fontStyle: document.getElementById('fontStyle'),
        textColor: document.getElementById('textColor'),
        textColorHex: document.getElementById('textColorHex'),
        
        // Animation
        animationGrid: document.getElementById('animationGrid'),
        animDuration: document.getElementById('animDuration'),
        animDelay: document.getElementById('animDelay'),
        animIteration: document.getElementById('animIteration'),
        
        // Preview
        previewTextElement: document.getElementById('previewTextElement'),
        previewSubtext: document.getElementById('previewSubtext'),
        previewText: document.getElementById('previewText'),
        
        // Timeline
        playAnimation: document.getElementById('playAnimation'),
        pauseAnimation: document.getElementById('pauseAnimation'),
        stopAnimation: document.getElementById('stopAnimation'),
        
        // Quick Nav
        previewPopupBtn: document.getElementById('previewPopupBtn'),
        previewPopup: document.getElementById('previewPopup'),
        previewPopupClose: document.getElementById('previewPopupClose'),
        scrollTopBtn: document.getElementById('scrollTopBtn'),
        scrollBottomBtn: document.getElementById('scrollBottomBtn'),
        
        // Toast
        toastContainer: document.getElementById('toastContainer')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutToast 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                elements.loadingOverlay.style.display = 'none';
                elements.loadingOverlay.style.opacity = '1';
            }, 500);
        }
    }

    // ==================== INIT FUNCTION ====================
    function init() {
        console.log('🚀 Initializing Font Studio...');
        
        // Hide loading after 1 second
        setTimeout(hideLoading, 1000);
        
        // Get website from URL
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        if (elements.websiteBadge && endpoint) {
            elements.websiteBadge.textContent = '/' + endpoint;
        }
        
        // Render Google Fonts
        renderGoogleFonts();
        
        // Render Animations
        renderAnimations();
        
        // Setup Event Listeners
        setupEventListeners();
        
        console.log('✅ Font Studio Ready');
    }

    // ==================== GOOGLE FONTS ====================
    function renderGoogleFonts() {
        if (!elements.googleFontGrid) return;
        
        const fonts = [
            'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
            'Poppins', 'Raleway', 'Oswald', 'Merriweather', 'Playfair Display',
            'Nunito', 'Ubuntu', 'PT Sans', 'Source Sans Pro', 'Titillium Web'
        ];
        
        let html = '';
        fonts.forEach(font => {
            html += `
                <div class="font-preview-item" data-font="${font}">
                    <div class="font-preview-name">${font}</div>
                    <div class="font-preview-sample" style="font-family: '${font}', sans-serif">
                        Aa Bb Cc
                    </div>
                    <div class="font-preview-category">Sans Serif</div>
                </div>
            `;
        });
        
        elements.googleFontGrid.innerHTML = html;
    }

    // ==================== ANIMATIONS ====================
    function renderAnimations() {
        if (!elements.animationGrid) return;
        
        const animations = [
            { id: 'none', name: 'Tidak Ada', desc: 'Statis' },
            { id: 'fade', name: 'Fade', desc: 'Muncul & menghilang' },
            { id: 'slide', name: 'Slide', desc: 'Bergeser' },
            { id: 'bounce', name: 'Bounce', desc: 'Memantul' },
            { id: 'pulse', name: 'Pulse', desc: 'Berdenyut' },
            { id: 'shake', name: 'Shake', desc: 'Gemetar' },
            { id: 'glitch', name: 'Glitch', desc: 'Efek glitch' },
            { id: 'wave', name: 'Wave', desc: 'Bergelombang' },
            { id: 'rainbow', name: 'Rainbow', desc: 'Warna-warni' },
            { id: 'float', name: 'Float', desc: 'Melayang' }
        ];
        
        let html = '';
        animations.forEach(anim => {
            html += `
                <div class="animation-card" data-animation="${anim.id}">
                    <div class="animation-preview">Aa</div>
                    <div class="animation-info">
                        <span class="animation-name">${anim.name}</span>
                        <span class="animation-desc">${anim.desc}</span>
                    </div>
                </div>
            `;
        });
        
        elements.animationGrid.innerHTML = html;
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Back button
        if (elements.backToPanel) {
            elements.backToPanel.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/wtb/html/panel.html';
            });
        }
        
        // Save All button
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', () => {
                showToast('Fitur menyimpan akan segera tersedia', 'info');
            });
        }
        
        // Check Template button
        if (elements.checkTemplateBtn) {
            elements.checkTemplateBtn.addEventListener('click', () => {
                showToast('Template Manager - Coming Soon', 'info');
            });
        }
        
        // Save Template button
        if (elements.saveTemplateBtn) {
            elements.saveTemplateBtn.addEventListener('click', () => {
                showToast('Save Template - Coming Soon', 'info');
            });
        }
        
        // Font source tabs
        document.querySelectorAll('.source-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const source = this.dataset.source;
                document.querySelectorAll('.font-source-panel').forEach(p => {
                    p.classList.remove('active');
                });
                
                const panel = document.getElementById(source + 'FontPanel');
                if (panel) panel.classList.add('active');
            });
        });
        
        // Google Font selection
        document.querySelectorAll('.font-preview-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.font-preview-item').forEach(i => {
                    i.classList.remove('selected');
                });
                this.classList.add('selected');
                
                const font = this.dataset.font;
                if (elements.previewTextElement) {
                    elements.previewTextElement.style.fontFamily = `'${font}', sans-serif`;
                }
                AppState.currentFont = font;
            });
        });
        
        // Apply Google Font button
        if (elements.applyGoogleFont) {
            elements.applyGoogleFont.addEventListener('click', () => {
                const selected = document.querySelector('.font-preview-item.selected');
                if (selected) {
                    const font = selected.dataset.font;
                    showToast(`Font ${font} diterapkan`, 'success');
                } else {
                    showToast('Pilih font terlebih dahulu', 'warning');
                }
            });
        }
        
        // Apply Dafont button
        if (elements.applyDafont) {
            elements.applyDafont.addEventListener('click', () => {
                const url = elements.dafontUrl?.value;
                const family = elements.dafontFamily?.value;
                
                if (!url || !family) {
                    showToast('URL dan nama font wajib diisi', 'warning');
                    return;
                }
                
                if (elements.previewTextElement) {
                    elements.previewTextElement.style.fontFamily = `'${family}', sans-serif`;
                }
                showToast(`Font dari Dafont diterapkan`, 'success');
            });
        }
        
        // Apply Custom Font button
        if (elements.applyCustomFont) {
            elements.applyCustomFont.addEventListener('click', () => {
                const css = elements.customFontCss?.value;
                const family = elements.customFontFamily?.value;
                
                if (!css || !family) {
                    showToast('CSS dan font family wajib diisi', 'warning');
                    return;
                }
                
                if (elements.previewTextElement) {
                    elements.previewTextElement.style.fontFamily = family;
                }
                showToast('Custom font diterapkan', 'success');
            });
        }
        
        // Animation selection
        document.querySelectorAll('.animation-card').forEach(card => {
            card.addEventListener('click', function() {
                document.querySelectorAll('.animation-card').forEach(c => {
                    c.classList.remove('selected');
                });
                this.classList.add('selected');
                
                const animId = this.dataset.animation;
                AppState.currentAnimation = animId;
                
                // Apply animation to preview
                if (elements.previewTextElement) {
                    if (animId === 'none') {
                        elements.previewTextElement.style.animation = 'none';
                    } else {
                        elements.previewTextElement.style.animation = `${animId}Anim 2s infinite`;
                    }
                }
            });
        });
        
        // Preview text
        if (elements.previewText && elements.previewTextElement) {
            elements.previewText.addEventListener('input', (e) => {
                elements.previewTextElement.textContent = e.target.value || 'Toko Online Premium';
                AppState.previewText = e.target.value;
            });
        }
        
        // Font size
        if (elements.fontSize && elements.previewTextElement) {
            elements.fontSize.addEventListener('change', (e) => {
                elements.previewTextElement.style.fontSize = e.target.value + 'px';
            });
        }
        
        // Font weight
        if (elements.fontWeight && elements.previewTextElement) {
            elements.fontWeight.addEventListener('change', (e) => {
                elements.previewTextElement.style.fontWeight = e.target.value;
            });
        }
        
        // Font style
        if (elements.fontStyle && elements.previewTextElement) {
            elements.fontStyle.addEventListener('change', (e) => {
                elements.previewTextElement.style.fontStyle = e.target.value;
            });
        }
        
        // Text color
        if (elements.textColor && elements.previewTextElement) {
            elements.textColor.addEventListener('input', (e) => {
                elements.previewTextElement.style.color = e.target.value;
                if (elements.textColorHex) {
                    elements.textColorHex.value = e.target.value;
                }
            });
        }
        
        if (elements.textColorHex && elements.previewTextElement) {
            elements.textColorHex.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    elements.previewTextElement.style.color = e.target.value;
                    if (elements.textColor) {
                        elements.textColor.value = e.target.value;
                    }
                }
            });
        }
        
        // Animation controls
        if (elements.animDuration && elements.previewTextElement) {
            elements.animDuration.addEventListener('input', (e) => {
                const val = e.target.value;
                document.getElementById('animDurationValue').textContent = val + 's';
                
                if (AppState.currentAnimation !== 'none') {
                    elements.previewTextElement.style.animationDuration = val + 's';
                }
            });
        }
        
        if (elements.animDelay && elements.previewTextElement) {
            elements.animDelay.addEventListener('input', (e) => {
                const val = e.target.value;
                document.getElementById('animDelayValue').textContent = val + 's';
                
                if (AppState.currentAnimation !== 'none') {
                    elements.previewTextElement.style.animationDelay = val + 's';
                }
            });
        }
        
        // Play/Pause/Stop buttons
        if (elements.playAnimation && elements.previewTextElement) {
            elements.playAnimation.addEventListener('click', () => {
                if (AppState.currentAnimation !== 'none') {
                    elements.previewTextElement.style.animationPlayState = 'running';
                }
            });
        }
        
        if (elements.pauseAnimation && elements.previewTextElement) {
            elements.pauseAnimation.addEventListener('click', () => {
                elements.previewTextElement.style.animationPlayState = 'paused';
            });
        }
        
        if (elements.stopAnimation && elements.previewTextElement) {
            elements.stopAnimation.addEventListener('click', () => {
                elements.previewTextElement.style.animation = 'none';
                setTimeout(() => {
                    if (AppState.currentAnimation !== 'none') {
                        elements.previewTextElement.style.animation = `${AppState.currentAnimation}Anim 2s infinite`;
                    }
                }, 10);
            });
        }
        
        // Quick nav buttons
        if (elements.scrollTopBtn) {
            elements.scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        if (elements.scrollBottomBtn) {
            elements.scrollBottomBtn.addEventListener('click', () => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            });
        }
        
        // Preview popup
        if (elements.previewPopupBtn && elements.previewPopup) {
            elements.previewPopupBtn.addEventListener('click', () => {
                elements.previewPopup.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                const popupText = document.getElementById('previewPopupTextElement');
                if (popupText && elements.previewTextElement) {
                    popupText.textContent = elements.previewTextElement.textContent;
                    popupText.style.fontFamily = elements.previewTextElement.style.fontFamily;
                    popupText.style.fontSize = elements.previewTextElement.style.fontSize;
                    popupText.style.fontWeight = elements.previewTextElement.style.fontWeight;
                    popupText.style.color = elements.previewTextElement.style.color;
                }
                
                const popupFont = document.getElementById('popupFontInfo');
                if (popupFont) {
                    popupFont.textContent = AppState.currentFont;
                }
                
                const popupAnim = document.getElementById('popupAnimInfo');
                if (popupAnim) {
                    popupAnim.textContent = AppState.currentAnimation === 'none' ? 'Tidak Ada' : AppState.currentAnimation;
                }
            });
        }
        
        if (elements.previewPopupClose && elements.previewPopup) {
            elements.previewPopupClose.addEventListener('click', () => {
                elements.previewPopup.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        if (elements.previewPopup) {
            elements.previewPopup.addEventListener('click', (e) => {
                if (e.target === elements.previewPopup || e.target.classList.contains('preview-popup-overlay')) {
                    elements.previewPopup.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
        
        // Section toggles
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const icon = this.querySelector('.toggle-icon');
                
                if (content) {
                    content.classList.toggle('hidden');
                    if (icon) {
                        icon.style.transform = content.classList.contains('hidden') ? 'rotate(-90deg)' : '';
                    }
                }
            });
        });
    }

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
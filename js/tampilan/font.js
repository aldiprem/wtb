// ============================================
// FONT & ANIMATION STUDIO JAVASCRIPT
// File: js/tampilan/font.js
// Version: 1.0.0
// Author: System
// Description: Complete JavaScript for font and animation studio
// ============================================

(function() {
    'use strict';
    
    console.log('🎨 Font & Animation Studio - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    // Google Fonts API Key (free tier)
    const GOOGLE_FONTS_API_KEY = 'AIzaSyA7nJqZQF8QxQxQxQxQxQxQxQxQxQxQxQx'; // Ganti dengan API key Anda
    
    // Animation presets
    const ANIMATION_PRESETS = {
        fade: {
            name: 'Fade',
            description: 'Muncul dan menghilang perlahan',
            keyframes: `
                @keyframes fadeAnim {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
            `
        },
        slide: {
            name: 'Slide',
            description: 'Bergeser dari kiri ke kanan',
            keyframes: `
                @keyframes slideAnim {
                    0% { transform: translateX(-20px); opacity: 0.5; }
                    50% { transform: translateX(20px); opacity: 1; }
                    100% { transform: translateX(-20px); opacity: 0.5; }
                }
            `
        },
        bounce: {
            name: 'Bounce',
            description: 'Memantul seperti bola',
            keyframes: `
                @keyframes bounceAnim {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-30px); }
                }
            `
        },
        pulse: {
            name: 'Pulse',
            description: 'Berdenyut membesar dan mengecil',
            keyframes: `
                @keyframes pulseAnim {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `
        },
        shake: {
            name: 'Shake',
            description: 'Gemetar seperti digoyang',
            keyframes: `
                @keyframes shakeAnim {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
            `
        },
        glitch: {
            name: 'Glitch',
            description: 'Efek glitch digital',
            keyframes: `
                @keyframes glitchAnim {
                    0% { text-shadow: 2px 0 red, -2px 0 blue; }
                    25% { text-shadow: -2px 0 red, 2px 0 blue; }
                    50% { text-shadow: 2px 0 blue, -2px 0 red; }
                    75% { text-shadow: -2px 0 blue, 2px 0 red; }
                    100% { text-shadow: 2px 0 red, -2px 0 blue; }
                }
            `
        },
        wave: {
            name: 'Wave',
            description: 'Bergelombang seperti air',
            keyframes: `
                @keyframes waveAnim {
                    0% { transform: skew(0deg); }
                    20% { transform: skew(5deg); }
                    40% { transform: skew(-5deg); }
                    60% { transform: skew(3deg); }
                    80% { transform: skew(-3deg); }
                    100% { transform: skew(0deg); }
                }
            `
        },
        rainbow: {
            name: 'Rainbow',
            description: 'Warna berubah-ubah',
            keyframes: `
                @keyframes rainbowAnim {
                    0% { color: #ff0000; }
                    17% { color: #ff8800; }
                    33% { color: #ffff00; }
                    50% { color: #00ff00; }
                    67% { color: #0088ff; }
                    83% { color: #8800ff; }
                    100% { color: #ff0000; }
                }
            `
        },
        typing: {
            name: 'Typing',
            description: 'Efek seperti diketik',
            keyframes: `
                @keyframes typingAnim {
                    from { width: 0; }
                    to { width: 100%; }
                }
                .typing-container {
                    display: inline-block;
                    overflow: hidden;
                    white-space: nowrap;
                    border-right: 2px solid;
                    animation: typingAnim 3s steps(30, end) infinite, blink 0.75s step-end infinite;
                }
                @keyframes blink {
                    50% { border-color: transparent; }
                }
            `
        },
        float: {
            name: 'Float',
            description: 'Melayang naik turun',
            keyframes: `
                @keyframes floatAnim {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-15px); }
                    100% { transform: translateY(0px); }
                }
            `
        },
        heartbeat: {
            name: 'Heartbeat',
            description: 'Berdebar seperti jantung',
            keyframes: `
                @keyframes heartbeatAnim {
                    0% { transform: scale(1); }
                    25% { transform: scale(1.1); }
                    50% { transform: scale(1); }
                    75% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `
        },
        rotate: {
            name: 'Rotate',
            description: 'Berputar 360 derajat',
            keyframes: `
                @keyframes rotateAnim {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `
        },
        flip: {
            name: 'Flip',
            description: 'Membalik 3D',
            keyframes: `
                @keyframes flipAnim {
                    0% { transform: perspective(400px) rotateY(0); }
                    50% { transform: perspective(400px) rotateY(180deg); }
                    100% { transform: perspective(400px) rotateY(360deg); }
                }
            `
        },
        zoom: {
            name: 'Zoom',
            description: 'Membesar dan mengecil',
            keyframes: `
                @keyframes zoomAnim {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.5); }
                    100% { transform: scale(1); }
                }
            `
        },
        blur: {
            name: 'Blur',
            description: 'Efek blur berubah',
            keyframes: `
                @keyframes blurAnim {
                    0% { filter: blur(0px); }
                    50% { filter: blur(5px); }
                    100% { filter: blur(0px); }
                }
            `
        },
        spin3d: {
            name: 'Spin 3D',
            description: 'Berputar dalam 3D',
            keyframes: `
                @keyframes spin3dAnim {
                    0% { transform: rotateX(0deg) rotateY(0deg); }
                    100% { transform: rotateX(360deg) rotateY(360deg); }
                }
            `
        }
    };

    // ==================== STATE MANAGEMENT ====================
    class StateManager {
        constructor() {
            this.state = {
                website: null,
                currentFont: {
                    family: 'Inter, sans-serif',
                    source: 'google',
                    url: null,
                    weight: 400,
                    style: 'normal',
                    size: 16,
                    transform: 'none',
                    letterSpacing: 0,
                    wordSpacing: 0,
                    lineHeight: 1.5,
                    color: '#ffffff',
                    shadow: {
                        enabled: false,
                        x: 2,
                        y: 2,
                        blur: 4,
                        color: '#000000',
                        opacity: 0.5
                    },
                    stroke: {
                        width: 0,
                        color: '#000000'
                    },
                    gradient: {
                        type: 'none',
                        colors: ['#ff6b6b', '#4ecdc4'],
                        angle: 45
                    },
                    background: {
                        type: 'none',
                        color: '#1a1a1a',
                        gradient: null,
                        image: null
                    }
                },
                currentAnimation: {
                    id: 'none',
                    name: 'Tidak Ada',
                    duration: 2,
                    delay: 0,
                    iteration: 'infinite',
                    direction: 'normal',
                    fillMode: 'both',
                    easing: 'ease',
                    transform: {
                        scaleX: 1,
                        scaleY: 1,
                        rotate: 0,
                        skewX: 0,
                        skewY: 0,
                        translateX: 0,
                        translateY: 0
                    },
                    opacity: 1,
                    filter: {
                        blur: 0,
                        brightness: 1,
                        contrast: 1,
                        grayscale: 0,
                        hue: 0,
                        saturate: 1,
                        sepia: 0,
                        invert: 0
                    },
                    keyframes: [
                        { position: 0, properties: {} },
                        { position: 25, properties: {} },
                        { position: 50, properties: {} },
                        { position: 75, properties: {} },
                        { position: 100, properties: {} }
                    ],
                    events: {
                        start: [],
                        end: [],
                        iteration: [],
                        cancel: []
                    }
                },
                preview: {
                    text: 'Toko Online Premium',
                    subtext: 'dengan Layanan Terbaik 24/7',
                    align: 'center',
                    device: 'desktop',
                    size: 16,
                    zoom: 100,
                    background: 'dark',
                    customBg: null,
                    isPlaying: false,
                    currentTime: 0,
                    loop: true
                },
                recentFonts: [],
                savedPresets: [],
                history: [],
                historyIndex: -1,
                isLoading: false,
                isFullscreen: false,
                selectedKeyframe: 0
            };
            
            this.listeners = new Set();
        }
        
        getState() {
            return this.state;
        }
        
        setState(newState) {
            this.state = { ...this.state, ...newState };
            this.notifyListeners();
        }
        
        updateState(path, value) {
            const keys = path.split('.');
            let current = this.state;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            this.notifyListeners();
        }
        
        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        }
        
        notifyListeners() {
            this.listeners.forEach(listener => listener(this.state));
        }
        
        pushToHistory() {
            const history = this.state.history.slice(0, this.state.historyIndex + 1);
            history.push(JSON.parse(JSON.stringify(this.state)));
            
            if (history.length > 50) history.shift();
            
            this.state.history = history;
            this.state.historyIndex = history.length - 1;
            this.notifyListeners();
        }
        
        undo() {
            if (this.state.historyIndex > 0) {
                this.state.historyIndex--;
                this.state = JSON.parse(JSON.stringify(
                    this.state.history[this.state.historyIndex]
                ));
                this.notifyListeners();
            }
        }
        
        redo() {
            if (this.state.historyIndex < this.state.history.length - 1) {
                this.state.historyIndex++;
                this.state = JSON.parse(JSON.stringify(
                    this.state.history[this.state.historyIndex]
                ));
                this.notifyListeners();
            }
        }
    }

    // ==================== DOM ELEMENTS ====================
    class DomElements {
        constructor() {
            this.elements = {};
            this.init();
        }
        
        init() {
            // Loading
            this.elements.loadingOverlay = document.getElementById('loadingOverlay');
            
            // Header
            this.elements.backToPanel = document.getElementById('backToPanel');
            this.elements.websiteBadge = document.getElementById('websiteBadge');
            this.elements.saveAllBtn = document.getElementById('saveAllBtn');
            
            // Font Source Tabs
            this.elements.sourceTabs = document.querySelectorAll('.source-tab');
            this.elements.fontSourcePanels = document.querySelectorAll('.font-source-panel');
            
            // Google Fonts
            this.elements.googleFontSearch = document.getElementById('googleFontSearch');
            this.elements.googleFontGrid = document.getElementById('googleFontGrid');
            this.elements.applyGoogleFont = document.getElementById('applyGoogleFont');
            
            // Dafont
            this.elements.dafontUrl = document.getElementById('dafontUrl');
            this.elements.dafontFamily = document.getElementById('dafontFamily');
            this.elements.dafontFileUrl = document.getElementById('dafontFileUrl');
            this.elements.applyDafont = document.getElementById('applyDafont');
            
            // Custom Font
            this.elements.customFontCss = document.getElementById('customFontCss');
            this.elements.customFontFamily = document.getElementById('customFontFamily');
            this.elements.applyCustomFont = document.getElementById('applyCustomFont');
            
            // Font Style Controls
            this.elements.fontWeight = document.getElementById('fontWeight');
            this.elements.fontStyle = document.getElementById('fontStyle');
            this.elements.fontSize = document.getElementById('fontSize');
            this.elements.transformBtns = document.querySelectorAll('[data-transform]');
            this.elements.letterSpacing = document.getElementById('letterSpacing');
            this.elements.letterSpacingValue = document.getElementById('letterSpacingValue');
            this.elements.wordSpacing = document.getElementById('wordSpacing');
            this.elements.wordSpacingValue = document.getElementById('wordSpacingValue');
            this.elements.lineHeight = document.getElementById('lineHeight');
            this.elements.lineHeightValue = document.getElementById('lineHeightValue');
            
            // Shadow Controls
            this.elements.shadowX = document.getElementById('shadowX');
            this.elements.shadowY = document.getElementById('shadowY');
            this.elements.shadowBlur = document.getElementById('shadowBlur');
            this.elements.shadowColor = document.getElementById('shadowColor');
            this.elements.shadowOpacity = document.getElementById('shadowOpacity');
            this.elements.toggleShadow = document.getElementById('toggleShadow');
            
            // Stroke Controls
            this.elements.strokeWidth = document.getElementById('strokeWidth');
            this.elements.strokeColor = document.getElementById('strokeColor');
            this.elements.strokeValue = document.getElementById('strokeValue');
            
            // Gradient Controls
            this.elements.gradientType = document.getElementById('gradientType');
            this.elements.gradientColors = document.getElementById('gradientColors');
            this.elements.gradientAngle = document.getElementById('gradientAngle');
            
            // Background Controls
            this.elements.bgType = document.getElementById('bgType');
            this.elements.bgControls = document.getElementById('bgControls');
            
            // Animation Grid
            this.elements.animationGrid = document.getElementById('animationGrid');
            
            // Timeline Controls
            this.elements.animDuration = document.getElementById('animDuration');
            this.elements.animDurationValue = document.getElementById('animDurationValue');
            this.elements.animDelay = document.getElementById('animDelay');
            this.elements.animDelayValue = document.getElementById('animDelayValue');
            this.elements.animIteration = document.getElementById('animIteration');
            this.elements.animDirection = document.getElementById('animDirection');
            this.elements.animFillMode = document.getElementById('animFillMode');
            
            // Easing
            this.elements.easingBtns = document.querySelectorAll('.easing-btn');
            this.elements.customEasing = document.getElementById('customEasing');
            this.elements.applyCustomEasing = document.getElementById('applyCustomEasing');
            
            // Transform Controls
            this.elements.scaleX = document.getElementById('scaleX');
            this.elements.scaleXValue = document.getElementById('scaleXValue');
            this.elements.scaleY = document.getElementById('scaleY');
            this.elements.scaleYValue = document.getElementById('scaleYValue');
            this.elements.rotate = document.getElementById('rotate');
            this.elements.rotateValue = document.getElementById('rotateValue');
            this.elements.skewX = document.getElementById('skewX');
            this.elements.skewXValue = document.getElementById('skewXValue');
            this.elements.skewY = document.getElementById('skewY');
            this.elements.skewYValue = document.getElementById('skewYValue');
            this.elements.translateX = document.getElementById('translateX');
            this.elements.translateXValue = document.getElementById('translateXValue');
            this.elements.translateY = document.getElementById('translateY');
            this.elements.translateYValue = document.getElementById('translateYValue');
            
            // Filter Controls
            this.elements.filterBlur = document.getElementById('filterBlur');
            this.elements.filterBlurValue = document.getElementById('filterBlurValue');
            this.elements.filterBrightness = document.getElementById('filterBrightness');
            this.elements.filterBrightnessValue = document.getElementById('filterBrightnessValue');
            this.elements.filterContrast = document.getElementById('filterContrast');
            this.elements.filterContrastValue = document.getElementById('filterContrastValue');
            this.elements.filterGrayscale = document.getElementById('filterGrayscale');
            this.elements.filterGrayscaleValue = document.getElementById('filterGrayscaleValue');
            this.elements.filterHue = document.getElementById('filterHue');
            this.elements.filterHueValue = document.getElementById('filterHueValue');
            this.elements.filterSaturate = document.getElementById('filterSaturate');
            this.elements.filterSaturateValue = document.getElementById('filterSaturateValue');
            this.elements.filterSepia = document.getElementById('filterSepia');
            this.elements.filterSepiaValue = document.getElementById('filterSepiaValue');
            this.elements.filterInvert = document.getElementById('filterInvert');
            this.elements.filterInvertValue = document.getElementById('filterInvertValue');
            
            // Opacity
            this.elements.opacity = document.getElementById('opacity');
            this.elements.opacityValue = document.getElementById('opacityValue');
            
            // Events
            this.elements.eventStart = document.getElementById('eventStart');
            this.elements.eventEnd = document.getElementById('eventEnd');
            this.elements.eventIteration = document.getElementById('eventIteration');
            this.elements.eventCancel = document.getElementById('eventCancel');
            this.elements.eventActions = document.querySelectorAll('.event-action');
            
            // Presets
            this.elements.presetName = document.getElementById('presetName');
            this.elements.savePreset = document.getElementById('savePreset');
            this.elements.presetList = document.getElementById('presetList');
            
            // Keyframe Timeline
            this.elements.keyframeTimeline = document.getElementById('keyframeTimeline');
            this.elements.timelineTrack = document.getElementById('timelineTrack');
            this.elements.keyframePosition = document.getElementById('keyframePosition');
            this.elements.keyframePosValue = document.getElementById('keyframePosValue');
            this.elements.addKeyframe = document.getElementById('addKeyframe');
            this.elements.keyframeProperties = document.getElementById('keyframeProperties');
            
            // Text Editor
            this.elements.previewText = document.getElementById('previewText');
            this.elements.alignBtns = document.querySelectorAll('.align-btn');
            this.elements.textColor = document.getElementById('textColor');
            this.elements.textColorHex = document.getElementById('textColorHex');
            this.elements.resetAllBtn = document.getElementById('resetAllBtn');
            
            // Preview
            this.elements.previewSize = document.getElementById('previewSize');
            this.elements.previewDevice = document.getElementById('previewDevice');
            this.elements.fullscreenPreview = document.getElementById('fullscreenPreview');
            this.elements.previewFrame = document.getElementById('previewFrame');
            this.elements.previewTextElement = document.getElementById('previewTextElement');
            this.elements.previewSubtext = document.getElementById('previewSubtext');
            
            // Timeline Visualizer
            this.elements.timelineTime = document.getElementById('timelineTime');
            this.elements.timelineProgress = document.getElementById('timelineProgress');
            this.elements.timelineMarker = document.getElementById('timelineMarker');
            this.elements.playAnimation = document.getElementById('playAnimation');
            this.elements.pauseAnimation = document.getElementById('pauseAnimation');
            this.elements.stopAnimation = document.getElementById('stopAnimation');
            this.elements.restartAnimation = document.getElementById('restartAnimation');
            this.elements.loopAnimation = document.getElementById('loopAnimation');
            
            // Preview Settings
            this.elements.bgBtns = document.querySelectorAll('.bg-btn');
            this.elements.customBgBtn = document.getElementById('customBgBtn');
            this.elements.zoomOut = document.getElementById('zoomOut');
            this.elements.zoomIn = document.getElementById('zoomIn');
            this.elements.resetZoom = document.getElementById('resetZoom');
            this.elements.zoomLevel = document.getElementById('zoomLevel');
            
            // Properties Panel
            this.elements.cssCode = document.getElementById('cssCode');
            this.elements.copyCssBtn = document.getElementById('copyCssBtn');
            this.elements.infoFamily = document.getElementById('infoFamily');
            this.elements.infoWeight = document.getElementById('infoWeight');
            this.elements.infoStyle = document.getElementById('infoStyle');
            this.elements.infoSize = document.getElementById('infoSize');
            this.elements.infoLineHeight = document.getElementById('infoLineHeight');
            this.elements.infoCharset = document.getElementById('infoCharset');
            
            this.elements.statCurrent = document.getElementById('statCurrent');
            this.elements.statDuration = document.getElementById('statDuration');
            this.elements.statDelay = document.getElementById('statDelay');
            this.elements.statIteration = document.getElementById('statIteration');
            this.elements.statDirection = document.getElementById('statDirection');
            this.elements.statEasing = document.getElementById('statEasing');
            this.elements.statKeyframes = document.getElementById('statKeyframes');
            
            this.elements.recentFonts = document.getElementById('recentFonts');
            this.elements.characterMap = document.getElementById('characterMap');
            this.elements.expandChars = document.getElementById('expandChars');
            this.elements.weightsPreview = document.getElementById('weightsPreview');
            
            this.elements.exportCSS = document.getElementById('exportCSS');
            this.elements.exportJSON = document.getElementById('exportJSON');
            this.elements.exportHTML = document.getElementById('exportHTML');
            this.elements.exportPreview = document.getElementById('exportPreview');
            
            // Modals
            this.elements.customBgModal = document.getElementById('customBgModal');
            this.elements.closeBgModal = document.getElementById('closeBgModal');
            this.elements.cancelBgModal = document.getElementById('cancelBgModal');
            this.elements.applyBgModal = document.getElementById('applyBgModal');
            this.elements.modalBgType = document.getElementById('modalBgType');
            this.elements.modalBgColor = document.getElementById('modalBgColor');
            this.elements.modalBgGradient = document.getElementById('modalBgGradient');
            this.elements.modalBgImage = document.getElementById('modalBgImage');
            
            this.elements.savePresetModal = document.getElementById('savePresetModal');
            this.elements.closePresetModal = document.getElementById('closePresetModal');
            this.elements.cancelPresetModal = document.getElementById('cancelPresetModal');
            this.elements.confirmSavePreset = document.getElementById('confirmSavePreset');
            this.elements.modalPresetName = document.getElementById('modalPresetName');
            this.elements.modalPresetCategory = document.getElementById('modalPresetCategory');
            this.elements.modalPresetDesc = document.getElementById('modalPresetDesc');
            this.elements.modalPresetGlobal = document.getElementById('modalPresetGlobal');
            
            this.elements.eventActionModal = document.getElementById('eventActionModal');
            this.elements.closeEventModal = document.getElementById('closeEventModal');
            this.elements.cancelEventModal = document.getElementById('cancelEventModal');
            this.elements.addEventAction = document.getElementById('addEventAction');
            this.elements.eventActionType = document.getElementById('eventActionType');
            this.elements.eventSpeedGroup = document.getElementById('eventSpeedGroup');
            this.elements.eventSpeed = document.getElementById('eventSpeed');
            this.elements.eventColorGroup = document.getElementById('eventColorGroup');
            this.elements.eventColor = document.getElementById('eventColor');
            this.elements.eventMessageGroup = document.getElementById('eventMessageGroup');
            this.elements.eventMessage = document.getElementById('eventMessage');
            
            // Toast
            this.elements.toastContainer = document.getElementById('toastContainer');
            
            // Section Toggles
            this.elements.sectionHeaders = document.querySelectorAll('.section-header');
        }
        
        get(id) {
            return this.elements[id] || document.getElementById(id);
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    class Utils {
        static showToast(message, type = 'info', duration = 3000) {
            const toastContainer = document.getElementById('toastContainer');
            if (!toastContainer) return;
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            
            const icon = {
                success: 'check-circle',
                error: 'exclamation-circle',
                warning: 'exclamation-triangle',
                info: 'info-circle'
            }[type] || 'info-circle';
            
            toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
            
            toastContainer.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'fadeOutToast 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        static showLoading(show = true) {
            const loading = document.getElementById('loadingOverlay');
            if (loading) {
                loading.style.display = show ? 'flex' : 'none';
            }
        }
        
        static vibrate(duration = 20) {
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(duration);
            }
        }
        
        static formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        
        static escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        static debounce(func, wait) {
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
        
        static throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
        
        static generateId() {
            return Date.now() + Math.random().toString(36).substr(2, 9);
        }
        
        static copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copied to clipboard!', 'success');
            }).catch(() => {
                this.showToast('Failed to copy', 'error');
            });
        }
        
        static formatDate(date) {
            return new Date(date).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        static rgbToHex(r, g, b) {
            return '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        }
        
        static hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }
        
        static rgbaToString(r, g, b, a) {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        
        static getContrastColor(hexcolor) {
            const rgb = this.hexToRgb(hexcolor);
            if (!rgb) return '#ffffff';
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            return luminance > 0.5 ? '#000000' : '#ffffff';
        }
        
        static isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch (_) {
                return false;
            }
        }
        
        static isValidHex(color) {
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
        }
        
        static parseCssFont(css) {
            const match = css.match(/font-family:\s*['"]?([^'";]+)['"]?/);
            return match ? match[1].trim() : null;
        }
        
        static generateCSS(state) {
            const font = state.currentFont;
            const anim = state.currentAnimation;
            
            let css = `/* Font & Animation CSS */\n\n`;
            
            // Font styles
            css += `.preview-text {\n`;
            css += `    font-family: ${font.family};\n`;
            css += `    font-size: ${font.size}px;\n`;
            css += `    font-weight: ${font.weight};\n`;
            css += `    font-style: ${font.style};\n`;
            css += `    color: ${font.color};\n`;
            css += `    text-align: ${state.preview.align};\n`;
            css += `    letter-spacing: ${font.letterSpacing}px;\n`;
            css += `    word-spacing: ${font.wordSpacing}px;\n`;
            css += `    line-height: ${font.lineHeight};\n`;
            css += `    text-transform: ${font.transform};\n`;
            
            if (font.shadow.enabled) {
                css += `    text-shadow: ${font.shadow.x}px ${font.shadow.y}px ${font.shadow.blur}px rgba(${font.shadow.color}, ${font.shadow.opacity});\n`;
            }
            
            if (font.stroke.width > 0) {
                css += `    -webkit-text-stroke: ${font.stroke.width}px ${font.stroke.color};\n`;
            }
            
            if (font.gradient.type !== 'none') {
                const colors = font.gradient.colors.join(', ');
                if (font.gradient.type === 'linear') {
                    css += `    background: linear-gradient(${font.gradient.angle}deg, ${colors});\n`;
                } else {
                    css += `    background: radial-gradient(circle, ${colors});\n`;
                }
                css += `    -webkit-background-clip: text;\n`;
                css += `    -webkit-text-fill-color: transparent;\n`;
            }
            
            const filter = [];
            if (anim.filter.blur > 0) filter.push(`blur(${anim.filter.blur}px)`);
            if (anim.filter.brightness !== 1) filter.push(`brightness(${anim.filter.brightness})`);
            if (anim.filter.contrast !== 1) filter.push(`contrast(${anim.filter.contrast})`);
            if (anim.filter.grayscale > 0) filter.push(`grayscale(${anim.filter.grayscale})`);
            if (anim.filter.hue > 0) filter.push(`hue-rotate(${anim.filter.hue}deg)`);
            if (anim.filter.saturate !== 1) filter.push(`saturate(${anim.filter.saturate})`);
            if (anim.filter.sepia > 0) filter.push(`sepia(${anim.filter.sepia})`);
            if (anim.filter.invert > 0) filter.push(`invert(${anim.filter.invert})`);
            
            if (filter.length > 0) {
                css += `    filter: ${filter.join(' ')};\n`;
            }
            
            const transform = [];
            if (anim.transform.scaleX !== 1 || anim.transform.scaleY !== 1) {
                transform.push(`scale(${anim.transform.scaleX}, ${anim.transform.scaleY})`);
            }
            if (anim.transform.rotate !== 0) transform.push(`rotate(${anim.transform.rotate}deg)`);
            if (anim.transform.skewX !== 0 || anim.transform.skewY !== 0) {
                transform.push(`skew(${anim.transform.skewX}deg, ${anim.transform.skewY}deg)`);
            }
            if (anim.transform.translateX !== 0 || anim.transform.translateY !== 0) {
                transform.push(`translate(${anim.transform.translateX}px, ${anim.transform.translateY}px)`);
            }
            
            if (transform.length > 0) {
                css += `    transform: ${transform.join(' ')};\n`;
            }
            
            if (anim.opacity !== 1) {
                css += `    opacity: ${anim.opacity};\n`;
            }
            
            if (anim.id !== 'none') {
                css += `    animation: ${anim.id}Anim ${anim.duration}s ${anim.easing} ${anim.delay}s ${anim.iteration} ${anim.direction} ${anim.fillMode};\n`;
            }
            
            css += `}\n\n`;
            
            // Keyframes
            if (anim.id !== 'none' && ANIMATION_PRESETS[anim.id]) {
                css += ANIMATION_PRESETS[anim.id].keyframes;
            }
            
            return css;
        }
    }

    // ==================== API FUNCTIONS ====================
    class ApiClient {
        constructor(baseUrl) {
            this.baseUrl = baseUrl;
        }
        
        async fetchWithRetry(url, options, retries = MAX_RETRIES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(url, {
                    ...options,
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    return this.fetchWithRetry(url, options, retries - 1);
                }
                throw error;
            }
        }
        
        async loadWebsite(endpoint) {
            try {
                const data = await this.fetchWithRetry(
                    `${this.baseUrl}/api/websites/endpoint/${endpoint}`,
                    { method: 'GET' }
                );
                
                if (data.success && data.website) {
                    return data.website;
                }
                throw new Error('Website not found');
            } catch (error) {
                console.error('❌ Error loading website:', error);
                throw error;
            }
        }
        
        async loadTampilan(websiteId) {
            try {
                const data = await this.fetchWithRetry(
                    `${this.baseUrl}/api/tampilan/${websiteId}`,
                    { method: 'GET' }
                );
                
                if (data.success && data.tampilan) {
                    return data.tampilan;
                }
                return null;
            } catch (error) {
                console.error('❌ Error loading tampilan:', error);
                return null;
            }
        }
        
        async saveFontAnim(websiteId, data) {
            try {
                const response = await this.fetchWithRetry(
                    `${this.baseUrl}/api/tampilan/${websiteId}/font-anim`,
                    {
                        method: 'POST',
                        body: JSON.stringify(data)
                    }
                );
                
                return response.success;
            } catch (error) {
                console.error('❌ Error saving font anim:', error);
                throw error;
            }
        }
        
        async loadGoogleFonts(query = '') {
            try {
                // Simulasi data Google Fonts (tanpa API key)
                const fonts = [
                    { family: 'Roboto', category: 'sans-serif', variants: ['100', '300', '400', '500', '700', '900'] },
                    { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '600', '700', '800'] },
                    { family: 'Lato', category: 'sans-serif', variants: ['100', '300', '400', '700', '900'] },
                    { family: 'Montserrat', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                    { family: 'Poppins', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                    { family: 'Roboto Condensed', category: 'sans-serif', variants: ['300', '400', '700'] },
                    { family: 'Source Sans Pro', category: 'sans-serif', variants: ['200', '300', '400', '600', '700', '900'] },
                    { family: 'Raleway', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                    { family: 'Merriweather', category: 'serif', variants: ['300', '400', '700', '900'] },
                    { family: 'Playfair Display', category: 'serif', variants: ['400', '500', '600', '700', '800', '900'] },
                    { family: 'Oswald', category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700'] },
                    { family: 'Noto Sans', category: 'sans-serif', variants: ['400', '700'] },
                    { family: 'Ubuntu', category: 'sans-serif', variants: ['300', '400', '500', '700'] },
                    { family: 'Nunito', category: 'sans-serif', variants: ['200', '300', '400', '600', '700', '800', '900'] },
                    { family: 'Quicksand', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
                    { family: 'Titillium Web', category: 'sans-serif', variants: ['200', '300', '400', '600', '700', '900'] },
                    { family: 'PT Sans', category: 'sans-serif', variants: ['400', '700'] },
                    { family: 'Fira Sans', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                    { family: 'Dosis', category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700', '800'] },
                    { family: 'Indie Flower', category: 'handwriting', variants: ['400'] },
                    { family: 'Pacifico', category: 'handwriting', variants: ['400'] },
                    { family: 'Satisfy', category: 'handwriting', variants: ['400'] },
                    { family: 'Great Vibes', category: 'handwriting', variants: ['400'] },
                    { family: 'Caveat', category: 'handwriting', variants: ['400', '500', '600', '700'] },
                    { family: 'Amatic SC', category: 'handwriting', variants: ['400', '700'] }
                ];
                
                if (query) {
                    return fonts.filter(f => 
                        f.family.toLowerCase().includes(query.toLowerCase())
                    );
                }
                
                return fonts;
            } catch (error) {
                console.error('❌ Error loading Google Fonts:', error);
                return [];
            }
        }
    }

    // ==================== FONT MANAGER ====================
    class FontManager {
        constructor(state, dom, api, utils) {
            this.state = state;
            this.dom = dom;
            this.api = api;
            this.utils = utils;
            this.init();
        }
        
        init() {
            this.loadGoogleFonts();
            this.setupEventListeners();
        }
        
        async loadGoogleFonts(query = '') {
            const fonts = await this.api.loadGoogleFonts(query);
            this.renderGoogleFonts(fonts);
        }
        
        renderGoogleFonts(fonts) {
            const grid = this.dom.get('googleFontGrid');
            if (!grid) return;
            
            let html = '';
            fonts.slice(0, 20).forEach(font => {
                const isSelected = this.state.state.currentFont.family.includes(font.family);
                html += `
                    <div class="font-preview-item ${isSelected ? 'selected' : ''}" 
                         data-font="${font.family}" 
                         data-category="${font.category}">
                        <div class="font-preview-name">${font.family}</div>
                        <div class="font-preview-sample" style="font-family: '${font.family}', ${font.category}">
                            Aa Bb Cc
                        </div>
                        <div class="font-preview-category">${font.category}</div>
                    </div>
                `;
            });
            
            grid.innerHTML = html;
            
            grid.querySelectorAll('.font-preview-item').forEach(item => {
                item.addEventListener('click', () => {
                    const font = item.dataset.font;
                    const category = item.dataset.category;
                    this.selectGoogleFont(font, category);
                });
            });
        }
        
        selectGoogleFont(font, category) {
            const family = `'${font}', ${category}`;
            const url = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
            
            this.loadFont(font, url);
            this.state.updateState('currentFont.family', family);
            this.state.updateState('currentFont.source', 'google');
            this.state.updateState('currentFont.url', url);
            
            this.dom.get('googleFontGrid').querySelectorAll('.font-preview-item').forEach(item => {
                item.classList.remove('selected');
                if (item.dataset.font === font) {
                    item.classList.add('selected');
                }
            });
            
            this.addToRecentFonts({
                name: font,
                family: family,
                source: 'Google Fonts'
            });
            
            this.updatePreview();
            this.utils.showToast(`Font ${font} diterapkan`, 'success');
            this.utils.vibrate();
        }
        
        async applyDafont() {
            const url = this.dom.get('dafontUrl')?.value;
            const family = this.dom.get('dafontFamily')?.value;
            const fileUrl = this.dom.get('dafontFileUrl')?.value;
            
            if (!url || !family) {
                this.utils.showToast('URL dan nama font wajib diisi', 'warning');
                return;
            }
            
            if (!this.utils.isValidUrl(url)) {
                this.utils.showToast('URL tidak valid', 'error');
                return;
            }
            
            this.utils.showLoading(true);
            
            try {
                // Simulasi load font dari dafont
                const fontFamily = `'${family}', sans-serif`;
                
                if (fileUrl && this.utils.isValidUrl(fileUrl)) {
                    const css = `
                        @font-face {
                            font-family: '${family}';
                            src: url('${fileUrl}') format('woff2');
                            font-weight: normal;
                            font-style: normal;
                        }
                    `;
                    
                    const style = document.createElement('style');
                    style.textContent = css;
                    document.head.appendChild(style);
                }
                
                this.state.updateState('currentFont.family', fontFamily);
                this.state.updateState('currentFont.source', 'dafont');
                this.state.updateState('currentFont.url', url);
                
                this.addToRecentFonts({
                    name: family,
                    family: fontFamily,
                    source: 'Dafont.com'
                });
                
                this.updatePreview();
                this.utils.showToast(`Font ${family} dari Dafont diterapkan`, 'success');
                
            } catch (error) {
                this.utils.showToast('Gagal memuat font dari Dafont', 'error');
            } finally {
                this.utils.showLoading(false);
            }
        }
        
        applyCustomFont() {
            const css = this.dom.get('customFontCss')?.value;
            const family = this.dom.get('customFontFamily')?.value;
            
            if (!css || !family) {
                this.utils.showToast('CSS dan font family wajib diisi', 'warning');
                return;
            }
            
            try {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
                
                this.state.updateState('currentFont.family', family);
                this.state.updateState('currentFont.source', 'custom');
                
                this.addToRecentFonts({
                    name: this.utils.parseCssFont(css) || family,
                    family: family,
                    source: 'Custom CSS'
                });
                
                this.updatePreview();
                this.utils.showToast('Custom font diterapkan', 'success');
                
            } catch (error) {
                this.utils.showToast('Gagal memuat custom font', 'error');
            }
        }
        
        loadFont(name, url) {
            if (!url) return;
            
            const linkId = `font-${name.replace(/\s+/g, '-')}`;
            if (document.getElementById(linkId)) return;
            
            const link = document.createElement('link');
            link.id = linkId;
            link.href = url;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        
        addToRecentFonts(font) {
            const recent = this.state.state.recentFonts;
            const exists = recent.find(f => f.name === font.name);
            
            if (!exists) {
                recent.unshift(font);
                if (recent.length > 10) recent.pop();
                this.state.updateState('recentFonts', recent);
                this.renderRecentFonts();
            }
        }
        
        renderRecentFonts() {
            const container = this.dom.get('recentFonts');
            if (!container) return;
            
            const recent = this.state.state.recentFonts;
            
            if (recent.length === 0) {
                container.innerHTML = '<div class="text-muted text-center p-3">Belum ada font yang digunakan</div>';
                return;
            }
            
            let html = '';
            recent.forEach(font => {
                html += `
                    <div class="recent-font-item" data-family="${font.family}">
                        <div class="recent-font-icon">
                            <span>Aa</span>
                        </div>
                        <div class="recent-font-info">
                            <div class="recent-font-name">${font.name}</div>
                            <div class="recent-font-source">${font.source}</div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            container.querySelectorAll('.recent-font-item').forEach(item => {
                item.addEventListener('click', () => {
                    const family = item.dataset.family;
                    this.state.updateState('currentFont.family', family);
                    this.updatePreview();
                    this.utils.vibrate();
                });
            });
        }
        
        updateFontStyle() {
            const weight = this.dom.get('fontWeight')?.value || 400;
            const style = this.dom.get('fontStyle')?.value || 'normal';
            const size = this.dom.get('fontSize')?.value || 16;
            const transform = this.getActiveTransform();
            const letterSpacing = parseFloat(this.dom.get('letterSpacing')?.value || 0);
            const wordSpacing = parseFloat(this.dom.get('wordSpacing')?.value || 0);
            const lineHeight = parseFloat(this.dom.get('lineHeight')?.value || 1.5);
            
            this.state.updateState('currentFont.weight', weight);
            this.state.updateState('currentFont.style', style);
            this.state.updateState('currentFont.size', parseInt(size));
            this.state.updateState('currentFont.transform', transform);
            this.state.updateState('currentFont.letterSpacing', letterSpacing);
            this.state.updateState('currentFont.wordSpacing', wordSpacing);
            this.state.updateState('currentFont.lineHeight', lineHeight);
            
            if (this.dom.get('letterSpacingValue')) {
                this.dom.get('letterSpacingValue').textContent = `${letterSpacing}px`;
            }
            if (this.dom.get('wordSpacingValue')) {
                this.dom.get('wordSpacingValue').textContent = `${wordSpacing}px`;
            }
            if (this.dom.get('lineHeightValue')) {
                this.dom.get('lineHeightValue').textContent = lineHeight.toFixed(1);
            }
            
            this.updatePreview();
        }
        
        getActiveTransform() {
            let active = 'none';
            this.dom.get('transformBtns')?.forEach(btn => {
                if (btn.classList.contains('active')) {
                    active = btn.dataset.transform;
                }
            });
            return active;
        }
        
        updateTextColor() {
            const color = this.dom.get('textColor')?.value || '#ffffff';
            const hex = this.dom.get('textColorHex');
            
            if (hex) hex.value = color;
            
            this.state.updateState('currentFont.color', color);
            this.updatePreview();
        }
        
        updateTextShadow() {
            const enabled = this.dom.get('toggleShadow')?.classList.contains('active');
            const x = parseFloat(this.dom.get('shadowX')?.value || 2);
            const y = parseFloat(this.dom.get('shadowY')?.value || 2);
            const blur = parseFloat(this.dom.get('shadowBlur')?.value || 4);
            const color = this.dom.get('shadowColor')?.value || '#000000';
            const opacity = parseFloat(this.dom.get('shadowOpacity')?.value || 0.5);
            
            this.state.updateState('currentFont.shadow.enabled', enabled);
            this.state.updateState('currentFont.shadow.x', x);
            this.state.updateState('currentFont.shadow.y', y);
            this.state.updateState('currentFont.shadow.blur', blur);
            this.state.updateState('currentFont.shadow.color', color);
            this.state.updateState('currentFont.shadow.opacity', opacity);
            
            this.updatePreview();
        }
        
        toggleShadow() {
            const btn = this.dom.get('toggleShadow');
            btn.classList.toggle('active');
            this.updateTextShadow();
        }
        
        updateTextStroke() {
            const width = parseFloat(this.dom.get('strokeWidth')?.value || 0);
            const color = this.dom.get('strokeColor')?.value || '#000000';
            
            this.state.updateState('currentFont.stroke.width', width);
            this.state.updateState('currentFont.stroke.color', color);
            
            if (this.dom.get('strokeValue')) {
                this.dom.get('strokeValue').textContent = `${width}px`;
            }
            
            this.updatePreview();
        }
        
        updateGradient() {
            const type = this.dom.get('gradientType')?.value || 'none';
            
            if (type === 'none') {
                this.state.updateState('currentFont.gradient.type', 'none');
                this.updatePreview();
                return;
            }
            
            const colors = [];
            this.dom.get('gradientColors')?.querySelectorAll('.gradient-color').forEach(input => {
                colors.push(input.value);
            });
            
            const angle = parseFloat(this.dom.get('gradientAngle')?.value || 45);
            
            this.state.updateState('currentFont.gradient.type', type);
            this.state.updateState('currentFont.gradient.colors', colors);
            this.state.updateState('currentFont.gradient.angle', angle);
            
            this.updatePreview();
        }
        
        addGradientColor() {
            const container = this.dom.get('gradientColors');
            if (!container) return;
            
            const colors = container.querySelectorAll('.gradient-color');
            if (colors.length >= 5) {
                this.utils.showToast('Maksimal 5 warna gradient', 'warning');
                return;
            }
            
            const newColor = document.createElement('input');
            newColor.type = 'color';
            newColor.className = 'gradient-color';
            newColor.value = '#ffffff';
            newColor.addEventListener('input', () => this.updateGradient());
            
            container.insertBefore(newColor, container.querySelector('.add-gradient-color'));
            this.updateGradient();
        }
        
        setupEventListeners() {
            // Font source tabs
            this.dom.get('sourceTabs')?.forEach(tab => {
                tab.addEventListener('click', () => {
                    const source = tab.dataset.source;
                    
                    this.dom.get('sourceTabs')?.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    this.dom.get('fontSourcePanels')?.forEach(panel => {
                        panel.classList.remove('active');
                    });
                    
                    const panel = document.getElementById(`${source}FontPanel`);
                    if (panel) panel.classList.add('active');
                });
            });
            
            // Google Fonts
            if (this.dom.get('googleFontSearch')) {
                const debouncedSearch = this.utils.debounce((e) => {
                    this.loadGoogleFonts(e.target.value);
                }, 500);
                
                this.dom.get('googleFontSearch').addEventListener('input', debouncedSearch);
            }
            
            if (this.dom.get('applyGoogleFont')) {
                this.dom.get('applyGoogleFont').addEventListener('click', () => {
                    const selected = this.dom.get('googleFontGrid')?.querySelector('.selected');
                    if (selected) {
                        const font = selected.dataset.font;
                        const category = selected.dataset.category;
                        this.selectGoogleFont(font, category);
                    } else {
                        this.utils.showToast('Pilih font terlebih dahulu', 'warning');
                    }
                });
            }
            
            // Dafont
            if (this.dom.get('applyDafont')) {
                this.dom.get('applyDafont').addEventListener('click', () => this.applyDafont());
            }
            
            // Custom Font
            if (this.dom.get('applyCustomFont')) {
                this.dom.get('applyCustomFont').addEventListener('click', () => this.applyCustomFont());
            }
            
            // Font style controls
            if (this.dom.get('fontWeight')) {
                this.dom.get('fontWeight').addEventListener('change', () => this.updateFontStyle());
            }
            
            if (this.dom.get('fontStyle')) {
                this.dom.get('fontStyle').addEventListener('change', () => this.updateFontStyle());
            }
            
            if (this.dom.get('fontSize')) {
                this.dom.get('fontSize').addEventListener('change', () => this.updateFontStyle());
            }
            
            this.dom.get('transformBtns')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.dom.get('transformBtns')?.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.updateFontStyle();
                });
            });
            
            if (this.dom.get('letterSpacing')) {
                this.dom.get('letterSpacing').addEventListener('input', () => this.updateFontStyle());
            }
            
            if (this.dom.get('wordSpacing')) {
                this.dom.get('wordSpacing').addEventListener('input', () => this.updateFontStyle());
            }
            
            if (this.dom.get('lineHeight')) {
                this.dom.get('lineHeight').addEventListener('input', () => this.updateFontStyle());
            }
            
            // Shadow controls
            if (this.dom.get('shadowX')) {
                this.dom.get('shadowX').addEventListener('input', () => this.updateTextShadow());
                this.dom.get('shadowY').addEventListener('input', () => this.updateTextShadow());
                this.dom.get('shadowBlur').addEventListener('input', () => this.updateTextShadow());
                this.dom.get('shadowColor').addEventListener('input', () => this.updateTextShadow());
                this.dom.get('shadowOpacity').addEventListener('input', () => this.updateTextShadow());
            }
            
            if (this.dom.get('toggleShadow')) {
                this.dom.get('toggleShadow').addEventListener('click', () => this.toggleShadow());
            }
            
            // Stroke controls
            if (this.dom.get('strokeWidth')) {
                this.dom.get('strokeWidth').addEventListener('input', () => this.updateTextStroke());
            }
            
            if (this.dom.get('strokeColor')) {
                this.dom.get('strokeColor').addEventListener('input', () => this.updateTextStroke());
            }
            
            // Gradient controls
            if (this.dom.get('gradientType')) {
                this.dom.get('gradientType').addEventListener('change', () => this.updateGradient());
            }
            
            if (this.dom.get('gradientAngle')) {
                this.dom.get('gradientAngle').addEventListener('input', () => this.updateGradient());
            }
            
            const addGradientBtn = document.querySelector('.add-gradient-color');
            if (addGradientBtn) {
                addGradientBtn.addEventListener('click', () => this.addGradientColor());
            }
            
            // Text color
            if (this.dom.get('textColor')) {
                this.dom.get('textColor').addEventListener('input', () => this.updateTextColor());
            }
            
            if (this.dom.get('textColorHex')) {
                this.dom.get('textColorHex').addEventListener('input', (e) => {
                    if (this.utils.isValidHex(e.target.value)) {
                        this.dom.get('textColor').value = e.target.value;
                        this.updateTextColor();
                    }
                });
            }
        }
        
        updatePreview() {
            const preview = this.dom.get('previewTextElement');
            const subtext = this.dom.get('previewSubtext');
            const state = this.state.getState();
            const font = state.currentFont;
            
            if (preview) {
                // Font properties
                preview.style.fontFamily = font.family;
                preview.style.fontSize = `${font.size}px`;
                preview.style.fontWeight = font.weight;
                preview.style.fontStyle = font.style;
                preview.style.color = font.color;
                preview.style.textAlign = state.preview.align;
                preview.style.letterSpacing = `${font.letterSpacing}px`;
                preview.style.wordSpacing = `${font.wordSpacing}px`;
                preview.style.lineHeight = font.lineHeight;
                preview.style.textTransform = font.transform;
                
                // Text shadow
                if (font.shadow.enabled) {
                    const rgb = this.utils.hexToRgb(font.shadow.color);
                    preview.style.textShadow = `${font.shadow.x}px ${font.shadow.y}px ${font.shadow.blur}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${font.shadow.opacity})`;
                } else {
                    preview.style.textShadow = 'none';
                }
                
                // Text stroke
                if (font.stroke.width > 0) {
                    preview.style.webkitTextStroke = `${font.stroke.width}px ${font.stroke.color}`;
                } else {
                    preview.style.webkitTextStroke = 'none';
                }
                
                // Gradient
                if (font.gradient.type !== 'none') {
                    const colors = font.gradient.colors.join(', ');
                    if (font.gradient.type === 'linear') {
                        preview.style.background = `linear-gradient(${font.gradient.angle}deg, ${colors})`;
                    } else {
                        preview.style.background = `radial-gradient(circle, ${colors})`;
                    }
                    preview.style.webkitBackgroundClip = 'text';
                    preview.style.webkitTextFillColor = 'transparent';
                } else {
                    preview.style.background = 'none';
                    preview.style.webkitBackgroundClip = 'border-box';
                    preview.style.webkitTextFillColor = 'currentColor';
                }
            }
            
            if (subtext) {
                subtext.style.fontFamily = font.family;
            }
            
            // Update info panel
            this.updateInfoPanel();
            this.updateCSSOutput();
        }
        
        updateInfoPanel() {
            const state = this.state.getState();
            const font = state.currentFont;
            
            if (this.dom.get('infoFamily')) {
                this.dom.get('infoFamily').textContent = font.family.split(',')[0];
            }
            if (this.dom.get('infoWeight')) {
                this.dom.get('infoWeight').textContent = font.weight;
            }
            if (this.dom.get('infoStyle')) {
                this.dom.get('infoStyle').textContent = font.style;
            }
            if (this.dom.get('infoSize')) {
                this.dom.get('infoSize').textContent = `${font.size}px`;
            }
            if (this.dom.get('infoLineHeight')) {
                this.dom.get('infoLineHeight').textContent = font.lineHeight;
            }
        }
        
        updateCSSOutput() {
            const cssElement = this.dom.get('cssCode');
            if (!cssElement) return;
            
            const css = this.utils.generateCSS(this.state.getState());
            cssElement.textContent = css;
            
            if (window.Prism) {
                Prism.highlightElement(cssElement);
            }
        }
        
        resetToDefault() {
            this.state.updateState('currentFont', {
                family: 'Inter, sans-serif',
                source: 'google',
                url: null,
                weight: 400,
                style: 'normal',
                size: 16,
                transform: 'none',
                letterSpacing: 0,
                wordSpacing: 0,
                lineHeight: 1.5,
                color: '#ffffff',
                shadow: {
                    enabled: false,
                    x: 2,
                    y: 2,
                    blur: 4,
                    color: '#000000',
                    opacity: 0.5
                },
                stroke: {
                    width: 0,
                    color: '#000000'
                },
                gradient: {
                    type: 'none',
                    colors: ['#ff6b6b', '#4ecdc4'],
                    angle: 45
                },
                background: {
                    type: 'none',
                    color: '#1a1a1a',
                    gradient: null,
                    image: null
                }
            });
            
            this.updatePreview();
            this.utils.showToast('Reset ke default', 'info');
        }
    }

    // ==================== ANIMATION MANAGER ====================
    class AnimationManager {
        constructor(state, dom, utils) {
            this.state = state;
            this.dom = dom;
            this.utils = utils;
            this.animationFrame = null;
            this.startTime = null;
            this.init();
        }
        
        init() {
            this.renderAnimationGrid();
            this.setupEventListeners();
            this.injectAnimationStyles();
        }
        
        injectAnimationStyles() {
            const style = document.createElement('style');
            let css = '';
            
            Object.entries(ANIMATION_PRESETS).forEach(([id, preset]) => {
                if (id !== 'none') {
                    css += preset.keyframes;
                }
            });
            
            style.textContent = css;
            document.head.appendChild(style);
        }
        
        renderAnimationGrid() {
            const grid = this.dom.get('animationGrid');
            if (!grid) return;
            
            let html = '';
            const currentAnim = this.state.state.currentAnimation.id;
            
            Object.entries(ANIMATION_PRESETS).forEach(([id, anim]) => {
                const isSelected = currentAnim === id;
                html += `
                    <div class="animation-card ${isSelected ? 'selected' : ''}" data-animation="${id}">
                        <div class="animation-preview preview-${id}">
                            <i class="fas fa-play"></i>
                        </div>
                        <div class="animation-info">
                            <span class="animation-name">${anim.name}</span>
                            <span class="animation-desc">${anim.description}</span>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle selected-icon"></i>' : ''}
                    </div>
                `;
            });
            
            grid.innerHTML = html;
            
            grid.querySelectorAll('.animation-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.animation;
                    this.selectAnimation(id);
                });
            });
        }
        
        selectAnimation(id) {
            const anim = ANIMATION_PRESETS[id];
            if (!anim && id !== 'none') return;
            
            this.state.updateState('currentAnimation.id', id);
            this.state.updateState('currentAnimation.name', id === 'none' ? 'Tidak Ada' : anim.name);
            
            this.renderAnimationGrid();
            this.updatePreview();
            this.updateAnimationStats();
            this.utils.vibrate();
        }
        
        updateAnimationParams() {
            const duration = parseFloat(this.dom.get('animDuration')?.value || 2);
            const delay = parseFloat(this.dom.get('animDelay')?.value || 0);
            const iteration = this.dom.get('animIteration')?.value || 'infinite';
            const direction = this.dom.get('animDirection')?.value || 'normal';
            const fillMode = this.dom.get('animFillMode')?.value || 'both';
            
            this.state.updateState('currentAnimation.duration', duration);
            this.state.updateState('currentAnimation.delay', delay);
            this.state.updateState('currentAnimation.iteration', iteration);
            this.state.updateState('currentAnimation.direction', direction);
            this.state.updateState('currentAnimation.fillMode', fillMode);
            
            if (this.dom.get('animDurationValue')) {
                this.dom.get('animDurationValue').textContent = `${duration}s`;
            }
            if (this.dom.get('animDelayValue')) {
                this.dom.get('animDelayValue').textContent = `${delay}s`;
            }
            
            this.updatePreview();
            this.updateAnimationStats();
            this.updateTimelineVisualizer();
        }
        
        selectEasing(easing) {
            this.state.updateState('currentAnimation.easing', easing);
            
            this.dom.get('easingBtns')?.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.easing === easing) {
                    btn.classList.add('active');
                }
            });
            
            this.updatePreview();
            this.updateAnimationStats();
        }
        
        applyCustomEasing() {
            const custom = this.dom.get('customEasing')?.value;
            if (custom) {
                this.selectEasing(custom);
            }
        }
        
        updateTransform() {
            const scaleX = parseFloat(this.dom.get('scaleX')?.value || 1);
            const scaleY = parseFloat(this.dom.get('scaleY')?.value || 1);
            const rotate = parseFloat(this.dom.get('rotate')?.value || 0);
            const skewX = parseFloat(this.dom.get('skewX')?.value || 0);
            const skewY = parseFloat(this.dom.get('skewY')?.value || 0);
            const translateX = parseFloat(this.dom.get('translateX')?.value || 0);
            const translateY = parseFloat(this.dom.get('translateY')?.value || 0);
            
            this.state.updateState('currentAnimation.transform.scaleX', scaleX);
            this.state.updateState('currentAnimation.transform.scaleY', scaleY);
            this.state.updateState('currentAnimation.transform.rotate', rotate);
            this.state.updateState('currentAnimation.transform.skewX', skewX);
            this.state.updateState('currentAnimation.transform.skewY', skewY);
            this.state.updateState('currentAnimation.transform.translateX', translateX);
            this.state.updateState('currentAnimation.transform.translateY', translateY);
            
            if (this.dom.get('scaleXValue')) this.dom.get('scaleXValue').textContent = scaleX.toFixed(1);
            if (this.dom.get('scaleYValue')) this.dom.get('scaleYValue').textContent = scaleY.toFixed(1);
            if (this.dom.get('rotateValue')) this.dom.get('rotateValue').textContent = `${rotate}°`;
            if (this.dom.get('skewXValue')) this.dom.get('skewXValue').textContent = `${skewX}°`;
            if (this.dom.get('skewYValue')) this.dom.get('skewYValue').textContent = `${skewY}°`;
            if (this.dom.get('translateXValue')) this.dom.get('translateXValue').textContent = `${translateX}px`;
            if (this.dom.get('translateYValue')) this.dom.get('translateYValue').textContent = `${translateY}px`;
            
            this.updatePreview();
        }
        
        updateOpacity() {
            const opacity = parseFloat(this.dom.get('opacity')?.value || 1);
            
            this.state.updateState('currentAnimation.opacity', opacity);
            
            if (this.dom.get('opacityValue')) {
                this.dom.get('opacityValue').textContent = opacity.toFixed(2);
            }
            
            this.updatePreview();
        }
        
        updateFilter() {
            const blur = parseFloat(this.dom.get('filterBlur')?.value || 0);
            const brightness = parseFloat(this.dom.get('filterBrightness')?.value || 1);
            const contrast = parseFloat(this.dom.get('filterContrast')?.value || 1);
            const grayscale = parseFloat(this.dom.get('filterGrayscale')?.value || 0);
            const hue = parseFloat(this.dom.get('filterHue')?.value || 0);
            const saturate = parseFloat(this.dom.get('filterSaturate')?.value || 1);
            const sepia = parseFloat(this.dom.get('filterSepia')?.value || 0);
            const invert = parseFloat(this.dom.get('filterInvert')?.value || 0);
            
            this.state.updateState('currentAnimation.filter.blur', blur);
            this.state.updateState('currentAnimation.filter.brightness', brightness);
            this.state.updateState('currentAnimation.filter.contrast', contrast);
            this.state.updateState('currentAnimation.filter.grayscale', grayscale);
            this.state.updateState('currentAnimation.filter.hue', hue);
            this.state.updateState('currentAnimation.filter.saturate', saturate);
            this.state.updateState('currentAnimation.filter.sepia', sepia);
            this.state.updateState('currentAnimation.filter.invert', invert);
            
            if (this.dom.get('filterBlurValue')) this.dom.get('filterBlurValue').textContent = `${blur}px`;
            if (this.dom.get('filterBrightnessValue')) this.dom.get('filterBrightnessValue').textContent = brightness.toFixed(1);
            if (this.dom.get('filterContrastValue')) this.dom.get('filterContrastValue').textContent = contrast.toFixed(1);
            if (this.dom.get('filterGrayscaleValue')) this.dom.get('filterGrayscaleValue').textContent = `${grayscale * 100}%`;
            if (this.dom.get('filterHueValue')) this.dom.get('filterHueValue').textContent = `${hue}°`;
            if (this.dom.get('filterSaturateValue')) this.dom.get('filterSaturateValue').textContent = saturate.toFixed(1);
            if (this.dom.get('filterSepiaValue')) this.dom.get('filterSepiaValue').textContent = `${sepia * 100}%`;
            if (this.dom.get('filterInvertValue')) this.dom.get('filterInvertValue').textContent = `${invert * 100}%`;
            
            this.updatePreview();
        }
        
        updatePreview() {
            const preview = this.dom.get('previewTextElement');
            if (!preview) return;
            
            const anim = this.state.state.currentAnimation;
            
            // Apply transform
            const transform = [];
            if (anim.transform.scaleX !== 1 || anim.transform.scaleY !== 1) {
                transform.push(`scale(${anim.transform.scaleX}, ${anim.transform.scaleY})`);
            }
            if (anim.transform.rotate !== 0) transform.push(`rotate(${anim.transform.rotate}deg)`);
            if (anim.transform.skewX !== 0 || anim.transform.skewY !== 0) {
                transform.push(`skew(${anim.transform.skewX}deg, ${anim.transform.skewY}deg)`);
            }
            if (anim.transform.translateX !== 0 || anim.transform.translateY !== 0) {
                transform.push(`translate(${anim.transform.translateX}px, ${anim.transform.translateY}px)`);
            }
            
            preview.style.transform = transform.join(' ') || 'none';
            
            // Apply opacity
            preview.style.opacity = anim.opacity;
            
            // Apply filter
            const filter = [];
            if (anim.filter.blur > 0) filter.push(`blur(${anim.filter.blur}px)`);
            if (anim.filter.brightness !== 1) filter.push(`brightness(${anim.filter.brightness})`);
            if (anim.filter.contrast !== 1) filter.push(`contrast(${anim.filter.contrast})`);
            if (anim.filter.grayscale > 0) filter.push(`grayscale(${anim.filter.grayscale})`);
            if (anim.filter.hue > 0) filter.push(`hue-rotate(${anim.filter.hue}deg)`);
            if (anim.filter.saturate !== 1) filter.push(`saturate(${anim.filter.saturate})`);
            if (anim.filter.sepia > 0) filter.push(`sepia(${anim.filter.sepia})`);
            if (anim.filter.invert > 0) filter.push(`invert(${anim.filter.invert})`);
            
            preview.style.filter = filter.join(' ') || 'none';
            
            // Apply animation
            if (anim.id !== 'none') {
                preview.style.animation = `${anim.id}Anim ${anim.duration}s ${anim.easing} ${anim.delay}s ${anim.iteration} ${anim.direction} ${anim.fillMode}`;
            } else {
                preview.style.animation = 'none';
            }
            
            this.updateCSSOutput();
        }
        
        updateAnimationStats() {
            const anim = this.state.state.currentAnimation;
            
            if (this.dom.get('statCurrent')) {
                this.dom.get('statCurrent').textContent = anim.name;
            }
            if (this.dom.get('statDuration')) {
                this.dom.get('statDuration').textContent = `${anim.duration}s`;
            }
            if (this.dom.get('statDelay')) {
                this.dom.get('statDelay').textContent = `${anim.delay}s`;
            }
            if (this.dom.get('statIteration')) {
                this.dom.get('statIteration').textContent = anim.iteration;
            }
            if (this.dom.get('statDirection')) {
                this.dom.get('statDirection').textContent = anim.direction;
            }
            if (this.dom.get('statEasing')) {
                this.dom.get('statEasing').textContent = anim.easing;
            }
            if (this.dom.get('statKeyframes')) {
                this.dom.get('statKeyframes').textContent = anim.keyframes.length;
            }
        }
        
        updateCSSOutput() {
            const cssElement = this.dom.get('cssCode');
            if (!cssElement) return;
            
            const css = this.utils.generateCSS(this.state.getState());
            cssElement.textContent = css;
            
            if (window.Prism) {
                Prism.highlightElement(cssElement);
            }
        }
        
        updateTimelineVisualizer() {
            const anim = this.state.state.currentAnimation;
            const progress = this.state.state.preview.currentTime / anim.duration * 100;
            
            if (this.dom.get('timelineTime')) {
                this.dom.get('timelineTime').textContent = `${this.state.state.preview.currentTime.toFixed(1)}s / ${anim.duration}s`;
            }
            
            if (this.dom.get('timelineProgress')) {
                this.dom.get('timelineProgress').style.width = `${progress}%`;
            }
            
            if (this.dom.get('timelineMarker')) {
                this.dom.get('timelineMarker').style.left = `${progress}%`;
            }
        }
        
        playAnimation() {
            if (this.state.state.preview.isPlaying) return;
            
            this.state.updateState('preview.isPlaying', true);
            this.startTime = performance.now() - this.state.state.preview.currentTime * 1000;
            this.animate();
            
            this.dom.get('playAnimation')?.classList.add('active');
            this.dom.get('pauseAnimation')?.classList.remove('active');
        }
        
        pauseAnimation() {
            this.state.updateState('preview.isPlaying', false);
            
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            
            this.dom.get('playAnimation')?.classList.remove('active');
            this.dom.get('pauseAnimation')?.classList.add('active');
        }
        
        stopAnimation() {
            this.pauseAnimation();
            this.state.updateState('preview.currentTime', 0);
            this.updateTimelineVisualizer();
            this.resetPreviewTransform();
        }
        
        restartAnimation() {
            this.stopAnimation();
            this.playAnimation();
        }
        
        resetPreviewTransform() {
            const preview = this.dom.get('previewTextElement');
            if (!preview) return;
            
            const anim = this.state.state.currentAnimation;
            preview.style.transform = 'none';
            preview.style.opacity = anim.opacity;
            preview.style.filter = 'none';
        }
        
        animate() {
            if (!this.state.state.preview.isPlaying) return;
            
            const anim = this.state.state.currentAnimation;
            const currentTime = (performance.now() - this.startTime) / 1000;
            
            if (currentTime > anim.duration) {
                if (anim.iteration === 'infinite' || this.state.state.preview.loop) {
                    this.startTime = performance.now();
                    this.state.updateState('preview.currentTime', 0);
                } else {
                    this.pauseAnimation();
                    this.state.updateState('preview.currentTime', anim.duration);
                    this.updateTimelineVisualizer();
                    return;
                }
            }
            
            this.state.updateState('preview.currentTime', currentTime);
            this.updateTimelineVisualizer();
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
        }
        
        toggleLoop() {
            const loop = !this.state.state.preview.loop;
            this.state.updateState('preview.loop', loop);
            
            const btn = this.dom.get('loopAnimation');
            if (btn) {
                btn.classList.toggle('active', loop);
            }
        }
        
        addKeyframe() {
            const position = parseFloat(this.dom.get('keyframePosition')?.value || 50);
            
            const keyframes = this.state.state.currentAnimation.keyframes;
            const newKeyframe = {
                position: position,
                properties: {
                    transform: { ...this.state.state.currentAnimation.transform },
                    opacity: this.state.state.currentAnimation.opacity,
                    filter: { ...this.state.state.currentAnimation.filter }
                }
            };
            
            keyframes.push(newKeyframe);
            keyframes.sort((a, b) => a.position - b.position);
            
            this.state.updateState('currentAnimation.keyframes', keyframes);
            this.renderKeyframeTimeline();
            this.utils.showToast(`Keyframe ${position}% ditambahkan`, 'success');
        }
        
        renderKeyframeTimeline() {
            const track = this.dom.get('timelineTrack');
            if (!track) return;
            
            const keyframes = this.state.state.currentAnimation.keyframes;
            
            track.innerHTML = '';
            
            keyframes.forEach((kf, index) => {
                const marker = document.createElement('div');
                marker.className = 'keyframe-marker';
                if (index === this.state.state.selectedKeyframe) {
                    marker.classList.add('selected');
                }
                marker.style.left = `${kf.position}%`;
                marker.textContent = `${kf.position}%`;
                marker.dataset.index = index;
                
                marker.addEventListener('click', () => {
                    this.selectKeyframe(index);
                });
                
                track.appendChild(marker);
            });
        }
        
        selectKeyframe(index) {
            this.state.updateState('selectedKeyframe', index);
            this.renderKeyframeTimeline();
            this.renderKeyframeProperties();
        }
        
        renderKeyframeProperties() {
            const container = this.dom.get('keyframeProperties');
            if (!container) return;
            
            const keyframe = this.state.state.currentAnimation.keyframes[this.state.state.selectedKeyframe];
            if (!keyframe) return;
            
            // Render properties editor here
            container.innerHTML = `
                <div class="keyframe-editor">
                    <h4>Keyframe ${keyframe.position}%</h4>
                    <div class="form-group">
                        <label>Position</label>
                        <input type="range" min="0" max="100" value="${keyframe.position}" class="keyframe-position-input">
                    </div>
                    <!-- Add more property controls -->
                </div>
            `;
        }
        
        savePreset() {
            const modal = this.dom.get('savePresetModal');
            if (modal) {
                modal.classList.add('active');
            }
        }
        
        confirmSavePreset() {
            const name = this.dom.get('modalPresetName')?.value;
            const category = this.dom.get('modalPresetCategory')?.value;
            const desc = this.dom.get('modalPresetDesc')?.value;
            
            if (!name) {
                this.utils.showToast('Nama preset wajib diisi', 'warning');
                return;
            }
            
            const preset = {
                id: this.utils.generateId(),
                name: name,
                category: category,
                description: desc,
                font: { ...this.state.state.currentFont },
                animation: { ...this.state.state.currentAnimation },
                createdAt: new Date().toISOString()
            };
            
            const presets = this.state.state.savedPresets;
            presets.push(preset);
            this.state.updateState('savedPresets', presets);
            
            this.closeSavePresetModal();
            this.renderPresetList();
            this.utils.showToast(`Preset "${name}" disimpan`, 'success');
        }
        
        closeSavePresetModal() {
            const modal = this.dom.get('savePresetModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }
        
        renderPresetList() {
            const list = this.dom.get('presetList');
            if (!list) return;
            
            const presets = this.state.state.savedPresets;
            
            if (presets.length === 0) {
                list.innerHTML = '<div class="text-muted text-center p-3">Belum ada preset tersimpan</div>';
                return;
            }
            
            let html = '';
            presets.forEach(preset => {
                html += `
                    <div class="preset-item" data-id="${preset.id}">
                        <div class="preset-info">
                            <div class="preset-name">${preset.name}</div>
                            <div class="preset-category">${preset.category}</div>
                        </div>
                        <div class="preset-actions">
                            <button class="preset-btn load" title="Load Preset">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="preset-btn delete" title="Delete Preset">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            list.innerHTML = html;
            
            list.querySelectorAll('.preset-item').forEach(item => {
                const id = item.dataset.id;
                
                item.querySelector('.load')?.addEventListener('click', () => {
                    this.loadPreset(id);
                });
                
                item.querySelector('.delete')?.addEventListener('click', () => {
                    this.deletePreset(id);
                });
            });
        }
        
        loadPreset(id) {
            const preset = this.state.state.savedPresets.find(p => p.id === id);
            if (!preset) return;
            
            this.state.updateState('currentFont', preset.font);
            this.state.updateState('currentAnimation', preset.animation);
            
            this.updatePreview();
            this.renderAnimationGrid();
            this.utils.showToast(`Preset "${preset.name}" dimuat`, 'success');
        }
        
        deletePreset(id) {
            const presets = this.state.state.savedPresets.filter(p => p.id !== id);
            this.state.updateState('savedPresets', presets);
            this.renderPresetList();
            this.utils.showToast('Preset dihapus', 'info');
        }
        
        setupEventListeners() {
            // Animation selection
            // (already handled in renderAnimationGrid)
            
            // Timeline controls
            if (this.dom.get('animDuration')) {
                this.dom.get('animDuration').addEventListener('input', () => this.updateAnimationParams());
            }
            
            if (this.dom.get('animDelay')) {
                this.dom.get('animDelay').addEventListener('input', () => this.updateAnimationParams());
            }
            
            if (this.dom.get('animIteration')) {
                this.dom.get('animIteration').addEventListener('change', () => this.updateAnimationParams());
            }
            
            if (this.dom.get('animDirection')) {
                this.dom.get('animDirection').addEventListener('change', () => this.updateAnimationParams());
            }
            
            if (this.dom.get('animFillMode')) {
                this.dom.get('animFillMode').addEventListener('change', () => this.updateAnimationParams());
            }
            
            // Easing
            this.dom.get('easingBtns')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.selectEasing(btn.dataset.easing);
                });
            });
            
            if (this.dom.get('applyCustomEasing')) {
                this.dom.get('applyCustomEasing').addEventListener('click', () => this.applyCustomEasing());
            }
            
            // Transform
            if (this.dom.get('scaleX')) {
                this.dom.get('scaleX').addEventListener('input', () => this.updateTransform());
                this.dom.get('scaleY').addEventListener('input', () => this.updateTransform());
                this.dom.get('rotate').addEventListener('input', () => this.updateTransform());
                this.dom.get('skewX').addEventListener('input', () => this.updateTransform());
                this.dom.get('skewY').addEventListener('input', () => this.updateTransform());
                this.dom.get('translateX').addEventListener('input', () => this.updateTransform());
                this.dom.get('translateY').addEventListener('input', () => this.updateTransform());
            }
            
            // Opacity
            if (this.dom.get('opacity')) {
                this.dom.get('opacity').addEventListener('input', () => this.updateOpacity());
            }
            
            // Filter
            if (this.dom.get('filterBlur')) {
                this.dom.get('filterBlur').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterBrightness').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterContrast').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterGrayscale').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterHue').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterSaturate').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterSepia').addEventListener('input', () => this.updateFilter());
                this.dom.get('filterInvert').addEventListener('input', () => this.updateFilter());
            }
            
            // Playback controls
            if (this.dom.get('playAnimation')) {
                this.dom.get('playAnimation').addEventListener('click', () => this.playAnimation());
            }
            
            if (this.dom.get('pauseAnimation')) {
                this.dom.get('pauseAnimation').addEventListener('click', () => this.pauseAnimation());
            }
            
            if (this.dom.get('stopAnimation')) {
                this.dom.get('stopAnimation').addEventListener('click', () => this.stopAnimation());
            }
            
            if (this.dom.get('restartAnimation')) {
                this.dom.get('restartAnimation').addEventListener('click', () => this.restartAnimation());
            }
            
            if (this.dom.get('loopAnimation')) {
                this.dom.get('loopAnimation').addEventListener('click', () => this.toggleLoop());
            }
            
            // Keyframe
            if (this.dom.get('keyframePosition')) {
                this.dom.get('keyframePosition').addEventListener('input', (e) => {
                    if (this.dom.get('keyframePosValue')) {
                        this.dom.get('keyframePosValue').textContent = `${e.target.value}%`;
                    }
                });
            }
            
            if (this.dom.get('addKeyframe')) {
                this.dom.get('addKeyframe').addEventListener('click', () => this.addKeyframe());
            }
            
            // Presets
            if (this.dom.get('savePreset')) {
                this.dom.get('savePreset').addEventListener('click', () => this.savePreset());
            }
            
            if (this.dom.get('confirmSavePreset')) {
                this.dom.get('confirmSavePreset').addEventListener('click', () => this.confirmSavePreset());
            }
            
            if (this.dom.get('closePresetModal')) {
                this.dom.get('closePresetModal').addEventListener('click', () => this.closeSavePresetModal());
            }
            
            if (this.dom.get('cancelPresetModal')) {
                this.dom.get('cancelPresetModal').addEventListener('click', () => this.closeSavePresetModal());
            }
        }
    }

    // ==================== PREVIEW MANAGER ====================
    class PreviewManager {
        constructor(state, dom, utils) {
            this.state = state;
            this.dom = dom;
            this.utils = utils;
            this.init();
        }
        
        init() {
            this.setupEventListeners();
            this.updatePreviewText();
            this.updateDevice();
        }
        
        updatePreviewText() {
            const text = this.dom.get('previewText')?.value || 'Toko Online Premium';
            const subtext = 'dengan Layanan Terbaik 24/7';
            
            if (this.dom.get('previewTextElement')) {
                this.dom.get('previewTextElement').textContent = text;
            }
            
            if (this.dom.get('previewSubtext')) {
                this.dom.get('previewSubtext').textContent = subtext;
            }
            
            this.state.updateState('preview.text', text);
        }
        
        updateAlignment(align) {
            this.state.updateState('preview.align', align);
            
            this.dom.get('alignBtns')?.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.align === align) {
                    btn.classList.add('active');
                }
            });
            
            if (this.dom.get('previewTextElement')) {
                this.dom.get('previewTextElement').style.textAlign = align;
            }
        }
        
        updateDevice() {
            const device = this.dom.get('previewDevice')?.value || 'desktop';
            const frame = this.dom.get('previewFrame');
            
            if (frame) {
                frame.className = 'preview-frame ' + device;
            }
            
            this.state.updateState('preview.device', device);
        }
        
        updateBackground(type) {
            const container = this.dom.get('previewContent');
            if (!container) return;
            
            this.state.updateState('preview.background', type);
            
            this.dom.get('bgBtns')?.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.bg === type) {
                    btn.classList.add('active');
                }
            });
            
            switch (type) {
                case 'dark':
                    container.style.background = '#0f0f0f';
                    break;
                case 'light':
                    container.style.background = '#ffffff';
                    break;
                case 'grid':
                    container.style.background = 'linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%)';
                    container.style.backgroundSize = '40px 40px';
                    container.style.backgroundPosition = '0 0, 0 20px, 20px -20px, -20px 0px';
                    break;
                case 'gradient':
                    container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    break;
                case 'custom':
                    if (this.state.state.preview.customBg) {
                        container.style.background = this.state.state.preview.customBg;
                    } else {
                        this.openCustomBgModal();
                    }
                    break;
            }
        }
        
        openCustomBgModal() {
            const modal = this.dom.get('customBgModal');
            if (modal) {
                modal.classList.add('active');
            }
        }
        
        closeCustomBgModal() {
            const modal = this.dom.get('customBgModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }
        
        applyCustomBg() {
            const type = this.dom.get('modalBgType')?.value;
            const container = this.dom.get('previewContent');
            
            let bg = '';
            
            switch (type) {
                case 'color':
                    bg = this.dom.get('modalBgColor')?.value || '#1a1a1a';
                    break;
                case 'gradient':
                    bg = this.dom.get('modalBgGradient')?.value || 'linear-gradient(45deg, #000, #333)';
                    break;
                case 'image':
                    const url = this.dom.get('modalBgImage')?.value;
                    if (url && this.utils.isValidUrl(url)) {
                        bg = `url('${url}') center/cover`;
                    }
                    break;
            }
            
            if (bg) {
                container.style.background = bg;
                this.state.updateState('preview.customBg', bg);
                this.state.updateState('preview.background', 'custom');
            }
            
            this.closeCustomBgModal();
        }
        
        zoomIn() {
            const zoom = this.state.state.preview.zoom + 10;
            if (zoom <= 200) {
                this.state.updateState('preview.zoom', zoom);
                this.updateZoom();
            }
        }
        
        zoomOut() {
            const zoom = this.state.state.preview.zoom - 10;
            if (zoom >= 50) {
                this.state.updateState('preview.zoom', zoom);
                this.updateZoom();
            }
        }
        
        resetZoom() {
            this.state.updateState('preview.zoom', 100);
            this.updateZoom();
        }
        
        updateZoom() {
            const zoom = this.state.state.preview.zoom;
            const frame = this.dom.get('previewFrame');
            
            if (frame) {
                frame.style.transform = `scale(${zoom / 100})`;
                frame.style.transformOrigin = 'top left';
            }
            
            if (this.dom.get('zoomLevel')) {
                this.dom.get('zoomLevel').textContent = `${zoom}%`;
            }
        }
        
        toggleFullscreen() {
            const container = this.dom.get('previewContainer');
            
            if (!document.fullscreenElement) {
                container.requestFullscreen();
                this.state.updateState('isFullscreen', true);
            } else {
                document.exitFullscreen();
                this.state.updateState('isFullscreen', false);
            }
        }
        
        setupEventListeners() {
            // Preview text
            if (this.dom.get('previewText')) {
                this.dom.get('previewText').addEventListener('input', () => this.updatePreviewText());
            }
            
            // Alignment
            this.dom.get('alignBtns')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.updateAlignment(btn.dataset.align);
                });
            });
            
            // Device
            if (this.dom.get('previewDevice')) {
                this.dom.get('previewDevice').addEventListener('change', () => this.updateDevice());
            }
            
            // Background
            this.dom.get('bgBtns')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.updateBackground(btn.dataset.bg);
                });
            });
            
            if (this.dom.get('customBgBtn')) {
                this.dom.get('customBgBtn').addEventListener('click', () => this.openCustomBgModal());
            }
            
            // Zoom
            if (this.dom.get('zoomIn')) {
                this.dom.get('zoomIn').addEventListener('click', () => this.zoomIn());
            }
            
            if (this.dom.get('zoomOut')) {
                this.dom.get('zoomOut').addEventListener('click', () => this.zoomOut());
            }
            
            if (this.dom.get('resetZoom')) {
                this.dom.get('resetZoom').addEventListener('click', () => this.resetZoom());
            }
            
            // Fullscreen
            if (this.dom.get('fullscreenPreview')) {
                this.dom.get('fullscreenPreview').addEventListener('click', () => this.toggleFullscreen());
            }
            
            // Background modal
            if (this.dom.get('closeBgModal')) {
                this.dom.get('closeBgModal').addEventListener('click', () => this.closeCustomBgModal());
            }
            
            if (this.dom.get('cancelBgModal')) {
                this.dom.get('cancelBgModal').addEventListener('click', () => this.closeCustomBgModal());
            }
            
            if (this.dom.get('applyBgModal')) {
                this.dom.get('applyBgModal').addEventListener('click', () => this.applyCustomBg());
            }
            
            // Modal background type change
            if (this.dom.get('modalBgType')) {
                this.dom.get('modalBgType').addEventListener('change', (e) => {
                    const type = e.target.value;
                    
                    document.getElementById('modalBgColorGroup').style.display = type === 'color' ? 'block' : 'none';
                    document.getElementById('modalBgGradientGroup').style.display = type === 'gradient' ? 'block' : 'none';
                    document.getElementById('modalBgImageGroup').style.display = type === 'image' ? 'block' : 'none';
                });
            }
            
            // Click outside modal
            window.addEventListener('click', (e) => {
                if (e.target === this.dom.get('customBgModal')) {
                    this.closeCustomBgModal();
                }
                if (e.target === this.dom.get('savePresetModal')) {
                    this.closeSavePresetModal();
                }
            });
        }
    }

    // ==================== MAIN APPLICATION ====================
    class FontAnimationStudio {
        constructor() {
            this.state = new StateManager();
            this.dom = new DomElements();
            this.api = new ApiClient(API_BASE_URL);
            this.utils = Utils;
            
            this.fontManager = new FontManager(this.state, this.dom, this.api, this.utils);
            this.animationManager = new AnimationManager(this.state, this.dom, this.utils);
            this.previewManager = new PreviewManager(this.state, this.dom, this.utils);
            
            this.init();
        }
        
        async init() {
            this.utils.showLoading(true);
            
            try {
                await this.loadWebsite();
                await this.loadSavedData();
                this.setupGlobalEventListeners();
                this.initSectionToggles();
                this.initCharacterMap();
                this.initKeyboardShortcuts();
                
                this.utils.showToast('Font & Animation Studio siap!', 'success');
                
            } catch (error) {
                console.error('❌ Init error:', error);
                this.utils.showToast('Gagal memuat studio', 'error');
            } finally {
                this.utils.showLoading(false);
            }
        }
        
        async loadWebsite() {
            const urlParams = new URLSearchParams(window.location.search);
            const endpoint = urlParams.get('website');
            
            if (!endpoint) {
                this.utils.showToast('Website tidak ditemukan', 'error');
                setTimeout(() => {
                    window.location.href = '/wtb/html/panel.html';
                }, 2000);
                return;
            }
            
            try {
                const website = await this.api.loadWebsite(endpoint);
                this.state.updateState('website', website);
                
                if (this.dom.get('websiteBadge')) {
                    this.dom.get('websiteBadge').textContent = '/' + website.endpoint;
                }
                
            } catch (error) {
                this.utils.showToast('Gagal memuat data website', 'error');
            }
        }
        
        async loadSavedData() {
            const website = this.state.getState().website;
            if (!website) return;
            
            try {
                const tampilan = await this.api.loadTampilan(website.id);
                
                if (tampilan) {
                    // Apply saved font settings
                    if (tampilan.font_family) {
                        this.state.updateState('currentFont.family', tampilan.font_family);
                    }
                    
                    if (tampilan.font_size) {
                        this.state.updateState('currentFont.size', tampilan.font_size);
                        if (this.dom.get('fontSize')) {
                            this.dom.get('fontSize').value = tampilan.font_size;
                        }
                    }
                    
                    // Apply saved animation
                    if (tampilan.font_animation) {
                        this.state.updateState('currentAnimation.id', tampilan.font_animation);
                        this.animationManager.renderAnimationGrid();
                    }
                    
                    if (tampilan.animation_duration) {
                        this.state.updateState('currentAnimation.duration', tampilan.animation_duration);
                        if (this.dom.get('animDuration')) {
                            this.dom.get('animDuration').value = tampilan.animation_duration;
                        }
                    }
                    
                    if (tampilan.animation_delay) {
                        this.state.updateState('currentAnimation.delay', tampilan.animation_delay);
                        if (this.dom.get('animDelay')) {
                            this.dom.get('animDelay').value = tampilan.animation_delay;
                        }
                    }
                    
                    if (tampilan.animation_iteration) {
                        this.state.updateState('currentAnimation.iteration', tampilan.animation_iteration);
                        if (this.dom.get('animIteration')) {
                            this.dom.get('animIteration').value = tampilan.animation_iteration;
                        }
                    }
                    
                    // Apply store display name
                    if (tampilan.store_display_name && this.dom.get('previewText')) {
                        this.dom.get('previewText').value = tampilan.store_display_name;
                        this.previewManager.updatePreviewText();
                    }
                }
                
            } catch (error) {
                console.error('❌ Error loading saved data:', error);
            }
        }
        
        async saveAll() {
            const website = this.state.getState().website;
            if (!website) return;
            
            this.utils.showLoading(true);
            
            const data = {
                store_display_name: this.state.getState().preview.text,
                font_family: this.state.getState().currentFont.family,
                font_size: this.state.getState().currentFont.size,
                font_animation: this.state.getState().currentAnimation.id,
                animation_duration: this.state.getState().currentAnimation.duration,
                animation_delay: this.state.getState().currentAnimation.delay,
                animation_iteration: this.state.getState().currentAnimation.iteration
            };
            
            try {
                const success = await this.api.saveFontAnim(website.id, data);
                
                if (success) {
                    this.utils.showToast('✅ Semua pengaturan disimpan!', 'success');
                    this.state.pushToHistory();
                } else {
                    throw new Error('Gagal menyimpan');
                }
                
            } catch (error) {
                this.utils.showToast(error.message, 'error');
            } finally {
                this.utils.showLoading(false);
            }
        }
        
        initSectionToggles() {
            this.dom.get('sectionHeaders')?.forEach(header => {
                header.addEventListener('click', () => {
                    const content = header.nextElementSibling;
                    const isExpanded = header.getAttribute('data-expanded') !== 'false';
                    
                    header.setAttribute('data-expanded', !isExpanded);
                    content.classList.toggle('hidden', isExpanded);
                });
            });
        }
        
        initCharacterMap() {
            const map = this.dom.get('characterMap');
            if (!map) return;
            
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
            
            let html = '';
            for (let char of chars) {
                html += `<div class="char-item">${char}</div>`;
            }
            
            map.innerHTML = html;
            
            map.querySelectorAll('.char-item').forEach(item => {
                item.addEventListener('click', () => {
                    const text = this.dom.get('previewText')?.value || '';
                    this.dom.get('previewText').value = text + item.textContent;
                    this.previewManager.updatePreviewText();
                });
            });
            
            if (this.dom.get('expandChars')) {
                this.dom.get('expandChars').addEventListener('click', () => {
                    map.classList.toggle('expanded');
                });
            }
        }
        
        initKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+Z: Undo
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    this.state.undo();
                    this.utils.showToast('Undo', 'info');
                }
                
                // Ctrl+Y: Redo
                if (e.ctrlKey && e.key === 'y') {
                    e.preventDefault();
                    this.state.redo();
                    this.utils.showToast('Redo', 'info');
                }
                
                // Space: Play/Pause
                if (e.key === ' ' && !e.target.matches('input, textarea')) {
                    e.preventDefault();
                    if (this.state.getState().preview.isPlaying) {
                        this.animationManager.pauseAnimation();
                    } else {
                        this.animationManager.playAnimation();
                    }
                }
                
                // Ctrl+S: Save
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveAll();
                }
                
                // F11: Fullscreen
                if (e.key === 'F11') {
                    e.preventDefault();
                    this.previewManager.toggleFullscreen();
                }
            });
        }
        
        setupGlobalEventListeners() {
            // Back to panel
            if (this.dom.get('backToPanel')) {
                this.dom.get('backToPanel').addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    try {
                        sessionStorage.setItem('panel_current_page', 'settings');
                    } catch (e) {}
                    
                    window.location.href = '/wtb/html/panel.html';
                });
            }
            
            // Save all
            if (this.dom.get('saveAllBtn')) {
                this.dom.get('saveAllBtn').addEventListener('click', () => this.saveAll());
            }
            
            // Copy CSS
            if (this.dom.get('copyCssBtn')) {
                this.dom.get('copyCssBtn').addEventListener('click', () => {
                    const css = this.dom.get('cssCode')?.textContent;
                    if (css) {
                        this.utils.copyToClipboard(css);
                    }
                });
            }
            
            // Reset all
            if (this.dom.get('resetAllBtn')) {
                this.dom.get('resetAllBtn').addEventListener('click', () => {
                    if (confirm('Reset semua pengaturan ke default?')) {
                        this.fontManager.resetToDefault();
                        this.animationManager.selectAnimation('none');
                        this.utils.vibrate();
                    }
                });
            }
            
            // Export
            if (this.dom.get('exportCSS')) {
                this.dom.get('exportCSS').addEventListener('click', () => {
                    const css = this.utils.generateCSS(this.state.getState());
                    const blob = new Blob([css], { type: 'text/css' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'font-animation.css';
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
            
            if (this.dom.get('exportJSON')) {
                this.dom.get('exportJSON').addEventListener('click', () => {
                    const data = JSON.stringify(this.state.getState(), null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'font-animation.json';
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
            
            if (this.dom.get('exportHTML')) {
                this.dom.get('exportHTML').addEventListener('click', () => {
                    const css = this.utils.generateCSS(this.state.getState());
                    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Font & Animation Preview</title>
    <style>
        body {
            background: #0f0f0f;
            color: white;
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        .preview {
            text-align: center;
            max-width: 800px;
            padding: 40px;
        }
        ${css}
    </style>
</head>
<body>
    <div class="preview">
        <div class="preview-text">${this.state.getState().preview.text}</div>
        <div class="preview-subtext">dengan Layanan Terbaik 24/7</div>
    </div>
</body>
</html>`;
                    
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'preview.html';
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
            
            if (this.dom.get('exportPreview')) {
                this.dom.get('exportPreview').addEventListener('click', () => {
                    this.utils.showToast('Fitur screenshot akan segera tersedia', 'info');
                });
            }
            
            // Telegram theme
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                
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
            
            // Weight preview clicks
            if (this.dom.get('weightsPreview')) {
                this.dom.get('weightsPreview').querySelectorAll('.weight-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const weight = item.dataset.weight;
                        if (this.dom.get('fontWeight')) {
                            this.dom.get('fontWeight').value = weight;
                            this.fontManager.updateFontStyle();
                        }
                    });
                });
            }
        }
    }

    // ==================== START APPLICATION ====================
    document.addEventListener('DOMContentLoaded', () => {
        new FontAnimationStudio();
    });

})();

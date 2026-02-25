// font-animations.js - Font & Animations Manager untuk Tampilan Website
(function() {
    'use strict';
    
    // ==================== DATA FONT ====================
    // Sumber: https://www.dafont.com/squeaky.font
    window.FONT_DATA = {
        fonts: [
            { 
                name: 'Inter', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
            },
            { 
                name: 'Poppins', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
            },
            { 
                name: 'Roboto', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap'
            },
            { 
                name: 'Squeaky', 
                category: 'Display',
                preview: 'The quick brown fox jumps',
                note: 'Personal Use Only',
                // Gunakan font yang di-upload atau dari Google Fonts jika tersedia
                // Jika tidak, gunakan system font fallback
                family: 'Squeaky, "Comic Sans MS", cursive'
            },
            { 
                name: 'Montserrat', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap'
            },
            { 
                name: 'Lato', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap'
            },
            { 
                name: 'Open Sans', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps over the lazy dog',
                url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap'
            },
            { 
                name: 'Oswald', 
                category: 'Sans Serif',
                preview: 'THE QUICK BROWN FOX',
                url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap'
            },
            { 
                name: 'Raleway', 
                category: 'Sans Serif',
                preview: 'The quick brown fox jumps',
                url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap'
            }
        ],
        
        // Font tambahan dari dafont bisa ditambahkan di sini
        // Format: { name: 'Nama Font', family: 'font-family, fallback', category: 'Display/Handwriting/etc', preview: 'teks preview' }
        customFonts: [
            {
                name: 'Squeaky',
                family: 'Squeaky, "Comic Sans MS", cursive, sans-serif',
                category: 'Display',
                preview: 'Squeaky Font Preview',
                note: 'Personal Use Only'
            }
        ]
    };

    // ==================== DATA ANIMASI ====================
    window.ANIMATION_DATA = {
        animations: [
            { 
                id: 'none', 
                name: 'Tidak Ada', 
                description: 'Teks statis tanpa animasi',
                css: ''
            },
            { 
                id: 'fade', 
                name: 'Fade', 
                description: 'Muncul dan menghilang perlahan',
                css: '@keyframes fadeAnim { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }'
            },
            { 
                id: 'slide', 
                name: 'Slide', 
                description: 'Bergeser dari kiri ke kanan',
                css: '@keyframes slideAnim { 0% { transform: translateX(-10px); opacity: 0.5; } 50% { transform: translateX(10px); opacity: 1; } 100% { transform: translateX(-10px); opacity: 0.5; } }'
            },
            { 
                id: 'bounce', 
                name: 'Bounce', 
                description: 'Memantul seperti bola',
                css: '@keyframes bounceAnim { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }'
            },
            { 
                id: 'pulse', 
                name: 'Pulse', 
                description: 'Berdenyut membesar dan mengecil',
                css: '@keyframes pulseAnim { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }'
            },
            { 
                id: 'shake', 
                name: 'Shake', 
                description: 'Gemetar seperti digoyang',
                css: '@keyframes shakeAnim { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); } 20%, 40%, 60%, 80% { transform: translateX(3px); } }'
            },
            { 
                id: 'glitch', 
                name: 'Glitch', 
                description: 'Efek glitch digital',
                css: '@keyframes glitchAnim { 0% { text-shadow: 2px 0 red, -2px 0 blue; } 25% { text-shadow: -2px 0 red, 2px 0 blue; } 50% { text-shadow: 2px 0 blue, -2px 0 red; } 75% { text-shadow: -2px 0 blue, 2px 0 red; } 100% { text-shadow: 2px 0 red, -2px 0 blue; } }'
            },
            { 
                id: 'wave', 
                name: 'Wave', 
                description: 'Bergelombang seperti air',
                css: '@keyframes waveAnim { 0% { transform: skew(0deg); } 20% { transform: skew(2deg); } 40% { transform: skew(-2deg); } 60% { transform: skew(1deg); } 80% { transform: skew(-1deg); } 100% { transform: skew(0deg); } }'
            },
            { 
                id: 'rainbow', 
                name: 'Rainbow', 
                description: 'Warna berubah-ubah',
                css: '@keyframes rainbowAnim { 0% { color: #ff0000; } 17% { color: #ff8800; } 33% { color: #ffff00; } 50% { color: #00ff00; } 67% { color: #0088ff; } 83% { color: #8800ff; } 100% { color: #ff0000; } }'
            },
            { 
                id: 'typing', 
                name: 'Typing', 
                description: 'Efek seperti diketik',
                css: '@keyframes typingAnim { from { width: 0; } to { width: 100%; } } .typing-container { display: inline-block; overflow: hidden; white-space: nowrap; border-right: 2px solid; animation: typingAnim 3s steps(30, end) infinite, blink-caret 0.75s step-end infinite; }'
            }
        ],
        
        // Durasi animasi (detik)
        durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        
        // Delay animasi (detik)
        delays: [0, 0.5, 1, 1.5, 2, 2.5, 3],
        
        // Iterasi animasi
        iterations: ['infinite', '1', '2', '3', '5']
    };

    // ==================== FUNGSI PREVIEW FONT ====================
    window.FontAnimations = {
        /**
         * Memuat font dari Google Fonts
         * @param {string} fontName - Nama font
         * @param {string} fontUrl - URL Google Fonts
         */
        loadFont: function(fontName, fontUrl) {
            if (!fontUrl) return;
            
            // Cek apakah sudah dimuat
            if (document.querySelector(`link[href="${fontUrl}"]`)) return;
            
            const link = document.createElement('link');
            link.href = fontUrl;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
            console.log(`✅ Font loaded: ${fontName}`);
        },
        
        /**
         * Membuat preview font card
         * @param {object} font - Data font
         * @param {boolean} isSelected - Apakah font ini yang dipilih
         * @returns {string} HTML string
         */
        renderFontCard: function(font, isSelected = false) {
            const fontFamily = font.family || `"${font.name}", sans-serif`;
            const selectedClass = isSelected ? 'selected' : '';
            const previewText = font.preview || 'The quick brown fox';
            
            return `
                <div class="font-card ${selectedClass}" data-font="${font.name}" data-family="${fontFamily}" data-url="${font.url || ''}">
                    <div class="font-preview" style="font-family: ${fontFamily};">
                        ${previewText}
                    </div>
                    <div class="font-info">
                        <span class="font-name">${font.name}</span>
                        <span class="font-category">${font.category || 'Sans Serif'}</span>
                        ${font.note ? `<span class="font-note">${font.note}</span>` : ''}
                    </div>
                    ${isSelected ? '<i class="fas fa-check-circle selected-icon"></i>' : ''}
                </div>
            `;
        },
        
        /**
         * Membuat preview animasi card
         * @param {object} anim - Data animasi
         * @param {boolean} isSelected - Apakah animasi ini yang dipilih
         * @param {string} previewText - Teks untuk preview
         * @returns {string} HTML string
         */
        renderAnimationCard: function(anim, isSelected = false, previewText = 'Animasi Teks') {
            const selectedClass = isSelected ? 'selected' : '';
            const animId = anim.id;
            const animName = anim.name;
            const animDesc = anim.description;
            
            // Buat style unik untuk preview
            const styleId = `anim-style-${animId}`;
            let animStyle = '';
            
            if (anim.css && animId !== 'none') {
                animStyle = `
                    <style id="${styleId}">
                        ${anim.css}
                        .preview-${animId} {
                            animation: ${animId.replace('Anim', '')} 2s infinite;
                        }
                    </style>
                `;
            }
            
            return `
                <div class="animation-card ${selectedClass}" data-animation="${animId}">
                    ${animStyle}
                    <div class="animation-preview preview-${animId}">
                        ${previewText}
                    </div>
                    <div class="animation-info">
                        <span class="animation-name">${animName}</span>
                        <span class="animation-desc">${animDesc}</span>
                    </div>
                    ${isSelected ? '<i class="fas fa-check-circle selected-icon"></i>' : ''}
                </div>
            `;
        },
        
        /**
         * Membuat kontrol animasi (durasi, delay, iterasi)
         * @param {object} currentSettings - Setting saat ini { duration, delay, iteration }
         * @returns {string} HTML string
         */
        renderAnimationControls: function(currentSettings = {}) {
            const duration = currentSettings.duration || 2;
            const delay = currentSettings.delay || 0;
            const iteration = currentSettings.iteration || 'infinite';
            
            let durationOptions = '';
            window.ANIMATION_DATA.durations.forEach(d => {
                durationOptions += `<option value="${d}" ${d == duration ? 'selected' : ''}>${d} detik</option>`;
            });
            
            let delayOptions = '';
            window.ANIMATION_DATA.delays.forEach(d => {
                delayOptions += `<option value="${d}" ${d == delay ? 'selected' : ''}>${d} detik</option>`;
            });
            
            let iterationOptions = '';
            window.ANIMATION_DATA.iterations.forEach(i => {
                let label = i === 'infinite' ? 'Tak Terbatas' : `${i}x`;
                iterationOptions += `<option value="${i}" ${i == iteration ? 'selected' : ''}>${label}</option>`;
            });
            
            return `
                <div class="animation-controls">
                    <div class="control-group">
                        <label><i class="fas fa-clock"></i> Durasi</label>
                        <select id="animDuration">
                            ${durationOptions}
                        </select>
                    </div>
                    <div class="control-group">
                        <label><i class="fas fa-hourglass-half"></i> Delay</label>
                        <select id="animDelay">
                            ${delayOptions}
                        </select>
                    </div>
                    <div class="control-group">
                        <label><i class="fas fa-redo-alt"></i> Perulangan</label>
                        <select id="animIteration">
                            ${iterationOptions}
                        </select>
                    </div>
                </div>
            `;
        },
        
        /**
         * Mengupdate preview animasi berdasarkan setting
         * @param {string} animId - ID animasi
         * @param {object} settings - { duration, delay, iteration }
         * @param {HTMLElement} previewElement - Elemen preview
         */
        updateAnimationPreview: function(animId, settings, previewElement) {
            if (!previewElement) return;
            
            if (animId === 'none') {
                previewElement.style.animation = 'none';
                return;
            }
            
            const duration = settings.duration || 2;
            const delay = settings.delay || 0;
            const iteration = settings.iteration || 'infinite';
            
            // Nama animasi dari CSS keyframes (tanpa 'Anim')
            const animName = animId.replace('Anim', '');
            
            previewElement.style.animation = `${animName} ${duration}s ${delay}s ${iteration}`;
        },
        
        /**
         * Mendapatkan semua font (built-in + custom)
         */
        getAllFonts: function() {
            return [
                ...window.FONT_DATA.fonts,
                ...window.FONT_DATA.customFonts
            ];
        }
    };

    // Load semua font dari Google Fonts saat halaman dimuat
    document.addEventListener('DOMContentLoaded', function() {
        window.FONT_DATA.fonts.forEach(font => {
            if (font.url) {
                window.FontAnimations.loadFont(font.name, font.url);
            }
        });
    });

})();

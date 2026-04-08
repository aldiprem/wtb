// TGS Sticker Editor - Full Features dengan Animasi Bergerak
class TGSStickerEditor {
    constructor() {
        this.stickers = [];
        this.selectedStickerId = null;
        this.canvas = document.getElementById('stickerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.stickersContainer = document.getElementById('stickerElements');
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.animations = new Map(); // Simpan instance Lottie per sticker
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUpload();
        this.renderBackground();
    }
    
    setupCanvas() {
        this.canvas.width = 1200;
        this.canvas.height = 800;
        this.drawGrid();
    }
    
    drawGrid() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        const gridSize = 20;
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    renderBackground() {
        this.drawGrid();
        // Canvas background only, stickers rendered as HTML elements with Lottie
    }
    
    async loadSticker(file) {
        try {
            const compressed = await this.readFile(file);
            const decompressed = pako.ungzip(compressed, { to: 'string' });
            const animationData = JSON.parse(decompressed);
            
            const sticker = {
                id: Date.now() + Math.random(),
                file: file,
                animationData: animationData,
                x: Math.random() * (this.canvas.width - 200),
                y: Math.random() * (this.canvas.height - 200),
                width: 150,
                height: 150,
                scale: 1,
                rotation: 0,
                zIndex: this.stickers.length,
                isPlaying: true
            };
            
            this.stickers.push(sticker);
            await this.createStickerElement(sticker);
            this.updateInfo();
            
            return sticker;
        } catch (err) {
            console.error(err);
            alert('Error loading sticker: ' + err.message);
        }
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(new Uint8Array(e.target.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    async createStickerElement(sticker) {
        const div = document.createElement('div');
        div.className = 'sticker-item';
        div.id = `sticker-${sticker.id}`;
        div.style.left = `${sticker.x}px`;
        div.style.top = `${sticker.y}px`;
        div.style.width = `${sticker.width}px`;
        div.style.height = `${sticker.height}px`;
        div.style.transform = `rotate(${sticker.rotation}deg) scale(${sticker.scale})`;
        div.style.zIndex = sticker.zIndex;
        div.style.position = 'absolute';
        div.style.overflow = 'hidden';
        
        // Container untuk Lottie animation
        const lottieContainer = document.createElement('div');
        lottieContainer.id = `lottie-${sticker.id}`;
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        lottieContainer.style.pointerEvents = 'none';
        
        div.appendChild(lottieContainer);
        
        // Create handles
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        
        div.appendChild(resizeHandle);
        div.appendChild(rotateHandle);
        
        // Event listeners
        div.addEventListener('mousedown', (e) => this.onStickerMouseDown(e, sticker));
        resizeHandle.addEventListener('mousedown', (e) => this.onResizeStart(e, sticker));
        rotateHandle.addEventListener('mousedown', (e) => this.onRotateStart(e, sticker));
        
        this.stickersContainer.appendChild(div);
        
        // Load Lottie animation
        const anim = lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'svg',
            loop: true,
            autoplay: sticker.isPlaying,
            animationData: sticker.animationData,
            rendererSettings: {
                preserveAspectRatio: 'xMidYMid meet'
            }
        });
        
        this.animations.set(sticker.id, anim);
    }
    
    onStickerMouseDown(e, sticker) {
        // Jangan trigger jika klik di handle
        if (e.target.classList.contains('resize-handle') || 
            e.target.classList.contains('rotate-handle')) {
            return;
        }
        
        e.stopPropagation();
        this.selectSticker(sticker.id);
        
        this.isDragging = true;
        this.dragStartX = e.clientX - sticker.x;
        this.dragStartY = e.clientY - sticker.y;
        
        const onMouseMove = (moveEvent) => {
            if (!this.isDragging) return;
            
            let newX = moveEvent.clientX - this.dragStartX;
            let newY = moveEvent.clientY - this.dragStartY;
            
            newX = Math.max(0, Math.min(newX, this.canvas.width - sticker.width));
            newY = Math.max(0, Math.min(newY, this.canvas.height - sticker.height));
            
            sticker.x = newX;
            sticker.y = newY;
            
            const element = document.getElementById(`sticker-${sticker.id}`);
            if (element) {
                element.style.left = `${sticker.x}px`;
                element.style.top = `${sticker.y}px`;
            }
        };
        
        const onMouseUp = () => {
            this.isDragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
    
    onResizeStart(e, sticker) {
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = sticker.width;
        
        const onMouseMove = (moveEvent) => {
            const delta = moveEvent.clientX - startX;
            const newWidth = Math.max(50, Math.min(500, startWidth + delta));
            sticker.width = newWidth;
            sticker.height = newWidth;
            
            const element = document.getElementById(`sticker-${sticker.id}`);
            if (element) {
                element.style.width = `${sticker.width}px`;
                element.style.height = `${sticker.height}px`;
            }
        };
        
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
    
    onRotateStart(e, sticker) {
        e.stopPropagation();
        const rect = document.getElementById(`sticker-${sticker.id}`).getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const getAngle = (clientX, clientY) => {
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            return Math.atan2(dy, dx) * 180 / Math.PI;
        };
        
        const startAngle = getAngle(e.clientX, e.clientY);
        const startRotation = sticker.rotation;
        
        const onMouseMove = (moveEvent) => {
            const currentAngle = getAngle(moveEvent.clientX, moveEvent.clientY);
            let delta = currentAngle - startAngle;
            sticker.rotation = startRotation + delta;
            
            const element = document.getElementById(`sticker-${sticker.id}`);
            if (element) {
                element.style.transform = `rotate(${sticker.rotation}deg) scale(${sticker.scale})`;
            }
        };
        
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
    
    selectSticker(id) {
        this.selectedStickerId = id;
        
        document.querySelectorAll('.sticker-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        const selectedElement = document.getElementById(`sticker-${id}`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        document.getElementById('selectedInfo').innerText = id.toString().slice(-8);
    }
    
    toggleAnimation() {
        if (!this.selectedStickerId) {
            alert('Pilih sticker dulu dengan klik pada sticker');
            return;
        }
        
        const sticker = this.stickers.find(s => s.id === this.selectedStickerId);
        const anim = this.animations.get(this.selectedStickerId);
        
        if (sticker && anim) {
            if (sticker.isPlaying) {
                anim.pause();
                sticker.isPlaying = false;
            } else {
                anim.play();
                sticker.isPlaying = true;
            }
        }
    }
    
    stopAllAnimations() {
        this.animations.forEach((anim, id) => {
            anim.pause();
            const sticker = this.stickers.find(s => s.id === id);
            if (sticker) sticker.isPlaying = false;
        });
    }
    
    playAllAnimations() {
        this.animations.forEach((anim, id) => {
            anim.play();
            const sticker = this.stickers.find(s => s.id === id);
            if (sticker) sticker.isPlaying = true;
        });
    }
    
    clearAllStickers() {
        // Hentikan dan hapus semua animasi
        this.animations.forEach((anim) => {
            anim.destroy();
        });
        this.animations.clear();
        
        this.stickers = [];
        this.stickersContainer.innerHTML = '';
        this.selectedStickerId = null;
        this.updateInfo();
        document.getElementById('selectedInfo').innerText = 'None';
    }
    
    updateInfo() {
        document.getElementById('totalStickers').innerText = this.stickers.length;
    }
    
    exportAsPNG() {
        // Pause semua animasi dulu
        const wasPlaying = [];
        this.animations.forEach((anim, id) => {
            wasPlaying[id] = !anim.isPaused;
            anim.pause();
        });
        
        setTimeout(() => {
            html2canvas(this.stickersContainer.parentElement, {
                scale: 2,
                backgroundColor: '#ffffff'
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `sticker-export-${Date.now()}.png`;
                link.href = canvas.toDataURL();
                link.click();
                
                // Resume animasi
                this.animations.forEach((anim, id) => {
                    if (wasPlaying[id]) {
                        anim.play();
                    }
                });
            });
        }, 100);
    }
    
    setupEventListeners() {
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllStickers());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportAsPNG());
        
        // Tombol Play/Pause untuk sticker yang dipilih
        const controlPanel = document.createElement('div');
        controlPanel.className = 'animation-controls';
        controlPanel.innerHTML = `
            <button id="toggleAnimBtn" class="btn btn-warning">⏯️ Play/Pause Selected</button>
            <button id="stopAllBtn" class="btn btn-warning">⏹️ Stop All</button>
            <button id="playAllBtn" class="btn btn-success">▶️ Play All</button>
        `;
        document.querySelector('.controls').appendChild(controlPanel);
        
        document.getElementById('toggleAnimBtn').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('stopAllBtn').addEventListener('click', () => this.stopAllAnimations());
        document.getElementById('playAllBtn').addEventListener('click', () => this.playAllAnimations());
        
        document.getElementById('addMoreInput').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                await this.loadSticker(file);
            }
            e.target.value = '';
        });
    }
    
    setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.tgs';
        fileInput.multiple = true;
        
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                await this.loadSticker(file);
            }
        };
        
        uploadArea.onclick = () => fileInput.click();
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#00ff88';
            uploadArea.style.background = 'rgba(0,255,136,0.2)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
            uploadArea.style.background = 'rgba(255,255,255,0.05)';
        });
        
        uploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
            uploadArea.style.background = 'rgba(255,255,255,0.05)';
            
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.tgs'));
            for (const file of files) {
                await this.loadSticker(file);
            }
        });
    }
}

// Initialize
const editor = new TGSStickerEditor();
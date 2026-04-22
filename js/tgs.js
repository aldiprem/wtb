// TGS Sticker Studio - Full Features

class TGSStudio {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvasContainer');
        this.stickerLayer = document.getElementById('stickerLayer');
        this.stickers = [];
        this.selectedId = null;
        this.animations = new Map();
        this.bgColor = '#ffffff';
        this.pattern = 'none';
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.isResizing = false;
        this.isRotating = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderBackground();
    }

    setupEventListeners() {
        // Canvas resize
        document.getElementById('resizeCanvasBtn').addEventListener('click', () => this.resizeCanvas());
        
        // Background presets
        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setBackground(btn.dataset.bg));
        });
        
        // Custom color
        document.getElementById('customColorPicker').addEventListener('change', (e) => {
            this.bgColor = e.target.value;
            this.pattern = 'none';
            this.renderBackground();
            document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.pattern-btn[data-pattern="none"]')?.classList.add('active');
        });
        
        // Pattern
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pattern = btn.dataset.pattern;
                this.renderBackground();
                document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Actions
        document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('duplicateBtn').addEventListener('click', () => this.duplicateSticker());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSticker());
        document.getElementById('bringToFrontBtn').addEventListener('click', () => this.bringToFront());
        document.getElementById('sendToBackBtn').addEventListener('click', () => this.sendToBack());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportPNG());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        
        // File upload
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFiles(e.target.files));
        
        // Drag & drop
        const uploadMini = document.getElementById('uploadMini');
        uploadMini.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadMini.style.borderColor = '#00ff88';
        });
        uploadMini.addEventListener('dragleave', () => {
            uploadMini.style.borderColor = 'rgba(255,255,255,0.2)';
        });
        uploadMini.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadMini.style.borderColor = 'rgba(255,255,255,0.2)';
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.tgs'));
            this.handleFiles(files);
        });
    }

    resizeCanvas() {
        const width = parseInt(document.getElementById('canvasWidth').value);
        const height = parseInt(document.getElementById('canvasHeight').value);
        
        if (width > 0 && height > 0 && width <= 4000 && height <= 4000) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.container.style.width = `${width}px`;
            this.container.style.height = `${height}px`;
            this.renderBackground();
            
            // Reposition stickers if they go out of bounds
            this.stickers.forEach(sticker => {
                sticker.x = Math.min(sticker.x, width - sticker.width);
                sticker.y = Math.min(sticker.y, height - sticker.height);
                sticker.x = Math.max(0, sticker.x);
                sticker.y = Math.max(0, sticker.y);
                this.updateStickerElement(sticker);
            });
        }
    }

    setBackground(type) {
        switch(type) {
            case 'white':
                this.bgColor = '#ffffff';
                this.pattern = 'none';
                break;
            case 'black':
                this.bgColor = '#0a0a0a';
                this.pattern = 'none';
                break;
            case 'transparent':
                this.bgColor = 'transparent';
                this.pattern = 'none';
                break;
            case 'grid':
                this.bgColor = '#ffffff';
                this.pattern = 'grid';
                break;
        }
        this.renderBackground();
        
        document.querySelectorAll('.bg-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.bg-btn.${type}`)?.classList.add('active');
        
        if (type !== 'grid') {
            document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.pattern-btn[data-pattern="none"]')?.classList.add('active');
        }
    }

    renderBackground() {
        // Clear canvas
        if (this.bgColor === 'transparent') {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = this.bgColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        const size = 20;
        
        switch(this.pattern) {
            case 'dots':
                this.ctx.fillStyle = '#cccccc';
                for (let x = size/2; x < this.canvas.width; x += size) {
                    for (let y = size/2; y < this.canvas.height; y += size) {
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
                break;
                
            case 'lines':
                this.ctx.strokeStyle = '#dddddd';
                this.ctx.lineWidth = 1;
                for (let x = 0; x < this.canvas.width; x += size) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.canvas.height);
                    this.ctx.stroke();
                }
                for (let y = 0; y < this.canvas.height; y += size) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.canvas.width, y);
                    this.ctx.stroke();
                }
                break;
                
            case 'cross':
                this.ctx.strokeStyle = '#dddddd';
                this.ctx.lineWidth = 1;
                for (let x = size/2; x < this.canvas.width; x += size) {
                    for (let y = size/2; y < this.canvas.height; y += size) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x - 5, y);
                        this.ctx.lineTo(x + 5, y);
                        this.ctx.moveTo(x, y - 5);
                        this.ctx.lineTo(x, y + 5);
                        this.ctx.stroke();
                    }
                }
                break;
                
            case 'grid':
                this.ctx.strokeStyle = '#dddddd';
                this.ctx.lineWidth = 1;
                const gridSize = 25;
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
                break;
        }
    }

    async handleFiles(files) {
        for (const file of files) {
            await this.loadSticker(file);
        }
        document.getElementById('fileInput').value = '';
        this.updateInfo();
    }

    async loadSticker(file) {
        try {
            const arrayBuffer = await this.readFile(file);
            const compressed = new Uint8Array(arrayBuffer);
            let animationData;
            
            try {
                const decompressed = pako.ungzip(compressed, { to: 'string' });
                animationData = JSON.parse(decompressed);
            } catch(e) {
                const text = new TextDecoder().decode(compressed);
                animationData = JSON.parse(text);
            }
            
            const sticker = {
                id: Date.now() + Math.random(),
                file: file.name,
                animationData: animationData,
                x: (this.canvas.width / 2) - 75,
                y: (this.canvas.height / 2) - 75,
                width: 150,
                height: 150,
                scale: 1,
                rotation: 0,
                zIndex: this.stickers.length
            };
            
            this.stickers.push(sticker);
            await this.createStickerElement(sticker);
            this.updateInfo();
            
        } catch(err) {
            console.error(err);
            alert('Error loading sticker: ' + err.message);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
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
        div.style.transform = `rotate(${sticker.rotation}deg)`;
        div.style.zIndex = sticker.zIndex;
        
        const lottieContainer = document.createElement('div');
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        lottieContainer.style.pointerEvents = 'none';
        div.appendChild(lottieContainer);
        
        // Handles
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: -8px;
            right: -8px;
            width: 16px;
            height: 16px;
            background: #00ff88;
            border-radius: 50%;
            cursor: nw-resize;
            display: none;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        `;
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 16px;
            height: 16px;
            background: #ffaa00;
            border-radius: 50%;
            cursor: grab;
            display: none;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        `;
        
        div.appendChild(resizeHandle);
        div.appendChild(rotateHandle);
        
        // Events
        div.addEventListener('mousedown', (e) => this.onStickerMouseDown(e, sticker));
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.onResizeStart(e, sticker);
        });
        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.onRotateStart(e, sticker);
        });
        
        this.stickerLayer.appendChild(div);
        
        const anim = lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: sticker.animationData,
            rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
        });
        
        this.animations.set(sticker.id, anim);
    }

    updateStickerElement(sticker) {
        const element = document.getElementById(`sticker-${sticker.id}`);
        if (element) {
            element.style.left = `${sticker.x}px`;
            element.style.top = `${sticker.y}px`;
            element.style.width = `${sticker.width}px`;
            element.style.height = `${sticker.height}px`;
            element.style.transform = `rotate(${sticker.rotation}deg)`;
            element.style.zIndex = sticker.zIndex;
        }
    }

    selectSticker(id) {
        this.selectedId = id;
        document.querySelectorAll('.sticker-item').forEach(el => el.classList.remove('selected'));
        const selected = document.getElementById(`sticker-${id}`);
        if (selected) {
            selected.classList.add('selected');
            // Show handles
            const handles = selected.querySelectorAll('.resize-handle, .rotate-handle');
            handles.forEach(h => h.style.display = 'block');
        }
        document.getElementById('selectedId').innerText = id ? id.toString().slice(-8) : 'None';
    }

    onStickerMouseDown(e, sticker) {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
        
        e.stopPropagation();
        this.selectSticker(sticker.id);
        
        this.isDragging = true;
        this.dragStart = {
            x: e.clientX - sticker.x,
            y: e.clientY - sticker.y
        };
        
        const onMouseMove = (moveEvent) => {
            if (!this.isDragging) return;
            let newX = moveEvent.clientX - this.dragStart.x;
            let newY = moveEvent.clientY - this.dragStart.y;
            newX = Math.max(0, Math.min(newX, this.canvas.width - sticker.width));
            newY = Math.max(0, Math.min(newY, this.canvas.height - sticker.height));
            sticker.x = newX;
            sticker.y = newY;
            this.updateStickerElement(sticker);
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
        const startX = e.clientX;
        const startWidth = sticker.width;
        
        const onMouseMove = (moveEvent) => {
            const delta = moveEvent.clientX - startX;
            const newWidth = Math.max(40, Math.min(500, startWidth + delta));
            sticker.width = newWidth;
            sticker.height = newWidth;
            this.updateStickerElement(sticker);
        };
        
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    onRotateStart(e, sticker) {
        const element = document.getElementById(`sticker-${sticker.id}`);
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const getAngle = (clientX, clientY) => Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
        const startAngle = getAngle(e.clientX, e.clientY);
        const startRotation = sticker.rotation;
        
        const onMouseMove = (moveEvent) => {
            const currentAngle = getAngle(moveEvent.clientX, moveEvent.clientY);
            let delta = currentAngle - startAngle;
            sticker.rotation = startRotation + delta;
            this.updateStickerElement(sticker);
        };
        
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    duplicateSticker() {
        if (!this.selectedId) {
            alert('Select a sticker first!');
            return;
        }
        const original = this.stickers.find(s => s.id === this.selectedId);
        if (!original) return;
        
        const newSticker = {
            ...original,
            id: Date.now() + Math.random(),
            x: original.x + 30,
            y: original.y + 30,
            zIndex: this.stickers.length
        };
        
        this.stickers.push(newSticker);
        this.createStickerElement(newSticker);
        this.selectSticker(newSticker.id);
        this.updateInfo();
    }

    deleteSticker() {
        if (!this.selectedId) {
            alert('Select a sticker first!');
            return;
        }
        const index = this.stickers.findIndex(s => s.id === this.selectedId);
        if (index !== -1) {
            const anim = this.animations.get(this.selectedId);
            if (anim) anim.destroy();
            this.animations.delete(this.selectedId);
            document.getElementById(`sticker-${this.selectedId}`)?.remove();
            this.stickers.splice(index, 1);
            this.selectedId = null;
            this.updateInfo();
            document.getElementById('selectedId').innerText = 'None';
        }
    }

    bringToFront() {
        if (!this.selectedId) return;
        const sticker = this.stickers.find(s => s.id === this.selectedId);
        if (sticker) {
            sticker.zIndex = this.stickers.length;
            this.stickers.sort((a, b) => a.zIndex - b.zIndex);
            this.stickers.forEach((s, i) => {
                s.zIndex = i;
                this.updateStickerElement(s);
            });
            this.selectSticker(sticker.id);
        }
    }

    sendToBack() {
        if (!this.selectedId) return;
        const sticker = this.stickers.find(s => s.id === this.selectedId);
        if (sticker) {
            sticker.zIndex = -1;
            this.stickers.sort((a, b) => a.zIndex - b.zIndex);
            this.stickers.forEach((s, i) => {
                s.zIndex = i;
                this.updateStickerElement(s);
            });
            this.selectSticker(sticker.id);
        }
    }

    clearAll() {
        if (confirm('Clear all stickers?')) {
            this.animations.forEach(anim => anim.destroy());
            this.animations.clear();
            this.stickers = [];
            this.stickerLayer.innerHTML = '';
            this.selectedId = null;
            this.updateInfo();
            document.getElementById('selectedId').innerText = 'None';
        }
    }

    async exportPNG() {
        // Pause animations
        const wasPlaying = [];
        this.animations.forEach((anim, id) => {
            wasPlaying[id] = !anim.isPaused;
            anim.pause();
        });
        
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(this.container, {
                    scale: 2,
                    backgroundColor: this.bgColor === 'transparent' ? null : this.bgColor,
                    useCORS: true,
                    logging: false
                });
                const link = document.createElement('a');
                link.download = `tgs-export-${Date.now()}.png`;
                link.href = canvas.toDataURL();
                link.click();
            } catch(err) {
                console.error(err);
                alert('Export failed: ' + err.message);
            }
            
            // Resume animations
            this.animations.forEach((anim, id) => {
                if (wasPlaying[id]) anim.play();
            });
        }, 100);
    }

    updateInfo() {
        document.getElementById('stickerCount').innerText = this.stickers.length;
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.studio = new TGSStudio();
});
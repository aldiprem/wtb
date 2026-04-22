// TGS Editor - Full Service Animation Studio
// Version 2.0 - No Bugs

class TGSEditor {
    constructor() {
        // DOM Elements
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvasContainer');
        this.stickerLayer = document.getElementById('stickerLayer');
        
        // State
        this.stickers = [];
        this.selectedId = null;
        this.animations = new Map();
        this.bgColor = '#ffffff';
        this.pattern = 'none';
        
        // Drag state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.isResizing = false;
        this.isRotating = false;
        this.resizeStart = { width: 0, x: 0 };
        this.rotateStart = { rotation: 0, angle: 0 };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderBackground();
        this.showToast('TGS Editor ready! Upload your .tgs files', 'success');
    }

    setupEventListeners() {
        // Canvas resize
        const resizeBtn = document.getElementById('resizeCanvasBtn');
        if (resizeBtn) {
            resizeBtn.addEventListener('click', () => this.resizeCanvas());
        }
        
        // Preset sizes
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);
                document.getElementById('canvasWidth').value = width;
                document.getElementById('canvasHeight').value = height;
                this.resizeCanvas(width, height);
            });
        });
        
        // Background presets
        document.querySelectorAll('.bg-option').forEach(btn => {
            btn.addEventListener('click', () => this.setBackground(btn.dataset.bg));
        });
        
        // Custom color
        const colorPicker = document.getElementById('customColorPicker');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.bgColor = e.target.value;
                this.pattern = 'none';
                this.renderBackground();
                this.updateActivePattern('none');
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('active'));
            });
        }
        
        // Pattern
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pattern = btn.dataset.pattern;
                this.renderBackground();
                this.updateActivePattern(btn.dataset.pattern);
            });
        });
        
        // Actions
        const duplicateBtn = document.getElementById('duplicateBtn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.duplicateSticker());
        
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSticker());
        
        const bringToFrontBtn = document.getElementById('bringToFrontBtn');
        if (bringToFrontBtn) bringToFrontBtn.addEventListener('click', () => this.bringToFront());
        
        const sendToBackBtn = document.getElementById('sendToBackBtn');
        if (sendToBackBtn) sendToBackBtn.addEventListener('click', () => this.sendToBack());
        
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportPNG());
        
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.showClearModal());
        
        // Upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#40a7e3';
                uploadArea.style.background = 'rgba(64, 167, 227, 0.1)';
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = '';
                uploadArea.style.background = '';
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '';
                uploadArea.style.background = '';
                const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.tgs'));
                this.handleFiles(files);
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFiles(Array.from(e.target.files)));
        }
        
        // Modal
        const modal = document.getElementById('confirmModal');
        const modalCancel = document.getElementById('modalCancelBtn');
        const modalConfirm = document.getElementById('modalConfirmBtn');
        
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        if (modalConfirm) {
            modalConfirm.addEventListener('click', () => {
                modal.style.display = 'none';
                this.clearAll();
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedId) {
                this.deleteSticker();
            }
            if (e.key === 'Escape' && this.selectedId) {
                this.selectSticker(null);
            }
        });
    }

    updateActivePattern(pattern) {
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            if (btn.dataset.pattern === pattern) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    showClearModal() {
        const modal = document.getElementById('confirmModal');
        if (modal) modal.style.display = 'flex';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    resizeCanvas(width = null, height = null) {
        const newWidth = width !== null ? width : parseInt(document.getElementById('canvasWidth').value);
        const newHeight = height !== null ? height : parseInt(document.getElementById('canvasHeight').value);
        
        if (isNaN(newWidth) || isNaN(newHeight) || newWidth < 100 || newHeight < 100 || newWidth > 4000 || newHeight > 4000) {
            this.showToast('Invalid canvas size! Min 100x100, Max 4000x4000', 'error');
            return;
        }
        
        // Save old dimensions
        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;
        
        // Resize canvas
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.container.style.width = `${newWidth}px`;
        this.container.style.height = `${newHeight}px`;
        
        // Reposition stickers if they go out of bounds
        this.stickers.forEach(sticker => {
            sticker.x = Math.min(sticker.x, newWidth - sticker.width);
            sticker.y = Math.min(sticker.y, newHeight - sticker.height);
            sticker.x = Math.max(0, sticker.x);
            sticker.y = Math.max(0, sticker.y);
            this.updateStickerElement(sticker);
        });
        
        this.renderBackground();
        this.showToast(`Canvas resized to ${newWidth}x${newHeight}`, 'success');
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
        this.updateActivePattern('none');
        
        // Update active state for bg options
        document.querySelectorAll('.bg-option').forEach(opt => {
            if (opt.dataset.bg === type) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
        
        if (type !== 'grid') {
            this.updateActivePattern('none');
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
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';
        this.updateInfo();
    }

    async loadSticker(file) {
        try {
            const arrayBuffer = await this.readFile(file);
            const compressed = new Uint8Array(arrayBuffer);
            let animationData;
            
            try {
                // Try to decompress as gzipped JSON (TGS format)
                const decompressed = pako.ungzip(compressed, { to: 'string' });
                animationData = JSON.parse(decompressed);
            } catch(e) {
                // Not compressed, try to parse as JSON directly
                const text = new TextDecoder().decode(compressed);
                animationData = JSON.parse(text);
            }
            
            const sticker = {
                id: Date.now() + Math.random(),
                name: file.name,
                animationData: animationData,
                x: Math.max(50, (this.canvas.width / 2) - 75),
                y: Math.max(50, (this.canvas.height / 2) - 75),
                width: 150,
                height: 150,
                scale: 1,
                rotation: 0,
                zIndex: this.stickers.length
            };
            
            this.stickers.push(sticker);
            await this.createStickerElement(sticker);
            this.updateInfo();
            this.showToast(`Loaded: ${file.name}`, 'success');
            
        } catch(err) {
            console.error(err);
            this.showToast(`Error loading ${file.name}: ${err.message}`, 'error');
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
        
        // Create handles
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        div.appendChild(resizeHandle);
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        div.appendChild(rotateHandle);
        
        // Events
        div.addEventListener('mousedown', (e) => {
            if (e.target === resizeHandle || e.target === rotateHandle) return;
            e.stopPropagation();
            this.selectSticker(sticker.id);
            this.startDrag(e, sticker);
        });
        
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.selectSticker(sticker.id);
            this.startResize(e, sticker);
        });
        
        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.selectSticker(sticker.id);
            this.startRotate(e, sticker);
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
        // Clear previous selection
        if (this.selectedId !== null) {
            const prevElement = document.getElementById(`sticker-${this.selectedId}`);
            if (prevElement) prevElement.classList.remove('selected');
        }
        
        this.selectedId = id;
        
        // Update UI
        document.querySelectorAll('.sticker-item').forEach(el => el.classList.remove('selected'));
        
        if (id !== null) {
            const selected = document.getElementById(`sticker-${id}`);
            if (selected) {
                selected.classList.add('selected');
            }
            document.getElementById('selectedId').innerText = id.toString().slice(-8);
        } else {
            document.getElementById('selectedId').innerText = 'None';
        }
    }

    startDrag(e, sticker) {
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

    startResize(e, sticker) {
        this.isResizing = true;
        this.resizeStart = {
            width: sticker.width,
            x: e.clientX
        };
        
        const onMouseMove = (moveEvent) => {
            if (!this.isResizing) return;
            const delta = moveEvent.clientX - this.resizeStart.x;
            const newWidth = Math.max(40, Math.min(500, this.resizeStart.width + delta));
            sticker.width = newWidth;
            sticker.height = newWidth;
            this.updateStickerElement(sticker);
        };
        
        const onMouseUp = () => {
            this.isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    startRotate(e, sticker) {
        const element = document.getElementById(`sticker-${sticker.id}`);
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const getAngle = (clientX, clientY) => Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
        
        this.isRotating = true;
        this.rotateStart = {
            rotation: sticker.rotation,
            angle: getAngle(e.clientX, e.clientY)
        };
        
        const onMouseMove = (moveEvent) => {
            if (!this.isRotating) return;
            const currentAngle = getAngle(moveEvent.clientX, moveEvent.clientY);
            let delta = currentAngle - this.rotateStart.angle;
            sticker.rotation = this.rotateStart.rotation + delta;
            this.updateStickerElement(sticker);
        };
        
        const onMouseUp = () => {
            this.isRotating = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    duplicateSticker() {
        if (this.selectedId === null) {
            this.showToast('Select a sticker first!', 'warning');
            return;
        }
        
        const original = this.stickers.find(s => s.id === this.selectedId);
        if (!original) return;
        
        const newSticker = {
            ...original,
            id: Date.now() + Math.random(),
            name: `${original.name} (copy)`,
            x: Math.min(this.canvas.width - original.width, original.x + 30),
            y: Math.min(this.canvas.height - original.height, original.y + 30),
            zIndex: this.stickers.length
        };
        
        this.stickers.push(newSticker);
        this.createStickerElement(newSticker);
        this.selectSticker(newSticker.id);
        this.updateInfo();
        this.showToast('Sticker duplicated!', 'success');
    }

    deleteSticker() {
        if (this.selectedId === null) {
            this.showToast('Select a sticker first!', 'warning');
            return;
        }
        
        const index = this.stickers.findIndex(s => s.id === this.selectedId);
        if (index !== -1) {
            const anim = this.animations.get(this.selectedId);
            if (anim) anim.destroy();
            this.animations.delete(this.selectedId);
            
            const element = document.getElementById(`sticker-${this.selectedId}`);
            if (element) element.remove();
            
            this.stickers.splice(index, 1);
            this.selectedId = null;
            this.updateInfo();
            document.getElementById('selectedId').innerText = 'None';
            this.showToast('Sticker deleted', 'success');
        }
    }

    bringToFront() {
        if (this.selectedId === null) return;
        
        const sticker = this.stickers.find(s => s.id === this.selectedId);
        if (sticker) {
            sticker.zIndex = this.stickers.length;
            this.stickers.sort((a, b) => a.zIndex - b.zIndex);
            this.stickers.forEach((s, i) => {
                s.zIndex = i;
                this.updateStickerElement(s);
            });
            this.selectSticker(sticker.id);
            this.showToast('Brought to front', 'success');
        }
    }

    sendToBack() {
        if (this.selectedId === null) return;
        
        const sticker = this.stickers.find(s => s.id === this.selectedId);
        if (sticker) {
            sticker.zIndex = -1;
            this.stickers.sort((a, b) => a.zIndex - b.zIndex);
            this.stickers.forEach((s, i) => {
                s.zIndex = i;
                this.updateStickerElement(s);
            });
            this.selectSticker(sticker.id);
            this.showToast('Sent to back', 'success');
        }
    }

    clearAll() {
        // Destroy all animations
        this.animations.forEach(anim => anim.destroy());
        this.animations.clear();
        
        // Clear stickers array
        this.stickers = [];
        
        // Clear DOM
        this.stickerLayer.innerHTML = '';
        
        // Reset selection
        this.selectedId = null;
        
        // Update UI
        this.updateInfo();
        document.getElementById('selectedId').innerText = 'None';
        
        this.showToast('All stickers cleared', 'success');
    }

    async exportPNG() {
        // Pause all animations
        const wasPlaying = [];
        this.animations.forEach((anim, id) => {
            wasPlaying[id] = !anim.isPaused;
            anim.pause();
        });
        
        // Small delay for animations to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
            const canvas = await html2canvas(this.container, {
                scale: 2,
                backgroundColor: this.bgColor === 'transparent' ? null : this.bgColor,
                useCORS: true,
                logging: false,
                allowTaint: false
            });
            
            const link = document.createElement('a');
            link.download = `tgs-export-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            this.showToast('Export completed!', 'success');
        } catch(err) {
            console.error(err);
            this.showToast('Export failed: ' + err.message, 'error');
        }
        
        // Resume animations
        this.animations.forEach((anim, id) => {
            if (wasPlaying[id]) anim.play();
        });
    }

    updateInfo() {
        document.getElementById('stickerCount').innerText = this.stickers.length;
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.tgsEditor = new TGSEditor();
});
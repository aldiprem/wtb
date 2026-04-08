// TGS Sticker Editor - Full Features
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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUpload();
        this.renderBackground();
    }
    
    setupCanvas() {
        // Set canvas size
        this.canvas.width = 1200;
        this.canvas.height = 800;
        
        // Draw grid
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
        // Redraw all stickers
        this.stickers.forEach(sticker => {
            this.renderStickerToCanvas(sticker);
        });
    }
    
    renderStickerToCanvas(sticker) {
        if (!sticker.imageData) return;
        
        this.ctx.save();
        this.ctx.translate(sticker.x + sticker.width / 2, sticker.y + sticker.height / 2);
        this.ctx.rotate(sticker.rotation * Math.PI / 180);
        this.ctx.scale(sticker.scale, sticker.scale);
        this.ctx.drawImage(sticker.imageData, -sticker.width / 2, -sticker.height / 2, sticker.width, sticker.height);
        this.ctx.restore();
    }
                      
    async saveCompositionToServer() {
        const composition = {
            stickers: this.stickers.map(s => ({
                id: s.id,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height,
                scale: s.scale,
                rotation: s.rotation,
                filename: s.file?.name
            }))
        };
        
        try {
            const response = await fetch('/tgs/api/save-composition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ composition: composition })
            });
            const data = await response.json();
            if (data.success) {
                alert('Composition saved! Session ID: ' + data.session_id);
            }
        } catch (err) {
            console.error('Save failed:', err);
        }
    }

    async exportAsZip() {
        const stickersData = this.stickers.map(s => ({
            filename: s.file?.name || `sticker_${s.id}.tgs`,
            data: s.base64Data || null
        })).filter(s => s.data);
        
        if (stickersData.length === 0) {
            alert('No stickers to export');
            return;
        }
        
        try {
            const response = await fetch('/tgs/api/export-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stickers: stickersData })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'stickers_export.zip';
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
    }

    async loadSticker(file) {
        try {
            const compressed = await this.readFile(file);
            const decompressed = pako.ungzip(compressed, { to: 'string' });
            const animationData = JSON.parse(decompressed);
            
            // Render Lottie ke canvas
            const imageData = await this.lottieToImage(animationData);
            
            const sticker = {
                id: Date.now() + Math.random(),
                file: file,
                animationData: animationData,
                imageData: imageData,
                x: Math.random() * (this.canvas.width - 200),
                y: Math.random() * (this.canvas.height - 200),
                width: 150,
                height: 150,
                scale: 1,
                rotation: 0,
                zIndex: this.stickers.length
            };
            
            this.stickers.push(sticker);
            this.createStickerElement(sticker);
            this.renderBackground();
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
    
    lottieToImage(animationData) {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.style.width = '150px';
            container.style.height = '150px';
            container.style.position = 'absolute';
            container.style.opacity = '0';
            document.body.appendChild(container);
            
            const anim = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData
            });
            
            setTimeout(() => {
                const svg = container.querySelector('svg');
                if (svg) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 150;
                    canvas.height = 150;
                    const ctx = canvas.getContext('2d');
                    
                    const img = new Image();
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, 150, 150);
                        URL.revokeObjectURL(url);
                        document.body.removeChild(container);
                        anim.destroy();
                        resolve(canvas);
                    };
                    
                    img.src = url;
                } else {
                    document.body.removeChild(container);
                    anim.destroy();
                    resolve(null);
                }
            }, 500);
        });
    }
    
    createStickerElement(sticker) {
        const div = document.createElement('div');
        div.className = 'sticker-item';
        div.id = `sticker-${sticker.id}`;
        div.style.left = `${sticker.x}px`;
        div.style.top = `${sticker.y}px`;
        div.style.width = `${sticker.width}px`;
        div.style.height = `${sticker.height}px`;
        div.style.transform = `rotate(${sticker.rotation}deg) scale(${sticker.scale})`;
        div.style.zIndex = sticker.zIndex;
        
        // Create img element
        const img = document.createElement('img');
        img.src = sticker.imageData.toDataURL();
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        // Create handles
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        
        div.appendChild(img);
        div.appendChild(resizeHandle);
        div.appendChild(rotateHandle);
        
        // Event listeners
        div.addEventListener('mousedown', (e) => this.onStickerMouseDown(e, sticker));
        resizeHandle.addEventListener('mousedown', (e) => this.onResizeStart(e, sticker));
        rotateHandle.addEventListener('mousedown', (e) => this.onRotateStart(e, sticker));
        
        this.stickersContainer.appendChild(div);
    }
    
    onStickerMouseDown(e, sticker) {
        e.stopPropagation();
        this.selectSticker(sticker.id);
        
        this.isDragging = true;
        this.dragStartX = e.clientX - sticker.x;
        this.dragStartY = e.clientY - sticker.y;
        
        const onMouseMove = (moveEvent) => {
            if (!this.isDragging) return;
            
            let newX = moveEvent.clientX - this.dragStartX;
            let newY = moveEvent.clientY - this.dragStartY;
            
            // Boundary check
            newX = Math.max(0, Math.min(newX, this.canvas.width - sticker.width));
            newY = Math.max(0, Math.min(newY, this.canvas.height - sticker.height));
            
            sticker.x = newX;
            sticker.y = newY;
            
            const element = document.getElementById(`sticker-${sticker.id}`);
            if (element) {
                element.style.left = `${sticker.x}px`;
                element.style.top = `${sticker.y}px`;
            }
            
            this.renderBackground();
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
            
            this.renderBackground();
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
        const centerX = sticker.x + sticker.width / 2;
        const centerY = sticker.y + sticker.height / 2;
        
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
            
            this.renderBackground();
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
        
        // Remove selected class from all
        document.querySelectorAll('.sticker-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selected class to current
        const selectedElement = document.getElementById(`sticker-${id}`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        document.getElementById('selectedInfo').innerText = id;
    }
    
    clearAllStickers() {
        this.stickers = [];
        this.stickersContainer.innerHTML = '';
        this.selectedStickerId = null;
        this.renderBackground();
        this.updateInfo();
        document.getElementById('selectedInfo').innerText = 'None';
    }
    
    updateInfo() {
        document.getElementById('totalStickers').innerText = this.stickers.length;
    }
    
    exportAsPNG() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // Draw background
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Draw grid
        exportCtx.strokeStyle = '#e0e0e0';
        exportCtx.lineWidth = 1;
        for (let x = 0; x <= exportCanvas.width; x += 20) {
            exportCtx.beginPath();
            exportCtx.moveTo(x, 0);
            exportCtx.lineTo(x, exportCanvas.height);
            exportCtx.stroke();
        }
        for (let y = 0; y <= exportCanvas.height; y += 20) {
            exportCtx.beginPath();
            exportCtx.moveTo(0, y);
            exportCtx.lineTo(exportCanvas.width, y);
            exportCtx.stroke();
        }
        
        // Draw stickers
        this.stickers.forEach(sticker => {
            if (sticker.imageData) {
                exportCtx.save();
                exportCtx.translate(sticker.x + sticker.width / 2, sticker.y + sticker.height / 2);
                exportCtx.rotate(sticker.rotation * Math.PI / 180);
                exportCtx.scale(sticker.scale, sticker.scale);
                exportCtx.drawImage(sticker.imageData, -sticker.width / 2, -sticker.height / 2, sticker.width, sticker.height);
                exportCtx.restore();
            }
        });
        
        const link = document.createElement('a');
        link.download = `sticker-export-${Date.now()}.png`;
        link.href = exportCanvas.toDataURL();
        link.click();
    }
    
    setupEventListeners() {
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllStickers());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportAsPNG());
        
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
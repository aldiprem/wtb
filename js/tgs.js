// TGS Sticker Viewer

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const uploadBtn = document.getElementById('uploadBtn');
    const urlInput = document.getElementById('urlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const getFromBotBtn = document.getElementById('getFromBotBtn');
    const loadFromBotBtn = document.getElementById('loadFromBotBtn');
    const botFileId = document.getElementById('botFileId');
    const clearBtn = document.getElementById('clearBtn');
    const previewSection = document.getElementById('previewSection');
    const stickerPlayer = document.getElementById('stickerPlayer');
    const fileNameSpan = document.getElementById('fileName');
    const fileSizeSpan = document.getElementById('fileSize');
    const fileDimSpan = document.getElementById('fileDim');

    // API endpoint
    const API_BASE = 'https://companel.shop';

    // Upload area click
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag & drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#a855f7';
        uploadArea.style.background = 'rgba(168, 85, 247, 0.1)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        uploadArea.style.background = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        uploadArea.style.background = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.tgs')) {
            handleFile(files[0]);
        } else {
            alert('Please upload a .tgs file');
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Load from URL
    loadUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Masukkan URL file .tgs');
            return;
        }
        
        if (!url.endsWith('.tgs')) {
            alert('URL harus berakhiran .tgs');
            return;
        }
        
        await loadFromUrl(url);
    });

    // Get from bot - redirect ke bot
    getFromBotBtn.addEventListener('click', () => {
        window.open('https://t.me/fragment_stars_bot', '_blank');
    });

    // Load from bot file ID
    loadFromBotBtn.addEventListener('click', async () => {
        const fileId = botFileId.value.trim();
        if (!fileId) {
            alert('Masukkan File ID dari bot');
            return;
        }
        
        await loadFromBot(fileId);
    });

    // Clear
    clearBtn.addEventListener('click', () => {
        previewSection.style.display = 'none';
        stickerPlayer.src = '';
        urlInput.value = '';
        botFileId.value = '';
        fileInput.value = '';
        fileNameSpan.textContent = '-';
        fileSizeSpan.textContent = '-';
        fileDimSpan.textContent = '-';
    });

    // Handle file upload
    function handleFile(file) {
        if (!file.name.endsWith('.tgs')) {
            alert('File harus berformat .tgs');
            return;
        }
        
        const url = URL.createObjectURL(file);
        displaySticker(url, file.name, file.size);
    }

    // Load from URL
    async function loadFromUrl(url) {
        showLoading('Loading from URL...');
        
        try {
            // Fetch file to get size
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch file');
            
            const blob = await response.blob();
            const fileName = url.split('/').pop();
            const fileUrl = URL.createObjectURL(blob);
            
            displaySticker(fileUrl, fileName, blob.size);
            hideLoading();
        } catch (error) {
            hideLoading();
            alert('Error loading from URL: ' + error.message);
        }
    }

    // Load from bot (via API)
    async function loadFromBot(fileId) {
        showLoading('Fetching sticker from bot...');
        
        try {
            // Call API to get sticker from bot
            const response = await fetch(`${API_BASE}/api/bot/sticker/${fileId}`);
            
            if (!response.ok) {
                throw new Error('Sticker not found or expired');
            }
            
            const blob = await response.blob();
            const fileUrl = URL.createObjectURL(blob);
            
            displaySticker(fileUrl, `sticker_${fileId}.tgs`, blob.size);
            hideLoading();
        } catch (error) {
            hideLoading();
            alert('Error loading from bot: ' + error.message + '\n\nPastikan File ID valid dan sticker masih tersedia');
        }
    }

    // Display sticker
    function displaySticker(url, fileName, fileSize) {
        // Set TGS player source
        stickerPlayer.src = url;
        
        // Update info
        fileNameSpan.textContent = fileName || '-';
        fileSizeSpan.textContent = formatFileSize(fileSize);
        fileDimSpan.textContent = '300x300';
        
        // Show preview section
        previewSection.style.display = 'block';
        
        // Scroll to preview
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Loading indicator
    function showLoading(message) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingOverlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            flex-direction: column;
        `;
        loadingDiv.innerHTML = `
            <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 16px; text-align: center;">
                <div class="spinner"></div>
                <p style="margin-top: 16px;">${message}</p>
            </div>
        `;
        
        // Add spinner style if not exists
        if (!document.querySelector('#spinnerStyle')) {
            const style = document.createElement('style');
            style.id = 'spinnerStyle';
            style.textContent = `
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: #a855f7;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(loadingDiv);
    }

    function hideLoading() {
        const loadingDiv = document.getElementById('loadingOverlay');
        if (loadingDiv) loadingDiv.remove();
    }
});
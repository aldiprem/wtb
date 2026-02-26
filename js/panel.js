// pembayaran.js - Pengaturan Pembayaran Website
(function() {
    'use strict';
    
    console.log('💳 Payment Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let rekeningList = [];
    let gatewayList = [];
    let currentRekeningId = null;
    let currentGatewayId = null;
    let deleteTarget = null;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        backToPanel: document.getElementById('backToPanel'),
        
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Rekening
        rekeningContainer: document.getElementById('rekeningContainer'),
        emptyRekening: document.getElementById('emptyRekening'),
        addRekeningBtn: document.getElementById('addRekeningBtn'),
        emptyAddRekeningBtn: document.getElementById('emptyAddRekeningBtn'),
        
        // Gateway
        gatewayContainer: document.getElementById('gatewayContainer'),
        emptyGateway: document.getElementById('emptyGateway'),
        addGatewayBtn: document.getElementById('addGatewayBtn'),
        emptyAddGatewayBtn: document.getElementById('emptyAddGatewayBtn'),
        
        // Rekening Modal
        rekeningModal: document.getElementById('rekeningModal'),
        rekeningModalTitle: document.getElementById('rekeningModalTitle'),
        rekeningForm: document.getElementById('rekeningForm'),
        rekeningId: document.getElementById('rekeningId'),
        rekeningLogo: document.getElementById('rekeningLogo'),
        rekeningLogoImage: document.getElementById('rekeningLogoImage'),
        rekeningLogoValidation: document.getElementById('rekeningLogoValidation'),
        rekeningNama: document.getElementById('rekeningNama'),
        rekeningNomor: document.getElementById('rekeningNomor'),
        rekeningPemilik: document.getElementById('rekeningPemilik'),
        rekeningDeskripsi: document.getElementById('rekeningDeskripsi'),
        rekeningActive: document.getElementById('rekeningActive'),
        closeRekeningModal: document.getElementById('closeRekeningModal'),
        cancelRekeningBtn: document.getElementById('cancelRekeningBtn'),
        
        // Gateway Modal
        gatewayModal: document.getElementById('gatewayModal'),
        gatewayModalTitle: document.getElementById('gatewayModalTitle'),
        gatewayForm: document.getElementById('gatewayForm'),
        gatewayId: document.getElementById('gatewayId'),
        gatewayNama: document.getElementById('gatewayNama'),
        gatewayLicenseKey: document.getElementById('gatewayLicenseKey'),
        gatewayWebhookSecret: document.getElementById('gatewayWebhookSecret'),
        gatewayQrisId: document.getElementById('gatewayQrisId'),
        gatewayExpired: document.getElementById('gatewayExpired'),
        gatewayWarna: document.getElementById('gatewayWarna'),
        gatewayWarnaHex: document.getElementById('gatewayWarnaHex'),
        gatewayUkuran: document.getElementById('gatewayUkuran'),
        gatewayActive: document.getElementById('gatewayActive'),
        closeGatewayModal: document.getElementById('closeGatewayModal'),
        cancelGatewayBtn: document.getElementById('cancelGatewayBtn'),
        
        // Delete Modal
        deleteModal: document.getElementById('deleteModal'),
        deleteMessage: document.getElementById('deleteMessage'),
        deleteInfo: document.getElementById('deleteInfo'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== KEYBOARD HANDLER ====================
    function setupKeyboardHandler() {
        function scrollToInput(input) {
            const rect = input.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight * 0.4;
            
            if (rect.bottom > windowHeight - keyboardHeight) {
                const scrollY = window.scrollY + rect.bottom - (windowHeight - keyboardHeight) + 20;
                window.scrollTo({ top: scrollY, behavior: 'smooth' });
            }
        }
        
        const modalInputs = document.querySelectorAll('.modal input, .modal textarea, .modal select');
        
        modalInputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    scrollToInput(input);
                    
                    const modal = input.closest('.modal');
                    if (modal) {
                        modal.classList.add('modal-with-input');
                        const modalContent = modal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.maxHeight = '70vh';
                            modalContent.style.overflowY = 'auto';
                        }
                    }
                }, 300);
            });
            
            input.addEventListener('blur', () => {
                const modal = input.closest('.modal');
                if (modal) {
                    modal.classList.remove('modal-with-input');
                }
            });
        });
        
        document.addEventListener('touchstart', (e) => {
            const activeElement = document.activeElement;
            if (!activeElement) return;
            
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT' ||
                           e.target.closest('.modal-content');
            
            if (!isInput && activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
                activeElement.blur();
            }
        });
        
        let viewportHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            const newHeight = window.innerHeight;
            
            if (newHeight < viewportHeight * 0.7) {
                document.body.classList.add('keyboard-visible');
            } else if (newHeight > viewportHeight * 0.8) {
                document.body.classList.remove('keyboard-visible');
            }
            
            viewportHeight = newHeight;
        });
    }

    // ==================== API FUNCTIONS ====================
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // ==================== FUNGSI LOAD WEBSITE ====================
    async function loadWebsite() {
      const urlParams = new URLSearchParams(window.location.search);
      const endpoint = urlParams.get('website');
    
      if (!endpoint) {
        showToast('Website tidak ditemukan', 'error');
        setTimeout(() => {
          window.location.href = '/wtb/html/panel.html';
        }, 2000);
        return null;
      }
    
      try {
        const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
          method: 'GET'
        });
    
        if (data.success && data.website) {
          if (elements.websiteBadge) {
            elements.websiteBadge.textContent = '/' + data.website.endpoint;
          }
          return data.website;
        } else {
          throw new Error('Website not found');
        }
      } catch (error) {
        console.error('❌ Error loading website:', error);
        showToast('Gagal memuat data website', 'error');
        return null;
      }
    }
    
    // ==================== FUNGSI NAVIGASI ====================
    function goBackToPanel() {
      // Simpan halaman settings ke session storage
      try {
        sessionStorage.setItem('panel_current_page', 'settings');
      } catch (e) {
        console.warn('Failed to save session', e);
      }
    
      // Redirect ke panel
      window.location.href = '/wtb/html/panel.html';
    }



    async function loadRekening() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/payments/rekening/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success) {
                rekeningList = response.rekening || [];
                renderRekening();
            } else {
                rekeningList = [];
                renderRekening();
            }
        } catch (error) {
            console.error('❌ Error loading rekening:', error);
            rekeningList = [];
            renderRekening();
        }
    }

    async function loadGateway() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/payments/gateway/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success) {
                gatewayList = response.gateway || [];
                renderGateway();
            } else {
                gatewayList = [];
                renderGateway();
            }
        } catch (error) {
            console.error('❌ Error loading gateway:', error);
            gatewayList = [];
            renderGateway();
        }
    }

    // ==================== VALIDASI GAMBAR ====================
    async function validateImageSize(url, requiredWidth = 420, requiredHeight = 420) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                
                console.log(`📏 Image dimensions: ${width}x${height}`);
                
                if (width === requiredWidth && height === requiredHeight) {
                    resolve({ valid: true, width, height });
                } else {
                    reject({ 
                        valid: false, 
                        width, 
                        height,
                        message: `Ukuran gambar harus ${requiredWidth}x${requiredHeight} pixel (saat ini ${width}x${height})`
                    });
                }
            };
            
            img.onerror = () => {
                reject({ 
                    valid: false, 
                    message: 'Gagal memuat gambar. Periksa URL dan pastikan gambar dapat diakses.'
                });
            };
            
            img.src = url;
        });
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderRekening() {
        if (!elements.rekeningContainer || !elements.emptyRekening) return;
        
        if (rekeningList.length === 0) {
            elements.rekeningContainer.innerHTML = '';
            elements.emptyRekening.style.display = 'block';
            return;
        }
        
        elements.emptyRekening.style.display = 'none';
        
        let html = '';
        rekeningList.forEach(rek => {
            const activeClass = rek.active ? 'active' : 'inactive';
            const activeIcon = rek.active ? 'check-circle' : 'times-circle';
            const activeText = rek.active ? 'Aktif' : 'Tidak Aktif';
            
            html += `
                <div class="payment-card ${!rek.active ? 'inactive' : ''}" data-id="${rek.id}">
                    <div class="payment-card-header">
                        <div class="payment-logo">
                            <img src="${escapeHtml(rek.logo_url)}" 
                                 alt="${escapeHtml(rek.nama)}"
                                 onerror="this.src='https://via.placeholder.com/60x60/40a7e3/ffffff?text=${escapeHtml(rek.nama.charAt(0))}';">
                        </div>
                        <div class="payment-info">
                            <div class="payment-nama">${escapeHtml(rek.nama)}</div>
                            <span class="payment-status ${activeClass}">
                                <i class="fas fa-${activeIcon}"></i> ${activeText}
                            </span>
                        </div>
                    </div>
                    
                    <div class="payment-details">
                        <div class="detail-row">
                            <i class="fas fa-hashtag"></i>
                            <span class="detail-label">Nomor:</span>
                            <span class="detail-value">${escapeHtml(rek.nomor)}</span>
                        </div>
                        <div class="detail-row">
                            <i class="fas fa-user"></i>
                            <span class="detail-label">Pemilik:</span>
                            <span class="detail-value">${escapeHtml(rek.pemilik)}</span>
                        </div>
                        ${rek.deskripsi ? `
                            <div class="payment-description">
                                <i class="fas fa-sticky-note"></i>
                                ${escapeHtml(rek.deskripsi)}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="payment-actions">
                        <button class="payment-action-btn edit" onclick="window.pembayaran.editRekening(${rek.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="payment-action-btn delete" onclick="window.pembayaran.deleteRekening(${rek.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.rekeningContainer.innerHTML = html;
    }

    function renderGateway() {
        if (!elements.gatewayContainer || !elements.emptyGateway) return;
        
        if (gatewayList.length === 0) {
            elements.gatewayContainer.innerHTML = '';
            elements.emptyGateway.style.display = 'block';
            return;
        }
        
        elements.emptyGateway.style.display = 'none';
        
        let html = '';
        gatewayList.forEach(gw => {
            const activeClass = gw.active ? 'active' : 'inactive';
            const activeIcon = gw.active ? 'check-circle' : 'times-circle';
            const activeText = gw.active ? 'Aktif' : 'Tidak Aktif';
            
            html += `
                <div class="payment-card ${!gw.active ? 'inactive' : ''}" data-id="${gw.id}">
                    <div class="payment-card-header">
                        <div class="payment-logo">
                            <i class="fas fa-globe"></i>
                        </div>
                        <div class="payment-info">
                            <div class="payment-nama">
                                ${escapeHtml(gw.nama || 'Cashify')}
                                <span class="gateway-badge">Gateway</span>
                            </div>
                            <span class="payment-status ${activeClass}">
                                <i class="fas fa-${activeIcon}"></i> ${activeText}
                            </span>
                        </div>
                    </div>
                    
                    <div class="payment-details">
                        <div class="detail-row">
                            <i class="fas fa-key"></i>
                            <span class="detail-label">License:</span>
                            <span class="detail-value">${escapeHtml(gw.license_key.substring(0, 15))}...</span>
                        </div>
                        <div class="detail-row">
                            <i class="fas fa-clock"></i>
                            <span class="detail-label">Expired:</span>
                            <span class="detail-value">${gw.expired_menit} menit</span>
                        </div>
                        <div class="detail-row">
                            <i class="fas fa-qrcode"></i>
                            <span class="detail-label">QRIS ID:</span>
                            <span class="detail-value">${gw.qris_id ? escapeHtml(gw.qris_id) : '-'}</span>
                        </div>
                        <div class="detail-row">
                            <i class="fas fa-palette"></i>
                            <span class="detail-label">Warna QR:</span>
                            <span class="detail-value" style="display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 16px; height: 16px; background: ${gw.warna_qr}; border-radius: 4px;"></span>
                                ${escapeHtml(gw.warna_qr)}
                            </span>
                        </div>
                        <div class="detail-row">
                            <i class="fas fa-arrows-alt"></i>
                            <span class="detail-label">Ukuran QR:</span>
                            <span class="detail-value">${gw.ukuran_qr}x${gw.ukuran_qr}</span>
                        </div>
                    </div>
                    
                    <div class="payment-actions">
                        <button class="payment-action-btn edit" onclick="window.pembayaran.editGateway(${gw.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="payment-action-btn delete" onclick="window.pembayaran.deleteGateway(${gw.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.gatewayContainer.innerHTML = html;
    }

    // ==================== REKENING FUNCTIONS ====================
    function openRekeningModal(rekening = null) {
        if (rekening) {
            // Edit mode
            elements.rekeningModalTitle.textContent = 'Edit Rekening';
            elements.rekeningId.value = rekening.id || '';
            elements.rekeningLogo.value = rekening.logo_url || '';
            elements.rekeningLogoImage.src = rekening.logo_url || 'https://via.placeholder.com/420x420/40a7e3/ffffff?text=Logo';
            elements.rekeningNama.value = rekening.nama || '';
            elements.rekeningNomor.value = rekening.nomor || '';
            elements.rekeningPemilik.value = rekening.pemilik || '';
            elements.rekeningDeskripsi.value = rekening.deskripsi || '';
            elements.rekeningActive.checked = rekening.active !== false;
            
            // Validate logo if exists
            if (rekening.logo_url) {
                validateRekeningLogo(rekening.logo_url);
            }
        } else {
            // Add mode
            elements.rekeningModalTitle.textContent = 'Tambah Rekening';
            elements.rekeningForm.reset();
            elements.rekeningId.value = '';
            elements.rekeningLogoImage.src = 'https://via.placeholder.com/420x420/40a7e3/ffffff?text=Logo';
            elements.rekeningActive.checked = true;
            
            if (elements.rekeningLogoValidation) {
                elements.rekeningLogoValidation.innerHTML = '<i class="fas fa-info-circle"></i> Masukkan URL logo (wajib 420x420)';
                elements.rekeningLogoValidation.className = 'validation-message info';
            }
        }
        
        elements.rekeningModal.classList.add('active');
        vibrate(10);
        
        setTimeout(() => {
            elements.rekeningLogo.focus();
        }, 300);
    }

    function closeRekeningModal() {
        elements.rekeningModal.classList.remove('active');
        currentRekeningId = null;
    }

    async function validateRekeningLogo(url) {
        if (!url || url.trim() === '') {
            if (elements.rekeningLogoValidation) {
                elements.rekeningLogoValidation.innerHTML = '<i class="fas fa-exclamation-triangle"></i> URL logo wajib diisi';
                elements.rekeningLogoValidation.className = 'validation-message error';
            }
            return false;
        }
        
        if (elements.rekeningLogoValidation) {
            elements.rekeningLogoValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memvalidasi gambar...';
            elements.rekeningLogoValidation.className = 'validation-message info';
        }
        
        try {
            const result = await validateImageSize(url, 420, 420);
            
            if (elements.rekeningLogoValidation) {
                elements.rekeningLogoValidation.innerHTML = '<i class="fas fa-check-circle"></i> Ukuran valid: 420x420 ✓';
                elements.rekeningLogoValidation.className = 'validation-message success';
            }
            
            elements.rekeningLogoImage.src = url;
            return true;
        } catch (error) {
            if (elements.rekeningLogoValidation) {
                elements.rekeningLogoValidation.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message || 'Gambar tidak valid'}`;
                elements.rekeningLogoValidation.className = 'validation-message error';
            }
            return false;
        }
    }

    async function saveRekening(e) {
        e.preventDefault();
        
        if (!currentWebsite) return;
        
        const logoUrl = elements.rekeningLogo.value.trim();
        const nama = elements.rekeningNama.value.trim();
        const nomor = elements.rekeningNomor.value.trim();
        const pemilik = elements.rekeningPemilik.value.trim();
        const deskripsi = elements.rekeningDeskripsi.value.trim();
        const active = elements.rekeningActive.checked;
        
        // Validasi
        if (!logoUrl) {
            showToast('URL logo wajib diisi', 'warning');
            elements.rekeningLogo.focus();
            return;
        }
        
        if (!nama) {
            showToast('Nama aplikasi/rekening wajib diisi', 'warning');
            elements.rekeningNama.focus();
            return;
        }
        
        if (!nomor) {
            showToast('Nomor rekening wajib diisi', 'warning');
            elements.rekeningNomor.focus();
            return;
        }
        
        if (!pemilik) {
            showToast('Nama pemilik wajib diisi', 'warning');
            elements.rekeningPemilik.focus();
            return;
        }
        
        // Validasi logo
        const isValid = await validateRekeningLogo(logoUrl);
        if (!isValid) {
            showToast('Logo tidak valid. Periksa URL dan ukuran gambar (harus 420x420)', 'error');
            return;
        }
        
        const data = {
            id: elements.rekeningId.value ? parseInt(elements.rekeningId.value) : null,
            logo_url: logoUrl,
            nama: nama,
            nomor: nomor,
            pemilik: pemilik,
            deskripsi: deskripsi,
            active: active
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/payments/rekening/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast(`✅ Rekening ${data.id ? 'diperbarui' : 'ditambahkan'}`, 'success');
                closeRekeningModal();
                await loadRekening();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving rekening:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    function deleteRekening(id) {
        const rekening = rekeningList.find(r => r.id === id);
        if (!rekening) return;
        
        deleteTarget = { type: 'rekening', id, nama: rekening.nama };
        
        elements.deleteMessage.textContent = `Hapus rekening "${rekening.nama}"?`;
        elements.deleteInfo.innerHTML = `<strong>${escapeHtml(rekening.nama)}</strong><br>${escapeHtml(rekening.nomor)}`;
        
        elements.deleteModal.classList.add('active');
        vibrate(10);
    }

    // ==================== GATEWAY FUNCTIONS ====================
    function openGatewayModal(gateway = null) {
        if (gateway) {
            // Edit mode
            elements.gatewayModalTitle.textContent = 'Edit Gateway Cashify';
            elements.gatewayId.value = gateway.id || '';
            elements.gatewayLicenseKey.value = gateway.license_key || '';
            elements.gatewayWebhookSecret.value = gateway.webhook_secret || '';
            elements.gatewayQrisId.value = gateway.qris_id || '';
            elements.gatewayExpired.value = gateway.expired_menit || 30;
            elements.gatewayWarna.value = gateway.warna_qr || '#000000';
            elements.gatewayWarnaHex.value = gateway.warna_qr || '#000000';
            elements.gatewayUkuran.value = gateway.ukuran_qr || 420;
            elements.gatewayActive.checked = gateway.active !== false;
        } else {
            // Add mode
            elements.gatewayModalTitle.textContent = 'Tambah Gateway Cashify';
            elements.gatewayForm.reset();
            elements.gatewayId.value = '';
            elements.gatewayNama.value = 'Cashify';
            elements.gatewayExpired.value = 30;
            elements.gatewayWarna.value = '#000000';
            elements.gatewayWarnaHex.value = '#000000';
            elements.gatewayUkuran.value = 420;
            elements.gatewayActive.checked = true;
        }
        
        elements.gatewayModal.classList.add('active');
        vibrate(10);
        
        setTimeout(() => {
            elements.gatewayLicenseKey.focus();
        }, 300);
    }

    function closeGatewayModal() {
        elements.gatewayModal.classList.remove('active');
        currentGatewayId = null;
    }

    async function saveGateway(e) {
        e.preventDefault();
        
        if (!currentWebsite) return;
        
        const licenseKey = elements.gatewayLicenseKey.value.trim();
        const webhookSecret = elements.gatewayWebhookSecret.value.trim();
        const qrisId = elements.gatewayQrisId.value.trim();
        const expired = parseInt(elements.gatewayExpired.value) || 30;
        const warna = elements.gatewayWarnaHex.value.trim();
        const ukuran = parseInt(elements.gatewayUkuran.value) || 420;
        const active = elements.gatewayActive.checked;
        
        // Validasi
        if (!licenseKey) {
            showToast('License Key wajib diisi', 'warning');
            elements.gatewayLicenseKey.focus();
            return;
        }
        
        if (!webhookSecret) {
            showToast('Webhook Secret wajib diisi', 'warning');
            elements.gatewayWebhookSecret.focus();
            return;
        }
        
        if (expired < 1 || expired > 1440) {
            showToast('Expired harus antara 1-1440 menit', 'warning');
            elements.gatewayExpired.focus();
            return;
        }
        
        // Validasi warna (hex format)
        if (!/^#[0-9A-F]{6}$/i.test(warna)) {
            showToast('Format warna tidak valid', 'warning');
            elements.gatewayWarnaHex.focus();
            return;
        }
        
        const data = {
            id: elements.gatewayId.value ? parseInt(elements.gatewayId.value) : null,
            license_key: licenseKey,
            webhook_secret: webhookSecret,
            qris_id: qrisId,
            expired_menit: expired,
            warna_qr: warna,
            ukuran_qr: ukuran,
            active: active
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/payments/gateway/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast(`✅ Gateway ${data.id ? 'diperbarui' : 'ditambahkan'}`, 'success');
                closeGatewayModal();
                await loadGateway();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving gateway:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    function deleteGateway(id) {
        const gateway = gatewayList.find(g => g.id === id);
        if (!gateway) return;
        
        deleteTarget = { type: 'gateway', id, nama: gateway.nama || 'Cashify' };
        
        elements.deleteMessage.textContent = `Hapus gateway "${gateway.nama || 'Cashify'}"?`;
        elements.deleteInfo.innerHTML = `<strong>${escapeHtml(gateway.nama || 'Cashify')}</strong><br>License: ${escapeHtml(gateway.license_key.substring(0, 15))}...`;
        
        elements.deleteModal.classList.add('active');
        vibrate(10);
    }

    // ==================== DELETE FUNCTIONS ====================
    async function confirmDelete() {
        if (!deleteTarget) return;
        
        showLoading(true);
        
        try {
            let response;
            
            if (deleteTarget.type === 'rekening') {
                response = await fetchWithRetry(`${API_BASE_URL}/api/payments/rekening/${deleteTarget.id}`, {
                    method: 'DELETE'
                });
            } else if (deleteTarget.type === 'gateway') {
                response = await fetchWithRetry(`${API_BASE_URL}/api/payments/gateway/${deleteTarget.id}`, {
                    method: 'DELETE'
                });
            }
            
            if (response.success) {
                showToast(`✅ ${deleteTarget.type === 'rekening' ? 'Rekening' : 'Gateway'} dihapus`, 'success');
                
                if (deleteTarget.type === 'rekening') {
                    await loadRekening();
                } else {
                    await loadGateway();
                }
            } else {
                throw new Error(response.error || 'Gagal menghapus');
            }
        } catch (error) {
            console.error('❌ Error deleting:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
            closeDeleteModal();
        }
    }

    function closeDeleteModal() {
        elements.deleteModal.classList.remove('active');
        deleteTarget = null;
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await Promise.all([
                loadRekening(),
                loadGateway()
            ]);
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Di tampilan.js, sosial.js, pembayaran.js
        if (elements.backToPanel) {
          elements.backToPanel.addEventListener('click', (e) => {
            e.preventDefault();
        
            // Simpan bahwa kita kembali dari halaman settings
            try {
              sessionStorage.setItem('panel_current_page', 'settings');
              sessionStorage.setItem('panel_return_from', 'settings');
            } catch (e) {}
        
            window.location.href = '/wtb/html/panel.html';
          });
        }
        
        // Tabs
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                elements.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
                
                vibrate(10);
            });
        });
        
        // Add Rekening buttons
        if (elements.addRekeningBtn) {
            elements.addRekeningBtn.addEventListener('click', () => openRekeningModal());
        }
        if (elements.emptyAddRekeningBtn) {
            elements.emptyAddRekeningBtn.addEventListener('click', () => openRekeningModal());
        }
        
        // Add Gateway buttons
        if (elements.addGatewayBtn) {
            elements.addGatewayBtn.addEventListener('click', () => openGatewayModal());
        }
        if (elements.emptyAddGatewayBtn) {
            elements.emptyAddGatewayBtn.addEventListener('click', () => openGatewayModal());
        }
        
        // Rekening modal
        elements.closeRekeningModal.addEventListener('click', closeRekeningModal);
        elements.cancelRekeningBtn.addEventListener('click', closeRekeningModal);
        elements.rekeningForm.addEventListener('submit', saveRekening);
        
        // Logo validation on input
        let logoTimeout;
        elements.rekeningLogo.addEventListener('input', () => {
            clearTimeout(logoTimeout);
            logoTimeout = setTimeout(() => {
                validateRekeningLogo(elements.rekeningLogo.value.trim());
            }, 800);
        });
        
        // Gateway modal
        elements.closeGatewayModal.addEventListener('click', closeGatewayModal);
        elements.cancelGatewayBtn.addEventListener('click', closeGatewayModal);
        elements.gatewayForm.addEventListener('submit', saveGateway);
        
        // Color picker sync
        if (elements.gatewayWarna && elements.gatewayWarnaHex) {
            elements.gatewayWarna.addEventListener('input', () => {
                elements.gatewayWarnaHex.value = elements.gatewayWarna.value;
            });
            
            elements.gatewayWarnaHex.addEventListener('input', () => {
                if (/^#[0-9A-F]{6}$/i.test(elements.gatewayWarnaHex.value)) {
                    elements.gatewayWarna.value = elements.gatewayWarnaHex.value;
                }
            });
        }
        
        // Delete modal
        elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.rekeningModal) closeRekeningModal();
            if (e.target === elements.gatewayModal) closeGatewayModal();
            if (e.target === elements.deleteModal) closeDeleteModal();
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.pembayaran = {
        editRekening: (id) => {
            const rekening = rekeningList.find(r => r.id === id);
            if (rekening) openRekeningModal(rekening);
        },
        deleteRekening: (id) => deleteRekening(id),
        editGateway: (id) => {
            const gateway = gatewayList.find(g => g.id === id);
            if (gateway) openGatewayModal(gateway);
        },
        deleteGateway: (id) => deleteGateway(id)
    };

    // ==================== START ====================
    setupKeyboardHandler();
    setupEventListeners();
    init();
})();

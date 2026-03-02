// Format JavaScript - Create Website Page
(function() {
    'use strict';
    
    console.log('📝 Create Website Form - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://desperate-journey-penny-expansion.trycloudflare.com';

    // ==================== DOM ELEMENTS ====================
    const elements = {};

    // ==================== FUNGSI UTILITY ====================
    function getElement(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`⚠️ Element #${id} not found`);
        return el;
    }

    function showToast(message, type = 'info', duration = 3000) {
        const toastContainer = getElement('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Style toast
        toast.style.cssText = `
            background: ${type === 'success' ? '#10b981' : 
                        type === 'error' ? '#ef4444' : 
                        type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideUp 0.3s ease;
            margin-bottom: 8px;
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, duration);
    }

    function showLoading(show = true) {
        const loadingOverlay = getElement('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function validateForm() {
        const endpoint = getElement('endpoint')?.value.trim() || '';
        const botToken = getElement('botToken')?.value.trim() || '';
        const ownerId = getElement('ownerId')?.value.trim() || '';
        const username = getElement('username')?.value.trim() || '';
        const password = getElement('password')?.value || '';
        const email = getElement('email')?.value.trim() || '';

        // Validasi endpoint
        if (!endpoint) {
            showToast('❌ Endpoint tidak boleh kosong', 'error');
            getElement('endpoint')?.focus();
            return false;
        }
        const endpointRegex = /^[a-z0-9-]+$/;
        if (!endpointRegex.test(endpoint.toLowerCase())) {
            showToast('❌ Endpoint hanya boleh huruf kecil, angka, dan tanda hubung (-)', 'error');
            getElement('endpoint')?.focus();
            return false;
        }

        // Validasi bot token
        if (!botToken) {
            showToast('❌ Bot Token tidak boleh kosong', 'error');
            getElement('botToken')?.focus();
            return false;
        }
        if (!botToken.includes(':')) {
            showToast('❌ Format Bot Token tidak valid (harus mengandung :)', 'error');
            getElement('botToken')?.focus();
            return false;
        }

        // Validasi owner ID
        if (!ownerId) {
            showToast('❌ Owner ID tidak boleh kosong', 'error');
            getElement('ownerId')?.focus();
            return false;
        }
        if (isNaN(parseInt(ownerId))) {
            showToast('❌ Owner ID harus berupa angka', 'error');
            getElement('ownerId')?.focus();
            return false;
        }

        // Validasi username
        if (!username) {
            showToast('❌ Username tidak boleh kosong', 'error');
            getElement('username')?.focus();
            return false;
        }

        // Validasi password
        if (!password) {
            showToast('❌ Password tidak boleh kosong', 'error');
            getElement('password')?.focus();
            return false;
        }
        if (password.length < 6) {
            showToast('❌ Password minimal 6 karakter', 'error');
            getElement('password')?.focus();
            return false;
        }

        // Validasi email
        if (!email) {
            showToast('❌ Email tidak boleh kosong', 'error');
            getElement('email')?.focus();
            return false;
        }
        if (!email.includes('@') || !email.includes('.')) {
            showToast('❌ Format email tidak valid', 'error');
            getElement('email')?.focus();
            return false;
        }

        return true;
    }

    // ==================== FUNGSI API ====================
    async function createWebsite(formData) {
        try {
            console.log('📤 Sending data to server:', formData);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${API_BASE_URL}/api/websites`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify(formData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                } catch (e) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('📥 Response data:', data);

            if (data.success) {
                showToast('✅ Website berhasil dibuat!', 'success');
                
                // Redirect ke dashboard setelah 1.5 detik
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
                
                return true;
            } else {
                throw new Error(data.error || 'Gagal membuat website');
            }

        } catch (error) {
            console.error('❌ Error creating website:', error);
            
            if (error.name === 'AbortError') {
                showToast('❌ Koneksi timeout. Periksa koneksi Anda.', 'error');
            } else if (error.message.includes('Failed to fetch')) {
                showToast('❌ Tidak dapat terhubung ke server. Periksa koneksi.', 'error');
            } else {
                showToast(error.message || 'Gagal membuat website', 'error');
            }
            return false;
        }
    }

    // ==================== HANDLE SUBMIT ====================
    async function handleSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🎯 Form submitted');

        // Validasi form
        if (!validateForm()) {
            return;
        }

        // Siapkan data
        const formData = {
            endpoint: getElement('endpoint').value.trim().toLowerCase(),
            bot_token: getElement('botToken').value.trim(),
            owner_id: parseInt(getElement('ownerId').value.trim()),
            username: getElement('username').value.trim(),
            password: getElement('password').value,
            email: getElement('email').value.trim().toLowerCase(),
            status: 'active'
        };

        console.log('📦 Form data:', formData);

        // Disable submit button
        const submitBtn = getElement('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        }

        // Show loading
        showLoading(true);

        // Kirim ke server
        const success = await createWebsite(formData);

        // Hide loading
        showLoading(false);

        // Enable submit button jika gagal
        if (!success && submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Website';
        }
    }

    // ==================== TOGGLE PASSWORD ====================
    window.togglePassword = function() {
        const passwordInput = getElement('password');
        const toggleBtn = document.querySelector('.toggle-password i');
        
        if (passwordInput && toggleBtn) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                toggleBtn.className = 'fas fa-eye';
            }
        }
    };

    // ==================== TEST CONNECTION ====================
    async function testConnection() {
        try {
            console.log('🔍 Testing connection to server...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${API_BASE_URL}/api/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Server connection OK:', data);
                return true;
            } else {
                console.warn('⚠️ Server returned error:', response.status);
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Cannot connect to server:', error.message);
            return false;
        }
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing create form...');

        // Get form element
        const form = getElement('createWebsiteForm');
        
        if (!form) {
            console.error('❌ Form #createWebsiteForm tidak ditemukan!');
            showToast('❌ Form tidak ditemukan', 'error');
            return;
        }

        // Setup form submit dengan multiple event listeners untuk memastikan
        form.removeEventListener('submit', handleSubmit); // Hapus listener lama jika ada
        form.addEventListener('submit', handleSubmit);
        console.log('✅ Form submit handler attached');

        // Debug: tambahkan event listener klik pada submit button
        const submitBtn = getElement('submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                console.log('🔘 Submit button clicked');
                // Form akan tetap submit melalui event submit form
            });
        }

        // Auto-focus endpoint
        const endpoint = getElement('endpoint');
        if (endpoint) {
            setTimeout(() => {
                endpoint.focus();
            }, 500);
        }

        // Test koneksi ke server
        const isConnected = await testConnection();
        if (!isConnected) {
            showToast('⚠️ Tidak dapat terhubung ke server. Periksa koneksi.', 'warning', 5000);
        }

        // Cek Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.expand();
            tg.ready();
            
            // Apply Telegram theme
            if (tg.themeParams) {
                const theme = tg.themeParams;
                if (theme.bg_color) {
                    document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
                }
                if (theme.text_color) {
                    document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
                }
            }
            
            // Isi owner ID otomatis dari Telegram
            const ownerId = getElement('ownerId');
            if (tg.initDataUnsafe?.user?.id && ownerId) {
                ownerId.value = tg.initDataUnsafe.user.id;
            }
        }

        console.log('✅ Create form initialized');
    }

    // ==================== START ====================
    // Jalankan init setelah DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Tambahkan event listener tambahan untuk memastikan form bekerja
    window.addEventListener('load', function() {
        console.log('📄 Window loaded, checking form...');
        const form = document.getElementById('createWebsiteForm');
        if (form && !form.hasAttribute('data-listener')) {
            console.log('🔧 Adding fallback form listener');
            form.setAttribute('data-listener', 'true');
            form.addEventListener('submit', handleSubmit);
        }
    });
})();
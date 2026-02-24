// Format JavaScript - Create Website Page
(function() {
    console.log('📝 Create Website Form - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = 'https://supports-lease-honest-potter.trycloudflare.com';

    // ==================== DOM ELEMENTS ====================
    const elements = {
        form: document.getElementById('createWebsiteForm'),
        endpoint: document.getElementById('endpoint'),
        botToken: document.getElementById('botToken'),
        ownerId: document.getElementById('ownerId'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        email: document.getElementById('email'),
        submitBtn: document.getElementById('submitBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ==================== FUNGSI UTILITY ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
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

    function validateForm() {
        const endpoint = elements.endpoint.value.trim();
        const botToken = elements.botToken.value.trim();
        const ownerId = elements.ownerId.value.trim();
        const username = elements.username.value.trim();
        const password = elements.password.value;
        const email = elements.email.value.trim();

        // Validasi endpoint
        if (!endpoint) {
            showToast('❌ Endpoint tidak boleh kosong', 'error');
            elements.endpoint.focus();
            return false;
        }
        const endpointRegex = /^[a-z0-9-]+$/;
        if (!endpointRegex.test(endpoint.toLowerCase())) {
            showToast('❌ Endpoint hanya boleh huruf kecil, angka, dan tanda hubung (-)', 'error');
            elements.endpoint.focus();
            return false;
        }

        // Validasi bot token
        if (!botToken) {
            showToast('❌ Bot Token tidak boleh kosong', 'error');
            elements.botToken.focus();
            return false;
        }
        if (!botToken.includes(':')) {
            showToast('❌ Format Bot Token tidak valid (harus mengandung :)', 'error');
            elements.botToken.focus();
            return false;
        }

        // Validasi owner ID
        if (!ownerId) {
            showToast('❌ Owner ID tidak boleh kosong', 'error');
            elements.ownerId.focus();
            return false;
        }
        if (isNaN(parseInt(ownerId))) {
            showToast('❌ Owner ID harus berupa angka', 'error');
            elements.ownerId.focus();
            return false;
        }

        // Validasi username
        if (!username) {
            showToast('❌ Username tidak boleh kosong', 'error');
            elements.username.focus();
            return false;
        }

        // Validasi password
        if (!password) {
            showToast('❌ Password tidak boleh kosong', 'error');
            elements.password.focus();
            return false;
        }
        if (password.length < 6) {
            showToast('❌ Password minimal 6 karakter', 'error');
            elements.password.focus();
            return false;
        }

        // Validasi email
        if (!email) {
            showToast('❌ Email tidak boleh kosong', 'error');
            elements.email.focus();
            return false;
        }
        if (!email.includes('@') || !email.includes('.')) {
            showToast('❌ Format email tidak valid', 'error');
            elements.email.focus();
            return false;
        }

        return true;
    }

    // ==================== FUNGSI API ====================
    async function createWebsite(formData) {
        try {
            console.log('📤 Sending data to server:', formData);

            // Gunakan AbortController untuk timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout

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
                // Coba parse error response
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
            endpoint: elements.endpoint.value.trim().toLowerCase(),
            bot_token: elements.botToken.value.trim(),
            owner_id: parseInt(elements.ownerId.value.trim()),
            username: elements.username.value.trim(),
            password: elements.password.value,
            email: elements.email.value.trim().toLowerCase(),
            status: 'active'
        };

        console.log('📦 Form data:', formData);

        // Disable submit button
        if (elements.submitBtn) {
            elements.submitBtn.disabled = true;
            elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        }

        // Show loading
        showLoading(true);

        // Kirim ke server
        const success = await createWebsite(formData);

        // Hide loading
        showLoading(false);

        // Enable submit button jika gagal
        if (!success && elements.submitBtn) {
            elements.submitBtn.disabled = false;
            elements.submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Website';
        }
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
        
        const formInputs = document.querySelectorAll('input');
        
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    scrollToInput(input);
                }, 300);
            });
        });
        
        document.addEventListener('touchstart', (e) => {
            const activeElement = document.activeElement;
            if (!activeElement) return;
            
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT' ||
                           e.target.closest('.input-wrapper');
            
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

    // ==================== TOGGLE PASSWORD ====================
    window.togglePassword = function() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.querySelector('.toggle-password i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleBtn.className = 'fas fa-eye';
        }
    };

    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('🚀 Initializing create form...');

        // Setup form submit
        if (elements.form) {
            elements.form.addEventListener('submit', handleSubmit);
            console.log('✅ Form submit handler attached');
        } else {
            console.error('❌ Form not found!');
            showToast('❌ Form tidak ditemukan', 'error');
            return;
        }

        // Setup keyboard handler
        setupKeyboardHandler();

        // Auto-focus endpoint
        if (elements.endpoint) {
            setTimeout(() => {
                elements.endpoint.focus();
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
            
            // Apply Telegram theme jika ada
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
            if (tg.initDataUnsafe?.user?.id && elements.ownerId) {
                elements.ownerId.value = tg.initDataUnsafe.user.id;
            }
        }

        console.log('✅ Create form initialized');
    }

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
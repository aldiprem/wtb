// fragment/js/login.js - JavaScript untuk halaman login

(function() {
    'use strict';
    
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // Fungsi untuk menampilkan toast notifikasi
    function showToast(message, type = 'success') {
        // Hapus toast yang sudah ada
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Buat elemen toast
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            </div>
            <div class="toast-message">${message}</div>
            <div class="toast-close">&times;</div>
        `;
        
        // Tambahkan style untuk toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 280px;
            background: ${type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)'};
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const toastIcon = toast.querySelector('.toast-icon');
        toastIcon.style.cssText = `
            font-size: 20px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const toastMessage = toast.querySelector('.toast-message');
        toastMessage.style.cssText = `
            flex: 1;
            color: white;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.4;
        `;
        
        const toastClose = toast.querySelector('.toast-close');
        toastClose.style.cssText = `
            cursor: pointer;
            color: rgba(255, 255, 255, 0.7);
            font-size: 18px;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 50%;
        `;
        toastClose.onmouseover = () => toastClose.style.color = 'white';
        toastClose.onmouseout = () => toastClose.style.color = 'rgba(255, 255, 255, 0.7)';
        toastClose.onclick = () => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        };
        
        // Tambahkan keyframe animation jika belum ada
        if (!document.querySelector('#toast-animation-style')) {
            const style = document.createElement('style');
            style.id = 'toast-animation-style';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Auto remove setelah 3 detik
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }
        }, 3000);
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.add('show');
        showToast(message, 'error');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 3000);
    }

    function showSuccess(message) {
        showToast(message, 'success');
    }

    // Fungsi untuk set cookie
    function setCookie(name, value, days = 7) {
        const expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    // Fungsi untuk delete cookie
    function deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            showError('Username dan password wajib diisi');
            return;
        }
        
        // Disable button dan show loading
        loginBtn.disabled = true;
        loadingSpinner.classList.add('show');
        loginBtn.style.opacity = '0.7';
        
        try {
            const response = await fetch('/api/fragment/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Simpan token ke localStorage
                localStorage.setItem('session_token', data.session_token);
                // Simpan juga ke cookie untuk fallback
                setCookie('session_token', data.session_token, 7);
                // Tampilkan toast sukses
                showSuccess(`Login berhasil! Selamat datang, ${data.user?.username || username}`);
                // Redirect setelah delay 1 detik agar toast terlihat
                setTimeout(() => {
                    window.location.href = `/fragment/dashboard?user=${data.session_token}`;
                }, 1000);
            } else {
                // Tampilkan error message
                const errorMsg = data.error || 'Login gagal, periksa username dan password Anda';
                showError(errorMsg);
                // Reset form password
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Terjadi kesalahan jaringan, silakan coba lagi');
        } finally {
            // Enable button kembali setelah delay
            setTimeout(() => {
                loginBtn.disabled = false;
                loadingSpinner.classList.remove('show');
                loginBtn.style.opacity = '1';
            }, 500);
        }
    });

    // Event listener untuk enter key
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    // Cek apakah sudah login sebelumnya
    const existingToken = localStorage.getItem('session_token');
    if (existingToken) {
        // Validasi token dengan server
        fetch('/api/fragment/profile', {
            headers: {
                'X-Session-Token': existingToken
            }
        }).then(response => {
            if (response.status === 200) {
                // Token masih valid, redirect ke dashboard
                window.location.href = `/fragment/dashboard?user=${existingToken}`;
            } else {
                // Token tidak valid, hapus
                localStorage.removeItem('session_token');
                deleteCookie('session_token');
            }
        }).catch(() => {
            // Error, biarkan tetap di halaman login
        });
    }
})();
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

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.add('show');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 3000);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            showError('Username dan password wajib diisi');
            return;
        }
        
        loginBtn.disabled = true;
        loadingSpinner.classList.add('show');
        
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
                localStorage.setItem('session_token', data.session_token);
                window.location.href = '/fragment/dashboard';
            } else {
                showError(data.error || 'Login gagal');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Terjadi kesalahan, silakan coba lagi');
        } finally {
            loginBtn.disabled = false;
            loadingSpinner.classList.remove('show');
        }
    });
})();
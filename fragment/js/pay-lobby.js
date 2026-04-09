// pay-lobby.js
(function() {
    'use strict';
    
    console.log('💳 Payment page initializing...');
    
    let checkInterval = null;
    let countdownInterval = null;
    let orderData = null;
    
    // Ambil order_id dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (!orderId) {
        showMessage('Order ID tidak ditemukan', 'error');
        document.getElementById('checkPaymentBtn').disabled = true;
        return;
    }
    
    // Load order data
    async function loadOrderData() {
        try {
            const response = await fetch(`/api/fragment/lobby/check-payment?order_id=${orderId}`);
            const data = await response.json();
            
            if (data.order) {
                orderData = data.order;
                renderOrderInfo(orderData);
                
                if (orderData.qr_string) {
                    displayQRIS(orderData.qr_string);
                    document.getElementById('copyBtn').style.display = 'block';
                } else {
                    showMessage('QRIS tidak tersedia', 'error');
                }
                
                if (orderData.expires_at) {
                    startCountdown(orderData.expires_at);
                }
            } else if (data.status === 'completed') {
                showSuccessAndRedirect(data.redirect_url);
            } else {
                showMessage(data.message || 'Gagal memuat data order', 'error');
            }
        } catch (error) {
            console.error('Error loading order:', error);
            showMessage('Gagal memuat data pembayaran', 'error');
        }
    }
    
    function renderOrderInfo(order) {
        const orderInfo = document.getElementById('orderInfo');
        orderInfo.innerHTML = `
            <div class="order-info-row">
                <span class="order-info-label">Order ID</span>
                <span class="order-info-value">${order.order_id ? order.order_id.substring(0, 20) + '...' : '-'}</span>
            </div>
            <div class="order-info-row">
                <span class="order-info-label">Plan</span>
                <span class="order-info-value">${order.plan ? order.plan.toUpperCase() : '-'}</span>
            </div>
            <div class="order-info-row">
                <span class="order-info-label">Username</span>
                <span class="order-info-value">${order.username || '-'}</span>
            </div>
            <div class="order-info-row">
                <span class="order-info-label">Total Pembayaran</span>
                <span class="order-info-value amount">Rp ${(order.amount || 0).toLocaleString()}</span>
            </div>
        `;
    }
    
    function displayQRIS(qrString) {
        const container = document.getElementById('qrisContainer');
        
        // Cek apakah qrString adalah URL atau base64
        if (qrString.startsWith('http')) {
            container.innerHTML = `<img src="${qrString}" alt="QRIS Code" onerror="this.onerror=null;this.src='https://placehold.co/200x200?text=QRIS+Error'">`;
        } else if (qrString.startsWith('data:image')) {
            container.innerHTML = `<img src="${qrString}" alt="QRIS Code">`;
        } else {
            // Mungkin base64 tanpa prefix atau string biasa
            container.innerHTML = `<img src="data:image/png;base64,${qrString}" alt="QRIS Code" onerror="this.onerror=null;this.src='https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrString)}'">`;
        }
    }
    
    function copyQRIS() {
        const img = document.querySelector('#qrisContainer img');
        if (!img) {
            showMessage('Tidak ada QRIS untuk disalin', 'error');
            return;
        }
        
        const qrisUrl = img.src;
        navigator.clipboard.writeText(qrisUrl).then(() => {
            showMessage('QRIS berhasil disalin!', 'success');
        }).catch(() => {
            showMessage('Gagal menyalin QRIS', 'error');
        });
    }
    
    function showMessage(message, type) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        if (type === 'success') {
            errorDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            errorDiv.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            errorDiv.style.color = '#10b981';
        } else {
            errorDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            errorDiv.style.color = '#ef4444';
        }
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    function showSuccessAndRedirect(redirectUrl) {
        const badge = document.getElementById('statusBadge');
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Pembayaran Berhasil';
        badge.className = 'status-badge status-success';
        
        showMessage('Pembayaran berhasil! Mengalihkan...', 'success');
        
        if (checkInterval) clearInterval(checkInterval);
        if (countdownInterval) clearInterval(countdownInterval);
        
        if (redirectUrl) {
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 2000);
        }
    }
    
    async function checkPayment() {
        const btn = document.getElementById('checkPaymentBtn');
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
        
        try {
            const response = await fetch(`/api/fragment/lobby/check-payment?order_id=${orderId}`);
            const data = await response.json();
            
            if (data.success && data.status === 'completed') {
                showSuccessAndRedirect(data.redirect_url);
            } else if (data.status === 'expired') {
                showMessage(data.error || 'Pembayaran sudah kadaluarsa', 'error');
                const badge = document.getElementById('statusBadge');
                badge.innerHTML = '<i class="fas fa-times-circle"></i> Kadaluarsa';
                badge.className = 'status-badge status-expired';
                if (checkInterval) clearInterval(checkInterval);
                if (countdownInterval) clearInterval(countdownInterval);
            } else {
                showMessage('Pembayaran belum terdeteksi. Silakan coba lagi nanti.', 'error');
            }
        } catch (error) {
            console.error('Error checking payment:', error);
            showMessage('Gagal memeriksa pembayaran', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
    
    function startCountdown(expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        
        function updateCountdown() {
            const now = new Date();
            const diff = expiresAt - now;
            
            if (diff <= 0) {
                document.getElementById('countdown').textContent = 'Kadaluarsa';
                if (countdownInterval) clearInterval(countdownInterval);
                const badge = document.getElementById('statusBadge');
                badge.innerHTML = '<i class="fas fa-times-circle"></i> Kadaluarsa';
                badge.className = 'status-badge status-expired';
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            document.getElementById('countdown').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }
    
    // Setup event listeners
    document.getElementById('checkPaymentBtn').addEventListener('click', checkPayment);
    document.getElementById('copyBtn').addEventListener('click', copyQRIS);
    
    // Auto check every 5 seconds
    checkInterval = setInterval(checkPayment, 5000);
    
    // Load data
    loadOrderData();
})();
// winedash/js/web.js - Perbaikan TON Connect

(function() {
    'use strict';
    
    console.log('🍷 Winedash Marketplace - Initializing...');

    const API_BASE_URL = window.location.origin;
    const TON_CONNECT_MANIFEST_URL = `${API_BASE_URL}/winedash/tonconnect-manifest.json`;
    
    let telegramUser = null;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let walletAddress = null;
    let allUsernames = [];
    let marketLayout = localStorage.getItem('market_layout') || 'grid';
    let marketSort = 'price_asc';
    let marketStatusFilter = 'all';

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        userUsername: document.getElementById('userUsername'),
        balanceAmount: document.getElementById('balanceAmount'),
        balanceCard: document.getElementById('balanceCard'),
        depositTrigger: document.getElementById('depositTrigger'),
        
        usernameList: document.getElementById('usernameList'),
        purchasedList: document.getElementById('purchasedList'),
        historyList: document.getElementById('historyList'),
        searchInput: document.getElementById('searchUsername'),
        
        walletStatus: document.getElementById('walletStatus'),
        walletAddress: document.getElementById('walletAddress'),
        walletAddressText: document.getElementById('walletAddressText'),
        
        depositAmount: document.getElementById('depositAmount'),
        depositBtn: document.getElementById('depositBtn'),
        
        withdrawAmount: document.getElementById('withdrawAmount'),
        withdrawBtn: document.getElementById('withdrawBtn'),
        
        sellUsername: document.getElementById('sellUsername'),
        sellPrice: document.getElementById('sellPrice'),
        sellCategory: document.getElementById('sellCategory'),
        sellUsernameBtn: document.getElementById('sellUsernameBtn'),
        
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content')
    };

    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        else hapticLight();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        return parseFloat(num).toFixed(2);
    }

    function formatAddress(address) {
        if (!address) return 'Not connected';
        if (address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    }

    // ==================== TELEGRAM USER ====================
    
    function getTelegramUserFromWebApp() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    return {
                        id: initData.user.id,
                        username: initData.user.username || '',
                        first_name: initData.user.first_name || '',
                        last_name: initData.user.last_name || '',
                        photo_url: initData.user.photo_url || null
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    function updateUserUI() {
        if (!telegramUser) return;
        
        // Hanya update avatar, tidak tampilkan nama/username
        const avatarContainer = elements.userAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }

    async function authenticateUser() {
        if (!telegramUser) return null;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(telegramUser)
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (elements.balanceAmount) {
                    elements.balanceAmount.textContent = formatNumber(data.user.balance);
                }
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Error authenticating user:', error);
            return null;
        }
    }

    // ==================== TON CONNECT ====================

    async function initTonConnect() {
        try {
            if (typeof window.TON_CONNECT_UI === 'undefined') {
                console.warn('TON Connect UI not loaded, waiting...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (typeof window.TON_CONNECT_UI === 'undefined') {
                    console.error('TON Connect UI still not available');
                    showToast('TON Connect not available', 'error');
                    return;
                }
            }
            
            const manifestUrl = `${API_BASE_URL}/winedash/tonconnect-manifest.json`;
            
            // Inisialisasi TON Connect UI
            tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: manifestUrl,
                buttonRootId: 'ton-connect',
                language: 'en'
            });
            
            console.log('✅ TON Connect UI initialized');
            
            // Subscribe to status changes
            tonConnectUI.onStatusChange(async (wallet) => {
                console.log('📱 Wallet status changed:', wallet);
                
                if (wallet) {
                    isWalletConnected = true;
                    walletAddress = wallet.account.address;
                    updateWalletUI();
                    await saveWalletAddress(walletAddress);
                    showToast('Wallet connected!', 'success');
                    updateBalanceCardUI();
                } else {
                    isWalletConnected = false;
                    walletAddress = null;
                    updateWalletUI();
                    updateBalanceCardUI();
                }
            });
            
            // Check if already connected
            if (tonConnectUI.connected) {
                const wallet = tonConnectUI.wallet;
                if (wallet) {
                    isWalletConnected = true;
                    walletAddress = wallet.account.address;
                    updateWalletUI();
                    await saveWalletAddress(walletAddress);
                    updateBalanceCardUI();
                }
            }
            
            updateBalanceCardUI();
            
        } catch (error) {
            console.error('Error initializing TON Connect:', error);
            showToast('Failed to initialize TON Connect', 'error');
        }
    }

    async function connectWallet() {
        hapticMedium();
        
        if (!tonConnectUI) {
            showToast('TON Connect not initialized', 'error');
            return;
        }
        
        try {
            showLoading(true);
            // Gunakan openModal() untuk versi terbaru TON Connect UI
            if (typeof tonConnectUI.openModal === 'function') {
                await tonConnectUI.openModal();
            } else if (typeof tonConnectUI.connectWallet === 'function') {
                await tonConnectUI.connectWallet();
            } else if (typeof tonConnectUI.connection === 'object') {
                // Alternatif lain
                tonConnectUI.connection.connect();
            } else {
                // Fallback: trigger button click
                const connectBtn = document.querySelector('#ton-connect button');
                if (connectBtn) {
                    connectBtn.click();
                } else {
                    throw new Error('No connect method available');
                }
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showToast('Failed to connect wallet: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
        }
    }

    function disconnectWallet() {
        if (tonConnectUI) {
            if (typeof tonConnectUI.disconnect === 'function') {
                tonConnectUI.disconnect();
            } else if (tonConnectUI.connection && typeof tonConnectUI.connection.disconnect === 'function') {
                tonConnectUI.connection.disconnect();
            }
            isWalletConnected = false;
            walletAddress = null;
            updateWalletUI();
            updateBalanceCardUI();
            showToast('Wallet disconnected', 'info');
        }
    }

    function updateBalanceCardUI() {
        const balanceCard = elements.balanceCard;
        if (!balanceCard) return;
        
        if (isWalletConnected && walletAddress) {
            // Tampilkan balance card dengan logo, balance, dan tombol deposit
            balanceCard.classList.remove('hidden');
            balanceCard.style.cursor = 'pointer';
            
            // Format balance dengan 2 desimal
            const currentBalance = parseFloat(elements.balanceAmount?.textContent || '0');
            const formattedBalance = currentBalance.toFixed(2);
            
            balanceCard.innerHTML = `
                <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                <span class="balance-amount" id="balanceAmount">${formattedBalance}</span>
                <div class="deposit-icon" id="depositTrigger">
                    <i class="fas fa-plus"></i>
                    <span>Deposit</span>
                </div>
            `;
            
            // Re-attach event listener
            const newDepositTrigger = document.getElementById('depositTrigger');
            if (newDepositTrigger) {
                newDepositTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDepositModal();
                });
            }
            
            // Update balanceAmount reference
            elements.balanceAmount = document.getElementById('balanceAmount');
            
        } else {
            // Wallet not connected - tampilkan tombol connect full
            balanceCard.classList.remove('hidden');
            balanceCard.innerHTML = `
                <button class="connect-wallet-btn" id="connectWalletFullBtn">
                    <i class="fas fa-plug"></i> Connect Wallet
                </button>
            `;
            
            const connectBtn = document.getElementById('connectWalletFullBtn');
            if (connectBtn) {
                connectBtn.onclick = (e) => {
                    e.stopPropagation();
                    connectWallet();
                };
            }
        }
    }

    function updateWalletUI() {
        if (isWalletConnected && walletAddress) {
            if (elements.walletStatus) {
                elements.walletStatus.innerHTML = `<i class="fas fa-check-circle"></i><span>Wallet Terhubung</span>`;
                elements.walletStatus.style.background = 'rgba(16, 185, 129, 0.15)';
                elements.walletStatus.style.color = 'var(--success)';
            }
            if (elements.walletAddress) {
                elements.walletAddress.style.display = 'block';
                elements.walletAddressText.textContent = formatAddress(walletAddress);
            }
        } else {
            if (elements.walletStatus) {
                elements.walletStatus.innerHTML = `<i class="fas fa-plug"></i><span>Belum terhubung</span>`;
                elements.walletStatus.style.background = '';
                elements.walletStatus.style.color = '';
            }
            if (elements.walletAddress) {
                elements.walletAddress.style.display = 'none';
            }
        }
    }

    async function saveWalletAddress(address) {
        if (!telegramUser) {
            console.warn('saveWalletAddress: telegramUser belum ada');
            return;
        }

        try {
            console.log(`💾 Saving wallet address for user ${telegramUser.id}:`, address);

            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Wallet address saved to database:', address);
                showToast('Wallet tersambung & disimpan!', 'success');
            } else {
                console.error('❌ Failed to save wallet address:', data.error);
            }
        } catch (error) {
            console.error('Error saving wallet address:', error);
        }
    }

    // ==================== DEPOSIT ====================
    
    function showDepositModal() {
        if (!isWalletConnected) {
            connectWallet();
            return;
        }
        
        // Scroll to deposit section and highlight
        const depositSection = document.querySelector('#walletTab .deposit-form');
        if (depositSection) {
            // Switch to wallet tab
            const walletTabBtn = document.querySelector('.tab-btn[data-tab="wallet"]');
            if (walletTabBtn) {
                walletTabBtn.click();
            }
            setTimeout(() => {
                depositSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const depositInput = document.getElementById('depositAmount');
                if (depositInput) depositInput.focus();
            }, 300);
        }
    }

    // ===== GANTI SELURUH FUNGSI INI DI web.js =====
    async function deposit() {
        const amount = parseFloat(elements.depositAmount?.value);

        if (!amount || amount <= 0) {
            showToast('Masukkan jumlah deposit yang valid', 'warning');
            return;
        }

        if (amount < 0.1) {
            showToast('Minimal deposit 0.1 TON', 'warning');
            return;
        }

        if (!tonConnectUI?.connected) {
            showToast('Hubungkan wallet TON terlebih dahulu', 'warning');
            await connectWallet();
            return;
        }

        hapticMedium();

        const depositBtn = elements.depositBtn;
        const originalText = depositBtn?.innerHTML;
        if (depositBtn) {
            depositBtn.disabled = true;
            depositBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        }

        try {
            const senderAddress = tonConnectUI.account?.address;
            const amountNano = Math.floor(amount * 1_000_000_000).toString();

            console.log('📤 Processing deposit:', { amount, amountNano, senderAddress });

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra',
                    amount: amountNano
                }]
            };

            // Kirim transaksi ke blockchain
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('✅ Transaction sent to blockchain:', result);

            const memo = `deposit:${telegramUser?.id}:${Date.now()}`;

            // Konfirmasi ke backend dan update saldo
            const verifyResponse = await fetch(`${API_BASE_URL}/api/winedash/deposit/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    transaction_hash: result.boc,
                    from_address: senderAddress,
                    memo: memo
                })
            });

            const verifyData = await verifyResponse.json();
            console.log('📊 Deposit confirm response:', verifyData);

            if (verifyData.success) {
                hapticSuccess();
                showToast(`Deposit ${amount} TON berhasil! Saldo: ${parseFloat(verifyData.new_balance).toFixed(2)} TON`, 'success');

                // Update saldo di UI langsung dari response server
                if (verifyData.new_balance !== undefined) {
                    const balanceEl = document.getElementById('balanceAmount');
                    if (balanceEl) {
                        balanceEl.textContent = parseFloat(verifyData.new_balance).toFixed(2);
                    }
                }

                if (elements.depositAmount) elements.depositAmount.value = '';

                // Refresh semua data
                await authenticateUser();
                updateBalanceCardUI();

            } else {
                showToast(verifyData.error || 'Deposit gagal dikonfirmasi', 'error');
            }

        } catch (error) {
            console.error('Error creating deposit:', error);

            let errorMessage = 'Error creating deposit';
            if (error.message) {
                if (error.message.includes('rejected')) {
                    errorMessage = 'Transaksi dibatalkan oleh user';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Saldo wallet tidak mencukupi';
                } else {
                    errorMessage = error.message;
                }
            }

            showToast(errorMessage, 'error');
        } finally {
            if (depositBtn) {
                depositBtn.disabled = false;
                depositBtn.innerHTML = originalText || '<i class="fas fa-arrow-down"></i> Deposit';
            }
        }
    }

    // ==================== WITHDRAW ====================
    async function withdraw() {
        const amount = parseFloat(elements.withdrawAmount?.value);
        
        if (!amount || amount <= 0) {
            showToast('Masukkan jumlah withdraw yang valid', 'warning');
            return;
        }
        
        if (amount < 1) {
            showToast('Minimal withdraw 1 TON', 'warning');
            return;
        }
        
        if (!tonConnectUI?.connected) {
            showToast('Hubungkan wallet TON terlebih dahulu', 'warning');
            await connectWallet();
            return;
        }
        
        hapticMedium();
        
        const withdrawBtn = elements.withdrawBtn;
        const originalText = withdrawBtn?.innerHTML;
        if (withdrawBtn) {
            withdrawBtn.disabled = true;
            withdrawBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/withdraw/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    wallet_address: tonConnectUI.account?.address
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(`Withdrawal request created: ${amount} TON`, 'success');
                if (elements.withdrawAmount) elements.withdrawAmount.value = '';
                refreshAllData();
            } else {
                showToast(data.error || 'Failed to create withdrawal', 'error');
            }
        } catch (error) {
            console.error('Error creating withdrawal:', error);
            showToast('Error creating withdrawal', 'error');
        } finally {
            if (withdrawBtn) {
                withdrawBtn.disabled = false;
                withdrawBtn.innerHTML = originalText || '<i class="fas fa-arrow-up"></i> Withdraw';
            }
        }
    }

    // ==================== USERNAME MARKETPLACE ====================
    function renderUsernames(usernames) {
        const container = document.getElementById('usernameListContainer');
        if (!container) return;

        if (!usernames || usernames.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">Belum ada username yang tersedia</div>';
            return;
        }

        if (marketLayout === 'grid') {
            container.className = 'username-grid';
            let html = '';
            for (const username of usernames) {
                let usernameStr = String(username.username || '').replace(/^b['"]|['"]$/g, '');
                const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
                const statusClass = username.status === 'available' ? 'listed' : 'unlisted';

                const cached = localStorage.getItem(`avatar_${usernameStr}`);
                let avatarUrl = (cached && cached.startsWith('data:image'))
                    ? cached
                    : 'https://companel.shop/image/winedash-logo.png';

                html += `
                    <div class="username-card" data-id="${username.id}" data-username='${JSON.stringify({id: username.id, username: usernameStr, price: username.price, status: username.status, category: username.category}).replace(/'/g, "&#39;")}'>
                        <div class="username-card-image">
                            <div class="card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" data-username="${usernameStr}" class="avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="card-username">@${escapeHtml(usernameStr)}</div>
                        </div>
                        <div class="username-card-info">
                            <div class="card-price-row">
                                <div class="price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                    <span class="card-price">${formatNumber(username.price)}</span>
                                </div>
                                <div class="card-status ${statusClass}">${statusText}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;

            // Attach click — buka detail / beli
            document.querySelectorAll('#usernameListContainer .username-card').forEach(card => {
                card.addEventListener('click', () => {
                    try {
                        const data = JSON.parse(card.dataset.username.replace(/&#39;/g, "'"));
                        showBuyConfirm(data);
                    } catch (e) { console.error(e); }
                });
            });

        } else {
            // List layout
            container.className = 'username-list';
            let html = '';
            for (const username of usernames) {
                let usernameStr = String(username.username || '').replace(/^b['"]|['"]$/g, '');

                const cached = localStorage.getItem(`avatar_${usernameStr}`);
                let avatarUrl = (cached && cached.startsWith('data:image'))
                    ? cached
                    : 'https://companel.shop/image/winedash-logo.png';

                html += `
                    <div class="username-item" data-id="${username.id}" data-price="${username.price}" data-username='${JSON.stringify({id: username.id, username: usernameStr, price: username.price, status: username.status}).replace(/'/g, "&#39;")}'>
                        <div class="username-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" class="username-avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="username-info">
                            <div class="username-name">@${escapeHtml(usernameStr)}</div>
                            <div class="username-basedon" style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(username.category || '')}</div>
                        </div>
                        <div class="username-price-wrapper">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo-small">
                            <span class="username-price">${formatNumber(username.price)}</span>
                        </div>
                        <button class="username-buy-btn" data-id="${username.id}" data-price="${username.price}">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                    </div>
                `;
            }
            container.innerHTML = html;

            document.querySelectorAll('#usernameListContainer .username-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.username-buy-btn')) return;
                    try {
                        const data = JSON.parse(item.dataset.username.replace(/&#39;/g, "'"));
                        showBuyConfirm(data);
                    } catch (e) { console.error(e); }
                });
            });

            document.querySelectorAll('#usernameListContainer .username-buy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const price = parseFloat(btn.dataset.price);
                    buyUsername(id, price);
                });
            });
        }

        // Fetch avatar async
        setTimeout(() => fetchMarketAvatars(), 100);
    }

    async function fetchMarketAvatars() {
        const imgs = document.querySelectorAll('#usernameListContainer [data-username].avatar-img, #usernameListContainer .username-avatar-img');
        for (const img of imgs) {
            const username = img.dataset.username || img.closest('[data-id]')?.dataset?.username;
            if (!username) continue;

            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached.startsWith('data:image')) {
                if (img.src !== cached) img.src = cached;
                continue;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await res.json();
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                }
            } catch (e) { /* silent */ }

            await new Promise(r => setTimeout(r, 100));
        }
    }

    function showBuyConfirm(usernameData) {
        const price = parseFloat(usernameData.price);
        const balance = parseFloat(document.getElementById('balanceAmount')?.textContent || '0');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:300px;">
                <h3>Beli Username</h3>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                    @<strong>${escapeHtml(usernameData.username)}</strong><br>
                    Harga: <strong>${formatNumber(price)} TON</strong><br>
                    Saldo kamu: <strong>${balance.toFixed(2)} TON</strong>
                </p>
                <div class="modal-buttons">
                    <button class="modal-cancel" id="cancelBuyBtn">Batal</button>
                    <button class="modal-confirm" id="confirmBuyBtn">Beli</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelBuyBtn').onclick = () => modal.remove();
        document.getElementById('confirmBuyBtn').onclick = async () => {
            modal.remove();
            await buyUsername(usernameData.id, price);
        };
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function filterAndRenderMarket() {
        let filtered = [...allUsernames];

        // Filter hanya username yang available (di market)
        filtered = filtered.filter(u => u.status === 'available');

        // Filter search
        const searchTerm = document.getElementById('searchUsername')?.value?.toLowerCase()?.trim() || '';
        if (searchTerm) {
            filtered = filtered.filter(u =>
                u.username.toLowerCase().includes(searchTerm) ||
                (u.category || '').toLowerCase().includes(searchTerm)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (marketSort) {
                case 'price_asc': return a.price - b.price;
                case 'price_desc': return b.price - a.price;
                case 'name_asc': return a.username.localeCompare(b.username);
                case 'name_desc': return b.username.localeCompare(a.username);
                case 'date_desc': return new Date(b.created_at) - new Date(a.created_at);
                default: return a.price - b.price;
            }
        });

        renderUsernames(filtered);
    }
    
    async function loadUsernames() {
        if (!elements.usernameList) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=100`);
            const data = await response.json();
            
            if (data.success && data.usernames.length > 0) {
                allUsernames = data.usernames;
                filterAndRenderMarket();
            } else {
                allUsernames = [];
                elements.usernameList.innerHTML = '<div class="loading-placeholder">Belum ada username yang tersedia</div>';
            }
        } catch (error) {
            console.error('Error loading usernames:', error);
            elements.usernameList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    async function buyUsername(usernameId, price) {
        hapticMedium();
        
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        const balance = parseFloat(elements.balanceAmount?.textContent || '0');
        if (balance < price) {
            showToast(`Saldo tidak mencukupi. Butuh ${price} TON`, 'error');
            return;
        }
        
        const buyBtn = document.querySelector(`.username-buy-btn[data-id="${usernameId}"]`);
        const originalText = buyBtn?.innerHTML;
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.innerHTML = '<span class="btn-loading"></span>';
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    buyer_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil dibeli!', 'success');
                refreshAllData();
            } else {
                showToast(data.error || 'Gagal membeli username', 'error');
            }
        } catch (error) {
            console.error('Error buying username:', error);
            showToast('Error buying username', 'error');
        } finally {
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.innerHTML = originalText || '<i class="fas fa-shopping-cart"></i> Beli';
            }
        }
    }

    function setupSearch() {
        const searchInput = document.getElementById('searchUsername');
        const searchApplyBtn = document.getElementById('searchApplyBtn');

        if (searchApplyBtn) {
            searchApplyBtn.addEventListener('click', () => {
                filterAndRenderMarket();
                hapticLight();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filterAndRenderMarket();
                    hapticLight();
                }
            });
        }
    }

    // ===== TAMBAHKAN FUNGSI BARU INI DI web.js (sebelum fungsi init) =====
    function setupMarketActionBar() {
        // Sort button
        const sortBtn = document.getElementById('marketSortBtn');
        const sortDropdown = document.getElementById('marketSortDropdown');
        const sortSelect = document.getElementById('marketSortSelect');

        if (sortBtn && sortDropdown) {
            sortBtn.addEventListener('click', () => {
                sortDropdown.style.display = sortDropdown.style.display === 'none' ? 'block' : 'none';
                hapticLight();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                marketSort = sortSelect.value;
                if (sortDropdown) sortDropdown.style.display = 'none';
                filterAndRenderMarket();
                hapticLight();
            });
        }

        // Layout toggle
        const gridBtn = document.getElementById('marketGridBtn');
        const listBtn = document.getElementById('marketListBtn');

        if (gridBtn) {
            gridBtn.addEventListener('click', () => {
                marketLayout = 'grid';
                localStorage.setItem('market_layout', 'grid');
                gridBtn.classList.add('active');
                if (listBtn) listBtn.classList.remove('active');
                filterAndRenderMarket();
                hapticLight();
            });
        }

        if (listBtn) {
            listBtn.addEventListener('click', () => {
                marketLayout = 'list';
                localStorage.setItem('market_layout', 'list');
                listBtn.classList.add('active');
                if (gridBtn) gridBtn.classList.remove('active');
                filterAndRenderMarket();
                hapticLight();
            });
        }

        // Set initial layout button state
        if (marketLayout === 'list') {
            if (listBtn) listBtn.classList.add('active');
            if (gridBtn) gridBtn.classList.remove('active');
        }
    }

    async function sellUsername() {
        const username = elements.sellUsername?.value.trim();
        const price = parseFloat(elements.sellPrice?.value);
        const category = elements.sellCategory?.value;
        
        if (!username) {
            showToast('Masukkan username', 'warning');
            return;
        }
        
        if (!price || price <= 0) {
            showToast('Masukkan harga yang valid', 'warning');
            return;
        }
        
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        hapticMedium();
        
        const sellBtn = elements.sellUsernameBtn;
        const originalText = sellBtn?.innerHTML;
        if (sellBtn) {
            sellBtn.disabled = true;
            sellBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    price: price,
                    seller_id: telegramUser.id,
                    seller_wallet: walletAddress || '',
                    category: category
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil ditambahkan ke marketplace!', 'success');
                if (elements.sellUsername) elements.sellUsername.value = '';
                if (elements.sellPrice) elements.sellPrice.value = '';
                refreshAllData();
            } else {
                showToast(data.error || 'Gagal menambahkan username', 'error');
            }
        } catch (error) {
            console.error('Error selling username:', error);
            showToast('Error selling username', 'error');
        } finally {
            if (sellBtn) {
                sellBtn.disabled = false;
                sellBtn.innerHTML = originalText || '<i class="fas fa-rocket"></i> Jual Username';
            }
        }
    }

    async function loadPurchasedUsernames() {
        if (!elements.purchasedList || !telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/purchases/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.purchases.length > 0) {
                let html = '';
                for (const purchase of data.purchases) {
                    html += `
                        <div class="username-item">
                            <div class="username-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="username-info">
                                <div class="username-name">${escapeHtml(purchase.username)}</div>
                                <div class="username-category">${escapeHtml(purchase.category)}</div>
                            </div>
                            <div class="username-price">
                                ${formatNumber(purchase.price)} <small>TON</small>
                            </div>
                        </div>
                    `;
                }
                elements.purchasedList.innerHTML = html;
            } else {
                elements.purchasedList.innerHTML = '<div class="loading-placeholder">Belum ada username yang dibeli</div>';
            }
        } catch (error) {
            console.error('Error loading purchased usernames:', error);
            elements.purchasedList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    async function loadTransactionHistory() {
        if (!elements.historyList || !telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/transactions/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.transactions.length > 0) {
                let html = '';
                for (const tx of data.transactions) {
                    let iconClass = '';
                    let icon = '';
                    let amountClass = '';
                    let amountPrefix = '';
                    
                    switch (tx.type) {
                        case 'deposit':
                            iconClass = 'deposit';
                            icon = 'fa-arrow-down';
                            amountClass = 'positive';
                            amountPrefix = '+';
                            break;
                        case 'withdraw':
                            iconClass = 'withdraw';
                            icon = 'fa-arrow-up';
                            amountClass = 'negative';
                            amountPrefix = '-';
                            break;
                        case 'purchase':
                            iconClass = 'purchase';
                            icon = 'fa-shopping-cart';
                            amountClass = 'negative';
                            amountPrefix = '-';
                            break;
                        default:
                            iconClass = 'info';
                            icon = 'fa-circle-info';
                            amountClass = '';
                            amountPrefix = '';
                    }
                    
                    html += `
                        <div class="history-item">
                            <div class="history-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="history-info">
                                <div class="history-title">${tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdraw' ? 'Withdraw' : 'Pembelian Username'}</div>
                                <div class="history-date">${formatDate(tx.created_at)}</div>
                            </div>
                            <div class="history-amount ${amountClass}">
                                ${amountPrefix}${formatNumber(tx.amount)} TON
                            </div>
                            <div class="history-status ${tx.status}">
                                ${tx.status === 'success' ? 'Sukses' : 'Pending'}
                            </div>
                        </div>
                    `;
                }
                elements.historyList.innerHTML = html;
            } else {
                elements.historyList.innerHTML = '<div class="loading-placeholder">Belum ada riwayat transaksi</div>';
            }
        } catch (error) {
            console.error('Error loading transaction history:', error);
            elements.historyList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    // ==================== REFRESH ====================
    
    async function refreshAllData() {
        hapticLight();
        
        await authenticateUser();
        await loadUsernames();
        await loadPurchasedUsernames();
        await loadTransactionHistory();
        updateBalanceCardUI();
        
        showToast('Data diperbarui!', 'success');
    }

    // ==================== TABS ====================
    
    function setupTabs() {
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                hapticLight();
                const tabId = btn.dataset.tab;
                
                elements.tabBtns.forEach(b => b.classList.remove('active'));
                elements.tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                
                if (tabId === 'storage') {
                    window.location.href = '/winedash/storage';
                    return;
                }
                
                const activeTab = document.getElementById(`${tabId}Tab`);
                if (activeTab) activeTab.classList.add('active');
                
                if (tabId === 'my-usernames') {
                    loadPurchasedUsernames();
                } else if (tabId === 'history') {
                    loadTransactionHistory();
                } else if (tabId === 'marketplace') {
                    loadUsernames();
                } else if (tabId === 'wallet') {
                    // Refresh wallet UI jika perlu
                    if (tonConnectUI) {
                        updateWalletUI();
                        updateBalanceCardUI();
                    }
                }
            });
        });
    }

    // ==================== SAFE AREA INSET & FULLSCREEN ====================

    function applySafeAreaInsets() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.warn('Telegram WebApp not available');
            return;
        }
        
        // Gunakan CSS variables yang disediakan Telegram sebagai fallback
        const root = document.documentElement;
        
        // Baca dari CSS variables Telegram jika ada
        const topInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-top')) || 0;
        const bottomInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-bottom')) || 0;
        const leftInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-left')) || 0;
        const rightInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-right')) || 0;
        
        // Baca dari objek safeAreaInset (Bot API 8.0+)
        let safeTop = topInset;
        let safeBottom = bottomInset;
        let safeLeft = leftInset;
        let safeRight = rightInset;
        
        if (tg.safeAreaInset) {
            safeTop = tg.safeAreaInset.top || safeTop;
            safeBottom = tg.safeAreaInset.bottom || safeBottom;
            safeLeft = tg.safeAreaInset.left || safeLeft;
            safeRight = tg.safeAreaInset.right || safeRight;
        }
        
        // Terapkan ke body
        document.body.style.paddingTop = `${safeTop}px`;
        document.body.style.paddingBottom = `${safeBottom}px`;
        document.body.style.paddingLeft = `${safeLeft}px`;
        document.body.style.paddingRight = `${safeRight}px`;
        
        // Untuk container, gunakan contentSafeAreaInset
        let contentTop = safeTop;
        let contentBottom = safeBottom;
        
        if (tg.contentSafeAreaInset) {
            contentTop = tg.contentSafeAreaInset.top || safeTop;
            contentBottom = tg.contentSafeAreaInset.bottom || safeBottom;
        }
        
        const container = document.querySelector('.winedash-container');
        if (container) {
            container.style.paddingTop = `${contentTop + 16}px`;
            container.style.paddingBottom = `${contentBottom + 90}px`;
        }
        
        console.log('✅ Safe area applied:', { safeTop, safeBottom, contentTop, contentBottom });
    }

    function initSafeArea() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.warn('Telegram WebApp not available for safe area');
            return;
        }
        
        // Apply initial after a short delay to ensure DOM is ready
        setTimeout(applySafeAreaInsets, 50);
        applySafeAreaInsets();
        
        // Listen for safe area changes
        if (tg.onEvent) {
            tg.onEvent('safeAreaChanged', () => {
                console.log('safeAreaChanged event received');
                applySafeAreaInsets();
            });
            
            tg.onEvent('contentSafeAreaChanged', () => {
                console.log('contentSafeAreaChanged event received');
                applySafeAreaInsets();
            });
            
            tg.onEvent('viewportChanged', () => {
                console.log('viewportChanged event received');
                applySafeAreaInsets();
            });
        }
    }

    // Request fullscreen mode
    function requestFullscreenMode() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        if (typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen().catch(err => {
                console.warn('Fullscreen request failed:', err);
            });
        } else {
            console.warn('requestFullscreen not available in this Telegram version');
        }
    }

    function exitFullscreenMode() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        if (typeof tg.exitFullscreen === 'function') {
            tg.exitFullscreen().catch(err => {
                console.warn('Exit fullscreen failed:', err);
            });
        }
    }

    // Toggle fullscreen
    function toggleFullscreen() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        if (tg.isFullscreen) {
            exitFullscreenMode();
        } else {
            requestFullscreenMode();
        }
    }

    // ==================== INITIALIZATION ====================
    
    function initTelegram() {
        const tg = getTelegramWebApp();
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0f0f0f');
            tg.setBackgroundColor('#0f0f0f');
            console.log('✅ Telegram WebApp initialized');
        }
    }

    function setupEventListeners() {
        if (elements.depositBtn) {
            elements.depositBtn.addEventListener('click', deposit);
        }
        if (elements.withdrawBtn) {
            elements.withdrawBtn.addEventListener('click', withdraw);
        }
        if (elements.sellUsernameBtn) {
            elements.sellUsernameBtn.addEventListener('click', sellUsername);
        }
        if (elements.balanceCard) {
            elements.balanceCard.addEventListener('click', (e) => {
                // Don't trigger if clicking on connect button
                if (!e.target.closest('.connect-wallet-btn')) {
                    if (isWalletConnected) {
                        showDepositModal();
                    } else {
                        connectWallet();
                    }
                }
            });
        }
        if (elements.depositTrigger) {
            elements.depositTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                showDepositModal();
            });
        }
    }

    async function init() {
        initTelegram();
        initSafeArea();
        showLoading(true);
        
        setupTabs();
        setupEventListeners();
        setupSearch();
        setupMarketActionBar();
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            updateUserUI();
            await authenticateUser();
            await loadUsernames();
            await loadPurchasedUsernames();
            await loadTransactionHistory();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        await initTonConnect();
        
        showLoading(false);
        console.log('✅ Winedash Marketplace initialized');
    }
    
    init();
})();
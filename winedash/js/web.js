// winedash/js/web.js - Perbaikan TON Connect + Fullscreen + Safe Area

(function() {
    'use strict';
    
    console.log('🍷 Winedash Marketplace - Initializing...');

    const API_BASE_URL = window.location.origin;
    const TON_CONNECT_MANIFEST_URL = `${API_BASE_URL}/winedash/tonconnect-manifest.json`;
    
    let telegramUser = null;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let walletAddress = null;

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        userAvatar: document.getElementById('userAvatar'),
        balanceAmount: document.getElementById('balanceAmount'),
        
        usernameList: document.getElementById('usernameList'),
        purchasedList: document.getElementById('purchasedList'),
        historyList: document.getElementById('historyList'),
        
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
        
        refreshNavBtn: document.getElementById('refreshNavBtn'),
        
        navItems: document.querySelectorAll('.nav-item'),
        tabContents: document.querySelectorAll('.tab-content')
    };

    // ==================== TELEGRAM WEBAPP INITIALIZATION ====================
    
    function initTelegramWebApp() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.warn('Telegram WebApp not available');
            return null;
        }
        
        // Expand to full height
        tg.expand();
        
        // Request fullscreen mode (Bot API 8.0+)
        if (tg.requestFullscreen && typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen().catch(e => console.log('Fullscreen request:', e));
        }
        
        // Set header color to match theme
        if (tg.setHeaderColor) {
            tg.setHeaderColor('bg_color');
        }
        
        if (tg.setBackgroundColor) {
            tg.setBackgroundColor('bg_color');
        }
        
        // Apply safe area insets to body
        if (tg.safeAreaInset) {
            document.body.style.setProperty('--tg-safe-area-inset-top', `${tg.safeAreaInset.top}px`);
            document.body.style.setProperty('--tg-safe-area-inset-bottom', `${tg.safeAreaInset.bottom}px`);
            document.body.style.setProperty('--tg-safe-area-inset-left', `${tg.safeAreaInset.left}px`);
            document.body.style.setProperty('--tg-safe-area-inset-right', `${tg.safeAreaInset.right}px`);
        }
        
        if (tg.contentSafeAreaInset) {
            document.body.style.setProperty('--tg-content-safe-area-inset-top', `${tg.contentSafeAreaInset.top}px`);
            document.body.style.setProperty('--tg-content-safe-area-inset-bottom', `${tg.contentSafeAreaInset.bottom}px`);
        }
        
        // Listen for safe area changes
        if (tg.onEvent) {
            tg.onEvent('safeAreaChanged', () => {
                if (tg.safeAreaInset) {
                    document.body.style.setProperty('--tg-safe-area-inset-top', `${tg.safeAreaInset.top}px`);
                    document.body.style.setProperty('--tg-safe-area-inset-bottom', `${tg.safeAreaInset.bottom}px`);
                }
            });
            
            tg.onEvent('contentSafeAreaChanged', () => {
                if (tg.contentSafeAreaInset) {
                    document.body.style.setProperty('--tg-content-safe-area-inset-top', `${tg.contentSafeAreaInset.top}px`);
                    document.body.style.setProperty('--tg-content-safe-area-inset-bottom', `${tg.contentSafeAreaInset.bottom}px`);
                }
            });
        }
        
        // Enable vertical swipes for better UX
        if (tg.enableVerticalSwipes) {
            tg.enableVerticalSwipes();
        }
        
        console.log('✅ Telegram WebApp initialized with fullscreen + safe area');
        return tg;
    }
    
    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
    function getTelegramWebApp() {
        return window.Telegram?.WebApp || null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback) {
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
        if (num === undefined || num === null) return '0';
        return parseFloat(num).toFixed(4);
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
            const tg = getTelegramWebApp();
            if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const user = tg.initDataUnsafe.user;
                return {
                    id: user.id,
                    username: user.username || '',
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    photo_url: user.photo_url || null
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    function updateUserUI() {
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
        
        const avatarContainer = elements.userAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
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
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (typeof window.TON_CONNECT_UI === 'undefined') {
                    console.error('TON Connect UI still not available');
                    showToast('TON Connect not available', 'error');
                    return;
                }
            }
            
            const manifestUrl = `${API_BASE_URL}/winedash/tonconnect-manifest.json`;
            
            tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: manifestUrl,
                buttonRootId: 'ton-connect',
                language: 'en'
            });
            
            console.log('✅ TON Connect UI initialized');
            
            tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet) {
                    isWalletConnected = true;
                    walletAddress = wallet.account.address;
                    updateWalletUI();
                    await saveWalletAddress(walletAddress);
                    showToast('Wallet connected!', 'success');
                } else {
                    isWalletConnected = false;
                    walletAddress = null;
                    updateWalletUI();
                }
            });
            
            if (tonConnectUI.connected) {
                const wallet = tonConnectUI.wallet;
                if (wallet) {
                    isWalletConnected = true;
                    walletAddress = wallet.account.address;
                    updateWalletUI();
                    await saveWalletAddress(walletAddress);
                }
            }
            
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
            await tonConnectUI.connect();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showToast('Failed to connect wallet', 'error');
        } finally {
            showLoading(false);
        }
    }

    function disconnectWallet() {
        if (tonConnectUI) {
            tonConnectUI.disconnect();
            isWalletConnected = false;
            walletAddress = null;
            updateWalletUI();
            showToast('Wallet disconnected', 'info');
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
        if (!telegramUser) return;
        
        try {
            await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address })
            });
        } catch (error) {
            console.error('Error saving wallet address:', error);
        }
    }

    // ==================== DEPOSIT ====================
    
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
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra',
                    amount: amountNano
                }]
            };
            
            const result = await tonConnectUI.sendTransaction(transaction);
            
            const memo = `deposit:${telegramUser?.id}:${Date.now()}`;
            
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
            
            if (verifyData.success) {
                showToast(`Deposit ${amount} TON berhasil!`, 'success');
                if (elements.depositAmount) elements.depositAmount.value = '';
                refreshAllData();
            } else {
                showToast(verifyData.error || 'Deposit perlu dikonfirmasi', 'info');
                refreshAllData();
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
    
    async function loadUsernames() {
        if (!elements.usernameList) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=50`);
            const data = await response.json();
            
            if (data.success && data.usernames.length > 0) {
                let html = '';
                for (const username of data.usernames) {
                    html += `
                        <div class="username-item" data-id="${username.id}">
                            <div class="username-icon">
                                <i class="fas fa-tag"></i>
                            </div>
                            <div class="username-info">
                                <div class="username-name">${escapeHtml(username.username)}</div>
                                <div class="username-category">${escapeHtml(username.category)}</div>
                            </div>
                            <div class="username-price">
                                ${formatNumber(username.price)} <small>TON</small>
                            </div>
                            <button class="username-buy-btn" data-id="${username.id}" data-price="${username.price}">
                                <i class="fas fa-shopping-cart"></i> Beli
                            </button>
                        </div>
                    `;
                }
                elements.usernameList.innerHTML = html;
                
                document.querySelectorAll('.username-buy-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        const price = parseFloat(btn.dataset.price);
                        buyUsername(id, price);
                    });
                });
            } else {
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
        showLoading(true);
        
        try {
            await authenticateUser();
            await Promise.all([
                loadUsernames(),
                loadPurchasedUsernames(),
                loadTransactionHistory()
            ]);
            showToast('Data diperbarui!', 'success');
        } catch (error) {
            console.error('Error refreshing data:', error);
            showToast('Gagal memperbarui data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== BOTTOM NAVIGATION ====================
    
    function setupBottomNav() {
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => {
                hapticLight();
                const tabId = item.dataset.tab;
                
                // Handle refresh button
                if (item.id === 'refreshNavBtn') {
                    refreshAllData();
                    return;
                }
                
                // Update active state on nav items
                elements.navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update active tab content
                elements.tabContents.forEach(content => content.classList.remove('active'));
                const activeTab = document.getElementById(`${tabId}Tab`);
                if (activeTab) activeTab.classList.add('active');
                
                // Load data based on tab
                if (tabId === 'my-usernames') {
                    loadPurchasedUsernames();
                } else if (tabId === 'history') {
                    loadTransactionHistory();
                } else if (tabId === 'marketplace') {
                    loadUsernames();
                }
            });
        });
    }

    // ==================== INITIALIZATION ====================
    
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
    }

    async function init() {
        // Initialize Telegram WebApp first
        initTelegramWebApp();
        
        showLoading(true);
        
        setupBottomNav();
        setupEventListeners();
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            updateUserUI();
            await authenticateUser();
            await Promise.all([
                loadUsernames(),
                loadPurchasedUsernames(),
                loadTransactionHistory()
            ]);
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        await initTonConnect();
        
        // Call ready() to hide loading placeholder
        const tg = getTelegramWebApp();
        if (tg && tg.ready) {
            tg.ready();
        }
        
        showLoading(false);
        console.log('✅ Winedash Marketplace initialized');
    }
    
    init();
})();
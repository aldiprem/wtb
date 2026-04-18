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
    let allUsernames = []; // Store all usernames for search

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
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
        
        if (elements.userName) elements.userName.textContent = fullName || 'Pengguna Telegram';
        if (elements.userUsername) elements.userUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        
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
                console.warn('TON Connect UI not loaded, waiting...');
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
            updateBalanceCardUI();
            showToast('Wallet disconnected', 'info');
        }
    }

    function updateBalanceCardUI() {
        const balanceCard = elements.balanceCard;
        if (!balanceCard) return;
        
        if (isWalletConnected && walletAddress) {
            // Wallet connected - show deposit plus button
            balanceCard.style.cursor = 'pointer';
            const depositIcon = balanceCard.querySelector('.deposit-icon');
            if (depositIcon) {
                depositIcon.style.display = 'inline-flex';
            }
        } else {
            // Wallet not connected - show connect button
            balanceCard.style.cursor = 'pointer';
            const depositIcon = balanceCard.querySelector('.deposit-icon');
            if (depositIcon) {
                depositIcon.style.display = 'none';
            }
            
            // Check if connect button already exists
            let connectBtn = balanceCard.querySelector('.connect-wallet-btn');
            if (!connectBtn) {
                connectBtn = document.createElement('button');
                connectBtn.className = 'connect-wallet-btn';
                connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
                connectBtn.onclick = (e) => {
                    e.stopPropagation();
                    connectWallet();
                };
                balanceCard.appendChild(connectBtn);
            }
        }
        
        // Remove connect button if wallet connected
        if (isWalletConnected && walletAddress) {
            const connectBtn = balanceCard.querySelector('.connect-wallet-btn');
            if (connectBtn) connectBtn.remove();
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
            
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('✅ Transaction sent:', result);
            
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
    
    function renderUsernames(usernames) {
        if (!elements.usernameList) return;
        
        if (usernames.length > 0) {
            let html = '';
            for (const username of usernames) {
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
    }
    
    function filterUsernames(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            renderUsernames(allUsernames);
            return;
        }
        
        const term = searchTerm.toLowerCase().trim();
        const filtered = allUsernames.filter(username => 
            username.username.toLowerCase().includes(term) ||
            username.category.toLowerCase().includes(term)
        );
        renderUsernames(filtered);
    }
    
    async function loadUsernames() {
        if (!elements.usernameList) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=100`);
            const data = await response.json();
            
            if (data.success && data.usernames.length > 0) {
                allUsernames = data.usernames;
                renderUsernames(allUsernames);
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
                const activeTab = document.getElementById(`${tabId}Tab`);
                if (activeTab) activeTab.classList.add('active');
                
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
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                filterUsernames(e.target.value);
            });
        }
    }

    async function init() {
        initTelegram();
        showLoading(true);
        
        setupTabs();
        setupEventListeners();
        
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
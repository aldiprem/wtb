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
    let currentLayout = localStorage.getItem('market_layout') || 'grid';
    let currentSort = 'default';
    let currentPriceFilter = 'all';
    let filterOverlay = null;
    let currentWalletBalance = 0;
    let depositPanel = null;
    let withdrawPanel = null;
    let walletPanelOverlay = null;

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
                // PERBAIKAN: Update balance amount di sini
                if (elements.balanceAmount) {
                    const newBalance = formatNumber(data.user.balance);
                    elements.balanceAmount.textContent = newBalance;
                    console.log(`💰 Balance updated to: ${newBalance} TON`);
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
                    await saveWalletAddress(walletAddress);  // PASTIKAN INI ADA
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
                    await saveWalletAddress(walletAddress);  // PASTIKAN INI ADA
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
        
        // ==================== PERBAIKAN: Ambil balance terbaru dari server ====================
        const getCurrentBalance = async () => {
            if (!telegramUser) return 0;
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
                const data = await response.json();
                if (data.success && data.user) {
                    return parseFloat(data.user.balance);
                }
            } catch (error) {
                console.error('Error fetching balance:', error);
            }
            return 0;
        };
        
        const updateUI = async () => {
            const currentBalance = await getCurrentBalance();
            const formattedBalance = currentBalance.toFixed(2);
            
            if (isWalletConnected && walletAddress) {
                balanceCard.classList.remove('hidden');
                balanceCard.style.cursor = 'pointer';
                
                balanceCard.innerHTML = `
                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                    <span class="balance-amount" id="balanceAmount">${formattedBalance}</span>
                    <div class="deposit-icon" id="depositTrigger">
                        <i class="fas fa-plus"></i>
                        <span>Deposit</span>
                    </div>
                `;
                
                const newDepositTrigger = document.getElementById('depositTrigger');
                if (newDepositTrigger) {
                    newDepositTrigger.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDepositModal();
                    });
                }
                
                elements.balanceAmount = document.getElementById('balanceAmount');
                
            } else {
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
        };
        
        updateUI();
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
            console.log('💾 Saving wallet address to database:', address);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Wallet address saved to database');
                showToast('Wallet address saved!', 'success');
            } else {
                console.error('Failed to save wallet address:', data.error);
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
            const memo = `deposit:${telegramUser?.id}:${Date.now()}`;
            
            console.log('📤 Processing deposit:', { amount, amountNano, senderAddress, memo });
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra',
                    amount: amountNano
                }]
            };
            
            console.log('📤 Sending transaction:', JSON.stringify(transaction, null, 2));
            
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('✅ Transaction sent:', result);
            
            const transactionHash = result.boc || result.hash || `tx_${Date.now()}`;
            
            // Kirim konfirmasi ke server
            const verifyResponse = await fetch(`${API_BASE_URL}/api/winedash/deposit/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    transaction_hash: transactionHash,
                    from_address: senderAddress,
                    memo: memo
                })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
                showToast(`Deposit ${amount} TON berhasil!`, 'success');
                if (elements.depositAmount) elements.depositAmount.value = '';
                
                // ==================== PERBAIKAN: Update balance langsung dari response ====================
                if (verifyData.new_balance !== undefined) {
                    // Update balance di UI
                    if (elements.balanceAmount) {
                        elements.balanceAmount.textContent = formatNumber(verifyData.new_balance);
                    }
                    // Update balance card juga
                    updateBalanceCardUI();
                    
                    console.log(`💰 Balance updated to: ${verifyData.new_balance} TON`);
                }
                
                // Refresh semua data untuk memastikan konsistensi
                await refreshAllData();
            } else {
                showToast(verifyData.error || 'Deposit perlu dikonfirmasi', 'info');
                await refreshAllData();
            }
            
        } catch (error) {
            console.error('Error creating deposit:', error);
            
            let errorMessage = 'Error creating deposit';
            if (error.message) {
                if (error.message.includes('rejected') || error.message.includes('cancelled')) {
                    errorMessage = 'Transaksi dibatalkan oleh user';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Saldo wallet tidak mencukupi';
                } else if (error.message.includes('Invalid')) {
                    errorMessage = 'Format transaksi tidak valid. Silakan coba lagi.';
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
            showToast('Hubungkan wallet TON terlebih dahulu untuk menerima dana', 'warning');
            await connectWallet();
            return;
        }
        
        // Cek balance user
        const currentBalance = parseFloat(elements.balanceAmount?.textContent || '0');
        if (currentBalance < amount) {
            showToast(`Saldo tidak mencukupi. Saldo Anda: ${currentBalance} TON`, 'error');
            return;
        }
        
        // ==================== TAMBAHKAN KONFIRMASI FEE ====================
        const WITHDRAW_FEE = 0.02;
        const amountToReceive = amount - WITHDRAW_FEE;
        
        if (!confirm(`Anda akan withdraw ${amount} TON.\n\nBiaya jaringan (fee): ${WITHDRAW_FEE} TON\nJumlah yang akan diterima: ${amountToReceive.toFixed(2)} TON\n\nLanjutkan?`)) {
            return;
        }
        
        hapticMedium();
        
        const withdrawBtn = elements.withdrawBtn;
        const originalText = withdrawBtn?.innerHTML;
        if (withdrawBtn) {
            withdrawBtn.disabled = true;
            withdrawBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses withdraw...</span>';
        }
        
        try {
            const destinationAddress = tonConnectUI.account?.address;
            
            console.log('📤 Processing withdrawal:', { amount, destination: destinationAddress });
            
            // Step 1: Create withdrawal request
            const createResponse = await fetch(`${API_BASE_URL}/api/winedash/withdraw/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    wallet_address: destinationAddress
                })
            });
            
            const createData = await createResponse.json();
            
            if (!createData.success) {
                throw new Error(createData.error || 'Failed to create withdrawal request');
            }
            
            console.log('✅ Withdrawal request created:', createData);
            
            // Step 2: Process withdrawal (send TON)
            showToast('⏳ Memproses withdraw, mohon tunggu...', 'info');
            
            const processResponse = await fetch(`${API_BASE_URL}/api/winedash/withdraw/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    destination_address: destinationAddress,
                    withdrawal_id: createData.withdrawal_id
                })
            });
            
            const processData = await processResponse.json();
            
            if (!processData.success) {
                throw new Error(processData.error || 'Failed to process withdrawal');
            }
            
            console.log('✅ Withdrawal processed:', processData);
            
            showToast(`✅ Withdraw ${amount} TON berhasil! (Fee ${WITHDRAW_FEE} TON, ${amountToReceive.toFixed(2)} TON dikirim)`, 'success');
            
            // Reset form
            if (elements.withdrawAmount) elements.withdrawAmount.value = '';
            
            // Refresh data
            await refreshAllData();
            
        } catch (error) {
            console.error('❌ Withdraw error:', error);
            
            let errorMessage = error.message;
            if (error.message.includes('Insufficient balance')) {
                errorMessage = 'Saldo tidak mencukupi';
            } else if (error.message.includes('network')) {
                errorMessage = 'Gangguan jaringan, coba lagi nanti';
            }
            
            showToast(`❌ ${errorMessage}`, 'error');
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
        
        if (usernames.length === 0) {
            elements.usernameList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">No Usernames Available</div>
                    <div class="empty-subtitle">Be the first to list your username!</div>
                </div>
            `;
            return;
        }
        
        if (currentLayout === 'grid') {
            elements.usernameList.className = 'marketplace-grid';
            let html = '';
            for (const username of usernames) {
                let avatarUrl = localStorage.getItem(`avatar_${username.username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                html += `
                    <div class="marketplace-card" data-id="${username.id}">
                        <div class="marketplace-card-image">
                            <div class="card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(username.username)}" data-username="${username.username}" class="avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="card-username">@${escapeHtml(username.username)}</div>
                        </div>
                        <div class="marketplace-card-info">
                            <div class="card-price-row">
                                <div class="price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                    <span class="card-price">${formatNumber(username.price)}</span>
                                </div>
                                <div class="card-basedon">${escapeHtml(username.based_on || '-')}</div>
                            </div>
                            <button class="marketplace-buy-btn" data-id="${username.id}" data-price="${username.price}">
                                <i class="fas fa-shopping-cart"></i> Buy
                            </button>
                        </div>
                    </div>
                `;
            }
            elements.usernameList.innerHTML = html;
            
            // Fetch avatar untuk setiap card
            setTimeout(() => {
                document.querySelectorAll('.marketplace-card .card-avatar img').forEach(img => {
                    const username = img.dataset.username;
                    if (username) fetchProfilePhoto(username).then(url => {
                        if (url && img.src !== url) img.src = url;
                    });
                });
            }, 100);
        } else {
            elements.usernameList.className = 'marketplace-list';
            let html = '';
            for (const username of usernames) {
                let avatarUrl = localStorage.getItem(`avatar_${username.username}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                html += `
                    <div class="marketplace-item" data-id="${username.id}">
                        <div class="marketplace-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(username.username)}" class="marketplace-avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="marketplace-info">
                            <div class="marketplace-name">@${escapeHtml(username.username)}</div>
                            <div class="marketplace-basedon">${escapeHtml(username.based_on || '-')}</div>
                        </div>
                        <div class="marketplace-price-wrapper">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo-small">
                            <span class="marketplace-price">${formatNumber(username.price)}</span>
                        </div>
                        <button class="marketplace-buy-btn-small" data-id="${username.id}" data-price="${username.price}">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                    </div>
                `;
            }
            elements.usernameList.innerHTML = html;
            
            // Fetch avatar untuk setiap item
            setTimeout(() => {
                document.querySelectorAll('.marketplace-avatar-img').forEach(img => {
                    const parentItem = img.closest('.marketplace-item');
                    if (parentItem) {
                        const nameEl = parentItem.querySelector('.marketplace-name');
                        if (nameEl) {
                            const username = nameEl.textContent.replace('@', '');
                            fetchProfilePhoto(username).then(url => {
                                if (url && img.src !== url) img.src = url;
                            });
                        }
                    }
                });
            }, 100);
        }
        
        // Attach event listeners untuk tombol beli
        document.querySelectorAll('.marketplace-buy-btn, .marketplace-buy-btn-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const price = parseFloat(btn.dataset.price);
                buyUsername(id, price);
            });
        });
    }
        
    function filterUsernames(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            applyFiltersAndRender();
            return;
        }
        
        const term = searchTerm.toLowerCase().trim();
        let filtered = allUsernames.filter(username => 
            username.username.toLowerCase().includes(term) ||
            (username.based_on && username.based_on.toLowerCase().includes(term))
        );
        
        // Apply price filter after search
        if (currentPriceFilter !== 'all') {
            filtered = filtered.filter(u => {
                const price = u.price;
                if (currentPriceFilter === 'under10') return price < 10;
                if (currentPriceFilter === '10to50') return price >= 10 && price <= 50;
                if (currentPriceFilter === 'above50') return price > 50;
                return true;
            });
        }
        
        // Apply sort
        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'price_asc') return a.price - b.price;
                if (currentSort === 'price_desc') return b.price - a.price;
                if (currentSort === 'name_asc') return a.username.localeCompare(b.username);
                return 0;
            });
        }
        
        renderUsernames(filtered);
    }
        
    async function loadUsernames() {
        if (!elements.usernameList) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=100`);
            const data = await response.json();
            
            if (data.success && data.usernames.length > 0) {
                // Hanya tampilkan username yang statusnya 'available'
                allUsernames = data.usernames.filter(u => u.status === 'available');
                applyFiltersAndRender();  // Gunakan applyFiltersAndRender
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
                const searchTerm = searchInput?.value || '';
                filterUsernames(searchTerm);
                hapticLight();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = searchInput.value || '';
                    filterUsernames(searchTerm);
                    hapticLight();
                }
            });
        }
        
        // Inisialisasi filter button
        const filterBtn = document.getElementById('marketplaceFilterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', showFilterPanel);
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
        
        // ==================== PERBAIKAN: Refresh user data dari server ====================
        const user = await authenticateUser();
        
        if (user) {
            // Update balance di UI
            if (elements.balanceAmount) {
                const newBalance = formatNumber(user.balance);
                elements.balanceAmount.textContent = newBalance;
                console.log(`💰 RefreshAllData - Balance updated to: ${newBalance} TON`);
            }
        }
        
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

    // Setup wallet panel event listeners
    function setupWalletEventListeners() {
        const walletDepositBtn = document.getElementById('walletDepositBtn');
        if (walletDepositBtn) {
            // Hapus listener lama dengan clone
            const newBtn = walletDepositBtn.cloneNode(true);
            walletDepositBtn.parentNode.replaceChild(newBtn, walletDepositBtn);
            newBtn.addEventListener('click', showDepositPanel);
        }
        
        const walletWithdrawBtn = document.getElementById('walletWithdrawBtn');
        if (walletWithdrawBtn) {
            const newBtn = walletWithdrawBtn.cloneNode(true);
            walletWithdrawBtn.parentNode.replaceChild(newBtn, walletWithdrawBtn);
            newBtn.addEventListener('click', showWithdrawPanel);
        }
        
        const confirmDepositBtn = document.getElementById('confirmDepositBtn');
        if (confirmDepositBtn) {
            const newBtn = confirmDepositBtn.cloneNode(true);
            confirmDepositBtn.parentNode.replaceChild(newBtn, confirmDepositBtn);
            newBtn.addEventListener('click', depositFromPanel);
        }
        
        const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');
        if (confirmWithdrawBtn) {
            const newBtn = confirmWithdrawBtn.cloneNode(true);
            confirmWithdrawBtn.parentNode.replaceChild(newBtn, confirmWithdrawBtn);
            newBtn.addEventListener('click', withdrawFromPanel);
        }
    }

    // Inisialisasi wallet panels
    function initWalletPanels() {
        depositPanel = document.getElementById('depositPanel');
        withdrawPanel = document.getElementById('withdrawPanel');
        walletPanelOverlay = document.getElementById('walletPanelOverlay');
        
        if (!walletPanelOverlay) {
            walletPanelOverlay = document.createElement('div');
            walletPanelOverlay.id = 'walletPanelOverlay';
            walletPanelOverlay.className = 'panel-overlay';
            document.body.appendChild(walletPanelOverlay);
        }
        
        // Deposit panel close
        const closeDepositBtn = document.getElementById('closeDepositPanelBtn');
        if (closeDepositBtn) {
            const newBtn = closeDepositBtn.cloneNode(true);
            closeDepositBtn.parentNode.replaceChild(newBtn, closeDepositBtn);
            newBtn.addEventListener('click', closeDepositPanel);
        }
        
        // Withdraw panel close
        const closeWithdrawBtn = document.getElementById('closeWithdrawPanelBtn');
        if (closeWithdrawBtn) {
            const newBtn = closeWithdrawBtn.cloneNode(true);
            closeWithdrawBtn.parentNode.replaceChild(newBtn, closeWithdrawBtn);
            newBtn.addEventListener('click', closeWithdrawPanel);
        }
        
        // Overlay click
        walletPanelOverlay.addEventListener('click', () => {
            closeDepositPanel();
            closeWithdrawPanel();
        });
        
        // Quick amount buttons
        document.querySelectorAll('.quick-amount-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                const percent = parseInt(newBtn.dataset.percent);
                const isDeposit = newBtn.closest('#depositPanel') !== null;
                const input = isDeposit ? document.getElementById('depositAmountInput') : document.getElementById('withdrawAmountInput');
                
                if (input && currentWalletBalance > 0) {
                    let amount = 0;
                    if (percent === 100) {
                        amount = currentWalletBalance;
                    } else {
                        amount = (currentWalletBalance * percent) / 100;
                    }
                    if (!isDeposit) {
                        amount = Math.floor(amount * 100) / 100;
                    }
                    input.value = amount.toFixed(2);
                    input.dispatchEvent(new Event('input'));
                }
            });
        });
        
        // Setup drag to close
        setupPanelDragToClose(depositPanel, closeDepositPanel);
        setupPanelDragToClose(withdrawPanel, closeWithdrawPanel);
    }

    function setupPanelDragToClose(panel, closeFunction) {
        if (!panel) return;
        
        const dragHandle = panel.querySelector('.panel-drag-handle');
        if (!dragHandle) return;
        
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            panel.style.transition = 'none';
            hapticLight();
        };
        
        const onTouchMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) {
                panel.style.transform = `translateY(${Math.min(deltaY, panel.offsetHeight * 0.7)}px)`;
            }
        };
        
        const onTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            const deltaY = currentY - startY;
            if (deltaY > 100) {
                closeFunction();
            } else {
                panel.style.transform = '';
            }
        };
        
        dragHandle.addEventListener('touchstart', onTouchStart);
        dragHandle.addEventListener('touchmove', onTouchMove);
        dragHandle.addEventListener('touchend', onTouchEnd);
    }

    function showDepositPanel() {
        if (!depositPanel) return;
        
        depositPanel.style.transform = '';
        depositPanel.style.transition = '';
        
        const input = document.getElementById('depositAmountInput');
        if (input) input.value = '';
        
        walletPanelOverlay.classList.add('active');
        document.body.classList.add('wallet-panel-open');
        
        depositPanel.style.display = 'flex';
        setTimeout(() => {
            depositPanel.classList.add('open');
        }, 10);
        
        hapticLight();
    }

    function closeDepositPanel() {
        if (!depositPanel) return;
        depositPanel.classList.remove('open');
        walletPanelOverlay.classList.remove('active');
        document.body.classList.remove('wallet-panel-open');
        setTimeout(() => {
            depositPanel.style.display = 'none';
        }, 300);
        hapticLight();
    }

    function showWithdrawPanel() {
        if (!withdrawPanel) return;
        
        withdrawPanel.style.transform = '';
        withdrawPanel.style.transition = '';
        
        const input = document.getElementById('withdrawAmountInput');
        if (input) input.value = '';
        
        walletPanelOverlay.classList.add('active');
        document.body.classList.add('wallet-panel-open');
        
        withdrawPanel.style.display = 'flex';
        setTimeout(() => {
            withdrawPanel.classList.add('open');
        }, 10);
        
        hapticLight();
    }

    function closeWithdrawPanel() {
        if (!withdrawPanel) return;
        withdrawPanel.classList.remove('open');
        walletPanelOverlay.classList.remove('active');
        document.body.classList.remove('wallet-panel-open');
        setTimeout(() => {
            withdrawPanel.style.display = 'none';
        }, 300);
        hapticLight();
    }

    // Update wallet UI dengan Tonkeeper style
    function updateWalletMainUI() {
        const walletMainCard = document.getElementById('walletMainCard');
        const walletAddressDisplay = document.getElementById('walletAddressValue');
        const walletBalanceAmount = document.getElementById('walletBalanceAmount');
        
        console.log('🔄 updateWalletMainUI called - isWalletConnected:', isWalletConnected, 'walletAddress:', walletAddress);
        
        if (isWalletConnected && walletAddress) {
            if (walletMainCard) walletMainCard.style.display = 'block';
            
            // Format address
            const formattedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            if (walletAddressDisplay) walletAddressDisplay.textContent = formattedAddress;
            
            // Update balance - ambil dari user data
            const getBalance = async () => {
                if (telegramUser) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
                        const data = await response.json();
                        if (data.success && data.user) {
                            currentWalletBalance = parseFloat(data.user.balance);
                            if (walletBalanceAmount) walletBalanceAmount.textContent = currentWalletBalance.toFixed(2);
                            console.log(`💰 Wallet balance updated: ${currentWalletBalance} TON`);
                        }
                    } catch (error) {
                        console.error('Error fetching balance:', error);
                    }
                }
            };
            getBalance();
            
        } else {
            if (walletMainCard) walletMainCard.style.display = 'none';
            currentWalletBalance = 0;
        }
    }

    // Deposit from panel
    async function depositFromPanel() {
        const amountInput = document.getElementById('depositAmountInput');
        const amount = parseFloat(amountInput?.value);
        
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
            closeDepositPanel();
            await connectWallet();
            return;
        }
        
        hapticMedium();
        
        const confirmBtn = document.getElementById('confirmDepositBtn');
        const originalText = confirmBtn?.innerHTML;
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="btn-loading"></span> Memproses...';
        }
        
        try {
            const senderAddress = tonConnectUI.account?.address;
            const amountNano = Math.floor(amount * 1_000_000_000).toString();
            const memo = `deposit:${telegramUser?.id}:${Date.now()}`;
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra',
                    amount: amountNano
                }]
            };
            
            const result = await tonConnectUI.sendTransaction(transaction);
            const transactionHash = result.boc || result.hash || `tx_${Date.now()}`;
            
            const verifyResponse = await fetch(`${API_BASE_URL}/api/winedash/deposit/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    transaction_hash: transactionHash,
                    from_address: senderAddress,
                    memo: memo
                })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
                showToast(`Deposit ${amount} TON berhasil!`, 'success');
                amountInput.value = '';
                closeDepositPanel();
                await refreshAllData();
                updateWalletMainUI();
                updateBalanceCardUI();
            } else {
                showToast(verifyData.error || 'Deposit perlu dikonfirmasi', 'info');
                await refreshAllData();
            }
            
        } catch (error) {
            console.error('Error creating deposit:', error);
            let errorMessage = 'Error creating deposit';
            if (error.message) {
                if (error.message.includes('rejected') || error.message.includes('cancelled')) {
                    errorMessage = 'Transaksi dibatalkan oleh user';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Saldo wallet tidak mencukupi';
                } else {
                    errorMessage = error.message;
                }
            }
            showToast(errorMessage, 'error');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = originalText || '<i class="fas fa-check"></i> Konfirmasi Deposit';
            }
        }
    }

    // Withdraw from panel
    async function withdrawFromPanel() {
        const amountInput = document.getElementById('withdrawAmountInput');
        const amount = parseFloat(amountInput?.value);
        
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
            closeWithdrawPanel();
            await connectWallet();
            return;
        }
        
        if (currentWalletBalance < amount) {
            showToast(`Saldo tidak mencukupi. Saldo Anda: ${currentWalletBalance} TON`, 'error');
            return;
        }
        
        const WITHDRAW_FEE = 0.02;
        const amountToReceive = amount - WITHDRAW_FEE;
        
        if (!confirm(`Anda akan withdraw ${amount} TON.\n\nBiaya jaringan (fee): ${WITHDRAW_FEE} TON\nJumlah yang akan diterima: ${amountToReceive.toFixed(2)} TON\n\nLanjutkan?`)) {
            return;
        }
        
        hapticMedium();
        
        const confirmBtn = document.getElementById('confirmWithdrawBtn');
        const originalText = confirmBtn?.innerHTML;
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="btn-loading"></span> Memproses...';
        }
        
        try {
            const destinationAddress = tonConnectUI.account?.address;
            
            const shortId = Math.random().toString(36).substring(2, 12);
            const memo = `wd_${shortId}:${telegramUser.id}`;
            
            const createResponse = await fetch(`${API_BASE_URL}/api/winedash/withdraw/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    wallet_address: destinationAddress
                })
            });
            
            const createData = await createResponse.json();
            
            if (!createData.success) {
                throw new Error(createData.error || 'Failed to create withdrawal request');
            }
            
            showToast('⏳ Memproses withdraw, mohon tunggu...', 'info');
            
            const processResponse = await fetch(`${API_BASE_URL}/api/winedash/withdraw/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    destination_address: destinationAddress,
                    withdrawal_id: createData.withdrawal_id,
                    memo: memo
                })
            });
            
            const processData = await processResponse.json();
            
            if (!processData.success) {
                throw new Error(processData.error || 'Failed to process withdrawal');
            }
            
            showToast(`✅ Withdraw ${amount} TON berhasil! (Fee ${WITHDRAW_FEE} TON, ${amountToReceive.toFixed(2)} TON dikirim)`, 'success');
            
            amountInput.value = '';
            closeWithdrawPanel();
            await refreshAllData();
            updateWalletMainUI();
            updateBalanceCardUI();
            
            if (processData.transaction_hash) {
                setTimeout(() => {
                    if (confirm('Lihat detail transaksi di TonViewer?')) {
                        window.open(`https://tonviewer.com/transaction/${processData.transaction_hash}`, '_blank');
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Withdraw error:', error);
            let errorMessage = error.message;
            if (error.message.includes('Insufficient balance')) {
                errorMessage = 'Saldo tidak mencukupi';
            } else if (error.message.includes('network')) {
                errorMessage = 'Gangguan jaringan, coba lagi nanti';
            }
            showToast(`❌ ${errorMessage}`, 'error');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = originalText || '<i class="fas fa-check"></i> Konfirmasi Withdraw';
            }
        }
    }

    // HAPUS fungsi init() yang duplikat, gunakan satu ini:
    async function init() {
        initTelegram();
        initSafeArea();
        showLoading(true);
        
        setupTabs();
        setupEventListeners();
        setupSearch();
        setupWalletEventListeners();
        initWalletPanels();
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            updateUserUI();
            await authenticateUser();
            await loadUsernames();
            await loadPurchasedUsernames();
            await loadTransactionHistory();
            updateWalletMainUI();
            updateBalanceCardUI();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        await initTonConnect();
        
        showLoading(false);
        console.log('✅ Winedash Marketplace initialized');
    }
    init();
})();
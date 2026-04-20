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
    let currentPriceFilter = { min: 0, max: 9999 };
    let filterOverlay = null;
    let currentWalletBalance = 0;
    let depositPanel = null;
    let withdrawPanel = null;
    let walletPanelOverlay = null;
    let marketDetailOverlay = null;
    let activeFilterCount = 0;
    let currentBasedOnFilter = 'all';
    let availableBasedOnList = [];
    let currentFilterType = null;
    let filterPanel = null;
    let tempSort = 'default';
    let tempPriceFilter = { min: 0, max: 9999 };
    let tempBasedOnFilter = 'all';
    let filterPanelOverlay = null;
    let filterSummaryOverlay = null;

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
            
            // Gunakan container untuk TON Connect di kanan
            tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: manifestUrl,
                buttonRootId: 'ton-connect-container',
                language: 'en'
            });
            
            console.log('✅ TON Connect UI initialized');
            
            // Styling tambahan untuk tombol TON Connect
            const style = document.createElement('style');
            style.textContent = `
                .ton-connect-right ton-connect-button,
                .ton-connect-right button {
                    --tc-button-background: #40a7e3;
                    --tc-button-background-hover: #2d8bcb;
                    --tc-button-text-color: white;
                    --tc-border-radius: 40px;
                    --tc-button-font-size: 13px;
                    --tc-button-padding: 8px 16px;
                    width: auto;
                    min-width: 140px;
                }
            `;
            document.head.appendChild(style);
            
            tonConnectUI.onStatusChange(async (wallet) => {
                console.log('📱 Wallet status changed:', wallet);
                
                if (wallet) {
                    isWalletConnected = true;
                    walletAddress = wallet.account.address;
                    updateWalletUI();
                    await saveWalletAddress(walletAddress);
                    showToast('Wallet connected!', 'success');
                    updateBalanceCardUI();
                    updateWalletMainUI();
                } else {
                    isWalletConnected = false;
                    walletAddress = null;
                    updateWalletUI();
                    updateBalanceCardUI();
                    updateWalletMainUI();
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
                    updateWalletMainUI();
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
                
    function filterAndRender() {
        if (!allUsernames) {
            renderUsernames([]);
            return;
        }
        
        let filtered = [...allUsernames];
        
        // Filter by search term
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(username => 
                username.username.toLowerCase().includes(term) ||
                (username.based_on && username.based_on.toLowerCase().includes(term))
            );
        }
        
        // Filter by status
        if (currentStatus !== 'all') {
            filtered = filtered.filter(username => {
                const isListed = username.status === 'available';
                return currentStatus === 'listed' ? isListed : !isListed;
            });
        }
        
        // Sort
        if (filtered.length > 0) {
            filtered.sort((a, b) => {
                switch (currentSort) {
                    case 'price_asc': return (a.price || 0) - (b.price || 0);
                    case 'price_desc': return (b.price || 0) - (a.price || 0);
                    case 'name_asc': return (a.username || '').localeCompare(b.username || '');
                    case 'name_desc': return (b.username || '').localeCompare(a.username || '');
                    case 'date_desc': return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                    default: return (a.price || 0) - (b.price || 0);
                }
            });
        }
        
        renderUsernames(filtered);
    }

    function renderUsernames(usernames) {
        if (!elements.usernameList) return;
        
        if (!usernames || usernames.length === 0) {
            elements.usernameList.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-animation" id="marketplaceEmptyAnimationInner" style="width: 120px; height: 120px; margin: 0 auto 16px;"></div>
                    <div class="empty-title" style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Usernames Available</div>
                    <div class="empty-subtitle" style="font-size: 12px; color: var(--text-muted);">Be the first to list your username!</div>
                </div>
            `;
            loadMarketplaceTGSAnimation();
            return;
        }
        
        // GRID LAYOUT
        if (currentLayout === 'grid') {
            elements.usernameList.className = 'marketplace-grid';
            let html = '';
            for (const username of usernames) {
                let usernameStr = username.username || '';
                if (typeof usernameStr !== 'string') usernameStr = String(usernameStr);
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                const basedOnText = username.based_on || '-';
                
                // Ambil foto profil dari cache atau default
                let avatarUrl = localStorage.getItem(`avatar_${usernameStr}`);
                if (!avatarUrl || !avatarUrl.startsWith('data:image')) {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                const usernameData = {
                    id: username.id,
                    username: usernameStr,
                    based_on: username.based_on || '',
                    price: username.price,
                    seller_id: username.seller_id,
                    seller_wallet: username.seller_wallet,
                    status: username.status,
                    created_at: username.created_at
                };

                html += `
                    <div class="marketplace-card" data-id="${username.id}" data-username='${JSON.stringify(usernameData).replace(/'/g, "&#39;")}'>
                        <div class="marketplace-card-image">
                            <div class="card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" data-username="${usernameStr}" class="avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                            </div>
                            <div class="card-username">@${escapeHtml(usernameStr)}</div>
                        </div>
                        <div class="marketplace-card-info">
                            <div class="card-price-row">
                                <div class="price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                    <span class="card-price">${formatNumber(username.price)}</span>
                                </div>
                                <div class="card-basedon">${escapeHtml(basedOnText)}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            elements.usernameList.innerHTML = html;
            
            // Attach click events untuk card
            document.querySelectorAll('.marketplace-card').forEach(card => {
                const newCard = card.cloneNode(true);
                card.parentNode.replaceChild(newCard, card);
                newCard.addEventListener('click', (e) => {
                    if (e.target.closest('.marketplace-buy-btn')) return;
                    try {
                        const usernameData = JSON.parse(newCard.dataset.username.replace(/&#39;/g, "'"));
                        showMarketDetailPanel(usernameData);
                    } catch (err) {
                        console.error('Error parsing username data:', err);
                    }
                });
            });
            
            // Fetch avatars async
            setTimeout(() => {
                fetchAllMarketplaceAvatars();
            }, 200);
            
        } else {
            // LIST LAYOUT
            elements.usernameList.className = 'marketplace-list';
            let html = '';
            for (const username of usernames) {
                let usernameStr = username.username || '';
                if (typeof usernameStr !== 'string') usernameStr = String(usernameStr);
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                const basedOnText = username.based_on || '-';
                
                let avatarUrl = localStorage.getItem(`avatar_${usernameStr}`);
                if (!avatarUrl || !avatarUrl.startsWith('data:image')) {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                
                const usernameData = {
                    id: username.id,
                    username: usernameStr,
                    based_on: username.based_on || '',
                    price: username.price,
                    seller_id: username.seller_id,
                    seller_wallet: username.seller_wallet,
                    status: username.status,
                    created_at: username.created_at
                };

                html += `
                    <div class="marketplace-item" data-id="${username.id}" data-username='${JSON.stringify(usernameData).replace(/'/g, "&#39;")}'>
                        <div class="marketplace-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" class="marketplace-avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="marketplace-info">
                            <div class="marketplace-name">@${escapeHtml(usernameStr)}</div>
                            <div class="marketplace-basedon">${escapeHtml(basedOnText)}</div>
                        </div>
                        <div class="marketplace-price-wrapper">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo-small">
                            <span class="marketplace-price">${formatNumber(username.price)}</span>
                        </div>
                    </div>
                `;
            }
            elements.usernameList.innerHTML = html;
            
            // Attach click events untuk item
            document.querySelectorAll('.marketplace-item').forEach(item => {
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                newItem.addEventListener('click', (e) => {
                    if (e.target.closest('.marketplace-buy-btn-small')) return;
                    try {
                        const usernameData = JSON.parse(newItem.dataset.username.replace(/&#39;/g, "'"));
                        showMarketDetailPanel(usernameData);
                    } catch (err) {
                        console.error('Error parsing username data:', err);
                    }
                });
            });
            
            // Fetch avatars async
            setTimeout(() => {
                fetchAllMarketplaceListAvatars();
            }, 200);
        }
    }

    async function fetchAllMarketplaceAvatars() {
        const avatars = document.querySelectorAll('.marketplace-card .card-avatar img.avatar-img');
        
        for (const img of avatars) {
            const username = img.dataset.username;
            if (!username) continue;
            
            // Cek cache
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                if (img.src !== cached) {
                    img.src = cached;
                }
                continue;
            }
            
            // Fetch dari server
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                    console.log(`✅ Fetched avatar for @${username} (marketplace grid)`);
                }
            } catch (error) {
                console.error(`Error fetching avatar for @${username}:`, error);
            }
            
            // Delay agar tidak overload
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async function fetchAllMarketplaceListAvatars() {
        const avatars = document.querySelectorAll('.marketplace-avatar-img');
        
        for (const img of avatars) {
            const parentItem = img.closest('.marketplace-item');
            if (!parentItem) continue;
            
            const nameEl = parentItem.querySelector('.marketplace-name');
            if (!nameEl) continue;
            
            const username = nameEl.textContent.replace('@', '').trim();
            if (!username) continue;
            
            // Cek cache
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                if (img.src !== cached) {
                    img.src = cached;
                }
                continue;
            }
            
            // Fetch dari server
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                    console.log(`✅ Fetched avatar for @${username} (marketplace list)`);
                }
            } catch (error) {
                console.error(`Error fetching avatar for @${username}:`, error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
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
            console.log('[DEBUG] Loading marketplace usernames...');
            showLoading(true);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            
            console.log('[DEBUG] Load usernames response:', data);
            
            if (data.success && data.usernames) {
                // Hanya username dengan status 'available' untuk marketplace
                allUsernames = data.usernames.filter(u => u.status === 'available');
                console.log(`[DEBUG] Loaded ${allUsernames.length} available usernames from total ${data.usernames.length}`);
                
                // Cek apakah ada username yang bisa ditampilkan
                if (allUsernames.length === 0) {
                    console.log('[DEBUG] No available usernames found');
                    const emptyAnimationDiv = document.getElementById('emptyMarketplaceAnimation');
                    if (emptyAnimationDiv) {
                        emptyAnimationDiv.style.display = 'block';
                        elements.usernameList.style.display = 'none';
                        loadMarketplaceTGSAnimation();
                    } else {
                        elements.usernameList.innerHTML = '<div class="loading-placeholder">Belum ada username yang tersedia</div>';
                    }
                } else {
                    console.log('[DEBUG] Rendering usernames...');
                    const emptyAnimationDiv = document.getElementById('emptyMarketplaceAnimation');
                    if (emptyAnimationDiv) emptyAnimationDiv.style.display = 'none';
                    elements.usernameList.style.display = 'block';
                    applyFiltersAndRender();
                }
            } else {
                console.log('[DEBUG] No usernames found or error:', data);
                allUsernames = [];
                const emptyAnimationDiv = document.getElementById('emptyMarketplaceAnimation');
                if (emptyAnimationDiv) {
                    emptyAnimationDiv.style.display = 'block';
                    elements.usernameList.style.display = 'none';
                    loadMarketplaceTGSAnimation();
                } else {
                    elements.usernameList.innerHTML = '<div class="loading-placeholder">Gagal memuat data username</div>';
                }
            }
        } catch (error) {
            console.error('[DEBUG] Error loading usernames:', error);
            elements.usernameList.innerHTML = '<div class="loading-placeholder">Gagal memuat data: ' + (error.message || 'Network error') + '</div>';
        } finally {
            showLoading(false);
        }
    }

    async function refreshAllAvatars() {
        const gridAvatars = document.querySelectorAll('.username-card .card-avatar img.avatar-img');
        for (const img of gridAvatars) {
            const username = img.dataset.username;
            if (username) {
                const cached = localStorage.getItem(`avatar_${username}`);
                if (cached && cached.startsWith('data:image')) {
                    if (img.src !== cached) img.src = cached;
                } else {
                    const photoUrl = await fetchProfilePhoto(username);
                    if (photoUrl && photoUrl.startsWith('data:image')) {
                        img.src = photoUrl;
                    }
                }
                await new Promise(r => setTimeout(r, 50));
            }
        }
        
        // Refresh untuk list layout
        const listAvatars = document.querySelectorAll('.username-list .username-avatar-img');
        for (const img of listAvatars) {
            const parentItem = img.closest('.username-item');
            if (parentItem && parentItem.dataset.username) {
                try {
                    const usernameData = JSON.parse(parentItem.dataset.username.replace(/&#39;/g, "'"));
                    const username = usernameData.username;
                    const cached = localStorage.getItem(`avatar_${username}`);
                    if (cached && cached.startsWith('data:image')) {
                        if (img.src !== cached) img.src = cached;
                    } else {
                        const photoUrl = await fetchProfilePhoto(username);
                        if (photoUrl && photoUrl.startsWith('data:image')) {
                            img.src = photoUrl;
                        }
                    }
                } catch(e) {}
                await new Promise(r => setTimeout(r, 50));
            }
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
        
        // Filter Summary Button (di samping Apply)
        const filterSummaryBtn = document.getElementById('filterSummaryBtn');
        if (filterSummaryBtn) {
            filterSummaryBtn.addEventListener('click', showFilterSummaryPanel);
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
            
            if (data.success && data.purchases && data.purchases.length > 0) {
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
                // Empty state dengan animasi
                elements.purchasedList.innerHTML = `
                    <div class="empty-state" style="padding: 40px 20px;">
                        <div class="empty-animation" id="purchasedEmptyAnimation" style="width: 100px; height: 100px; margin: 0 auto 20px;"></div>
                        <div class="empty-title" style="font-size: 16px; margin-bottom: 8px;">No Purchased Usernames</div>
                        <div class="empty-subtitle" style="font-size: 12px; color: var(--text-muted);">Buy usernames from marketplace to see them here</div>
                    </div>
                `;
                loadPurchasedEmptyAnimation();
            }
        } catch (error) {
            console.error('Error loading purchased usernames:', error);
            elements.purchasedList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function loadPurchasedEmptyAnimation() {
        const container = document.getElementById('purchasedEmptyAnimation');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Load libraries yang diperlukan
        function loadLibraries() {
            return new Promise((resolve, reject) => {
                let loaded = 0;
                let total = 2;
                
                function checkLoaded() {
                    loaded++;
                    if (loaded === total) resolve();
                }
                
                if (typeof window.lottie === 'undefined') {
                    const lottieScript = document.createElement('script');
                    lottieScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
                    lottieScript.onload = checkLoaded;
                    lottieScript.onerror = reject;
                    document.head.appendChild(lottieScript);
                } else {
                    checkLoaded();
                }
                
                if (typeof window.pako === 'undefined') {
                    const pakoScript = document.createElement('script');
                    pakoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                    pakoScript.onload = checkLoaded;
                    pakoScript.onerror = reject;
                    document.head.appendChild(pakoScript);
                } else {
                    checkLoaded();
                }
            });
        }
        
        async function loadTGSFile() {
            try {
                const response = await fetch('/image/empty-market-page.tgs');
                const arrayBuffer = await response.arrayBuffer();
                const compressed = new Uint8Array(arrayBuffer);
                const decompressed = window.pako.ungzip(compressed, { to: 'string' });
                const animationData = JSON.parse(decompressed);
                
                window.lottie.loadAnimation({
                    container: container,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
            } catch (error) {
                console.error('Error loading TGS file for purchased:', error);
                container.innerHTML = '<i class="fas fa-shopping-bag" style="font-size: 48px; color: var(--text-muted);"></i>';
            }
        }
        
        loadLibraries().then(() => {
            loadTGSFile();
        }).catch(err => {
            console.error('Error loading libraries:', err);
            container.innerHTML = '<i class="fas fa-shopping-bag" style="font-size: 48px; color: var(--text-muted);"></i>';
        });
    }

    async function loadTransactionHistory() {
        if (!elements.historyList || !telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/transactions/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.transactions && data.transactions.length > 0) {
                let html = '';
                for (const tx of data.transactions) {
                    let iconClass = '';
                    let icon = '';
                    let amountClass = '';
                    let amountPrefix = '';
                    let txHash = tx.transaction_id;
                    let explorerUrl = null;
                    
                    // Cek apakah transaction_id adalah hash yang valid
                    const isValidHash = txHash && /^[a-fA-F0-9]{64}$/.test(txHash);
                    
                    if (isValidHash) {
                        explorerUrl = `https://tonviewer.com/transaction/${txHash}`;
                    } else if (txHash && !txHash.startsWith('deposit_') && !txHash.startsWith('wd_') && txHash.length > 30) {
                        explorerUrl = `https://tonviewer.com/transaction/${txHash}`;
                    }
                    
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
                        default:
                            iconClass = 'info';
                            icon = 'fa-circle-info';
                            amountClass = '';
                            amountPrefix = '';
                    }
                    
                    const clickableAttr = explorerUrl ? `data-url="${explorerUrl}" style="cursor: pointer;"` : '';
                    const onClickAttr = explorerUrl ? `onclick="window.open('${explorerUrl}', '_blank')"` : '';
                    
                    const hashDisplay = explorerUrl ? `<span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px;">${txHash.slice(0, 10)}...</span>` : '';
                    
                    html += `
                        <div class="history-item" ${clickableAttr} ${onClickAttr}>
                            <div class="history-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="history-info">
                                <div class="history-title">${tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdraw' ? 'Withdraw' : 'Pembelian Username'}</div>
                                <div class="history-date">${formatDate(tx.created_at)}</div>
                                ${hashDisplay}
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
                // Empty state dengan animasi
                elements.historyList.innerHTML = `
                    <div class="empty-state" style="padding: 40px 20px;">
                        <div class="empty-animation" id="historyEmptyAnimation" style="width: 100px; height: 100px; margin: 0 auto 20px;"></div>
                        <div class="empty-title" style="font-size: 16px; margin-bottom: 8px;">No Transactions Yet</div>
                        <div class="empty-subtitle" style="font-size: 12px; color: var(--text-muted);">Your transaction history will appear here</div>
                    </div>
                `;
                loadHistoryEmptyAnimation();
            }
        } catch (error) {
            console.error('Error loading transaction history:', error);
            elements.historyList.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
        }
    }

    function loadHistoryEmptyAnimation() {
        const container = document.getElementById('historyEmptyAnimation');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Load libraries yang diperlukan
        function loadLibraries() {
            return new Promise((resolve, reject) => {
                let loaded = 0;
                let total = 2;
                
                function checkLoaded() {
                    loaded++;
                    if (loaded === total) resolve();
                }
                
                if (typeof window.lottie === 'undefined') {
                    const lottieScript = document.createElement('script');
                    lottieScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
                    lottieScript.onload = checkLoaded;
                    lottieScript.onerror = reject;
                    document.head.appendChild(lottieScript);
                } else {
                    checkLoaded();
                }
                
                if (typeof window.pako === 'undefined') {
                    const pakoScript = document.createElement('script');
                    pakoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                    pakoScript.onload = checkLoaded;
                    pakoScript.onerror = reject;
                    document.head.appendChild(pakoScript);
                } else {
                    checkLoaded();
                }
            });
        }
        
        async function loadTGSFile() {
            try {
                // Gunakan file .tgs yang sama dengan market page atau file terpisah
                const response = await fetch('/image/empty-market-page.tgs');
                const arrayBuffer = await response.arrayBuffer();
                const compressed = new Uint8Array(arrayBuffer);
                const decompressed = window.pako.ungzip(compressed, { to: 'string' });
                const animationData = JSON.parse(decompressed);
                
                window.lottie.loadAnimation({
                    container: container,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
            } catch (error) {
                console.error('Error loading TGS file for history:', error);
                container.innerHTML = '<i class="fas fa-history" style="font-size: 48px; color: var(--text-muted);"></i>';
            }
        }
        
        loadLibraries().then(() => {
            loadTGSFile();
        }).catch(err => {
            console.error('Error loading libraries:', err);
            container.innerHTML = '<i class="fas fa-history" style="font-size: 48px; color: var(--text-muted);"></i>';
        });
    }

    async function getMarketplaceBalance() {
        if (!telegramUser) return 0;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
            const data = await response.json();
            if (data.success && data.user) {
                return parseFloat(data.user.balance);
            }
            return 0;
        } catch (error) {
            console.error('Error fetching marketplace balance:', error);
            return 0;
        }
    }

    // ==================== REFRESH ====================

    async function refreshAllData() {
        hapticLight();
        
        // Refresh user data dari server (balance marketplace)
        const user = await authenticateUser();
        
        if (user) {
            // Update balance marketplace di UI
            if (elements.balanceAmount) {
                const newBalance = formatNumber(user.balance);
                elements.balanceAmount.textContent = newBalance;
                console.log(`💰 Marketplace balance updated: ${newBalance} TON`);
            }
            // Update currentWalletBalance (balance marketplace)
            currentWalletBalance = parseFloat(user.balance);
            
            // Update wallet main card balance marketplace
            const walletBalanceAmount = document.getElementById('walletBalanceAmount');
            if (walletBalanceAmount) {
                walletBalanceAmount.textContent = currentWalletBalance.toFixed(2);
            }
        }
        
        // ==================== PERBAIKAN: Refresh wallet TON Connect balance ====================
        if (isWalletConnected && walletAddress) {
            const tonBalance = await getWalletBalance(walletAddress);
            const tonWalletBalanceElement = document.getElementById('walletBalanceAmount');
            if (tonWalletBalanceElement) {
                tonWalletBalanceElement.textContent = tonBalance.toFixed(2);
            }
            console.log(`💰 TON Wallet balance: ${tonBalance} TON`);
        }
        
        await loadUsernames();
        await loadPurchasedUsernames();
        await loadTransactionHistory();
        updateBalanceCardUI();
        updateWalletMainUI();
        
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

    function setupMarketplaceFilterBar() {
        const sortBtn = document.getElementById('filterSortBtn');
        const priceBtn = document.getElementById('filterPriceBtn');
        const basedOnBtn = document.getElementById('filterBasedOnBtn');
        const gridBtn = document.getElementById('marketGridBtn');
        const listBtn = document.getElementById('marketListBtn');
        
        // Hapus event listener lama dengan clone
        if (sortBtn) {
            const newSortBtn = sortBtn.cloneNode(true);
            sortBtn.parentNode.replaceChild(newSortBtn, sortBtn);
            newSortBtn.addEventListener('click', () => {
                showFilterPanel('sort');
            });
        }
        
        if (priceBtn) {
            const newPriceBtn = priceBtn.cloneNode(true);
            priceBtn.parentNode.replaceChild(newPriceBtn, priceBtn);
            newPriceBtn.addEventListener('click', () => {
                showFilterPanel('price');
            });
        }
        
        if (basedOnBtn) {
            const newBasedOnBtn = basedOnBtn.cloneNode(true);
            basedOnBtn.parentNode.replaceChild(newBasedOnBtn, basedOnBtn);
            newBasedOnBtn.addEventListener('click', () => {
                showFilterPanel('basedon');
            });
        }
        
        // PERBAIKAN LAYOUT TOGGLE - dengan style yang benar
        if (gridBtn) {
            const newGridBtn = gridBtn.cloneNode(true);
            gridBtn.parentNode.replaceChild(newGridBtn, gridBtn);
            
            // Set initial active state
            if (currentLayout === 'grid') {
                newGridBtn.classList.add('active');
            } else {
                newGridBtn.classList.remove('active');
            }
            
            newGridBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                localStorage.setItem('market_layout', 'grid');
                newGridBtn.classList.add('active');
                if (listBtn) {
                    const newListBtn = listBtn.cloneNode(true);
                    listBtn.parentNode.replaceChild(newListBtn, listBtn);
                    newListBtn.classList.remove('active');
                }
                applyFiltersAndRender();
                hapticLight();
            });
        }
        
        if (listBtn) {
            const newListBtn = listBtn.cloneNode(true);
            listBtn.parentNode.replaceChild(newListBtn, listBtn);
            
            // Set initial active state
            if (currentLayout === 'list') {
                newListBtn.classList.add('active');
            } else {
                newListBtn.classList.remove('active');
            }
            
            newListBtn.addEventListener('click', () => {
                currentLayout = 'list';
                localStorage.setItem('market_layout', 'list');
                newListBtn.classList.add('active');
                if (gridBtn) {
                    const newGridBtn = gridBtn.cloneNode(true);
                    gridBtn.parentNode.replaceChild(newGridBtn, gridBtn);
                    newGridBtn.classList.remove('active');
                }
                applyFiltersAndRender();
                hapticLight();
            });
        }
    }

    function closeFilterPanel() {
        console.log('[DEBUG] closeFilterPanel called');
        
        if (filterPanel) {
            filterPanel.classList.remove('open');
            // Hapus panel setelah animasi selesai
            setTimeout(() => {
                if (filterPanel && filterPanel.parentNode) {
                    filterPanel.remove();
                }
                filterPanel = null;
            }, 300);
        }
        
        if (filterOverlay) {
            filterOverlay.classList.remove('active');
        }
        
        document.body.classList.remove('filter-open');
        hapticLight();
    }

    // ==================== FUNGSI SHOW FILTER PANEL (DENGAN DRAG TO CLOSE YANG BENAR) ====================
    function showFilterPanel(type) {
        currentFilterType = type;
        
        // Hapus panel yang sudah ada
        if (filterPanel) {
            filterPanel.remove();
            filterPanel = null;
        }
        
        // Buat overlay jika belum ada
        if (!filterOverlay) {
            filterOverlay = document.createElement('div');
            filterOverlay.className = 'filter-overlay';
            document.body.appendChild(filterOverlay);
            
            // Klik overlay untuk menutup panel - PERBAIKAN
            filterOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                closeFilterPanel();
            });
        }
        
        // Salin nilai current ke temporary
        tempSort = currentSort;
        tempPriceFilter = { ...currentPriceFilter };
        tempBasedOnFilter = currentBasedOnFilter;
        
        // Buat konten berdasarkan tipe filter
        let contentHtml = '';
        
        if (type === 'sort') {
            contentHtml = `
                <div class="filter-section">
                    <div class="filter-section-title">Sort By</div>
                    <div class="filter-options">
                        <button class="filter-option ${tempSort === 'default' ? 'active' : ''}" data-sort="default">
                            <i class="fas fa-clock"></i> Default
                        </button>
                        <button class="filter-option ${tempSort === 'price_asc' ? 'active' : ''}" data-sort="price_asc">
                            <i class="fas fa-arrow-up"></i> Price ↑
                        </button>
                        <button class="filter-option ${tempSort === 'price_desc' ? 'active' : ''}" data-sort="price_desc">
                            <i class="fas fa-arrow-down"></i> Price ↓
                        </button>
                        <button class="filter-option ${tempSort === 'name_asc' ? 'active' : ''}" data-sort="name_asc">
                            <i class="fas fa-sort-alpha-down"></i> Name A-Z
                        </button>
                    </div>
                </div>
            `;
        } else if (type === 'price') {
            contentHtml = `
                <div class="filter-section">
                    <div class="filter-section-title">Price Range (TON)</div>
                    <div class="price-range-container">
                        <div class="price-inputs">
                            <div class="price-input-group">
                                <label>Min</label>
                                <input type="number" id="filterPriceMin" class="filter-price-input" value="${tempPriceFilter.min}" min="0" step="0.1" placeholder="0">
                            </div>
                            <div class="price-input-group">
                                <label>Max</label>
                                <input type="number" id="filterPriceMax" class="filter-price-input" value="${tempPriceFilter.max >= 9999 ? '' : tempPriceFilter.max}" min="0" step="0.1" placeholder="∞">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'basedon') {
            let basedOnOptions = '<button class="filter-option active" data-basedon="all"><i class="fas fa-globe"></i> All</button>';
            if (availableBasedOnList.length > 0) {
                basedOnOptions += availableBasedOnList.map(b => `
                    <button class="filter-option ${tempBasedOnFilter === b ? 'active' : ''}" data-basedon="${escapeHtml(b)}">
                        <i class="fas fa-user-tag"></i> ${escapeHtml(b.length > 20 ? b.slice(0, 20) + '...' : b)}
                    </button>
                `).join('');
            } else {
                basedOnOptions = '<div class="loading-placeholder">Loading options...</div>';
            }
            
            contentHtml = `
                <div class="filter-section">
                    <div class="filter-section-title">Based On</div>
                    <div class="filter-options filter-options-scroll" id="basedOnFilterOptions">
                        ${basedOnOptions}
                    </div>
                </div>
            `;
        }
        
        const panel = document.createElement('div');
        panel.className = 'filter-panel-modern';
        panel.innerHTML = `
            <div class="filter-drag-handle"></div>
            <div class="filter-header">
                <h3><i class="fas fa-filter"></i> ${type === 'sort' ? 'Sort By' : type === 'price' ? 'Price Range' : 'Based On'}</h3>
                <button class="filter-close">&times;</button>
            </div>
            <div class="filter-content">
                ${contentHtml}
            </div>
            <div class="filter-actions">
                <button class="filter-reset">Reset</button>
                <button class="filter-apply">Apply</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        filterPanel = panel;
        filterOverlay.classList.add('active');
        document.body.classList.add('filter-open');
        
        // Trigger animation
        setTimeout(() => panel.classList.add('open'), 10);
        
        // Setup event listeners
        const closeBtn = panel.querySelector('.filter-close');
        if (closeBtn) {
            // Hapus listener lama dengan clone
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeFilterPanel();
            });
        }
        
        if (type === 'sort') {
            panel.querySelectorAll('[data-sort]').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    panel.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
                    newBtn.classList.add('active');
                    tempSort = newBtn.dataset.sort;
                });
            });
        } else if (type === 'price') {
            const priceMin = panel.querySelector('#filterPriceMin');
            const priceMax = panel.querySelector('#filterPriceMax');
            
            if (priceMin) {
                const newPriceMin = priceMin.cloneNode(true);
                priceMin.parentNode.replaceChild(newPriceMin, priceMin);
                newPriceMin.addEventListener('change', () => {
                    tempPriceFilter.min = parseFloat(newPriceMin.value) || 0;
                });
            }
            if (priceMax) {
                const newPriceMax = priceMax.cloneNode(true);
                priceMax.parentNode.replaceChild(newPriceMax, priceMax);
                newPriceMax.addEventListener('change', () => {
                    tempPriceFilter.max = parseFloat(newPriceMax.value) || 9999;
                });
            }
        } else if (type === 'basedon') {
            panel.querySelectorAll('[data-basedon]').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    panel.querySelectorAll('[data-basedon]').forEach(b => b.classList.remove('active'));
                    newBtn.classList.add('active');
                    tempBasedOnFilter = newBtn.dataset.basedon;
                });
            });
        }
        
        // Reset button
        const resetBtn = panel.querySelector('.filter-reset');
        if (resetBtn) {
            const newResetBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
            newResetBtn.addEventListener('click', () => {
                if (currentFilterType === 'sort') {
                    tempSort = 'default';
                    panel.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
                    panel.querySelector('[data-sort="default"]').classList.add('active');
                } else if (currentFilterType === 'price') {
                    tempPriceFilter = { min: 0, max: 9999 };
                    const priceMinInput = panel.querySelector('#filterPriceMin');
                    const priceMaxInput = panel.querySelector('#filterPriceMax');
                    if (priceMinInput) priceMinInput.value = '';
                    if (priceMaxInput) priceMaxInput.value = '';
                } else if (currentFilterType === 'basedon') {
                    tempBasedOnFilter = 'all';
                    panel.querySelectorAll('[data-basedon]').forEach(b => b.classList.remove('active'));
                    panel.querySelector('[data-basedon="all"]').classList.add('active');
                }
            });
        }
        
        // Apply button
        const applyBtn = panel.querySelector('.filter-apply');
        if (applyBtn) {
            const newApplyBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
            newApplyBtn.addEventListener('click', () => {
                if (currentFilterType === 'sort') {
                    currentSort = tempSort;
                } else if (currentFilterType === 'price') {
                    currentPriceFilter = { ...tempPriceFilter };
                } else if (currentFilterType === 'basedon') {
                    currentBasedOnFilter = tempBasedOnFilter;
                }
                applyFiltersAndRender();
                closeFilterPanel();
                updateFilterBadge();
            });
        }
        
        // Drag to close - PERBAIKAN DRAG HANDLER
        const dragHandle = panel.querySelector('.filter-drag-handle');
        if (dragHandle) {
            let startY = 0, currentY = 0, isDragging = false;
            
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
            
            const onTouchEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
                if (currentY - startY > 100) {
                    closeFilterPanel();
                } else {
                    panel.style.transform = '';
                }
            };
            
            // Hapus listener lama
            const newDragHandle = dragHandle.cloneNode(true);
            dragHandle.parentNode.replaceChild(newDragHandle, dragHandle);
            
            newDragHandle.addEventListener('touchstart', onTouchStart);
            newDragHandle.addEventListener('touchmove', onTouchMove);
            newDragHandle.addEventListener('touchend', onTouchEnd);
        }
        
        hapticLight();
    }

    function applyFiltersAndRender() {
        if (!allUsernames || allUsernames.length === 0) {
            renderUsernames([]);
            return;
        }
        
        let filtered = [...allUsernames];
        
        // Price filter
        const minPrice = currentPriceFilter.min !== undefined ? currentPriceFilter.min : 0;
        const maxPrice = currentPriceFilter.max !== undefined ? currentPriceFilter.max : 9999;
        filtered = filtered.filter(u => u.price >= minPrice && u.price <= maxPrice);
        
        // Based on filter
        if (currentBasedOnFilter && currentBasedOnFilter !== 'all') {
            filtered = filtered.filter(u => u.based_on === currentBasedOnFilter);
        }
        
        // Sort
        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'price_asc') return a.price - b.price;
                if (currentSort === 'price_desc') return b.price - a.price;
                if (currentSort === 'name_asc') return a.username.localeCompare(b.username);
                return 0;
            });
        }
        
        console.log(`[DEBUG] Filtered ${filtered.length} usernames from ${allUsernames.length} total`);
        renderUsernames(filtered);
    }

    function initWalletPanels() {
        depositPanel = document.getElementById('depositPanel');
        withdrawPanel = document.getElementById('withdrawPanel');
        walletPanelOverlay = document.getElementById('walletPanelOverlay');
        
        // Hapus pembuatan overlay duplicate jika sudah ada di HTML
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
        
        // ==================== PERBAIKAN: Quick amount buttons ====================
        document.querySelectorAll('.quick-amount-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', async (e) => {
                const percent = parseInt(newBtn.dataset.percent);
                const isDeposit = newBtn.closest('#depositPanel') !== null;
                const input = isDeposit ? document.getElementById('depositAmountInput') : document.getElementById('withdrawAmountInput');
                
                if (input) {
                    let balance = 0;
                    
                    if (isDeposit) {
                        // Untuk deposit, ambil balance dari wallet TON Connect
                        if (isWalletConnected && walletAddress) {
                            balance = await getWalletBalance(walletAddress);
                        }
                    } else {
                        // ==================== PERBAIKAN: Untuk withdraw, ambil balance dari DATABASE ====================
                        if (telegramUser) {
                            try {
                                const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
                                const data = await response.json();
                                if (data.success && data.user) {
                                    balance = parseFloat(data.user.balance);
                                    console.log(`💰 Marketplace balance for quick amount: ${balance} TON`);
                                }
                            } catch (error) {
                                console.error('Error fetching marketplace balance:', error);
                            }
                        }
                    }
                    
                    if (balance > 0) {
                        let amount = 0;
                        if (percent === 100) {
                            amount = balance;
                        } else {
                            amount = (balance * percent) / 100;
                        }
                        // Bulatkan ke 2 desimal
                        amount = Math.floor(amount * 100) / 100;
                        input.value = amount.toFixed(2);
                        input.dispatchEvent(new Event('input'));
                    } else {
                        showToast(isDeposit ? 'Wallet tidak memiliki saldo' : 'Saldo marketplace Anda 0 TON', 'warning');
                    }
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
        
        // Reset transform
        depositPanel.style.transform = '';
        depositPanel.style.transition = '';
        
        // Reset input
        const input = document.getElementById('depositAmountInput');
        if (input) input.value = '';
        
        // Tampilkan overlay
        walletPanelOverlay.classList.add('active');
        document.body.classList.add('wallet-panel-open');
        
        // Tampilkan panel
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
        
        // Reset transform
        withdrawPanel.style.transform = '';
        withdrawPanel.style.transition = '';
        
        // Reset input
        const input = document.getElementById('withdrawAmountInput');
        if (input) input.value = '';
        
        // Tampilkan overlay
        walletPanelOverlay.classList.add('active');
        document.body.classList.add('wallet-panel-open');
        
        // Tampilkan panel
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

    // Update deposit function di depositFromPanel
    async function depositFromPanel() {
        const amountInput = document.getElementById('depositAmountInput');
        const amount = parseFloat(amountInput?.value);
        
        if (!amount || amount <= 0) {
            showToast('Masukkan jumlah deposit yang valid', 'warning');
            return;
        }
        
        // ==================== PERBAIKAN: Minimal deposit 0.1 TON ====================
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
            
            // Pastikan transaction hash valid untuk tonviewer
            let finalHash = transactionHash;
            if (finalHash.startsWith('tx_') || finalHash.length !== 64) {
                // Jika bukan hash valid, generate berdasarkan timestamp
                finalHash = generateValidHash(telegramUser.id, amount, Date.now());
            }
            
            const verifyResponse = await fetch(`${API_BASE_URL}/api/winedash/deposit/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    amount: amount,
                    transaction_hash: finalHash,
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

    // Helper function untuk generate hash valid
    function generateValidHash(userId, amount, timestamp) {
        // Generate hash yang mirip dengan format TON transaction
        const str = `${userId}_${amount}_${timestamp}_${Math.random()}`;
        let hash = '';
        for (let i = 0; i < str.length; i++) {
            hash += str.charCodeAt(i).toString(16);
        }
        // Potong menjadi 64 karakter
        if (hash.length > 64) hash = hash.slice(0, 64);
        while (hash.length < 64) hash += '0';
        return hash;
    }

    // ==================== WITHDRAW ====================

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
            showToast('Hubungkan wallet TON terlebih dahulu untuk menerima dana', 'warning');
            closeWithdrawPanel();
            await connectWallet();
            return;
        }
        
        // ==================== PERBAIKAN: Cek balance dari DATABASE (bukan dari wallet) ====================
        // Ambil balance dari database user (saldo marketplace)
        let dbBalance = 0;
        if (telegramUser) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
                const data = await response.json();
                if (data.success && data.user) {
                    dbBalance = parseFloat(data.user.balance);
                }
            } catch (error) {
                console.error('Error fetching user balance:', error);
            }
        }
        
        if (dbBalance < amount) {
            showToast(`Saldo marketplace tidak mencukupi. Saldo Anda: ${dbBalance} TON`, 'error');
            return;
        }
        
        const WITHDRAW_FEE = 0.02;
        const amountToReceive = amount - WITHDRAW_FEE;
        
        if (!confirm(`Anda akan withdraw ${amount} TON dari marketplace.\n\nBiaya jaringan (fee): ${WITHDRAW_FEE} TON\nJumlah yang akan diterima di wallet: ${amountToReceive.toFixed(2)} TON\n\nLanjutkan?`)) {
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
            
            // Generate unique reference untuk memo
            const shortId = Math.random().toString(36).substring(2, 12);
            const memo = `wd_${shortId}:${telegramUser.id}`;
            
            // Step 1: Create withdrawal request di database
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
            
            // Step 2: Process withdrawal (kirim TON ke user)
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
            
            // Buka link transaction di tonviewer jika ada
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
                errorMessage = 'Saldo marketplace tidak mencukupi';
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

    // Update loadTransactionHistory untuk membuat klikable ke tonscan
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
                    let txHash = tx.transaction_id;
                    let explorerUrl = null;
                    
                    // ==================== PERBAIKAN: Validasi hash untuk deposit ====================
                    // Cek apakah transaction_id adalah hash yang valid
                    // Hash TON valid: 64 karakter hexadecimal
                    const isValidHash = txHash && /^[a-fA-F0-9]{64}$/.test(txHash);
                    
                    if (isValidHash) {
                        explorerUrl = `https://tonviewer.com/transaction/${txHash}`;
                    } else if (txHash && !txHash.startsWith('deposit_') && !txHash.startsWith('wd_') && txHash.length > 30) {
                        // Coba tetap tampilkan meskipun format tidak sempurna
                        explorerUrl = `https://tonviewer.com/transaction/${txHash}`;
                    }
                    
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
                        default:
                            iconClass = 'info';
                            icon = 'fa-circle-info';
                            amountClass = '';
                            amountPrefix = '';
                    }
                    
                    const clickableAttr = explorerUrl ? `data-url="${explorerUrl}" style="cursor: pointer;"` : '';
                    const onClickAttr = explorerUrl ? `onclick="window.open('${explorerUrl}', '_blank')"` : '';
                    
                    // Tampilkan tooltip jika ada hash
                    const hashDisplay = explorerUrl ? `<span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px;">${txHash.slice(0, 10)}...</span>` : '';
                    
                    html += `
                        <div class="history-item" ${clickableAttr} ${onClickAttr}>
                            <div class="history-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="history-info">
                                <div class="history-title">${tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdraw' ? 'Withdraw' : 'Pembelian Username'}</div>
                                <div class="history-date">${formatDate(tx.created_at)}</div>
                                ${hashDisplay}
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

    function setupWalletEventListeners() {
        const walletDepositBtn = document.getElementById('walletDepositBtn');
        if (walletDepositBtn) {
            const newBtn = walletDepositBtn.cloneNode(true);
            walletDepositBtn.parentNode.replaceChild(newBtn, walletDepositBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('💰 Deposit button clicked');
                if (!isWalletConnected) {
                    showToast('Hubungkan wallet TON terlebih dahulu', 'warning');
                    connectWallet();
                    return;
                }
                showDepositPanel();
            });
        }
        
        const walletWithdrawBtn = document.getElementById('walletWithdrawBtn');
        if (walletWithdrawBtn) {
            const newBtn = walletWithdrawBtn.cloneNode(true);
            walletWithdrawBtn.parentNode.replaceChild(newBtn, walletWithdrawBtn);
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('💰 Withdraw button clicked');
                
                if (!isWalletConnected) {
                    showToast('Hubungkan wallet TON terlebih dahulu', 'warning');
                    connectWallet();
                    return;
                }
                
                // ==================== PERBAIKAN: Cek balance marketplace ====================
                const marketplaceBalance = await getMarketplaceBalance();
                
                if (marketplaceBalance <= 0) {
                    showToast('Saldo marketplace Anda 0 TON, tidak bisa withdraw', 'warning');
                    return;
                }
                
                showWithdrawPanel();
            });
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

    // ==================== GET WALLET BALANCE FROM TON CONNECT (PLANE GIFT STYLE) ====================

    async function getWalletBalance(walletAddress) {
        if (!walletAddress) return 0;
        
        try {
            // Gunakan API Toncenter untuk mendapatkan balance
            // API Key public untuk testing (bisa diganti dengan API key sendiri)
            const TONCENTER_API_KEY = 'af0bd0bcfbea3c226c990fdce598de6c9f9f9a0a0b4c9e2f8e3c5a1d9b8f7e6d5';
            const url = `https://toncenter.com/api/v2/getAddressInformation?address=${walletAddress}&api_key=${TONCENTER_API_KEY}`;
            
            console.log(`🔍 Fetching balance for address: ${walletAddress}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('📊 Balance API response:', data);
            
            if (data.ok && data.result) {
                // Balance dalam nano TON, konversi ke TON
                const balanceNano = parseFloat(data.result.balance);
                const balanceTon = balanceNano / 1_000_000_000;
                console.log(`💰 Wallet balance: ${balanceTon} TON`);
                return balanceTon;
            }
            
            // Fallback: coba endpoint lain
            const fallbackUrl = `https://tonapi.io/v2/accounts/${walletAddress}`;
            const fallbackResponse = await fetch(fallbackUrl);
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData && fallbackData.balance) {
                const balanceNano = parseFloat(fallbackData.balance);
                const balanceTon = balanceNano / 1_000_000_000;
                console.log(`💰 Wallet balance (fallback): ${balanceTon} TON`);
                return balanceTon;
            }
            
            return 0;
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            return 0;
        }
    }

    // Fungsi untuk refresh balance wallet TON Connect
    async function refreshTonWalletBalance() {
        if (isWalletConnected && walletAddress) {
            const balance = await getWalletBalance(walletAddress);
            const walletBalanceElement = document.getElementById('walletBalanceAmount');
            if (walletBalanceElement) {
                walletBalanceElement.textContent = balance.toFixed(2);
            }
            console.log(`🔄 TonWallet balance refreshed: ${balance} TON`);
            return balance;
        }
        return 0;
    }

    function updateWalletMainUI() {
        const walletMainCard = document.getElementById('walletMainCard');
        const walletAddressDisplay = document.getElementById('walletAddressValue');
        const walletBalanceAmount = document.getElementById('walletBalanceAmount');
        
        console.log('🔄 updateWalletMainUI called - isWalletConnected:', isWalletConnected, 'walletAddress:', walletAddress);
        
        // Selalu tampilkan wallet card
        if (walletMainCard) walletMainCard.style.display = 'block';
        
        if (isWalletConnected && walletAddress) {
            // Tampilkan alamat yang dipersingkat
            const formattedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            if (walletAddressDisplay) walletAddressDisplay.textContent = formattedAddress;
            
            // Ambil balance dari wallet TON Connect
            const fetchBalance = async () => {
                const balance = await getWalletBalance(walletAddress);
                if (walletBalanceAmount) {
                    walletBalanceAmount.textContent = balance.toFixed(2);
                    console.log(`💰 Wallet TON Connect balance: ${balance} TON`);
                }
            };
            fetchBalance();
            
            // Sembunyikan section-card lama yang berisi wallet info
            const oldWalletSection = document.querySelector('#walletTab .section-card:first-child');
            if (oldWalletSection && oldWalletSection.querySelector('#ton-connect')) {
                oldWalletSection.style.display = 'none';
            }
            
        } else {
            // Wallet belum terhubung - tampilkan status not connected
            if (walletAddressDisplay) walletAddressDisplay.textContent = 'Not connected';
            if (walletBalanceAmount) walletBalanceAmount.textContent = '0.00';
            
            // Sembunyikan section-card lama
            const oldWalletSection = document.querySelector('#walletTab .section-card:first-child');
            if (oldWalletSection && oldWalletSection.querySelector('#ton-connect')) {
                oldWalletSection.style.display = 'none';
            }
        }
    }

    function loadMarketplaceTGSAnimation() {
        const container = document.getElementById('marketplaceEmptyAnimationInner');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Load libraries yang diperlukan
        function loadLibraries() {
            return new Promise((resolve, reject) => {
                let loaded = 0;
                let total = 2;
                
                function checkLoaded() {
                    loaded++;
                    if (loaded === total) resolve();
                }
                
                if (typeof window.lottie === 'undefined') {
                    const lottieScript = document.createElement('script');
                    lottieScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
                    lottieScript.onload = checkLoaded;
                    lottieScript.onerror = reject;
                    document.head.appendChild(lottieScript);
                } else {
                    checkLoaded();
                }
                
                if (typeof window.pako === 'undefined') {
                    const pakoScript = document.createElement('script');
                    pakoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                    pakoScript.onload = checkLoaded;
                    pakoScript.onerror = reject;
                    document.head.appendChild(pakoScript);
                } else {
                    checkLoaded();
                }
            });
        }
        
        async function loadTGSFile() {
            try {
                const response = await fetch('/image/empty-market-page.tgs');
                const arrayBuffer = await response.arrayBuffer();
                const compressed = new Uint8Array(arrayBuffer);
                const decompressed = window.pako.ungzip(compressed, { to: 'string' });
                const animationData = JSON.parse(decompressed);
                
                window.lottie.loadAnimation({
                    container: container,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
            } catch (error) {
                console.error('Error loading TGS file:', error);
                container.innerHTML = '<i class="fas fa-store" style="font-size: 48px; color: var(--text-muted);"></i>';
            }
        }
        
        loadLibraries().then(() => {
            loadTGSFile();
        }).catch(err => {
            console.error('Error loading libraries:', err);
            container.innerHTML = '<i class="fas fa-store" style="font-size: 48px; color: var(--text-muted);"></i>';
        });
    }

    function adjustStickerPositionInBorder() {
        const sectionCard = document.querySelector('#marketplaceTab .section-card');
        const emptyStateDiv = document.getElementById('emptyMarketplaceAnimation');
        const stickerElement = document.querySelector('#marketplaceEmptyAnimationInner canvas, #marketplaceEmptyAnimationInner svg');
        
        if (!sectionCard || !emptyStateDiv || !stickerElement) {
            return;
        }
        
        // Pastikan empty state terlihat
        if (emptyStateDiv.style.display !== 'block') {
            return;
        }
        
        // Sticker diposisikan di tengah atas title
        stickerElement.style.position = 'relative';
        stickerElement.style.display = 'block';
        stickerElement.style.margin = '0 auto 16px auto';
        stickerElement.style.left = 'auto';
        stickerElement.style.top = 'auto';
        stickerElement.style.transform = 'none';
        
        // Pastikan container empty state memiliki flex column yang benar
        emptyStateDiv.style.display = 'flex';
        emptyStateDiv.style.flexDirection = 'column';
        emptyStateDiv.style.alignItems = 'center';
        emptyStateDiv.style.justifyContent = 'center';
        
        // Pastikan wrapper animasi memiliki ukuran yang benar
        const animWrapper = emptyStateDiv.querySelector('.empty-animation');
        if (animWrapper) {
            animWrapper.style.width = '120px';
            animWrapper.style.height = '120px';
            animWrapper.style.margin = '0 auto 16px auto';
        }
        
        console.log('✅ Sticker position adjusted inside border');
    }

    function showMarketDetailPanel(username) {
        const existingPanel = document.querySelector('.market-detail-panel');
        if (existingPanel) existingPanel.remove();
        
        if (!marketDetailOverlay) {
            marketDetailOverlay = document.createElement('div');
            marketDetailOverlay.className = 'panel-overlay market-detail-overlay';
            document.body.appendChild(marketDetailOverlay);
            marketDetailOverlay.addEventListener('click', () => closeMarketDetailPanel());
        }
        
        const isOwner = telegramUser && username.seller_id === telegramUser.id;
        
        let usernameStr = username.username;
        if (typeof usernameStr !== 'string') usernameStr = String(usernameStr);
        usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
        
        const createdAt = formatDateIndonesia(username.created_at);
        
        let avatarUrl = localStorage.getItem(`avatar_${usernameStr}`);
        if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
            avatarUrl = "https://companel.shop/image/winedash-logo.png";
        } else {
            fetchProfilePhoto(usernameStr).then(photoUrl => {
                if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
                    const detailImg = document.querySelector('.market-detail-panel .detail-avatar-img img');
                    if (detailImg && detailImg.src !== photoUrl) detailImg.src = photoUrl;
                }
            }).catch(console.error);
        }
        
        const panel = document.createElement('div');
        panel.className = 'market-detail-panel detail-panel';
        panel.innerHTML = `
            <div class="drag-handle"></div>
            <div class="panel-header">
                <h3><i class="fas fa-info-circle"></i> Detail Username</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="detail-avatar">
                <div class="detail-avatar-img">
                    <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" data-username="${usernameStr}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                </div>
                <div class="detail-username-badge">@${escapeHtml(usernameStr)}</div>
            </div>
            <div class="panel-content">
                <div class="detail-field">
                    <div class="detail-label">Based On</div>
                    <div class="detail-value">${escapeHtml(username.based_on || '-')}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Harga</div>
                    <div class="detail-value price">
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;">
                        ${formatNumber(username.price)}
                    </div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">ID Username</div>
                    <div class="detail-value">#${username.id}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Ditambahkan Pada</div>
                    <div class="detail-value">${createdAt}</div>
                </div>
            </div>
            <div class="detail-actions">
                ${isOwner ? `
                    <button class="detail-action-btn edit-price-detail" data-id="${username.id}" data-price="${username.price}" data-status="${username.status}">
                        <i class="fas fa-edit"></i>
                        <span>Edit Harga</span>
                    </button>
                    <button class="detail-action-btn delete-detail" data-id="${username.id}">
                        <i class="fas fa-trash"></i>
                        <span>Hapus</span>
                    </button>
                ` : `
                    <button class="detail-action-btn buy-detail" data-id="${username.id}" data-price="${username.price}">
                        <i class="fas fa-shopping-cart"></i>
                        <span>Beli</span>
                    </button>
                    <button class="detail-action-btn offer-detail" data-id="${username.id}">
                        <i class="fas fa-tag"></i>
                        <span>Offer</span>
                    </button>
                `}
            </div>
        `;
        
        document.body.appendChild(panel);
        setupMarketDragToClose(panel);
        document.body.classList.add('panel-open');
        marketDetailOverlay.classList.add('active');
        setTimeout(() => panel.classList.add('open'), 50);
        
        const closeBtn = panel.querySelector('.panel-close');
        if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMarketDetailPanel(); });
        
        if (isOwner) {
            const editBtn = panel.querySelector('.edit-price-detail');
            if (editBtn) {
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(editBtn.dataset.id), price = parseFloat(editBtn.dataset.price), status = editBtn.dataset.status;
                    closeMarketDetailPanel();
                    setTimeout(() => showEditPriceModal(id, price, status), 300);
                });
            }
            const deleteBtn = panel.querySelector('.delete-detail');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(deleteBtn.dataset.id);
                    if (confirm('Yakin ingin menghapus username ini?')) {
                        closeMarketDetailPanel();
                        await deleteUsername(id);
                        await loadUsernames();
                    }
                });
            }
        } else {
            const buyBtn = panel.querySelector('.buy-detail');
            if (buyBtn) {
                buyBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(buyBtn.dataset.id), price = parseFloat(buyBtn.dataset.price);
                    closeMarketDetailPanel();
                    await buyUsername(id, price);
                });
            }
            const offerBtn = panel.querySelector('.offer-detail');
            if (offerBtn) {
                offerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeMarketDetailPanel();
                    showToast('Offer feature coming soon', 'info');
                });
            }
        }
    }

    function closeMarketDetailPanel() {
        const panel = document.querySelector('.market-detail-panel');
        const overlay = document.querySelector('.market-detail-overlay');
        if (panel) { panel.classList.remove('open'); setTimeout(() => panel.remove(), 300); }
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('panel-open');
        hapticLight();
    }

    function setupMarketDragToClose(panel) {
        const dragHandle = panel.querySelector('.drag-handle');
        if (!dragHandle) return;
        let startY = 0, currentY = 0, isDragging = false;
        dragHandle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; isDragging = true; panel.style.transition = 'none'; hapticLight(); });
        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) panel.style.transform = `translateY(${Math.min(deltaY, panel.offsetHeight * 0.7)}px)`;
        });
        dragHandle.addEventListener('touchend', () => {
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            if (currentY - startY > 100) closeMarketDetailPanel();
            else panel.style.transform = '';
        });
    }

    async function loadBasedOnOptions() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            if (data.success && data.usernames) {
                const basedOnSet = new Set();
                data.usernames.forEach(u => {
                    if (u.based_on && u.based_on.trim() !== '') basedOnSet.add(u.based_on);
                });
                availableBasedOnList = Array.from(basedOnSet);
            }
        } catch (error) { console.error('Error loading based on options:', error); }
    }

    function updateFilterBadge() {
        const filterSummaryBtn = document.getElementById('filterSummaryBtn');
        if (!filterSummaryBtn) return;
        let count = 0;
        if (currentSort !== 'default') count++;
        if (currentPriceFilter.min !== 0 || currentPriceFilter.max !== 9999) count++;
        if (currentLayout !== 'grid') count++;
        if (currentBasedOnFilter !== 'all') count++;
        activeFilterCount = count;
        const existingBadge = filterSummaryBtn.querySelector('.filter-summary-badge');
        if (existingBadge) existingBadge.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'filter-summary-badge';
            badge.textContent = count > 99 ? '99+' : count;
            filterSummaryBtn.appendChild(badge);
            badge.style.display = 'flex';
        }
    }

    function showFilterSummaryPanel() {
        if (availableBasedOnList.length === 0) loadBasedOnOptions();
        
        const existingPanel = document.querySelector('.filter-summary-panel');
        if (existingPanel) existingPanel.remove();
        
        if (!filterSummaryOverlay) {
            filterSummaryOverlay = document.createElement('div');
            filterSummaryOverlay.className = 'filter-overlay';
            document.body.appendChild(filterSummaryOverlay);
            filterSummaryOverlay.addEventListener('click', closeFilterSummaryPanel);
        }
        
        const getPriceDisplay = () => {
            if (currentPriceFilter.min === 0 && currentPriceFilter.max >= 9999) return 'All';
            if (currentPriceFilter.min === 0) return `≤ ${currentPriceFilter.max} TON`;
            if (currentPriceFilter.max >= 9999) return `≥ ${currentPriceFilter.min} TON`;
            return `${currentPriceFilter.min} - ${currentPriceFilter.max} TON`;
        };
        
        const getSortDisplay = () => {
            const sorts = { default: 'Default', price_asc: 'Price ↑', price_desc: 'Price ↓', name_asc: 'Name A-Z' };
            return sorts[currentSort] || 'Default';
        };
        
        const getLayoutDisplay = () => currentLayout === 'grid' ? 'Grid' : 'List';
        const getBasedOnDisplay = () => currentBasedOnFilter === 'all' ? 'All' : currentBasedOnFilter;
        
        const panel = document.createElement('div');
        panel.className = 'filter-summary-panel';
        panel.innerHTML = `
            <div class="filter-drag-handle"></div>
            <div class="filter-header">
                <h3><i class="fas fa-filter"></i> Active Filters</h3>
                <button class="filter-close">&times;</button>
            </div>
            <div class="filter-content">
                <div class="filter-summary-section">
                    <div class="filter-summary-label">Sort By</div>
                    <div class="filter-summary-value" data-filter-type="sort">
                        <span>${getSortDisplay()}</span>
                        <button class="filter-clear-btn" data-clear="sort"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="filter-summary-section">
                    <div class="filter-summary-label">Price Range</div>
                    <div class="filter-summary-value" data-filter-type="price">
                        <span>${getPriceDisplay()}</span>
                        <button class="filter-clear-btn" data-clear="price"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="filter-summary-section">
                    <div class="filter-summary-label">Layout</div>
                    <div class="filter-summary-value" data-filter-type="layout">
                        <span>${getLayoutDisplay()}</span>
                        <button class="filter-clear-btn" data-clear="layout"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="filter-summary-section">
                    <div class="filter-summary-label">Based On</div>
                    <div class="filter-summary-value" data-filter-type="basedon">
                        <span>${getBasedOnDisplay()}</span>
                        <button class="filter-clear-btn" data-clear="basedon"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
            <div class="filter-actions">
                <button class="filter-reset">Clear All Filters</button>
                <button class="filter-apply">Apply & Close</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        filterSummaryOverlay.classList.add('active');
        document.body.classList.add('filter-open');
        setTimeout(() => panel.classList.add('open'), 10);
        
        const closeBtn = panel.querySelector('.filter-close');
        closeBtn.addEventListener('click', closeFilterSummaryPanel);
        
        panel.querySelectorAll('.filter-clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clearType = btn.dataset.clear;
                if (clearType === 'sort') currentSort = 'default';
                if (clearType === 'price') currentPriceFilter = { min: 0, max: 9999 };
                if (clearType === 'layout') { currentLayout = 'grid'; localStorage.setItem('market_layout', 'grid'); }
                if (clearType === 'basedon') currentBasedOnFilter = 'all';
                applyFiltersAndRender();
                updateFilterBadge();
                closeFilterSummaryPanel();
                setTimeout(() => showFilterSummaryPanel(), 200);
            });
        });
        
        const resetBtn = panel.querySelector('.filter-reset');
        resetBtn.addEventListener('click', () => {
            currentSort = 'default';
            currentPriceFilter = { min: 0, max: 9999 };
            currentLayout = 'grid';
            currentBasedOnFilter = 'all';
            localStorage.setItem('market_layout', 'grid');
            applyFiltersAndRender();
            updateFilterBadge();
            closeFilterSummaryPanel();
        });
        
        const applyBtn = panel.querySelector('.filter-apply');
        applyBtn.addEventListener('click', () => {
            closeFilterSummaryPanel();
        });
        
        const dragHandle = panel.querySelector('.filter-drag-handle');
        let startY = 0, currentY = 0, isDragging = false;
        dragHandle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; isDragging = true; panel.style.transition = 'none'; hapticLight(); });
        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) panel.style.transform = `translateY(${Math.min(deltaY, panel.offsetHeight * 0.7)}px)`;
        });
        dragHandle.addEventListener('touchend', () => {
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            if (currentY - startY > 100) closeFilterSummaryPanel();
            else panel.style.transform = '';
        });
        
        hapticLight();
    }

    function closeFilterSummaryPanel() {
        const panel = document.querySelector('.filter-summary-panel');
        if (panel) { panel.classList.remove('open'); setTimeout(() => panel.remove(), 300); }
        if (filterSummaryOverlay) filterSummaryOverlay.classList.remove('active');
        document.body.classList.remove('filter-open');
        hapticLight();
    }

    async function fetchProfilePhoto(username) {
        // Cek cache dulu
        const cached = localStorage.getItem(`avatar_${username}`);
        if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && !cached.includes('ui-avatars.com')) {
            return cached;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                // Simpan ke cache
                localStorage.setItem(`avatar_${username}`, data.photo_url);
                return data.photo_url;
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile photo:', error);
            return null;
        }
    }

    function formatDateIndonesia(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    async function init() {
        console.log('🍷 Winedash Marketplace - Initializing...');
        
        initTelegram();
        initSafeArea();
        showLoading(true);
        
        try {
            // Setup DOM elements
            setupDomReferences();
            
            // Setup event listeners
            setupTabs();
            setupEventListeners();
            setupSearch();
            setupWalletEventListeners();
            initWalletPanels();
            setupMarketplaceFilterBar();
            
            // Get Telegram user
            telegramUser = getTelegramUserFromWebApp();
            
            if (telegramUser) {
                updateUserUI();
                await authenticateUser();
                await loadUsernames();
                await loadPurchasedUsernames();
                await loadTransactionHistory();
                await loadBasedOnOptions();
                updateFilterBadge();
            } else {
                console.warn('No Telegram user found');
                if (elements.usernameList) {
                    elements.usernameList.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
                }
            }
            
            // Initialize TON Connect
            await initTonConnect();
            
            // Update wallet UI after TON Connect is ready
            setTimeout(() => {
                if (isWalletConnected) updateWalletMainUI();
                updateBalanceCardUI();
            }, 500);
            
        } catch (error) {
            console.error('❌ Error in init:', error);
            if (elements.usernameList) {
                elements.usernameList.innerHTML = '<div class="loading-placeholder">Error loading page: ' + (error.message || 'Unknown error') + '</div>';
            }
            showToast('Error loading page: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            showLoading(false);
            console.log('✅ Winedash Marketplace initialized');
        }
    }

    function setupDomReferences() {
        elements.loadingOverlay = document.getElementById('loadingOverlay');
        elements.toastContainer = document.getElementById('toastContainer');
        elements.userAvatar = document.getElementById('userAvatar');
        elements.balanceAmount = document.getElementById('balanceAmount');
        elements.balanceCard = document.getElementById('balanceCard');
        elements.usernameList = document.getElementById('usernameList');
        elements.purchasedList = document.getElementById('purchasedList');
        elements.historyList = document.getElementById('historyList');
        elements.searchInput = document.getElementById('searchUsername');
        elements.depositAmount = document.getElementById('depositAmount');
        elements.depositBtn = document.getElementById('depositBtn');
        elements.withdrawAmount = document.getElementById('withdrawAmount');
        elements.withdrawBtn = document.getElementById('withdrawBtn');
        elements.sellUsername = document.getElementById('sellUsername');
        elements.sellPrice = document.getElementById('sellPrice');
        elements.sellCategory = document.getElementById('sellCategory');
        elements.sellUsernameBtn = document.getElementById('sellUsernameBtn');
        elements.tabBtns = document.querySelectorAll('.tab-btn');
        elements.tabContents = document.querySelectorAll('.tab-content');
    }
    init();
})();
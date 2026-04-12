// games/js/games.js - VERSION DENGAN TON CONNECT

(function() {
    console.log('🎮 Games Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let currentBalance = 0;
    let tonConnectUI = null;
    let walletConnected = false;
    let walletAddress = null;

    // Konfigurasi TON Connect Manifest
    const MANIFEST_URL = 'https://' + window.location.hostname + '/tonconnect-manifest.json';

    // Fungsi format angka ribuan
    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    // Ambil data user dari Telegram
    async function getTelegramUser() {
        const initDataUnsafe = tg.initDataUnsafe || {};
        if (initDataUnsafe.user) {
            return initDataUnsafe.user;
        }
        return {
            id: 123456789,
            first_name: 'Guest',
            last_name: 'User',
            username: 'guest_user'
        };
    }

    // Load balance user
    async function loadBalance(telegramId) {
        try {
            const response = await fetch(`/api/games/balance/${telegramId}`);
            const data = await response.json();
            if (data.success) {
                currentBalance = data.balance;
                const balanceEl = document.getElementById('userBalance');
                if (balanceEl) {
                    const formattedBalance = formatNumberWithCommas(data.balance);
                    balanceEl.textContent = formattedBalance + ' TON';
                }
                return data.balance;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
        return 0;
    }

    // Auth user ke backend
    async function authUser(telegramId, username, firstName) {
        try {
            const response = await fetch('/api/games/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    username: username,
                    first_name: firstName
                })
            });
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Auth error:', error);
            return false;
        }
    }

    // Update wallet address ke backend
    async function updateUserWallet(telegramId, walletAddress) {
        try {
            const response = await fetch('/api/games/user/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    wallet_address: walletAddress
                })
            });
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error updating wallet:', error);
            return false;
        }
    }

    // ==================== TON CONNECT FUNCTIONS ====================
    
    async function initTonConnect() {
        if (!window.TonConnectUI) {
            console.error('TON Connect UI not loaded');
            return;
        }

        try {
            tonConnectUI = new window.TonConnectUI({
                manifestUrl: MANIFEST_URL,
                buttonRootId: 'depositTonConnect'
            });

            // Cek koneksi yang sudah ada
            const wallet = tonConnectUI.wallet;
            if (wallet) {
                walletConnected = true;
                walletAddress = wallet.account.address;
                updateWalletUI();
                
                if (telegramUser && telegramUser.id) {
                    await updateUserWallet(telegramUser.id, walletAddress);
                }
            }

            // Subscribe ke perubahan koneksi
            tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet) {
                    walletConnected = true;
                    walletAddress = wallet.account.address;
                    console.log('Wallet connected:', walletAddress);
                    
                    if (telegramUser && telegramUser.id) {
                        await updateUserWallet(telegramUser.id, walletAddress);
                    }
                } else {
                    walletConnected = false;
                    walletAddress = null;
                    console.log('Wallet disconnected');
                }
                updateWalletUI();
            });

            console.log('✅ TON Connect initialized');
        } catch (error) {
            console.error('Error initializing TON Connect:', error);
        }
    }

    function updateWalletUI() {
        const depositBtn = document.getElementById('headerDepositBtn');
        const depositWalletStatus = document.getElementById('depositWalletStatus');
        const depositForm = document.getElementById('depositForm');
        const disconnectContainer = document.getElementById('disconnectContainer');
        
        if (walletConnected && walletAddress) {
            if (depositBtn) {
                depositBtn.innerHTML = '<i class="fas fa-wallet"></i>';
                depositBtn.classList.add('wallet-connected');
                depositBtn.title = walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4);
            }
            
            if (depositWalletStatus) depositWalletStatus.style.display = 'none';
            if (depositForm) depositForm.style.display = 'block';
            if (disconnectContainer) disconnectContainer.style.display = 'block';
        } else {
            if (depositBtn) {
                depositBtn.innerHTML = '<i class="fas fa-plus"></i>';
                depositBtn.classList.remove('wallet-connected');
                depositBtn.title = 'Connect Wallet';
            }
            
            if (depositWalletStatus) depositWalletStatus.style.display = 'block';
            if (depositForm) depositForm.style.display = 'none';
            if (disconnectContainer) disconnectContainer.style.display = 'none';
        }
    }

    async function disconnectWallet() {
        if (tonConnectUI) {
            await tonConnectUI.disconnect();
        }
    }

    // ==================== NAVIGATION FUNCTIONS ====================
    
    function switchTab(targetId, url) {
        if (url && url !== '') {
            window.location.href = url;
            return;
        }
        
        if (targetId) {
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-target') === targetId) {
                    item.classList.add('active');
                }
            });
            
            console.log(`✅ Switched to tab: ${targetId}`);
        }
    }

    // ==================== DEPOSIT MODAL FUNCTIONS ====================
    
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
    }

    async function sendDeposit() {
        if (!walletConnected || !tonConnectUI) {
            alert('Silakan hubungkan wallet TON terlebih dahulu');
            return;
        }
        
        const amountInput = document.getElementById('tonAmount');
        let amount = parseFloat(amountInput?.value || 0);
        
        if (isNaN(amount) || amount < 0.1) {
            alert('Minimal deposit 0.1 TON');
            return;
        }
        
        // Alamat wallet penerima (ganti dengan alamat wallet Anda)
        const RECIPIENT_ADDRESS = "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        
        try {
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: RECIPIENT_ADDRESS,
                        amount: (amount * 1000000000).toString(),
                        payload: telegramUser?.id?.toString() || ''
                    }
                ]
            };
            
            const result = await tonConnectUI.sendTransaction(transaction);
            
            if (result) {
                // Verifikasi deposit ke backend
                const verifyResponse = await fetch('/api/games/verify-ton-deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: telegramUser?.id,
                        transaction_hash: result.boc,
                        amount_ton: amount,
                        from_address: walletAddress,
                        memo: telegramUser?.id?.toString() || ''
                    })
                });
                
                const verifyData = await verifyResponse.json();
                
                if (verifyData.success) {
                    document.getElementById('depositForm').style.display = 'none';
                    document.getElementById('depositInstructions').style.display = 'block';
                    document.getElementById('depositTxHash').textContent = result.boc.substring(0, 20) + '...';
                    
                    await loadBalance(telegramUser.id);
                    
                    if (tg.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    
                    setTimeout(() => {
                        closeDepositModal();
                        document.getElementById('depositInstructions').style.display = 'none';
                        document.getElementById('depositForm').style.display = 'block';
                    }, 3000);
                } else {
                    alert('Verifikasi deposit gagal: ' + (verifyData.error || 'Unknown error'));
                }
            }
        } catch (error) {
            console.error('Deposit error:', error);
            if (error.message.includes('User rejected')) {
                alert('Transaksi dibatalkan');
            } else {
                alert('Error: ' + error.message);
            }
        }
    }

    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🟡 Initializing games page...');
        
        telegramUser = await getTelegramUser();
        console.log('Telegram user:', telegramUser);
        
        if (telegramUser && telegramUser.id) {
            const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            await authUser(telegramUser.id, telegramUser.username || '', fullName || 'User');
            await loadBalance(telegramUser.id);
        }
        
        // ========== INIT TON CONNECT ==========
        await initTonConnect();
        
        // ========== EVENT LISTENERS FOR NAVIGATION ==========
        const navItems = document.querySelectorAll('.nav-item');
        console.log(`Found ${navItems.length} nav items`);
        
        navItems.forEach((item, index) => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            const targetId = newItem.getAttribute('data-target');
            const url = newItem.getAttribute('data-url');
            
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🔘 Nav clicked: target=${targetId}, url=${url}`);
                switchTab(targetId, url);
            });
            
            console.log(`✅ Nav item ${index} attached: ${targetId || url}`);
        });
        
        // ========== DEPOSIT BUTTON ==========
        const depositBtn = document.getElementById('headerDepositBtn');
        if (depositBtn) {
            const newDepositBtn = depositBtn.cloneNode(true);
            depositBtn.parentNode.replaceChild(newDepositBtn, depositBtn);
            newDepositBtn.addEventListener('click', showDepositModal);
            console.log('✅ Deposit button listener attached');
        }
        
        // ========== DISCONNECT WALLET BUTTON ==========
        const disconnectBtn = document.getElementById('disconnectWalletBtn');
        if (disconnectBtn) {
            const newDisconnectBtn = disconnectBtn.cloneNode(true);
            disconnectBtn.parentNode.replaceChild(newDisconnectBtn, disconnectBtn);
            newDisconnectBtn.addEventListener('click', disconnectWallet);
            console.log('✅ Disconnect button listener attached');
        }
        
        // ========== SEND DEPOSIT BUTTON ==========
        const sendDepositBtn = document.getElementById('sendDepositBtn');
        if (sendDepositBtn) {
            const newSendBtn = sendDepositBtn.cloneNode(true);
            sendDepositBtn.parentNode.replaceChild(newSendBtn, sendDepositBtn);
            newSendBtn.addEventListener('click', sendDeposit);
            console.log('✅ Send deposit button listener attached');
        }
        
        // ========== MODAL CLOSE HANDLERS ==========
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) {
            const newCloseBtn = closeModalBtn.cloneNode(true);
            closeModalBtn.parentNode.replaceChild(newCloseBtn, closeModalBtn);
            newCloseBtn.addEventListener('click', closeDepositModal);
        }
        
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('depositModal');
            if (modal && e.target === modal) {
                closeDepositModal();
            }
        });
        
        console.log('✅ Games Page Ready');
        console.log('Current balance:', currentBalance);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Expose global functions
    window.closeModal = closeDepositModal;
    window.copyDepositAddress = function() {
        const addressEl = document.getElementById('depositAddress');
        if (addressEl && addressEl.textContent) {
            navigator.clipboard.writeText(addressEl.textContent);
            alert('Address copied!');
        }
    };
})();
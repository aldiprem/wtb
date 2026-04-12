// games/js/games.js - VERSION LENGKAP DENGAN TON CONNECT

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

    // Konfigurasi - GANTI DENGAN URL TUNNEL ANDA
    const TUNNEL_URL = 'https://companel.shop';
    const MANIFEST_URL = TUNNEL_URL + '/tonconnect-manifest.json';

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
            const response = await fetch(`${TUNNEL_URL}/api/balance/${telegramId}`);
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
            const response = await fetch(`${TUNNEL_URL}/api/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId.toString(),
                    telegram_username: username,
                    telegram_first_name: firstName,
                    telegram_last_name: ''
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
            const response = await fetch(`${TUNNEL_URL}/api/user/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId.toString(),
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

            const wallet = tonConnectUI.wallet;
            if (wallet) {
                walletConnected = true;
                walletAddress = wallet.account.address;
                updateWalletUI();
                
                if (telegramUser && telegramUser.id) {
                    await updateUserWallet(telegramUser.id, walletAddress);
                }
            }

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

    // ==================== DEPOSIT FUNCTIONS ====================
    
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
        // Reset modal state
        document.getElementById('depositWalletStatus').style.display = 'block';
        document.getElementById('depositForm').style.display = 'none';
        document.getElementById('depositInstructions').style.display = 'none';
    }

    function base64EncodeComment(comment) {
        try {
            if (comment.length > 120) {
                comment = comment.substring(0, 120);
            }
            const encoder = new TextEncoder();
            const commentBytes = encoder.encode(comment);
            const prefix = new Uint8Array([0, 0, 0, 0]);
            const fullBytes = new Uint8Array(prefix.length + commentBytes.length);
            fullBytes.set(prefix);
            fullBytes.set(commentBytes, prefix.length);
            
            let binary = '';
            for (let i = 0; i < fullBytes.length; i++) {
                binary += String.fromCharCode(fullBytes[i]);
            }
            return btoa(binary);
        } catch (e) {
            console.error('Error encoding comment:', e);
            return undefined;
        }
    }

    async function sendDeposit() {
        if (!walletConnected || !tonConnectUI) {
            alert('Silakan hubungkan wallet TON terlebih dahulu');
            await tonConnectUI.connect();
            return;
        }
        
        const amountInput = document.getElementById('tonAmount');
        let amount = parseFloat(amountInput?.value || 0);
        
        if (isNaN(amount) || amount < 0.1) {
            alert('Minimal deposit 0.1 TON');
            return;
        }
        
        // Alamat wallet penerima dari .env
        const RECIPIENT_ADDRESS = "UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra";
        
        // Buat memo
        const memo = `deposit:${telegramUser?.id}:${Date.now()}`;
        const amountNano = Math.floor(amount * 1_000_000_000).toString();
        
        const sendBtn = document.getElementById('sendDepositBtn');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: RECIPIENT_ADDRESS,
                        amount: amountNano,
                        payload: base64EncodeComment(memo)
                    }
                ]
            };
            
            const result = await tonConnectUI.sendTransaction(transaction);
            
            if (result) {
                const verifyResponse = await fetch(`${TUNNEL_URL}/api/verify-transaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: telegramUser?.id.toString(),
                        transaction_hash: result.boc,
                        amount_ton: amount,
                        from_address: walletAddress,
                        memo: memo
                    })
                });
                
                const verifyData = await verifyResponse.json();
                
                if (verifyData.success) {
                    document.getElementById('depositWalletStatus').style.display = 'none';
                    document.getElementById('depositForm').style.display = 'none';
                    document.getElementById('depositInstructions').style.display = 'block';
                    document.getElementById('depositTxHash').textContent = result.boc.substring(0, 20) + '...';
                    
                    await loadBalance(telegramUser.id);
                    
                    if (tg.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    
                    setTimeout(() => {
                        closeDepositModal();
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
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
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
        });
        
        // ========== DEPOSIT BUTTON ==========
        const depositBtn = document.getElementById('headerDepositBtn');
        if (depositBtn) {
            const newDepositBtn = depositBtn.cloneNode(true);
            depositBtn.parentNode.replaceChild(newDepositBtn, depositBtn);
            newDepositBtn.addEventListener('click', showDepositModal);
        }
        
        // ========== DISCONNECT WALLET BUTTON ==========
        const disconnectBtn = document.getElementById('disconnectWalletBtn');
        if (disconnectBtn) {
            const newDisconnectBtn = disconnectBtn.cloneNode(true);
            disconnectBtn.parentNode.replaceChild(newDisconnectBtn, disconnectBtn);
            newDisconnectBtn.addEventListener('click', disconnectWallet);
        }
        
        // ========== SEND DEPOSIT BUTTON ==========
        const sendDepositBtn = document.getElementById('sendDepositBtn');
        if (sendDepositBtn) {
            const newSendBtn = sendDepositBtn.cloneNode(true);
            sendDepositBtn.parentNode.replaceChild(newSendBtn, sendDepositBtn);
            newSendBtn.addEventListener('click', sendDeposit);
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
        
        console.log('✅ Games Page Ready with TON Connect');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    window.closeModal = closeDepositModal;
    window.copyDepositAddress = function() {
        const addressEl = document.getElementById('depositAddress');
        if (addressEl && addressEl.textContent) {
            navigator.clipboard.writeText(addressEl.textContent);
            alert('Address copied!');
        }
    };
})();
// games/js/games.js - PERBAIKAN: Gunakan API dari games_service.py

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

    const API_BASE = window.location.origin;
    const WEB_ADDRESS = "UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra";

    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    async function getTelegramUser() {
        const initDataUnsafe = tg.initDataUnsafe || {};
        if (initDataUnsafe.user) {
            return initDataUnsafe.user;
        }
        // JANGAN return dummy ID
        return null;
    }

    // ========== API KE games_service.py ==========
    
    async function authUser(telegramId, username, firstName) {
        try {
            const response = await fetch(`${API_BASE}/api/games/auth`, {
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

    async function loadBalance(telegramId) {
        try {
            const response = await fetch(`${API_BASE}/api/games/balance/${telegramId}`);
            const data = await response.json();
            if (data.success) {
                currentBalance = data.balance;
                const balanceEl = document.getElementById('userBalance');
                if (balanceEl) {
                    balanceEl.textContent = formatNumberWithCommas(data.balance) + ' TON';
                }
                return data.balance;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
        return 0;
    }

    async function updateUserWallet(telegramId, walletAddress) {
        try {
            const response = await fetch(`${API_BASE}/api/games/user/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    wallet_address: walletAddress
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Error updating wallet:', error);
            return false;
        }
    }

    async function verifyDeposit(telegramId, transactionHash, amount, fromAddress, memo) {
        try {
            const response = await fetch(`${API_BASE}/api/games/verify-ton-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    transaction_hash: transactionHash,
                    amount_ton: amount,
                    from_address: fromAddress,
                    memo: memo
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Verify deposit error:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== TON CONNECT ==========
    
    async function initTonConnect() {
        if (typeof window.TonConnectUI === 'undefined') {
            console.log('⏳ Waiting for TON Connect UI...');
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (typeof window.TonConnectUI !== 'undefined') break;
            }
        }
        
        if (typeof window.TonConnectUI === 'undefined') {
            console.error('TON Connect UI not loaded');
            return;
        }

        try {
            tonConnectUI = new window.TonConnectUI({
                manifestUrl: `${API_BASE}/tonconnect-manifest.json`,
                buttonRootId: 'depositTonConnect'
            });

            const wallet = tonConnectUI.wallet;
            if (wallet) {
                walletConnected = true;
                walletAddress = wallet.account.address;
                updateWalletUI();
                if (telegramUser?.id) await updateUserWallet(telegramUser.id, walletAddress);
            }

            tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet) {
                    walletConnected = true;
                    walletAddress = wallet.account.address;
                    if (telegramUser?.id) await updateUserWallet(telegramUser.id, walletAddress);
                } else {
                    walletConnected = false;
                    walletAddress = null;
                }
                updateWalletUI();
            });

            console.log('✅ TON Connect initialized');
        } catch (error) {
            console.error('TON Connect error:', error);
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
            }
            if (depositWalletStatus) depositWalletStatus.style.display = 'none';
            if (depositForm) depositForm.style.display = 'block';
            if (disconnectContainer) disconnectContainer.style.display = 'block';
        } else {
            if (depositBtn) {
                depositBtn.innerHTML = '<i class="fas fa-plus"></i>';
                depositBtn.classList.remove('wallet-connected');
            }
            if (depositWalletStatus) depositWalletStatus.style.display = 'block';
            if (depositForm) depositForm.style.display = 'none';
            if (disconnectContainer) disconnectContainer.style.display = 'none';
        }
    }

    async function disconnectWallet() {
        if (tonConnectUI) await tonConnectUI.disconnect();
    }

    // ========== NAVIGATION ==========
    
    function switchTab(targetId, url) {
        if (url && url !== '') {
            window.location.href = url;
            return;
        }
        if (targetId) {
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-target') === targetId) item.classList.add('active');
            });
        }
    }

    // ========== DEPOSIT ==========
    
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
    }

    function base64EncodeComment(comment) {
        try {
            if (comment.length > 120) comment = comment.substring(0, 120);
            const encoder = new TextEncoder();
            const commentBytes = encoder.encode(comment);
            const prefix = new Uint8Array([0, 0, 0, 0]);
            const fullBytes = new Uint8Array(prefix.length + commentBytes.length);
            fullBytes.set(prefix);
            fullBytes.set(commentBytes, prefix.length);
            let binary = '';
            for (let i = 0; i < fullBytes.length; i++) binary += String.fromCharCode(fullBytes[i]);
            return btoa(binary);
        } catch (e) {
            return undefined;
        }
    }

    async function sendDeposit() {
        if (!walletConnected || !tonConnectUI) {
            alert('Silakan hubungkan wallet TON terlebih dahulu');
            await tonConnectUI?.connect();
            return;
        }
        
        const amountInput = document.getElementById('tonAmount');
        let amount = parseFloat(amountInput?.value || 0);
        
        if (isNaN(amount) || amount < 0.1) {
            alert('Minimal deposit 0.1 TON');
            return;
        }
        
        const memo = `deposit:${telegramUser?.id}:${Date.now()}`;
        const amountNano = Math.floor(amount * 1_000_000_000).toString();
        
        const sendBtn = document.getElementById('sendDepositBtn');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: WEB_ADDRESS,
                    amount: amountNano,
                    payload: base64EncodeComment(memo)
                }]
            };
            
            const result = await tonConnectUI.sendTransaction(transaction);
            
            if (result) {
                const verifyData = await verifyDeposit(
                    telegramUser?.id.toString(),
                    result.boc,
                    amount,
                    walletAddress,
                    memo
                );
                
                if (verifyData.success) {
                    document.getElementById('depositWalletStatus').style.display = 'none';
                    document.getElementById('depositForm').style.display = 'none';
                    document.getElementById('depositInstructions').style.display = 'block';
                    document.getElementById('depositTxHash').textContent = result.boc.substring(0, 20) + '...';
                    
                    await loadBalance(telegramUser.id);
                    
                    setTimeout(() => closeDepositModal(), 3000);
                } else {
                    alert('Verifikasi deposit gagal: ' + (verifyData.error || 'Unknown error'));
                }
            }
        } catch (error) {
            alert('Error: ' + (error.message || 'Terjadi kesalahan'));
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }

    // ========== INIT ==========
    
    async function init() {
        console.log('🟡 Initializing games page...');
        
        telegramUser = await getTelegramUser();
        console.log('Telegram user:', telegramUser);
        
        if (telegramUser && telegramUser.id) {
            await authUser(telegramUser.id, telegramUser.username || '', telegramUser.first_name || '');
            await loadBalance(telegramUser.id);
        } else {
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = 'Login Required';
        }
        
        await initTonConnect();
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach((item) => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            const targetId = newItem.getAttribute('data-target');
            const url = newItem.getAttribute('data-url');
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(targetId, url);
            });
        });
        
        // Buttons
        const depositBtn = document.getElementById('headerDepositBtn');
        if (depositBtn) {
            const newBtn = depositBtn.cloneNode(true);
            depositBtn.parentNode.replaceChild(newBtn, depositBtn);
            newBtn.addEventListener('click', showDepositModal);
        }
        
        const disconnectBtn = document.getElementById('disconnectWalletBtn');
        if (disconnectBtn) {
            const newBtn = disconnectBtn.cloneNode(true);
            disconnectBtn.parentNode.replaceChild(newBtn, disconnectBtn);
            newBtn.addEventListener('click', disconnectWallet);
        }
        
        const sendBtn = document.getElementById('sendDepositBtn');
        if (sendBtn) {
            const newBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newBtn, sendBtn);
            newBtn.addEventListener('click', sendDeposit);
        }
        
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) {
            const newBtn = closeModalBtn.cloneNode(true);
            closeModalBtn.parentNode.replaceChild(newBtn, closeModalBtn);
            newBtn.addEventListener('click', closeDepositModal);
        }
        
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('depositModal');
            if (modal && e.target === modal) closeDepositModal();
        });
        
        console.log('✅ Games Page Ready');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    window.closeModal = closeDepositModal;
    window.copyDepositAddress = function() {
        const addressEl = document.getElementById('depositAddress');
        if (addressEl?.textContent && addressEl.textContent !== '-') {
            navigator.clipboard.writeText(addressEl.textContent);
            alert('Address copied!');
        }
    };
})();
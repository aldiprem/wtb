// games/js/games.js - PERBAIKAN LENGKAP

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
    let walletAddressFriendly = null; // Simpan friendly address

    const API_BASE = window.location.origin;
    const WEB_ADDRESS = "UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra"; // Alamat MERCHANT untuk DEPOSIT

    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    // 🔥 FUNGSI KONVERSI RAW KE FRIENDLY (UQ format)
    function rawToFriendly(rawAddress) {
        if (!rawAddress) return rawAddress;
        
        if (rawAddress.startsWith('EQ') || rawAddress.startsWith('UQ')) {
            return rawAddress;
        }
        
        if (rawAddress.startsWith('0:')) {
            try {
                const hashHex = rawAddress.substring(2);
                if (hashHex.length !== 64) {
                    console.error('Invalid hash length:', hashHex.length);
                    return rawAddress;
                }
                
                const hashBytes = new Uint8Array(hashHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
                const addressBytes = new Uint8Array(1 + hashBytes.length);
                addressBytes[0] = 0x51;
                addressBytes.set(hashBytes, 1);
                
                let binary = '';
                for (let i = 0; i < addressBytes.length; i++) {
                    binary += String.fromCharCode(addressBytes[i]);
                }
                let base64 = btoa(binary);
                base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
                return 'UQ' + base64;
            } catch (e) {
                console.error('Address conversion error:', e);
                return rawAddress;
            }
        }
        
        return rawAddress;
    }

    async function getTelegramUser() {
        const initDataUnsafe = tg.initDataUnsafe || {};
        if (initDataUnsafe.user) {
            return initDataUnsafe.user;
        }
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
                    balanceEl.textContent = formatNumberWithCommas(data.balance);
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

    async function initTonConnect() {
        let TonConnectUIClass = null;
        
        for (let i = 0; i < 50; i++) {
            if (typeof window.TonConnectUI !== 'undefined') {
                TonConnectUIClass = window.TonConnectUI;
                console.log('✅ Found window.TonConnectUI');
                break;
            }
            if (typeof window.TON_CONNECT_UI !== 'undefined' && window.TON_CONNECT_UI.TonConnectUI) {
                TonConnectUIClass = window.TON_CONNECT_UI.TonConnectUI;
                console.log('✅ Found window.TON_CONNECT_UI.TonConnectUI');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!TonConnectUIClass) {
            console.error('❌ TON Connect UI not loaded after waiting');
            createManualConnectButton();
            return;
        }

        try {
            const manifestUrl = `${API_BASE}/tonconnect-manifest.json`;
            console.log('📝 Initializing TON Connect with manifest:', manifestUrl);
            
            const container = document.getElementById('ton-connect-container');
            if (!container) {
                console.error('❌ Container #ton-connect-container not found');
                return;
            }
            
            tonConnectUI = new TonConnectUIClass({
                manifestUrl: manifestUrl,
                buttonRootId: 'ton-connect-container',
                language: 'en'
            });

            const wallet = tonConnectUI.wallet;
            if (wallet) {
                walletConnected = true;
                // 🔥 SIMPAN RAW ADDRESS DARI TON CONNECT
                const rawAddress = wallet.account.address;
                // 🔥 KONVERSI KE FRIENDLY FORMAT (UQ...)
                walletAddressFriendly = rawToFriendly(rawAddress);
                walletAddress = rawAddress;
                
                console.log('✅ Wallet already connected - RAW:', rawAddress);
                console.log('✅ Wallet already connected - FRIENDLY:', walletAddressFriendly);
                
                updateWalletUI();
                if (telegramUser?.id) {
                    // 🔥 SIMPAN FRIENDLY ADDRESS KE DATABASE
                    await updateUserWallet(telegramUser.id, walletAddressFriendly);
                    await saveWalletSession(telegramUser.id, walletAddressFriendly);
                }
            }

            tonConnectUI.onStatusChange(async (wallet) => {
                console.log('📱 Wallet status changed:', wallet ? 'connected' : 'disconnected');
                
                if (wallet && telegramUser) {
                    walletConnected = true;
                    const rawAddress = wallet.account.address;
                    walletAddressFriendly = rawToFriendly(rawAddress);
                    walletAddress = rawAddress;
                    
                    console.log('✅ Wallet connected - RAW:', rawAddress);
                    console.log('✅ Wallet connected - FRIENDLY:', walletAddressFriendly);
                    
                    if (telegramUser?.id) {
                        // 🔥 SIMPAN FRIENDLY ADDRESS KE DATABASE
                        await updateUserWallet(telegramUser.id, walletAddressFriendly);
                        await saveWalletSession(telegramUser.id, walletAddressFriendly);
                    }
                } else {
                    walletConnected = false;
                    walletAddress = null;
                    walletAddressFriendly = null;
                    console.log('❌ Wallet disconnected');
                    if (telegramUser) {
                        await deactivateWalletSession(telegramUser.id);
                    }
                }
                updateWalletUI();
            });

            console.log('✅ TON Connect initialized successfully');
        } catch (error) {
            console.error('❌ TON Connect error:', error);
            createManualConnectButton();
        }
    }

    async function saveWalletSession(telegramId, walletAddress) {
        try {
            const response = await fetch(`${API_BASE}/api/games/save-wallet-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId.toString(),
                    wallet_address: walletAddress
                })
            });
            const data = await response.json();
            console.log('✅ Wallet session saved:', data);
        } catch (error) {
            console.error('❌ Error saving wallet session:', error);
        }
    }

    async function deactivateWalletSession(telegramId) {
        try {
            const response = await fetch(`${API_BASE}/api/games/deactivate-wallet-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId.toString()
                })
            });
            const data = await response.json();
            console.log('✅ Wallet session deactivated:', data);
        } catch (error) {
            console.error('❌ Error deactivating wallet session:', error);
        }
    }

    function createManualConnectButton() {
        const container = document.getElementById('ton-connect-container');
        if (container) {
            container.innerHTML = `
                <button id="manualConnectBtn" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); border: none; color: white; padding: 14px 24px; border-radius: 14px; font-weight: 600; cursor: pointer; width: 100%; font-size: 16px;">
                    <i class="fas fa-wallet"></i> Connect Wallet
                </button>
            `;
            document.getElementById('manualConnectBtn')?.addEventListener('click', () => {
                window.open('https://tonkeeper.com/ton-connect?manifest=' + encodeURIComponent(`${API_BASE}/tonconnect-manifest.json`), '_blank');
            });
        }
    }

    function updateWalletUI() {
        const depositBtn = document.getElementById('headerDepositBtn');
        const depositWalletStatus = document.getElementById('depositWalletStatus');
        const depositForm = document.getElementById('depositForm');
        const disconnectContainer = document.getElementById('disconnectContainer');
        const tonConnectContainer = document.getElementById('ton-connect-container');
        const depositAddressEl = document.getElementById('depositAddress');
        const depositFormText = document.querySelector('#depositForm p');
        
        if (walletConnected && walletAddressFriendly) {
            if (depositBtn) {
                depositBtn.innerHTML = '<i class="fas fa-wallet"></i>';
                depositBtn.classList.add('wallet-connected');
            }
            if (depositWalletStatus) depositWalletStatus.style.display = 'none';
            
            if (depositForm) {
                depositForm.style.display = 'block';
                
                // 🔥 TAMPILKAN ADDRESS USER YANG TERHUBUNG (FRIENDLY FORMAT)
                if (depositAddressEl) {
                    // Tampilkan friendly address user
                    const displayAddress = walletAddressFriendly;
                    // Potong untuk tampilan (UQ...)
                    const shortened = displayAddress.substring(0, 6) + '...' + displayAddress.slice(-4);
                    depositAddressEl.textContent = shortened;
                    depositAddressEl.setAttribute('data-full-address', displayAddress);
                    depositAddressEl.title = 'Click to copy full address';
                    console.log('✅ Displaying user address:', shortened);
                }
                
                // Ubah teks instruksi
                if (depositFormText) {
                    depositFormText.textContent = 'Kirim TON dari wallet Anda ke alamat MERCHANT berikut:';
                }
            }
            if (disconnectContainer) disconnectContainer.style.display = 'block';
            if (tonConnectContainer) tonConnectContainer.style.display = 'none';
        } else {
            if (depositBtn) {
                depositBtn.innerHTML = '<i class="fas fa-plus"></i>';
                depositBtn.classList.remove('wallet-connected');
            }
            if (depositWalletStatus) depositWalletStatus.style.display = 'block';
            if (depositForm) depositForm.style.display = 'none';
            if (disconnectContainer) disconnectContainer.style.display = 'none';
            if (tonConnectContainer) tonConnectContainer.style.display = 'block';
        }
    }

    async function disconnectWallet() {
        if (tonConnectUI) {
            await tonConnectUI.disconnect();
            console.log('Wallet disconnected');
        }
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

    // ========== DEPOSIT MODAL ==========
    
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) {
            modal.style.display = 'flex';
            if (!walletConnected && tonConnectUI) {
                console.log('Modal opened, wallet not connected');
            }
        }
    }

    function closeDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
    }

    async function sendDeposit() {
        if (!walletConnected || !tonConnectUI) {
            alert('Silakan hubungkan wallet TON terlebih dahulu');
            if (tonConnectUI) {
                await tonConnectUI.connect();
            }
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
            // 🔥 KIRIM KE ALAMAT MERCHANT (WEB_ADDRESS)
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: WEB_ADDRESS, // Alamat MERCHANT
                    amount: amountNano
                }]
            };
            
            console.log('📤 Sending transaction to MERCHANT:', WEB_ADDRESS);
            console.log('📤 From wallet:', walletAddressFriendly);
            
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('✅ Transaction sent:', result);
            
            if (result) {
                const verifyData = await verifyDeposit(
                    telegramUser?.id.toString(),
                    result.boc,
                    amount,
                    walletAddressFriendly,
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
            console.error('Deposit error:', error);
            alert('Error: ' + (error.message || 'Terjadi kesalahan'));
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }

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
        
        // BUTTON DEPOSIT
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
        let fullAddress = addressEl?.getAttribute('data-full-address');
        if (!fullAddress && addressEl?.textContent) {
            fullAddress = addressEl.textContent;
        }
        if (fullAddress && fullAddress !== '-') {
            navigator.clipboard.writeText(fullAddress);
            alert('Wallet address copied!');
        }
    };
})();
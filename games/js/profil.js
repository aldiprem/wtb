// games/js/profil.js - TANPA WITHDRAW, DEPOSIT SAMA DENGAN GAMES.HTML

(function() {
    console.log('👤 Profile Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let currentBalance = 0;
    let tonConnectUI = null;
    let walletConnected = false;
    let walletAddress = null;
    let walletAddressFriendly = null;

    const API_BASE = window.location.origin;
    const WEB_ADDRESS = "UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra"; // Alamat MERCHANT

    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    // Konversi raw ke friendly address
    function rawToFriendly(rawAddress) {
        if (!rawAddress) return rawAddress;
        
        if (rawAddress.startsWith('EQ') || rawAddress.startsWith('UQ')) {
            return rawAddress;
        }
        
        if (rawAddress.startsWith('0:')) {
            try {
                const hashHex = rawAddress.substring(2);
                if (hashHex.length !== 64) {
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
        return {
            id: 123456789,
            first_name: 'Guest',
            last_name: 'User',
            username: 'guest_user',
            photo_url: 'https://via.placeholder.com/100'
        };
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
                const profileBalanceEl = document.getElementById('profileBalance');
                
                const formattedBalance = formatNumberWithCommas(data.balance);
                const balanceText = formattedBalance + ' TON';
                
                if (balanceEl) balanceEl.textContent = balanceText;
                if (profileBalanceEl) profileBalanceEl.textContent = balanceText;
                
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

    // Load user stats
    async function loadUserStats(telegramId) {
        try {
            const response = await fetch(`${API_BASE}/api/games/user-stats/${telegramId}`);
            const data = await response.json();
            if (data.success) {
                const giftsEl = document.getElementById('totalGifts');
                const referralEl = document.getElementById('referralReward');
                if (giftsEl) giftsEl.textContent = data.gifts || 0;
                if (referralEl) referralEl.textContent = data.referral_reward || 0;
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
            const giftsEl = document.getElementById('totalGifts');
            const referralEl = document.getElementById('referralReward');
            if (giftsEl) giftsEl.textContent = '0';
            if (referralEl) referralEl.textContent = '0';
        }
    }

    // Update Profile UI
    function updateProfileUI() {
        if (!telegramUser) return;
        
        const username = telegramUser.username || 'no_username';
        const userId = telegramUser.id;
        
        const profileNameRow = document.getElementById('profileNameRow');
        if (profileNameRow) {
            profileNameRow.innerHTML = `
                <span class="profile-username-display">@${username}</span>
                <span class="profile-id-display">ID: ${userId}</span>
            `;
        }
        
        const avatarImg = document.getElementById('userAvatar');
        if (avatarImg) {
            if (telegramUser.photo_url) {
                avatarImg.src = telegramUser.photo_url;
            } else {
                const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=6c5ce7&color=fff&size=100`;
            }
        }
    }

    // ========== TON CONNECT (SAMA DENGAN GAMES.JS) ==========
    
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
            console.error('❌ TON Connect UI not loaded');
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
                const rawAddress = wallet.account.address;
                walletAddressFriendly = rawToFriendly(rawAddress);
                walletAddress = rawAddress;
                
                console.log('✅ Wallet already connected - FRIENDLY:', walletAddressFriendly);
                
                updateWalletUI();
                if (telegramUser?.id) {
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
                    
                    console.log('✅ Wallet connected - FRIENDLY:', walletAddressFriendly);
                    
                    if (telegramUser?.id) {
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
        const depositWalletStatus = document.getElementById('depositWalletStatus');
        const depositForm = document.getElementById('depositForm');
        const disconnectContainer = document.getElementById('disconnectContainer');
        const tonConnectContainer = document.getElementById('ton-connect-container');
        const depositAddressEl = document.getElementById('depositAddress');
        const depositFormText = document.querySelector('#depositForm p');
        
        if (walletConnected && walletAddressFriendly) {
            if (depositWalletStatus) depositWalletStatus.style.display = 'none';
            
            if (depositForm) {
                depositForm.style.display = 'block';
                
                if (depositAddressEl) {
                    const displayAddress = walletAddressFriendly;
                    const shortened = displayAddress.substring(0, 6) + '...' + displayAddress.slice(-4);
                    depositAddressEl.textContent = shortened;
                    depositAddressEl.setAttribute('data-full-address', displayAddress);
                    depositAddressEl.title = 'Click to copy full address';
                    console.log('✅ Displaying user address:', shortened);
                }
                
                if (depositFormText) {
                    depositFormText.textContent = 'Kirim TON dari wallet Anda ke alamat MERCHANT berikut:';
                }
            }
            if (disconnectContainer) disconnectContainer.style.display = 'block';
            if (tonConnectContainer) tonConnectContainer.style.display = 'none';
        } else {
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
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: WEB_ADDRESS,
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
                    await loadUserStats(telegramUser.id);
                    
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

    // ========== HISTORY FUNCTIONS ==========
    
    async function loadUserGameHistory(telegramId) {
        try {
            const response = await fetch(`${API_BASE}/api/games/user-history/${telegramId}`);
            const data = await response.json();
            
            const tbody = document.getElementById('historyBodyProfile');
            if (!tbody) return;
            
            if (!data.success || !data.history || data.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Belum ada riwayat game</td></tr>';
                return;
            }
            
            let html = '';
            for (const game of data.history) {
                const winClass = game.win_amount > game.bet_amount ? 'win-positive' : '';
                html += `
                    <tr>
                        <td>${game.game_name || 'Plinko'}</td>
                        <td>${formatNumberWithCommas(game.bet_amount)}</td>
                        <td>${game.multiplier}x</td>
                        <td class="${winClass}">${formatNumberWithCommas(game.win_amount)}</td>
                        <td>${new Date(game.played_at).toLocaleString()}</td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;
        } catch (error) {
            console.error('Error loading history:', error);
            const tbody = document.getElementById('historyBodyProfile');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading history</td></tr>';
            }
        }
    }

    function toggleHistory() {
        const historySection = document.getElementById('historySection');
        if (!historySection) return;
        
        if (historySection.style.display === 'none' || historySection.style.display === '') {
            historySection.style.display = 'block';
            if (telegramUser && telegramUser.id) {
                loadUserGameHistory(telegramUser.id);
            }
        } else {
            historySection.style.display = 'none';
        }
    }

    // ========== INITIALIZATION ==========
    
    async function init() {
        telegramUser = await getTelegramUser();
        
        if (telegramUser) {
            await authUser(telegramUser.id, telegramUser.username || '', telegramUser.first_name || '');
            await loadBalance(telegramUser.id);
            await loadUserStats(telegramUser.id);
            updateProfileUI();
        }
        
        await initTonConnect();
        
        // Event listeners - DEPOSIT
        const depositBtn = document.getElementById('depositBtn');
        if (depositBtn) {
            const newBtn = depositBtn.cloneNode(true);
            depositBtn.parentNode.replaceChild(newBtn, depositBtn);
            newBtn.addEventListener('click', showDepositModal);
        }
        
        // History button
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            const newBtn = historyBtn.cloneNode(true);
            historyBtn.parentNode.replaceChild(newBtn, historyBtn);
            newBtn.addEventListener('click', toggleHistory);
        }
        
        const closeHistoryBtn = document.getElementById('closeHistoryBtn');
        if (closeHistoryBtn) {
            const newBtn = closeHistoryBtn.cloneNode(true);
            closeHistoryBtn.parentNode.replaceChild(newBtn, closeHistoryBtn);
            newBtn.addEventListener('click', () => {
                const historySection = document.getElementById('historySection');
                if (historySection) historySection.style.display = 'none';
            });
        }
        
        // Modal close handlers
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) {
            const newBtn = closeModalBtn.cloneNode(true);
            closeModalBtn.parentNode.replaceChild(newBtn, closeModalBtn);
            newBtn.addEventListener('click', closeDepositModal);
        }
        
        // Disconnect wallet button
        const disconnectBtn = document.getElementById('disconnectWalletBtn');
        if (disconnectBtn) {
            const newBtn = disconnectBtn.cloneNode(true);
            disconnectBtn.parentNode.replaceChild(newBtn, disconnectBtn);
            newBtn.addEventListener('click', disconnectWallet);
        }
        
        // Send deposit button
        const sendBtn = document.getElementById('sendDepositBtn');
        if (sendBtn) {
            const newBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newBtn, sendBtn);
            newBtn.addEventListener('click', sendDeposit);
        }
        
        window.addEventListener('click', (e) => {
            const depositModal = document.getElementById('depositModal');
            if (depositModal && e.target === depositModal) closeDepositModal();
        });
        
        console.log('✅ Profile Page Ready (No Withdraw)');
    }
    
    init();
    
    // Expose global functions
    window.closeDepositModal = closeDepositModal;
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
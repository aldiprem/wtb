// games/js/profil.js - VERSION DENGAN WITHDRAW WORKING

(function() {
    console.log('👤 Profile Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let userData = null;
    let currentBalance = 0;
    let userWalletAddress = null;

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

    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    async function loadUserData(telegramId, username, firstName) {
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
            if (data.success) {
                userData = data;
                updateProfileUI();
                return data;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        return null;
    }

    async function loadBalance(telegramId) {
        try {
            const response = await fetch(`/api/games/balance/${telegramId}`);
            const data = await response.json();
            if (data.success) {
                currentBalance = data.balance;
                const balanceEl = document.getElementById('userBalance');
                const profileBalanceEl = document.getElementById('profileBalance');
                const withdrawBalanceEl = document.getElementById('withdrawBalance');
                
                const formattedBalance = formatNumberWithCommas(data.balance);
                const balanceText = formattedBalance + ' TON';
                
                if (balanceEl) balanceEl.textContent = balanceText;
                if (profileBalanceEl) profileBalanceEl.textContent = balanceText;
                if (withdrawBalanceEl) withdrawBalanceEl.textContent = balanceText;
                
                return data.balance;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
        return 0;
    }

    async function loadUserWallet(telegramId) {
        try {
            const response = await fetch(`/api/games/user-wallet/${telegramId}`);
            const data = await response.json();
            if (data.success && data.wallet_address) {
                userWalletAddress = data.wallet_address;
                const walletEl = document.getElementById('userWalletAddress');
                if (walletEl) {
                    const shortAddr = userWalletAddress.substring(0, 6) + '...' + userWalletAddress.substring(userWalletAddress.length - 4);
                    walletEl.textContent = shortAddr;
                    walletEl.title = userWalletAddress;
                }
                return userWalletAddress;
            }
        } catch (error) {
            console.error('Error loading wallet:', error);
        }
        return null;
    }

    async function loadUserStats(telegramId) {
        try {
            const response = await fetch(`/api/games/user-stats/${telegramId}`);
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

    function updateProfileUI() {
        if (!telegramUser) return;
        
        const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
        const nameEl = document.getElementById('userFullName');
        if (nameEl) nameEl.textContent = fullName || 'Telegram User';
        
        const username = telegramUser.username || 'no_username';
        const usernameEl = document.getElementById('userUsername');
        if (usernameEl) usernameEl.textContent = '@' + username;
        
        const idEl = document.getElementById('userId');
        if (idEl) idEl.textContent = 'ID: ' + telegramUser.id;
        
        const avatarImg = document.getElementById('userAvatar');
        if (avatarImg) {
            if (telegramUser.photo_url) {
                avatarImg.src = telegramUser.photo_url;
            } else {
                const fullNameStr = fullName || 'User';
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullNameStr)}&background=6c5ce7&color=fff&size=100`;
            }
        }
    }

    // ==================== WITHDRAW FUNCTIONS ====================
    
    function showWithdrawModal() {
        console.log('🟡 showWithdrawModal called');
        const modal = document.getElementById('withdrawModal');
        if (!modal) {
            console.error('❌ withdrawModal not found!');
            return;
        }
        
        const withdrawForm = document.getElementById('withdrawForm');
        const withdrawProcessing = document.getElementById('withdrawProcessing');
        const withdrawSuccess = document.getElementById('withdrawSuccess');
        const withdrawError = document.getElementById('withdrawError');
        const walletWarning = document.getElementById('walletWarning');
        
        if (withdrawForm) withdrawForm.style.display = 'block';
        if (withdrawProcessing) withdrawProcessing.style.display = 'none';
        if (withdrawSuccess) withdrawSuccess.style.display = 'none';
        if (withdrawError) withdrawError.style.display = 'none';
        
        const amountInput = document.getElementById('withdrawAmount');
        if (amountInput) amountInput.value = '';
        
        if (telegramUser && telegramUser.id) {
            loadBalance(telegramUser.id);
            loadUserWallet(telegramUser.id).then(() => {
                if (!userWalletAddress) {
                    if (walletWarning) walletWarning.style.display = 'block';
                    if (withdrawForm) withdrawForm.style.display = 'none';
                } else {
                    if (walletWarning) walletWarning.style.display = 'none';
                    if (withdrawForm) withdrawForm.style.display = 'block';
                }
            });
        } else {
            if (walletWarning) walletWarning.style.display = 'block';
            if (withdrawForm) withdrawForm.style.display = 'none';
        }
        
        modal.style.display = 'flex';
        console.log('✅ Withdraw modal opened');
    }

    function closeWithdrawModal() {
        const modal = document.getElementById('withdrawModal');
        if (modal) modal.style.display = 'none';
        console.log('Withdraw modal closed');
    }

    function setMaxWithdraw() {
        console.log('🟡 setMaxWithdraw called, balance:', currentBalance);
        const amountInput = document.getElementById('withdrawAmount');
        if (amountInput && currentBalance > 0) {
            amountInput.value = currentBalance.toFixed(2);
        } else if (amountInput) {
            amountInput.value = '';
        }
    }

    async function processWithdraw() {
        console.log('🟡 processWithdraw called');
        
        const amountInput = document.getElementById('withdrawAmount');
        let amount = parseFloat(amountInput?.value || 0);
        
        if (isNaN(amount) || amount <= 0) {
            alert('Masukkan jumlah withdraw yang valid');
            return;
        }
        
        if (amount < 0.1) {
            alert('Minimum withdraw adalah 0.1 TON');
            return;
        }
        
        if (amount > currentBalance) {
            alert(`Saldo tidak cukup! Saldo Anda: ${currentBalance.toFixed(2)} TON`);
            return;
        }
        
        if (!userWalletAddress) {
            alert('Wallet TON belum terhubung. Silakan deposit terlebih dahulu untuk menghubungkan wallet.');
            return;
        }
        
        if (!telegramUser || !telegramUser.id) {
            alert('User tidak ditemukan');
            return;
        }
        
        const withdrawForm = document.getElementById('withdrawForm');
        const withdrawProcessing = document.getElementById('withdrawProcessing');
        if (withdrawForm) withdrawForm.style.display = 'none';
        if (withdrawProcessing) withdrawProcessing.style.display = 'block';
        
        const processBtn = document.getElementById('processWithdrawBtn');
        const originalText = processBtn?.innerHTML;
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
        
        try {
            const response = await fetch('/api/games/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramUser.id,
                    amount: amount,
                    wallet_address: userWalletAddress
                })
            });
            
            const data = await response.json();
            console.log('Withdraw response:', data);
            
            if (data.success) {
                if (withdrawProcessing) withdrawProcessing.style.display = 'none';
                const withdrawSuccess = document.getElementById('withdrawSuccess');
                const withdrawSuccessAmount = document.getElementById('withdrawSuccessAmount');
                const withdrawTxId = document.getElementById('withdrawTxId');
                
                if (withdrawSuccess) withdrawSuccess.style.display = 'block';
                if (withdrawSuccessAmount) withdrawSuccessAmount.textContent = amount.toFixed(2) + ' TON';
                if (withdrawTxId) withdrawTxId.textContent = data.transaction_id || 'WID-' + Date.now();
                
                await loadBalance(telegramUser.id);
                await loadUserWallet(telegramUser.id);
                
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
            } else {
                if (withdrawProcessing) withdrawProcessing.style.display = 'none';
                const withdrawError = document.getElementById('withdrawError');
                const withdrawErrorMessage = document.getElementById('withdrawErrorMessage');
                
                if (withdrawError) withdrawError.style.display = 'block';
                if (withdrawErrorMessage) withdrawErrorMessage.textContent = data.error || 'Withdraw gagal, silakan coba lagi';
                
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('error');
                }
            }
        } catch (error) {
            console.error('Withdraw error:', error);
            if (withdrawProcessing) withdrawProcessing.style.display = 'none';
            const withdrawError = document.getElementById('withdrawError');
            const withdrawErrorMessage = document.getElementById('withdrawErrorMessage');
            
            if (withdrawError) withdrawError.style.display = 'block';
            if (withdrawErrorMessage) withdrawErrorMessage.textContent = error.message || 'Terjadi kesalahan jaringan';
        } finally {
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = originalText;
            }
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
    }

    async function processDeposit(amount) {
        if (!amount || amount < 10000) {
            alert('Minimal deposit Rp 10.000');
            return;
        }
        
        if (!telegramUser || !telegramUser.id) {
            alert('User tidak ditemukan');
            return;
        }
        
        try {
            const response = await fetch('/api/games/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramUser.id,
                    amount: amount
                })
            });
            
            const data = await response.json();
            if (data.success) {
                alert(`Deposit Rp ${amount.toLocaleString()} berhasil!`);
                closeDepositModal();
                loadBalance(telegramUser.id);
                loadUserStats(telegramUser.id);
            } else {
                alert(data.error || 'Deposit gagal');
            }
        } catch (error) {
            console.error('Deposit error:', error);
            alert('Error processing deposit');
        }
    }

    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🟡 Initializing profile page...');
        
        telegramUser = await getTelegramUser();
        console.log('Telegram user:', telegramUser);
        
        if (telegramUser) {
            const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            await loadUserData(telegramUser.id, telegramUser.username || '', fullName || 'User');
            await loadBalance(telegramUser.id);
            await loadUserStats(telegramUser.id);
            await loadUserWallet(telegramUser.id);
        }
        
        // ========== EVENT LISTENERS ==========
        
        const depositBtn = document.getElementById('depositBtn');
        if (depositBtn) {
            depositBtn.addEventListener('click', showDepositModal);
            console.log('✅ Deposit button listener attached');
        }
        
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (withdrawBtn) {
            const newWithdrawBtn = withdrawBtn.cloneNode(true);
            withdrawBtn.parentNode.replaceChild(newWithdrawBtn, withdrawBtn);
            newWithdrawBtn.addEventListener('click', showWithdrawModal);
            console.log('✅ Withdraw button listener attached');
        } else {
            console.error('❌ withdrawBtn not found!');
        }
        
        const maxBtn = document.getElementById('maxWithdrawBtn');
        if (maxBtn) {
            const newMaxBtn = maxBtn.cloneNode(true);
            maxBtn.parentNode.replaceChild(newMaxBtn, maxBtn);
            newMaxBtn.addEventListener('click', setMaxWithdraw);
            console.log('✅ Max button listener attached');
        }
        
        const processWithdrawBtn = document.getElementById('processWithdrawBtn');
        if (processWithdrawBtn) {
            const newProcessBtn = processWithdrawBtn.cloneNode(true);
            processWithdrawBtn.parentNode.replaceChild(newProcessBtn, processWithdrawBtn);
            newProcessBtn.addEventListener('click', processWithdraw);
            console.log('✅ Process withdraw button listener attached');
        }
        
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeDepositModal);
        }
        
        const closeWithdrawBtn = document.querySelector('#withdrawModal .withdraw-close');
        if (closeWithdrawBtn) {
            closeWithdrawBtn.addEventListener('click', closeWithdrawModal);
        }
        
        window.addEventListener('click', (e) => {
            const depositModal = document.getElementById('depositModal');
            if (depositModal && e.target === depositModal) closeDepositModal();
            
            const withdrawModal = document.getElementById('withdrawModal');
            if (withdrawModal && e.target === withdrawModal) closeWithdrawModal();
        });
        
        const methodBtns = document.querySelectorAll('.method-btn');
        methodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                const customAmount = document.getElementById('customAmount');
                if (customAmount) customAmount.value = amount;
            });
        });
        
        const processBtn = document.getElementById('processDeposit');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                let amount = parseInt(document.getElementById('customAmount').value);
                if (isNaN(amount)) amount = 10000;
                processDeposit(amount);
            });
        }
        
        console.log('✅ Profile Page Ready with Withdraw Feature');
        console.log('Current balance:', currentBalance);
        console.log('Wallet address:', userWalletAddress);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    window.closeWithdrawModal = closeWithdrawModal;
})();
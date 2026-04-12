// games/js/profil.js - DENGAN FITUR WITHDRAW

(function() {
    console.log('👤 Profile Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let userData = null;
    let currentBalance = 0;
    let userWalletAddress = null;

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
            username: 'guest_user',
            photo_url: 'https://via.placeholder.com/100'
        };
    }

    // Fungsi format angka ribuan
    function formatNumberWithCommas(number) {
        let parts = Number(number).toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    // Load user data dari backend
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

    // Load wallet address user
    async function loadUserWallet(telegramId) {
        try {
            const response = await fetch(`/api/games/user-wallet/${telegramId}`);
            const data = await response.json();
            if (data.success && data.wallet_address) {
                userWalletAddress = data.wallet_address;
                const walletEl = document.getElementById('userWalletAddress');
                if (walletEl) {
                    // Tampilkan truncated version
                    const truncated = userWalletAddress.substring(0, 8) + '...' + userWalletAddress.substring(userWalletAddress.length - 6);
                    walletEl.textContent = truncated;
                    walletEl.setAttribute('data-full-address', userWalletAddress);
                    walletEl.title = 'Click to copy full address';
                }
                return userWalletAddress;
            }
        } catch (error) {
            console.error('Error loading wallet:', error);
        }
        return null;
    }

    // Load total gifts dan referral reward
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

    // Update UI Profile
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

    // Fungsi untuk copy full wallet address
    function copyFullWalletAddress() {
        const addressElement = document.getElementById('userWalletAddress');
        if (addressElement && addressElement.textContent && addressElement.textContent !== 'Belum terhubung') {
            // Ambil full address dari data attribute atau dari variabel global
            let fullAddress = userWalletAddress;
            
            if (!fullAddress) {
                // Fallback: coba ambil dari element
                fullAddress = addressElement.getAttribute('data-full-address') || addressElement.textContent;
            }
            
            if (fullAddress && fullAddress !== 'Belum terhubung') {
                navigator.clipboard.writeText(fullAddress).then(() => {
                    showToast('✅ Wallet address copied!', 'success');
                    if (tg.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                }).catch(() => {
                    showToast('❌ Failed to copy', 'error');
                });
            } else {
                showToast('No wallet address to copy', 'warning');
            }
        } else {
            showToast('Wallet not connected yet', 'warning');
        }
    }

    // ==================== WITHDRAW FUNCTIONS ====================
    function showWithdrawModal() {
        const modal = document.getElementById('withdrawModal');
        if (!modal) return;
        
        // Reset UI
        document.getElementById('withdrawForm').style.display = 'block';
        document.getElementById('withdrawProcessing').style.display = 'none';
        document.getElementById('withdrawSuccess').style.display = 'none';
        document.getElementById('withdrawError').style.display = 'none';
        
        // Reset input
        const amountInput = document.getElementById('withdrawAmount');
        if (amountInput) amountInput.value = '';
        
        // Load fresh balance
        if (telegramUser && telegramUser.id) {
            loadBalance(telegramUser.id);
            loadUserWallet(telegramUser.id);
        }
        
        // Cek apakah wallet terhubung
        if (!userWalletAddress) {
            document.getElementById('walletWarning').style.display = 'block';
            document.getElementById('withdrawForm').style.display = 'none';
        } else {
            document.getElementById('walletWarning').style.display = 'none';
            document.getElementById('withdrawForm').style.display = 'block';
            
            // 🔥 SET FULL ADDRESS KE ELEMENT
            const addressElement = document.getElementById('userWalletAddress');
            if (addressElement) {
                // Tampilkan truncated version untuk UI
                const truncated = userWalletAddress.substring(0, 8) + '...' + userWalletAddress.substring(userWalletAddress.length - 6);
                addressElement.textContent = truncated;
                // Simpan full address di data attribute
                addressElement.setAttribute('data-full-address', userWalletAddress);
                addressElement.title = 'Click to copy full address';
            }
        }
        
        modal.style.display = 'flex';
    }

    function closeWithdrawModal() {
        const modal = document.getElementById('withdrawModal');
        if (modal) modal.style.display = 'none';
    }

    function setMaxWithdraw() {
        const amountInput = document.getElementById('withdrawAmount');
        if (amountInput && currentBalance > 0) {
            amountInput.value = currentBalance.toFixed(2);
        }
    }

    async function processWithdraw() {
        const amountInput = document.getElementById('withdrawAmount');
        let amount = parseFloat(amountInput.value);
        
        // Validasi
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
        
        // Konfirmasi user
        if (!confirm(`Anda akan melakukan withdraw ${amount.toFixed(2)} TON ke wallet:\n${userWalletAddress.substring(0, 8)}...${userWalletAddress.substring(userWalletAddress.length - 6)}\n\nLanjutkan?`)) {
            return;
        }
        
        // Show processing state
        document.getElementById('withdrawForm').style.display = 'none';
        document.getElementById('withdrawProcessing').style.display = 'block';
        
        const processBtn = document.getElementById('processWithdrawBtn');
        const originalText = processBtn?.innerHTML;
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
        
        try {
            // 🔥 PANGGIL ENDPOINT WITHDRAW REAL
            const response = await fetch('/api/games/withdraw-real', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramUser.id,
                    amount: amount,
                    wallet_address: userWalletAddress
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('withdrawProcessing').style.display = 'none';
                document.getElementById('withdrawSuccess').style.display = 'block';
                document.getElementById('withdrawSuccessAmount').textContent = amount.toFixed(2) + ' TON';
                document.getElementById('withdrawTxId').textContent = data.transaction_hash || 'TX-' + Date.now();
                
                // Refresh balance
                await loadBalance(telegramUser.id);
                
                // Haptic feedback
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
                
            } else {
                document.getElementById('withdrawProcessing').style.display = 'none';
                document.getElementById('withdrawError').style.display = 'block';
                document.getElementById('withdrawErrorMessage').textContent = data.error || 'Withdraw gagal, silakan coba lagi';
                
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('error');
                }
            }
        } catch (error) {
            console.error('Withdraw error:', error);
            document.getElementById('withdrawProcessing').style.display = 'none';
            document.getElementById('withdrawError').style.display = 'block';
            document.getElementById('withdrawErrorMessage').textContent = error.message || 'Terjadi kesalahan jaringan';
        } finally {
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = originalText;
            }
        }
    }
    
    // 🔥 Fungsi untuk mengirim notifikasi ke Telegram (opsional)
    async function sendWithdrawNotification(telegramId, amount, walletAddress) {
        try {
            await fetch('/api/notify-withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    amount: amount,
                    wallet_address: walletAddress
                })
            });
        } catch (e) {
            console.error('Error sending notification:', e);
        }
    }

    // ==================== HISTORY FUNCTIONS (tetap ada untuk keperluan lain) ====================
    
    async function loadUserGameHistory(telegramId) {
        try {
            const response = await fetch(`/api/games/user-history/${telegramId}`);
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
                        <td>${game.bet_amount.toLocaleString()}</td>
                        <td>${game.multiplier}x</td>
                        <td class="${winClass}">${game.win_amount.toLocaleString()}</td>
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
        telegramUser = await getTelegramUser();
        
        if (telegramUser) {
            const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            await loadUserData(telegramUser.id, telegramUser.username || '', fullName || 'User');
            await loadBalance(telegramUser.id);
            await loadUserStats(telegramUser.id);
            await loadUserWallet(telegramUser.id);
        }
        
        // Event listeners - DEPOSIT
        const depositBtn = document.getElementById('depositBtn');
        if (depositBtn) depositBtn.addEventListener('click', showDepositModal);
        
        // Event listeners - WITHDRAW
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (withdrawBtn) withdrawBtn.addEventListener('click', showWithdrawModal);
        
        const maxBtn = document.getElementById('maxWithdrawBtn');
        if (maxBtn) maxBtn.addEventListener('click', setMaxWithdraw);
        
        const processWithdrawBtn = document.getElementById('processWithdrawBtn');
        if (processWithdrawBtn) processWithdrawBtn.addEventListener('click', processWithdraw);
        
        // History button (opsional, bisa dihapus atau tetap)
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) historyBtn.addEventListener('click', toggleHistory);
        
        const closeHistoryBtn = document.getElementById('closeHistoryBtn');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => {
                const historySection = document.getElementById('historySection');
                if (historySection) historySection.style.display = 'none';
            });
        }
        
        // Modal close handlers
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDepositModal);
        
        const closeWithdrawBtn = document.querySelector('#withdrawModal .withdraw-close');
        if (closeWithdrawBtn) closeWithdrawBtn.addEventListener('click', closeWithdrawModal);
        
        window.addEventListener('click', (e) => {
            const depositModal = document.getElementById('depositModal');
            if (depositModal && e.target === depositModal) closeDepositModal();
            
            const withdrawModal = document.getElementById('withdrawModal');
            if (withdrawModal && e.target === withdrawModal) closeWithdrawModal();
        });
        
        // Deposit method buttons
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
    }
    
    init();
    
    // Expose global functions
    window.closeWithdrawModal = closeWithdrawModal;
    window.copyFullWalletAddress = copyFullWalletAddress;
})();
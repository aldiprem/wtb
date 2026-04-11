// games/js/profil.js

(function() {
    console.log('👤 Profile Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let userData = null;

    // Ambil data user dari Telegram
    async function getTelegramUser() {
        const initDataUnsafe = tg.initDataUnsafe || {};
        if (initDataUnsafe.user) {
            return initDataUnsafe.user;
        }
        // Fallback untuk testing di browser
        return {
            id: 123456789,
            first_name: 'Guest',
            last_name: 'User',
            username: 'guest_user',
            photo_url: 'https://via.placeholder.com/100'
        };
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

    // Load balance terpisah (lebih akurat)
    async function loadBalance(telegramId) {
        try {
            const response = await fetch(`/api/games/balance/${telegramId}`);
            const data = await response.json();
            if (data.success) {
                const balanceEl = document.getElementById('userBalance');
                const profileBalanceEl = document.getElementById('profileBalance');
                if (balanceEl) balanceEl.textContent = data.balance.toLocaleString('id-ID');
                if (profileBalanceEl) profileBalanceEl.textContent = data.balance.toLocaleString('id-ID');
                return data.balance;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
        return 0;
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

    // Load riwayat game user
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

    // Update UI Profile
    function updateProfileUI() {
        if (!telegramUser) return;
        
        // Nama lengkap
        const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
        const nameEl = document.getElementById('userFullName');
        if (nameEl) nameEl.textContent = fullName || 'Telegram User';
        
        // Username
        const username = telegramUser.username || 'no_username';
        const usernameEl = document.getElementById('userUsername');
        if (usernameEl) usernameEl.textContent = '@' + username;
        
        // ID
        const idEl = document.getElementById('userId');
        if (idEl) idEl.textContent = 'ID: ' + telegramUser.id;
        
        // Foto profil
        const avatarImg = document.getElementById('userAvatar');
        if (avatarImg) {
            if (telegramUser.photo_url) {
                avatarImg.src = telegramUser.photo_url;
            } else {
                // Generate avatar dari inisial
                const fullNameStr = fullName || 'User';
                const initial = fullNameStr.charAt(0).toUpperCase();
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullNameStr)}&background=6c5ce7&color=fff&size=100`;
            }
        }
    }

    // Toggle history section
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

    // Show deposit modal
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'flex';
    }

    // Close modal
    function closeModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
    }

    // Process deposit
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
                closeModal();
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

    // Initialize
    async function init() {
        telegramUser = await getTelegramUser();
        
        if (telegramUser) {
            const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            await loadUserData(telegramUser.id, telegramUser.username || '', fullName || 'User');
            await loadBalance(telegramUser.id);
            await loadUserStats(telegramUser.id);
        }
        
        // Event listeners dengan pengecekan element exist
        const depositBtn = document.getElementById('depositBtn');
        if (depositBtn) depositBtn.addEventListener('click', showDepositModal);
        
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) historyBtn.addEventListener('click', toggleHistory);
        
        const closeHistoryBtn = document.getElementById('closeHistoryBtn');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => {
                const historySection = document.getElementById('historySection');
                if (historySection) historySection.style.display = 'none';
            });
        }
        
        // Modal close
        const closeModalBtn = document.querySelector('.close-modal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('depositModal');
            if (modal && e.target === modal) closeModal();
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
        
        console.log('✅ Profile Page Ready');
    }
    
    init();
})();
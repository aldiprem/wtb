// games/js/games.js

document.addEventListener("DOMContentLoaded", () => {
    
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    const initDataUnsafe = tg.initDataUnsafe || {};
    const user = initDataUnsafe.user;

    let currentUser = user;

    async function loadUserBalance(telegramId, username, firstName) {
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
            const balanceEl = document.getElementById('userBalance');
            if (data.success && balanceEl) {
                balanceEl.textContent = data.balance.toLocaleString('id-ID');
                return data.balance;
            } else if (balanceEl) {
                balanceEl.textContent = "0";
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = "0";
        }
        return 0;
    }

    function redirectToPage(url) {
        if (url && url !== '') {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
            setTimeout(() => {
                window.location.href = url;
            }, 50);
            return true;
        }
        return false;
    }

    // Deposit functions
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
    }

    async function processDeposit(amount) {
        if (!amount || amount < 10000) {
            alert('Minimal deposit Rp 10.000');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            alert('User tidak ditemukan');
            return;
        }
        
        try {
            const response = await fetch('/api/games/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: currentUser.id,
                    amount: amount
                })
            });
            
            const data = await response.json();
            if (data.success) {
                alert(`Deposit Rp ${amount.toLocaleString()} berhasil!`);
                closeModal();
                const fullName = (currentUser.first_name || '') + (currentUser.last_name ? ' ' + currentUser.last_name : '');
                loadUserBalance(currentUser.id, currentUser.username || '', fullName);
            } else {
                alert(data.error || 'Deposit gagal');
            }
        } catch (error) {
            console.error('Deposit error:', error);
            alert('Error processing deposit');
        }
    }

    if (user) {
        currentUser = user;
        const fullName = (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '');
        loadUserBalance(user.id, user.username || '', fullName);
    } else {
        const balanceEl = document.getElementById("userBalance");
        if (balanceEl) balanceEl.textContent = "0";
    }

    // Setup deposit button di header
    const headerDepositBtn = document.getElementById('headerDepositBtn');
    if (headerDepositBtn) {
        headerDepositBtn.addEventListener('click', showDepositModal);
    }

    // Setup modal close
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

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

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const redirectUrl = this.getAttribute('data-url');
            
            if (redirectUrl && redirectUrl !== '') {
                redirectToPage(redirectUrl);
                return;
            }
            
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    });
});
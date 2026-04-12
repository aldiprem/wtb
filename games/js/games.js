// games/js/games.js - Untuk halaman games.html (bukan profil.js)

(function() {
    console.log('🎮 Games Page Initialized');

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    let telegramUser = null;
    let currentBalance = 0;

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

    // ==================== NAVIGATION FUNCTIONS ====================
    
    function switchTab(targetId, url) {
        // Jika ada URL, redirect
        if (url && url !== '') {
            window.location.href = url;
            return;
        }
        
        // Jika tidak ada URL, switch tab
        if (targetId) {
            // Sembunyikan semua tab
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Tampilkan tab yang dipilih
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            // Update active state pada nav items
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

    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🟡 Initializing games page...');
        
        // Get Telegram user
        telegramUser = await getTelegramUser();
        console.log('Telegram user:', telegramUser);
        
        if (telegramUser && telegramUser.id) {
            const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            await authUser(telegramUser.id, telegramUser.username || '', fullName || 'User');
            await loadBalance(telegramUser.id);
        }
        
        // ========== EVENT LISTENERS FOR NAVIGATION ==========
        
        // Ambil semua tombol navigasi
        const navItems = document.querySelectorAll('.nav-item');
        console.log(`Found ${navItems.length} nav items`);
        
        navItems.forEach((item, index) => {
            // Hapus event listener lama dengan clone
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
        
        // ========== MODAL CLOSE HANDLERS ==========
        const closeModalBtn = document.querySelector('#depositModal .close-modal');
        if (closeModalBtn) {
            const newCloseBtn = closeModalBtn.cloneNode(true);
            closeModalBtn.parentNode.replaceChild(newCloseBtn, closeModalBtn);
            newCloseBtn.addEventListener('click', closeDepositModal);
        }
        
        // Klik di luar modal
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('depositModal');
            if (modal && e.target === modal) {
                closeDepositModal();
            }
        });
        
        // ========== TOMBOL DEPOSIT DI MODAL ==========
        const sendDepositBtn = document.getElementById('sendDepositBtn');
        if (sendDepositBtn) {
            sendDepositBtn.addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('tonAmount')?.value || 0);
                if (amount < 0.1) {
                    alert('Minimal deposit 0.1 TON');
                    return;
                }
                alert(`Fitur deposit TON akan segera hadir.\nJumlah: ${amount} TON`);
            });
        }
        
        console.log('✅ Games Page Ready');
        console.log('Current balance:', currentBalance);
    }
    
    // Jalankan init setelah DOM ready
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
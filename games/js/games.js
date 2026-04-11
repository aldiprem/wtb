// games/js/games.js

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inisialisasi Telegram Web App SDK
    const tg = window.Telegram.WebApp;
    tg.expand(); // Memperluas tampilan mini app menjadi full height
    tg.setHeaderColor('#0f0f0f'); // Set warna header telegram menyesuaikan tema

    // 2. Auth & Pengambilan Data User Telegram
    const initDataUnsafe = tg.initDataUnsafe || {};
    const user = initDataUnsafe.user;

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
            if (data.success) {
                const balanceEl = document.getElementById('userBalance');
                if (balanceEl) {
                    balanceEl.textContent = data.balance.toLocaleString('id-ID');
                }
                return data.balance;
            } else {
                const balanceEl = document.getElementById('userBalance');
                if (balanceEl) balanceEl.textContent = "Error";
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = "Error";
        }
        return 0;
    }

    // Fungsi untuk redirect ke halaman external
    function redirectToPage(url) {
        if (url && url !== '') {
            // Animasi haptic feedback dulu
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
            // Redirect setelah sedikit delay biar haptic keburu
            setTimeout(() => {
                window.location.href = url;
            }, 50);
            return true;
        }
        return false;
    }

    if (user) {
        // Jika dibuka via Telegram, daftarkan/tarik data user
        const fullName = user.first_name + (user.last_name ? " " + user.last_name : "");
        loadUserBalance(user.id, user.username || '', fullName);
    } else {
        // Mode browser (fallback tanpa Telegram)
        console.log("Dibuka di luar Telegram App. Menjalankan Mode Guest.");
        const balanceEl = document.getElementById("userBalance");
        if (balanceEl) balanceEl.textContent = "0";
    }

    // 3. Logika Pagination / Bottom Navigation dengan redirect jika perlu
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const redirectUrl = this.getAttribute('data-url');
            
            // Cek apakah tombol ini punya URL redirect
            if (redirectUrl && redirectUrl !== '') {
                // Redirect ke halaman yang dituju (misal /profile)
                redirectToPage(redirectUrl);
                return;
            }
            
            // Jika tidak punya redirect URL, maka behave seperti tab biasa
            // Hapus kelas aktif dari semua tombol nav
            navItems.forEach(nav => nav.classList.remove('active'));
            // Tambahkan kelas aktif ke tombol yang diklik
            this.classList.add('active');

            // Sembunyikan semua tab konten
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Tampilkan tab yang dituju
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            // Haptic Feedback (Getaran ringan) untuk Telegram
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    });
});
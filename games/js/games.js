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
                document.getElementById('userBalance').textContent = data.balance.toLocaleString('id-ID');
                return data.balance;
            } else {
                document.getElementById('userBalance').textContent = "Error";
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            document.getElementById('userBalance').textContent = "Error";
        }
        return 0;
    }

    if (user) {
        // Jika dibuka via Telegram, daftarkan/tarik data user
        const fullName = user.first_name + (user.last_name ? " " + user.last_name : "");
        loadUserBalance(user.id, user.username || '', fullName);
    } else {
        // Mode browser (fallback tanpa Telegram)
        console.log("Dibuka di luar Telegram App. Menjalankan Mode Guest.");
        document.getElementById("userBalance").textContent = "1.500";
    }

    // 3. Logika Pagination / Bottom Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Hapus kelas aktif dari semua tombol nav
            navItems.forEach(nav => nav.classList.remove('active'));
            // Tambahkan kelas aktif ke tombol yang diklik
            this.classList.add('active');

            // Ambil target tab
            const targetId = this.getAttribute('data-target');

            // Sembunyikan semua tab konten
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Tampilkan tab yang dituju
            document.getElementById(targetId).classList.add('active');

            // Haptic Feedback (Getaran ringan) untuk Telegram
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    });

});
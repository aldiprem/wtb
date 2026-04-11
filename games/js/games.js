// games/js/games.js

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inisialisasi Telegram Web App SDK
    const tg = window.Telegram.WebApp;
    tg.expand(); // Memperluas tampilan mini app menjadi full height
    
    // Set warna header telegram menyesuaikan tema
    tg.setHeaderColor('#0f0f0f'); 

    // 2. Auth & Pengambilan Data User Telegram
    const initDataUnsafe = tg.initDataUnsafe || {};
    const user = initDataUnsafe.user;

    if (user) {
        // Tampilkan data user ke Header
        document.getElementById("userName").textContent = user.first_name + (user.last_name ? " " + user.last_name : "");
        document.getElementById("userId").textContent = user.username ? "@" + user.username : "ID: " + user.id;
        
        // Coba load avatar (Jika disediakan oleh API bot, karena Telegram SDK membatasi direct image kadang-kadang)
        if (user.photo_url) {
            document.getElementById("userAvatar").src = user.photo_url;
        }

        // Anda bisa melakukan AJAX/Fetch ke server backend (games_service.py) disini
        // untuk mendaftarkan user dan mengambil Balance Asli dari Database.
        console.log("User terautentikasi:", user);
    } else {
        // Fallback jika dibuka di browser biasa (bukan Telegram)
        console.log("Dibuka di luar Telegram App");
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
            document.getElementById('userBalance').textContent = data.balance.toLocaleString();
            return data.balance;
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
    return 1500;
}

// Panggil di dalam init setelah dapat user
if (user) {
    await loadUserBalance(user.id, user.username || '', user.first_name || '');
}
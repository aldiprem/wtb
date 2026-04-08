// games/js/games.js
// Mencegah reload saat scroll ke atas
let lastScrollTop = 0;
const scrollContainer = document.getElementById('scrollContainer');

if (scrollContainer) {
    scrollContainer.addEventListener('scroll', function(e) {
        const scrollTop = this.scrollTop;
        
        // Mencegah pull-to-refresh di mobile
        if (scrollTop < 0) {
            e.preventDefault();
            this.scrollTop = 0;
        }
        
        lastScrollTop = scrollTop;
    }, { passive: false });
}

// Mencegah refresh browser pada scroll desktop
window.addEventListener('wheel', function(e) {
    if (scrollContainer && scrollContainer.scrollTop === 0 && e.deltaY < 0) {
        e.preventDefault();
        return false;
    }
}, { passive: false });

// Handle touch events untuk mobile
if (scrollContainer) {
    scrollContainer.addEventListener('touchstart', function(e) {
        this.startY = e.touches[0].clientY;
    });

    scrollContainer.addEventListener('touchmove', function(e) {
        const currentY = e.touches[0].clientY;
        const scrollTop = this.scrollTop;
        
        if (scrollTop === 0 && currentY > this.startY) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });
}

// ==================== TELEGRAM WEB APP INTEGRATION ====================
let telegramUser = null;
let tg = null;

// Fungsi untuk generate avatar URL
function generateAvatarUrl(name) {
    if (!name) return 'https://ui-avatars.com/api/?name=G&size=120&background=FFD700&color=000';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0).toUpperCase())}&size=120&background=FFD700&color=000`;
}

// Fungsi untuk apply Telegram theme
function applyTelegramTheme(telegramWebApp) {
    if (!telegramWebApp || !telegramWebApp.themeParams) return;
    
    try {
        const theme = telegramWebApp.themeParams;
        console.log('🎨 Applying Telegram theme');
        
        if (theme.bg_color) {
            document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color);
            document.body.style.backgroundColor = theme.bg_color;
        }
        if (theme.text_color) {
            document.documentElement.style.setProperty('--tg-text-color', theme.text_color);
        }
        if (theme.hint_color) {
            document.documentElement.style.setProperty('--tg-hint-color', theme.hint_color);
        }
        if (theme.link_color) {
            document.documentElement.style.setProperty('--tg-link-color', theme.link_color);
        }
        if (theme.button_color) {
            document.documentElement.style.setProperty('--tg-button-color', theme.button_color);
        }
        if (theme.button_text_color) {
            document.documentElement.style.setProperty('--tg-button-text-color', theme.button_text_color);
        }
    } catch (themeError) {
        console.warn('⚠️ Error applying Telegram theme:', themeError);
    }
}

// Fungsi untuk mendapatkan data Telegram user
async function getTelegramUser() {
    return new Promise((resolve) => {
        // Cek environment Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            console.log('📱 Running inside Telegram Web App');
            tg = window.Telegram.WebApp;
            
            // Expand WebApp ke full screen
            tg.expand();
            tg.ready();
            
            // Ambil data user dari initDataUnsafe
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const user = tg.initDataUnsafe.user;
                console.log('📱 Telegram user data:', user);
                resolve(user);
            } else {
                console.warn('⚠️ No user data in Telegram WebApp');
                resolve(null);
            }
            
            // Apply theme
            applyTelegramTheme(tg);
        } else {
            console.log('🌐 Running in standalone web browser');
            
            // Untuk testing di browser (gunakan data dummy)
            const dummyUser = {
                id: 7998861975,
                first_name: 'Owner',
                last_name: '',
                username: 'barack_gift',
                language_code: 'id',
                photo_url: null
            };
            resolve(dummyUser);
        }
    });
}

// Fungsi untuk update UI dengan data user
function updateUserUI(user) {
    if (!user) {
        console.warn('⚠️ No user data to display');
        const userNameSpan = document.getElementById('userName');
        if (userNameSpan) userNameSpan.textContent = 'Guest User';
        return;
    }
    
    telegramUser = user;
    
    // Format nama lengkap
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
    const username = user.username ? `@${user.username}` : '';
    const userId = user.id || '-';
    
    console.log('👤 User info:', { fullName, username, userId });
    
    // Update elemen UI
    const userNameSpan = document.getElementById('userName');
    const userAvatarImg = document.getElementById('userAvatar');
    
    if (userNameSpan) {
        // Tampilkan nama dengan username jika ada
        if (username) {
            userNameSpan.textContent = `${fullName} ${username}`;
        } else {
            userNameSpan.textContent = fullName;
        }
    }
    
    if (userAvatarImg) {
        // Gunakan photo_url jika tersedia, atau generate avatar
        const avatarUrl = user.photo_url || generateAvatarUrl(fullName);
        userAvatarImg.src = avatarUrl;
        userAvatarImg.alt = fullName;
    }
    
    // Simpan data user ke window untuk akses global
    window.telegramUser = user;
    
    // Trigger event user loaded
    const event = new CustomEvent('telegramUserLoaded', { detail: user });
    window.dispatchEvent(event);
}

// Fungsi untuk mendapatkan data user lengkap (untuk digunakan di halaman lain)
function getTelegramUserData() {
    return telegramUser;
}

// ==================== PAGINATION NAVIGATION ====================
class PageManager {
    constructor() {
        this.currentPage = null;
        this.userData = null;
        this.init();
    }
    
    async init() {
        this.bindEvents();
        await this.loadTelegramUser();
    }
    
    bindEvents() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });
    }
    
    switchPage(page) {
        // Update active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        this.currentPage = page;
        this.loadPageContent(page);
    }
    
    loadPageContent(page) {
        const contentWrapper = document.getElementById('contentWrapper');
        
        // Tampilkan loading
        contentWrapper.innerHTML = `
            <div class="content-placeholder">
                <div class="loading-spinner"></div>
                <p>Memuat ${page}...</p>
            </div>
        `;
        
        // Simulasi loading (nanti diganti dengan API call)
        setTimeout(() => {
            let content = '';
            
            switch(page) {
                case 'games':
                    content = this.getGamesContent();
                    break;
                case 'market':
                    content = this.getMarketContent();
                    break;
                case 'profile':
                    content = this.getProfileContent();
                    break;
                default:
                    content = this.getDefaultContent();
            }
            
            contentWrapper.innerHTML = content;
        }, 500);
    }
    
    getGamesContent() {
        return `
            <div class="glass-card">
                <h3>🎮 Games</h3>
                <p>Konten Games akan segera hadir!</p>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.7;">
                    Fitur games sedang dalam pengembangan
                </p>
            </div>
        `;
    }
    
    getMarketContent() {
        return `
            <div class="glass-card">
                <h3>🛒 Market</h3>
                <p>Konten Market akan segera hadir!</p>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.7;">
                    Fitur market sedang dalam pengembangan
                </p>
            </div>
        `;
    }
    
    getProfileContent() {
        // Tampilkan data user yang sudah di-load
        const user = telegramUser || window.telegramUser;
        
        if (!user) {
            return `
                <div class="glass-card">
                    <h3>👤 Profil</h3>
                    <p>Memuat data profil...</p>
                </div>
            `;
        }
        
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        const username = user.username ? `@${user.username}` : '(tidak ada username)';
        const userId = user.id || '-';
        const language = user.language_code || 'id';
        const photoUrl = user.photo_url || generateAvatarUrl(fullName);
        
        return `
            <div class="glass-card">
                <h3>👤 Profil Saya</h3>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${photoUrl}" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); margin-bottom: 10px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="opacity: 0.7; font-size: 12px;">Nama Lengkap</label>
                    <p style="font-size: 16px; font-weight: 500;">${this.escapeHtml(fullName)}</p>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="opacity: 0.7; font-size: 12px;">Username</label>
                    <p style="font-size: 16px; font-weight: 500;">${this.escapeHtml(username)}</p>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="opacity: 0.7; font-size: 12px;">User ID</label>
                    <p style="font-size: 14px; font-family: monospace;">${this.escapeHtml(userId)}</p>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="opacity: 0.7; font-size: 12px;">Bahasa</label>
                    <p style="font-size: 14px;">${this.escapeHtml(language.toUpperCase())}</p>
                </div>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
                <p style="font-size: 12px; opacity: 0.6; text-align: center;">
                    Terverifikasi melalui Telegram
                </p>
            </div>
        `;
    }
    
    getDefaultContent() {
        const user = telegramUser || window.telegramUser;
        const firstName = user?.first_name || 'Pengunjung';
        
        return `
            <div class="glass-card">
                <h2>✨ Selamat Datang, ${this.escapeHtml(firstName)}!</h2>
                <p>Selamat datang di Barack Gift</p>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
                    ⚡ Siap memberikan pengalaman terbaik untuk Anda
                </p>
            </div>
        `;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async loadTelegramUser() {
        try {
            const userData = await getTelegramUser();
            if (userData) {
                updateUserUI(userData);
                this.userData = userData;
                console.log('✅ Telegram user loaded successfully:', userData);
            } else {
                console.warn('⚠️ No Telegram user data available');
                const userNameSpan = document.getElementById('userName');
                if (userNameSpan) userNameSpan.textContent = 'Guest User';
            }
        } catch (error) {
            console.error('❌ Error loading Telegram user:', error);
            const userNameSpan = document.getElementById('userName');
            if (userNameSpan) userNameSpan.textContent = 'Error loading user';
        }
    }
}

// Tambahkan CSS untuk loading spinner dan animasi
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        width: 40px;
        height: 40px;
        margin: 20px auto;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .glass-card {
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Styling untuk header user */
    .telegram-user {
        cursor: pointer;
    }
    
    .user-avatar {
        object-fit: cover;
    }
`;

document.head.appendChild(style);

// Ekspose fungsi global untuk digunakan di tempat lain
window.getTelegramUser = getTelegramUser;
window.getTelegramUserData = getTelegramUserData;
window.telegramUser = null;

// Initialize Page Manager ketika DOM sudah loaded
document.addEventListener('DOMContentLoaded', () => {
    const pageManager = new PageManager();
});
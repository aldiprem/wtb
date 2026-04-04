// ==================== Products Data ====================
const productsDataMobile = {
    games: {
        title: "🔥 Popular Games",
        subtitle: "Topup dengan harga terbaik",
        products: [
            { id: 1, category: "mlbb", name: "5 Diamonds + Bonus", desc: "Mobile Legends", price: 1500, originalPrice: 2000, icon: "fas fa-dragon" },
            { id: 2, category: "mlbb", name: "50 Diamonds", desc: "Mobile Legends", price: 14000, originalPrice: 18000, icon: "fas fa-dragon" },
            { id: 3, category: "mlbb", name: "100 Diamonds", desc: "Mobile Legends", price: 27000, originalPrice: 35000, icon: "fas fa-dragon" },
            { id: 4, category: "ff", name: "10 Diamonds", desc: "Free Fire", price: 1800, originalPrice: 2500, icon: "fas fa-fire" },
            { id: 5, category: "ff", name: "50 Diamonds", desc: "Free Fire", price: 8500, originalPrice: 12000, icon: "fas fa-fire" },
            { id: 6, category: "genshin", name: "60 Genesis Crystals", desc: "Genshin Impact", price: 12000, originalPrice: 16000, icon: "fas fa-star" },
            { id: 7, category: "valorant", name: "100 VP", desc: "Valorant", price: 18000, originalPrice: 25000, icon: "fas fa-crosshairs" },
            { id: 8, category: "pubg", name: "60 UC", desc: "PUBG Mobile", price: 14000, originalPrice: 18000, icon: "fas fa-helmet-battle" },
            { id: 9, category: "spotify", name: "Spotify Premium 1 Bulan", desc: "Individual Plan", price: 25000, originalPrice: 55000, icon: "fab fa-spotify" }
        ]
    },
    premium: {
        title: "👑 Premium Apps",
        subtitle: "Berlangganan aplikasi premium",
        products: [
            { id: 10, category: "spotify", name: "Spotify Premium 1 Bulan", desc: "Individual Plan", price: 25000, originalPrice: 55000, icon: "fab fa-spotify" },
            { id: 11, category: "netflix", name: "Netflix Basic 1 Bulan", desc: "Mobile/TV", price: 45000, originalPrice: 120000, icon: "fab fa-netflix" },
            { id: 12, category: "canva", name: "Canva Pro 1 Bulan", desc: "Premium Features", price: 35000, originalPrice: 80000, icon: "fab fa-canva" }
        ]
    },
    reseller: {
        title: "💎 Reseller Package",
        subtitle: "Harga khusus untuk reseller",
        products: [
            { id: 13, name: "Starter Pack Reseller", desc: "Akses semua produk + margin 5%", price: 500000, originalPrice: 1000000, icon: "fas fa-rocket" },
            { id: 14, name: "Pro Pack Reseller", desc: "Akses semua produk + margin 10%", price: 1000000, originalPrice: 2000000, icon: "fas fa-crown" }
        ]
    }
};

function formatPriceMobile(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function showMobileNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'mobile-toast';
    notification.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'mobileSlideDown 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

function renderMobileProducts(category) {
    const grid = document.getElementById('mobileProductsGrid');
    const titleEl = document.getElementById('mobileSectionTitle');
    const subtitleEl = document.getElementById('mobileSectionSubtitle');
    
    let data = productsDataMobile[category] || productsDataMobile.games;
    
    titleEl.textContent = data.title;
    subtitleEl.textContent = data.subtitle;
    
    grid.innerHTML = '<div class="mobile-loading"><i class="fas fa-spinner"></i><p>Memuat...</p></div>';
    
    setTimeout(() => {
        if (!data.products || data.products.length === 0) {
            grid.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-box-open" style="font-size: 40px; color: #00d4ff;"></i><p style="margin-top: 12px;">Belum ada produk</p></div>';
            return;
        }
        
        grid.innerHTML = data.products.map(product => `
            <div class="mobile-product-card">
                <div class="mobile-product-icon">
                    <i class="${product.icon}"></i>
                </div>
                <div class="mobile-product-info">
                    <h3 class="mobile-product-title">${product.name}</h3>
                    <p class="mobile-product-desc">${product.desc}</p>
                    <div class="mobile-product-price">
                        <span class="mobile-price-original">Rp ${formatPriceMobile(product.originalPrice)}</span>
                        <span class="mobile-price-current">Rp ${formatPriceMobile(product.price)}</span>
                    </div>
                </div>
                <button class="mobile-btn-topup" onclick="handleMobileTopup(${product.id}, '${product.name}', ${product.price})">
                    <i class="fas fa-shopping-cart"></i> Beli
                </button>
            </div>
        `).join('');
    }, 200);
}

function handleMobileTopup(id, name, price) {
    showMobileNotification(`✅ ${name} - Rp ${formatPriceMobile(price)} ditambahkan!`);
    console.log(`Topup: ${id} - ${name} - Rp ${price}`);
}

// ==================== Theme System ====================
let currentThemeMobile = localStorage.getItem('mobileTheme') || 'dark';

function applyMobileTheme(theme) {
    const root = document.documentElement;
    const body = document.body;
    const themeBtn = document.getElementById('themeToggleBtnMobile');
    
    if (theme === 'light') {
        root.style.setProperty('--bg-gradient-start', '#f0f2f5');
        root.style.setProperty('--bg-gradient-mid', '#e8eaef');
        root.style.setProperty('--bg-gradient-end', '#e0e4e9');
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#2d2d44');
        body.style.color = '#1a1a2e';
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        body.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
        root.style.setProperty('--bg-gradient-start', '#0a0a0f');
        root.style.setProperty('--bg-gradient-mid', '#0d1117');
        root.style.setProperty('--bg-gradient-end', '#0a0e1a');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a0b0c0');
        body.style.color = '#ffffff';
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
        body.setAttribute('data-theme', 'dark');
    } else if (theme === 'system') {
        const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
        applyMobileTheme(darkMode.matches ? 'dark' : 'light');
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        return;
    }
    
    localStorage.setItem('mobileTheme', theme);
    
    document.querySelectorAll('.mobile-theme-option').forEach(opt => {
        if (opt.dataset.theme === theme) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
}

// ==================== Navigation ====================
function updateMobileActiveNav(page) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.mobile-menu-link').forEach(link => {
        if (link.dataset.page === page) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ==================== Sidebar ====================
const mobileSidebar = document.getElementById('mobileSidebar');
const mobileOverlay = document.getElementById('mobileOverlay');
const menuToggle = document.getElementById('menuToggleMobile');
const sidebarClose = document.getElementById('sidebarCloseMobile');

function openMobileSidebar() {
    mobileSidebar.classList.add('open');
    mobileOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    mobileSidebar.classList.remove('open');
    mobileOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

if (menuToggle) menuToggle.addEventListener('click', openMobileSidebar);
if (sidebarClose) sidebarClose.addEventListener('click', closeMobileSidebar);
if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileSidebar);

// ==================== Event Listeners ====================
document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        updateMobileActiveNav(page);
        renderMobileProducts(page);
    });
});

document.querySelectorAll('.mobile-menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        updateMobileActiveNav(page);
        renderMobileProducts(page);
        closeMobileSidebar();
    });
});

document.querySelectorAll('.mobile-category-card').forEach(card => {
    card.addEventListener('click', () => {
        const cat = card.dataset.cat;
        showMobileNotification(`Menampilkan produk ${card.querySelector('h3').textContent}`);
        document.getElementById('mobileProductsGrid').scrollIntoView({ behavior: 'smooth' });
    });
});

// Theme
const themeToggleMobile = document.getElementById('themeToggleBtnMobile');
if (themeToggleMobile) {
    themeToggleMobile.addEventListener('click', () => {
        if (currentThemeMobile === 'light') {
            currentThemeMobile = 'dark';
            applyMobileTheme('dark');
        } else if (currentThemeMobile === 'dark') {
            currentThemeMobile = 'system';
            applyMobileTheme('system');
        } else {
            currentThemeMobile = 'light';
            applyMobileTheme('light');
        }
    });
}

document.querySelectorAll('.mobile-theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
        currentThemeMobile = opt.dataset.theme;
        applyMobileTheme(currentThemeMobile);
    });
});

// Login/Register
document.getElementById('mobileLoginBtn')?.addEventListener('click', () => {
    showMobileNotification('🔐 Fitur login akan segera hadir!');
    closeMobileSidebar();
});

document.getElementById('mobileRegisterBtn')?.addEventListener('click', () => {
    showMobileNotification('📝 Fitur registrasi akan segera hadir!');
    closeMobileSidebar();
});

// Initialize
applyMobileTheme(currentThemeMobile);
renderMobileProducts('games');

// CSS animation tambahan
const mobileStyle = document.createElement('style');
mobileStyle.textContent = `
    @keyframes mobileSlideDown {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(mobileStyle);
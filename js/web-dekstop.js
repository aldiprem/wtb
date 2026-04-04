// CODE: file path js/web-dekstop.js name //

// ==================== 3D Background Setup ====================
const canvas = document.getElementById('bg-canvas');
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);

// Create floating particles
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 1500;
const particlePositions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 200;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 20;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
    color: 0x00d4ff,
    size: 0.15,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// Create floating geometric shapes
const group = new THREE.Group();

// Create rotating rings
const ringGeometry = new THREE.TorusGeometry(1.2, 0.03, 64, 200);
const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    emissive: 0x0066cc,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.6,
    metalness: 0.8,
    roughness: 0.2
});

const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
ring1.rotation.x = Math.PI / 2;
ring1.rotation.z = Date.now() * 0.001;
group.add(ring1);

const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
ring2.rotation.y = Math.PI / 2;
ring2.rotation.x = Math.PI / 3;
ring2.scale.set(0.8, 0.8, 0.8);
group.add(ring2);

// Add small floating spheres
const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    emissive: 0x0066cc,
    emissiveIntensity: 0.5
});

for (let i = 0; i < 50; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 5 - 3
    );
    group.add(sphere);
}

scene.add(group);

// Lights
const ambientLight = new THREE.AmbientLight(0x111122);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 20);
pointLight.position.set(0, 0, 2);
scene.add(pointLight);

// Animation variables
let time = 0;

function animate3D() {
    requestAnimationFrame(animate3D);
    time += 0.005;
    
    // Rotate particles
    particles.rotation.y = time * 0.1;
    particles.rotation.x = Math.sin(time * 0.2) * 0.1;
    
    // Rotate rings
    ring1.rotation.z = time * 0.5;
    ring2.rotation.x = time * 0.3;
    ring2.rotation.y = time * 0.4;
    
    // Float the group
    group.position.y = Math.sin(time * 0.5) * 0.1;
    group.rotation.y = time * 0.1;
    
    // Animate point light
    pointLight.intensity = 0.5 + Math.sin(time * 2) * 0.2;
    
    renderer.render(scene, camera);
}

animate3D();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== Products Data ====================
const productsData = {
    games: {
        title: "🔥 Popular Games",
        subtitle: "Topup dengan harga terbaik",
        products: [
            { id: 1, category: "mlbb", name: "5 Diamonds + Bonus", desc: "Mobile Legends", price: 1500, originalPrice: 2000, icon: "fas fa-dragon" },
            { id: 2, category: "mlbb", name: "50 Diamonds", desc: "Mobile Legends", price: 14000, originalPrice: 18000, icon: "fas fa-dragon" },
            { id: 3, category: "mlbb", name: "100 Diamonds", desc: "Mobile Legends", price: 27000, originalPrice: 35000, icon: "fas fa-dragon" },
            { id: 4, category: "mlbb", name: "250 Diamonds", desc: "Mobile Legends", price: 65000, originalPrice: 85000, icon: "fas fa-dragon" },
            { id: 5, category: "ff", name: "10 Diamonds", desc: "Free Fire", price: 1800, originalPrice: 2500, icon: "fas fa-fire" },
            { id: 6, category: "ff", name: "50 Diamonds", desc: "Free Fire", price: 8500, originalPrice: 12000, icon: "fas fa-fire" },
            { id: 7, category: "ff", name: "100 Diamonds", desc: "Free Fire", price: 16000, originalPrice: 22000, icon: "fas fa-fire" },
            { id: 8, category: "genshin", name: "60 Genesis Crystals", desc: "Genshin Impact", price: 12000, originalPrice: 16000, icon: "fas fa-star" },
            { id: 9, category: "genshin", name: "300 Genesis Crystals", desc: "Genshin Impact", price: 55000, originalPrice: 75000, icon: "fas fa-star" },
            { id: 10, category: "valorant", name: "100 VP", desc: "Valorant", price: 18000, originalPrice: 25000, icon: "fas fa-crosshairs" },
            { id: 11, category: "valorant", name: "500 VP", desc: "Valorant", price: 85000, originalPrice: 110000, icon: "fas fa-crosshairs" },
            { id: 12, category: "pubg", name: "60 UC", desc: "PUBG Mobile", price: 14000, originalPrice: 18000, icon: "fas fa-helmet-battle" }
        ]
    },
    premium: {
        title: "👑 Premium Apps",
        subtitle: "Berlangganan aplikasi premium dengan harga murah",
        products: [
            { id: 13, category: "spotify", name: "Spotify Premium 1 Bulan", desc: "Individual Plan", price: 25000, originalPrice: 55000, icon: "fab fa-spotify" },
            { id: 14, category: "spotify", name: "Spotify Premium 3 Bulan", desc: "Individual Plan", price: 70000, originalPrice: 165000, icon: "fab fa-spotify" },
            { id: 15, category: "netflix", name: "Netflix Basic 1 Bulan", desc: "Mobile/TV", price: 45000, originalPrice: 120000, icon: "fab fa-netflix" },
            { id: 16, category: "canva", name: "Canva Pro 1 Bulan", desc: "Premium Features", price: 35000, originalPrice: 80000, icon: "fab fa-canva" },
            { id: 17, category: "zoom", name: "Zoom Pro 1 Bulan", desc: "Business Meeting", price: 55000, originalPrice: 150000, icon: "fab fa-zoom" },
            { id: 18, category: "grammarly", name: "Grammarly Premium 1 Bulan", desc: "Writing Assistant", price: 40000, originalPrice: 100000, icon: "fas fa-spell-check" }
        ]
    },
    reseller: {
        title: "💎 Reseller Package",
        subtitle: "Dapatkan harga khusus untuk reseller",
        products: [
            { id: 19, name: "Starter Pack Reseller", desc: "Akses semua produk + margin 5%", price: 500000, originalPrice: 1000000, icon: "fas fa-rocket" },
            { id: 20, name: "Pro Pack Reseller", desc: "Akses semua produk + margin 10% + support prioritas", price: 1000000, originalPrice: 2000000, icon: "fas fa-crown" },
            { id: 21, name: "Enterprise Pack", desc: "Custom API + margin 15% + dedicated support", price: 2500000, originalPrice: 5000000, icon: "fas fa-building" }
        ]
    }
};

// ==================== Render Products ====================
function renderProducts(category) {
    const grid = document.getElementById('products-grid');
    const titleEl = document.getElementById('section-title');
    const subtitleEl = document.getElementById('section-subtitle');
    
    let data;
    if (category === 'games') {
        data = productsData.games;
    } else if (category === 'premium') {
        data = productsData.premium;
    } else if (category === 'reseller') {
        data = productsData.reseller;
    } else {
        data = productsData.games;
    }
    
    titleEl.textContent = data.title;
    subtitleEl.textContent = data.subtitle;
    
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i><p>Memuat produk...</p></div>';
    
    setTimeout(() => {
        if (!data.products || data.products.length === 0) {
            grid.innerHTML = '<div style="text-align: center; padding: 60px;"><i class="fas fa-box-open" style="font-size: 48px; color: #00d4ff;"></i><p style="margin-top: 16px;">Belum ada produk tersedia</p></div>';
            return;
        }
        
        grid.innerHTML = data.products.map(product => `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-icon">
                    <i class="${product.icon}"></i>
                </div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-desc">${product.desc}</p>
                <div class="product-price">
                    <span class="price-original">Rp ${formatPrice(product.originalPrice)}</span>
                    <span class="price-current">Rp ${formatPrice(product.price)}</span>
                </div>
                <button class="btn-topup" onclick="handleTopup(${product.id}, '${product.name}', ${product.price})">
                    <i class="fas fa-shopping-cart"></i> Topup Sekarang
                </button>
            </div>
        `).join('');
    }, 300);
}

function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ==================== Topup Handler ====================
function handleTopup(productId, productName, price) {
    // Show toast notification
    showNotification(`🛒 ${productName} - Rp ${formatPrice(price)} ditambahkan ke keranjang!`, 'success');
    
    // Here you can integrate with your backend API
    console.log(`Topup: ${productId} - ${productName} - Rp ${price}`);
}

// ==================== Notification System ====================
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(10, 20, 35, 0.95);
        backdrop-filter: blur(12px);
        padding: 12px 24px;
        border-radius: 12px;
        border-left: 3px solid ${type === 'success' ? '#00ff88' : '#00d4ff'};
        color: white;
        z-index: 1000;
        font-size: 14px;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================== Navigation ====================
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active class
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Get page
        const page = link.dataset.page;
        renderProducts(page);
    });
});

// ==================== Category Cards ====================
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        const cat = card.dataset.cat;
        // Filter products or scroll to products section
        const productsSection = document.querySelector('.products-section');
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Optional: Filter products by category
        showNotification(`Menampilkan produk ${card.querySelector('h3').textContent}`, 'info');
    });
});

// ==================== Balance Animation ====================
function updateBalance() {
    const balanceEl = document.getElementById('user-balance');
    let currentBalance = 0;
    const targetBalance = 125000;
    
    const interval = setInterval(() => {
        if (currentBalance >= targetBalance) {
            clearInterval(interval);
            balanceEl.textContent = `Rp ${formatPrice(targetBalance)}`;
        } else {
            currentBalance += 2500;
            balanceEl.textContent = `Rp ${formatPrice(currentBalance)}`;
        }
    }, 20);
}

// ==================== Scroll Effects for Sticky Header ====================
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.glass-nav');
    if (window.scrollY > 10) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Smooth scroll untuk anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href && href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ==================== User Dropdown Toggle ====================
const userAvatarBtn = document.getElementById('userAvatarBtn');
const userDropdown = document.getElementById('userDropdown');

if (userAvatarBtn && userDropdown) {
    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userAvatarBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
}

// ==================== Sidebar Menu Toggle ====================
const menuToggleBtn = document.getElementById('menuToggleBtn');
const sidebarMenu = document.getElementById('sidebarMenu');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

function openSidebar() {
    sidebarMenu.classList.add('open');
    sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebarMenu.classList.remove('open');
    sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', openSidebar);
}

if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// Sidebar navigation links
document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active class
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Also update main nav links
        const page = link.dataset.page;
        document.querySelectorAll('.nav-link').forEach(navLink => {
            if (navLink.dataset.page === page) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                navLink.classList.add('active');
            }
        });
        
        // Render products
        if (page) {
            renderProducts(page);
        }
        
        // Close sidebar after clicking
        closeSidebar();
    });
});

// ==================== Theme System ====================
const themeToggleBtn = document.getElementById('themeToggleBtn');
let currentTheme = localStorage.getItem('theme') || 'system';

function applyTheme(theme) {
    const root = document.documentElement;
    const body = document.body;
    
    if (theme === 'light') {
        root.style.setProperty('--bg-gradient-start', '#f0f2f5');
        root.style.setProperty('--bg-gradient-mid', '#e8eaef');
        root.style.setProperty('--bg-gradient-end', '#e0e4e9');
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#2d2d44');
        body.style.color = '#1a1a2e';
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        body.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
        root.style.setProperty('--bg-gradient-start', '#0a0a0f');
        root.style.setProperty('--bg-gradient-mid', '#0d1117');
        root.style.setProperty('--bg-gradient-end', '#0a0e1a');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a0b0c0');
        body.style.color = '#ffffff';
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        body.setAttribute('data-theme', 'dark');
    } else if (theme === 'system') {
        const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
        if (darkModeMedia.matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
        themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        body.setAttribute('data-theme', 'system');
        return;
    }
    
    localStorage.setItem('theme', theme);
    
    // Update active state in sidebar
    document.querySelectorAll('.theme-option').forEach(option => {
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Theme toggle button click
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        if (currentTheme === 'light') {
            currentTheme = 'dark';
            applyTheme('dark');
        } else if (currentTheme === 'dark') {
            currentTheme = 'system';
            applyTheme('system');
        } else {
            currentTheme = 'light';
            applyTheme('light');
        }
    });
}

// Theme options in sidebar
document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        currentTheme = theme;
        applyTheme(theme);
    });
});

// Initialize theme
applyTheme(currentTheme);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'system') {
        if (e.matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }
});

// ==================== Login/Register Handlers ====================
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNotification('🔐 Fitur login akan segera hadir!', 'info');
        userDropdown.classList.remove('show');
    });
}

if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNotification('📝 Fitur registrasi akan segera hadir!', 'info');
        userDropdown.classList.remove('show');
    });
}

// ==================== CSS Variables for Theme ====================
// Add CSS variables for theme support
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    :root {
        --bg-gradient-start: #0a0a0f;
        --bg-gradient-mid: #0d1117;
        --bg-gradient-end: #0a0e1a;
        --text-primary: #ffffff;
        --text-secondary: #a0b0c0;
    }
    
    body {
        background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-mid) 50%, var(--bg-gradient-end) 100%);
        color: var(--text-primary);
        transition: background 0.3s ease, color 0.3s ease;
    }
    
    .hero-title, .section-header h2, .category-card h3, .product-title {
        color: var(--text-primary);
    }
    
    .hero-subtitle, .section-header p, .category-card p, .product-desc {
        color: var(--text-secondary);
    }
`;
document.head.appendChild(styleSheet);

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    renderProducts('games');
    updateBalance();
    
    // Check if mobile (already handled by CSS, but double check)
    if (window.innerWidth <= 768) {
        const toast = document.getElementById('mobile-toast');
        toast.classList.add('show');
    }
    
    // Parallax effect for hero
    window.addEventListener('scroll', () => {
        const hero = document.querySelector('.hero-section');
        const scrolled = window.scrollY;
        if (hero) {
            hero.style.transform = `translateY(${scrolled * 0.3}px)`;
            hero.style.opacity = 1 - (scrolled / 500);
        }
    });
});
// Games Page JavaScript
let currentPage = 'games';
let telegramUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initTelegramAuth();
    initNavigation();
    loadPage('games');
});

// Initialize Telegram WebApp Auth
function initTelegramAuth() {
    if (window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        webApp.ready();
        webApp.expand();
        
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
            telegramUser = webApp.initDataUnsafe.user;
            updateProfileUI(telegramUser);
        }
    }
    
    // Fallback: cek localStorage
    const savedUser = localStorage.getItem('telegram_user');
    if (savedUser && !telegramUser) {
        telegramUser = JSON.parse(savedUser);
        updateProfileUI(telegramUser);
    }
}

// Update profile UI
function updateProfileUI(user) {
    if (user) {
        const profileName = document.getElementById('profileName');
        const profileStatus = document.getElementById('profileStatus');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (profileName) {
            profileName.textContent = user.first_name || user.username || 'Telegram User';
        }
        if (profileStatus) {
            profileStatus.textContent = 'Connected';
            profileStatus.style.color = '#4caf50';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
        }
        
        // Update avatar if available
        if (user.photo_url) {
            const avatarImg = document.querySelector('.profile-avatar img');
            if (avatarImg) avatarImg.src = user.photo_url;
        }
    }
}

// Initialize bottom navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page) {
                setActiveNav(page);
                loadPage(page);
            }
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('telegram_user');
            telegramUser = null;
            location.reload();
        });
    }
}

// Set active navigation
function setActiveNav(page) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    currentPage = page;
}

// Load page content
async function loadPage(page) {
    const contentWrapper = document.getElementById('contentWrapper');
    if (!contentWrapper) return;
    
    // Show loading
    contentWrapper.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
    
    try {
        switch(page) {
            case 'games':
                await loadGamesPage(contentWrapper);
                break;
            case 'market':
                await loadMarketPage(contentWrapper);
                break;
            case 'profile':
                await loadProfilePage(contentWrapper);
                break;
            default:
                contentWrapper.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📱</div>
                        <h3>Coming Soon</h3>
                        <p>Page under development</p>
                    </div>
                `;
        }
    } catch (error) {
        console.error('Error loading page:', error);
        contentWrapper.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Error</h3>
                <p>Failed to load content</p>
            </div>
        `;
    }
}

// Load Games Page
async function loadGamesPage(container) {
    // For now, show empty state as requested
    container.innerHTML = `
        <div class="games-container">
            <div class="empty-state">
                <div class="empty-icon">🎮</div>
                <h3>Games</h3>
                <p>Content will be added soon</p>
            </div>
        </div>
    `;
    
    // Uncomment below to fetch from API when ready
    /*
    const response = await fetch('/api/games/data');
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
        container.innerHTML = renderGamesContent(data.data);
    } else {
        container.innerHTML = `
            <div class="games-container">
                <div class="empty-state">
                    <div class="empty-icon">🎮</div>
                    <h3>Games</h3>
                    <p>No games available yet</p>
                </div>
            </div>
        `;
    }
    */
}

// Load Market Page
async function loadMarketPage(container) {
    container.innerHTML = `
        <div class="market-container">
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <h3>Market</h3>
                <p>Content will be added soon</p>
            </div>
        </div>
    `;
    
    // Uncomment below to fetch from API when ready
    /*
    const response = await fetch('/api/market/data');
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
        container.innerHTML = renderMarketContent(data.data);
    } else {
        container.innerHTML = `
            <div class="market-container">
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <h3>Market</h3>
                    <p>No products available yet</p>
                </div>
            </div>
        `;
    }
    */
}

// Load Profile Page
async function loadProfilePage(container) {
    const response = await fetch('/api/profile/data');
    const data = await response.json();
    
    if (telegramUser) {
        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-avatar-large">
                        ${telegramUser.photo_url ? 
                            `<img src="${telegramUser.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : 
                            '👤'}
                    </div>
                    <h2>${telegramUser.first_name || ''} ${telegramUser.last_name || ''}</h2>
                    <p>@${telegramUser.username || 'username'}</p>
                    
                    <div class="profile-detail">
                        <div class="detail-row">
                            <span class="detail-label">User ID</span>
                            <span class="detail-value">${telegramUser.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Language</span>
                            <span class="detail-value">${telegramUser.language_code || 'en'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Member Since</span>
                            <span class="detail-value">${new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-avatar-large">🔐</div>
                    <h2>Not Connected</h2>
                    <p>Connect with Telegram to continue</p>
                    <button class="telegram-login-btn" onclick="initTelegramLogin()">
                        Login with Telegram
                    </button>
                </div>
            </div>
        `;
    }
}

// Initialize Telegram login (for web)
function initTelegramLogin() {
    alert('Please open this page in Telegram WebApp for authentication');
}

// Render functions (for when content is ready)
function renderGamesContent(games) {
    return `
        <div class="games-container">
            <h2>Games</h2>
            <div class="games-grid">
                ${games.map(game => `
                    <div class="game-card">
                        <div class="game-icon">${game.icon || '🎮'}</div>
                        <div class="game-title">${game.name}</div>
                        <div class="game-desc">${game.description || ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderMarketContent(products) {
    return `
        <div class="market-container">
            <h2>Market</h2>
            <div class="products-grid">
                ${products.map(product => `
                    <div class="product-card">
                        <div class="product-icon">${product.icon || '📦'}</div>
                        <div class="product-info">
                            <div class="product-name">${product.name}</div>
                            <div class="product-price">$${product.price}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
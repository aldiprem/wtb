// winedash/js/market-checkout.js - Checkout Cart Functionality

(function() {
    'use strict';
    
    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let cartItems = [];
    let checkoutPanel = null;
    let checkoutOverlay = null;
    let marketFilterDropdown = null;
    let currentMarketFilter = 'fixprice';
    
    // ==================== UTILITY FUNCTIONS ====================
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    function hapticLight() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    function hapticSuccess() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
    
    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
    
    function showToast(message, type = 'info', duration = 3000) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.id = 'toastContainer';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    function showLoading(show) {
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Loading...</div>';
            document.body.appendChild(loadingOverlay);
        }
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        return parseFloat(num).toFixed(2);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== CART API ====================
    
    async function loadCartCount() {
        if (!telegramUser) return 0;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/count/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success) {
                updateCartBadge(data.count);
                return data.count;
            }
        } catch (error) {
            console.error('Error loading cart count:', error);
        }
        return 0;
    }
    
    async function loadCartItems() {
        if (!telegramUser) return [];
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/list/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success) {
                cartItems = data.cart || [];
                return cartItems;
            }
        } catch (error) {
            console.error('Error loading cart items:', error);
        }
        return [];
    }
    
    async function addToCart(usernameId, username, basedOn, price, sellerId, sellerWallet, avatarUrl, cardElement) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        // Animate flying avatar
        if (avatarUrl && cardElement) {
            animateFlyingAvatar(avatarUrl, cardElement);
        }
        
        hapticLight();
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    username_id: usernameId,
                    username: username,
                    based_on: basedOn || '',
                    price: price,
                    seller_id: sellerId,
                    seller_wallet: sellerWallet || ''
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                updateCartBadge(data.cart_count);
                showToast(`@${username} added to cart`, 'success');
                return true;
            } else {
                showToast(data.error || 'Failed to add to cart', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            showToast('Error adding to cart', 'error');
            return false;
        }
    }
    
    async function removeFromCart(usernameId, username) {
        if (!telegramUser) return false;
        
        hapticLight();
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id,
                    username_id: usernameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                updateCartBadge(data.cart_count);
                showToast(`@${username} removed from cart`, 'info');
                return true;
            } else {
                showToast(data.error || 'Failed to remove from cart', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error removing from cart:', error);
            showToast('Error removing from cart', 'error');
            return false;
        }
    }
    
    async function checkoutCart() {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        if (cartItems.length === 0) {
            showToast('Cart is empty', 'warning');
            return false;
        }
        
        const total = cartItems.reduce((sum, item) => sum + item.price, 0);
        
        if (!confirm(`Checkout ${cartItems.length} item(s) with total ${total.toFixed(2)} TON?`)) {
            return false;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast(data.message, 'success');
                closeCheckoutPanel();
                await loadCartCount();
                
                // Refresh marketplace to update UI
                if (typeof window.refreshMarketplace === 'function') {
                    window.refreshMarketplace();
                }
                if (typeof window.loadUsernames === 'function') {
                    window.loadUsernames();
                }
                
                return true;
            } else {
                showToast(data.error || 'Checkout failed', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error during checkout:', error);
            showToast('Error during checkout', 'error');
            return false;
        } finally {
            showLoading(false);
        }
    }
    
    function updateCartBadge(count) {
        const cartBtn = document.querySelector('.checkout-cart-btn');
        if (!cartBtn) return;
        
        let badge = cartBtn.querySelector('.cart-badge');
        
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'cart-badge';
                cartBtn.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            if (badge) {
                badge.style.display = 'none';
            }
        }
    }
    
    // ==================== ANIMATION ====================
    
    function animateFlyingAvatar(avatarUrl, cardElement) {
        // Get avatar position
        const avatarImg = cardElement.querySelector('.card-avatar img');
        if (!avatarImg) return;
        
        const rect = avatarImg.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        
        // Get cart button position
        const cartBtn = document.querySelector('.checkout-cart-btn');
        if (!cartBtn) return;
        
        const cartRect = cartBtn.getBoundingClientRect();
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;
        
        // Create flying element
        const flying = document.createElement('img');
        flying.src = avatarUrl;
        flying.className = 'flying-avatar';
        flying.style.position = 'fixed';
        flying.style.left = `${startX - 25}px`;
        flying.style.top = `${startY - 25}px`;
        flying.style.width = '50px';
        flying.style.height = '50px';
        flying.style.borderRadius = '25%';
        flying.style.objectFit = 'cover';
        flying.style.zIndex = '10000';
        flying.style.transition = 'all 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
        
        document.body.appendChild(flying);
        
        // Animate
        setTimeout(() => {
            flying.style.left = `${endX - 15}px`;
            flying.style.top = `${endY - 15}px`;
            flying.style.width = '30px';
            flying.style.height = '30px';
            flying.style.opacity = '0.5';
            flying.style.transform = 'rotate(20deg)';
        }, 10);
        
        // Remove after animation
        setTimeout(() => {
            flying.remove();
            // Bounce effect on cart button
            cartBtn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                cartBtn.style.transform = '';
            }, 200);
        }, 500);
    }
    
    // ==================== CHECKOUT PANEL ====================
    
    async function openCheckoutPanel() {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return;
        }
        
        // Load cart items
        await loadCartItems();
        
        if (checkoutPanel) {
            closeCheckoutPanel();
            setTimeout(() => openCheckoutPanel(), 300);
            return;
        }
        
        if (!checkoutOverlay) {
            checkoutOverlay = document.createElement('div');
            checkoutOverlay.className = 'panel-overlay';
            checkoutOverlay.style.zIndex = '1550';
            document.body.appendChild(checkoutOverlay);
            checkoutOverlay.addEventListener('click', closeCheckoutPanel);
        }
        
        const total = cartItems.reduce((sum, item) => sum + item.price, 0);
        
        checkoutPanel = document.createElement('div');
        checkoutPanel.className = 'checkout-panel';
        checkoutPanel.innerHTML = `
            <div class="drag-handle"></div>
            <div class="panel-header">
                <h3><i class="fas fa-shopping-cart"></i> Your Cart</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="checkout-items" id="checkoutItemsList">
                ${cartItems.length === 0 ? `
                    <div class="checkout-empty">
                        <i class="fas fa-shopping-cart"></i>
                        <div class="checkout-empty-title">Cart is Empty</div>
                        <div class="checkout-empty-subtitle">Add usernames to your cart</div>
                    </div>
                ` : cartItems.map(item => `
                    <div class="checkout-item" data-id="${item.username_id}">
                        <div class="checkout-item-avatar">
                            <img src="${localStorage.getItem(`avatar_${item.username}`) || 'https://companel.shop/image/winedash-logo.png'}" 
                                 alt="${escapeHtml(item.username)}"
                                 onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="checkout-item-info">
                            <div class="checkout-item-username">@${escapeHtml(item.username)}</div>
                            <div class="checkout-item-basedon">${escapeHtml(item.based_on || '-')}</div>
                        </div>
                        <div class="checkout-item-price">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON">
                            ${formatNumber(item.price)}
                        </div>
                        <button class="checkout-item-remove" data-id="${item.username_id}" data-username="${escapeHtml(item.username)}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            ${cartItems.length > 0 ? `
                <div class="checkout-summary">
                    <div class="checkout-total-row">
                        <span class="checkout-total-label">Total (${cartItems.length} items)</span>
                        <span class="checkout-total-amount">${formatNumber(total)} TON</span>
                    </div>
                    <button class="checkout-checkout-btn" id="checkoutConfirmBtn">
                        <i class="fas fa-check-circle"></i> Checkout
                    </button>
                </div>
            ` : ''}
        `;
        
        document.body.appendChild(checkoutPanel);
        checkoutOverlay.classList.add('active');
        document.body.classList.add('panel-open');
        setTimeout(() => checkoutPanel.classList.add('open'), 10);
        
        // Setup close button
        const closeBtn = checkoutPanel.querySelector('.panel-close');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', closeCheckoutPanel);
        }
        
        // Setup remove buttons
        checkoutPanel.querySelectorAll('.checkout-item-remove').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(newBtn.dataset.id);
                const username = newBtn.dataset.username;
                await removeFromCart(id, username);
                await openCheckoutPanel(); // Refresh panel
                // Update card button state
                updateCardCartButtonState(id, false);
            });
        });
        
        // Setup checkout button
        const checkoutBtn = document.getElementById('checkoutConfirmBtn');
        if (checkoutBtn) {
            const newCheckoutBtn = checkoutBtn.cloneNode(true);
            checkoutBtn.parentNode.replaceChild(newCheckoutBtn, checkoutBtn);
            newCheckoutBtn.addEventListener('click', async () => {
                await checkoutCart();
            });
        }
        
        // Setup drag to close
        setupPanelDragToClose(checkoutPanel, closeCheckoutPanel);
        
        hapticLight();
    }
    
    function closeCheckoutPanel() {
        if (checkoutPanel) {
            checkoutPanel.classList.remove('open');
            setTimeout(() => {
                if (checkoutPanel) checkoutPanel.remove();
                checkoutPanel = null;
            }, 300);
        }
        if (checkoutOverlay) {
            checkoutOverlay.classList.remove('active');
        }
        document.body.classList.remove('panel-open');
        hapticLight();
    }
    
    function setupPanelDragToClose(panel, closeFunction) {
        const dragHandle = panel.querySelector('.drag-handle');
        if (!dragHandle) return;
        
        let startY = 0, currentY = 0, isDragging = false;
        
        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            panel.style.transition = 'none';
            hapticLight();
        };
        
        const onTouchMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) {
                panel.style.transform = `translateY(${Math.min(deltaY, panel.offsetHeight * 0.7)}px)`;
            }
        };
        
        const onTouchEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            if (currentY - startY > 100) {
                closeFunction();
            } else {
                panel.style.transform = '';
            }
        };
        
        const newDragHandle = dragHandle.cloneNode(true);
        dragHandle.parentNode.replaceChild(newDragHandle, dragHandle);
        newDragHandle.addEventListener('touchstart', onTouchStart);
        newDragHandle.addEventListener('touchmove', onTouchMove);
        newDragHandle.addEventListener('touchend', onTouchEnd);
    }
    
    // ==================== CART BUTTON ON CARDS ====================
    
    function updateCardCartButtonState(usernameId, isInCart) {
        const card = document.querySelector(`.marketplace-card[data-id="${usernameId}"]`);
        if (!card) return;
        
        const cartBtn = card.querySelector('.card-cart-btn');
        if (!cartBtn) return;
        
        if (isInCart) {
            cartBtn.classList.add('in-cart');
            cartBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
            cartBtn.title = 'Remove from cart';
        } else {
            cartBtn.classList.remove('in-cart');
            cartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i>';
            cartBtn.title = 'Add to cart';
        }
    }
    
    async function checkIfInCart(usernameId) {
        if (!telegramUser) return false;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/market/cart/list/${telegramUser.id}`);
            const data = await response.json();
            if (data.success && data.cart) {
                return data.cart.some(item => item.username_id === usernameId);
            }
        } catch (error) {
            console.error('Error checking cart status:', error);
        }
        return false;
    }
    
    async function attachCartButtonsToCards() {
        if (!telegramUser) return;
        
        const cards = document.querySelectorAll('.marketplace-card');
        const cartItems = await loadCartItems();
        const cartIds = new Set(cartItems.map(item => item.username_id));
        
        for (const card of cards) {
            const usernameId = parseInt(card.dataset.id);
            const isInCart = cartIds.has(usernameId);
            
            let priceRow = card.querySelector('.card-price-row');
            if (!priceRow) {
                const infoDiv = card.querySelector('.marketplace-card-info');
                if (infoDiv) {
                    const existingRow = infoDiv.querySelector('.card-price-row');
                    if (existingRow) {
                        priceRow = existingRow;
                    } else {
                        priceRow = document.createElement('div');
                        priceRow.className = 'card-price-row';
                        const priceWithLogo = infoDiv.querySelector('.price-with-logo');
                        if (priceWithLogo) {
                            priceRow.appendChild(priceWithLogo.cloneNode(true));
                        } else {
                            priceRow.innerHTML = `
                                <div class="price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                    <span class="card-price">0</span>
                                </div>
                            `;
                        }
                        infoDiv.insertBefore(priceRow, infoDiv.firstChild);
                    }
                }
            }
            
            if (priceRow && !priceRow.querySelector('.card-cart-btn')) {
                const cartBtnWrapper = document.createElement('div');
                cartBtnWrapper.className = 'card-cart-btn-wrapper';
                
                const cartBtn = document.createElement('button');
                cartBtn.className = `card-cart-btn ${isInCart ? 'in-cart' : ''}`;
                cartBtn.innerHTML = isInCart ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-shopping-cart"></i>';
                cartBtn.title = isInCart ? 'Remove from cart' : 'Add to cart';
                
                const usernameData = JSON.parse(card.dataset.username.replace(/&#39;/g, "'"));
                
                cartBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isCurrentlyInCart = cartBtn.classList.contains('in-cart');
                    
                    if (isCurrentlyInCart) {
                        await removeFromCart(usernameData.id, usernameData.username);
                        cartBtn.classList.remove('in-cart');
                        cartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i>';
                        cartBtn.title = 'Add to cart';
                    } else {
                        const avatarUrl = card.querySelector('.card-avatar img')?.src;
                        const success = await addToCart(
                            usernameData.id,
                            usernameData.username,
                            usernameData.based_on,
                            usernameData.price,
                            usernameData.seller_id,
                            usernameData.seller_wallet,
                            avatarUrl,
                            card
                        );
                        if (success) {
                            cartBtn.classList.add('in-cart');
                            cartBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
                            cartBtn.title = 'Remove from cart';
                        }
                    }
                    
                    hapticLight();
                });
                
                cartBtnWrapper.appendChild(cartBtn);
                priceRow.appendChild(cartBtnWrapper);
            }
        }
    }
    
    // ==================== MARKET FILTER DROPDOWN ====================
    
    function setupMarketFilterDropdown() {
        const filterBtn = document.getElementById('marketFilterBtn');
        if (!filterBtn) return;
        
        const newFilterBtn = filterBtn.cloneNode(true);
        filterBtn.parentNode.replaceChild(newFilterBtn, filterBtn);
        
        let isOpen = false;
        
        function createDropdown() {
            const existingDropdown = document.getElementById('marketFilterDropdown');
            if (existingDropdown) existingDropdown.remove();
            
            const dropdown = document.createElement('div');
            dropdown.id = 'marketFilterDropdown';
            dropdown.className = 'market-filter-dropdown';
            dropdown.innerHTML = `
                <div class="market-filter-item ${currentMarketFilter === 'fixprice' ? 'active' : ''}" data-filter="fixprice">
                    <i class="fas fa-tag"></i> Fix Price
                </div>
                <div class="market-filter-item ${currentMarketFilter === 'premarket' ? 'active' : ''}" data-filter="premarket">
                    <i class="fas fa-chart-line"></i> Pre-Markets
                </div>
                <div class="market-filter-item ${currentMarketFilter === 'instant' ? 'active' : ''}" data-filter="instant">
                    <i class="fas fa-bolt"></i> Instant Offers
                </div>
                <div class="market-filter-item ${currentMarketFilter === 'auctions' ? 'active' : ''}" data-filter="auctions">
                    <i class="fas fa-gavel"></i> Auctions
                </div>
            `;
            
            const rect = newFilterBtn.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = `${rect.bottom + 5}px`;
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.minWidth = `${rect.width}px`;
            
            document.body.appendChild(dropdown);
            
            dropdown.querySelectorAll('.market-filter-item').forEach(item => {
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                
                newItem.addEventListener('click', () => {
                    const filter = newItem.dataset.filter;
                    currentMarketFilter = filter;
                    
                    dropdown.querySelectorAll('.market-filter-item').forEach(i => i.classList.remove('active'));
                    newItem.classList.add('active');
                    
                    // Update button text
                    const filterText = newItem.textContent.trim();
                    newFilterBtn.innerHTML = `<i class="fas fa-filter"></i><span>${filterText}</span>`;
                    
                    closeDropdown();
                    
                    // Apply filter to marketplace
                    applyMarketFilter(filter);
                    
                    hapticLight();
                });
            });
            
            return dropdown;
        }
        
        function closeDropdown() {
            const dropdown = document.getElementById('marketFilterDropdown');
            if (dropdown) dropdown.remove();
            isOpen = false;
            document.removeEventListener('click', handleClickOutside);
        }
        
        function handleClickOutside(e) {
            const dropdown = document.getElementById('marketFilterDropdown');
            if (dropdown && !dropdown.contains(e.target) && e.target !== newFilterBtn) {
                closeDropdown();
            }
        }
        
        function openDropdown() {
            createDropdown();
            isOpen = true;
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 10);
        }
        
        newFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
    }
    
    function applyMarketFilter(filter) {
        console.log(`[MARKET] Applying filter: ${filter}`);
        
        switch(filter) {
            case 'fixprice':
                // Show fix price usernames
                if (typeof window.applyFiltersAndRender === 'function') {
                    window.applyFiltersAndRender();
                } else if (typeof window.loadUsernames === 'function') {
                    window.loadUsernames();
                }
                break;
            case 'premarket':
                showToast('Pre-Markets feature coming soon', 'info');
                break;
            case 'instant':
                showToast('Instant Offers feature coming soon', 'info');
                break;
            case 'auctions':
                // Redirect to auctions mode
                const auctionsModeBtn = document.querySelector('.mode-btn[data-mode="auctions"]');
                if (auctionsModeBtn) {
                    auctionsModeBtn.click();
                }
                break;
        }
    }
    
    // ==================== INITIALIZATION ====================
    
    function getTelegramUserFromWebApp() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    return {
                        id: initData.user.id,
                        username: initData.user.username || '',
                        first_name: initData.user.first_name || '',
                        last_name: initData.user.last_name || '',
                        photo_url: initData.user.photo_url || null
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }
    
    function setupCartButton() {
        // Replace filter-summary-btn with cart button
        const filterSummaryBtn = document.getElementById('filterSummaryBtn');
        if (filterSummaryBtn) {
            const searchContainer = filterSummaryBtn.parentElement;
            if (searchContainer) {
                // Remove filter summary button
                filterSummaryBtn.remove();
                
                // Add cart button
                const cartBtn = document.createElement('button');
                cartBtn.id = 'checkoutCartBtn';
                cartBtn.className = 'checkout-cart-btn';
                cartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Cart</span>';
                cartBtn.title = 'View Cart';
                searchContainer.appendChild(cartBtn);
                
                cartBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openCheckoutPanel();
                });
            }
        }
        
        // Also add filter button in section-card header
        const cardHeader = document.querySelector('#marketplaceTab .section-card .card-header');
        if (cardHeader) {
            const existingFilterBtn = cardHeader.querySelector('.market-filter-header-btn');
            if (!existingFilterBtn) {
                const filterBtn = document.createElement('button');
                filterBtn.id = 'marketFilterBtn';
                filterBtn.className = 'filter-action-btn';
                filterBtn.style.marginLeft = 'auto';
                filterBtn.innerHTML = '<i class="fas fa-filter"></i><span>Fix Price</span>';
                cardHeader.appendChild(filterBtn);
                
                setupMarketFilterDropdown();
            }
        }
    }
    
    async function init() {
        console.log('🛒 Market Checkout - Initializing...');
        
        telegramUser = getTelegramUserFromWebApp();
        
        if (telegramUser) {
            await loadCartCount();
            
            // Setup cart button after marketplace renders
            setTimeout(() => {
                setupCartButton();
            }, 1000);
            
            // Watch for marketplace render to attach cart buttons
            const observer = new MutationObserver(() => {
                attachCartButtonsToCards();
            });
            
            const usernameList = document.getElementById('usernameList');
            if (usernameList) {
                observer.observe(usernameList, { childList: true, subtree: true });
            }
            
            // Initial attachment
            setTimeout(() => {
                attachCartButtonsToCards();
            }, 1500);
        }
    }
    
    // Export functions
    window.marketCheckout = {
        init: init,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        openCart: openCheckoutPanel,
        getCartCount: loadCartCount,
        updateCardButton: updateCardCartButtonState
    };
    
    // Auto init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }
    
})();
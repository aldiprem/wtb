/**
 * Gift Scanned Gallery - Main JavaScript
 */

// ==================== STATE MANAGEMENT ====================
const state = {
    currentPage: 1,
    totalPages: 1,
    limit: 20,
    searchQuery: '',
    gifts: [],
    detailModal: null
};

// ==================== DOM ELEMENTS ====================
const elements = {
    giftGrid: document.getElementById('giftGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    emptyState: document.getElementById('emptyState'),
    pagination: document.getElementById('pagination'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    totalItems: document.getElementById('totalItems'),
    totalGifts: document.getElementById('totalGifts'),
    uniqueGifts: document.getElementById('uniqueGifts'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearBtn: document.getElementById('clearBtn'),
    statsContainer: document.getElementById('statsContainer')
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initBootstrapModal();
    loadStats();
    loadGifts();
    setupEventListeners();
});

function initBootstrapModal() {
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        state.detailModal = new bootstrap.Modal(modalElement);
    }
}

function setupEventListeners() {
    // Search
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.clearBtn.addEventListener('click', handleClearSearch);
    
    // Search input change
    elements.searchInput.addEventListener('input', () => {
        elements.clearBtn.style.display = elements.searchInput.value ? 'inline-block' : 'none';
    });
    
    // Pagination
    elements.prevBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadGifts();
            scrollToTop();
        }
    });
    
    elements.nextBtn.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            loadGifts();
            scrollToTop();
        }
    });
}

// ==================== API CALLS ====================
async function loadStats() {
    try {
        const response = await fetch('/gift-scam/api/stats');
        const data = await response.json();
        
        if (data.success) {
            animateValue(elements.totalGifts, 0, data.stats.total, 1000);
            animateValue(elements.uniqueGifts, 0, data.stats.unique, 1000);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadGifts() {
    showLoading();
    
    try {
        const params = new URLSearchParams({
            page: state.currentPage,
            limit: state.limit,
            search: state.searchQuery
        });
        
        const response = await fetch(`/gift-scam/api/list?${params}`);
        const data = await response.json();
        
        if (data.success) {
            state.gifts = data.data;
            state.totalPages = data.total_pages;
            
            updatePagination(data);
            
            if (data.data.length === 0) {
                showEmpty();
            } else {
                renderGifts(data.data);
            }
        } else {
            showError(data.error || 'Gagal memuat data');
        }
    } catch (error) {
        console.error('Error loading gifts:', error);
        showError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
}

async function loadGiftDetail(slug) {
    try {
        const response = await fetch(`/gift-scam/api/detail/${slug}`);
        const data = await response.json();
        
        if (data.success) {
            showDetailModal(data.data);
        } else {
            alert('Gagal memuat detail: ' + data.error);
        }
    } catch (error) {
        console.error('Error loading detail:', error);
        alert('Gagal memuat detail gift');
    }
}

// ==================== RENDER FUNCTIONS ====================
function renderGifts(gifts) {
    hideAllStates();
    elements.giftGrid.style.display = 'grid';
    elements.giftGrid.innerHTML = '';
    
    gifts.forEach((gift, index) => {
        const card = createGiftCard(gift, index);
        elements.giftGrid.appendChild(card);
    });
    
    // Trigger animation
    animateCards();
}

function createGiftCard(gift, index) {
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.setAttribute('data-slug', gift.slug);
    
    card.innerHTML = `
        <div class="card-badge">
            <i class="fas fa-gift"></i> #${gift.id || ''}
        </div>
        <div class="card-lottie-container">
            <lottie-player
                src="${escapeHtml(gift.lottie_url)}"
                background="transparent"
                speed="1"
                style="width: 100%; height: 100%;"
                loop
                autoplay
                mode="normal"
            >
            </lottie-player>
        </div>
        <h3 class="card-name">${escapeHtml(gift.name)}</h3>
        <p class="card-slug">${escapeHtml(gift.slug)}</p>
        ${gift.number ? `<span class="card-number">#${escapeHtml(gift.number)}</span>` : ''}
    `;
    
    // Click event untuk detail
    card.addEventListener('click', () => {
        loadGiftDetail(gift.slug);
    });
    
    // Hover effect untuk play lottie
    card.addEventListener('mouseenter', () => {
        const player = card.querySelector('lottie-player');
        if (player && player.play) {
            player.play();
        }
    });
    
    return card;
}

function showDetailModal(gift) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = `🎁 ${gift.name}`;
    
    modalBody.innerHTML = `
        <div class="text-center">
            <lottie-player
                src="${escapeHtml(gift.lottie_url)}"
                background="transparent"
                speed="1"
                style="width: 250px; height: 250px; margin: 0 auto;"
                loop
                autoplay
            >
            </lottie-player>
        </div>
        
        <div class="detail-info">
            <p><strong>📝 Slug:</strong> ${escapeHtml(gift.slug)}</p>
            <p><strong>🆔 Message ID:</strong> ${gift.message_id}</p>
            <p><strong>🔗 Fragment URL:</strong> <a href="${escapeHtml(gift.fragment_url)}" target="_blank" style="color: #667eea;">${escapeHtml(gift.fragment_url)}</a></p>
            <p><strong>🎬 Lottie URL:</strong> <a href="${escapeHtml(gift.lottie_url)}" target="_blank" style="color: #667eea;">Download Lottie</a></p>
            
            ${gift.text ? `
                <div class="detail-text">
                    <strong>📄 Text Content:</strong><br>
                    ${escapeHtml(gift.text)}
                </div>
            ` : ''}
        </div>
    `;
    
    if (state.detailModal) {
        state.detailModal.show();
    }
}

function updatePagination(data) {
    elements.currentPage.textContent = data.page;
    elements.totalPages.textContent = data.total_pages;
    elements.totalItems.textContent = data.total;
    
    elements.prevBtn.disabled = !data.has_prev;
    elements.nextBtn.disabled = !data.has_next;
    
    elements.pagination.style.display = data.total_pages > 1 ? 'flex' : 'none';
}

// ==================== UI STATE MANAGEMENT ====================
function showLoading() {
    hideAllStates();
    elements.loadingState.style.display = 'block';
}

function showError(message) {
    hideAllStates();
    elements.errorState.style.display = 'block';
    elements.errorMessage.textContent = message;
}

function showEmpty() {
    hideAllStates();
    elements.emptyState.style.display = 'block';
    elements.pagination.style.display = 'none';
}

function hideAllStates() {
    elements.giftGrid.style.display = 'none';
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.giftGrid.innerHTML = '';
}

// ==================== EVENT HANDLERS ====================
function handleSearch() {
    const query = elements.searchInput.value.trim();
    state.searchQuery = query;
    state.currentPage = 1;
    
    elements.clearBtn.style.display = query ? 'inline-block' : 'none';
    
    loadGifts();
    loadStats();
}

function handleClearSearch() {
    elements.searchInput.value = '';
    state.searchQuery = '';
    state.currentPage = 1;
    elements.clearBtn.style.display = 'none';
    
    loadGifts();
    loadStats();
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function animateCards() {
    const cards = document.querySelectorAll('.gift-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(card);
    });
}

function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        
        element.textContent = value;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Handle Lottie player errors
document.addEventListener('error', (event) => {
    if (event.target.tagName === 'LOTTIE-PLAYER') {
        console.warn('Lottie failed to load:', event.target.src);
        event.target.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = 'gift-icon';
        fallback.textContent = '🎁';
        fallback.style.fontSize = '80px';
        event.target.parentElement.appendChild(fallback);
    }
}, true);

console.log('🎁 Gift Scanned Gallery initialized!');

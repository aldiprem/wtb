/**
 * Gift Scanned Gallery - Main JavaScript
 * Fixed Version
 */

// ==================== STATE MANAGEMENT ====================
const state = {
    currentPage: 1,
    totalPages: 1,
    limit: 20,
    searchQuery: '',
    gifts: [],
    isLoading: false
};

// ==================== DOM ELEMENTS ====================
const elements = {
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer'),
    
    // Header
    headerCount: document.getElementById('headerCount'),
    
    // Stats
    totalGifts: document.getElementById('totalGifts'),
    uniqueGifts: document.getElementById('uniqueGifts'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearBtn: document.getElementById('clearBtn'),
    
    // States
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    emptyState: document.getElementById('emptyState'),
    
    // Grid
    giftGrid: document.getElementById('giftGrid'),
    
    // Pagination
    pagination: document.getElementById('pagination'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    totalItems: document.getElementById('totalItems'),
    
    // Modal
    detailModal: document.getElementById('detailModal'),
    modalClose: document.getElementById('modalClose'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody')
};

// ==================== TOAST FUNCTIONS ====================
function showToast(message, type = 'info', duration = 3000) {
    if (!elements.toastContainer) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ==================== LOADING FUNCTIONS ====================
function showLoading(show = true) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎁 Gift Scanned Gallery - Initializing...');
    
    // Show loading immediately
    showLoading(true);
    
    // Setup event listeners
    setupEventListeners();
    setupModalListeners();
    
    // Load data
    loadStats();
    loadGifts();
});

function setupEventListeners() {
    // Search button
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', handleSearch);
    }
    
    // Search on Enter
    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        
        // Show/hide clear button
        elements.searchInput.addEventListener('input', () => {
            if (elements.clearBtn) {
                elements.clearBtn.style.display = elements.searchInput.value ? 'inline-flex' : 'none';
            }
        });
    }
    
    // Clear button
    if (elements.clearBtn) {
        elements.clearBtn.addEventListener('click', handleClearSearch);
    }
    
    // Pagination
    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                loadGifts();
                scrollToTop();
            }
        });
    }
    
    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                loadGifts();
                scrollToTop();
            }
        });
    }
}

function setupModalListeners() {
    // Close modal
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeModal);
    }
    
    // Close on overlay click
    if (elements.detailModal) {
        elements.detailModal.addEventListener('click', (e) => {
            if (e.target === elements.detailModal) {
                closeModal();
            }
        });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.detailModal && elements.detailModal.style.display === 'flex') {
            closeModal();
        }
    });
}

// ==================== MODAL FUNCTIONS ====================
function openModal() {
    if (elements.detailModal) {
        elements.detailModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    if (elements.detailModal) {
        elements.detailModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ==================== API CALLS ====================
async function loadStats() {
    try {
        const response = await fetch('/gift-scam/api/stats');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            animateValue(elements.totalGifts, 0, data.stats.total, 1000);
            animateValue(elements.uniqueGifts, 0, data.stats.unique, 1000);
            
            // Update header count
            if (elements.headerCount) {
                elements.headerCount.textContent = `${data.stats.total} gifts`;
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Don't show error for stats, just log it
    }
}

async function loadGifts() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    showLoading(true);
    hideAllStates();
    
    try {
        const params = new URLSearchParams({
            page: state.currentPage,
            limit: state.limit,
            search: state.searchQuery
        });
        
        console.log(`📡 Fetching: /gift-scam/api/list?${params}`);
        
        const response = await fetch(`/gift-scam/api/list?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Response:', data);
        
        if (data.success) {
            state.gifts = data.data;
            state.totalPages = data.total_pages;
            
            if (data.data.length === 0) {
                showEmpty();
            } else {
                renderGifts(data.data);
                updatePagination(data);
            }
        } else {
            showError(data.error || 'Gagal memuat data');
        }
    } catch (error) {
        console.error('❌ Error loading gifts:', error);
        showError(`Gagal terhubung ke server. ${error.message}`);
    } finally {
        state.isLoading = false;
        showLoading(false);
    }
}

async function loadGiftDetail(slug) {
    try {
        showToast('Memuat detail...', 'info');
        
        const response = await fetch(`/gift-scam/api/detail/${encodeURIComponent(slug)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showDetailModal(data.data);
        } else {
            showToast(data.error || 'Gagal memuat detail', 'error');
        }
    } catch (error) {
        console.error('Error loading detail:', error);
        showToast('Gagal memuat detail gift', 'error');
    }
}

// ==================== RENDER FUNCTIONS ====================
function renderGifts(gifts) {
    if (!elements.giftGrid) return;
    
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
    card.setAttribute('title', `Klik untuk detail ${gift.name}`);
    
    card.innerHTML = `
        <div class="card-badge">
            <i class="fas fa-gift"></i> #${gift.id || '?'}
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
    card.addEventListener('click', (e) => {
        e.preventDefault();
        loadGiftDetail(gift.slug);
    });
    
    return card;
}

function showDetailModal(gift) {
    if (!elements.modalTitle || !elements.modalBody) return;
    
    elements.modalTitle.textContent = `🎁 ${gift.name}`;
    
    elements.modalBody.innerHTML = `
        <div class="detail-lottie-wrapper">
            <lottie-player
                src="${escapeHtml(gift.lottie_url)}"
                background="transparent"
                speed="1"
                style="width: 200px; height: 200px; margin: 0 auto;"
                loop
                autoplay
            >
            </lottie-player>
        </div>
        
        <div class="detail-info-card">
            <div class="detail-info-row">
                <div class="detail-info-icon">
                    <i class="fas fa-tag"></i>
                </div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Slug</div>
                    <div class="detail-info-value">${escapeHtml(gift.slug)}</div>
                </div>
            </div>
            
            <div class="detail-info-row">
                <div class="detail-info-icon">
                    <i class="fas fa-hashtag"></i>
                </div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Message ID</div>
                    <div class="detail-info-value">${gift.message_id}</div>
                </div>
            </div>
            
            <div class="detail-info-row">
                <div class="detail-info-icon">
                    <i class="fas fa-link"></i>
                </div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Fragment URL</div>
                    <div class="detail-info-value">
                        <a href="${escapeHtml(gift.fragment_url)}" target="_blank" rel="noopener">
                            ${escapeHtml(gift.fragment_url)}
                        </a>
                    </div>
                </div>
            </div>
            
            <div class="detail-info-row">
                <div class="detail-info-icon">
                    <i class="fas fa-film"></i>
                </div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Lottie URL</div>
                    <div class="detail-info-value">
                        <a href="${escapeHtml(gift.lottie_url)}" target="_blank" rel="noopener">
                            Download Lottie
                        </a>
                    </div>
                </div>
            </div>
        </div>
        
        ${gift.text ? `
            <div class="detail-text-preview">
                <strong>📄 Text Content:</strong>
                ${escapeHtml(gift.text)}
            </div>
        ` : ''}
    `;
    
    openModal();
}

function updatePagination(data) {
    if (!elements.pagination) return;
    
    elements.currentPage.textContent = data.page;
    elements.totalPages.textContent = data.total_pages;
    elements.totalItems.textContent = data.total;
    
    if (elements.prevBtn) elements.prevBtn.disabled = !data.has_prev;
    if (elements.nextBtn) elements.nextBtn.disabled = !data.has_next;
    
    elements.pagination.style.display = data.total_pages > 1 ? 'block' : 'none';
}

// ==================== UI STATE MANAGEMENT ====================
function hideAllStates() {
    if (elements.giftGrid) {
        elements.giftGrid.style.display = 'none';
        elements.giftGrid.innerHTML = '';
    }
    if (elements.errorState) elements.errorState.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.pagination) elements.pagination.style.display = 'none';
}

function showError(message) {
    hideAllStates();
    if (elements.errorState) elements.errorState.style.display = 'block';
    if (elements.errorMessage) elements.errorMessage.textContent = message;
    showToast(message, 'error');
}

function showEmpty() {
    hideAllStates();
    if (elements.emptyState) elements.emptyState.style.display = 'block';
}

// ==================== EVENT HANDLERS ====================
function handleSearch() {
    if (!elements.searchInput) return;
    
    const query = elements.searchInput.value.trim();
    state.searchQuery = query;
    state.currentPage = 1;
    
    if (elements.clearBtn) {
        elements.clearBtn.style.display = query ? 'inline-flex' : 'none';
    }
    
    loadGifts();
}

function handleClearSearch() {
    if (elements.searchInput) elements.searchInput.value = '';
    state.searchQuery = '';
    state.currentPage = 1;
    if (elements.clearBtn) elements.clearBtn.style.display = 'none';
    
    loadGifts();
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
    
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(card);
    });
}

function animateValue(element, start, end, duration) {
    if (!element) return;
    
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
// Handle Lottie player errors
document.addEventListener('error', (event) => {
    if (event.target.tagName === 'LOTTIE-PLAYER') {
        console.warn('⚠️ Lottie failed to load:', event.target.src);
        event.target.style.display = 'none';
        
        // Add fallback icon
        const fallback = document.createElement('div');
        fallback.style.cssText = 'font-size: 80px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;';
        fallback.textContent = '🎁';
        
        if (event.target.parentElement) {
            event.target.parentElement.appendChild(fallback);
        }
    }
}, true);

// Log initialization
console.log('✅ Gift Scanned Gallery initialized!');
console.log('📍 API Base:', window.location.origin + '/gift-scam');

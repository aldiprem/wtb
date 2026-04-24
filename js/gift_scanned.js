/**
 * Gift Scanned Gallery - Complete Rewrite
 */

// ==================== STATE ====================
const state = {
    currentPage: 1,
    totalPages: 1,
    limit: 20,
    searchQuery: '',
    filterName: '',        // Filter by gift name (without ID)
    gifts: [],
    allNames: [],          // All unique names for filter
    selectedFilterName: '', // Currently selected filter
    lottiePlaying: false,  // Default: Stop
    isLoading: false
};

// ==================== DOM ELEMENTS ====================
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    headerCount: document.getElementById('headerCount'),
    totalGifts: document.getElementById('totalGifts'),
    uniqueGifts: document.getElementById('uniqueGifts'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearBtn: document.getElementById('clearBtn'),
    filterBtn: document.getElementById('filterBtn'),
    filterPanel: document.getElementById('filterPanel'),
    filterList: document.getElementById('filterList'),
    filterClose: document.getElementById('filterClose'),
    filterApply: document.getElementById('filterApply'),
    filterReset: document.getElementById('filterReset'),
    togglePlayBtn: document.getElementById('togglePlayBtn'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    emptyState: document.getElementById('emptyState'),
    giftGrid: document.getElementById('giftGrid'),
    pagination: document.getElementById('pagination'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    totalItems: document.getElementById('totalItems'),
    detailModal: document.getElementById('detailModal'),
    modalClose: document.getElementById('modalClose'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody')
};

// ==================== TOAST ====================
function showToast(message, type = 'info', duration = 3000) {
    if (!elements.toastContainer) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideUp 0.3s ease reverse'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ==================== LOADING ====================
function showLoading(show = true) {
    if (elements.loadingOverlay) elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎁 Gift Scanned Gallery v2');
    showLoading(true);
    setupEventListeners();
    setupModalListeners();
    loadStats();
    loadAllNames();  // Load names for filter
    loadGifts();
});

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    elements.searchBtn?.addEventListener('click', handleSearch);
    elements.searchInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    elements.searchInput?.addEventListener('input', () => {
        if (elements.clearBtn) elements.clearBtn.style.display = elements.searchInput.value ? 'inline-flex' : 'none';
    });
    elements.clearBtn?.addEventListener('click', handleClearSearch);
    
    // Filter
    elements.filterBtn?.addEventListener('click', toggleFilterPanel);
    elements.filterClose?.addEventListener('click', () => { elements.filterPanel.style.display = 'none'; });
    elements.filterApply?.addEventListener('click', applyFilter);
    elements.filterReset?.addEventListener('click', resetFilter);
    
    // Toggle Play/Stop
    elements.togglePlayBtn?.addEventListener('click', toggleLottiePlay);
    
    // Pagination
    elements.prevBtn?.addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage--; loadGifts(); scrollToTop(); } });
    elements.nextBtn?.addEventListener('click', () => { if (state.currentPage < state.totalPages) { state.currentPage++; loadGifts(); scrollToTop(); } });
}

function setupModalListeners() {
    elements.modalClose?.addEventListener('click', closeModal);
    elements.detailModal?.addEventListener('click', (e) => { if (e.target === elements.detailModal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && elements.detailModal?.style.display === 'flex') closeModal(); });
}

// ==================== MODAL ====================
function openModal() { if (elements.detailModal) { elements.detailModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; } }
function closeModal() { if (elements.detailModal) { elements.detailModal.style.display = 'none'; document.body.style.overflow = ''; } }

// ==================== TOGGLE LOTTIE PLAY/STOP ====================
function toggleLottiePlay() {
    state.lottiePlaying = !state.lottiePlaying;
    const btn = elements.togglePlayBtn;
    
    if (state.lottiePlaying) {
        btn.classList.add('playing');
        btn.querySelector('.stat-icon-inline').className = 'fas fa-play stat-icon-inline';
        btn.querySelector('.stat-value').textContent = 'Play';
        btn.title = 'Play Lottie';
    } else {
        btn.classList.remove('playing');
        btn.querySelector('.stat-icon-inline').className = 'fas fa-pause stat-icon-inline';
        btn.querySelector('.stat-value').textContent = 'Stop';
        btn.title = 'Stop Lottie';
    }
    
    // Update all lottie players
    document.querySelectorAll('lottie-player').forEach(player => {
        if (state.lottiePlaying) {
            player.play?.();
        } else {
            player.pause?.();
        }
    });
    
    // Also update mini lotties in modal
    document.querySelectorAll('.slug-mini-card lottie-player').forEach(player => {
        if (state.lottiePlaying) {
            player.play?.();
        } else {
            player.pause?.();
        }
    });
}

// ==================== FILTER FUNCTIONS ====================
function toggleFilterPanel() {
    const panel = elements.filterPanel;
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        renderFilterChips();
    } else {
        panel.style.display = 'none';
    }
}

async function loadAllNames() {
    try {
        const response = await fetch('/gift-scam/api/stats');
        const data = await response.json();
        if (data.success) {
            // Fetch all names from first API call
            const listResponse = await fetch('/gift-scam/api/list?limit=1');
            const listData = await listResponse.json();
            if (listData.success && listData.total > 0) {
                // Get unique names from the gifts we have
                const names = new Set();
                state.gifts.forEach(g => names.add(g.name));
                state.allNames = Array.from(names).sort();
            }
        }
    } catch (e) {
        console.error('Error loading names:', e);
    }
}

function collectAllNamesFromGifts() {
    const names = new Set();
    state.gifts.forEach(g => names.add(g.name));
    // Also collect from all loaded data
    return Array.from(names).sort();
}

function renderFilterChips() {
    if (!elements.filterList) return;
    
    // Collect names from current gifts
    const names = collectAllNamesFromGifts();
    state.allNames = names;
    
    elements.filterList.innerHTML = names.map(name => `
        <div class="filter-chip ${state.selectedFilterName === name ? 'selected' : ''}" 
             data-name="${escapeHtml(name)}"
             onclick="selectFilterChip('${escapeHtml(name).replace(/'/g, "\\'")}')">
            ${escapeHtml(name)}
        </div>
    `).join('');
}

function selectFilterChip(name) {
    state.selectedFilterName = state.selectedFilterName === name ? '' : name;
    renderFilterChips();
}

function applyFilter() {
    state.filterName = state.selectedFilterName;
    state.currentPage = 1;
    elements.filterPanel.style.display = 'none';
    loadGifts();
    showToast(`Filter: ${state.filterName || 'Semua'}`, 'info');
}

function resetFilter() {
    state.selectedFilterName = '';
    state.filterName = '';
    state.currentPage = 1;
    renderFilterChips();
    elements.filterPanel.style.display = 'none';
    loadGifts();
    showToast('Filter direset', 'info');
}

// ==================== API CALLS ====================
async function loadStats() {
    try {
        const response = await fetch('/gift-scam/api/stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.stats) {
            animateValue(elements.totalGifts, 0, data.stats.total, 1000);
            animateValue(elements.uniqueGifts, 0, data.stats.unique, 1000);
            if (elements.headerCount) elements.headerCount.textContent = `${data.stats.total} gifts`;
        }
    } catch (error) { console.error('Stats error:', error); }
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
        
        const url = `/gift-scam/api/list?${params}`;
        console.log(`📡 ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            let filteredGifts = data.data;
            
            // Apply name filter client-side
            if (state.filterName) {
                filteredGifts = data.data.filter(g => g.name === state.filterName);
            }
            
            state.gifts = filteredGifts;
            state.totalPages = Math.max(1, Math.ceil(filteredGifts.length / state.limit));
            
            if (filteredGifts.length === 0) {
                showEmpty();
            } else {
                renderGifts(filteredGifts);
                updatePaginationFromData(filteredGifts.length, data.total);
            }
            
            // Update all names for filter
            state.allNames = collectAllNamesFromGifts();
        } else {
            showError(data.error || 'Gagal memuat data');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showError(`Gagal terhubung. ${error.message}`);
    } finally {
        state.isLoading = false;
        showLoading(false);
    }
}

async function loadGiftDetail(slug) {
    try {
        showToast('Memuat detail...', 'info');
        const response = await fetch(`/gift-scam/api/detail/${encodeURIComponent(slug)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success) {
            showDetailModal(data.data);
        } else {
            showToast(data.error || 'Gagal memuat detail', 'error');
        }
    } catch (error) {
        showToast('Gagal memuat detail', 'error');
    }
}

// ==================== SLUG SCANNER ====================
function extractSlugsFromText(text) {
    if (!text) return [];
    // Pattern untuk mencocokkan slug NFT di text
    const pattern = /([A-Za-z][A-Za-z0-9]+-\d+)/g;
    const matches = text.match(pattern) || [];
    // Filter unique
    return [...new Set(matches)];
}

function scanSlugsInText(text, container) {
    const slugs = extractSlugsFromText(text);
    
    if (slugs.length === 0) {
        container.innerHTML = '<div class="slug-scanner-empty">Tidak ada slug NFT ditemukan</div>';
        return;
    }
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'slug-scroll-container';
    
    slugs.forEach(slug => {
        const lottieUrl = `https://nft.fragment.com/gift/${slug}.lottie.json`;
        const parts = slug.rsplit('-', 1);
        const name = parts[0] || slug;
        
        const miniCard = document.createElement('div');
        miniCard.className = 'slug-mini-card';
        miniCard.title = `Klik untuk detail ${slug}`;
        miniCard.innerHTML = `
            <lottie-player src="${escapeHtml(lottieUrl)}" background="transparent" speed="1" 
                style="width:60px;height:60px;margin:0 auto;" loop ${state.lottiePlaying ? 'autoplay' : ''}>
            </lottie-player>
            <div class="slug-mini-name">${escapeHtml(name)}</div>
        `;
        
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            loadGiftDetail(slug);
        });
        
        scrollContainer.appendChild(miniCard);
    });
    
    container.innerHTML = '';
    container.appendChild(scrollContainer);
}

// ==================== RENDER ====================
function renderGifts(gifts) {
    if (!elements.giftGrid) return;
    elements.giftGrid.style.display = 'grid';
    elements.giftGrid.innerHTML = '';
    gifts.forEach((gift, index) => {
        const card = createGiftCard(gift, index);
        elements.giftGrid.appendChild(card);
    });
    animateCards();
}

function createGiftCard(gift, index) {
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.style.animationDelay = `${index * 0.03}s`;
    
    card.innerHTML = `
        <div class="card-badge"><i class="fas fa-gift"></i> #${gift.id || '?'}</div>
        <div class="card-lottie-container">
            <lottie-player src="${escapeHtml(gift.lottie_url)}" background="transparent" speed="1"
                style="width:100%;height:100%;" loop ${state.lottiePlaying ? 'autoplay' : ''} mode="normal">
            </lottie-player>
        </div>
        <h3 class="card-name">${escapeHtml(gift.name)}</h3>
        <p class="card-slug">${escapeHtml(gift.slug)}</p>
        ${gift.number ? `<span class="card-number">#${escapeHtml(gift.number)}</span>` : ''}
    `;
    
    card.addEventListener('click', () => loadGiftDetail(gift.slug));
    return card;
}

function showDetailModal(gift) {
    if (!elements.modalTitle || !elements.modalBody) return;
    
    elements.modalTitle.textContent = `🎁 ${gift.name}`;
    const msgLink = `https://t.me/listgiftkotor/${gift.message_id}`;
    
    elements.modalBody.innerHTML = `
        <div class="detail-lottie-wrapper">
            <lottie-player src="${escapeHtml(gift.lottie_url)}" background="transparent" speed="1"
                style="width:200px;height:200px;margin:0 auto;" loop ${state.lottiePlaying ? 'autoplay' : ''}>
            </lottie-player>
        </div>
        
        <div class="detail-info-card">
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-tag"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Slug</div>
                    <div class="detail-info-value">${escapeHtml(gift.slug)}</div>
                </div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-hashtag"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Message ID</div>
                    <div class="detail-info-value">${gift.message_id}</div>
                </div>
            </div>
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-link"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Fragment URL</div>
                    <div class="detail-info-value">
                        <a href="${escapeHtml(gift.fragment_url)}" target="_blank" rel="noopener">Buka Fragment</a>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Visit Message Button -->
        <div style="text-align:center;">
            <a href="${msgLink}" target="_blank" rel="noopener" class="visit-message-btn">
                <i class="fas fa-external-link-alt"></i> Visit Message
            </a>
        </div>
        
        <!-- Slug Scanner Section -->
        ${gift.text ? `
            <div class="slug-scanner-section">
                <div class="slug-scanner-header">
                    <span class="slug-scanner-title">🔍 NFT Slugs dalam pesan:</span>
                    <button class="slug-scan-btn" id="slugScanBtn">
                        <i class="fas fa-search"></i> Scan
                    </button>
                </div>
                <div id="slugScannerResult">
                    <div class="slug-scanner-empty">Klik Scan untuk mencari slug</div>
                </div>
            </div>
            
            <div class="detail-text-preview" style="margin-top:12px;">
                <strong>📄 Text Content:</strong>
                ${escapeHtml(gift.text)}
            </div>
        ` : ''}
    `;
    
    // Add scan button event
    setTimeout(() => {
        const scanBtn = document.getElementById('slugScanBtn');
        const resultDiv = document.getElementById('slugScannerResult');
        if (scanBtn && resultDiv && gift.text) {
            scanBtn.addEventListener('click', () => {
                scanSlugsInText(gift.text, resultDiv);
            });
        }
    }, 100);
    
    openModal();
}

function updatePaginationFromData(filteredCount, totalCount) {
    if (!elements.pagination) return;
    elements.currentPage.textContent = state.currentPage;
    elements.totalPages.textContent = state.totalPages;
    elements.totalItems.textContent = state.filterName ? filteredCount : totalCount;
    if (elements.prevBtn) elements.prevBtn.disabled = state.currentPage <= 1;
    if (elements.nextBtn) elements.nextBtn.disabled = state.currentPage >= state.totalPages;
    elements.pagination.style.display = state.totalPages > 1 ? 'block' : 'none';
}

// ==================== UI STATE ====================
function hideAllStates() {
    if (elements.giftGrid) { elements.giftGrid.style.display = 'none'; elements.giftGrid.innerHTML = ''; }
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
    const query = elements.searchInput?.value.trim() || '';
    state.searchQuery = query;
    state.currentPage = 1;
    if (elements.clearBtn) elements.clearBtn.style.display = query ? 'inline-flex' : 'none';
    loadGifts();
}

function handleClearSearch() {
    if (elements.searchInput) elements.searchInput.value = '';
    state.searchQuery = '';
    state.currentPage = 1;
    if (elements.clearBtn) elements.clearBtn.style.display = 'none';
    loadGifts();
}

// ==================== UTILS ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function animateCards() {
    document.querySelectorAll('.gift-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, i * 30);
    });
}

function animateValue(element, start, end, duration) {
    if (!element) return;
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        element.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// Lottie error fallback
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'LOTTIE-PLAYER') {
        e.target.style.display = 'none';
        const fb = document.createElement('div');
        fb.style.cssText = 'font-size:60px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;';
        fb.textContent = '🎁';
        e.target.parentElement?.appendChild(fb);
    }
}, true);

console.log('✅ Gift Scanned Gallery v2 Ready');

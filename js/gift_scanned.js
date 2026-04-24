/**
 * Gift Scanned Gallery - Complete Rewrite
 */

// ==================== STATE ====================
const state = {
    currentPage: 1,
    limit: 30,
    allLoaded: false,
    searchMode: 'gift',
    searchQuery: '',
    filterName: '',
    selectedFilterNames: [],
    gifts: [],
    allGifts: [],
    allNames: [],
    nameCounts: {},
    lottiePlaying: false,
    isLoading: false,
    isLoadingMore: false
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
    setupLottieObserver();
    setupScrollToTopButton();
    loadStats();
    loadAllNames();
    loadGifts();
});

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Search
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

  // Infinite Scroll
  setupInfiniteScroll();

  // ✅ Swap dropdown
  const swapBtn = document.getElementById('searchSwapBtn');
  const swapDropdown = document.getElementById('searchSwapDropdown');
  
  if (swapBtn && swapDropdown) {
    swapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      swapDropdown.classList.toggle('show');
    });
    
    // Tutup dropdown saat klik di luar
    document.addEventListener('click', (e) => {
      if (!swapBtn.contains(e.target) && !swapDropdown.contains(e.target)) {
        swapDropdown.classList.remove('show');
      }
    });
    
    // Swap options
    swapDropdown.querySelectorAll('.search-swap-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = opt.dataset.mode;
        state.searchMode = mode;
        
        // Update label di tombol swap
        const label = document.getElementById('searchSwapLabel');
        if (label) {
          if (mode === 'gift') label.textContent = 'Gift';
          else if (mode === 'msgid') label.textContent = 'MsgID';
          else if (mode === 'userid') label.textContent = 'UserID';
        }
        
        // Update active class
        swapDropdown.querySelectorAll('.search-swap-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        
        // Update placeholder input
        const input = document.getElementById('searchInput');
        if (input) {
          if (mode === 'gift') input.placeholder = 'Cari gift...';
          else if (mode === 'msgid') input.placeholder = 'Masukkan Message ID...';
          else if (mode === 'userid') input.placeholder = 'Masukkan User ID...';
          input.value = '';
          // Sembunyikan clear button
          if (elements.clearBtn) elements.clearBtn.style.display = 'none';
        }
        
        // Reset state pencarian
        state.searchQuery = '';
        state.currentPage = 1;
        state.allLoaded = false;
        state.gifts = [];
        
        // Tutup dropdown
        swapDropdown.classList.remove('show');
      });
    });
  }
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
        btn.querySelector('.stat-icon-inline').className = 'fas fa-pause stat-icon-inline';
        btn.querySelector('.stat-value').textContent = 'Stop';
        btn.title = 'Stop Lottie';
    } else {
        btn.classList.remove('playing');
        btn.querySelector('.stat-icon-inline').className = 'fas fa-play stat-icon-inline';
        btn.querySelector('.stat-value').textContent = 'Play';
        btn.title = 'Play Lottie';
    }

    // ✅ Update hanya lottie yang TERLIHAT di viewport
    document.querySelectorAll('lottie-player').forEach(player => {
        const rect = player.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
            if (state.lottiePlaying) {
                player.setAttribute('autoplay', '');
                player.play?.();
            } else {
                player.removeAttribute('autoplay');
                player.stop?.();
                player.seek?.(0);
            }
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
        const response = await fetch('/gift-scam/api/names');
        const data = await response.json();
        if (data.success && data.names) {
            state.allNames = data.names;
            state.nameCounts = data.name_counts || {};
        }
    } catch (e) {
        console.error('Error loading names:', e);
        state.allNames = collectAllNamesFromGifts();
        state.nameCounts = {};
    }
}

function collectAllNamesFromGifts() {
    const names = new Set();
    state.gifts.forEach(g => names.add(g.name));
    return Array.from(names).sort();
}

function renderFilterChips() {
    if (!elements.filterList) return;
    
    // ✅ Gunakan state.allNames dari API /api/names (seluruh database)
    const names = state.allNames.length > 0 ? state.allNames : collectAllNamesFromGifts();
    
    let html = '';
    names.forEach(name => {
        const isSelected = state.selectedFilterNames.includes(name);
        // ✅ Count dari nameCounts (dari database) atau hitung dari allGifts
        const count = (state.nameCounts && state.nameCounts[name]) 
            ? state.nameCounts[name] 
            : state.allGifts.filter(g => g.name === name).length || '?';
        
        html += `
            <div class="filter-list-item ${isSelected ? 'selected' : ''}" 
                 data-name="${escapeHtml(name)}"
                 onclick="selectFilterChip('${escapeHtml(name).replace(/'/g, "\\'")}')">
                <div class="filter-checkbox ${isSelected ? 'checked' : ''}">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <span class="filter-item-name">${escapeHtml(name)}</span>
                <span class="filter-item-count">${count}</span>
            </div>
        `;
    });
    
    if (names.length === 0) {
        html = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Memuat data...</div>';
    }
    
    elements.filterList.innerHTML = html;
}

function countGiftsByName(name) {
    return state.gifts.filter(g => g.name === name).length;
}

function selectFilterChip(name) {
    if (state.selectedFilterName === name) {
        state.selectedFilterName = '';
    } else {
        state.selectedFilterName = name;
    }
    renderFilterChips();
}

function toggleSelectAll() {
    const selectAllBtn = document.getElementById('filterSelectAll');
    const allNames = state.allNames.length > 0 ? state.allNames : collectAllNamesFromGifts();
    
    if (state.selectedFilterNames.length === allNames.length) {
        // Unselect all
        state.selectedFilterNames = [];
        selectAllBtn.classList.remove('all-selected');
        selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Select All';
    } else {
        // Select all
        state.selectedFilterNames = [...allNames];
        selectAllBtn.classList.add('all-selected');
        selectAllBtn.innerHTML = '<i class="fas fa-times"></i> Unselect All';
    }
    
    renderFilterChips();
}

function selectFilterChip(name) {
    const index = state.selectedFilterNames.indexOf(name);
    if (index > -1) {
        state.selectedFilterNames.splice(index, 1);
    } else {
        state.selectedFilterNames.push(name);
    }
    
    // Update Select All button
    const selectAllBtn = document.getElementById('filterSelectAll');
    const allNames = state.allNames.length > 0 ? state.allNames : collectAllNamesFromGifts();
    
    if (state.selectedFilterNames.length === allNames.length) {
        selectAllBtn.classList.add('all-selected');
        selectAllBtn.innerHTML = '<i class="fas fa-times"></i> Unselect All';
    } else {
        selectAllBtn.classList.remove('all-selected');
        selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Select All';
    }
    
    renderFilterChips();
}

function renderFilterChips() {
    if (!elements.filterList) return;
    
    const names = state.allNames.length > 0 ? state.allNames : collectAllNamesFromGifts();
    
    let html = '';
    names.forEach(name => {
        const isSelected = state.selectedFilterNames.includes(name);
        const count = (state.nameCounts && state.nameCounts[name]) ? state.nameCounts[name] : '?';
        html += `
            <div class="filter-list-item ${isSelected ? 'selected' : ''}" 
                 data-name="${escapeHtml(name)}"
                 onclick="selectFilterChip('${escapeHtml(name).replace(/'/g, "\\'")}')">
                <div class="filter-checkbox ${isSelected ? 'checked' : ''}">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <span class="filter-item-name">${escapeHtml(name)}</span>
                <span class="filter-item-count">${count}</span>
            </div>
        `;
    });
    
    elements.filterList.innerHTML = html;
}

function applyFilter() {
    state.filterName = state.selectedFilterNames.join(',');
    state.currentPage = 1;
    state.allLoaded = false;
    state.gifts = [];
    elements.filterPanel.style.display = 'none';
    
    // ✅ Jika ada filter names, fetch dari server
    if (state.selectedFilterNames.length > 0) {
        loadFilteredGifts();
    } else {
        // Tidak ada filter, tampilkan semua dari allGifts
        state.filterName = '';
        filterAndRenderGifts();
    }
    
    scrollToTop();
    
    const filterText = state.selectedFilterNames.length > 0 
        ? `${state.selectedFilterNames.length} gift terpilih` 
        : 'Semua';
    showToast(`Filter: ${filterText}`, 'info');
}

async function loadFilteredGifts() {
    if (state.isLoading) return;
    state.isLoading = true;
    state.gifts = [];
    showLoading(true);
    hideAllStates();

    try {
        const filterNames = state.selectedFilterNames.join(',');
        const url = `/gift-scam/api/filter?names=${encodeURIComponent(filterNames)}`;
        
        console.log(`📡 Filter: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success) {
            state.gifts = data.data;
            state.allLoaded = true;

            if (data.data.length === 0) {
                showEmpty();
            } else {
                renderGifts(data.data);
                updateTotalCount(data.data.length);
                if (elements.pagination) elements.pagination.style.display = 'none';
            }
        } else {
            showError(data.error || 'Gagal memuat data filter');
        }
    } catch (error) {
        showError(`Gagal terhubung. ${error.message}`);
    } finally {
        state.isLoading = false;
        showLoading(false);
    }
}

function resetFilter() {
    state.selectedFilterNames = [];
    state.filterName = '';
    state.currentPage = 1;
    state.allLoaded = false;
    state.gifts = [];
    
    // Reset Select All button
    const selectAllBtn = document.getElementById('filterSelectAll');
    if (selectAllBtn) {
        selectAllBtn.classList.remove('all-selected');
        selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Select All';
    }
    
    renderFilterChips();
    elements.filterPanel.style.display = 'none';
    
    // ✅ Kembali ke data awal (allGifts)
    state.filterName = '';
    
    // Jika allGifts kosong, reload
    if (state.allGifts.length === 0) {
        loadGifts();
    } else {
        filterAndRenderGifts();
    }
    
    scrollToTop();
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
        }
    } catch (error) { console.error('Stats error:', error); }
}

function setupInfiniteScroll() {
  // Gunakan Intersection Observer untuk mendeteksi scroll ke bawah
  const sentinel = document.createElement('div');
  sentinel.id = 'scrollSentinel';
  sentinel.style.height = '1px';
  sentinel.style.width = '100%';

  // Tambahkan sentinel setelah giftGrid
  if (elements.giftGrid && elements.giftGrid.parentNode) {
    elements.giftGrid.parentNode.insertBefore(sentinel, elements.giftGrid.nextSibling);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !state.isLoadingMore && !state.allLoaded) {
        loadMoreGifts();
      }
    });
  }, {
    rootMargin: '200px' // Load sebelum benar-benar mencapai bawah
  });

  observer.observe(sentinel);
}

// ==================== SCROLL TO TOP BUTTON ====================
function setupScrollToTopButton() {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    if (!scrollBtn) return;
    
    // Fungsi untuk mengecek apakah tombol harus ditampilkan
    function checkScrollPosition() {
        // Dapatkan tinggi satu baris card (perkiraan)
        const giftCards = document.querySelectorAll('.gift-card');
        
        if (giftCards.length === 0) {
            scrollBtn.classList.remove('visible');
            return;
        }
        
        // Ambil card pertama dan kedua (satu baris = 2 card)
        const firstCard = giftCards[0];
        const cardBottom = firstCard.getBoundingClientRect().bottom;
        
        // Jika card pertama sudah melewati atas layar (scroll melewati 1 baris)
        if (cardBottom < 0) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    }
    
    // Event listener scroll
    window.addEventListener('scroll', checkScrollPosition, { passive: true });
    
    // Event listener klik
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Haptic feedback (opsional)
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    });
    
    // Cek posisi awal
    checkScrollPosition();
}

// ==================== LOAD GIFTS (Initial) ====================
async function loadGifts() {
    if (state.isLoading) return;
    state.isLoading = true;
    state.currentPage = 1;
    state.allLoaded = false;
    state.gifts = [];
    state.allGifts = [];  // ✅ Reset juga
    showLoading(true);
    hideAllStates();

    try {
        let url;
        let searchQuery = state.searchQuery;
        
        if (searchQuery.startsWith('msgid:')) {
            const messageId = searchQuery.replace('msgid:', '');
            url = `/gift-scam/api/by-message/${messageId}`;
        } else if (searchQuery.startsWith('userid:')) {
            const userId = searchQuery.replace('userid:', '');
            url = `/gift-scam/api/by-user/${userId}`;
        } else {
            const params = new URLSearchParams({
                page: 1,
                limit: 5000,
                search: searchQuery
            });
            url = `/gift-scam/api/list?${params}`;
        }
        
        console.log(`📡 ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success) {
            let items = data.data || [];
            
            // ✅ Simpan SEMUA data ke allGifts
            state.allGifts = items;
            
            // ✅ Terapkan filter untuk tampilan
            filterAndRenderGifts();
            
        } else {
            showError(data.error || 'Gagal memuat data');
        }
    } catch (error) {
        showError(`Gagal terhubung. ${error.message}`);
    } finally {
        state.isLoading = false;
        showLoading(false);
    }
}

function filterAndRenderGifts() {
    let items = [...state.allGifts];
    
    // ✅ Filter by search query (jika mode gift)
    if (state.searchQuery && !state.searchQuery.startsWith('msgid:') && !state.searchQuery.startsWith('userid:')) {
        const query = state.searchQuery.toLowerCase();
        items = items.filter(g => 
            g.slug.toLowerCase().includes(query) || 
            g.name.toLowerCase().includes(query) ||
            (g.text && g.text.toLowerCase().includes(query))
        );
    }
    
    state.gifts = items;
    state.allLoaded = true;
    
    if (items.length === 0) {
        showEmpty();
    } else {
        renderGifts(items);
        updateTotalCount(items.length);
        if (elements.pagination) elements.pagination.style.display = 'none';
    }
}

// ==================== LOAD MORE (Infinite Scroll) ====================
async function loadMoreGifts() {
  if (state.isLoadingMore || state.allLoaded) return;
  state.isLoadingMore = true;

  const nextPage = state.currentPage + 1;

  try {
    const params = new URLSearchParams({
      page: nextPage,
      limit: state.limit,
      search: state.searchQuery
    });

    const url = `/gift-scam/api/list?${params}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      let newGifts = data.data;
      if (state.filterName) {
        newGifts = data.data.filter(g => g.name === state.filterName);
      }

      if (newGifts.length > 0) {
        state.gifts = [...state.gifts, ...newGifts];
        state.currentPage = nextPage;
        appendGifts(newGifts);
      }

      // Cek apakah sudah semua
      if (data.data.length < state.limit || !data.has_next) {
        state.allLoaded = true;
      }
    } else {
      state.allLoaded = true;
    }

    updateTotalCount(data.total);
  } catch (error) {
    console.error('❌ Error load more:', error);
  } finally {
    state.isLoadingMore = false;
  }
}

function appendGifts(newGifts) {
    if (!elements.giftGrid) return;
    
    newGifts.forEach((gift, i) => {
        const card = createGiftCard(gift, state.gifts.length - newGifts.length + i);
        elements.giftGrid.appendChild(card);
    });
}

function updateTotalCount(total) {
  if (elements.totalItems) elements.totalItems.textContent = total;
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

function extractSlugsFromText(text) {
    if (!text) return [];
    
    const patterns = [
        /(?:t\.me|telegram\.me)\/nft\/([A-Za-z][A-Za-z0-9]+-\d+)/g,
        /\/nft\/([A-Za-z][A-Za-z0-9]+-\d+)/g,
        /nft\.fragment\.com\/gift\/([A-Za-z][A-Za-z0-9]+-\d+)/g,
        /([A-Za-z][A-Za-z0-9]+-\d{3,})/g
    ];
    
    const slugs = new Set();
    
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const slug = match[1] || match[0];
            if (/[A-Za-z].*-\d+/.test(slug)) {
                slugs.add(slug);
            }
        }
    });
    
    return [...slugs];
}

function scanSlugsInText(text, container) {
    const slugs = extractSlugsFromText(text);
    
    if (slugs.length === 0) {
        container.innerHTML = '<div class="slug-scanner-empty"><i class="fas fa-search"></i> Tidak ada slug NFT ditemukan dalam pesan</div>';
        return;
    }
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="slug-scan-result-count">
            <i class="fas fa-check-circle"></i> Ditemukan ${slugs.length} slug
        </div>
    `;
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'slug-scroll-container';
    
    slugs.forEach(slug => {
        const lottieUrl = `https://nft.fragment.com/gift/${slug}.lottie.json`;
        const parts = slug.rsplit('-', 1);
        const name = parts[0] || slug;
        
        const miniCard = document.createElement('div');
        miniCard.className = 'slug-mini-card';
        miniCard.title = `${slug}\nKlik untuk detail`;
        miniCard.innerHTML = `
            <div class="slug-mini-lottie">
                <lottie-player src="${escapeHtml(lottieUrl)}" background="transparent" speed="1" 
                    style="width:50px;height:50px;margin:0 auto;" loop ${state.lottiePlaying ? 'autoplay' : ''}>
                </lottie-player>
            </div>
            <div class="slug-mini-name">${escapeHtml(name)}</div>
            <div class="slug-mini-number">#${slug.split('-').pop()}</div>
        `;
        
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            loadGiftDetail(slug);
        });
        
        scrollContainer.appendChild(miniCard);
    });
    
    wrapper.appendChild(scrollContainer);
    container.innerHTML = '';
    container.appendChild(wrapper);
}

// ==================== RENDER GIFTS (Initial - Replace all) ====================
function renderGifts(gifts) {
  if (!elements.giftGrid) return;
  elements.giftGrid.style.display = 'grid';
  elements.giftGrid.innerHTML = '';
  gifts.forEach((gift, index) => {
    const card = createGiftCard(gift, index);
    elements.giftGrid.appendChild(card);
  });
}

function createGiftCard(gift, index) {
    const card = document.createElement('div');
    card.className = 'gift-card';
    const msgLink = `https://t.me/listgiftkotor/${gift.message_id}`;
    
    card.innerHTML = `
        <div class="card-lottie-wrapper">
            <div class="card-lottie-border">
                <lottie-player src="${escapeHtml(gift.lottie_url)}" background="transparent" speed="1"
                    style="width:100%;height:100%;" loop mode="normal">
                </lottie-player>
            </div>
        </div>
        <div class="card-info">
            <div class="card-name-row">
                <span class="card-name">${escapeHtml(gift.name)}</span>
                ${gift.number ? `<span class="card-number">#${escapeHtml(gift.number)}</span>` : ''}
            </div>
            <a href="${msgLink}" target="_blank" rel="noopener" class="card-visit-btn" onclick="event.stopPropagation()">
                <i class="fas fa-external-link-alt"></i> Visit Message
            </a>
        </div>
    `;
    
    card.addEventListener('click', () => loadGiftDetail(gift.slug));
    return card;
}

function showDetailModal(gift) {
    if (!elements.modalTitle || !elements.modalBody) return;

    elements.modalTitle.textContent = `🎁 ${gift.name}`;
    const msgLink = `https://t.me/listgiftkotor/${gift.message_id}`;

    const formatRarity = (val) => val ? `${(val / 10).toFixed(1)}%` : '-';

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
            ${gift.sender_id ? `
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-user"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Sender ID</div>
                    <div class="detail-info-value">${gift.sender_id}</div>
                </div>
            </div>
            ` : ''}
            ${gift.model ? `
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-cube"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Model</div>
                    <div class="detail-info-value">${escapeHtml(gift.model)} (${formatRarity(gift.model_rarity)})</div>
                </div>
            </div>
            ` : ''}
            ${gift.background ? `
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-image"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Background</div>
                    <div class="detail-info-value">${escapeHtml(gift.background)} (${formatRarity(gift.background_rarity)})</div>
                </div>
            </div>
            ` : ''}
            ${gift.symbol ? `
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-star"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Symbol</div>
                    <div class="detail-info-value">${escapeHtml(gift.symbol)} (${formatRarity(gift.symbol_rarity)})</div>
                </div>
            </div>
            ` : ''}
            ${gift.availability_total ? `
            <div class="detail-info-row">
                <div class="detail-info-icon"><i class="fas fa-chart-bar"></i></div>
                <div class="detail-info-content">
                    <div class="detail-info-label">Availability</div>
                    <div class="detail-info-value">${gift.availability_issued} / ${gift.availability_total}</div>
                </div>
            </div>
            ` : ''}
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

        <div style="text-align:center;">
            <a href="${msgLink}" target="_blank" rel="noopener" class="visit-message-btn">
                <i class="fas fa-external-link-alt"></i> Visit Message
            </a>
        </div>

        <!-- ✅ AUTO-LOAD: Semua slug dari message_id yang sama -->
        <div class="same-message-section" id="sameMessageSection">
            <div class="same-message-header">
                <span class="same-message-title">
                    <i class="fas fa-list"></i> Semua Gift dari Msg.ID ${gift.message_id}
                </span>
                <span class="same-message-loading" id="sameMsgLoading">
                    <i class="fas fa-spinner fa-spin"></i> Memuat...
                </span>
            </div>
            <div class="same-message-slugs" id="sameMsgSlugs"></div>
        </div>

        ${gift.text ? `
            <div class="detail-text-preview" style="margin-top:12px;">
                <strong>📄 Text Content:</strong>
                ${escapeHtml(gift.text)}
            </div>
        ` : ''}
    `;

    openModal();

    loadSameMessageSlugs(gift.message_id);
}

async function loadSameMessageSlugs(messageId) {
    const container = document.getElementById('sameMsgSlugs');
    const loadingEl = document.getElementById('sameMsgLoading');
    
    if (!container || !loadingEl) return;
    
    try {
        // Fetch semua gift dari database yang punya message_id sama
        const response = await fetch(`/gift-scam/api/by-message/${messageId}`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            loadingEl.style.display = 'none';
            
            const scrollDiv = document.createElement('div');
            scrollDiv.className = 'same-message-scroll';
            
            data.data.forEach(gift => {
                const miniCard = document.createElement('div');
                miniCard.className = 'same-message-card';
                miniCard.title = `${gift.slug}\nKlik untuk detail`;
                miniCard.innerHTML = `
                    <div class="same-message-lottie">
                        <lottie-player src="${escapeHtml(gift.lottie_url)}" background="transparent" speed="1"
                            style="width:50px;height:50px;margin:0 auto;" loop ${state.lottiePlaying ? 'autoplay' : ''}>
                        </lottie-player>
                    </div>
                    <div class="same-message-name">${escapeHtml(gift.name)}</div>
                    <div class="same-message-number">#${gift.number || ''}</div>
                `;
                
                miniCard.addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadGiftDetail(gift.slug);
                });
                
                scrollDiv.appendChild(miniCard);
            });
            
            container.innerHTML = '';
            container.appendChild(scrollDiv);
            
            // Update count
            const header = document.querySelector('.same-message-title');
            if (header) {
                header.innerHTML = `<i class="fas fa-list"></i> Semua Gift dari Msg.ID ${messageId} (${data.data.length})`;
            }
        } else {
            loadingEl.innerHTML = '<i class="fas fa-info-circle"></i> Tidak ada gift lain';
        }
    } catch (error) {
        console.error('Error loading same message slugs:', error);
        if (loadingEl) {
            loadingEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal memuat';
        }
    }
}

function handleModalScan(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const btn = event.currentTarget;
    const text = btn.getAttribute('data-text');
    const resultDiv = btn.parentElement.parentElement.querySelector('.modal-scanner-result');
    
    if (text && resultDiv) {
        scanSlugsInText(text, resultDiv);
        
        // Update button state
        btn.innerHTML = '<i class="fas fa-check"></i> Scanned';
        btn.style.background = 'rgba(16, 185, 129, 0.3)';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-search"></i> Scan';
            btn.style.background = '';
        }, 2000);
    }
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
    state.currentPage = 1;
    state.allLoaded = false;
    state.gifts = [];

    if (!query) {
        showToast('Masukkan kata kunci pencarian', 'warning');
        return;
    }
    
    if (state.searchMode === 'msgid') {
        // Search by Message ID
        const msgId = parseInt(query);
        if (isNaN(msgId)) {
            showToast('Masukkan angka Message ID yang valid', 'error');
            return;
        }
        state.searchQuery = `msgid:${msgId}`;
        // ✅ JANGAN ubah input user
    } else if (state.searchMode === 'userid') {
        // Search by User ID
        const userId = parseInt(query);
        if (isNaN(userId)) {
            showToast('Masukkan angka User ID yang valid', 'error');
            return;
        }
        state.searchQuery = `userid:${userId}`;
        // ✅ JANGAN ubah input user
    } else {
        // Search by Gift (slug/link)
        // ✅ Normalize slug dari link
        let searchQuery = query;
        
        // Deteksi link t.me/nft/ atau t.me/listgiftkotor/
        const nftMatch = query.match(/(?:t\.me\/nft\/|t\.me\/c\/\d+\/)([A-Za-z0-9_-]+)/);
        if (nftMatch) {
            searchQuery = nftMatch[1]; // Ambil slug saja
        }
        
        // Deteksi link message ID
        const msgIdMatch = query.match(/(?:listgiftkotor\/|t\.me\/listgiftkotor\/)(\d+)/);
        if (msgIdMatch) {
            state.searchMode = 'msgid';
            state.searchQuery = `msgid:${msgIdMatch[1]}`;
            // ✅ JANGAN ubah input user
            if (elements.clearBtn) elements.clearBtn.style.display = 'inline-flex';
            loadGifts();
            scrollToTop();
            return;
        }
        
        state.searchQuery = searchQuery;
        // ✅ JANGAN ubah input user
    }
    
    if (elements.clearBtn) elements.clearBtn.style.display = query ? 'inline-flex' : 'none';
    loadGifts();
    scrollToTop();
}

function handleClearSearch() {
    if (elements.searchInput) elements.searchInput.value = '';
    state.searchQuery = '';
    state.currentPage = 1;
    state.allLoaded = false;
    state.gifts = [];
    state.searchMode = 'gift';
    state.filterName = state.selectedFilterNames.join(',');
    if (elements.clearBtn) elements.clearBtn.style.display = 'none';
    
    // ✅ Load ulang semua data
    loadGifts();
}

// ==================== LOTTIE INTERSECTION OBSERVER ====================
function setupLottieObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const player = entry.target;
            if (entry.isIntersecting) {
                // Terlihat di layar -> play (jika mode play aktif)
                if (state.lottiePlaying) {
                    player.setAttribute('autoplay', '');
                    player.play?.();
                } else {
                    // Mode stop, tapi tetap di frame 0
                    player.removeAttribute('autoplay');
                    player.stop?.();
                    player.seek?.(0);
                }
            } else {
                // Tidak terlihat -> pause/stop
                player.removeAttribute('autoplay');
                player.stop?.();
                player.seek?.(0);
            }
        });
    }, {
        rootMargin: '100px', // Mulai animasi 100px sebelum masuk viewport
        threshold: 0.1
    });

    // Observe semua lottie player yang ada dan yang baru ditambahkan
    const observeAll = () => {
        document.querySelectorAll('lottie-player').forEach(player => {
            if (!player.dataset.observed) {
                observer.observe(player);
                player.dataset.observed = 'true';
            }
        });
    };

    // Observe existing
    observeAll();

    // Observe new (MutationObserver untuk card yang ditambahkan via infinite scroll)
    const mutationObserver = new MutationObserver(() => {
        observeAll();
    });

    const gridEl = document.getElementById('giftGrid');
    if (gridEl) {
        mutationObserver.observe(gridEl, {
            childList: true,
            subtree: true
        });
    }
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

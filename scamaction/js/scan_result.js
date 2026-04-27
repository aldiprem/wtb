// js/scan_result.js - ScamAction Scan Results JavaScript

// ─── Telegram WebApp initialization ──────────────────────────────────────────

const tg = window.Telegram.WebApp;

// Fullscreen + safe area
tg.expand();
if (typeof tg.requestFullscreen === 'function') {
    tg.requestFullscreen();
}
tg.ready();

// ─── State ───────────────────────────────────────────────────────────────────

let allResults = [];
let filteredResults = [];
let currentPage = 0;
let pageData = null;
const itemsPerPage = 20;

// ─── Helper Functions ────────────────────────────────────────────────────────

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString();
    } catch {
        return dateString;
    }
}

// ─── Render Functions ────────────────────────────────────────────────────────

function renderResultCard(result) {
    const badge = result.is_known
        ? '<span class="badge badge-known">Terdata</span>'
        : '<span class="badge badge-unknown">Belum Terdata</span>';

    const refsHtml = result.references && result.references.length > 0
        ? `<div class="references">
            ${result.references.map(ref => `
                <div class="reference">
                    📌 <a href="${escapeHtml(ref.link)}" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(ref.channel_name)} — pesan #${ref.msg_id}
                    </a>
                </div>
            `).join('')}
           </div>`
        : '';

    return `
        <div class="result-card">
            <div class="user-id">🆔 ${escapeHtml(String(result.user_id))}${badge}</div>
            ${refsHtml}
        </div>
    `;
}

function renderPage() {
    if (!pageData) return;

    const totalPages = Math.max(1, Math.ceil(filteredResults.length / itemsPerPage));
    const start = currentPage * itemsPerPage;
    const pageResults = filteredResults.slice(start, start + itemsPerPage);

    const knownCount = allResults.filter(r => r.is_known).length;
    const unknownCount = allResults.filter(r => !r.is_known).length;

    const html = `
        <div class="header">
            <h1>🔍 Hasil Scan</h1>
            <p>Channel: ${escapeHtml(pageData.monitor_chat_name || '-')}</p>
            <p>Filter Channel: ${escapeHtml(pageData.scan_channel_name || '-')}</p>
            <p>Format: ${escapeHtml(pageData.format_text || '-')}</p>
            <p>Expired: ${formatDate(pageData.expires_at)}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="label">Total Ditemukan</div>
                <div class="value">${pageData.total_found || 0}</div>
            </div>
            <div class="stat-card">
                <div class="label">Terdata di DB</div>
                <div class="value">${knownCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Belum Terdata</div>
                <div class="value">${unknownCount}</div>
            </div>
        </div>

        <div class="search-box">
            <input type="text" id="searchInput" placeholder="Cari User ID..." autocomplete="off">
        </div>

        <div id="resultsList">
            ${pageResults.length > 0 
                ? pageResults.map(renderResultCard).join('') 
                : '<div class="loading">Tidak ada hasil</div>'}
        </div>

        ${totalPages > 1 ? `
        <div class="pagination">
            <button class="page-btn" id="prevBtn" ${currentPage === 0 ? 'disabled' : ''}>◀ Sebelumnya</button>
            <span class="page-info">Halaman ${currentPage + 1} / ${totalPages}</span>
            <button class="page-btn" id="nextBtn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Selanjutnya ▶</button>
        </div>` : ''}
    `;

    document.getElementById('app').innerHTML = html;

    // Attach event listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterResults);
    }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => changePage(-1));
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => changePage(1));
    }
}

// ─── Data Functions ──────────────────────────────────────────────────────────

async function loadResults(token) {
    try {
        const response = await fetch(`/api/scamaction/scan_results/${token}`);
        const data = await response.json();

        if (!data.success) {
            document.getElementById('app').innerHTML =
                `<div class="error">${escapeHtml(data.error || 'Failed to load results')}</div>`;
            return;
        }

        pageData = data.data;
        allResults = data.data.results || [];
        filteredResults = [...allResults];
        currentPage = 0;
        renderPage();

    } catch (error) {
        console.error('Error loading results:', error);
        document.getElementById('app').innerHTML =
            `<div class="error">Error: ${escapeHtml(error.message)}</div>`;
    }
}

function filterResults() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const term = searchInput.value.toLowerCase().trim();
    
    if (!term) {
        filteredResults = [...allResults];
    } else {
        filteredResults = allResults.filter(r => 
            String(r.user_id).toLowerCase().includes(term)
        );
    }
    
    currentPage = 0;
    renderPage();
}

function changePage(delta) {
    const totalPages = Math.max(1, Math.ceil(filteredResults.length / itemsPerPage));
    const newPage = currentPage + delta;
    
    if (newPage >= 0 && newPage < totalPages) {
        currentPage = newPage;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ─── Get Token and Load ──────────────────────────────────────────────────────

// Ambil token dari startapp parameter
let token = null;

if (tg.initDataUnsafe?.start_param) {
    token = tg.initDataUnsafe.start_param;
} else if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    token = params.get('startapp');
} else if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    token = params.get('startapp');
}

// Handle direct token in URL path (alternative)
if (!token && window.location.pathname) {
    const pathParts = window.location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.length > 20) {
        token = lastPart;
    }
}

// Load results or show error
if (!token) {
    document.getElementById('app').innerHTML = '<div class="error">No token provided</div>';
} else {
    loadResults(token);
}
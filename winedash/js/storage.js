// winedash/js/storage.js - Storage Page

(function() {
    'use strict';
    
    console.log('📦 Winedash Storage - Initializing...');

    const API_BASE_URL = window.location.origin;
    
    let telegramUser = null;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let walletAddress = null;
    
    // State
    let allUsernames = [];
    let currentMode = 'onchain';
    let currentStatus = 'all';
    let currentSort = 'price_asc';
    let currentLayout = localStorage.getItem('storage_layout') || 'grid';
    let currentSearchTerm = '';
    let pendingList = [];
    let currentOtpPendingId = null;

    // DOM Elements
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        usernameContainer: document.getElementById('usernameContainer'),
        searchInput: document.getElementById('searchStorage'),
        searchApplyBtn: document.getElementById('searchApplyBtn'),
        addUsernameActionBtn: document.getElementById('addUsernameActionBtn'),
        addModal: document.getElementById('addModal'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        confirmAddBtn: document.getElementById('confirmAddBtn'),
        modalUsername: document.getElementById('modalUsername'),
        modalPrice: document.getElementById('modalPrice'),
        modalCategory: document.getElementById('modalCategory'),
        sortBtn: document.getElementById('sortBtn'),
        sortDropdown: document.getElementById('sortDropdown'),
        sortSelect: document.getElementById('sortSelect'),
        gridLayoutBtn: document.getElementById('gridLayoutBtn'),
        listLayoutBtn: document.getElementById('listLayoutBtn'),
        modeBtns: document.querySelectorAll('.mode-btn')
    };

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

    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }

    function hapticError() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }

    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Warna solid sesuai type
        let icon = 'fa-info-circle';
        let bgColor = '';
        switch(type) {
            case 'success':
                icon = 'fa-check-circle';
                bgColor = 'linear-gradient(135deg, #10b981, #0d9488)';
                break;
            case 'error':
                icon = 'fa-exclamation-circle';
                bgColor = 'linear-gradient(135deg, #ef4444, #dc2626)';
                break;
            case 'warning':
                icon = 'fa-exclamation-triangle';
                bgColor = 'linear-gradient(135deg, #f59e0b, #d97706)';
                break;
            default:
                icon = 'fa-info-circle';
                bgColor = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        }
        
        toast.style.background = bgColor;
        toast.style.border = 'none';
        toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showLoading(show) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        return parseFloat(num).toFixed(2);
    }

    // ==================== TELEGRAM USER ====================
    
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

    async function authenticateUser() {
        if (!telegramUser) return null;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(telegramUser)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Error authenticating user:', error);
            return null;
        }
    }

    // ==================== CRUD OPERATIONS ====================
    async function loadUsernames() {
        showLoading(true);
        
        try {
            console.log('[DEBUG] Loading usernames...');
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            
            console.log('[DEBUG] Load usernames response:', data);
            
            if (data.success && data.usernames) {
                // Filter hanya username milik user yang login
                if (telegramUser) {
                    allUsernames = data.usernames.filter(u => u.seller_id === telegramUser.id);
                    console.log(`[DEBUG] Filtered ${allUsernames.length} usernames for user ${telegramUser.id}`);
                } else {
                    allUsernames = data.usernames;
                }
                filterAndRender();
            } else {
                console.log('[DEBUG] No usernames found or error:', data);
                allUsernames = [];
                renderUsernames([]);
            }
        } catch (error) {
            console.error('[DEBUG] Error loading usernames:', error);
            if (elements.usernameContainer) {
                elements.usernameContainer.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
            }
        } finally {
            showLoading(false);
        }
    }

    async function loadPendingCount() {
        if (!telegramUser) return;
        
        try {
            console.log('[DEBUG] Loading pending count for user:', telegramUser.id);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/count/${telegramUser.id}`);
            const data = await response.json();
            
            console.log('[DEBUG] Pending count response:', data);
            
            const badge = document.getElementById('inboxBadge');
            if (badge) {
                if (data.success && data.count > 0) {
                    badge.textContent = data.count > 99 ? '99+' : data.count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading pending count:', error);
        }
    }

    async function loadPendingList() {
        if (!telegramUser) return;
        
        try {
            console.log('[DEBUG] Loading pending list for user:', telegramUser.id);
            
            // Gunakan endpoint dengan user_id
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/list/${telegramUser.id}`);
            const data = await response.json();
            
            console.log('[DEBUG] Pending list response:', data);
            
            if (data.success) {
                pendingList = data.pendings || [];
                renderInboxContent();
            } else {
                console.error('Failed to load pending list:', data.error);
                const inboxContent = document.getElementById('inboxContent');
                if (inboxContent) {
                    inboxContent.innerHTML = '<div class="loading-placeholder">Gagal memuat data: ' + (data.error || 'Unknown error') + '</div>';
                }
            }
        } catch (error) {
            console.error('Error loading pending list:', error);
            const inboxContent = document.getElementById('inboxContent');
            if (inboxContent) {
                inboxContent.innerHTML = '<div class="loading-placeholder">Gagal memuat data: ' + (error.message || 'Network error') + '</div>';
            }
        }
    }

    function renderInboxContent() {
        const container = document.getElementById('inboxContent');
        if (!container) return;
        
        if (!pendingList || pendingList.length === 0) {
            container.innerHTML = `
                <div class="inbox-empty">
                    <i class="fas fa-inbox"></i>
                    <p>Tidak ada verifikasi pending</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (const pending of pendingList) {
            const statusText = pending.status === 'pending' ? 'Menunggu' : pending.status;
            // Tampilkan icon berdasarkan verification_type yang dideteksi bot
            let typeIcon = '📢'; // default channel
            let typeText = 'Channel/Group';
            
            if (pending.verification_type === 'user') {
                typeIcon = '👤';
                typeText = 'User (OTP)';
            } else if (pending.verification_type === 'channel') {
                typeIcon = '📢';
                typeText = 'Channel/Group';
            } else if (pending.verification_type === 'auto') {
                typeIcon = '⏳';
                typeText = 'Menunggu deteksi...';
            }
            
            html += `
                <div class="inbox-item" data-id="${pending.id}" data-type="${pending.verification_type}">
                    <div class="inbox-icon">${typeIcon}</div>
                    <div class="inbox-info">
                        <div class="inbox-username">@${escapeHtml(pending.username)}</div>
                        <div class="inbox-price">${formatNumber(pending.price)} TON</div>
                        <div class="inbox-type">${typeText}</div>
                        <div class="inbox-status ${pending.status}">${statusText}</div>
                    </div>
                    <div class="inbox-actions">
                        ${pending.verification_type === 'user' ? 
                            `<button class="inbox-verify-btn" data-id="${pending.id}" data-username="${pending.username}" data-type="user">
                                <i class="fas fa-check-circle"></i>
                            </button>
                            <button class="inbox-reject-btn" data-id="${pending.id}" data-username="${pending.username}">
                                <i class="fas fa-times-circle"></i>
                            </button>` :
                            `<button class="inbox-verify-btn" data-id="${pending.id}" data-username="${pending.username}" data-type="channel">
                                <i class="fas fa-check-circle"></i>
                            </button>
                            <button class="inbox-reject-btn" data-id="${pending.id}" data-username="${pending.username}">
                                <i class="fas fa-times-circle"></i>
                            </button>`
                        }
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add event listeners to verify buttons
        document.querySelectorAll('.inbox-verify-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pendingId = btn.dataset.id;
                const username = btn.dataset.username;
                const type = btn.dataset.type;
                
                if (type === 'user') {
                    showOtpModal(pendingId, username);
                } else {
                    showConfirmModal(pendingId, username);
                }
            });
        });
        
        // Add event listeners to reject buttons
        document.querySelectorAll('.inbox-reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pendingId = btn.dataset.id;
                const username = btn.dataset.username;
                showRejectConfirmModal(pendingId, username);
            });
        });
    }

    // Perbaiki fungsi showOtpModal
    function showOtpModal(pendingId, username) {
        currentOtpPendingId = pendingId;
        const modal = document.getElementById('otpModal');
        const input = document.getElementById('otpInput');
        const title = document.querySelector('#otpModal h3');
        const desc = document.querySelector('#otpModal p');
        
        if (title) title.textContent = 'Verifikasi OTP';
        if (desc) desc.innerHTML = `Masukkan kode OTP 6 digit yang dikirim ke <strong>@${escapeHtml(username)}</strong>`;
        if (input) input.value = '';
        
        if (modal) {
            modal.style.display = 'flex';
            document.body.classList.add('modal-open');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }

    function showConfirmModal(pendingId, username) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 300px;">
                <h3>Konfirmasi Verifikasi</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    Apakah Anda yakin ingin memverifikasi username <strong>@${escapeHtml(username)}</strong>?
                </p>
                <div class="modal-buttons">
                    <button class="modal-cancel" id="cancelConfirmBtn">Batal</button>
                    <button class="modal-confirm" id="confirmVerifyBtn">Verifikasi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('confirmVerifyBtn').addEventListener('click', async () => {
            modal.remove();
            await confirmPendingUsername(pendingId);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Tambahkan fungsi untuk showRejectConfirmModal
    function showRejectConfirmModal(pendingId, username) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 300px;">
                <h3>Konfirmasi Penolakan</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    Apakah Anda yakin ingin menolak username <strong>@${escapeHtml(username)}</strong>?
                </p>
                <div class="modal-buttons">
                    <button class="modal-cancel" id="cancelRejectBtn">Batal</button>
                    <button class="modal-confirm" id="confirmRejectBtn" style="background: linear-gradient(135deg, var(--danger), #dc2626);">Tolak</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('cancelRejectBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('confirmRejectBtn').addEventListener('click', async () => {
            modal.remove();
            await rejectPendingUsername(pendingId);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async function confirmPendingUsername(pendingId) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pending_id: pendingId,
                    code: null  // Untuk channel/group, tidak perlu OTP
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil diverifikasi!', 'success');
                closeInboxPanel();
                await loadUsernames();
                await loadPendingCount();
            } else {
                showToast(data.error || 'Verifikasi gagal', 'error');
            }
        } catch (error) {
            console.error('Error confirming pending:', error);
            showToast('Error verifikasi', 'error');
        } finally {
            showLoading(false);
        }
    }

    async function rejectPendingUsername(pendingId) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pending_id: pendingId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username ditolak!', 'warning');
                closeInboxPanel();
                await loadPendingCount();
            } else {
                showToast(data.error || 'Gagal menolak', 'error');
            }
        } catch (error) {
            console.error('Error rejecting pending:', error);
            showToast('Error', 'error');
        } finally {
            showLoading(false);
        }
    }

    async function verifyOtp() {
        const otpInput = document.getElementById('otpInput');
        const otp = otpInput?.value.trim();
        
        if (!otp || otp.length !== 6) {
            showToast('Masukkan kode OTP 6 digit', 'warning');
            return;
        }
        
        if (!currentOtpPendingId) {
            showToast('Invalid pending ID', 'error');
            return;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pending_id: currentOtpPendingId,
                    code: otp
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil diverifikasi!', 'success');
                closeOtpModal();
                closeInboxPanel();
                await loadUsernames();
                await loadPendingCount();
            } else {
                hapticError();
                showToast(data.error || 'Verifikasi gagal', 'error');
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            showToast('Error verifikasi', 'error');
        } finally {
            showLoading(false);
        }
    }

    function closeOtpModal() {
        const modal = document.getElementById('otpModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        currentOtpPendingId = null;
    }

    function openInboxPanel() {
        const panel = document.getElementById('inboxPanel');
        if (panel) {
            panel.style.display = 'flex';
            loadPendingList();
            hapticLight();
        }
    }

    function closeInboxPanel() {
        const panel = document.getElementById('inboxPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    async function addUsername(username, price, category) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        // Clean username
        let cleanUsername = username.trim();
        if (cleanUsername.startsWith('@')) {
            cleanUsername = cleanUsername.substring(1);
        }
        
        // Validasi
        if (!cleanUsername) {
            showToast('Username tidak boleh kosong', 'warning');
            return false;
        }
        
        if (!price || price <= 0) {
            showToast('Harga harus lebih dari 0', 'warning');
            return false;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            const requestBody = {
                username: cleanUsername,
                price: parseFloat(price),
                seller_id: telegramUser.id,
                seller_wallet: walletAddress || '',
                category: category || 'default'
            };
            
            console.log('[DEBUG] Adding username:', requestBody);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/add`, {
                method: 'POST',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            console.log('[DEBUG] Add username response:', data);
            
            if (data.success) {
                hapticSuccess();
                showToast(data.message || 'Verifikasi akan diproses oleh bot!', 'success');
                await loadPendingCount();
                // Refresh inbox content if open
                const panel = document.getElementById('inboxPanel');
                if (panel && panel.style.display === 'flex') {
                    await loadPendingList();
                }
                return true;
            } else {
                // Tampilkan error dengan warna merah solid
                showToast(data.error || 'Gagal menambahkan username', 'error');
                return false;
            }
        } catch (error) {
            console.error('[DEBUG] Error adding username:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            return false;
        } finally {
            showLoading(false);
        }
    }

    async function deleteUsername(usernameId) {
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        hapticMedium();
        showLoading(true);
        
        try {
            console.log('[DEBUG] Deleting username:', usernameId);
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            console.log('[DEBUG] Delete response:', data);
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil dihapus!', 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal menghapus username', 'error');
                return false;
            }
        } catch (error) {
            console.error('[DEBUG] Error deleting username:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            return false;
        } finally {
            showLoading(false);
        }
    }

    // Perbaiki fungsi toggleListStatus
    async function toggleListStatus(usernameId, currentStatus) {
        if (!telegramUser) return false;
        
        const newStatus = currentStatus === 'available' ? 'unlisted' : 'available';
        
        hapticMedium();
        showLoading(true);
        
        try {
            console.log('[DEBUG] Toggling status:', { usernameId, currentStatus, newStatus });
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    status: newStatus,
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            console.log('[DEBUG] Toggle response:', data);
            
            if (data.success) {
                hapticSuccess();
                showToast(`Username ${newStatus === 'available' ? 'listed' : 'unlisted'}!`, 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal mengubah status', 'error');
                return false;
            }
        } catch (error) {
            console.error('[DEBUG] Error toggling status:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            return false;
        } finally {
            showLoading(false);
        }
    }

    function setupInboxEventListeners() {
        const inboxBtn = document.getElementById('inboxBtn');
        if (inboxBtn) {
            inboxBtn.addEventListener('click', openInboxPanel);
        }
        
        const closeInboxBtn = document.getElementById('closeInboxBtn');
        if (closeInboxBtn) {
            closeInboxBtn.addEventListener('click', closeInboxPanel);
        }
        
        // Close panel on outside click
        const panel = document.getElementById('inboxPanel');
        if (panel) {
            panel.addEventListener('click', (e) => {
                if (e.target === panel) {
                    closeInboxPanel();
                }
            });
        }
        
        // OTP Modal
        const cancelOtpBtn = document.getElementById('cancelOtpBtn');
        if (cancelOtpBtn) {
            cancelOtpBtn.addEventListener('click', closeOtpModal);
        }
        
        const confirmOtpBtn = document.getElementById('confirmOtpBtn');
        if (confirmOtpBtn) {
            confirmOtpBtn.addEventListener('click', verifyOtp);
        }
        
        const otpModal = document.getElementById('otpModal');
        if (otpModal) {
            otpModal.addEventListener('click', (e) => {
                if (e.target === otpModal) closeOtpModal();
            });
        }
        
        const otpInput = document.getElementById('otpInput');
        if (otpInput) {
            otpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') verifyOtp();
            });
        }
    }

    // ==================== FILTERING & SORTING ====================
        
    function filterAndRender() {
        let filtered = [...allUsernames];
        
        // Filter by search term - gunakan currentSearchTerm dari state
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(username => 
                username.username.toLowerCase().includes(term) ||
                username.category.toLowerCase().includes(term)
            );
        }
        
        // Filter by status
        if (currentStatus !== 'all') {
            filtered = filtered.filter(username => {
                const isListed = username.status === 'available';
                return currentStatus === 'listed' ? isListed : !isListed;
            });
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'price_asc':
                    return a.price - b.price;
                case 'price_desc':
                    return b.price - a.price;
                case 'name_asc':
                    return a.username.localeCompare(b.username);
                case 'name_desc':
                    return b.username.localeCompare(a.username);
                case 'date_desc':
                    return new Date(b.created_at) - new Date(a.created_at);
                default:
                    return a.price - b.price;
            }
        });
        
        renderUsernames(filtered);
    }

    async function fetchProfilePhoto(username) {
        // Cek cache dulu
        const cached = localStorage.getItem(`avatar_${username}`);
        if (cached && !cached.includes('ui-avatars.com') && cached.startsWith('data:image')) {
            return cached;
        }
        
        try {
            // Coba ambil dari endpoint utama
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (data.success && data.photo_url) {
                // Simpan ke cache jika bukan default avatar
                if (!data.photo_url.includes('ui-avatars.com')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                }
                return data.photo_url;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching profile photo:', error);
            return null;
        }
    }

    function renderUsernames(usernames) {
        if (!elements.usernameContainer) return;
        
        if (usernames.length === 0) {
            elements.usernameContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-animation" id="emptyAnimation"></div>
                    <div class="empty-title">No Usernames Yet</div>
                    <div class="empty-subtitle">Add your first username to get started</div>
                    <button class="empty-btn" id="emptyAddBtn">
                        <i class="fas fa-plus"></i> Add Username
                    </button>
                </div>
            `;
            loadTGSAnimation();
            const emptyAddBtn = document.getElementById('emptyAddBtn');
            if (emptyAddBtn) {
                emptyAddBtn.addEventListener('click', () => {
                    elements.addModal.style.display = 'flex';
                    hapticLight();
                });
            }
            return;
        }
        
        if (currentLayout === 'grid') {
            elements.usernameContainer.className = 'username-grid';
            let html = '';
            for (const username of usernames) {
                const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
                const statusClass = username.status === 'available' ? 'listed' : 'unlisted';
                
                // Pastikan username adalah string, bukan bytes
                let usernameStr = username.username;
                if (typeof usernameStr !== 'string') {
                    usernameStr = String(usernameStr);
                }
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                const firstChar = usernameStr.charAt(0) || 'U';
                
                // Avatar URL - coba ambil dari localStorage cache dulu
                let cachedAvatar = localStorage.getItem(`avatar_${usernameStr}`);
                let avatarUrl;
                
                if (cachedAvatar && !cachedAvatar.includes('ui-avatars.com')) {
                    avatarUrl = cachedAvatar;
                } else {
                    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstChar)}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=1`;
                }
                
                // Escape username untuk JSON
                const usernameData = {
                    id: username.id,
                    username: usernameStr,
                    category: username.category,
                    price: username.price,
                    seller_id: username.seller_id,
                    seller_wallet: username.seller_wallet,
                    status: username.status,
                    created_at: username.created_at
                };
                
                html += `
                    <div class="username-card" data-id="${username.id}" data-username='${JSON.stringify(usernameData)}'>
                        <div class="username-card-image">
                            <div class="card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fas fa-user\'></i>'">
                            </div>
                            <div class="card-username">@${escapeHtml(usernameStr)}</div>
                        </div>
                        <div class="username-card-info">
                            <div class="card-price-row">
                                <div class="price-with-logo">
                                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo">
                                    <span class="card-price">${formatNumber(username.price)}</span>
                                </div>
                                <div class="card-status ${statusClass}">${statusText}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            elements.usernameContainer.innerHTML = html;
            
            // Fetch foto profil asli secara async untuk setiap card
            for (const username of usernames) {
                let usernameStr = username.username;
                if (typeof usernameStr !== 'string') {
                    usernameStr = String(usernameStr);
                }
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                // Cek apakah sudah ada di cache dan bukan default
                let cachedAvatar = localStorage.getItem(`avatar_${usernameStr}`);
                if (!cachedAvatar || cachedAvatar.includes('ui-avatars.com')) {
                    // Fetch asynchronously
                    fetchProfilePhoto(usernameStr).then(photoUrl => {
                        if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
                            localStorage.setItem(`avatar_${usernameStr}`, photoUrl);
                            // Refresh card image jika card masih ada
                            const cardImg = document.querySelector(`.username-card[data-id="${username.id}"] .card-avatar img`);
                            if (cardImg && cardImg.src !== photoUrl) {
                                cardImg.src = photoUrl;
                            }
                        }
                    }).catch(error => {
                        console.error('Error fetching profile photo for', usernameStr, error);
                    });
                }
            }
            
        } else {
            // List layout
            elements.usernameContainer.className = 'username-list';
            let html = '';
            for (const username of usernames) {
                const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
                const statusClass = username.status === 'available' ? 'listed' : 'unlisted';
                
                // Pastikan username adalah string
                let usernameStr = username.username;
                if (typeof usernameStr !== 'string') {
                    usernameStr = String(usernameStr);
                }
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                html += `
                    <div class="username-item" data-id="${username.id}">
                        <div class="username-icon">
                            <i class="fas fa-tag"></i>
                        </div>
                        <div class="username-info">
                            <div class="username-name">${escapeHtml(usernameStr)}</div>
                            <div class="username-category">${escapeHtml(username.category)}</div>
                        </div>
                        <div class="username-price">${formatNumber(username.price)} TON</div>
                        <div class="username-status ${statusClass}">${statusText}</div>
                        <div class="list-actions">
                            <button class="list-action-btn toggle-status-btn" data-id="${username.id}" data-status="${username.status}">
                                <i class="fas fa-${username.status === 'available' ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button class="list-action-btn list-delete-btn delete-btn" data-id="${username.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            elements.usernameContainer.innerHTML = html;
        }
        
        // Attach event listeners untuk card (grid layout)
        document.querySelectorAll('.username-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                const usernameData = JSON.parse(card.dataset.username);
                showDetailPanel(usernameData);
            });
        });
        
        // Attach event listeners untuk list layout
        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const status = btn.dataset.status;
                toggleListStatus(id, status);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Yakin ingin menghapus username ini?')) {
                    deleteUsername(id);
                }
            });
        });
    }

    // Fungsi untuk mendapatkan avatar berdasarkan username
    function getAvatarForUsername(username) {
        // Gunakan API avatar dari ui-avatars
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=40a7e3&color=fff&size=120&rounded=true&bold=true&length=1`;
    }

    // Fungsi untuk edit harga username
    async function editPrice(usernameId, newPrice) {
        if (!telegramUser) return false;
        
        hapticMedium();
        showLoading(true);
        
        try {
            console.log('[DEBUG] Editing price:', { usernameId, newPrice });
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/edit-price`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_id: usernameId,
                    price: newPrice,
                    user_id: telegramUser.id
                })
            });
            
            const data = await response.json();
            console.log('[DEBUG] Edit price response:', data);
            
            if (data.success) {
                hapticSuccess();
                showToast('Harga berhasil diubah!', 'success');
                await loadUsernames();
                return true;
            } else {
                showToast(data.error || 'Gagal mengubah harga', 'error');
                return false;
            }
        } catch (error) {
            console.error('[DEBUG] Error editing price:', error);
            showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            return false;
        } finally {
            showLoading(false);
        }
    }

    // Fungsi untuk menampilkan modal edit price
    function showEditPriceModal(usernameId, currentPrice, currentStatus) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay edit-price-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 320px;">
                <h3>${currentStatus === 'available' ? 'Edit Harga' : 'Atur Harga'}</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    ${currentStatus === 'available' ? 'Ubah harga username Anda' : 'Masukkan harga untuk username ini'}
                </p>
                <input type="number" id="editPriceInput" placeholder="Harga (TON)" class="form-input price-input" step="0.1" min="0.1" value="${currentPrice}">
                <div class="modal-buttons">
                    <button class="btn-unlist" id="unlistBtn">
                        <i class="fas fa-eye-slash"></i> Unlist
                    </button>
                    <button class="btn-confirm" id="confirmEditPriceBtn">
                        <i class="fas fa-check"></i> Konfirmasi
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Focus pada input
        const priceInput = document.getElementById('editPriceInput');
        if (priceInput) setTimeout(() => priceInput.focus(), 100);
        
        // Tombol Unlist
        document.getElementById('unlistBtn').addEventListener('click', async () => {
            modal.remove();
            // Unlist username (set status menjadi unlisted)
            await toggleListStatus(usernameId, 'available');
        });
        
        // Tombol Konfirmasi Edit Harga
        document.getElementById('confirmEditPriceBtn').addEventListener('click', async () => {
            const newPrice = parseFloat(priceInput?.value);
            
            if (isNaN(newPrice) || newPrice <= 0) {
                showToast('Masukkan harga yang valid', 'warning');
                return;
            }
            
            modal.remove();
            await editPrice(usernameId, newPrice);
        });
        
        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Perbaiki fungsi showDetailPanel
    async function showDetailPanel(username) {
        // Hapus panel dan overlay yang sudah ada
        const existingPanel = document.querySelector('.detail-panel');
        const existingOverlay = document.querySelector('.panel-overlay');
        if (existingPanel) existingPanel.remove();
        if (existingOverlay) existingOverlay.remove();
        
        // Pastikan username adalah string yang bersih
        let usernameStr = username.username;
        if (typeof usernameStr !== 'string') {
            usernameStr = String(usernameStr);
        }
        usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
        
        const statusText = username.status === 'available' ? 'Listed' : 'Unlisted';
        const statusClass = username.status === 'available' ? 'listed' : 'unlisted';
        const createdAt = formatDateIndonesia(username.created_at);
        const isListed = username.status === 'available';
        
        // Ambil foto profil asli dari server
        let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(usernameStr.charAt(0) || 'U')}&background=40a7e3&color=fff&size=120&rounded=true&bold=true&length=1`;
        
        try {
            const photoUrl = await fetchProfilePhoto(usernameStr);
            if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
                avatarUrl = photoUrl;
            }
        } catch (error) {
            console.error('Error loading profile photo:', error);
        }
        
        // Buat overlay untuk blur
        const overlay = document.createElement('div');
        overlay.className = 'panel-overlay';
        document.body.appendChild(overlay);
        
        // Buat panel
        const panel = document.createElement('div');
        panel.className = 'detail-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3><i class="fas fa-info-circle"></i> Detail Username</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="detail-avatar">
                <div class="detail-avatar-img">
                    <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(usernameStr.charAt(0) || 'U')}&background=40a7e3&color=fff&size=120&rounded=true&bold=true&length=1'">
                </div>
                <div class="detail-username-badge">@${escapeHtml(usernameStr)}</div>
            </div>
            <div class="panel-content">
                <div class="detail-field">
                    <div class="detail-label">Harga</div>
                    <div class="detail-value price">${formatNumber(username.price)} TON</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Status</div>
                    <div class="detail-status ${statusClass}">${statusText}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Kategori</div>
                    <div class="detail-value">${escapeHtml(username.category || 'Default')}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">ID Username</div>
                    <div class="detail-value">#${username.id}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Ditambahkan Pada</div>
                    <div class="detail-value">${createdAt}</div>
                </div>
            </div>
            <div class="detail-actions">
                <button class="detail-action-btn edit-price-detail" data-id="${username.id}" data-price="${username.price}" data-status="${username.status}">
                    <i class="fas fa-${isListed ? 'edit' : 'tag'}"></i>
                    <span>${isListed ? 'Edit Harga' : 'Atur Harga'}</span>
                </button>
                <button class="detail-action-btn delete-detail" data-id="${username.id}">
                    <i class="fas fa-trash"></i>
                    <span>Delete</span>
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Prevent scroll pada body
        document.body.classList.add('panel-open');
        
        // Trigger animation
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        setTimeout(() => {
            panel.classList.add('open');
        }, 50);
        
        // Fungsi untuk menutup panel
        function closePanel() {
            panel.classList.remove('open');
            overlay.classList.remove('active');
            document.body.classList.remove('panel-open');
            setTimeout(() => {
                if (panel.parentNode) panel.remove();
                if (overlay.parentNode) overlay.remove();
            }, 300);
        }
        
        // Close button
        const closeBtn = panel.querySelector('.panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }
        
        // Klik pada overlay untuk menutup panel
        overlay.addEventListener('click', closePanel);
        
        // Action buttons
        const editBtn = panel.querySelector('.edit-price-detail');
        if (editBtn) {
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(editBtn.dataset.id);
                const price = parseFloat(editBtn.dataset.price);
                const status = editBtn.dataset.status;
                closePanel();
                setTimeout(() => {
                    showEditPriceModal(id, price, status);
                }, 300);
            });
        }
        
        const deleteBtn = panel.querySelector('.delete-detail');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm('Yakin ingin menghapus username ini?')) {
                    await deleteUsername(id);
                    closePanel();
                }
            });
        }
    }

    // Fungsi format tanggal Indonesia (Asia/Jakarta)
    function formatDateIndonesia(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    function loadTGSAnimation() {
        const container = document.getElementById('emptyAnimation');
        if (!container) return;
        
        // Load libraries yang diperlukan
        loadLibraries().then(() => {
            loadTGSFile(container);
        }).catch(err => {
            console.error('Error loading libraries:', err);
            container.innerHTML = '<i class="fas fa-inbox" style="font-size: 64px; color: var(--text-muted);"></i>';
        });
    }

    function loadLibraries() {
        return new Promise((resolve, reject) => {
            let loaded = 0;
            let total = 2;
            
            function checkLoaded() {
                loaded++;
                if (loaded === total) resolve();
            }
            
            // Load lottie-web
            if (typeof window.lottie === 'undefined') {
                const lottieScript = document.createElement('script');
                lottieScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
                lottieScript.onload = checkLoaded;
                lottieScript.onerror = reject;
                document.head.appendChild(lottieScript);
            } else {
                checkLoaded();
            }
            
            // Load pako
            if (typeof window.pako === 'undefined') {
                const pakoScript = document.createElement('script');
                pakoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                pakoScript.onload = checkLoaded;
                pakoScript.onerror = reject;
                document.head.appendChild(pakoScript);
            } else {
                checkLoaded();
            }
        });
    }

    async function loadTGSFile(container) {
        try {
            // Fetch file .tgs
            const response = await fetch('/image/none-username-storage.tgs');
            const arrayBuffer = await response.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            
            // Decompress dengan pako
            const decompressed = window.pako.ungzip(compressed, { to: 'string' });
            const animationData = JSON.parse(decompressed);
            
            // Render dengan lottie
            window.lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });
        } catch (error) {
            console.error('Error loading TGS file:', error);
            container.innerHTML = '<i class="fas fa-box-open" style="font-size: 64px; color: var(--text-muted);"></i>';
        }
    }

    // ==================== EVENT HANDLERS ====================
    function setupEventListeners() {
        // Action Row Buttons
        const addActionBtn = document.getElementById('addUsernameActionBtn');
        if (addActionBtn) {
            const newAddActionBtn = addActionBtn.cloneNode(true);
            addActionBtn.parentNode.replaceChild(newAddActionBtn, addActionBtn);
            
            newAddActionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[DEBUG] Add button clicked');
                if (elements.addModal) {
                    elements.addModal.style.display = 'flex';
                    // Reset form
                    if (elements.modalUsername) elements.modalUsername.value = '';
                    if (elements.modalPrice) elements.modalPrice.value = '';
                    if (elements.modalCategory) elements.modalCategory.value = 'default';
                    hapticLight();
                } else {
                    console.error('[DEBUG] addModal element not found');
                    // Fallback: coba cari modal dengan ID lain
                    const modal = document.getElementById('addModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        elements.addModal = modal;
                    }
                }
            });
        } else {
            console.warn('[DEBUG] addUsernameActionBtn not found');
            // Fallback: cari tombol dengan class atau ID alternatif
            const fallbackBtn = document.querySelector('.add-action-btn');
            if (fallbackBtn) {
                fallbackBtn.addEventListener('click', () => {
                    const modal = document.getElementById('addModal');
                    if (modal) modal.style.display = 'flex';
                });
            }
        }

        const sendBtn = document.getElementById('sendUsernameBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                showToast('Send username feature coming soon', 'info');
                hapticLight();
            });
        }

        const withdrawBtnAction = document.getElementById('withdrawUsernameBtn');
        if (withdrawBtnAction) {
            withdrawBtnAction.addEventListener('click', () => {
                showToast('Withdraw username feature coming soon', 'info');
                hapticLight();
            });
        }

        const offerBtn = document.getElementById('offerUsernameBtn');
        if (offerBtn) {
            offerBtn.addEventListener('click', () => {
                showToast('Offer username feature coming soon', 'info');
                hapticLight();
            });
        }

        // Back to home button
        const backToHomeBtn = document.getElementById('backToHomeBtn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                window.location.href = '/winedash';
            });
        }

        // Search
        if (elements.searchApplyBtn) {
            elements.searchApplyBtn.addEventListener('click', () => {
                currentSearchTerm = elements.searchInput?.value || '';
                filterAndRender();
                hapticLight();
            });
        }
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    currentSearchTerm = elements.searchInput.value;
                    filterAndRender();
                    hapticLight();
                }
            });
        }

        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                const navType = link.dataset.nav;
                
                if (navType === 'store') {
                    loadUsernames();
                } else if (navType === 'offers') {
                    showToast('Offers feature coming soon', 'info');
                } else if (navType === 'activity') {
                    showToast('Activity feature coming soon', 'info');
                }
                hapticLight();
            });
        });
        
        // Mode toggle
        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                loadUsernames();
                hapticLight();
            });
        });
        
        // Sort
        if (elements.sortBtn) {
            elements.sortBtn.addEventListener('click', () => {
                if (elements.sortDropdown.style.display === 'none') {
                    elements.sortDropdown.style.display = 'block';
                } else {
                    elements.sortDropdown.style.display = 'none';
                }
                hapticLight();
            });
        }
        
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', () => {
                currentSort = elements.sortSelect.value;
                filterAndRender();
                elements.sortDropdown.style.display = 'none';
                hapticLight();
            });
        }
        
        // Layout toggle
        if (elements.gridLayoutBtn) {
            elements.gridLayoutBtn.addEventListener('click', () => {
                currentLayout = 'grid';
                localStorage.setItem('storage_layout', 'grid');
                elements.gridLayoutBtn.classList.add('active');
                elements.listLayoutBtn.classList.remove('active');
                filterAndRender();
                hapticLight();
            });
        }

        if (currentLayout === 'grid') {
            if (elements.gridLayoutBtn) elements.gridLayoutBtn.classList.add('active');
            if (elements.listLayoutBtn) elements.listLayoutBtn.classList.remove('active');
        } else {
            if (elements.listLayoutBtn) elements.listLayoutBtn.classList.add('active');
            if (elements.gridLayoutBtn) elements.gridLayoutBtn.classList.remove('active');
        }

        if (elements.listLayoutBtn) {
            elements.listLayoutBtn.addEventListener('click', () => {
                currentLayout = 'list';
                localStorage.setItem('storage_layout', 'list');
                elements.listLayoutBtn.classList.add('active');
                elements.gridLayoutBtn.classList.remove('active');
                filterAndRender();
                hapticLight();
            });
        }
        
        // MODAL HANDLERS - PERBAIKAN UTAMA
        if (elements.cancelModalBtn) {
            // Hapus listener lama
            const newCancelBtn = elements.cancelModalBtn.cloneNode(true);
            elements.cancelModalBtn.parentNode.replaceChild(newCancelBtn, elements.cancelModalBtn);
            elements.cancelModalBtn = newCancelBtn;
            
            elements.cancelModalBtn.addEventListener('click', () => {
                console.log('[DEBUG] Cancel button clicked');
                if (elements.addModal) {
                    elements.addModal.style.display = 'none';
                    clearModal();
                }
            });
        }
        
        if (elements.confirmAddBtn) {
            // Hapus listener lama
            const newConfirmBtn = elements.confirmAddBtn.cloneNode(true);
            elements.confirmAddBtn.parentNode.replaceChild(newConfirmBtn, elements.confirmAddBtn);
            elements.confirmAddBtn = newConfirmBtn;
            
            elements.confirmAddBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[DEBUG] Confirm Add button clicked');
                
                const username = elements.modalUsername?.value.trim();
                const price = parseFloat(elements.modalPrice?.value);
                const category = elements.modalCategory?.value;
                
                console.log('[DEBUG] Form values:', { username, price, category });
                
                if (!username) {
                    showToast('Masukkan username', 'warning');
                    return;
                }
                
                if (isNaN(price) || price <= 0) {
                    showToast('Masukkan harga yang valid', 'warning');
                    return;
                }
                
                const success = await addUsername(username, price, category);
                
                if (success && elements.addModal) {
                    elements.addModal.style.display = 'none';
                    clearModal();
                    // Refresh daftar usernames
                    await loadUsernames();
                }
            });
        }
        
        // Close modal on overlay click
        if (elements.addModal) {
            elements.addModal.addEventListener('click', (e) => {
                if (e.target === elements.addModal) {
                    elements.addModal.style.display = 'none';
                    clearModal();
                }
            });
        }
    }

    // Balance Card Functions
    async function loadStorageBalance() {
        if (!telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success) {
                const balanceCard = document.getElementById('storageBalanceCard');
                if (balanceCard && data.user) {
                    const formattedBalance = parseFloat(data.user.balance).toFixed(2);
                    balanceCard.innerHTML = `
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                        <span class="balance-amount">${formattedBalance}</span>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    }

    function setupToggleButtons() {
        const toggleBtn = document.getElementById('toggleStatusBtn');
        
        if (toggleBtn) {
            // Pastikan button visible
            toggleBtn.style.display = 'flex';
            
            // Set initial state
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i><span>All</span>';
            toggleBtn.classList.remove('toggle-active', 'toggle-active-unlisted');
            
            // Remove existing listeners to avoid duplicates
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
            
            newToggleBtn.addEventListener('click', () => {
                if (currentStatus === 'all') {
                    currentStatus = 'listed';
                    newToggleBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Listed</span>';
                    newToggleBtn.classList.add('toggle-active');
                    newToggleBtn.classList.remove('toggle-active-unlisted');
                } else if (currentStatus === 'listed') {
                    currentStatus = 'unlisted';
                    newToggleBtn.innerHTML = '<i class="fas fa-times-circle"></i><span>Unlisted</span>';
                    newToggleBtn.classList.remove('toggle-active');
                    newToggleBtn.classList.add('toggle-active-unlisted');
                } else {
                    currentStatus = 'all';
                    newToggleBtn.innerHTML = '<i class="fas fa-eye"></i><span>All</span>';
                    newToggleBtn.classList.remove('toggle-active', 'toggle-active-unlisted');
                }
                filterAndRender();
                hapticLight();
            });
        } else {
            console.warn('Toggle button not found, creating fallback');
            // Fallback: create toggle button if not exists
            const actionBar = document.querySelector('.action-bar');
            if (actionBar) {
                const fallbackBtn = document.createElement('button');
                fallbackBtn.className = 'action-btn';
                fallbackBtn.id = 'toggleStatusBtn';
                fallbackBtn.innerHTML = '<i class="fas fa-eye"></i><span>All</span>';
                actionBar.insertBefore(fallbackBtn, actionBar.firstChild);
                setupToggleButtons(); // Recursive call
            }
        }
    }

    function setupSearch() {
        const searchInput = document.getElementById('searchStorage');
        const searchApplyBtn = document.getElementById('searchApplyBtn');
        
        if (searchApplyBtn) {
            searchApplyBtn.addEventListener('click', () => {
                const searchTerm = searchInput?.value || '';
                currentSearchTerm = searchTerm;
                filterAndRender();
                hapticLight();
            });
        }
        
        // Enter key juga bisa search
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    currentSearchTerm = searchInput.value;
                    filterAndRender();
                    hapticLight();
                }
            });
        }
    }

    function clearModal() {
        if (elements.modalUsername) elements.modalUsername.value = '';
        if (elements.modalPrice) elements.modalPrice.value = '';
        if (elements.modalCategory) elements.modalCategory.value = 'default';
    }

    function updateStorageUserUI() {
        if (!telegramUser) return;
        
        const avatarContainer = document.getElementById('storageUserAvatar');
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }

    // ==================== SAFE AREA INSET & FULLSCREEN ====================

    function applySafeAreaInsets() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.warn('Telegram WebApp not available');
            return;
        }
        
        // Gunakan CSS variables yang disediakan Telegram sebagai fallback
        const root = document.documentElement;
        
        const topInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-top')) || 0;
        const bottomInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-bottom')) || 0;
        const leftInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-left')) || 0;
        const rightInset = parseInt(getComputedStyle(root).getPropertyValue('--tg-safe-area-inset-right')) || 0;
        
        let safeTop = topInset;
        let safeBottom = bottomInset;
        let safeLeft = leftInset;
        let safeRight = rightInset;
        
        if (tg.safeAreaInset) {
            safeTop = tg.safeAreaInset.top || safeTop;
            safeBottom = tg.safeAreaInset.bottom || safeBottom;
            safeLeft = tg.safeAreaInset.left || safeLeft;
            safeRight = tg.safeAreaInset.right || safeRight;
        }
        
        document.body.style.paddingTop = `${safeTop}px`;
        document.body.style.paddingBottom = `${safeBottom}px`;
        document.body.style.paddingLeft = `${safeLeft}px`;
        document.body.style.paddingRight = `${safeRight}px`;
        
        let contentTop = safeTop;
        let contentBottom = safeBottom;
        
        if (tg.contentSafeAreaInset) {
            contentTop = tg.contentSafeAreaInset.top || safeTop;
            contentBottom = tg.contentSafeAreaInset.bottom || safeBottom;
        }
        
        const container = document.querySelector('.storage-container');
        if (container) {
            container.style.paddingTop = `${contentTop + 12}px`;
            container.style.paddingBottom = `${contentBottom + 90}px`;
        }
        
        console.log('✅ Storage safe area applied:', { safeTop, safeBottom, contentTop, contentBottom });
    }

    function initSafeArea() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        setTimeout(applySafeAreaInsets, 50);
        applySafeAreaInsets();
        
        if (tg.onEvent) {
            tg.onEvent('safeAreaChanged', () => applySafeAreaInsets());
            tg.onEvent('contentSafeAreaChanged', () => applySafeAreaInsets());
            tg.onEvent('viewportChanged', () => applySafeAreaInsets());
        }
    }

    function requestFullscreenMode() {
        const tg = window.Telegram?.WebApp;
        if (tg && typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen();
        }
    }

    function exitFullscreenMode() {
        const tg = window.Telegram?.WebApp;
        if (tg && typeof tg.exitFullscreen === 'function') {
            tg.exitFullscreen();
        }
    }

    // ==================== INITIALIZATION ====================
    
    function initTelegram() {
        const tg = getTelegramWebApp();
        if (tg) {
            tg.expand();
            tg.setHeaderColor('#0f0f0f');
            tg.setBackgroundColor('#0f0f0f');
            console.log('✅ Telegram WebApp initialized');
        }
    }
        
    async function init() {
        initTelegram();
        initSafeArea();
        showLoading(true);
        
        setupEventListeners();
        setupInboxEventListeners()
        
        setTimeout(() => {
            setupToggleButtons();
        }, 100);
        
        setupSearch();
        
        telegramUser = getTelegramUserFromWebApp();
        if (telegramUser) {
            updateStorageUserUI();
            await authenticateUser();
            await loadStorageBalance();
            await loadUsernames();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        showLoading(false);
        loadPendingCount()
        console.log('✅ Winedash Storage initialized');
    }
    init();
})();
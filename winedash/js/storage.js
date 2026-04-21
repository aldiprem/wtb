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
    let statusDropdownVisible = false;
    let currentSort = 'price_asc';
    let currentLayout = localStorage.getItem('storage_layout') || 'grid';
    let currentSearchTerm = '';
    let pendingList = [];
    let currentOtpPendingId = null;
    let lastUsernameCount = 0;
    let lastPendingCount = 0;
    let inboxOverlay = null;
    let detailOverlay = null;
    let currentAuctionsLayout = localStorage.getItem('auctions_layout') || 'grid';

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
            
            // Gunakan endpoint dengan user_id - PASTIKAN URL BENAR
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
            let typeIcon = '📢';
            let typeText = 'Channel/Group';
            let showVerifyButton = false;
            let showRejectButton = false;
            
            // Tentukan tipe dan ambil foto profil
            if (pending.verification_type === 'user') {
                typeIcon = '👤';
                typeText = 'User (Perlu OTP)';
                showVerifyButton = true;
                showRejectButton = true;
            } else if (pending.verification_type === 'channel') {
                typeIcon = '📢';
                typeText = 'Channel (Menunggu Admin)';
                showVerifyButton = false;
                showRejectButton = false;
            } else if (pending.verification_type === 'auto') {
                typeIcon = '⏳';
                typeText = 'Menunggu deteksi...';
                showVerifyButton = false;
                showRejectButton = false;
            } else if (pending.verification_type === 'supergroup') {
                typeIcon = '📢';
                typeText = 'Supergroup (Menunggu Admin)';
                showVerifyButton = false;
                showRejectButton = false;
            } else if (pending.verification_type === 'group') {
                typeIcon = '👥';
                typeText = 'Group (Menunggu Admin)';
                showVerifyButton = false;
                showRejectButton = false;
            }
            
            // Ambil foto profil untuk ditampilkan di inbox
            let avatarUrl = localStorage.getItem(`avatar_${pending.username}`);
            if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                avatarUrl = "https://companel.shop/image/winedash-logo.png";
                // Fetch async
                fetchProfilePhoto(pending.username).then(url => {
                    if (url) {
                        const avatarImg = document.querySelector(`.inbox-item[data-id="${pending.id}"] .inbox-avatar-img`);
                        if (avatarImg) avatarImg.src = url;
                    }
                });
            }
            
            // Info tambahan untuk channel/group
            let infoText = '';
            if (pending.verification_type !== 'user' && pending.verification_type !== 'auto') {
                infoText = '<div style="font-size: 10px; color: var(--warning); margin-top: 4px;">⏳ Menunggu konfirmasi dari admin channel/group</div>';
            }
            
            html += `
                <div class="inbox-item" data-id="${pending.id}" data-type="${pending.verification_type}">
                    <div class="inbox-avatar">
                        <img src="${avatarUrl}" alt="${escapeHtml(pending.username)}" class="inbox-avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                    </div>
                    <div class="inbox-info">
                        <div class="inbox-username">@${escapeHtml(pending.username)}</div>
                        <div class="inbox-price">${formatNumber(pending.price)} TON</div>
                        <div class="inbox-type">${typeText}</div>
                        <div class="inbox-status ${pending.status}">${statusText}</div>
                        ${infoText}
                    </div>
                    <div class="inbox-actions">
                        ${showVerifyButton ? 
                            `<button class="inbox-verify-btn" data-id="${pending.id}" data-username="${pending.username}" data-type="user" title="Verifikasi dengan OTP">
                                <i class="fas fa-check-circle"></i>
                            </button>` : 
                            (pending.verification_type !== 'auto' ? 
                                `<button class="inbox-verify-btn-disabled" disabled style="opacity:0.5; cursor:not-allowed;" title="Verifikasi harus dilakukan oleh admin channel/group">
                                    <i class="fas fa-clock"></i>
                                </button>` : '')
                        }
                        ${showRejectButton ? 
                            `<button class="inbox-reject-btn" data-id="${pending.id}" data-username="${pending.username}" title="Tolak verifikasi">
                                <i class="fas fa-times-circle"></i>
                            </button>` : ''
                        }
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.inbox-verify-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pendingId = btn.dataset.id;
                const username = btn.dataset.username;
                const type = btn.dataset.type;
                
                if (type === 'user') {
                    showOtpModal(pendingId, username);
                }
            });
        });
        
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
                    <br><br>
                    <small>⚠️ Verifikasi ini akan menambahkan username ke marketplace.</small>
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
            await confirmPendingUsername(pendingId, null);
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

    async function confirmPendingUsername(pendingId, code = null) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pending_id: pendingId,
                    code: code
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                hapticSuccess();
                showToast('Username berhasil diverifikasi!', 'success');
                closeInboxPanel();
                closeOtpModal();
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
                showToast(data.error || 'Verifikasi gagal, periksa kode OTP', 'error');
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
        if (!panel) return;
        
        // Buat overlay jika belum ada (hanya sekali)
        if (!inboxOverlay) {
            inboxOverlay = document.createElement('div');
            inboxOverlay.className = 'inbox-overlay';
            document.body.appendChild(inboxOverlay);
            
            // Klik overlay untuk menutup panel
            inboxOverlay.addEventListener('click', () => {
                closeInboxPanel();
            });
        }
        
        // Reset transform panel jika sebelumnya pernah di-drag
        panel.style.transform = '';
        panel.style.transition = '';
        
        // Tampilkan overlay
        inboxOverlay.classList.add('active');
        
        // Prevent scroll pada body
        document.body.classList.add('inbox-open');
        
        // Tampilkan panel dengan animasi
        panel.style.display = 'flex';
        
        // Trigger animation
        setTimeout(() => {
            panel.classList.add('open');
        }, 10);
        
        loadPendingList();
        hapticLight();
    }

    async function refreshProfilePhoto(username, imgElement) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                localStorage.setItem(`avatar_${username}`, data.photo_url);
                if (imgElement && imgElement.src !== data.photo_url) {
                    imgElement.src = data.photo_url;
                    console.log(`✅ Refreshed avatar for @${username}`);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error refreshing avatar for @${username}:`, error);
            return false;
        }
    }

    // Fungsi untuk refresh semua avatar yang masih default
    async function refreshAllDefaultAvatars() {
        const defaultAvatars = document.querySelectorAll('.username-card .card-avatar img[src*="winedash-logo.png"], .username-card .card-avatar img:not([src*="data:image"])');
        
        for (const img of defaultAvatars) {
            const card = img.closest('.username-card');
            if (card && card.dataset.username) {
                try {
                    const usernameData = JSON.parse(card.dataset.username.replace(/&#39;/g, "'"));
                    const usernameStr = usernameData.username;
                    
                    await refreshProfilePhoto(usernameStr, img);
                    await new Promise(resolve => setTimeout(resolve, 200)); // Delay agar tidak overload
                } catch (e) {
                    console.error('Error refreshing avatar:', e);
                }
            }
        }
    }

    // Panggil refresh setelah load usernames
    // Tambahkan di akhir fungsi loadUsernames
    async function loadUsernames() {
        showLoading(true);
        
        try {
            console.log('[DEBUG] Loading usernames...');
            const response = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const data = await response.json();
            
            console.log('[DEBUG] Load usernames response:', data);
            
            if (data.success && data.usernames) {
                if (telegramUser) {
                    allUsernames = data.usernames.filter(u => u.seller_id === telegramUser.id);
                    console.log(`[DEBUG] Filtered ${allUsernames.length} usernames for user ${telegramUser.id}`);
                } else {
                    allUsernames = data.usernames;
                }
                filterAndRender();
                
                // Refresh foto profil yang masih default setelah render
                setTimeout(() => {
                    refreshAllDefaultAvatars();
                }, 1000);
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

    async function fetchAndSaveProfilePhotoDirect(username) {
        try {
            console.log(`[DEBUG] Fetching profile photo directly for @${username}`);
            
            // Panggil endpoint yang akan memerintahkan bot untuk mengambil foto
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/fetch/${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.photo_url) {
                // Simpan ke cache
                localStorage.setItem(`avatar_${username}`, data.photo_url);
                console.log(`✅ Successfully fetched and saved profile photo for @${username}`);
                return data.photo_url;
            } else {
                console.log(`❌ No profile photo found for @${username}`);
                return null;
            }
        } catch (error) {
            console.error(`Error fetching profile photo for @${username}:`, error);
            return null;
        }
    }

    async function addUsername(username, price, basedOn) {
        console.log('[DEBUG] addUsername called with:', { username, price, basedOn });
        
        if (!telegramUser) {
            showToast('Login terlebih dahulu', 'warning');
            return false;
        }
        
        let cleanUsername = username.trim();
        if (cleanUsername.startsWith('@')) {
            cleanUsername = cleanUsername.substring(1);
        }
        
        if (!cleanUsername) {
            showToast('Username tidak boleh kosong', 'warning');
            return false;
        }
        
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(cleanUsername)) {
            showToast('Username hanya boleh berisi huruf, angka, dan underscore', 'warning');
            return false;
        }
        
        if (!basedOn || basedOn.trim() === '') {
            showToast('Based On (nama asli) tidak boleh kosong', 'warning');
            return false;
        }
        
        const clientValidation = validateBasedOnClient(cleanUsername, basedOn);
        if (!clientValidation.valid) {
            showToast(clientValidation.message, 'warning');
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
                based_on: basedOn.trim()
            };
            
            const response = await fetch(`${API_BASE_URL}/api/winedash/username/pending/add`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                hapticSuccess();
                showToast(data.message || 'Username akan diproses oleh bot!', 'success');
                await loadPendingCount();
                return true;
            } else {
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
            // Hapus event listener lama dengan clone
            const newInboxBtn = inboxBtn.cloneNode(true);
            inboxBtn.parentNode.replaceChild(newInboxBtn, inboxBtn);
            
            newInboxBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📥 Inbox button clicked');
                openInboxPanel();
            });
        }
        
        const closeInboxBtn = document.getElementById('closeInboxBtn');
        if (closeInboxBtn) {
            const newCloseBtn = closeInboxBtn.cloneNode(true);
            closeInboxBtn.parentNode.replaceChild(newCloseBtn, closeInboxBtn);
            
            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hapticLight();
                closeInboxPanel();
            });
        }
        
        // Setup drag to close untuk inbox panel
        const panel = document.getElementById('inboxPanel');
        if (panel) {
            // Tambahkan drag handle jika belum ada
            if (!panel.querySelector('.drag-handle')) {
                const dragHandle = document.createElement('div');
                dragHandle.className = 'drag-handle';
                panel.insertBefore(dragHandle, panel.firstChild);
            }
            
            let startY = 0;
            let currentY = 0;
            let isDragging = false;
            
            const dragHandleElem = panel.querySelector('.drag-handle');
            
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
                    const translateY = Math.min(deltaY, panel.offsetHeight * 0.7);
                    panel.style.transform = `translateY(${translateY}px)`;
                }
            };
            
            const onTouchEnd = (e) => {
                if (!isDragging) return;
                isDragging = false;
                panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
                
                const deltaY = currentY - startY;
                
                if (deltaY > 100) {
                    closeInboxPanel();
                } else {
                    panel.style.transform = '';
                }
            };
            
            if (dragHandleElem) {
                // Hapus listener lama
                const newDragHandle = dragHandleElem.cloneNode(true);
                dragHandleElem.parentNode.replaceChild(newDragHandle, dragHandleElem);
                
                newDragHandle.addEventListener('touchstart', onTouchStart);
                newDragHandle.addEventListener('touchmove', onTouchMove);
                newDragHandle.addEventListener('touchend', onTouchEnd);
            }
        }
        
        // OTP Modal
        const cancelOtpBtn = document.getElementById('cancelOtpBtn');
        if (cancelOtpBtn) {
            const newCancelBtn = cancelOtpBtn.cloneNode(true);
            cancelOtpBtn.parentNode.replaceChild(newCancelBtn, cancelOtpBtn);
            newCancelBtn.addEventListener('click', closeOtpModal);
        }
        
        const confirmOtpBtn = document.getElementById('confirmOtpBtn');
        if (confirmOtpBtn) {
            const newConfirmBtn = confirmOtpBtn.cloneNode(true);
            confirmOtpBtn.parentNode.replaceChild(newConfirmBtn, confirmOtpBtn);
            newConfirmBtn.addEventListener('click', verifyOtp);
        }
        
        const otpModal = document.getElementById('otpModal');
        if (otpModal) {
            otpModal.addEventListener('click', (e) => {
                if (e.target === otpModal) closeOtpModal();
            });
        }
        
        const otpInput = document.getElementById('otpInput');
        if (otpInput) {
            const newOtpInput = otpInput.cloneNode(true);
            otpInput.parentNode.replaceChild(newOtpInput, otpInput);
            newOtpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') verifyOtp();
            });
        }
    }

    // ==================== FILTERING & SORTING ====================
            
    function filterAndRender() {
        let filtered = [...allUsernames];
        
        // Filter by search term
        if (currentSearchTerm && currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(username => 
                username.username.toLowerCase().includes(term) ||
                (username.based_on && username.based_on.toLowerCase().includes(term))
            );
        }
        
        // Filter by status - PERBAIKAN untuk support pending dan auction
        if (currentStatus !== 'all') {
            filtered = filtered.filter(username => {
                switch(currentStatus) {
                    case 'listed':
                        return username.status === 'available';
                    case 'unlisted':
                        return username.status === 'unlisted';
                    case 'pending':
                        // Pending usernames are those in pending_usernames table
                        return username.status === 'pending';
                    case 'auction':
                        return username.status === 'on_auction';
                    default:
                        return true;
                }
            });
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'price_asc':
                    return (a.price || 0) - (b.price || 0);
                case 'price_desc':
                    return (b.price || 0) - (a.price || 0);
                case 'name_asc':
                    return (a.username || '').localeCompare(b.username || '');
                case 'name_desc':
                    return (b.username || '').localeCompare(a.username || '');
                case 'date_desc':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                default:
                    return (a.price || 0) - (b.price || 0);
            }
        });
        
        renderUsernames(filtered);
    }

    async function fetchProfilePhoto(username) {
        // Cek cache dulu
        const cached = localStorage.getItem(`avatar_${username}`);
        if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && !cached.includes('ui-avatars.com')) {
            return cached;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                // Simpan ke cache
                localStorage.setItem(`avatar_${username}`, data.photo_url);
                return data.photo_url;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching profile photo:', error);
            return null;
        }
    }

    async function autoRefreshAvatars() {
        const defaultAvatars = document.querySelectorAll('.username-card .card-avatar img[src*="winedash-logo.png"]');
        
        for (const img of defaultAvatars) {
            const username = img.dataset.username;
            if (!username) continue;
            
            // Cek di cache
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png') {
                if (img.src !== cached) {
                    img.src = cached;
                }
                continue;
            }
            
            // Fetch dari server
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                    console.log(`✅ Auto-refreshed avatar for @${username}`);
                }
            } catch (error) {
                console.error(`Error auto-refreshing avatar for @${username}:`, error);
            }
            
            // Delay agar tidak overload
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // Fungsi untuk memeriksa dan memperbarui foto profil yang masih default
    async function checkAndUpdateDefaultPhotos() {
        if (!telegramUser) return;
        
        // Ambil semua username yang fotonya masih default
        const cardsWithDefaultPhoto = document.querySelectorAll('.username-card .card-avatar img[src*="winedash-logo.png"], .username-card .card-avatar img[src*="ui-avatars.com"]');
        
        for (const img of cardsWithDefaultPhoto) {
            const card = img.closest('.username-card');
            if (card && card.dataset.username) {
                try {
                    const usernameData = JSON.parse(card.dataset.username);
                    const usernameStr = usernameData.username;
                    
                    const photoUrl = await fetchProfilePhoto(usernameStr);
                    if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
                        img.src = photoUrl;
                        console.log(`✅ Updated profile photo for @${usernameStr}`);
                    }
                } catch (e) {
                    console.error('Error updating card photo:', e);
                }
            }
        }
    }

    function getStatusTextAndClass(username) {
        if (username.status === 'on_auction') {
            return { text: 'ON AUCTION', class: 'on-auction' };
        } else if (username.status === 'available') {
            return { text: 'Listed', class: 'listed' };
        } else if (username.status === 'unlisted') {
            return { text: 'Unlisted', class: 'unlisted' };
        }
        return { text: 'Unknown', class: '' };
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
                    if (elements.addModal) elements.addModal.style.display = 'flex';
                    hapticLight();
                });
            }
            return;
        }
        
        if (currentLayout === 'grid') {
            elements.usernameContainer.className = 'username-grid';
            let html = '';
            for (const username of usernames) {
                const statusInfo = getStatusTextAndClass(username);
                const statusText = statusInfo.text;
                const statusClass = statusInfo.class;
                const isOnAuction = username.status === 'on_auction';
                
                let usernameStr = username.username;
                if (typeof usernameStr !== 'string') {
                    usernameStr = String(usernameStr);
                }
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                let avatarUrl = "https://companel.shop/image/winedash-logo.png";
                const cached = localStorage.getItem(`avatar_${usernameStr}`);
                if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                    avatarUrl = cached;
                }
                                
                const usernameData = {
                    id: username.id,
                    username: usernameStr,
                    based_on: username.based_on || '',
                    price: username.price,
                    seller_id: username.seller_id,
                    seller_wallet: username.seller_wallet,
                    status: username.status,
                    created_at: username.created_at,
                    auction_id: username.auction_id
                };

                html += `
                    <div class="username-card" data-id="${username.id}" data-username='${JSON.stringify(usernameData).replace(/'/g, "&#39;")}'>
                        <div class="username-card-image">
                            <div class="card-avatar">
                                <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" data-username="${usernameStr}" class="avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
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
            
            setTimeout(() => {
                fetchAllCardAvatars();
            }, 100);
        } else {
            // List layout
            elements.usernameContainer.className = 'username-list';
            let html = '';
            for (const username of usernames) {
                const statusInfo = getStatusTextAndClass(username);
                const statusText = statusInfo.text;
                const statusClass = statusInfo.class;
                
                let usernameStr = username.username;
                if (typeof usernameStr !== 'string') {
                    usernameStr = String(usernameStr);
                }
                usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
                
                const basedOnText = username.based_on || '-';
                
                let avatarUrl = localStorage.getItem(`avatar_${usernameStr}`);
                if (!avatarUrl || avatarUrl === 'https://companel.shop/image/winedash-logo.png') {
                    avatarUrl = "https://companel.shop/image/winedash-logo.png";
                }
                                
                const usernameData = {
                    id: username.id,
                    username: usernameStr,
                    based_on: username.based_on || '',
                    price: username.price,
                    seller_id: username.seller_id,
                    seller_wallet: username.seller_wallet,
                    status: username.status,
                    created_at: username.created_at,
                    auction_id: username.auction_id
                };

                html += `
                    <div class="username-item" data-id="${username.id}" data-username='${JSON.stringify(usernameData).replace(/'/g, "&#39;")}'>
                        <div class="username-avatar">
                            <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" class="username-avatar-img" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                        </div>
                        <div class="username-info">
                            <div class="username-name">@${escapeHtml(usernameStr)}</div>
                            <div class="username-basedon" style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(basedOnText)}</div>
                        </div>
                        <div class="username-price-wrapper">
                            <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="price-logo-small">
                            <span class="username-price">${formatNumber(username.price)}</span>
                        </div>
                        <div class="username-status ${statusClass}">${statusText}</div>
                    </div>
                `;
            }
            elements.usernameContainer.innerHTML = html;
            
            document.querySelectorAll('.username-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    try {
                        const usernameData = JSON.parse(item.dataset.username.replace(/&#39;/g, "'"));
                        showDetailPanel(usernameData);
                    } catch (err) {
                        console.error('Error parsing username data:', err);
                    }
                });
            });
            
            setTimeout(() => {
                fetchAllListAvatars();
            }, 100);
        }

        document.querySelectorAll('.username-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                try {
                    const usernameData = JSON.parse(card.dataset.username.replace(/&#39;/g, "'"));
                    showDetailPanel(usernameData);
                } catch (err) {
                    console.error('Error parsing username data:', err);
                }
            });
        });
    }

    async function fetchAllListAvatars() {
        const avatars = document.querySelectorAll('.username-list .username-avatar-img');
        
        for (const img of avatars) {
            const parentItem = img.closest('.username-item');
            if (!parentItem) continue;
            
            let username = null;
            try {
                const usernameData = JSON.parse(parentItem.dataset.username.replace(/&#39;/g, "'"));
                username = usernameData.username;
            } catch (e) {
                continue;
            }
            
            if (!username) continue;
            
            // Cek cache
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                if (img.src !== cached) {
                    img.src = cached;
                }
                continue;
            }
            
            // Fetch dari server
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                    console.log(`✅ Fetched avatar for @${username} (list view)`);
                }
            } catch (error) {
                console.error(`Error fetching avatar for @${username}:`, error);
            }
            
            // Delay agar tidak overload
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async function fetchAllCardAvatars() {
        const avatars = document.querySelectorAll('.username-card .card-avatar img.avatar-img');
        
        for (const img of avatars) {
            const username = img.dataset.username;
            if (!username) continue;
            
            // Cek cache
            const cached = localStorage.getItem(`avatar_${username}`);
            if (cached && cached !== 'https://companel.shop/image/winedash-logo.png' && cached.startsWith('data:image')) {
                if (img.src !== cached) {
                    img.src = cached;
                }
                continue;
            }
            
            // Fetch dari server
            try {
                const response = await fetch(`${API_BASE_URL}/api/winedash/profile-photo/${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.success && data.photo_url && data.photo_url.startsWith('data:image')) {
                    localStorage.setItem(`avatar_${username}`, data.photo_url);
                    img.src = data.photo_url;
                    console.log(`✅ Fetched avatar for @${username}`);
                }
            } catch (error) {
                console.error(`Error fetching avatar for @${username}:`, error);
            }
            
            // Delay agar tidak overload
            await new Promise(resolve => setTimeout(resolve, 100));
        }
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

    function showEditPriceModal(usernameId, currentPrice, currentStatus) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay edit-price-modal';
        modal.style.display = 'flex';
        
        // Tentukan teks tombol berdasarkan status
        const isListed = currentStatus === 'available';
        const actionBtnText = isListed ? 'Unlist' : 'List';
        const actionBtnIcon = isListed ? 'fa-eye-slash' : 'fa-eye';
        const actionBtnClass = isListed ? 'btn-unlist' : 'btn-list';
        const modalTitle = isListed ? 'Edit Harga' : 'Atur Harga';
        const modalDesc = isListed ? 'Ubah harga username Anda' : 'Masukkan harga untuk username ini';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 320px;">
                <h3>${modalTitle}</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    ${modalDesc}
                </p>
                <div class="price-with-logo" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;">
                    <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 24px; height: 24px;">
                    <input type="number" id="editPriceInput" placeholder="Harga (TON)" class="form-input price-input" step="0.1" min="0.1" value="${currentPrice}" style="width: auto; flex: 1; text-align: center;">
                </div>
                <div class="modal-buttons">
                    <button class="${actionBtnClass}" id="actionStatusBtn">
                        <i class="fas ${actionBtnIcon}"></i> ${actionBtnText}
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
        
        // Tombol untuk mengubah status (List/Unlist)
        document.getElementById('actionStatusBtn').addEventListener('click', async () => {
            modal.remove();
            // Jika status saat ini available (listed), maka unlist, jika unlisted maka list
            const newStatus = currentStatus === 'available' ? 'unlisted' : 'available';
            await toggleListStatus(usernameId, currentStatus);
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

    async function showDetailPanel(username) {
        const existingPanel = document.querySelector('.detail-panel');
        if (existingPanel) existingPanel.remove();
        
        if (!detailOverlay) {
            detailOverlay = document.createElement('div');
            detailOverlay.className = 'panel-overlay';
            document.body.appendChild(detailOverlay);
            
            detailOverlay.addEventListener('click', () => {
                closeDetailPanel();
            });
        }
        
        let usernameStr = username.username;
        if (typeof usernameStr !== 'string') {
            usernameStr = String(usernameStr);
        }
        usernameStr = usernameStr.replace(/^b['"]|['"]$/g, '');
        
        const statusInfo = getStatusTextAndClass(username);
        const statusText = statusInfo.text;
        const statusClass = statusInfo.class;
        const createdAt = formatDateIndonesia(username.created_at);
        const isListed = username.status === 'available';
        const isOnAuction = username.status === 'on_auction';
        
        let avatarUrl = "https://companel.shop/image/winedash-logo.png";
        
        const cached = localStorage.getItem(`avatar_${usernameStr}`);
        if (cached && !cached.includes('winedash-logo.png') && !cached.includes('ui-avatars.com')) {
            avatarUrl = cached;
        } else {
            fetchProfilePhoto(usernameStr).then(photoUrl => {
                if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
                    const detailImg = document.querySelector('.detail-panel .detail-avatar-img img');
                    if (detailImg && detailImg.src !== photoUrl) {
                        detailImg.src = photoUrl;
                    }
                }
            }).catch(console.error);
        }
        
        // Tentukan action button berdasarkan status
        let actionButtons = '';
        if (isOnAuction) {
            actionButtons = `
                <button class="detail-action-btn view-auction-detail" data-id="${username.id}" data-auction-id="${username.auction_id || ''}">
                    <i class="fas fa-gavel"></i>
                    <span>View Auction</span>
                </button>
                <button class="detail-action-btn delete-detail" data-id="${username.id}">
                    <i class="fas fa-trash"></i>
                    <span>Delete</span>
                </button>
            `;
        } else {
            actionButtons = `
                <button class="detail-action-btn edit-price-detail" data-id="${username.id}" data-price="${username.price}" data-status="${username.status}">
                    <i class="fas fa-${isListed ? 'edit' : 'tag'}"></i>
                    <span>${isListed ? 'Edit Harga' : 'Atur Harga'}</span>
                </button>
                <button class="detail-action-btn delete-detail" data-id="${username.id}">
                    <i class="fas fa-trash"></i>
                    <span>Delete</span>
                </button>
            `;
        }
        
        const panel = document.createElement('div');
        panel.className = 'detail-panel';
        panel.innerHTML = `
            <div class="drag-handle"></div>
            <div class="panel-header">
                <h3><i class="fas fa-info-circle"></i> Detail Username</h3>
                <button class="panel-close">&times;</button>
            </div>
            <div class="detail-avatar">
                <div class="detail-avatar-img">
                    <img src="${avatarUrl}" alt="${escapeHtml(usernameStr)}" data-username="${usernameStr}" onerror="this.src='https://companel.shop/image/winedash-logo.png'">
                </div>
                <div class="detail-username-badge">@${escapeHtml(usernameStr)}</div>
            </div>
            <div class="panel-content">
                <div class="detail-field">
                    <div class="detail-label">Based On</div>
                    <div class="detail-value">${escapeHtml(username.based_on || '-')}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Harga</div>
                    <div class="detail-value price">
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;">
                        ${formatNumber(username.price)}
                    </div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Status</div>
                    <div class="detail-status ${statusClass}">${statusText}</div>
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
                ${actionButtons}
            </div>
        `;
        
        document.body.appendChild(panel);
        setupDragToClose(panel);
        document.body.classList.add('panel-open');
        detailOverlay.classList.add('active');
        setTimeout(() => {
            panel.classList.add('open');
        }, 50);
        
        const closeBtn = panel.querySelector('.panel-close');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hapticLight();
                closeDetailPanel();
            });
        }
        
        // Edit price button
        const editBtn = panel.querySelector('.edit-price-detail');
        if (editBtn) {
            const newEditBtn = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            newEditBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(newEditBtn.dataset.id);
                const price = parseFloat(newEditBtn.dataset.price);
                const status = newEditBtn.dataset.status;
                closeDetailPanel();
                setTimeout(() => {
                    showEditPriceModal(id, price, status);
                }, 300);
            });
        }
        
        // View Auction button (untuk username yang sedang on auction)
        const viewAuctionBtn = panel.querySelector('.view-auction-detail');
        if (viewAuctionBtn) {
            const newViewAuctionBtn = viewAuctionBtn.cloneNode(true);
            viewAuctionBtn.parentNode.replaceChild(newViewAuctionBtn, viewAuctionBtn);
            newViewAuctionBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const auctionId = newViewAuctionBtn.dataset.auctionId;
                closeDetailPanel();
                // Redirect ke halaman storage dengan mode auctions dan tab active
                window.location.href = `/winedash/storage?mode=auctions&tab=active&auction=${auctionId}`;
            });
        }
        
        // Delete button
        const deleteBtn = panel.querySelector('.delete-detail');
        if (deleteBtn) {
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(newDeleteBtn.dataset.id);
                if (confirm('Yakin ingin menghapus username ini?')) {
                    hapticMedium();
                    await deleteUsername(id);
                    closeDetailPanel();
                }
            });
        }
    }

    function closeDetailPanel() {
        const panel = document.querySelector('.detail-panel');
        const overlay = document.querySelector('.panel-overlay');
        
        if (panel) {
            panel.classList.remove('open');
            // Hapus panel setelah animasi selesai
            setTimeout(() => {
                if (panel && panel.parentNode) panel.remove();
            }, 300);
        }
        
        if (overlay) {
            overlay.classList.remove('active');
            // JANGAN hapus overlay, hanya sembunyikan
            // overlay akan digunakan lagi nanti
        }
        
        document.body.classList.remove('panel-open');
        
        hapticLight();
    }

    function closeInboxPanel() {
        const panel = document.getElementById('inboxPanel');
        if (!panel) return;
        
        panel.classList.remove('open');
        
        if (inboxOverlay) {
            inboxOverlay.classList.remove('active');
        }
        
        // Allow scroll
        document.body.classList.remove('inbox-open');
        
        setTimeout(() => {
            if (panel.style.display !== 'none') {
                panel.style.display = 'none';
            }
        }, 300);
        
        hapticLight();
    }

    // Fungsi untuk drag to close panel
    function setupDragToClose(panel) {
        const dragHandle = panel.querySelector('.drag-handle');
        if (!dragHandle) return;
        
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
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
                const translateY = Math.min(deltaY, panel.offsetHeight * 0.7);
                panel.style.transform = `translateY(${translateY}px)`;
            }
        };
        
        const onTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            
            const deltaY = currentY - startY;
            
            if (deltaY > 100) {
                // Swipe cukup jauh -> tutup panel
                closeDetailPanel();
            } else {
                // Kembalikan ke posisi semula
                panel.style.transform = '';
            }
        };
        
        dragHandle.addEventListener('touchstart', onTouchStart);
        dragHandle.addEventListener('touchmove', onTouchMove);
        dragHandle.addEventListener('touchend', onTouchEnd);
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
                    if (elements.modalUsername) elements.modalUsername.value = '';
                    if (elements.modalPrice) elements.modalPrice.value = '';
                    const basedOnInput = document.getElementById('modalBasedOn');
                    if (basedOnInput) basedOnInput.value = '';
                    hapticLight();
                }
            });
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
                                        
        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                
                const fixPriceSection = document.getElementById('fixPriceSection');
                const auctionsSection = document.getElementById('auctionsSection');
                
                if (currentMode === 'fixprice') {
                    // Fix Price mode
                    if (fixPriceSection) fixPriceSection.style.display = 'block';
                    if (auctionsSection) auctionsSection.style.display = 'none';
                    loadUsernames();
                } else {
                    // Auctions mode
                    console.log('🔄 Switching to Auctions mode');
                    if (fixPriceSection) fixPriceSection.style.display = 'none';
                    if (auctionsSection) auctionsSection.style.display = 'block';
                    
                    // Reset auctions container
                    const auctionsContainer = document.getElementById('auctionsContainer');
                    if (auctionsContainer) {
                        auctionsContainer.innerHTML = '<div class="loading-placeholder">Memuat auctions...</div>';
                    }
                    
                    // Reset module loaded flag untuk reload ulang
                    window.auctionsModuleLoaded = false;
                    window.auctionsModuleLoading = false;
                    
                    // Load auctions module
                    loadAuctionsModule();
                }
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
        
        // MODAL HANDLERS
        if (elements.cancelModalBtn) {
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

        // ==================== CONFIRM ADD BUTTON HANDLER ====================
        if (elements.confirmAddBtn) {
            const newConfirmBtn = elements.confirmAddBtn.cloneNode(true);
            elements.confirmAddBtn.parentNode.replaceChild(newConfirmBtn, elements.confirmAddBtn);
            elements.confirmAddBtn = newConfirmBtn;
            
            const getBasedOnInput = () => document.getElementById('modalBasedOn');
            const getBasedOnError = () => document.getElementById('basedOnError');
            const getUsernameInput = () => document.getElementById('modalUsername');
            const getPriceInput = () => document.getElementById('modalPrice');
            
            function updateBasedOnValidation() {
                const basedOnInput = getBasedOnInput();
                const basedOnError = getBasedOnError();
                const usernameInput = getUsernameInput();
                
                if (!basedOnInput || !basedOnError) return;
                
                const username = usernameInput?.value.trim() || '';
                const value = basedOnInput.value.trim();
                
                if (value === '') {
                    basedOnError.style.display = 'block';
                    basedOnError.textContent = 'Based On tidak boleh kosong';
                    basedOnError.style.color = '#ef4444';
                    basedOnInput.classList.add('error');
                    return;
                }
                
                if (username === '') {
                    basedOnError.style.display = 'block';
                    basedOnError.textContent = 'Masukkan username terlebih dahulu';
                    basedOnError.style.color = '#f59e0b';
                    basedOnInput.classList.add('error');
                    return;
                }
                
                const validation = validateBasedOnClient(username, value);
                
                if (validation.valid) {
                    basedOnError.style.display = 'block';
                    basedOnError.textContent = validation.message;
                    basedOnError.style.color = '#10b981';
                    basedOnInput.classList.remove('error');
                } else {
                    basedOnError.style.display = 'block';
                    basedOnError.textContent = validation.message;
                    basedOnError.style.color = '#ef4444';
                    basedOnInput.classList.add('error');
                }
            }
            
            const basedOnInputElem = getBasedOnInput();
            const usernameInputElem = getUsernameInput();
            
            if (basedOnInputElem) {
                basedOnInputElem.addEventListener('input', updateBasedOnValidation);
                basedOnInputElem.addEventListener('blur', updateBasedOnValidation);
            }
            
            if (usernameInputElem) {
                usernameInputElem.addEventListener('input', updateBasedOnValidation);
            }
            
            elements.confirmAddBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[DEBUG] Confirm Add button clicked');
                
                const usernameInput = getUsernameInput();
                const priceInput = getPriceInput();
                const basedOnInput = getBasedOnInput();
                const basedOnError = getBasedOnError();
                
                const username = usernameInput?.value.trim();
                const price = priceInput ? parseFloat(priceInput.value) : NaN;
                const basedOn = basedOnInput?.value.trim();
                
                console.log('[DEBUG] Form values:', { username, price, basedOn });
                
                if (!username) {
                    showToast('Masukkan username', 'warning');
                    return;
                }
                
                if (!basedOn) {
                    showToast('Masukkan Based On (nama asli)', 'warning');
                    if (basedOnInput) {
                        basedOnInput.classList.add('error');
                        if (basedOnError) {
                            basedOnError.style.display = 'block';
                            basedOnError.textContent = 'Based On tidak boleh kosong';
                        }
                    }
                    return;
                }
                
                const validation = validateBasedOnClient(username, basedOn);
                if (!validation.valid) {
                    showToast(validation.message, 'warning');
                    if (basedOnInput) {
                        basedOnInput.classList.add('error');
                        if (basedOnError) {
                            basedOnError.style.display = 'block';
                            basedOnError.textContent = validation.message;
                        }
                    }
                    return;
                }
                
                if (isNaN(price) || price <= 0) {
                    showToast('Masukkan harga yang valid', 'warning');
                    return;
                }
                
                const originalText = elements.confirmAddBtn.innerHTML;
                elements.confirmAddBtn.disabled = true;
                elements.confirmAddBtn.innerHTML = '<span class="btn-loading"></span> Menambahkan...';
                
                try {
                    const success = await addUsername(username, price, basedOn);
                    
                    if (success && elements.addModal) {
                        elements.addModal.style.display = 'none';
                        clearModal();
                        if (basedOnInput) basedOnInput.classList.remove('error');
                        if (basedOnError) basedOnError.style.display = 'none';
                        await loadUsernames();
                    }
                } catch (error) {
                    console.error('[DEBUG] Error in confirm handler:', error);
                    showToast('Terjadi kesalahan, coba lagi', 'error');
                } finally {
                    elements.confirmAddBtn.disabled = false;
                    elements.confirmAddBtn.innerHTML = originalText;
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

    function setupAuctionsFilterAndActivity() {
        const filterBtn = document.getElementById('auctionsFilterBtn');
        const activityBtn = document.getElementById('auctionsActivityBtn');
        let filterDropdown = document.getElementById('auctionsFilterDropdown');
        let activityPanel = document.getElementById('auctionsActivityPanel');
        let activityOverlay = null;
        let currentAuctionsFilter = 'all';
        let activityModuleLoaded = false;
        
        // Buat overlay untuk activity panel
        function createActivityOverlay() {
            if (!activityOverlay) {
                activityOverlay = document.createElement('div');
                activityOverlay.className = 'inbox-overlay';
                document.body.appendChild(activityOverlay);
                activityOverlay.addEventListener('click', closeActivityPanel);
            }
            return activityOverlay;
        }
        
        // Close activity panel
        function closeActivityPanel() {
            if (activityPanel) {
                activityPanel.classList.remove('open');
                if (activityOverlay) activityOverlay.classList.remove('active');
                document.body.classList.remove('inbox-open');
                setTimeout(() => {
                    if (activityPanel) activityPanel.style.display = 'none';
                }, 300);
            }
            hapticLight();
        }
        
        // Load activity module
        function loadActivityModule() {
            if (activityModuleLoaded) {
                if (typeof window.refreshAuctionsActivity === 'function') {
                    window.refreshAuctionsActivity();
                }
                return;
            }
            
            const script = document.createElement('script');
            script.src = '/winedash/js/auctions-activity.js?v=' + Date.now();
            script.onload = () => {
                activityModuleLoaded = true;
                console.log('✅ Auctions activity module loaded');
                if (typeof window.initAuctionsActivity === 'function') {
                    window.initAuctionsActivity();
                }
            };
            script.onerror = () => {
                console.error('❌ Failed to load auctions activity module');
                const content = document.getElementById('auctionsActivityContainer');
                if (content) {
                    content.innerHTML = '<div class="loading-placeholder">Gagal memuat aktivitas. Refresh halaman.</div>';
                }
            };
            document.head.appendChild(script);
        }
        
        // Open activity panel
        function openActivityPanel() {
            if (!activityPanel) return;
            
            createActivityOverlay();
            activityPanel.style.display = 'flex';
            activityOverlay.classList.add('active');
            document.body.classList.add('inbox-open');
            
            setTimeout(() => activityPanel.classList.add('open'), 10);
            
            // Load activity module
            loadActivityModule();
            hapticLight();
        }
        
        // Setup filter dropdown (sama seperti sebelumnya)
        function setupFilterDropdown() {
            if (!filterBtn || !filterDropdown) return;
            
            const newFilterBtn = filterBtn.cloneNode(true);
            filterBtn.parentNode.replaceChild(newFilterBtn, filterBtn);
            
            let isOpen = false;
            
            function positionDropdown() {
                const rect = newFilterBtn.getBoundingClientRect();
                filterDropdown.style.top = `${rect.bottom + 5}px`;
                filterDropdown.style.left = `${rect.left}px`;
                filterDropdown.style.minWidth = `${rect.width}px`;
            }
            
            function closeDropdown() {
                if (filterDropdown) {
                    filterDropdown.style.display = 'none';
                    isOpen = false;
                }
                document.removeEventListener('click', handleClickOutside);
            }
            
            function handleClickOutside(e) {
                if (filterDropdown && !filterDropdown.contains(e.target) && e.target !== newFilterBtn) {
                    closeDropdown();
                }
            }
            
            function openDropdown() {
                positionDropdown();
                filterDropdown.style.display = 'block';
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
                hapticLight();
            });
            
            // Filter options
            filterDropdown.querySelectorAll('.status-dropdown-item').forEach(item => {
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                
                newItem.addEventListener('click', () => {
                    const filterValue = newItem.dataset.auctionsFilter;
                    currentAuctionsFilter = filterValue;
                    
                    filterDropdown.querySelectorAll('.status-dropdown-item').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    newItem.classList.add('active');
                    
                    const filterText = newItem.querySelector('span')?.textContent || 'Filter';
                    newFilterBtn.innerHTML = `<i class="fas fa-filter"></i><span>${filterText}</span>`;
                    
                    closeDropdown();
                    
                    if (typeof window.switchAuctionTab === 'function') {
                        let tab = 'active';
                        if (filterValue === 'all') tab = 'active';
                        else if (filterValue === 'active') tab = 'active';
                        else if (filterValue === 'ended') tab = 'ended';
                        else if (filterValue === 'my-bids') tab = 'my-bids';
                        window.switchAuctionTab(tab);
                    }
                    
                    hapticLight();
                });
            });
            
            window.addEventListener('scroll', () => {
                if (isOpen) positionDropdown();
            });
            
            window.addEventListener('resize', () => {
                if (isOpen) positionDropdown();
            });
        }
        
        // Setup activity button
        if (activityBtn) {
            const newActivityBtn = activityBtn.cloneNode(true);
            activityBtn.parentNode.replaceChild(newActivityBtn, activityBtn);
            
            newActivityBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openActivityPanel();
            });
        }
        
        // Setup activity panel close
        const closeActivityBtn = document.getElementById('closeActivityPanelBtn');
        if (closeActivityBtn) {
            const newCloseBtn = closeActivityBtn.cloneNode(true);
            closeActivityBtn.parentNode.replaceChild(newCloseBtn, closeActivityBtn);
            newCloseBtn.addEventListener('click', closeActivityPanel);
        }
        
        // Setup drag to close untuk activity panel
        if (activityPanel) {
            const dragHandle = activityPanel.querySelector('.drag-handle');
            if (dragHandle) {
                let startY = 0, currentY = 0, isDragging = false;
                
                const newDragHandle = dragHandle.cloneNode(true);
                dragHandle.parentNode.replaceChild(newDragHandle, dragHandle);
                
                newDragHandle.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    isDragging = true;
                    activityPanel.style.transition = 'none';
                    hapticLight();
                });
                
                newDragHandle.addEventListener('touchmove', (e) => {
                    if (!isDragging) return;
                    currentY = e.touches[0].clientY;
                    const deltaY = currentY - startY;
                    if (deltaY > 0) {
                        activityPanel.style.transform = `translateY(${Math.min(deltaY, activityPanel.offsetHeight * 0.7)}px)`;
                    }
                });
                
                newDragHandle.addEventListener('touchend', () => {
                    isDragging = false;
                    activityPanel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
                    if (currentY - startY > 100) {
                        closeActivityPanel();
                    } else {
                        activityPanel.style.transform = '';
                    }
                });
            }
        }
        
        setupFilterDropdown();
    }

    // Tambahkan fungsi global untuk switch ke mode auctions
    window.switchToAuctionsMode = function() {
        const auctionsModeBtn = document.querySelector('.mode-btn[data-mode="auctions"]');
        if (auctionsModeBtn) {
            auctionsModeBtn.click();
        }
    };

    // Perbaiki fungsi layout toggle di auctions section
    function setupAuctionsLayoutToggle() {
        const auctionsGridBtn = document.getElementById('auctionsGridBtn');
        const auctionsListBtn = document.getElementById('auctionsListBtn');
        
        if (!auctionsGridBtn || !auctionsListBtn) return;
        
        // Hapus event listener lama
        const newGridBtn = auctionsGridBtn.cloneNode(true);
        const newListBtn = auctionsListBtn.cloneNode(true);
        auctionsGridBtn.parentNode.replaceChild(newGridBtn, auctionsGridBtn);
        auctionsListBtn.parentNode.replaceChild(newListBtn, auctionsListBtn);
        
        // Set initial active state
        if (currentAuctionsLayout === 'grid') {
            newGridBtn.classList.add('active');
            newListBtn.classList.remove('active');
        } else {
            newGridBtn.classList.remove('active');
            newListBtn.classList.add('active');
        }
        
        newGridBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentAuctionsLayout !== 'grid') {
                currentAuctionsLayout = 'grid';
                localStorage.setItem('auctions_layout', 'grid');
                newGridBtn.classList.add('active');
                newListBtn.classList.remove('active');
                
                if (typeof window.setAuctionsLayout === 'function') {
                    window.setAuctionsLayout('grid');
                } else if (typeof window.refreshAuctions === 'function') {
                    window.refreshAuctions();
                }
                hapticLight();
            }
        });
        
        newListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentAuctionsLayout !== 'list') {
                currentAuctionsLayout = 'list';
                localStorage.setItem('auctions_layout', 'list');
                newListBtn.classList.add('active');
                newGridBtn.classList.remove('active');
                
                if (typeof window.setAuctionsLayout === 'function') {
                    window.setAuctionsLayout('list');
                } else if (typeof window.refreshAuctions === 'function') {
                    window.refreshAuctions();
                }
                hapticLight();
            }
        });
    }

    function loadAuctionsModule() {
        console.log('📦 loadAuctionsModule called');
        
        if (!telegramUser || !telegramUser.id) {
            console.log('⏳ Waiting for telegramUser before loading auctions module...');
            setTimeout(() => {
                if (telegramUser && telegramUser.id) {
                    loadAuctionsModule();
                } else {
                    console.error('❌ No telegramUser available for auctions module');
                    const auctionsContainer = document.getElementById('auctionsContainer');
                    if (auctionsContainer) {
                        auctionsContainer.innerHTML = '<div class="loading-placeholder">Tidak dapat memuat auctions. Silakan refresh halaman.</div>';
                    }
                }
            }, 500);
            return;
        }
        
        if (window.auctionsModuleLoaded) {
            console.log('✅ Auctions module already loaded');
            if (typeof window.refreshAuctions === 'function') {
                console.log('🔄 Refreshing auctions data');
                window.refreshAuctions();
            }
            // Pastikan create auction button terpasang
            setupCreateAuctionButton();
            return;
        }
        
        if (window.auctionsModuleLoading) {
            console.log('⏳ Auctions module is already loading...');
            return;
        }
        
        window.auctionsModuleLoading = true;
        
        const oldScript = document.getElementById('auctions-module-script');
        if (oldScript) {
            oldScript.remove();
        }
        
        if (!document.querySelector('link[href="/winedash/css/auctions.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/winedash/css/auctions.css?v=' + Date.now();
            document.head.appendChild(link);
            console.log('✅ Auctions CSS loaded');
        }
        
        const newScript = document.createElement('script');
        newScript.id = 'auctions-module-script';
        newScript.src = '/winedash/js/auctions.js?v=' + Date.now();
        newScript.onload = () => {
            window.auctionsModuleLoaded = true;
            window.auctionsModuleLoading = false;
            console.log('✅ Auctions module loaded');
            
            setTimeout(() => {
                if (typeof window.initAuctions === 'function') {
                    console.log('🚀 Calling window.initAuctions with telegramUser:', telegramUser);
                    window.initAuctions(telegramUser);
                    // Setup create auction button setelah module loaded
                    setupCreateAuctionButton();
                } else {
                    console.error('❌ window.initAuctions not found after loading auctions.js');
                    const auctionsContainer = document.getElementById('auctionsContainer');
                    if (auctionsContainer) {
                        auctionsContainer.innerHTML = '<div class="loading-placeholder">Error: Module tidak terload dengan benar. Refresh halaman.</div>';
                    }
                }
            }, 200);
        };
        newScript.onerror = () => {
            window.auctionsModuleLoading = false;
            console.error('❌ Failed to load auctions module');
            const auctionsContainer = document.getElementById('auctionsContainer');
            if (auctionsContainer) {
                auctionsContainer.innerHTML = '<div class="loading-placeholder">Gagal memuat module auctions. Refresh halaman.</div>';
            }
            showToast('Gagal memuat module auctions', 'error');
        };
        document.head.appendChild(newScript);
    }

    function setupCreateAuctionButton() {
        const createAuctionBtn = document.getElementById('createAuctionBtn');
        if (!createAuctionBtn) return;
        
        // Hapus event listener lama dengan clone
        const newBtn = createAuctionBtn.cloneNode(true);
        createAuctionBtn.parentNode.replaceChild(newBtn, createAuctionBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[STORAGE] Create auction button clicked');
            
            // Panggil fungsi dari auctions.js jika tersedia
            if (typeof window.showCreateAuctionPanel === 'function') {
                window.showCreateAuctionPanel();
            } else {
                // Fallback: trigger event yang bisa didengar oleh auctions.js
                const event = new CustomEvent('showCreateAuctionPanel');
                window.dispatchEvent(event);
            }
            hapticLight();
        });
    }

    function validateBasedOnClient(username, basedOn) {
        if (!basedOn || basedOn.trim() === '') {
            return { valid: false, message: 'Based On tidak boleh kosong' };
        }
        
        if (!username || username.trim() === '') {
            return { valid: false, message: 'Username tidak boleh kosong' };
        }
        
        const usernameClean = username.toLowerCase().trim();
        const basedOnClean = basedOn.toLowerCase().trim();
        
        // 1. OP (On Point) - Exact match
        if (usernameClean === basedOnClean) {
            return { valid: true, message: '✓ OP (On Point) - Exact match', category: 'OP' };
        }
        
        // 2. SOP (Semi On Point) - Double huruf
        function removeConsecutiveDuplicates(s) {
            let result = '';
            let prev = '';
            for (let char of s) {
                if (char !== prev) {
                    result += char;
                    prev = char;
                }
            }
            return result;
        }
        
        const usernameNoDouble = removeConsecutiveDuplicates(usernameClean);
        if (usernameNoDouble === basedOnClean && usernameClean.length > basedOnClean.length) {
            return { valid: true, message: '✓ SOP (Semi On Point) - Double huruf', category: 'SOP' };
        }
        
        // 3. SCANON - Tambah huruf S di akhir atau nama tanpa marga
        if (usernameClean.endsWith('s') && usernameClean.slice(0, -1) === basedOnClean) {
            return { valid: true, message: '✓ SCANON - Penambahan huruf S di akhir', category: 'SCANON' };
        }
        
        // Cek jika based_on adalah nama tanpa marga (hanya 1 kata)
        if (basedOnClean.indexOf(' ') === -1 && usernameClean.includes(basedOnClean)) {
            return { valid: true, message: '✓ SCANON - Nama tanpa marga', category: 'SCANON' };
        }
        
        // 4. CANON - Swap i/l
        const usernameILSwap = usernameClean.replace(/i/g, 'L').replace(/l/g, 'i').toLowerCase();
        if (usernameILSwap === basedOnClean) {
            return { valid: true, message: '✓ CANON - Swap huruf i/l', category: 'CANON' };
        }
        
        // 5. TAMPING - Tambah 1 huruf di pinggir
        if (usernameClean.length === basedOnClean.length + 1) {
            if (usernameClean.slice(1) === basedOnClean) {
                return { valid: true, message: '✓ TAMPING - Tambah huruf di depan', category: 'TAMPING' };
            }
            if (usernameClean.slice(0, -1) === basedOnClean) {
                return { valid: true, message: '✓ TAMPING - Tambah huruf di belakang', category: 'TAMPING' };
            }
        }
        
        if (basedOnClean.length === usernameClean.length + 1) {
            if (basedOnClean.slice(1) === usernameClean) {
                return { valid: true, message: '✓ TAMPING - Based On lebih panjang (depan)', category: 'TAMPING' };
            }
            if (basedOnClean.slice(0, -1) === usernameClean) {
                return { valid: true, message: '✓ TAMPING - Based On lebih panjang (belakang)', category: 'TAMPING' };
            }
        }
        
        // 6. TAMDAL - Tambah 1 huruf di dalam
        if (usernameClean.length === basedOnClean.length + 1) {
            for (let i = 0; i < usernameClean.length; i++) {
                const temp = usernameClean.slice(0, i) + usernameClean.slice(i + 1);
                if (temp === basedOnClean) {
                    return { valid: true, message: '✓ TAMDAL - Tambah huruf di dalam', category: 'TAMDAL' };
                }
            }
        }
        
        if (basedOnClean.length === usernameClean.length + 1) {
            for (let i = 0; i < basedOnClean.length; i++) {
                const temp = basedOnClean.slice(0, i) + basedOnClean.slice(i + 1);
                if (temp === usernameClean) {
                    return { valid: true, message: '✓ TAMDAL - Based On lebih panjang', category: 'TAMDAL' };
                }
            }
        }
        
        // 7. GANHUR - Ganti 1 huruf
        if (usernameClean.length === basedOnClean.length) {
            let diffCount = 0;
            for (let i = 0; i < usernameClean.length; i++) {
                if (usernameClean[i] !== basedOnClean[i]) diffCount++;
            }
            if (diffCount === 1) {
                return { valid: true, message: '✓ GANHUR - Ganti 1 huruf', category: 'GANHUR' };
            }
        }
        
        // 8. SWITCH - Perpindahan huruf
        if (usernameClean.length === basedOnClean.length) {
            for (let i = 0; i < usernameClean.length - 1; i++) {
                const swapped = usernameClean.split('');
                [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
                if (swapped.join('') === basedOnClean) {
                    return { valid: true, message: '✓ SWITCH - Perpindahan huruf', category: 'SWITCH' };
                }
            }
        }
        
        // 9. KURHUF - Kurang 1 huruf
        if (usernameClean.length === basedOnClean.length - 1) {
            for (let i = 0; i < basedOnClean.length; i++) {
                const temp = basedOnClean.slice(0, i) + basedOnClean.slice(i + 1);
                if (temp === usernameClean) {
                    return { valid: true, message: '✓ KURHUF - Kurang 1 huruf', category: 'KURHUF' };
                }
            }
        }
        
        // 10. Subset/Superset
        if (basedOnClean.includes(usernameClean)) {
            return { valid: true, message: `✓ Based On mengandung username`, category: 'SUPERSET' };
        }
        
        if (usernameClean.includes(basedOnClean)) {
            return { valid: true, message: `✓ Username mengandung Based On`, category: 'SUBSET' };
        }
        
        return { valid: false, message: '✗ Based On tidak memiliki hubungan yang valid dengan username' };
    }

    // ==================== CONFIRM ADD BUTTON HANDLER ====================
    // Fungsi ini harus ditempatkan di dalam setupEventListeners()
    // Pastikan elemen DOM sudah terdefinisi sebelum kode ini dijalankan

    // Cek apakah confirmAddBtn ada
    if (elements.confirmAddBtn) {
        // Hapus event listener lama dengan clone
        const newConfirmBtn = elements.confirmAddBtn.cloneNode(true);
        elements.confirmAddBtn.parentNode.replaceChild(newConfirmBtn, elements.confirmAddBtn);
        elements.confirmAddBtn = newConfirmBtn;
        
        // Get DOM elements for validation - ambil ulang setiap kali untuk memastikan tidak null
        const getBasedOnInput = () => document.getElementById('modalBasedOn');
        const getBasedOnError = () => document.getElementById('basedOnError');
        const getUsernameInput = () => document.getElementById('modalUsername');
        const getPriceInput = () => document.getElementById('modalPrice');
        
        // Real-time validation function
        function updateBasedOnValidation() {
            const basedOnInput = getBasedOnInput();
            const basedOnError = getBasedOnError();
            const usernameInput = getUsernameInput();
            
            if (!basedOnInput || !basedOnError) return;
            
            const username = usernameInput?.value.trim() || '';
            const value = basedOnInput.value.trim();
            
            if (value === '') {
                basedOnError.style.display = 'block';
                basedOnError.textContent = 'Based On tidak boleh kosong';
                basedOnError.style.color = '#ef4444';
                basedOnInput.classList.add('error');
                return;
            }
            
            if (username === '') {
                basedOnError.style.display = 'block';
                basedOnError.textContent = 'Masukkan username terlebih dahulu';
                basedOnError.style.color = '#f59e0b';
                basedOnInput.classList.add('error');
                return;
            }
            
            const validation = validateBasedOnClient(username, value);
            
            if (validation.valid) {
                basedOnError.style.display = 'block';
                basedOnError.textContent = validation.message;
                basedOnError.style.color = '#10b981';
                basedOnInput.classList.remove('error');
            } else {
                basedOnError.style.display = 'block';
                basedOnError.textContent = validation.message;
                basedOnError.style.color = '#ef4444';
                basedOnInput.classList.add('error');
            }
        }
        
        // Attach validation events
        const basedOnInputElem = getBasedOnInput();
        const usernameInputElem = getUsernameInput();
        
        if (basedOnInputElem) {
            basedOnInputElem.addEventListener('input', updateBasedOnValidation);
            basedOnInputElem.addEventListener('blur', updateBasedOnValidation);
        }
        
        if (usernameInputElem) {
            usernameInputElem.addEventListener('input', updateBasedOnValidation);
        }
        
        // Confirm button click handler
        elements.confirmAddBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DEBUG] Confirm Add button clicked');
            
            const usernameInput = getUsernameInput();
            const priceInput = getPriceInput();
            const basedOnInput = getBasedOnInput();
            const basedOnError = getBasedOnError();
            
            const username = usernameInput?.value.trim();
            const price = priceInput ? parseFloat(priceInput.value) : NaN;
            const basedOn = basedOnInput?.value.trim();
            
            console.log('[DEBUG] Form values:', { username, price, basedOn });
            
            // Validations
            if (!username) {
                showToast('Masukkan username', 'warning');
                return;
            }
            
            if (!basedOn) {
                showToast('Masukkan Based On (nama asli)', 'warning');
                if (basedOnInput) {
                    basedOnInput.classList.add('error');
                    if (basedOnError) {
                        basedOnError.style.display = 'block';
                        basedOnError.textContent = 'Based On tidak boleh kosong';
                    }
                }
                return;
            }
            
            const validation = validateBasedOnClient(username, basedOn);
            if (!validation.valid) {
                showToast(validation.message, 'warning');
                if (basedOnInput) {
                    basedOnInput.classList.add('error');
                    if (basedOnError) {
                        basedOnError.style.display = 'block';
                        basedOnError.textContent = validation.message;
                    }
                }
                return;
            }
            
            if (isNaN(price) || price <= 0) {
                showToast('Masukkan harga yang valid', 'warning');
                return;
            }
            
            // Tampilkan loading state pada tombol
            const originalText = elements.confirmAddBtn.innerHTML;
            elements.confirmAddBtn.disabled = true;
            elements.confirmAddBtn.innerHTML = '<span class="btn-loading"></span> Menambahkan...';
            
            try {
                const success = await addUsername(username, price, basedOn);
                
                if (success && elements.addModal) {
                    elements.addModal.style.display = 'none';
                    clearModal();
                    if (basedOnInput) basedOnInput.classList.remove('error');
                    if (basedOnError) basedOnError.style.display = 'none';
                    await loadUsernames();
                }
            } catch (error) {
                console.error('[DEBUG] Error in confirm handler:', error);
                showToast('Terjadi kesalahan, coba lagi', 'error');
            } finally {
                elements.confirmAddBtn.disabled = false;
                elements.confirmAddBtn.innerHTML = originalText;
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

    async function loadStorageBalance() {
        if (!telegramUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/user/${telegramUser.id}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                const balanceCard = document.getElementById('storageBalanceCard');
                if (balanceCard) {
                    const formattedBalance = parseFloat(data.user.balance).toFixed(2);
                    balanceCard.innerHTML = `
                        <img src="https://companel.shop/image/images-removebg-preview.png" alt="TON" class="balance-logo">
                        <span class="balance-amount">${formattedBalance}</span>
                    `;
                    console.log(`💰 Storage balance updated: ${formattedBalance} TON`);
                }
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    }

    function setupStatusFilter() {
        const statusBtn = document.getElementById('toggleStatusBtn');
        
        if (!statusBtn) {
            console.warn('Status button not found');
            return;
        }
        
        // Hapus event listener lama
        const newStatusBtn = statusBtn.cloneNode(true);
        statusBtn.parentNode.replaceChild(newStatusBtn, statusBtn);
        
        // Set initial text
        newStatusBtn.innerHTML = '<i class="fas fa-filter"></i><span>Status: All</span>';
        newStatusBtn.classList.remove('toggle-active', 'toggle-active-unlisted');
        
        // Buat dropdown element
        let statusDropdown = null;
        
        function createDropdown() {
            // Hapus dropdown yang sudah ada
            if (statusDropdown) {
                statusDropdown.remove();
                statusDropdown = null;
            }
            
            statusDropdown = document.createElement('div');
            statusDropdown.className = 'status-dropdown';
            statusDropdown.innerHTML = `
                <div class="status-dropdown-item ${currentStatus === 'all' ? 'active' : ''}" data-status="all">
                    <i class="fas fa-list"></i> All
                </div>
                <div class="status-dropdown-item ${currentStatus === 'listed' ? 'active' : ''}" data-status="listed">
                    <i class="fas fa-check-circle"></i> Listed
                </div>
                <div class="status-dropdown-item ${currentStatus === 'unlisted' ? 'active' : ''}" data-status="unlisted">
                    <i class="fas fa-times-circle"></i> Unlisted
                </div>
                <div class="status-dropdown-item ${currentStatus === 'pending' ? 'active' : ''}" data-status="pending">
                    <i class="fas fa-clock"></i> Pending
                </div>
                <div class="status-dropdown-item ${currentStatus === 'auction' ? 'active' : ''}" data-status="auction">
                    <i class="fas fa-gavel"></i> Auction
                </div>
            `;
            
            // Position dropdown below button
            const rect = newStatusBtn.getBoundingClientRect();
            statusDropdown.style.position = 'fixed';
            statusDropdown.style.top = `${rect.bottom + 5}px`;
            statusDropdown.style.left = `${rect.left}px`;
            statusDropdown.style.minWidth = `${rect.width}px`;
            
            document.body.appendChild(statusDropdown);
            
            // Add click handlers
            statusDropdown.querySelectorAll('.status-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const status = item.dataset.status;
                    updateStatusFilter(status);
                    closeDropdown();
                });
            });
            
            // Close dropdown when clicking outside
            setTimeout(() => {
                document.addEventListener('click', closeDropdownHandler);
            }, 10);
        }
        
        function closeDropdownHandler(e) {
            if (statusDropdown && !statusDropdown.contains(e.target) && e.target !== newStatusBtn) {
                closeDropdown();
            }
        }
        
        function closeDropdown() {
            if (statusDropdown) {
                statusDropdown.remove();
                statusDropdown = null;
            }
            document.removeEventListener('click', closeDropdownHandler);
            statusDropdownVisible = false;
        }
        
        function updateStatusFilter(status) {
            currentStatus = status;
            
            // Update button text
            let statusText = 'All';
            let statusIcon = '<i class="fas fa-filter"></i>';
            switch(status) {
                case 'all':
                    statusText = 'All';
                    statusIcon = '<i class="fas fa-list"></i>';
                    break;
                case 'listed':
                    statusText = 'Listed';
                    statusIcon = '<i class="fas fa-check-circle"></i>';
                    break;
                case 'unlisted':
                    statusText = 'Unlisted';
                    statusIcon = '<i class="fas fa-times-circle"></i>';
                    break;
                case 'pending':
                    statusText = 'Pending';
                    statusIcon = '<i class="fas fa-clock"></i>';
                    break;
                case 'auction':
                    statusText = 'Auction';
                    statusIcon = '<i class="fas fa-gavel"></i>';
                    break;
            }
            newStatusBtn.innerHTML = `${statusIcon}<span>Status: ${statusText}</span>`;
            
            // Update active class on button
            if (status !== 'all') {
                newStatusBtn.classList.add('toggle-active');
            } else {
                newStatusBtn.classList.remove('toggle-active');
            }
            
            // Apply filter
            filterAndRender();
            hapticLight();
        }
        
        newStatusBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (statusDropdownVisible) {
                closeDropdown();
            } else {
                createDropdown();
                statusDropdownVisible = true;
            }
        });
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
        const basedOnInput = document.getElementById('modalBasedOn');
        if (basedOnInput) {
            basedOnInput.value = '';
            basedOnInput.classList.remove('error');
        }
        const basedOnError = document.getElementById('basedOnError');
        if (basedOnError) {
            basedOnError.style.display = 'none';
        }
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
    
    async function checkForUpdates() {
        if (!telegramUser) return;
        
        try {
            // Cek jumlah usernames
            const usernamesResp = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
            const usernamesData = await usernamesResp.json();
            
            let currentUsernameCount = 0;
            if (usernamesData.success && usernamesData.usernames) {
                currentUsernameCount = usernamesData.usernames.filter(u => u.seller_id === telegramUser.id).length;
            }
            
            // Cek jumlah pending
            const pendingResp = await fetch(`${API_BASE_URL}/api/winedash/username/pending/count/${telegramUser.id}`);
            const pendingData = await pendingResp.json();
            let currentPendingCount = pendingData.success ? pendingData.count : 0;
            
            // Jika ada perubahan, refresh
            if (currentUsernameCount !== lastUsernameCount || currentPendingCount !== lastPendingCount) {
                console.log('Changes detected, refreshing...');
                lastUsernameCount = currentUsernameCount;
                lastPendingCount = currentPendingCount;
                await loadUsernames();
                await loadPendingCount();
                
                // Jika inbox terbuka, refresh juga
                const panel = document.getElementById('inboxPanel');
                if (panel && panel.style.display === 'flex') {
                    await loadPendingList();
                }
            }
        } catch (error) {
            console.error('Error checking updates:', error);
        }
    }

    // Mulai polling setiap 3 detik
    let updateInterval = null;

    function startAutoRefresh() {
        if (updateInterval) clearInterval(updateInterval);
        
        // Initial load
        if (telegramUser) {
            (async () => {
                const usernamesResp = await fetch(`${API_BASE_URL}/api/winedash/usernames?limit=200`);
                const usernamesData = await usernamesResp.json();
                if (usernamesData.success && usernamesData.usernames) {
                    lastUsernameCount = usernamesData.usernames.filter(u => u.seller_id === telegramUser.id).length;
                }
                
                const pendingResp = await fetch(`${API_BASE_URL}/api/winedash/username/pending/count/${telegramUser.id}`);
                const pendingData = await pendingResp.json();
                lastPendingCount = pendingData.success ? pendingData.count : 0;
            })();
        }
        
        updateInterval = setInterval(() => {
            checkForUpdates();
        }, 3000); // Cek setiap 3 detik
    }

    function stopAutoRefresh() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }

    async function init() {
        console.log('📦 Winedash Storage - Initializing...');
        
        initTelegram();
        initSafeArea();
        showLoading(true);
        
        try {
            // Setup DOM elements references
            setupDomElements();
            
            // Setup event listeners
            setupEventListeners();
            setupInboxEventListeners();
            setupSearch();
            setupStatusFilter();
            setupAuctionsFilterAndActivity();
            setupAuctionsLayoutToggle();
            
            // Get Telegram user
            telegramUser = getTelegramUserFromWebApp();
            
            if (telegramUser) {
                updateStorageUserUI();
                await authenticateUser();
                await loadStorageBalance();
                await loadUsernames();
                await loadPendingCount();
                startAutoRefresh();
            } else {
                console.warn('No Telegram user found');
                if (elements.usernameContainer) {
                    elements.usernameContainer.innerHTML = '<div class="loading-placeholder">Silakan buka melalui Telegram</div>';
                }
            }
        } catch (error) {
            console.error('Error in init:', error);
            if (elements.usernameContainer) {
                elements.usernameContainer.innerHTML = '<div class="loading-placeholder">Error loading page: ' + (error.message || 'Unknown error') + '</div>';
            }
        } finally {
            showLoading(false);
        }
    }

    function setupDomElements() {
        elements.loadingOverlay = document.getElementById('loadingOverlay');
        elements.toastContainer = document.getElementById('toastContainer');
        elements.usernameContainer = document.getElementById('usernameContainer');
        elements.searchInput = document.getElementById('searchStorage');
        elements.searchApplyBtn = document.getElementById('searchApplyBtn');
        elements.addUsernameActionBtn = document.getElementById('addUsernameActionBtn');
        elements.addModal = document.getElementById('addModal');
        elements.cancelModalBtn = document.getElementById('cancelModalBtn');
        elements.confirmAddBtn = document.getElementById('confirmAddBtn');
        elements.modalUsername = document.getElementById('modalUsername');
        elements.modalPrice = document.getElementById('modalPrice');
        elements.sortBtn = document.getElementById('sortBtn');
        elements.sortDropdown = document.getElementById('sortDropdown');
        elements.sortSelect = document.getElementById('sortSelect');
        elements.gridLayoutBtn = document.getElementById('gridLayoutBtn');
        elements.listLayoutBtn = document.getElementById('listLayoutBtn');
        elements.modeBtns = document.querySelectorAll('.mode-btn');
    }

    // ==================== OFFERS INTEGRATION ====================

    // Export init function for offers module
    window.initOffers = function() {
        // Load offers.js dynamically if not loaded
        if (typeof window.OffersLoaded === 'undefined') {
            const script = document.createElement('script');
            script.src = '/winedash/js/offers.js';
            script.onload = () => {
                window.OffersLoaded = true;
                console.log('✅ Offers module loaded');
            };
            document.head.appendChild(script);
        }
    };

    // Add CSS for offers if not present
    if (!document.querySelector('link[href="/winedash/css/offers.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/winedash/css/offers.css';
        document.head.appendChild(link);
    }

    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });

    window.loadAuctionsModule = loadAuctionsModule;
    window.refreshAuctions = function() {
        if (typeof window.refreshAuctionsModule === 'function') {
            window.refreshAuctionsModule();
        }
    };

    init();
})();
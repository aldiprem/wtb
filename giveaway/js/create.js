// create.js - Create Giveaway Page with Telegram Integration

(function() {
    'use strict';
    
    console.log('🎁 Create Giveaway Page - Initializing...');

    const API_BASE_URL = window.location.origin;
    const MAX_RETRIES = 3;

    // ==================== TELEGRAM HAPTIC FEEDBACK ====================
    
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
    
    function hapticMedium() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    function hapticHeavy() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('heavy');
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
    
    function hapticWarning() {
        const tg = getTelegramWebApp();
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('warning');
        }
    }

    // ==================== STATE ====================
    
    let telegramUser = null;
    let giveawayData = {
        prizes: [],
        chats: [],
        duration: null,
        endTime: null,
        links: [],
        requirements: [],
        captcha: false
    };
    
    let selectedRequirements = new Set();

    // ==================== DOM ELEMENTS ====================
    
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        userUsername: document.getElementById('userUsername'),
        
        prizeList: document.getElementById('prizeList'),
        chatList: document.getElementById('chatList'),
        durationDisplay: document.getElementById('durationDisplay'),
        linkDisplay: document.getElementById('linkDisplay'),
        
        addPrizeBtn: document.getElementById('addPrizeBtn'),
        addChatBtn: document.getElementById('addChatBtn'),
        addLinkBtn: document.getElementById('addLinkBtn'),
        editDurationBtn: document.getElementById('editDurationBtn'),
        
        requirementBtns: document.querySelectorAll('.req-btn'),
        captchaToggle: document.getElementById('captchaToggle'),
        
        startGiveawayBtn: document.getElementById('startGiveawayBtn'),
        
        // Modals
        prizeModal: document.getElementById('prizeModal'),
        prizeInput: document.getElementById('prizeInput'),
        savePrizeBtn: document.getElementById('savePrizeBtn'),
        cancelPrizeBtn: document.getElementById('cancelPrizeBtn'),
        closePrizeModal: document.getElementById('closePrizeModal'),
        
        chatModal: document.getElementById('chatModal'),
        chatModalBody: document.getElementById('chatModalBody'),
        closeChatModal: document.getElementById('closeChatModal'),
        
        linkModal: document.getElementById('linkModal'),
        linkInput: document.getElementById('linkInput'),
        saveLinkBtn: document.getElementById('saveLinkBtn'),
        cancelLinkBtn: document.getElementById('cancelLinkBtn'),
        closeLinkModal: document.getElementById('closeLinkModal'),
        
        durationModal: document.getElementById('durationModal'),
        durationValue: document.getElementById('durationValue'),
        durationUnit: document.getElementById('durationUnit'),
        datetimePicker: document.getElementById('datetimePicker'),
        saveDurationBtn: document.getElementById('saveDurationBtn'),
        cancelDurationBtn: document.getElementById('cancelDurationBtn'),
        closeDurationModal: document.getElementById('closeDurationModal')
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        else if (type === 'warning') hapticWarning();
        else hapticLight();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
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

    function formatDate(date) {
        if (!date) return 'Belum diatur';
        const d = new Date(date);
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // ==================== TELEGRAM USER ====================
    
    function getTelegramUser() {
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
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            if (userId) {
                return {
                    id: parseInt(userId),
                    username: urlParams.get('username') || '',
                    first_name: urlParams.get('first_name') || '',
                    last_name: urlParams.get('last_name') || '',
                    photo_url: null
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }

    function updateUserUI() {
        if (!telegramUser) return;
        
        const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
        
        if (elements.userName) elements.userName.textContent = fullName || 'Pengguna Telegram';
        if (elements.userUsername) elements.userUsername.textContent = telegramUser.username ? `@${telegramUser.username}` : 'Tidak ada username';
        
        const avatarContainer = elements.userAvatar;
        if (avatarContainer) {
            if (telegramUser.photo_url) {
                avatarContainer.innerHTML = `<img src="${telegramUser.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                const nameForAvatar = encodeURIComponent(fullName || telegramUser.username || 'User');
                const avatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2`;
                avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }

    // ==================== RENDER FUNCTIONS ====================
    
    function renderPrizes() {
        if (!elements.prizeList) return;
        
        if (giveawayData.prizes.length === 0) {
            elements.prizeList.innerHTML = '<div class="value-text empty">Belum ada hadiah</div>';
            return;
        }
        
        let html = '';
        giveawayData.prizes.forEach((prize, index) => {
            html += `
                <div class="prize-item" data-index="${index}">
                    <div class="prize-number">${index + 1}</div>
                    <div class="prize-name">${escapeHtml(prize)}</div>
                    <div class="prize-actions">
                        <button class="prize-edit" data-index="${index}"><i class="fas fa-pen"></i></button>
                        <button class="prize-delete" data-index="${index}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        elements.prizeList.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.prize-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                editPrize(index);
            });
        });
        
        document.querySelectorAll('.prize-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                deletePrize(index);
            });
        });
    }
    
    function editPrize(index) {
        hapticMedium();
        const prize = giveawayData.prizes[index];
        if (elements.prizeInput) {
            elements.prizeInput.value = prize;
        }
        // Store edit index for later
        elements.prizeModal.dataset.editIndex = index;
        openModal(elements.prizeModal);
    }
    
    function deletePrize(index) {
        hapticMedium();
        giveawayData.prizes.splice(index, 1);
        renderPrizes();
        checkFormValidity();
        showToast('Hadiah dihapus', 'info');
    }
    
    function renderChats() {
        if (!elements.chatList) return;
        
        if (giveawayData.chats.length === 0) {
            elements.chatList.innerHTML = '<div class="value-text empty">Belum ada chat</div>';
            return;
        }
        
        let html = '';
        giveawayData.chats.forEach((chat, index) => {
            const chatType = chat.type === 'channel' ? 'Channel' : chat.type === 'group' ? 'Group' : 'Chat';
            const visibilityIcon = chat.visibility === 'public' ? '🌐' : '🔒';
            
            html += `
                <div class="chat-item" data-index="${index}">
                    <div class="chat-icon">
                        <i class="fas ${chat.type === 'channel' ? 'fa-broadcast-tower' : 'fa-users'}"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-title">${escapeHtml(chat.title || chat.chat_id)}</div>
                        <div class="chat-meta">
                            <span class="chat-type">${visibilityIcon} ${chatType}</span>
                            <span>${escapeHtml(chat.chat_id)}</span>
                        </div>
                    </div>
                    <button class="chat-delete" data-index="${index}"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
        elements.chatList.innerHTML = html;
        
        document.querySelectorAll('.chat-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                deleteChat(index);
            });
        });
    }
    
    function deleteChat(index) {
        hapticMedium();
        giveawayData.chats.splice(index, 1);
        renderChats();
        checkFormValidity();
        showToast('Chat dihapus', 'info');
    }
    
    function renderLinks() {
        if (!elements.linkDisplay) return;
        
        if (giveawayData.links.length === 0) {
            elements.linkDisplay.innerHTML = '<span class="empty">Belum ada link</span>';
            return;
        }
        
        let html = '';
        giveawayData.links.forEach((link, index) => {
            html += `<div>${index + 1}. ${escapeHtml(link)}</div>`;
        });
        elements.linkDisplay.innerHTML = html;
    }
    
    function renderDuration() {
        if (!elements.durationDisplay) return;
        
        if (giveawayData.endTime) {
            elements.durationDisplay.innerHTML = `<span style="color: var(--primary);">${formatDate(giveawayData.endTime)}</span>`;
        } else {
            elements.durationDisplay.innerHTML = '<span class="empty">Belum diatur</span>';
        }
    }
    
    function renderRequirements() {
        document.querySelectorAll('.req-btn').forEach(btn => {
            const type = btn.dataset.type;
            if (selectedRequirements.has(type)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }
    
    function checkFormValidity() {
        const isValid = 
            giveawayData.prizes.length > 0 &&
            giveawayData.chats.length > 0 &&
            giveawayData.endTime !== null;
        
        if (elements.startGiveawayBtn) {
            if (isValid) {
                elements.startGiveawayBtn.disabled = false;
                elements.startGiveawayBtn.style.opacity = '1';
            } else {
                elements.startGiveawayBtn.disabled = true;
                elements.startGiveawayBtn.style.opacity = '0.6';
            }
        }
    }

    // ==================== MODAL FUNCTIONS ====================
    
    function openModal(modal) {
        if (!modal) return;
        document.body.classList.add('modal-open');
        modal.style.display = 'flex';
    }
    
    function closeModal(modal) {
        if (!modal) return;
        document.body.classList.remove('modal-open');
        modal.style.display = 'none';
    }
    
    function closeAllModals() {
        const modals = [elements.prizeModal, elements.chatModal, elements.linkModal, elements.durationModal];
        modals.forEach(modal => closeModal(modal));
    }

    // ==================== PRIZE HANDLERS ====================
    
    function openPrizeModal() {
        hapticMedium();
        if (elements.prizeInput) {
            elements.prizeInput.value = '';
        }
        delete elements.prizeModal.dataset.editIndex;
        openModal(elements.prizeModal);
    }
    
    function savePrize() {
        hapticMedium();
        const input = elements.prizeInput?.value.trim();
        if (!input) {
            showToast('Masukkan hadiah terlebih dahulu', 'warning');
            return;
        }
        
        // Split by new line
        const prizes = input.split('\n').filter(line => line.trim().length > 0);
        
        if (prizes.length === 0) {
            showToast('Masukkan minimal satu hadiah', 'warning');
            return;
        }
        
        // Check if editing existing
        const editIndex = elements.prizeModal.dataset.editIndex;
        if (editIndex !== undefined && editIndex !== 'undefined') {
            // Replace existing
            giveawayData.prizes[parseInt(editIndex)] = prizes[0];
            delete elements.prizeModal.dataset.editIndex;
            showToast('Hadiah diperbarui', 'success');
        } else {
            // Add new prizes
            giveawayData.prizes.push(...prizes);
            showToast(`${prizes.length} hadiah ditambahkan`, 'success');
        }
        
        renderPrizes();
        closeModal(elements.prizeModal);
        checkFormValidity();
    }

    // ==================== CHAT HANDLERS (Peer Selection) ====================
    
    function openChatModal() {
        hapticMedium();
        
        // Create peer selection buttons using Telegram WebApp
        const tg = getTelegramWebApp();
        if (tg && tg.showPopup) {
            // Use Telegram's native peer selection
            tg.showPopup({
                title: 'Tambah Chat',
                message: 'Pilih channel atau group yang ingin ditambahkan',
                buttons: [
                    { id: 'channel', type: 'default', text: '📢 Channel' },
                    { id: 'group', type: 'default', text: '💬 Group' },
                    { id: 'cancel', type: 'cancel', text: 'Batal' }
                ]
            }, (buttonId) => {
                if (buttonId === 'channel') {
                    requestPeerSelection('channel');
                } else if (buttonId === 'group') {
                    requestPeerSelection('group');
                }
            });
        } else {
            // Fallback: manual input
            const chatId = prompt('Masukkan ID Chat (contoh: -1001234567890):');
            if (chatId && chatId.trim()) {
                addChatManually(chatId.trim());
            }
        }
    }
    
    function requestPeerSelection(peerType) {
        const tg = getTelegramWebApp();
        if (!tg) {
            showToast('Tidak dapat membuka Telegram WebApp', 'error');
            return;
        }
        
        const chatId = prompt(`Masukkan ID ${peerType === 'channel' ? 'Channel' : 'Group'}:\nContoh: -1001234567890`);
        if (chatId && chatId.trim()) {
            addChatManually(chatId.trim(), peerType);
        }
    }
    
    // Fungsi baru: Fetch entity chat dari ID
    async function fetchChatEntity(chatId) {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/fetch-chat-entity`, {
                method: 'POST',
                body: JSON.stringify({
                    chat_id: chatId,
                    user_id: telegramUser?.id
                })
            });
            
            if (response.success) {
                return {
                    success: true,
                    chat_id: response.chat_id,
                    title: response.title,
                    username: response.username,
                    type: response.type,
                    visibility: response.visibility,
                    invite_link: response.invite_link,
                    photo_url: response.photo_url,
                    member_count: response.member_count
                };
            } else {
                return {
                    success: false,
                    error: response.error || 'Gagal mengambil data chat'
                };
            }
        } catch (error) {
            console.error('Error fetching chat entity:', error);
            return {
                success: false,
                error: error.message || 'Terjadi kesalahan'
            };
        }
    }

    // Perbaiki fungsi openChatModal
    function openChatModal() {
        hapticMedium();
        
        // Buat modal chat yang lebih baik dengan input ID
        let chatInputModal = document.getElementById('chatInputModal');
        if (!chatInputModal) {
            chatInputModal = document.createElement('div');
            chatInputModal.id = 'chatInputModal';
            chatInputModal.className = 'modal-overlay';
            chatInputModal.innerHTML = `
                <div class="modal-container" style="max-width: 360px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-plus-circle"></i> Tambah Chat</h3>
                        <button class="modal-close" id="closeChatInputModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);">
                            <i class="fas fa-info-circle"></i> Masukkan ID Chat (Channel/Group)
                        </p>
                        <input type="text" id="chatIdInput" placeholder="Contoh: -1001234567890" style="margin-bottom: 16px;">
                        <div id="chatPreview" style="display: none; margin-bottom: 16px; padding: 12px; background: var(--surface-light); border-radius: 14px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div id="previewAvatar" style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    <i class="fas fa-users" style="color: white; font-size: 24px;"></i>
                                </div>
                                <div style="flex: 1;">
                                    <div id="previewTitle" style="font-weight: 600; margin-bottom: 4px;">-</div>
                                    <div id="previewMeta" style="font-size: 11px; color: var(--text-muted);">-</div>
                                </div>
                                <div id="previewStatus" style="font-size: 11px;">
                                    <span class="loading-spinner-small" style="display: none; width: 16px; height: 16px;"></span>
                                </div>
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="btn-primary" id="confirmAddChatBtn" disabled>Tambahkan</button>
                            <button class="btn-secondary" id="cancelChatInputBtn">Batal</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(chatInputModal);
            
            // Event listeners
            document.getElementById('closeChatInputModal')?.addEventListener('click', () => {
                closeModal(chatInputModal);
            });
            
            document.getElementById('cancelChatInputBtn')?.addEventListener('click', () => {
                closeModal(chatInputModal);
            });
            
            document.getElementById('confirmAddChatBtn')?.addEventListener('click', async () => {
                const chatIdInput = document.getElementById('chatIdInput');
                const chatId = chatIdInput?.value.trim();
                if (chatId) {
                    await addChatManually(chatId);
                    closeModal(chatInputModal);
                }
            });
            
            // Live preview saat input berubah
            const chatIdInput = document.getElementById('chatIdInput');
            const confirmBtn = document.getElementById('confirmAddChatBtn');
            
            chatIdInput?.addEventListener('input', debounce(async (e) => {
                const chatId = e.target.value.trim();
                if (chatId) {
                    await previewChatEntity(chatId);
                    if (confirmBtn) confirmBtn.disabled = false;
                } else {
                    document.getElementById('chatPreview').style.display = 'none';
                    if (confirmBtn) confirmBtn.disabled = true;
                }
            }, 500));
            
            chatInputModal.addEventListener('click', (e) => {
                if (e.target === chatInputModal) closeModal(chatInputModal);
            });
        }
        
        // Reset form
        const chatIdInput = document.getElementById('chatIdInput');
        const chatPreview = document.getElementById('chatPreview');
        const confirmBtn = document.getElementById('confirmAddChatBtn');
        
        if (chatIdInput) chatIdInput.value = '';
        if (chatPreview) chatPreview.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = true;
        
        openModal(chatInputModal);
        setTimeout(() => chatIdInput?.focus(), 100);
    }

    // Fungsi preview chat entity
    async function previewChatEntity(chatId) {
        const chatPreview = document.getElementById('chatPreview');
        const previewAvatar = document.getElementById('previewAvatar');
        const previewTitle = document.getElementById('previewTitle');
        const previewMeta = document.getElementById('previewMeta');
        const previewStatus = document.getElementById('previewStatus');
        const loadingSpan = previewStatus?.querySelector('.loading-spinner-small');
        
        if (chatPreview) chatPreview.style.display = 'block';
        if (previewStatus) {
            if (loadingSpan) loadingSpan.style.display = 'inline-block';
            previewStatus.innerHTML = '<span class="loading-spinner-small" style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(64,167,227,0.2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite;"></span> Mengecek...';
        }
        
        try {
            const entity = await fetchChatEntity(chatId);
            
            if (entity.success) {
                // Update preview
                if (previewTitle) previewTitle.textContent = entity.title || entity.chat_id;
                
                let metaText = `${entity.type === 'channel' ? 'Channel' : entity.type === 'group' ? 'Group' : 'Supergroup'}`;
                if (entity.visibility === 'public' && entity.username) {
                    metaText += ` • @${entity.username}`;
                } else {
                    metaText += ` • Private`;
                }
                if (entity.member_count) {
                    metaText += ` • ${entity.member_count.toLocaleString()} members`;
                }
                if (previewMeta) previewMeta.textContent = metaText;
                
                // Update avatar
                if (previewAvatar) {
                    if (entity.photo_url) {
                        previewAvatar.innerHTML = `<img src="${entity.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else {
                        const initial = (entity.title || 'C').charAt(0).toUpperCase();
                        previewAvatar.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary), var(--primary-dark));"><span style="color: white; font-weight: 600;">${initial}</span></div>`;
                    }
                }
                
                if (previewStatus) {
                    previewStatus.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success);"></i> Valid';
                }
                
                // Store entity data untuk digunakan saat add
                window.pendingChatEntity = entity;
                
            } else {
                if (previewTitle) previewTitle.textContent = 'Chat tidak ditemukan';
                if (previewMeta) previewMeta.textContent = entity.error || 'Periksa ID Chat';
                if (previewStatus) {
                    previewStatus.innerHTML = '<i class="fas fa-times-circle" style="color: var(--danger);"></i> Tidak valid';
                }
                window.pendingChatEntity = null;
            }
        } catch (error) {
            console.error('Preview error:', error);
            if (previewTitle) previewTitle.textContent = 'Error';
            if (previewMeta) previewMeta.textContent = 'Gagal mengambil data';
            if (previewStatus) {
                previewStatus.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i> Error';
            }
            window.pendingChatEntity = null;
        }
    }

    // Fungsi debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Perbaiki fungsi addChatManually
    async function addChatManually(chatId, type = null) {
        hapticMedium();
        showLoading(true);
        
        try {
            // Gunakan entity yang sudah di-preview jika ada
            let entity = window.pendingChatEntity;
            
            if (!entity || entity.chat_id !== chatId) {
                // Fetch ulang jika belum ada preview
                entity = await fetchChatEntity(chatId);
            }
            
            if (entity && entity.success) {
                // Cek apakah chat sudah ada
                const exists = giveawayData.chats.some(c => c.chat_id === entity.chat_id);
                if (exists) {
                    showToast(`Chat "${entity.title}" sudah ditambahkan`, 'warning');
                    return;
                }
                
                giveawayData.chats.push({
                    chat_id: entity.chat_id,
                    title: entity.title || chatId,
                    type: entity.type || 'channel',
                    visibility: entity.visibility || 'private',
                    username: entity.username || null,
                    invite_link: entity.invite_link || null,
                    photo_url: entity.photo_url || null,
                    member_count: entity.member_count || 0
                });
                renderChats();
                checkFormValidity();
                showToast(`Chat "${entity.title || chatId}" ditambahkan`, 'success');
                
                // Clear preview
                window.pendingChatEntity = null;
            } else {
                showToast(entity?.error || 'Gagal menambahkan chat', 'error');
            }
        } catch (error) {
            console.error('Error adding chat:', error);
            showToast('Gagal menambahkan chat', 'error');
        } finally {
            showLoading(false);
            window.pendingChatEntity = null;
        }
    }

    // Perbaiki renderChats untuk menampilkan foto profil
    function renderChats() {
        if (!elements.chatList) return;
        
        if (giveawayData.chats.length === 0) {
            elements.chatList.innerHTML = '<div class="value-text empty">Belum ada chat</div>';
            return;
        }
        
        let html = '';
        giveawayData.chats.forEach((chat, index) => {
            const chatType = chat.type === 'channel' ? 'Channel' : chat.type === 'group' ? 'Group' : 'Supergroup';
            const visibilityIcon = chat.visibility === 'public' ? '🌐' : '🔒';
            
            // Gunakan photo_url jika ada
            const hasPhoto = chat.photo_url && chat.photo_url !== '';
            const initial = (chat.title || 'C').charAt(0).toUpperCase();
            
            html += `
                <div class="chat-item" data-index="${index}">
                    <div class="chat-icon" style="background: ${hasPhoto ? 'transparent' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))'}; overflow: hidden;">
                        ${hasPhoto ? `<img src="${chat.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas ${chat.type === 'channel' ? 'fa-broadcast-tower' : 'fa-users'}"></i>`}
                    </div>
                    <div class="chat-info">
                        <div class="chat-title">${escapeHtml(chat.title || chat.chat_id)}</div>
                        <div class="chat-meta">
                            <span class="chat-type">${visibilityIcon} ${chatType}</span>
                            <span>${escapeHtml(chat.chat_id)}</span>
                            ${chat.username ? `<span>@${escapeHtml(chat.username)}</span>` : ''}
                        </div>
                    </div>
                    <button class="chat-delete" data-index="${index}"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
        elements.chatList.innerHTML = html;
        
        document.querySelectorAll('.chat-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                deleteChat(index);
            });
        });
    }

    // ==================== LINK HANDLERS ====================
    
    function openLinkModal() {
        hapticMedium();
        if (elements.linkInput) {
            elements.linkInput.value = giveawayData.links.join('\n');
        }
        openModal(elements.linkModal);
    }
    
    function saveLinks() {
        hapticMedium();
        const input = elements.linkInput?.value.trim();
        if (!input) {
            giveawayData.links = [];
            renderLinks();
            closeModal(elements.linkModal);
            checkFormValidity();
            showToast('Link dihapus', 'info');
            return;
        }
        
        const links = input.split('\n').filter(line => line.trim().length > 0);
        
        // Validate links
        const validLinks = [];
        const invalidLinks = [];
        
        for (const link of links) {
            if (link.startsWith('https://t.me/') || link.startsWith('t.me/')) {
                validLinks.push(link);
            } else {
                invalidLinks.push(link);
            }
        }
        
        if (invalidLinks.length > 0) {
            showToast(`${invalidLinks.length} link tidak valid (harus t.me/...)`, 'warning');
        }
        
        giveawayData.links = validLinks;
        renderLinks();
        closeModal(elements.linkModal);
        
        // If Tap Link requirement is selected, update it
        if (selectedRequirements.has('taplink') && validLinks.length === 0) {
            selectedRequirements.delete('taplink');
            renderRequirements();
            showToast('Tap link dinonaktifkan karena tidak ada link', 'info');
        }
        
        checkFormValidity();
        showToast(`${validLinks.length} link disimpan`, 'success');
    }

    // ==================== DURATION HANDLERS ====================
    
    function openDurationModal() {
        hapticMedium();
        // Reset form
        if (elements.durationValue) elements.durationValue.value = '1';
        if (elements.durationUnit) elements.durationUnit.value = 'days';
        if (elements.datetimePicker) elements.datetimePicker.value = '';
        openModal(elements.durationModal);
    }
    
    function saveDuration() {
        hapticMedium();
        let endTime = null;
        
        // Check if using datetime picker
        const datetimeValue = elements.datetimePicker?.value;
        if (datetimeValue) {
            endTime = new Date(datetimeValue);
            if (isNaN(endTime.getTime())) {
                showToast('Format tanggal tidak valid', 'error');
                return;
            }
        } else {
            // Calculate from duration
            const value = parseInt(elements.durationValue?.value);
            const unit = elements.durationUnit?.value;
            
            if (isNaN(value) || value <= 0) {
                showToast('Masukkan nilai durasi yang valid', 'warning');
                return;
            }
            
            endTime = new Date();
            switch (unit) {
                case 'minutes':
                    endTime.setMinutes(endTime.getMinutes() + value);
                    break;
                case 'hours':
                    endTime.setHours(endTime.getHours() + value);
                    break;
                case 'days':
                    endTime.setDate(endTime.getDate() + value);
                    break;
                case 'weeks':
                    endTime.setDate(endTime.getDate() + (value * 7));
                    break;
                default:
                    endTime.setDate(endTime.getDate() + value);
            }
        }
        
        // Check if end time is in the future
        if (endTime <= new Date()) {
            showToast('Waktu berakhir harus di masa depan', 'error');
            return;
        }
        
        giveawayData.endTime = endTime.toISOString();
        renderDuration();
        closeModal(elements.durationModal);
        checkFormValidity();
        showToast(`Durasi diatur hingga ${formatDate(endTime)}`, 'success');
    }

    // ==================== REQUIREMENT HANDLERS ====================
    
    function toggleRequirement(type) {
        hapticLight();
        
        if (type === 'taplink' && giveawayData.links.length === 0) {
            showToast('Tambahkan link terlebih dahulu', 'warning');
            return;
        }
        
        if (selectedRequirements.has(type)) {
            selectedRequirements.delete(type);
            showToast(`${getRequirementName(type)} dinonaktifkan`, 'info');
        } else {
            selectedRequirements.add(type);
            showToast(`${getRequirementName(type)} diaktifkan`, 'success');
        }
        
        renderRequirements();
        updateStartButtonText();
    }
    
    function getRequirementName(type) {
        switch (type) {
            case 'subscribe': return 'Subscribe';
            case 'boost': return 'Boost';
            case 'taplink': return 'Tap Link';
            default: return type;
        }
    }
    
    function updateStartButtonText() {
        if (!elements.startGiveawayBtn) return;
        const btnSpan = elements.startGiveawayBtn.querySelector('span');
        if (btnSpan) {
            btnSpan.textContent = 'Start Giveaway';
        }
    }

    // ==================== API FUNCTIONS ====================

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, { 
                ...options, 
                headers: { 
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json' 
                } 
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }
    
    async function startGiveaway() {
        if (elements.startGiveawayBtn.disabled) {
            showToast('Lengkapi semua data terlebih dahulu', 'warning');
            return;
        }
        
        hapticHeavy();
        showLoading(true);
        
        // Update button state
        if (elements.startGiveawayBtn) {
            elements.startGiveawayBtn.disabled = true;
            elements.startGiveawayBtn.innerHTML = '<span class="btn-loading"></span><span>Memproses...</span>';
        }
        
        try {
            const payload = {
                user_id: telegramUser?.id,
                username: telegramUser?.username || '',
                first_name: telegramUser?.first_name || '',
                last_name: telegramUser?.last_name || '',
                prizes: giveawayData.prizes,
                chats: giveawayData.chats,
                end_time: giveawayData.endTime,
                links: giveawayData.links,
                requirements: Array.from(selectedRequirements),
                captcha: elements.captchaToggle?.checked || false
            };
            
            const response = await fetchWithRetry(`${API_BASE_URL}/api/giveaway/create`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (response.success) {
                hapticSuccess();
                showToast('Giveaway berhasil dibuat!', 'success');
                
                // Close WebApp or redirect
                const tg = getTelegramWebApp();
                if (tg && tg.close) {
                    setTimeout(() => tg.close(), 2000);
                } else {
                    setTimeout(() => {
                        window.location.href = `/giveaways?id=${response.giveaway_code}`;
                    }, 2000);
                }
            } else {
                hapticError();
                showToast(response.error || 'Gagal membuat giveaway', 'error');
                if (elements.startGiveawayBtn) {
                    elements.startGiveawayBtn.disabled = false;
                    elements.startGiveawayBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Giveaway</span>';
                }
            }
        } catch (error) {
            console.error('Error creating giveaway:', error);
            hapticError();
            showToast('Terjadi kesalahan', 'error');
            if (elements.startGiveawayBtn) {
                elements.startGiveawayBtn.disabled = false;
                elements.startGiveawayBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Giveaway</span>';
            }
        } finally {
            showLoading(false);
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
    
    function setupEventListeners() {
        // Prize
        if (elements.addPrizeBtn) elements.addPrizeBtn.addEventListener('click', openPrizeModal);
        if (elements.savePrizeBtn) elements.savePrizeBtn.addEventListener('click', savePrize);
        if (elements.cancelPrizeBtn) elements.cancelPrizeBtn.addEventListener('click', () => closeModal(elements.prizeModal));
        if (elements.closePrizeModal) elements.closePrizeModal.addEventListener('click', () => closeModal(elements.prizeModal));
        
        // Chat
        if (elements.addChatBtn) elements.addChatBtn.addEventListener('click', openChatModal);
        if (elements.closeChatModal) elements.closeChatModal.addEventListener('click', () => closeModal(elements.chatModal));
        
        // Link
        if (elements.addLinkBtn) elements.addLinkBtn.addEventListener('click', openLinkModal);
        if (elements.saveLinkBtn) elements.saveLinkBtn.addEventListener('click', saveLinks);
        if (elements.cancelLinkBtn) elements.cancelLinkBtn.addEventListener('click', () => closeModal(elements.linkModal));
        if (elements.closeLinkModal) elements.closeLinkModal.addEventListener('click', () => closeModal(elements.linkModal));
        
        // Duration
        if (elements.editDurationBtn) elements.editDurationBtn.addEventListener('click', openDurationModal);
        if (elements.saveDurationBtn) elements.saveDurationBtn.addEventListener('click', saveDuration);
        if (elements.cancelDurationBtn) elements.cancelDurationBtn.addEventListener('click', () => closeModal(elements.durationModal));
        if (elements.closeDurationModal) elements.closeDurationModal.addEventListener('click', () => closeModal(elements.durationModal));
        
        // Requirements
        document.querySelectorAll('.req-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                toggleRequirement(type);
            });
        });
        
        // Start button
        if (elements.startGiveawayBtn) elements.startGiveawayBtn.addEventListener('click', startGiveaway);
        
        // Close modals on overlay click
        const modals = [elements.prizeModal, elements.chatModal, elements.linkModal, elements.durationModal];
        modals.forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeModal(modal);
                });
            }
        });
    }
    
    async function init() {
        initTelegram();
        showLoading(true);
        
        telegramUser = getTelegramUser();
        if (telegramUser) {
            updateUserUI();
        } else {
            showToast('Tidak dapat mengambil data user', 'error');
        }
        
        setupEventListeners();
        renderPrizes();
        renderChats();
        renderLinks();
        renderDuration();
        renderRequirements();
        checkFormValidity();
        
        showLoading(false);
        console.log('✅ Create Giveaway page initialized');
    }
    
    init();
})();
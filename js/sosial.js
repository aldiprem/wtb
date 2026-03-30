// sosial.js - Pengaturan Sosial Website
(function() {
    'use strict';
    
    console.log('📱 Social Manager - Initializing...');

    // ==================== KONFIGURASI ====================
    const API_BASE_URL = window.ENV?.API_BASE_URL || 'https://companel.shop';
    const MAX_RETRIES = 3;

    // ==================== STATE ====================
    let currentWebsite = null;
    let telegramData = null;
    let linksData = null;
    let forceList = [];
    let forceSettings = null;
    let currentForceId = null;
    let deleteTarget = null;

    // ==================== DOM ELEMENTS ====================
    const elements = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        websiteBadge: document.getElementById('websiteBadge'),
        backToPanel: document.getElementById('backToPanel'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Telegram
        channelLink: document.getElementById('channelLink'),
        channelUsername: document.getElementById('channelUsername'),
        channelId: document.getElementById('channelId'),
        channelDesc: document.getElementById('channelDesc'),
        channelActive: document.getElementById('channelActive'),
        
        testiLink: document.getElementById('testiLink'),
        testiUsername: document.getElementById('testiUsername'),
        testiId: document.getElementById('testiId'),
        testiActive: document.getElementById('testiActive'),
        
        contactUsername: document.getElementById('contactUsername'),
        contactUserId: document.getElementById('contactUserId'),
        contactLink: document.getElementById('contactLink'),
        contactActive: document.getElementById('contactActive'),
        
        botUsername: document.getElementById('botUsername'),
        botLink: document.getElementById('botLink'),
        botId: document.getElementById('botId'),
        botCommand: document.getElementById('botCommand'),
        botActive: document.getElementById('botActive'),
        
        // Links & Rnk
        rnkLink: document.getElementById('rnkLink'),
        rnkCode: document.getElementById('rnkCode'),
        rnkActive: document.getElementById('rnkActive'),
        
        instagramLink: document.getElementById('instagramLink'),
        facebookLink: document.getElementById('facebookLink'),
        tiktokLink: document.getElementById('tiktokLink'),
        youtubeLink: document.getElementById('youtubeLink'),
        whatsappLink: document.getElementById('whatsappLink'),
        emailContact: document.getElementById('emailContact'),
        
        // Force Subscribe
        forceContainer: document.getElementById('forceContainer'),
        emptyForce: document.getElementById('emptyForce'),
        addForceChannelBtn: document.getElementById('addForceChannelBtn'),
        emptyAddForceBtn: document.getElementById('emptyAddForceBtn'),
        forceGlobalActive: document.getElementById('forceGlobalActive'),
        forceInterval: document.getElementById('forceInterval'),
        forceMessage: document.getElementById('forceMessage'),
        
        // Force Modal
        forceModal: document.getElementById('forceModal'),
        forceModalTitle: document.getElementById('forceModalTitle'),
        forceForm: document.getElementById('forceForm'),
        forceId: document.getElementById('forceId'),
        forceTypeRadios: document.querySelectorAll('input[name="forceType"]'),
        forceNama: document.getElementById('forceNama'),
        forceUsername: document.getElementById('forceUsername'),
        forceLink: document.getElementById('forceLink'),
        forceChatId: document.getElementById('forceChatId'),
        forceDesc: document.getElementById('forceDesc'),
        forceActive: document.getElementById('forceActive'),
        closeForceModal: document.getElementById('closeForceModal'),
        cancelForceBtn: document.getElementById('cancelForceBtn'),
        
        // Delete Modal
        deleteModal: document.getElementById('deleteModal'),
        deleteMessage: document.getElementById('deleteMessage'),
        deleteInfo: document.getElementById('deleteInfo'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    // ==================== UTILITY FUNCTIONS ====================
    function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    function showLoading(show = true) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function vibrate(duration = 20) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== KEYBOARD HANDLER ====================
    function setupKeyboardHandler() {
        function scrollToInput(input) {
            const rect = input.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight * 0.4;
            
            if (rect.bottom > windowHeight - keyboardHeight) {
                const scrollY = window.scrollY + rect.bottom - (windowHeight - keyboardHeight) + 20;
                window.scrollTo({ top: scrollY, behavior: 'smooth' });
            }
        }
        
        const modalInputs = document.querySelectorAll('.modal input, .modal textarea, .modal select');
        
        modalInputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    scrollToInput(input);
                    
                    const modal = input.closest('.modal');
                    if (modal) {
                        modal.classList.add('modal-with-input');
                        const modalContent = modal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.maxHeight = '70vh';
                            modalContent.style.overflowY = 'auto';
                        }
                    }
                }, 300);
            });
            
            input.addEventListener('blur', () => {
                const modal = input.closest('.modal');
                if (modal) {
                    modal.classList.remove('modal-with-input');
                }
            });
        });
    }

    // ==================== API FUNCTIONS ====================
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async function loadWebsite() {
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('website');
        
        if (!endpoint) {
            showToast('Website tidak ditemukan', 'error');
            setTimeout(() => {
                window.location.href = '/html/panel.html';
            }, 2000);
            return null;
        }
        
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/api/websites/endpoint/${endpoint}`, {
                method: 'GET'
            });
            
            if (data.success && data.website) {
                if (elements.websiteBadge) {
                    elements.websiteBadge.textContent = '/' + data.website.endpoint;
                }
                return data.website;
            } else {
                throw new Error('Website not found');
            }
        } catch (error) {
            console.error('❌ Error loading website:', error);
            showToast('Gagal memuat data website', 'error');
            return null;
        }
    }

    async function loadTelegram() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/telegram/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success && response.data) {
                telegramData = response.data;
                updateTelegramUI();
            } else {
                telegramData = null;
            }
        } catch (error) {
            console.error('❌ Error loading telegram:', error);
            telegramData = null;
        }
    }

    async function loadLinks() {
        if (!currentWebsite) return;
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/links/${currentWebsite.id}`, {
                method: 'GET'
            });
            
            if (response.success && response.data) {
                linksData = response.data;
                updateLinksUI();
            } else {
                linksData = null;
            }
        } catch (error) {
            console.error('❌ Error loading links:', error);
            linksData = null;
        }
    }

    async function loadForce() {
        if (!currentWebsite) return;
        
        try {
            const [listResponse, settingsResponse] = await Promise.all([
                fetchWithRetry(`${API_BASE_URL}/api/social/force/${currentWebsite.id}`, { method: 'GET' }),
                fetchWithRetry(`${API_BASE_URL}/api/social/force-settings/${currentWebsite.id}`, { method: 'GET' })
            ]);
            
            if (listResponse.success) {
                forceList = listResponse.data || [];
            } else {
                forceList = [];
            }
            
            if (settingsResponse.success) {
                forceSettings = settingsResponse.data;
                updateForceSettingsUI();
            } else {
                forceSettings = null;
            }
            
            renderForceList();
        } catch (error) {
            console.error('❌ Error loading force:', error);
            forceList = [];
            forceSettings = null;
            renderForceList();
        }
    }

    // ==================== UPDATE UI FUNCTIONS ====================
    function updateTelegramUI() {
        if (!telegramData) return;
        
        if (elements.channelLink) elements.channelLink.value = telegramData.channel_link || '';
        if (elements.channelUsername) elements.channelUsername.value = telegramData.channel_username || '';
        if (elements.channelId) elements.channelId.value = telegramData.channel_id || '';
        if (elements.channelDesc) elements.channelDesc.value = telegramData.channel_desc || '';
        if (elements.channelActive) elements.channelActive.checked = telegramData.channel_active === 1;
        
        if (elements.testiLink) elements.testiLink.value = telegramData.testi_link || '';
        if (elements.testiUsername) elements.testiUsername.value = telegramData.testi_username || '';
        if (elements.testiId) elements.testiId.value = telegramData.testi_id || '';
        if (elements.testiActive) elements.testiActive.checked = telegramData.testi_active === 1;
        
        if (elements.contactUsername) elements.contactUsername.value = telegramData.contact_username || '';
        if (elements.contactUserId) elements.contactUserId.value = telegramData.contact_user_id || '';
        if (elements.contactLink) elements.contactLink.value = telegramData.contact_link || '';
        if (elements.contactActive) elements.contactActive.checked = telegramData.contact_active !== 0;
        
        if (elements.botUsername) elements.botUsername.value = telegramData.bot_username || '';
        if (elements.botLink) elements.botLink.value = telegramData.bot_link || '';
        if (elements.botId) elements.botId.value = telegramData.bot_id || '';
        if (elements.botCommand) elements.botCommand.value = telegramData.bot_command || '/start';
        if (elements.botActive) elements.botActive.checked = telegramData.bot_active === 1;
    }

    function updateLinksUI() {
        if (!linksData) return;
        
        if (elements.rnkLink) elements.rnkLink.value = linksData.rnk_link || '';
        if (elements.rnkCode) elements.rnkCode.value = linksData.rnk_code || '';
        if (elements.rnkActive) elements.rnkActive.checked = linksData.rnk_active === 1;
        
        if (elements.instagramLink) elements.instagramLink.value = linksData.instagram || '';
        if (elements.facebookLink) elements.facebookLink.value = linksData.facebook || '';
        if (elements.tiktokLink) elements.tiktokLink.value = linksData.tiktok || '';
        if (elements.youtubeLink) elements.youtubeLink.value = linksData.youtube || '';
        if (elements.whatsappLink) elements.whatsappLink.value = linksData.whatsapp || '';
        if (elements.emailContact) elements.emailContact.value = linksData.email || '';
    }

    function updateForceSettingsUI() {
        if (!forceSettings) return;
        
        if (elements.forceGlobalActive) elements.forceGlobalActive.checked = forceSettings.global_active === 1;
        if (elements.forceInterval) elements.forceInterval.value = forceSettings.check_interval || 30;
        if (elements.forceMessage) elements.forceMessage.value = forceSettings.warning_message || '';
    }

    // ==================== RENDER FUNCTIONS ====================
    function renderForceList() {
        if (!elements.forceContainer || !elements.emptyForce) return;
        
        if (forceList.length === 0) {
            elements.forceContainer.innerHTML = '';
            elements.emptyForce.style.display = 'block';
            return;
        }
        
        elements.emptyForce.style.display = 'none';
        
        let html = '';
        forceList.forEach((item, index) => {
            const typeIcon = item.type === 'channel' ? 'fa-bell' : 
                            item.type === 'group' ? 'fa-users' : 'fa-users-cog';
            const typeText = item.type === 'channel' ? 'Channel' : 
                            item.type === 'group' ? 'Group' : 'Supergroup';
            const activeClass = item.active ? 'active' : 'inactive';
            const activeIcon = item.active ? 'check-circle' : 'times-circle';
            const activeText = item.active ? 'Aktif' : 'Tidak Aktif';
            
            html += `
                <div class="force-card ${!item.active ? 'inactive' : ''}" data-id="${item.id}">
                    <div class="force-header">
                        <div class="force-icon">
                            <i class="fas ${typeIcon}"></i>
                        </div>
                        <div class="force-info">
                            <div class="force-nama">
                                ${escapeHtml(item.nama)}
                                <span class="force-type">${typeText}</span>
                            </div>
                            <div class="force-username">
                                <i class="fab fa-telegram"></i>
                                @${escapeHtml(item.username)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="force-details">
                        <div class="force-detail-row">
                            <i class="fas fa-link"></i>
                            <span class="force-detail-label">Link:</span>
                            <span class="force-detail-value">${escapeHtml(item.link)}</span>
                        </div>
                        <div class="force-detail-row">
                            <i class="fas fa-id-card"></i>
                            <span class="force-detail-label">Chat ID:</span>
                            <span class="force-detail-value">${escapeHtml(item.chat_id)}</span>
                        </div>
                        <div class="force-detail-row">
                            <i class="fas fa-toggle-on"></i>
                            <span class="force-detail-label">Status:</span>
                            <span class="force-status ${activeClass}">
                                <i class="fas fa-${activeIcon}"></i> ${activeText}
                            </span>
                        </div>
                        ${item.description ? `
                            <div class="force-desc">
                                <i class="fas fa-sticky-note"></i>
                                ${escapeHtml(item.description)}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="force-actions">
                        <button class="force-action-btn edit" onclick="window.sosial.editForce(${item.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="force-action-btn delete" onclick="window.sosial.deleteForce(${item.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.forceContainer.innerHTML = html;
    }

    // ==================== FORCE FUNCTIONS ====================
    function openForceModal(item = null) {
        if (item) {
            // Edit mode
            elements.forceModalTitle.textContent = 'Edit Channel/Group';
            elements.forceId.value = item.id || '';
            
            // Set type
            elements.forceTypeRadios.forEach(radio => {
                if (radio.value === (item.type || 'channel')) {
                    radio.checked = true;
                }
            });
            
            elements.forceNama.value = item.nama || '';
            elements.forceUsername.value = item.username || '';
            elements.forceLink.value = item.link || '';
            elements.forceChatId.value = item.chat_id || '';
            elements.forceDesc.value = item.description || '';
            elements.forceActive.checked = item.active !== false;
        } else {
            // Add mode
            elements.forceModalTitle.textContent = 'Tambah Channel/Group';
            elements.forceForm.reset();
            elements.forceId.value = '';
            elements.forceTypeRadios[0].checked = true;
            elements.forceActive.checked = true;
        }
        
        elements.forceModal.classList.add('active');
        vibrate(10);
        
        setTimeout(() => {
            elements.forceNama.focus();
        }, 300);
    }

    function closeForceModal() {
        elements.forceModal.classList.remove('active');
        currentForceId = null;
    }

    async function saveForce(e) {
        e.preventDefault();
        
        if (!currentWebsite) return;
        
        const type = document.querySelector('input[name="forceType"]:checked')?.value || 'channel';
        const nama = elements.forceNama.value.trim();
        const username = elements.forceUsername.value.trim();
        const link = elements.forceLink.value.trim();
        const chatId = elements.forceChatId.value.trim();
        const description = elements.forceDesc.value.trim();
        const active = elements.forceActive.checked;
        
        // Validasi
        if (!nama) {
            showToast('Nama wajib diisi', 'warning');
            elements.forceNama.focus();
            return;
        }
        
        if (!username) {
            showToast('Username wajib diisi', 'warning');
            elements.forceUsername.focus();
            return;
        }
        
        if (!link) {
            showToast('Link wajib diisi', 'warning');
            elements.forceLink.focus();
            return;
        }
        
        if (!chatId) {
            showToast('Chat ID wajib diisi', 'warning');
            elements.forceChatId.focus();
            return;
        }
        
        const data = {
            id: elements.forceId.value ? parseInt(elements.forceId.value) : null,
            type: type,
            nama: nama,
            username: username,
            link: link,
            chat_id: chatId,
            description: description,
            active: active
        };
        
        showLoading(true);
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/force/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast(`✅ ${data.id ? 'Diperbarui' : 'Ditambahkan'}`, 'success');
                closeForceModal();
                await loadForce();
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving force:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    function deleteForce(id) {
        const item = forceList.find(f => f.id === id);
        if (!item) return;
        
        deleteTarget = { type: 'force', id, nama: item.nama };
        
        elements.deleteMessage.textContent = `Hapus "${item.nama}" dari daftar force subscribe?`;
        elements.deleteInfo.innerHTML = `<strong>${escapeHtml(item.nama)}</strong><br>@${escapeHtml(item.username)}`;
        
        elements.deleteModal.classList.add('active');
        vibrate(10);
    }

    // ==================== SAVE FUNCTIONS ====================
    async function saveTelegram() {
        if (!currentWebsite) return;
        
        const data = {
            channel_link: elements.channelLink?.value.trim() || '',
            channel_username: elements.channelUsername?.value.trim() || '',
            channel_id: elements.channelId?.value.trim() || '',
            channel_desc: elements.channelDesc?.value.trim() || '',
            channel_active: elements.channelActive?.checked || false,
            
            testi_link: elements.testiLink?.value.trim() || '',
            testi_username: elements.testiUsername?.value.trim() || '',
            testi_id: elements.testiId?.value.trim() || '',
            testi_active: elements.testiActive?.checked || false,
            
            contact_username: elements.contactUsername?.value.trim() || '',
            contact_user_id: elements.contactUserId?.value ? parseInt(elements.contactUserId.value) : null,
            contact_link: elements.contactLink?.value.trim() || '',
            contact_active: elements.contactActive?.checked !== false,
            
            bot_username: elements.botUsername?.value.trim() || '',
            bot_link: elements.botLink?.value.trim() || '',
            bot_id: elements.botId?.value ? parseInt(elements.botId.value) : null,
            bot_command: elements.botCommand?.value.trim() || '/start',
            bot_active: elements.botActive?.checked || false
        };
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/telegram/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Pengaturan Telegram disimpan', 'success');
                return true;
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving telegram:', error);
            showToast(error.message, 'error');
            return false;
        }
    }

    async function saveLinks() {
        if (!currentWebsite) return;
        
        const data = {
            rnk_link: elements.rnkLink?.value.trim() || '',
            rnk_code: elements.rnkCode?.value.trim() || '',
            rnk_active: elements.rnkActive?.checked || false,
            
            instagram: elements.instagramLink?.value.trim() || '',
            facebook: elements.facebookLink?.value.trim() || '',
            tiktok: elements.tiktokLink?.value.trim() || '',
            youtube: elements.youtubeLink?.value.trim() || '',
            whatsapp: elements.whatsappLink?.value.trim() || '',
            email: elements.emailContact?.value.trim() || ''
        };
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/links/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Pengaturan Links disimpan', 'success');
                return true;
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving links:', error);
            showToast(error.message, 'error');
            return false;
        }
    }

    async function saveForceSettings() {
        if (!currentWebsite) return;
        
        const data = {
            global_active: elements.forceGlobalActive?.checked || false,
            check_interval: elements.forceInterval?.value ? parseInt(elements.forceInterval.value) : 30,
            warning_message: elements.forceMessage?.value.trim() || ''
        };
        
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/social/force-settings/${currentWebsite.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (response.success) {
                showToast('✅ Pengaturan Force Subscribe disimpan', 'success');
                return true;
            } else {
                throw new Error(response.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('❌ Error saving force settings:', error);
            showToast(error.message, 'error');
            return false;
        }
    }

    async function saveAll() {
        showLoading(true);
        
        try {
            await Promise.all([
                saveTelegram(),
                saveLinks(),
                saveForceSettings()
            ]);
            
            showToast('✅ Semua pengaturan telah disimpan!', 'success');
        } catch (error) {
            console.error('❌ Error saving all:', error);
        } finally {
            showLoading(false);
        }
    }

    // ==================== DELETE FUNCTIONS ====================
    async function confirmDelete() {
        if (!deleteTarget) return;
        
        showLoading(true);
        
        try {
            let response;
            
            if (deleteTarget.type === 'force') {
                response = await fetchWithRetry(`${API_BASE_URL}/api/social/force/${deleteTarget.id}`, {
                    method: 'DELETE'
                });
            }
            
            if (response.success) {
                showToast(`✅ ${deleteTarget.nama} dihapus`, 'success');
                
                if (deleteTarget.type === 'force') {
                    await loadForce();
                }
            } else {
                throw new Error(response.error || 'Gagal menghapus');
            }
        } catch (error) {
            console.error('❌ Error deleting:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
            closeDeleteModal();
        }
    }

    function closeDeleteModal() {
        elements.deleteModal.classList.remove('active');
        deleteTarget = null;
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        showLoading(true);
        
        try {
            currentWebsite = await loadWebsite();
            if (!currentWebsite) return;
            
            await Promise.all([
                loadTelegram(),
                loadLinks(),
                loadForce()
            ]);
            
        } catch (error) {
            console.error('❌ Init error:', error);
            showToast('Gagal memuat data', 'error');
        } finally {
            showLoading(false);
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Di tampilan.js, sosial.js, pembayaran.js
        if (elements.backToPanel) {
          elements.backToPanel.addEventListener('click', (e) => {
            e.preventDefault();

            // Simpan bahwa kita kembali dari halaman settings
            try {
              sessionStorage.setItem('panel_current_page', 'settings');
              sessionStorage.setItem('panel_return_from', 'settings');
            } catch (e) {}

            window.location.href = '/html/panel.html';
          });
        }
        
        // Save all
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', saveAll);
        }
        
        // Tabs
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                elements.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
                
                vibrate(10);
            });
        });
        
        // Force Add buttons
        if (elements.addForceChannelBtn) {
            elements.addForceChannelBtn.addEventListener('click', () => openForceModal());
        }
        if (elements.emptyAddForceBtn) {
            elements.emptyAddForceBtn.addEventListener('click', () => openForceModal());
        }
        
        // Force Modal
        elements.closeForceModal.addEventListener('click', closeForceModal);
        elements.cancelForceBtn.addEventListener('click', closeForceModal);
        elements.forceForm.addEventListener('submit', saveForce);
        
        // Delete Modal
        elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === elements.forceModal) closeForceModal();
            if (e.target === elements.deleteModal) closeDeleteModal();
        });
    }

    // ==================== EXPOSE GLOBAL FUNCTIONS ====================
    window.sosial = {
        editForce: (id) => {
            const item = forceList.find(f => f.id === id);
            if (item) openForceModal(item);
        },
        deleteForce: (id) => deleteForce(id)
    };

    // ==================== START ====================
    setupKeyboardHandler();
    setupEventListeners();
    init();
})();
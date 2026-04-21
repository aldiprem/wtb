// winedash/js/debug.js - Debug Console Application

(function() {
    'use strict';
    
    console.log('🐛 Winedash Debug Console - Initializing...');
    
    const API_BASE_URL = window.location.origin;
    
    // ==================== STATE ====================
    
    let state = {
        currentTab: 'console',
        selectedUserId: null,
        availableUsers: [],
        consoleLogs: [],
        networkRequests: [],
        consoleFilter: '',
        consoleTypeFilter: 'all',
        networkFilter: '',
        networkMethodFilter: 'all',
        autoRefresh: true,
        refreshInterval: null
    };
    
    // ==================== DOM ELEMENTS ====================
    
    const elements = {
        userSelect: document.getElementById('userSelect'),
        refreshToggleBtn: document.getElementById('refreshToggleBtn'),
        statusText: document.getElementById('statusText'),
        statsText: document.getElementById('statsText'),
        userIdDisplay: document.getElementById('userIdDisplay'),
        
        consoleList: document.getElementById('consoleList'),
        networkList: document.getElementById('networkList'),
        storageList: document.getElementById('storageList'),
        
        consoleFilter: document.getElementById('consoleFilter'),
        networkFilter: document.getElementById('networkFilter'),
        storageFilter: document.getElementById('storageFilter'),
        
        detailTitle: document.getElementById('detailTitle'),
        detailRequest: document.getElementById('detailRequest'),
        detailResponse: document.getElementById('detailResponse')
    };
    
    // ==================== UTILITY FUNCTIONS ====================
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatTime(isoString) {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('id-ID', { hour12: false });
        } catch {
            return isoString;
        }
    }
    
    function formatDateTime(isoString) {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('id-ID');
        } catch {
            return isoString;
        }
    }
    
    function truncate(str, maxLength = 50) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - 3) + '...';
    }
    
    // ==================== API CALLS ====================
    
    async function fetchUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/debug/users`);
            const data = await response.json();
            
            if (data.success && data.users) {
                state.availableUsers = data.users;
                updateUserSelect();
                return true;
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        return false;
    }
    
    async function fetchConsoleLogs() {
        if (!state.selectedUserId) {
            renderConsoleEmpty('Select a user to view console logs');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/debug/console/${state.selectedUserId}`);
            const data = await response.json();
            
            if (data.success && data.logs) {
                state.consoleLogs = data.logs;
                renderConsoleLogs();
                updateStats();
                return true;
            }
        } catch (error) {
            console.error('Error fetching console logs:', error);
            renderConsoleEmpty('Error loading console logs');
        }
        return false;
    }
    
    async function fetchNetworkRequests() {
        if (!state.selectedUserId) {
            renderNetworkEmpty('Select a user to view network requests');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/debug/network/${state.selectedUserId}`);
            const data = await response.json();
            
            if (data.success && data.requests) {
                state.networkRequests = data.requests;
                renderNetworkRequests();
                updateStats();
                return true;
            }
        } catch (error) {
            console.error('Error fetching network requests:', error);
            renderNetworkEmpty('Error loading network requests');
        }
        return false;
    }
    
    async function fetchStorageData() {
        if (!state.selectedUserId) {
            renderStorageEmpty('Select a user to view storage data');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/debug/storage/${state.selectedUserId}`);
            const data = await response.json();
            
            if (data.success) {
                renderStorageData(data);
                return true;
            }
        } catch (error) {
            console.error('Error fetching storage data:', error);
            renderStorageEmpty('Error loading storage data');
        }
        return false;
    }
    
    async function clearConsole() {
        if (!state.selectedUserId) return;
        
        try {
            await fetch(`${API_BASE_URL}/api/winedash/debug/console/clear/${state.selectedUserId}`, { method: 'POST' });
            state.consoleLogs = [];
            renderConsoleLogs();
            updateStats();
            updateStatus('Console cleared');
            await fetchUsers();
        } catch (error) {
            console.error('Error clearing console:', error);
        }
    }
    
    async function clearNetwork() {
        if (!state.selectedUserId) return;
        
        try {
            await fetch(`${API_BASE_URL}/api/winedash/debug/network/clear/${state.selectedUserId}`, { method: 'POST' });
            state.networkRequests = [];
            renderNetworkRequests();
            updateStats();
            updateStatus('Network logs cleared');
            await fetchUsers();
        } catch (error) {
            console.error('Error clearing network:', error);
        }
    }
    
    async function clearAll() {
        if (!state.selectedUserId) return;
        if (confirm(`Clear all logs for user ${state.selectedUserId}?`)) {
            await clearConsole();
            await clearNetwork();
            updateStatus('All logs cleared');
        }
    }
    
    // ==================== RENDER FUNCTIONS ====================
    
    function updateUserSelect() {
        if (!elements.userSelect) return;
        
        const previousUserId = state.selectedUserId;
        
        elements.userSelect.innerHTML = '<option value="">-- Select User --</option>';
        
        for (const user of state.availableUsers) {
            const option = document.createElement('option');
            option.value = user.user_id;
            const lastLog = user.last_log ? new Date(user.last_log).toLocaleTimeString() : 'never';
            option.textContent = `User ${user.user_id} (C:${user.console_count} | N:${user.network_count} | Last: ${lastLog})`;
            if (user.user_id == previousUserId) {
                option.selected = true;
            }
            elements.userSelect.appendChild(option);
        }
        
        if (previousUserId && state.availableUsers.some(u => u.user_id == previousUserId)) {
            state.selectedUserId = previousUserId;
        } else if (state.availableUsers.length > 0 && !state.selectedUserId) {
            state.selectedUserId = state.availableUsers[0].user_id;
            elements.userSelect.value = state.selectedUserId;
            if (elements.userIdDisplay) {
                elements.userIdDisplay.textContent = `User ID: ${state.selectedUserId}`;
            }
        }
    }
    
    function renderConsoleLogs() {
        if (!elements.consoleList) return;
        
        let filtered = [...state.consoleLogs];
        
        if (state.consoleFilter) {
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(state.consoleFilter.toLowerCase())
            );
        }
        
        if (state.consoleTypeFilter !== 'all') {
            filtered = filtered.filter(log => log.type === state.consoleTypeFilter);
        }
        
        if (filtered.length === 0) {
            renderConsoleEmpty('No console logs');
            return;
        }
        
        let html = '';
        for (const log of filtered) {
            const time = formatTime(log.timestamp);
            const typeClass = log.type;
            
            html += `
                <div class="log-entry ${typeClass}">
                    <div class="log-header">
                        <span class="log-time">${time}</span>
                        <span class="log-badge ${typeClass}">${log.type.toUpperCase()}</span>
                    </div>
                    <div class="log-message">${escapeHtml(log.message)}</div>
                    ${log.url ? `<div class="log-url">📍 ${escapeHtml(log.url)}</div>` : ''}
                </div>
            `;
        }
        
        elements.consoleList.innerHTML = html;
        elements.consoleList.scrollTop = elements.consoleList.scrollHeight;
    }
    
    function renderConsoleEmpty(message) {
        if (elements.consoleList) {
            elements.consoleList.innerHTML = `<div class="loading-placeholder">${message}</div>`;
        }
    }
    
    function renderNetworkRequests() {
        if (!elements.networkList) return;
        
        let filtered = [...state.networkRequests];
        
        if (state.networkFilter) {
            filtered = filtered.filter(req => 
                req.url.toLowerCase().includes(state.networkFilter.toLowerCase()) ||
                req.method.toLowerCase().includes(state.networkFilter.toLowerCase())
            );
        }
        
        if (state.networkMethodFilter !== 'all') {
            if (state.networkMethodFilter === 'error') {
                filtered = filtered.filter(req => req.status >= 400);
            } else {
                filtered = filtered.filter(req => req.method === state.networkMethodFilter);
            }
        }
        
        if (filtered.length === 0) {
            renderNetworkEmpty('No network requests');
            return;
        }
        
        let html = `
            <div class="network-header">
                <div>Time</div>
                <div>Method</div>
                <div>URL</div>
                <div>Status</div>
                <div>Duration</div>
            </div>
        `;
        
        for (const req of filtered) {
            const time = formatTime(req.timestamp);
            const statusClass = req.status >= 200 && req.status < 400 ? 'success' : 'error';
            const duration = req.duration ? `${req.duration}ms` : '-';
            const displayUrl = truncate(req.url, 50);
            
            html += `
                <div class="network-row" data-request-id="${req.id}" onclick="window.showRequestDetail(${req.id})">
                    <div>${time}</div>
                    <div class="network-method ${req.method}">${req.method}</div>
                    <div title="${escapeHtml(req.url)}">${escapeHtml(displayUrl)}</div>
                    <div class="network-status ${statusClass}">${req.status || 'pending'}</div>
                    <div>${duration}</div>
                </div>
            `;
        }
        
        elements.networkList.innerHTML = html;
    }
    
    function renderNetworkEmpty(message) {
        if (elements.networkList) {
            elements.networkList.innerHTML = `<div class="loading-placeholder">${message}</div>`;
        }
    }
    
    function renderStorageData(data) {
        if (!elements.storageList) return;
        
        let html = `
            <div class="storage-header">
                <div>Key</div>
                <div>Value</div>
            </div>
        `;
        
        const filter = elements.storageFilter?.value.toLowerCase() || '';
        
        // Local Storage
        if (data.localStorage && Object.keys(data.localStorage).length > 0) {
            for (const [key, value] of Object.entries(data.localStorage)) {
                if (filter && !key.toLowerCase().includes(filter) && !value.toLowerCase().includes(filter)) continue;
                html += `
                    <div class="storage-row">
                        <div class="storage-key">${escapeHtml(key)}</div>
                        <div class="storage-value">${escapeHtml(truncate(value, 100))}</div>
                    </div>
                `;
            }
        }
        
        // Session Storage
        if (data.sessionStorage && Object.keys(data.sessionStorage).length > 0) {
            for (const [key, value] of Object.entries(data.sessionStorage)) {
                if (filter && !key.toLowerCase().includes(filter) && !value.toLowerCase().includes(filter)) continue;
                html += `
                    <div class="storage-row">
                        <div class="storage-key" style="color: var(--debug-warning);">[S] ${escapeHtml(key)}</div>
                        <div class="storage-value">${escapeHtml(truncate(value, 100))}</div>
                    </div>
                `;
            }
        }
        
        if (html === `<div class="storage-header"><div>Key</div><div>Value</div></div>`) {
            html = '<div class="loading-placeholder">No storage data available</div>';
        }
        
        elements.storageList.innerHTML = html;
    }
    
    function renderStorageEmpty(message) {
        if (elements.storageList) {
            elements.storageList.innerHTML = `<div class="loading-placeholder">${message}</div>`;
        }
    }
    
    function updateStats() {
        if (elements.statsText) {
            elements.statsText.innerHTML = `Console: ${state.consoleLogs.length} | Network: ${state.networkRequests.length}`;
        }
    }
    
    function updateStatus(message) {
        if (elements.statusText) {
            elements.statusText.innerHTML = message;
            setTimeout(() => {
                if (elements.statusText.innerHTML === message) {
                    elements.statusText.innerHTML = 'Ready';
                }
            }, 3000);
        }
    }
    
    // ==================== SHOW REQUEST DETAIL ====================
    
    window.showRequestDetail = function(requestId) {
        const request = state.networkRequests.find(r => r.id === requestId);
        if (!request) return;
        
        if (elements.detailTitle) {
            elements.detailTitle.innerHTML = `<i class="fas fa-exchange-alt"></i> ${request.method} ${request.url.split('/').pop() || request.url}`;
        }
        
        if (elements.detailRequest) {
            let requestHtml = `<strong>URL:</strong> ${escapeHtml(request.url)}<br><br>`;
            requestHtml += `<strong>Method:</strong> ${request.method}<br><br>`;
            requestHtml += `<strong>Timestamp:</strong> ${formatDateTime(request.timestamp)}<br><br>`;
            if (request.requestBody) {
                let bodyStr = typeof request.requestBody === 'object' ? JSON.stringify(request.requestBody, null, 2) : request.requestBody;
                requestHtml += `<strong>Request Body:</strong><br><pre class="detail-json">${escapeHtml(bodyStr)}</pre>`;
            }
            elements.detailRequest.innerHTML = requestHtml;
        }
        
        if (elements.detailResponse) {
            let responseHtml = `<strong>Status:</strong> ${request.status || 'pending'}<br><br>`;
            if (request.responseBody) {
                let bodyStr = typeof request.responseBody === 'object' ? JSON.stringify(request.responseBody, null, 2) : request.responseBody;
                responseHtml += `<strong>Response Body:</strong><br><pre class="detail-json">${escapeHtml(bodyStr)}</pre>`;
            }
            elements.detailResponse.innerHTML = responseHtml;
        }
    };
    
    // ==================== TAB SWITCHING ====================
    
    function switchTab(tab) {
        state.currentTab = tab;
        
        document.querySelectorAll('.debug-tab').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.getElementById('consolePanel')?.classList.toggle('hidden', tab !== 'console');
        document.getElementById('networkPanel')?.classList.toggle('hidden', tab !== 'network');
        document.getElementById('storagePanel')?.classList.toggle('hidden', tab !== 'storage');
        
        if (tab === 'console') {
            renderConsoleLogs();
        } else if (tab === 'network') {
            renderNetworkRequests();
        } else if (tab === 'storage') {
            fetchStorageData();
        }
    }
    
    // ==================== AUTO REFRESH ====================
    
    function startAutoRefresh() {
        if (state.refreshInterval) clearInterval(state.refreshInterval);
        
        state.refreshInterval = setInterval(() => {
            if (state.autoRefresh && state.selectedUserId) {
                if (state.currentTab === 'console') {
                    fetchConsoleLogs();
                } else if (state.currentTab === 'network') {
                    fetchNetworkRequests();
                }
                fetchUsers();
            }
        }, 3000);
    }
    
    function toggleAutoRefresh() {
        state.autoRefresh = !state.autoRefresh;
        if (elements.refreshToggleBtn) {
            elements.refreshToggleBtn.textContent = state.autoRefresh ? 'Pause' : 'Resume';
            elements.refreshToggleBtn.className = state.autoRefresh ? 'btn btn-warning' : 'btn btn-success';
        }
        updateStatus(state.autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh paused');
    }
    
    // ==================== EVENT LISTENERS ====================
    
    function setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.debug-tab').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
        
        // User select
        if (elements.userSelect) {
            elements.userSelect.addEventListener('change', async () => {
                state.selectedUserId = elements.userSelect.value ? parseInt(elements.userSelect.value) : null;
                if (elements.userIdDisplay) {
                    elements.userIdDisplay.textContent = state.selectedUserId ? `User ID: ${state.selectedUserId}` : 'No user selected';
                }
                if (state.selectedUserId) {
                    await fetchConsoleLogs();
                    await fetchNetworkRequests();
                    updateStatus(`Viewing logs for user ${state.selectedUserId}`);
                } else {
                    renderConsoleEmpty('Select a user to view console logs');
                    renderNetworkEmpty('Select a user to view network requests');
                }
            });
        }
        
        // Clear buttons
        document.getElementById('clearConsoleBtn')?.addEventListener('click', clearConsole);
        document.getElementById('clearNetworkBtn')?.addEventListener('click', clearNetwork);
        document.getElementById('clearAllBtn')?.addEventListener('click', clearAll);
        
        // Refresh toggle
        if (elements.refreshToggleBtn) {
            elements.refreshToggleBtn.addEventListener('click', toggleAutoRefresh);
        }
        
        // Filters
        if (elements.consoleFilter) {
            elements.consoleFilter.addEventListener('input', (e) => {
                state.consoleFilter = e.target.value;
                renderConsoleLogs();
            });
        }
        
        if (elements.networkFilter) {
            elements.networkFilter.addEventListener('input', (e) => {
                state.networkFilter = e.target.value;
                renderNetworkRequests();
            });
        }
        
        if (elements.storageFilter) {
            elements.storageFilter.addEventListener('input', () => fetchStorageData());
        }
        
        // Console type filters
        document.querySelectorAll('[data-console-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.consoleFilter;
                state.consoleTypeFilter = filter;
                document.querySelectorAll('[data-console-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderConsoleLogs();
            });
        });
        
        // Network method filters
        document.querySelectorAll('[data-network-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.networkFilter;
                state.networkMethodFilter = filter;
                document.querySelectorAll('[data-network-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderNetworkRequests();
            });
        });
    }
    
    // ==================== INITIALIZATION ====================
    
    async function init() {
        console.log('🐛 Debug Console initializing...');
        
        setupEventListeners();
        
        await fetchUsers();
        
        if (state.availableUsers.length > 0 && !state.selectedUserId) {
            state.selectedUserId = state.availableUsers[0].user_id;
            if (elements.userSelect) elements.userSelect.value = state.selectedUserId;
            if (elements.userIdDisplay) elements.userIdDisplay.textContent = `User ID: ${state.selectedUserId}`;
            await fetchConsoleLogs();
            await fetchNetworkRequests();
        }
        
        startAutoRefresh();
        
        updateStatus('Debug console ready');
        console.log('✅ Debug Console initialized');
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
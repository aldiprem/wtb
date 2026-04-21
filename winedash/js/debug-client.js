// winedash/js/debug-client.js - Client-side logger untuk mengirim log ke server
// Script ini akan di-load hanya saat parameter ?debug=1 ditambahkan

(function() {
    'use strict';
    
    const API_BASE_URL = window.location.origin;
    
    // Dapatkan user ID dari Telegram WebApp
    function getTelegramUserId() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    return initData.user.id;
                }
            }
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            if (userId) return parseInt(userId);
            return null;
        } catch (error) {
            console.error('Error getting user ID:', error);
            return null;
        }
    }
    
    const userId = getTelegramUserId();
    if (!userId) {
        console.warn('[DEBUG] No user ID found, debug logging disabled');
        return;
    }
    
    console.log(`[DEBUG] Debug logger aktif untuk user ID: ${userId}`);
    
    // Simpan original console methods
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    
    // Queue untuk batch sending
    let logQueue = [];
    let sendTimer = null;
    
    function sendLogs() {
        if (logQueue.length === 0) return;
        
        const logsToSend = [...logQueue];
        logQueue = [];
        
        fetch(`${API_BASE_URL}/api/winedash/debug/console/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                logs: logsToSend
            })
        }).catch(err => {
            console.error('[DEBUG] Failed to send logs:', err);
            // Restore failed logs (limit to 100)
            if (logQueue.length < 100) {
                logQueue.unshift(...logsToSend);
            }
        });
    }
    
    function addToQueue(type, args) {
        const message = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        logQueue.push({
            type: type,
            message: message,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
        
        if (logQueue.length >= 10) {
            sendLogs();
        } else if (!sendTimer) {
            sendTimer = setTimeout(() => {
                sendLogs();
                sendTimer = null;
            }, 1000);
        }
    }
    
    // Override console methods
    console.log = function() {
        addToQueue('log', arguments);
        originalConsole.log.apply(console, arguments);
    };
    
    console.error = function() {
        addToQueue('error', arguments);
        originalConsole.error.apply(console, arguments);
    };
    
    console.warn = function() {
        addToQueue('warn', arguments);
        originalConsole.warn.apply(console, arguments);
    };
    
    console.info = function() {
        addToQueue('info', arguments);
        originalConsole.info.apply(console, arguments);
    };
    
    // Kirim logs saat page unload
    window.addEventListener('beforeunload', () => {
        if (logQueue.length > 0) {
            sendLogs();
        }
    });
    
    // Network request capture
    const originalFetch = window.fetch;
    window.fetch = function() {
        const startTime = Date.now();
        const url = arguments[0];
        const options = arguments[1] || {};
        const method = options.method || 'GET';
        
        let requestBody = null;
        if (options.body) {
            try {
                requestBody = JSON.parse(options.body);
            } catch (e) {
                requestBody = options.body;
            }
        }
        
        return originalFetch.apply(this, arguments)
            .then(response => {
                const duration = Date.now() - startTime;
                const clonedResponse = response.clone();
                clonedResponse.json().then(data => {
                    fetch(`${API_BASE_URL}/api/winedash/debug/network/add`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: userId,
                            method: method,
                            url: typeof url === 'string' ? url : url.url,
                            status: response.status,
                            duration: duration,
                            requestBody: requestBody,
                            responseBody: data,
                            timestamp: new Date().toISOString()
                        })
                    }).catch(() => {});
                }).catch(() => {});
                return response;
            })
            .catch(error => {
                const duration = Date.now() - startTime;
                fetch(`${API_BASE_URL}/api/winedash/debug/network/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        method: method,
                        url: typeof url === 'string' ? url : url.url,
                        status: 0,
                        duration: duration,
                        requestBody: requestBody,
                        responseBody: { error: error.message },
                        timestamp: new Date().toISOString()
                    })
                }).catch(() => {});
                throw error;
            });
    };
    
    console.log('[DEBUG] Debug logger initialized and ready');
})();
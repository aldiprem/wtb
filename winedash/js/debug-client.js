// winedash/js/debug-client.js - VERSI DIPERBAIKI

(function() {
    'use strict';
    
    const API_BASE_URL = window.location.origin;
    let userId = null;
    
    // ==================== DAPATKAN USER ID ====================
    function getTelegramUserId() {
        try {
            // Coba dari Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                const initData = window.Telegram.WebApp.initDataUnsafe;
                if (initData && initData.user) {
                    console.log('[DEBUG] Got user from Telegram WebApp:', initData.user.id);
                    return initData.user.id;
                }
            }
            
            // Coba dari localStorage (fallback)
            const storedUserId = localStorage.getItem('winedash_user_id');
            if (storedUserId) {
                console.log('[DEBUG] Got user from localStorage:', storedUserId);
                return parseInt(storedUserId);
            }
            
            // Coba dari URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const userIdParam = urlParams.get('user_id');
            if (userIdParam) {
                console.log('[DEBUG] Got user from URL param:', userIdParam);
                return parseInt(userIdParam);
            }
            
            console.warn('[DEBUG] No user ID found');
            return null;
        } catch (error) {
            console.error('[DEBUG] Error getting user ID:', error);
            return null;
        }
    }
    
    // ==================== TUNGGU TELEGRAM USER LOAD ====================
    function waitForTelegramUser() {
        return new Promise((resolve) => {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                resolve(window.Telegram.WebApp.initDataUnsafe.user.id);
                return;
            }
            
            // Tunggu maksimal 5 detik
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    clearInterval(interval);
                    resolve(window.Telegram.WebApp.initDataUnsafe.user.id);
                } else if (attempts > 50) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 100);
        });
    }
    
    // ==================== KIRIM LOG KE SERVER ====================
    let logQueue = [];
    let sendTimer = null;
    let isSending = false;
    
    async function sendLogsToServer() {
        if (logQueue.length === 0 || isSending) return;
        
        isSending = true;
        const logsToSend = [...logQueue];
        logQueue = [];
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/winedash/debug/console/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    logs: logsToSend
                })
            });
            
            if (!response.ok) {
                console.error('[DEBUG] Failed to send logs, status:', response.status);
                // Kembalikan logs ke queue jika gagal
                logQueue.unshift(...logsToSend);
                if (logQueue.length > 500) logQueue = logQueue.slice(0, 500);
            }
        } catch (err) {
            console.error('[DEBUG] Failed to send logs:', err);
            logQueue.unshift(...logsToSend);
            if (logQueue.length > 500) logQueue = logQueue.slice(0, 500);
        } finally {
            isSending = false;
        }
    }
    
    function queueLog(type, args, url = null) {
        if (!userId) return;
        
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
            message: message.substring(0, 1000),
            url: url || window.location.href,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
        
        if (logQueue.length >= 5) {
            sendLogsToServer();
        } else if (sendTimer) {
            clearTimeout(sendTimer);
        }
        
        sendTimer = setTimeout(() => {
            sendLogsToServer();
            sendTimer = null;
        }, 1000);
    }
    
    // ==================== HOOK CONSOLE METHODS ====================
    if (typeof console !== 'undefined') {
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };
        
        console.log = function() {
            queueLog('log', arguments);
            originalConsole.log.apply(console, arguments);
        };
        
        console.error = function() {
            queueLog('error', arguments);
            originalConsole.error.apply(console, arguments);
        };
        
        console.warn = function() {
            queueLog('warn', arguments);
            originalConsole.warn.apply(console, arguments);
        };
        
        console.info = function() {
            queueLog('info', arguments);
            originalConsole.info.apply(console, arguments);
        };
        
        console.debug = function() {
            queueLog('debug', arguments);
            originalConsole.debug.apply(console, arguments);
        };
    }
    
    // ==================== HOOK FETCH ====================
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
            .then(async (response) => {
                const duration = Date.now() - startTime;
                const clonedResponse = response.clone();
                
                try {
                    let responseBody = null;
                    const contentType = clonedResponse.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        responseBody = await clonedResponse.json();
                    } else {
                        responseBody = await clonedResponse.text();
                        if (responseBody.length > 1000) responseBody = responseBody.substring(0, 1000) + '...';
                    }
                    
                    if (userId) {
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
                                responseBody: responseBody,
                                timestamp: new Date().toISOString()
                            })
                        }).catch(() => {});
                    }
                } catch (e) {
                    console.error('[DEBUG] Error capturing response:', e);
                }
                
                return response;
            })
            .catch(async (error) => {
                const duration = Date.now() - startTime;
                
                if (userId) {
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
                }
                
                throw error;
            });
    };
    
    // ==================== HOOK XMLHttpRequest ====================
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._debugData = {
            method: method,
            url: url,
            startTime: null
        };
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        if (this._debugData) {
            this._debugData.startTime = Date.now();
            this._debugData.requestBody = body;
            
            this.addEventListener('loadend', () => {
                const duration = Date.now() - this._debugData.startTime;
                
                if (userId && this.status) {
                    let responseBody = null;
                    try {
                        if (this.responseType === 'json' || (this.getResponseHeader('content-type') || '').includes('json')) {
                            responseBody = this.response;
                        } else {
                            responseBody = this.responseText;
                            if (responseBody && responseBody.length > 1000) responseBody = responseBody.substring(0, 1000) + '...';
                        }
                    } catch (e) {
                        responseBody = '(unable to parse)';
                    }
                    
                    fetch(`${API_BASE_URL}/api/winedash/debug/network/add`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: userId,
                            method: this._debugData.method,
                            url: this._debugData.url,
                            status: this.status,
                            duration: duration,
                            requestBody: this._debugData.requestBody,
                            responseBody: responseBody,
                            timestamp: new Date().toISOString()
                        })
                    }).catch(() => {});
                }
            });
        }
        
        return originalXHRSend.apply(this, arguments);
    };
    
    // ==================== KIRIM LOG SAAT PAGE UNLOAD ====================
    window.addEventListener('beforeunload', () => {
        if (logQueue.length > 0) {
            // Gunakan sendBeacon untuk pengiriman synchronus
            const logsToSend = [...logQueue];
            const blob = new Blob([JSON.stringify({
                user_id: userId,
                logs: logsToSend
            })], { type: 'application/json' });
            navigator.sendBeacon(`${API_BASE_URL}/api/winedash/debug/console/add`, blob);
        }
    });
    
    // ==================== INITIALIZATION ====================
    async function init() {
        console.log('[DEBUG] Debug client initializing...');
        
        // Tunggu Telegram user
        userId = await waitForTelegramUser();
        
        if (!userId) {
            userId = getTelegramUserId();
        }
        
        if (userId) {
            // Simpan ke localStorage untuk referensi
            localStorage.setItem('winedash_user_id', userId);
            console.log(`[DEBUG] Debug client initialized for user ID: ${userId}`);
            
            // Kirim log inisialisasi
            queueLog('info', [`Debug client initialized for user ${userId}`]);
            
            // Kirim semua log yang tertunda
            setTimeout(() => {
                sendLogsToServer();
            }, 500);
        } else {
            console.warn('[DEBUG] No user ID found, debug logging disabled');
        }
    }
    
    // Jalankan init setelah DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
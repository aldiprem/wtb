(function() {
    'use strict';
    
    console.log('[IP Tracker] Initializing...');
    
    const API_BASE_URL = window.location.origin;
    
    function getTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            return window.Telegram.WebApp;
        }
        return null;
    }
    
    function getTelegramUser() {
        try {
            const tg = getTelegramWebApp();
            if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                return tg.initDataUnsafe.user;
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user:', error);
            return null;
        }
    }
    
    async function sendTrackingData() {
        const tg = getTelegramWebApp();
        const user = getTelegramUser();
        
        if (!user) {
            console.log('[IP Tracker] No Telegram user found, skipping');
            return;
        }
        
        console.log('[IP Tracker] Sending tracking data for user:', user.id);
        
        try {
            const response = await fetch('/api/cek-ip/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: {
                        id: user.id,
                        username: user.username || '',
                        first_name: user.first_name || '',
                        last_name: user.last_name || '',
                        photo_url: user.photo_url || ''
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('[IP Tracker] Tracking successful');
            } else {
                console.error('[IP Tracker] Tracking failed:', data.error);
            }
        } catch (error) {
            console.error('[IP Tracker] Error:', error);
        }
    }
    
    // Kirim data tracking saat halaman dimuat
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(sendTrackingData, 1000);
    });
})();
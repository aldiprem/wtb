// Konfigurasi path berdasarkan environment
(function() {
    window.APP_CONFIG = {
        // Deteksi apakah di GitHub Pages
        isGitHubPages: window.location.hostname.includes('github.io'),
        
        // Base path untuk assets
        get assetPath() {
            if (this.isGitHubPages) {
                // Di GitHub Pages, assets ada di subfolder /wtb/
                return '/wtb';
            }
            // Di local/tunnel, assets di root
            return '';
        },
        
        // API Base URL - tetap pakai tunnel URL
        get apiBaseUrl() {
            return 'https://supports-lease-honest-potter.trycloudflare.com';
        }
    };
    
    console.log('🌍 Environment:', window.APP_CONFIG.isGitHubPages ? 'GitHub Pages' : 'Local/Tunnel');
    console.log('📁 Asset path:', window.APP_CONFIG.assetPath || '(root)');
})();

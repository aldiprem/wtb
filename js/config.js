// config.js - Konfigurasi global
(function() {
  window.APP_CONFIG = {
    // Deteksi environment
    isGitHubPages: window.location.hostname.includes('github.io'),
    
    // API Base URL - GANTI HANYA DI SINI!
    API_BASE_URL: 'https://companel.shop',
    
    // Base path untuk assets
    get assetPath() {
      return this.isGitHubPages ? '/wtb' : '';
    }
  };

  console.log('🌍 Environment:', window.APP_CONFIG.isGitHubPages ? 'GitHub Pages' : 'Local/Tunnel');
  console.log('🔗 API Base URL:', window.APP_CONFIG.API_BASE_URL);
})();
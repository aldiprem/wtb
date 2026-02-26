// config.js - Konfigurasi path berdasarkan environment
(function() {
  window.APP_CONFIG = {
    // Deteksi apakah di GitHub Pages
    isGitHubPages: window.location.hostname.includes('github.io'),

    // Base path untuk assets
    get assetPath() {
      // Di GitHub Pages, pathnya adalah '/wtb'
      // Di lokal/tunnel, pathnya adalah '' (root)
      return this.isGitHubPages ? '/wtb' : '';
    },

    // API Base URL - GANTI DENGAN URL TUNNEL ANDA
    get apiBaseUrl() {
      // PASTIKAN URL INI ADALAH URL TUNNEL CLOUDFLARE YANG AKTIF
      return 'https://supports-lease-honest-potter.trycloudflare.com'; 
    }
  };

  console.log('🌍 Environment:', window.APP_CONFIG.isGitHubPages ? 'GitHub Pages' : 'Local/Tunnel');
  console.log('📁 Asset path:', window.APP_CONFIG.assetPath || '(root)');
  console.log('🔗 API Base URL:', window.APP_CONFIG.apiBaseUrl);
})();
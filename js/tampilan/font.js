/* tampilan.css - Pengaturan Tampilan Website */

:root {
    --tg-bg-color: #0f0f0f;
    --tg-text-color: #ffffff;
    --tg-hint-color: #7d7d7d;
    --tg-link-color: #6ab2f2;
    --tg-button-color: #40a7e3;
    --tg-button-text-color: #ffffff;
    
    --primary-color: #40a7e3;
    --primary-dark: #2d8bcb;
    --primary-light: #6ab2f2;
    --success-color: #10b981;
    --danger-color: #ef4444;
    --warning-color: #f59e0b;
    --info-color: #3b82f6;
    --bg-card: rgba(255, 255, 255, 0.05);
    --bg-card-hover: rgba(255, 255, 255, 0.08);
    --border-color: rgba(255, 255, 255, 0.1);
    --border-color-light: rgba(255, 255, 255, 0.05);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--tg-bg-color);
    color: var(--tg-text-color);
    min-height: 100vh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* ===== LOADING OVERLAY ===== */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(5px);
    z-index: 2000;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(64, 167, 227, 0.3);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

.loading-text {
    color: white;
    font-size: 16px;
    font-weight: 500;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ===== TOAST NOTIFICATIONS ===== */
.toast-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    z-index: 3000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
}

.toast {
    background: var(--bg-card);
    color: white;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
    pointer-events: auto;
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-color);
    max-width: 400px;
    margin: 0 auto;
    width: 100%;
}

.toast-success {
    background: var(--success-color);
    border-color: var(--success-color);
}

.toast-error {
    background: var(--danger-color);
    border-color: var(--danger-color);
}

.toast-warning {
    background: var(--warning-color);
    color: #000;
}

.toast-info {
    background: var(--info-color);
    border-color: var(--info-color);
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

/* ===== MAIN CONTAINER ===== */
.tampilan-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

/* ===== HEADER ===== */
.tampilan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.back-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tg-text-color);
    text-decoration: none;
    transition: all 0.2s;
}

.back-btn:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateX(-2px);
}

.header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.header-icon i {
    font-size: 24px;
    color: #fff;
}

.header-title h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
}

.website-badge {
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    letter-spacing: 0.5px;
}

.header-right .btn-primary {
    white-space: nowrap;
}

/* ===== TABS ===== */
.tampilan-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    padding: 4px;
    background: var(--bg-card);
    border-radius: 40px;
    border: 1px solid var(--border-color);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.tampilan-tabs::-webkit-scrollbar {
    height: 4px;
}

.tampilan-tabs::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}

.tab-btn {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--tg-hint-color);
    font-size: 13px;
    font-weight: 500;
    border-radius: 30px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.tab-btn i {
    font-size: 14px;
}

.tab-btn.active {
    background: var(--primary-color);
    color: white;
}

.tab-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.05);
    color: var(--tg-text-color);
}

/* ===== TAB CONTENT ===== */
.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

/* ===== SETTINGS CARD ===== */
.settings-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
    backdrop-filter: blur(10px);
    margin-bottom: 20px;
}

.card-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.2);
}

.card-header h3 {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.card-header h3 i {
    color: var(--primary-color);
}

.card-body {
    padding: 20px;
}

/* ===== FORM ELEMENTS ===== */
.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--tg-hint-color);
}

.form-group label i {
    color: var(--primary-color);
    font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--tg-text-color);
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    border-color: var(--primary-color);
    background: rgba(64, 167, 227, 0.1);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
    color: var(--tg-hint-color);
}

.form-group small {
    display: block;
    font-size: 11px;
    color: var(--tg-hint-color);
    margin-top: 4px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.form-section {
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
}

.form-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: var(--primary-color);
}

.section-title i {
    font-size: 16px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.checkbox-text {
    font-size: 14px;
    color: var(--tg-text-color);
}

/* ===== FORM ACTIONS ===== */
.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
}

.form-actions .btn-primary,
.form-actions .btn-secondary {
    min-width: 120px;
    justify-content: center;
}

/* ===== BUTTONS ===== */
.btn-primary {
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-primary:hover {
    background: linear-gradient(135deg, var(--primary-light), var(--primary-color));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(64, 167, 227, 0.3);
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    color: var(--tg-text-color);
    border: 1px solid var(--border-color);
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
}

.btn-upload {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--border-color);
    color: var(--tg-text-color);
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-upload:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-upload-small {
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}

.btn-upload-small:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
}

/* ===== LOGO PREVIEW ===== */
.logo-preview {
    position: relative;
    width: 200px;
    height: 200px;
    margin: 0 auto 20px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px dashed var(--border-color);
}

.logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.2);
}

.logo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.logo-preview:hover .logo-overlay {
    opacity: 1;
}

/* ===== PROMO BANNER PREVIEW ===== */
.promo-banner-preview {
    position: relative;
    width: 100%;
    max-width: 640px;
    margin: 0 auto 20px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px dashed var(--border-color);
    aspect-ratio: 1280/760;
}

.promo-banner-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.promo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.promo-banner-preview:hover .promo-overlay {
    opacity: 1;
}

/* ===== COLOR GRID ===== */
.color-grid-2col {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.color-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.color-item label {
    font-size: 13px;
    font-weight: 500;
    color: var(--tg-hint-color);
}

.color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.color-picker-wrapper input[type="color"] {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
}

.color-picker-wrapper input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
}

.color-picker-wrapper input[type="color"]::-webkit-color-swatch {
    border: 1px solid var(--border-color);
    border-radius: 8px;
}

.color-picker-wrapper input[type="text"] {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--tg-text-color);
    font-size: 13px;
    font-family: monospace;
    outline: none;
}

.color-picker-wrapper input[type="text"]:focus {
    border-color: var(--primary-color);
}

/* ===== STATUS TOGGLE ===== */
.status-toggle {
    display: flex;
    align-items: center;
}

.toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
}

.toggle input {
    display: none;
}

.toggle-slider {
    width: 50px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    position: relative;
    transition: all 0.3s;
}

.toggle-slider:before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: all 0.3s;
}

input:checked + .toggle-slider {
    background: var(--success-color);
}

input:checked + .toggle-slider:before {
    transform: translateX(26px);
}

.toggle-label {
    font-size: 14px;
    font-weight: 500;
}

/* ===== BANNER COMPONENTS ===== */
.banner-info-message {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(64, 167, 227, 0.1);
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 3px solid var(--primary-color);
    font-size: 13px;
}

.banner-info-message i {
    color: var(--primary-color);
    font-size: 16px;
}

.banner-slider-container {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    margin-bottom: 20px;
    padding-bottom: 10px;
}

.banner-slider-container::-webkit-scrollbar {
    height: 6px;
}

.banner-slider-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
}

.banner-slider-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
}

.banner-track {
    display: flex;
    gap: 20px;
    padding: 4px;
    min-width: min-content;
}

.banner-slide {
    width: 280px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    padding: 16px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
    transition: all 0.2s;
}

.banner-slide:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(64, 167, 227, 0.2);
}

.banner-slide-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.banner-number {
    font-weight: 600;
    color: var(--primary-color);
    background: rgba(64, 167, 227, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 13px;
}

.banner-url-input-group {
    margin-bottom: 12px;
}

.banner-url-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.banner-url-input-wrapper .input-icon {
    position: absolute;
    left: 12px;
    color: var(--tg-hint-color);
    font-size: 14px;
    z-index: 1;
}

.banner-url-input {
    width: 100%;
    padding: 10px 10px 10px 40px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--tg-text-color);
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
}

.banner-url-input:focus {
    border-color: var(--primary-color);
    background: rgba(64, 167, 227, 0.1);
}

.banner-validation-message {
    font-size: 11px;
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.banner-validation-message.info {
    color: var(--info-color);
    background: rgba(59, 130, 246, 0.1);
}

.banner-validation-message.success {
    color: var(--success-color);
    background: rgba(16, 185, 129, 0.1);
}

.banner-validation-message.error {
    color: var(--danger-color);
    background: rgba(239, 68, 68, 0.1);
}

.banner-preview-area {
    position: relative;
}

.banner-image-wrapper {
    width: 100%;
    height: 150px;
    border-radius: 8px;
    background-color: #1a1a1a;
    background-size: cover;
    background-repeat: no-repeat;
    position: relative;
    overflow: hidden;
    cursor: grab;
    transition: all 0.2s;
    border: 2px solid transparent;
}

.banner-image-wrapper.dragging-active {
    cursor: grabbing;
    border-color: var(--primary-color);
    transform: scale(1.02);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.banner-image-wrapper.no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border: 2px dashed var(--border-color);
}

.no-image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--tg-hint-color);
    text-align: center;
    padding: 20px;
}

.no-image-placeholder i {
    font-size: 24px;
    margin-bottom: 4px;
    opacity: 0.5;
}

.no-image-placeholder span {
    font-size: 10px;
    max-width: 80%;
}

.banner-image-wrapper.has-image {
    border: 2px solid var(--primary-color);
    box-shadow: 0 4px 12px rgba(64, 167, 227, 0.3);
}

.banner-position-controls {
    margin-top: 8px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
}

.banner-position-indicator {
    font-size: 10px;
    color: var(--tg-hint-color);
    text-align: center;
    margin-bottom: 4px;
}

.banner-position-hint {
    font-size: 9px;
    color: var(--tg-hint-color);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.banner-slide-actions-bottom {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
}

.btn-icon-small {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: var(--tg-hint-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.btn-icon-small:hover:not(:disabled) {
    background: var(--primary-color);
    color: white;
}

.btn-icon-small.delete:hover:not(:disabled) {
    background: var(--danger-color);
}

.btn-icon-small:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.empty-banner-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    color: var(--tg-hint-color);
    margin: 20px 0;
    border: 2px dashed var(--border-color);
}

.empty-banner-message i {
    font-size: 40px;
    margin-bottom: 10px;
    opacity: 0.5;
}

.empty-banner-message p {
    font-size: 13px;
    text-align: center;
}

/* ===== BANNER BUTTON CONTAINER ===== */
.banner-button-container {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    width: 100%;
}

.banner-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    white-space: nowrap;
}

.banner-add-btn {
    background: rgba(255, 255, 255, 0.1);
    color: var(--tg-text-color);
    border: 1px solid var(--border-color);
}

.banner-add-btn i {
    color: var(--primary-color);
}

.banner-add-btn:hover {
    background: var(--primary-color);
    color: white;
}

.banner-add-btn:hover i {
    color: white;
}

.banner-save-btn {
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white;
}

.banner-save-btn:hover {
    background: linear-gradient(135deg, var(--primary-light), var(--primary-color));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(64, 167, 227, 0.3);
}

/* ===== MODAL ===== */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: var(--tg-bg-color);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalSlideUp 0.3s ease;
}

.modal-content.upload-modal {
    max-width: 400px;
}

@keyframes modalSlideUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.2);
}

.modal-header h2 {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.modal-header h2 i {
    color: var(--primary-color);
}

.modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--tg-text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.modal-close:hover {
    background: var(--danger-color);
    border-color: var(--danger-color);
}

.modal-body {
    padding: 20px;
}

/* ===== UPLOAD MODAL ===== */
.upload-area {
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    padding: 30px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.02);
    margin-bottom: 20px;
}

.upload-area i {
    font-size: 40px;
    color: var(--primary-color);
    margin-bottom: 8px;
}

.upload-area p {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
}

.upload-area small {
    color: var(--tg-hint-color);
    font-size: 11px;
}

.upload-area:hover {
    border-color: var(--primary-color);
    background: rgba(64, 167, 227, 0.05);
}

.upload-preview {
    position: relative;
    margin-bottom: 20px;
}

.upload-preview img {
    width: 100%;
    max-height: 200px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.btn-change {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
}

.btn-change:hover {
    background: var(--primary-color);
}

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
    .tampilan-container {
        padding: 12px;
    }
    
    .tampilan-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .header-right {
        width: 100%;
    }
    
    .header-right .btn-primary {
        width: 100%;
    }
    
    .tampilan-tabs {
        flex-wrap: nowrap;
        justify-content: flex-start;
    }
    
    .form-row {
        grid-template-columns: 1fr;
    }
    
    .color-grid-2col {
        grid-template-columns: 1fr;
    }
    
    .banner-button-container {
        flex-direction: column;
    }
    
    .banner-action-btn {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .header-left {
        gap: 8px;
    }
    
    .back-btn {
        width: 40px;
        height: 40px;
    }
    
    .header-icon {
        width: 40px;
        height: 40px;
    }
    
    .header-icon i {
        font-size: 20px;
    }
    
    .header-title h1 {
        font-size: 16px;
    }
    
    .website-badge {
        font-size: 9px;
        padding: 3px 8px;
    }
    
    .card-body {
        padding: 16px;
    }
    
    .banner-slide {
        width: 260px;
    }
}

/* ===== PROMO SECTION - REVISED ===== */

/* Promo Container */
.promo-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;
}

/* Promo Card */
.promo-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.2s;
    animation: fadeIn 0.3s ease;
}

.promo-card:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(64, 167, 227, 0.2);
}

.promo-card.new-promo {
    border: 2px dashed var(--primary-color);
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% {
        border-color: var(--primary-color);
        opacity: 1;
    }
    50% {
        border-color: rgba(64, 167, 227, 0.3);
        opacity: 0.8;
    }
    100% {
        border-color: var(--primary-color);
        opacity: 1;
    }
}

/* Promo Banner */
.promo-banner-wrapper {
    position: relative;
    width: 100%;
    height: 180px;
    overflow: hidden;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border-bottom: 1px solid var(--border-color);
}

.promo-banner-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.promo-card:hover .promo-banner-wrapper img {
    transform: scale(1.05);
}

/* Promo Content */
.promo-content {
    padding: 16px;
}

.promo-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--primary-color);
}

.promo-description {
    font-size: 13px;
    color: var(--tg-hint-color);
    margin-bottom: 12px;
    line-height: 1.5;
}

.promo-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 12px;
}

.promo-expiry {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--tg-hint-color);
}

.promo-expiry i {
    color: var(--warning-color);
    font-size: 14px;
}

.promo-expiry.never {
    color: var(--success-color);
}

.promo-expiry.never i {
    color: var(--success-color);
}

.promo-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
}

.promo-status.active {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success-color);
}

.promo-status.inactive {
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger-color);
}

.promo-notes {
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.05);
    border-radius: 8px;
    font-size: 12px;
    color: var(--tg-hint-color);
    border-left: 3px solid var(--warning-color);
}

.promo-notes i {
    color: var(--warning-color);
    margin-right: 6px;
}

/* Promo Actions - Bottom Right */
.promo-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.2);
}

.promo-action-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--tg-text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.promo-action-btn.edit:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
}

.promo-action-btn.delete:hover {
    background: var(--danger-color);
    border-color: var(--danger-color);
}

/* Empty Promo Message */
.empty-promo-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    color: var(--tg-hint-color);
    margin: 10px 0 20px 0;
    border: 2px dashed var(--border-color);
    text-align: center;
}

.empty-promo-message i {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
    color: var(--primary-color);
}

.empty-promo-message p {
    font-size: 14px;
    max-width: 300px;
    margin: 0 auto;
}

/* Add Promo Button */
.btn-add-promo {
    background: rgba(64, 167, 227, 0.1);
    border: 1px solid rgba(64, 167, 227, 0.3);
    color: var(--primary-color);
    padding: 8px 16px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-add-promo:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.btn-add-promo i {
    font-size: 16px;
}

/* Promo Save Container */
.promo-save-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
}

/* Promo Banner Preview Small */
.promo-banner-preview-small {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    margin-bottom: 8px;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
}

.promo-banner-preview-small img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Modal Large */
.modal-content.modal-lg {
    max-width: 600px;
}

/* Modal Small */
.modal-content.modal-sm {
    max-width: 400px;
}

/* Delete Modal */
.modal-header.danger h2 i {
    color: var(--danger-color);
}

.delete-text {
    font-size: 15px;
    margin-bottom: 8px;
}

.delete-warning {
    color: var(--danger-color);
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 16px;
}

.delete-info {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    text-align: center;
    font-weight: 500;
}

/* Fix jarak antar form */
.form-group {
    margin-bottom: 16px;
}

.form-row {
    gap: 8px;
}

/* Modal Form spacing */
#promoForm .form-group {
    margin-bottom: 14px;
}

#promoForm .form-group:last-of-type {
    margin-bottom: 0;
}

/* Responsive */
@media (max-width: 768px) {
    .promo-banner-wrapper {
        height: 150px;
    }
    
    .promo-meta {
        flex-direction: column;
        gap: 8px;
    }
    
    .btn-add-promo {
        padding: 6px 12px;
        font-size: 12px;
    }
}

@media (max-width: 480px) {
    .promo-title {
        font-size: 16px;
    }
    
    .promo-description {
        font-size: 12px;
    }
    
    .promo-banner-preview-small {
        height: 100px;
    }
}

/* Tambahkan di akhir file tampilan.css */

/* ===== FONT & ANIMATIONS SECTION ===== */

/* Font Grid */
.font-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.font-card {
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.font-card:hover {
  transform: translateY(-4px);
  border-color: var(--primary-color);
  box-shadow: 0 8px 24px rgba(64, 167, 227, 0.2);
}

.font-card.selected {
  border-color: var(--success-color);
  background: rgba(16, 185, 129, 0.05);
}

.font-preview {
  font-size: 18px;
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  text-align: center;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
}

.font-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.font-name {
  font-weight: 600;
  font-size: 14px;
}

.font-category {
  font-size: 11px;
  color: var(--tg-hint-color);
}

.font-note {
  font-size: 10px;
  color: var(--warning-color);
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.selected-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--success-color);
  font-size: 20px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

/* Animation Live Preview */
.animation-live-preview {
  margin-bottom: 24px;
}

.preview-label {
  font-size: 13px;
  color: var(--tg-hint-color);
  margin-bottom: 8px;
}

.preview-box {
  background: linear-gradient(135deg, var(--card-bg), #252525);
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#animPreviewText {
  font-size: 24px;
  font-weight: 600;
  display: inline-block;
}

/* Animation Grid */
.animation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.animation-card {
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  text-align: center;
}

.animation-card:hover {
  transform: translateY(-4px);
  border-color: var(--primary-color);
}

.animation-card.selected {
  border-color: var(--success-color);
  background: rgba(16, 185, 129, 0.05);
}

.animation-preview {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
  padding: 12px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  display: inline-block;
  width: 100%;
  text-align: center;
}

.animation-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.animation-name {
  font-weight: 600;
  font-size: 13px;
}

.animation-desc {
  font-size: 10px;
  color: var(--tg-hint-color);
}

/* Animation Controls */
.animation-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 12px;
  color: var(--tg-hint-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-group select {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--tg-text-color);
  font-size: 13px;
  outline: none;
}

.control-group select:focus {
  border-color: var(--primary-color);
}

/* Responsive */
@media (max-width: 768px) {
  .font-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .animation-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .animation-controls {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .font-grid {
    grid-template-columns: 1fr;
  }

  .animation-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== FONT TEMPLATE STYLES ===== */
.btn-view-templates {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid var(--border-color);
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-view-templates:hover {
    background: var(--primary-gradient);
    border-color: transparent;
    transform: translateY(-2px);
}

.btn-create-template {
    background: var(--primary-gradient);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: all 0.2s;
}

.btn-create-template:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-glow);
}

/* Template Input Tabs */
.template-input-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    padding: 4px;
    background: var(--bg-card);
    border-radius: 40px;
    border: 1px solid var(--border-color);
}

.template-input-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    border-radius: 30px;
    cursor: pointer;
    transition: all 0.2s;
}

.template-input-tab.active {
    background: var(--primary-gradient);
    color: white;
}

.template-input-tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
}

.template-input-panel {
    display: none;
}

.template-input-panel.active {
    display: block;
    animation: fadeIn 0.3s ease;
}

/* Template Code Input */
.template-code-input-group {
    display: flex;
    gap: 8px;
}

.template-code-input {
    flex: 1;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 30px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: monospace;
    outline: none;
    transition: all 0.2s;
}

.template-code-input:focus {
    border-color: var(--primary-color);
    background: rgba(64, 167, 227, 0.1);
}

.template-code-verify {
    width: 50px;
    height: 50px;
    border-radius: 30px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.template-code-verify:hover {
    background: var(--primary-gradient);
    border-color: transparent;
    color: white;
}

/* Template Search */
.template-search-input-group {
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 16px;
    color: var(--text-muted);
    z-index: 1;
}

.template-search-field {
    width: 100%;
    padding: 14px 16px 14px 45px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 30px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
}

.template-search-field:focus {
    border-color: var(--primary-color);
    background: rgba(64, 167, 227, 0.1);
}

.template-search-clear {
    position: absolute;
    right: 12px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.template-search-clear:hover {
    background: var(--danger-color);
    color: white;
}

/* Search Results */
.template-search-results {
    display: none;
    margin-top: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;
}

.search-results-header {
    padding: 12px 16px;
    background: var(--bg-tertiary);
    font-size: 13px;
    font-weight: 600;
    color: var(--primary-color);
    border-bottom: 1px solid var(--border-color);
}

.search-result-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.2s;
}

.search-result-item:last-child {
    border-bottom: none;
}

.search-result-item:hover {
    background: rgba(64, 167, 227, 0.1);
}

.result-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.result-info strong {
    color: var(--text-primary);
}

.result-info small {
    color: var(--text-muted);
    font-family: monospace;
}

.result-preview {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-muted);
}

.no-results {
    padding: 30px;
    text-align: center;
    color: var(--text-muted);
}

.no-results.error {
    color: var(--danger-color);
}

/* Template Preview Card */
.template-preview-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    margin-bottom: 20px;
    overflow: hidden;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.template-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(90deg, rgba(64, 167, 227, 0.1), transparent);
    border-bottom: 1px solid var(--border-color);
}

.template-preview-header h4 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary-color);
}

.template-preview-clear {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.template-preview-clear:hover {
    background: var(--danger-color);
    color: white;
}

.template-preview-content {
    padding: 20px;
}

.template-preview-box {
    background: linear-gradient(135deg, #1a1a1a, #252525);
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    border: 1px solid var(--border-color);
}

.template-preview-text {
    font-size: 24px;
    font-weight: 700;
    color: white;
    display: block;
    margin-bottom: 16px;
    transition: all 0.2s;
}

.template-preview-info {
    display: flex;
    justify-content: center;
    gap: 24px;
    font-size: 13px;
    color: var(--text-muted);
}

.template-preview-info span {
    display: flex;
    align-items: center;
    gap: 6px;
}

.template-preview-info i {
    color: var(--primary-color);
}

/* Selected Template Info */
.selected-template-info {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 16px;
    padding: 16px 20px;
    margin: 20px 0;
}

.selected-template-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--success-color);
}

.selected-template-badge i {
    font-size: 20px;
}

.selected-template-badge span {
    flex: 1;
    font-size: 14px;
}

.selected-template-badge strong {
    color: white;
    margin-left: 4px;
}

.btn-change-template {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--border-color);
    color: white;
    padding: 8px 16px;
    border-radius: 30px;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}

.btn-change-template:hover {
    background: var(--warning-color);
    border-color: transparent;
}

/* Template Quick Actions */
.template-quick-actions {
    display: flex;
    gap: 12px;
    margin: 20px 0;
}

.template-quick-actions .btn-secondary {
    flex: 1;
    padding: 14px;
}

.template-quick-actions .btn-secondary:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* Validation Message */
.validation-message {
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.validation-message.info {
    background: rgba(59, 130, 246, 0.1);
    color: var(--info-color);
    border-left: 3px solid var(--info-color);
}

.validation-message.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
    border-left: 3px solid var(--success-color);
}

.validation-message.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
    border-left: 3px solid var(--danger-color);
}

/* All Templates Modal */
.modal-search-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
}

.modal-search-bar .search-input-wrapper {
    flex: 1;
    position: relative;
}

.modal-search-bar .search-input-wrapper i {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
}

.modal-search-bar input {
    width: 100%;
    padding: 14px 16px 14px 45px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 30px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
}

.modal-search-bar .template-filter {
    min-width: 120px;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 30px;
    color: var(--text-primary);
    cursor: pointer;
}

.templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    max-height: 500px;
    overflow-y: auto;
    padding: 4px;
}

.template-loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px;
    color: var(--text-muted);
}

.template-loading i {
    font-size: 32px;
    margin-bottom: 16px;
    color: var(--primary-color);
}

.template-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.2s;
}

.template-card:hover {
    transform: translateY(-4px);
    border-color: var(--primary-color);
    box-shadow: var(--shadow-md);
}

.template-preview {
    height: 100px;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    display: flex;
    align-items: center;
    justify-content: center;
}

.template-preview-text {
    font-size: 32px;
    font-weight: 700;
    color: white;
    opacity: 0.7;
}

.template-info {
    padding: 16px;
    border-top: 1px solid var(--border-color);
}

.template-name {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.template-badge {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 20px;
    background: var(--primary-color);
    color: white;
    margin-left: auto;
}

.template-badge.public {
    background: var(--info-color);
}

.template-badge.private {
    background: var(--warning-color);
    color: black;
}

.template-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--text-muted);
}

.template-meta span {
    display: flex;
    align-items: center;
    gap: 6px;
}

.template-code-small {
    background: var(--bg-primary);
    padding: 8px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 11px;
    margin: 12px 0;
    border: 1px solid var(--border-color);
    color: var(--primary-color);
}

.template-actions .template-btn.select {
    width: 100%;
    padding: 10px;
    background: var(--primary-gradient);
    border: none;
    border-radius: 30px;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s;
}

.template-actions .template-btn.select:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-glow);
}

@media (max-width: 768px) {
    .modal-search-bar {
        flex-direction: column;
    }
    
    .templates-grid {
        grid-template-columns: 1fr;
    }
    
    .template-quick-actions {
        flex-direction: column;
    }
}
// ===== WEBSITE CREATE JS =====
// DETECT ENVIRONMENT - TAMBAHKAN INI DI PALING ATAS
const isFlask = !window.location.hostname.includes('github.io') && 
                !window.location.hostname.includes('127.0.0.1') && 
                window.location.port !== '';
const BASE_URL = isFlask ? '' : 'https://aldiprem.github.io/wtb';

console.log('Website Create JS running in', isFlask ? 'Flask' : 'GitHub Pages', 'mode');

// State management
let formState = {
    currentStep: 1,
    isSubmitting: false,
    formData: {}
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Website Create JS initialized');
    
    initializeForm();
    setupFormValidation();
    setupEventListeners();
    loadSavedData();
});

// ===== FORM INITIALIZATION =====
function initializeForm() {
    const form = document.getElementById('createWebsiteForm');
    if (!form) return;
    
    // Add step indicators
    addStepIndicators();
    
    // Set default values
    setDefaultValues();
}

function addStepIndicators() {
    const form = document.getElementById('createWebsiteForm');
    if (!form) return;
    
    // Cek apakah sudah ada step indicators
    if (form.querySelector('.progress-steps')) return;
    
    const steps = [
        { label: 'Informasi Dasar', icon: 'fa-info-circle' },
        { label: 'Kontak', icon: 'fa-address-book' },
        { label: 'Bot Telegram', icon: 'fa-telegram' },
        { label: 'SEO', icon: 'fa-search' }
    ];
    
    const stepsHTML = `
        <div class="progress-steps" style="display: flex; justify-content: space-between; margin-bottom: 2rem; padding: 0 1rem;">
            ${steps.map((step, index) => `
                <div class="step ${index === 0 ? 'active' : ''}" data-step="${index + 1}" style="display: flex; flex-direction: column; align-items: center; position: relative; flex: 1;">
                    <div class="step-number" style="width: 40px; height: 40px; border-radius: 50%; background: ${index === 0 ? 'var(--primary)' : 'white'}; border: 2px solid ${index === 0 ? 'var(--primary)' : '#e5e7eb'}; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-bottom: 0.5rem; z-index: 2; color: ${index === 0 ? 'white' : 'var(--gray)'};">${index + 1}</div>
                    <div class="step-label" style="font-size: 0.8rem; color: ${index === 0 ? 'var(--primary)' : 'var(--gray)'}; text-align: center;">
                        <i class="fas ${step.icon}"></i>
                        ${step.label}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    form.insertAdjacentHTML('afterbegin', stepsHTML);
}

function setDefaultValues() {
    // Set default values for fields
    const currencySelect = document.querySelector('select[name="currency"]');
    if (currencySelect) {
        currencySelect.value = 'IDR';
    }
    
    const themeColor = document.querySelector('input[name="theme_color"]');
    if (themeColor) {
        themeColor.value = '#4f46e5';
    }
}

function loadSavedData() {
    // Load saved form data from localStorage
    const savedData = localStorage.getItem('websiteCreateForm');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            formState.formData = data;
            
            // Populate form fields
            Object.keys(data).forEach(key => {
                const field = document.querySelector(`[name="${key}"]`);
                if (field && field.type !== 'color') { // Skip color input
                    field.value = data[key];
                }
            });
            
            showNotification('Data form berhasil dimuat', 'info');
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
}

// ===== FORM VALIDATION =====
function setupFormValidation() {
    const form = document.getElementById('createWebsiteForm');
    if (!form) return;
    
    // Validate on input
    form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', () => validateField(field));
        field.addEventListener('blur', () => validateField(field));
    });
}

function validateField(field) {
    const value = field.value.trim();
    const name = field.name;
    const parent = field.parentElement;
    
    // Remove existing error
    const existingError = parent.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    field.classList.remove('error');
    
    // Skip validation for non-required empty fields
    if (!field.required && value === '') {
        return true;
    }
    
    // Validation rules
    let isValid = true;
    let errorMessage = '';
    
    switch(name) {
        case 'name':
            if (field.required && !value) {
                isValid = false;
                errorMessage = 'Nama website wajib diisi';
            } else if (value && value.length < 3) {
                isValid = false;
                errorMessage = 'Nama website minimal 3 karakter';
            } else if (value && value.length > 100) {
                isValid = false;
                errorMessage = 'Nama website maksimal 100 karakter';
            }
            break;
            
        case 'email':
            if (value && !isValidEmail(value)) {
                isValid = false;
                errorMessage = 'Format email tidak valid';
            }
            break;
            
        case 'whatsapp_number':
            if (value && !isValidPhone(value)) {
                isValid = false;
                errorMessage = 'Format nomor WhatsApp tidak valid';
            }
            break;
            
        case 'telegram_bot_token':
            if (value && value.length < 40) {
                isValid = false;
                errorMessage = 'Token bot tidak valid (minimal 40 karakter)';
            }
            break;
            
        case 'telegram_bot_username':
            if (value && !value.startsWith('@')) {
                isValid = false;
                errorMessage = 'Username bot harus diawali dengan @';
            }
            break;
    }
    
    if (!isValid) {
        field.classList.add('error');
        const error = document.createElement('div');
        error.className = 'error-message';
        error.style.cssText = 'color: var(--danger); font-size: 0.8rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem;';
        error.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
        parent.appendChild(error);
    }
    
    return isValid;
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPhone(phone) {
    const re = /^[0-9+\-\s]{10,15}$/;
    return re.test(phone.replace(/\s/g, ''));
}

function validateForm() {
    const form = document.getElementById('createWebsiteForm');
    const fields = form.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// ===== FORM SUBMISSION =====
async function submitForm(formData) {
    if (formState.isSubmitting) return;
    
    // Validate form
    if (!validateForm()) {
        showNotification('Mohon periksa kembali form Anda', 'warning');
        
        // Scroll to first error
        const firstError = document.querySelector('.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    formState.isSubmitting = true;
    
    // Show loading
    const loader = document.querySelector('.global-loader');
    if (loader) loader.style.display = 'flex';
    
    // Disable submit button
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }
    
    try {
        // PERBAIKAN: Gunakan path yang benar
        const url = isFlask ? '/owner/websites/create' : `${BASE_URL}/owner/websites/create`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Clear saved form data
            localStorage.removeItem('websiteCreateForm');
            
            // Show success message
            await showSuccessMessage('Website berhasil dibuat!');
            
            // Redirect
            setTimeout(() => {
                window.location.href = result.redirect;
            }, 1500);
        } else {
            showNotification(result.message || 'Gagal membuat website', 'danger');
            
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-loading');
                submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Website';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error: ' + error.message, 'danger');
        
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-loading');
            submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Website';
        }
    } finally {
        formState.isSubmitting = false;
        if (loader) loader.style.display = 'none';
    }
}

async function showSuccessMessage(message) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center; background: white; border-radius: 16px;">
                <div class="modal-body" style="padding: 2rem;">
                    <div class="success-checkmark" style="width: 80px; height: 80px; margin: 0 auto 1.5rem;">
                        <div class="check-icon" style="width: 80px; height: 80px; position: relative; border-radius: 50%; border: 4px solid var(--success);">
                            <span class="icon-line line-tip" style="position: absolute; height: 5px; background-color: var(--success); border-radius: 2px; top: 46px; left: 14px; width: 25px; transform: rotate(45deg); animation: icon-line-tip 0.75s;"></span>
                            <span class="icon-line line-long" style="position: absolute; height: 5px; background-color: var(--success); border-radius: 2px; top: 38px; right: 8px; width: 47px; transform: rotate(-45deg); animation: icon-line-long 0.75s;"></span>
                        </div>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: var(--success);">Sukses!</h3>
                    <p style="color: var(--gray); margin-bottom: 1.5rem;">${message}</p>
                    <div class="loading-spinner" style="width: 30px; height: 30px; margin: 0 auto; border: 3px solid #f3f4f6; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="color: var(--gray); font-size: 0.9rem; margin-top: 1rem;">Mengalihkan...</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.remove();
            resolve();
        }, 1500);
    });
}

// ===== AUTO-SAVE =====
function autoSaveForm() {
    const form = document.getElementById('createWebsiteForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Save to localStorage
    localStorage.setItem('websiteCreateForm', JSON.stringify(data));
    
    // Update last saved indicator
    let indicator = document.querySelector('.auto-save-indicator');
    if (!indicator) {
        indicator = createAutoSaveIndicator();
    }
    indicator.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Tersimpan otomatis ${new Date().toLocaleTimeString()}`;
    
    // Hide indicator after 3 seconds
    clearTimeout(window.autoSaveTimeout);
    window.autoSaveTimeout = setTimeout(() => {
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator) indicator.remove();
            }, 300);
        }
    }, 3000);
}

function createAutoSaveIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'auto-save-indicator';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 0.5rem 1rem;
        border-radius: 50px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        font-size: 0.8rem;
        color: var(--gray);
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid rgba(0,0,0,0.05);
        transition: opacity 0.3s;
    `;
    document.body.appendChild(indicator);
    return indicator;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    const form = document.getElementById('createWebsiteForm');
    if (!form) return;
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        await submitForm(data);
    });
    
    // Auto-save on input
    let saveTimeout;
    form.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(autoSaveForm, 2000);
    });
    
    // Preview button (optional)
    const actionsDiv = document.querySelector('.form-actions');
    if (actionsDiv && !document.querySelector('.preview-btn')) {
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'btn btn-secondary preview-btn';
        previewBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
        previewBtn.style.marginRight = 'auto';
        
        actionsDiv.insertBefore(previewBtn, actionsDiv.firstChild);
        
        previewBtn.addEventListener('click', () => {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Store data in sessionStorage for preview
            sessionStorage.setItem('previewData', JSON.stringify(data));
            
            // Open preview in new window
            const previewUrl = isFlask ? '/owner/websites/preview' : `${BASE_URL}/owner/websites/preview`;
            window.open(previewUrl, '_blank');
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
}

// ===== NOTIFICATION =====
function showNotification(message, type = 'info') {
    // Cek apakah notifikasi dengan pesan sama sudah ada
    const existingNotifs = document.querySelectorAll('.alert');
    for (let notif of existingNotifs) {
        if (notif.querySelector('span')?.textContent === message) {
            return;
        }
    }
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 8px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    let bgColor, textColor, icon;
    switch(type) {
        case 'success':
            bgColor = '#d1fae5';
            textColor = '#059669';
            icon = 'check-circle';
            break;
        case 'danger':
            bgColor = '#fee2e2';
            textColor = '#dc2626';
            icon = 'exclamation-circle';
            break;
        case 'warning':
            bgColor = '#fef3c7';
            textColor = '#d97706';
            icon = 'exclamation-triangle';
            break;
        default:
            bgColor = '#dbeafe';
            textColor = '#2563eb';
            icon = 'info-circle';
    }
    
    notification.style.backgroundColor = bgColor;
    notification.style.color = textColor;
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button style="margin-left: auto; background: none; border: none; color: ${textColor}; cursor: pointer; font-size: 1.2rem;" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== UTILITY FUNCTIONS =====
function formatCurrency(value) {
    if (value === undefined || value === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value);
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
}

// Add keyframe animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes icon-line-tip {
        0% { width: 0; left: 1px; top: 19px; }
        54% { width: 0; left: 1px; top: 19px; }
        70% { width: 50px; left: -8px; top: 37px; }
        84% { width: 17px; left: 21px; top: 48px; }
        100% { width: 25px; left: 14px; top: 45px; }
    }
    @keyframes icon-line-long {
        0% { width: 0; right: 46px; top: 54px; }
        65% { width: 0; right: 46px; top: 54px; }
        84% { width: 55px; right: 0px; top: 35px; }
        100% { width: 47px; right: 8px; top: 38px; }
    }
`;
document.head.appendChild(style);

// Export functions for use in HTML
window.submitForm = submitForm;
window.validateForm = validateForm;
window.showNotification = showNotification;
window.formatCurrency = formatCurrency;

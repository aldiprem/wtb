// ===== WEBSITE CREATE JS =====

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
    
    const steps = [
        { label: 'Informasi Dasar', icon: 'fa-info-circle' },
        { label: 'Kontak', icon: 'fa-address-book' },
        { label: 'Bot Telegram', icon: 'fa-telegram' },
        { label: 'SEO', icon: 'fa-search' }
    ];
    
    const stepsHTML = `
        <div class="progress-steps">
            ${steps.map((step, index) => `
                <div class="step ${index === 0 ? 'active' : ''}" data-step="${index + 1}">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-label">
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
                if (field) {
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
    const errorElement = field.parentElement.querySelector('.error-message');
    
    // Remove existing error
    if (errorElement) {
        errorElement.remove();
    }
    field.classList.remove('error');
    
    // Validation rules
    let isValid = true;
    let errorMessage = '';
    
    switch(name) {
        case 'name':
            if (!value) {
                isValid = false;
                errorMessage = 'Nama website wajib diisi';
            } else if (value.length < 3) {
                isValid = false;
                errorMessage = 'Nama website minimal 3 karakter';
            } else if (value.length > 100) {
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
        error.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
        field.parentElement.appendChild(error);
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
        const response = await fetch('/owner/websites/create', {
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
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div class="modal-body" style="padding: 2rem;">
                    <div class="success-checkmark">
                        <div class="check-icon">
                            <span class="icon-line line-tip"></span>
                            <span class="icon-line line-long"></span>
                        </div>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: var(--success);">Sukses!</h3>
                    <p style="color: var(--gray); margin-bottom: 1.5rem;">${message}</p>
                    <div class="loading-spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div>
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
    const indicator = document.querySelector('.auto-save-indicator') || createAutoSaveIndicator();
    indicator.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Tersimpan otomatis ${new Date().toLocaleTimeString()}`;
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
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn btn-secondary';
    previewBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
    previewBtn.style.marginRight = 'auto';
    
    const actionsDiv = document.querySelector('.form-actions');
    if (actionsDiv) {
        actionsDiv.insertBefore(previewBtn, actionsDiv.firstChild);
        
        previewBtn.addEventListener('click', () => {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Store data in sessionStorage for preview
            sessionStorage.setItem('previewData', JSON.stringify(data));
            
            // Open preview in new window
            window.open('/owner/websites/preview', '_blank');
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
        <button style="margin-left: auto; background: none; border: none; color: ${textColor}; cursor: pointer;" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== UTILITY FUNCTIONS =====
function formatCurrency(value) {
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

// Export functions for use in HTML
window.submitForm = submitForm;
window.validateForm = validateForm;
window.showNotification = showNotification;

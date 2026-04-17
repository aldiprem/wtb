// ==================== CONFIGURATION ====================
const CONFIG = {
    TUNNEL_URL: 'https://companel.shop',
    API_BASE: '/winedash',
    NETWORK: 'mainnet',
    MIN_DEPOSIT: 0.1,
    DEBUG: true
};

// ==================== GLOBAL VARIABLES ====================
let tonConnectUI = null;
let telegramUser = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    debugLog('🚀 Winedash starting...');
    
    try {
        initTelegram();
        initTonConnect();
        await loadDepositInfo();
    } catch (error) {
        debugLog('❌ Initialization error:', error);
    }
});

// ==================== TELEGRAM FUNCTIONS ====================
function initTelegram() {
    try {
        if (!window.Telegram?.WebApp) {
            throw new Error('Telegram Web App not available');
        }

        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        telegramUser = tg.initDataUnsafe?.user;
        
        if (telegramUser) {
            updateTelegramStatus('connected');
            displayTelegramProfile(telegramUser);
            authenticateUser(telegramUser);
            loadUserData();
            debugLog('✅ Telegram user loaded:', telegramUser);
        } else {
            updateTelegramStatus('disconnected');
            document.getElementById('telegram-profile').innerHTML = `
                <div class="error-message">
                    ⚠️ Please open in Telegram Web App
                </div>
            `;
        }
    } catch (error) {
        debugLog('❌ Telegram init error:', error);
        updateTelegramStatus('disconnected');
    }
}

function updateTelegramStatus(status) {
    const badge = document.getElementById('telegram-status');
    if (!badge) return;
    
    badge.className = 'status-badge ' + status;
    badge.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
}

function displayTelegramProfile(user) {
    const container = document.getElementById('telegram-profile');
    if (!container) return;

    const photoUrl = user.photo_url || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name || ''}&size=100&background=8B5CF6&color=fff&bold=true`;

    container.innerHTML = `
        <div class="user-info">
            <img src="${photoUrl}" 
                 alt="Profile" 
                 class="user-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name || ''}&size=100&background=8B5CF6&color=fff&bold=true'">
            <div class="user-details">
                <p><strong>Name:</strong> ${user.first_name} ${user.last_name || ''}</p>
                <p><strong>Username:</strong> ${user.username ? '@' + user.username : '-'}</p>
                <p><strong>ID:</strong> ${user.id}</p>
            </div>
        </div>
    `;
}

async function authenticateUser(user) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: user.id.toString(),
                telegram_username: user.username,
                telegram_first_name: user.first_name,
                telegram_last_name: user.last_name,
                telegram_photo_url: user.photo_url
            })
        });

        const data = await response.json();
        debugLog('✅ User authenticated:', data);
    } catch (error) {
        debugLog('❌ Auth error:', error);
    }
}

// ==================== TON CONNECT FUNCTIONS ====================
function initTonConnect() {
    try {
        const manifestUrl = `${CONFIG.TUNNEL_URL}${CONFIG.API_BASE}/tonconnect-manifest.json`;
        
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: manifestUrl,
            buttonRootId: 'ton-connect',
            language: 'en'
        });

        debugLog('✅ TON Connect initialized');

        tonConnectUI.onStatusChange(async (wallet) => {
            debugLog('📱 Wallet status changed:', wallet);
            
            if (wallet && telegramUser) {
                updateWalletStatus('connected');
                displayWalletInfo(wallet);
                await updateUserWallet(telegramUser.id, wallet.account.address);
            } else {
                updateWalletStatus('disconnected');
                document.getElementById('wallet-info')?.classList.add('hidden');
            }
        });

    } catch (error) {
        debugLog('❌ TON Connect init error:', error);
        updateWalletStatus('disconnected');
    }
}

function updateWalletStatus(status) {
    const badge = document.getElementById('wallet-status');
    if (!badge) return;
    
    badge.className = 'status-badge ' + status;
    badge.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
}

function displayWalletInfo(wallet) {
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    
    if (!walletInfo || !walletAddress) return;

    const address = wallet.account.address;
    
    walletAddress.setAttribute('data-full-address', address);
    walletAddress.textContent = formatAddress(address);
    walletInfo.classList.remove('hidden');
    
    loadWalletBalance(address);
}

function formatAddress(address) {
    if (!address) return 'Not connected';
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function loadWalletBalance(address) {
    try {
        const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await response.json();
        
        if (data.ok) {
            const balanceNano = parseInt(data.result);
            const balanceTon = balanceNano / 1_000_000_000;
            document.getElementById('wallet-balance').textContent = `${balanceTon.toFixed(2)} TON`;
        }
    } catch (error) {
        debugLog('❌ Error loading wallet balance:', error);
    }
}

async function updateUserWallet(telegramId, walletAddress) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/user/wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramId.toString(),
                wallet_address: walletAddress
            })
        });

        const data = await response.json();
        debugLog('✅ Wallet updated:', data);
    } catch (error) {
        debugLog('❌ Error updating wallet:', error);
    }
}

// ==================== USER DATA FUNCTIONS ====================
async function loadUserData() {
    if (!telegramUser) return;
    
    await Promise.all([
        loadUserBalance(),
        loadUserStats(),
        loadTransactionHistory()
    ]);
}

async function loadUserBalance() {
    if (!telegramUser) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE}/balance/${telegramUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            const balanceElement = document.getElementById('user-balance');
            if (balanceElement) {
                balanceElement.textContent = data.formatted;
            }
        }
    } catch (error) {
        debugLog('❌ Error loading balance:', error);
    }
}

async function loadUserStats() {
    if (!telegramUser) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE}/stats/${telegramUser.id}`);
        const data = await response.json();
        
        if (data.success && data.stats) {
            document.getElementById('total-deposited').textContent = data.stats.total_deposited?.toFixed(2) || '0';
            document.getElementById('total-withdrawn').textContent = data.stats.total_withdrawn?.toFixed(2) || '0';
            document.getElementById('deposit-count').textContent = data.stats.deposit_count || '0';
            document.getElementById('withdraw-count').textContent = data.stats.withdraw_count || '0';
        }
    } catch (error) {
        debugLog('❌ Error loading stats:', error);
    }
}

async function loadTransactionHistory() {
    if (!telegramUser) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE}/transactions/${telegramUser.id}?limit=20`);
        const data = await response.json();
        
        if (data.success) {
            displayTransactions(data.transactions);
        }
    } catch (error) {
        debugLog('❌ Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    if (!transactions?.length) {
        container.innerHTML = '<div class="loading-spinner">No transactions yet</div>';
        return;
    }

    let html = '<ul class="transactions-list">';
    transactions.forEach(tx => {
        const date = new Date(tx.created_at).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const amountClass = tx.amount_ton > 0 ? 'positive' : 'negative';
        const amountPrefix = tx.amount_ton > 0 ? '+' : '';
        
        html += `
            <li class="transaction-item ${tx.transaction_type}">
                <div>
                    <div class="tx-date">${date}</div>
                    <div class="tx-amount ${amountClass}">${amountPrefix}${tx.amount_ton} TON</div>
                    ${tx.memo ? `<small class="tx-memo">${tx.memo.substring(0, 30)}</small>` : ''}
                </div>
                <div class="tx-status ${tx.status}">${tx.status}</div>
            </li>
        `;
    });
    html += '</ul>';
    
    container.innerHTML = html;
}

// ==================== DEPOSIT FUNCTIONS ====================
async function loadDepositInfo() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/deposit/info`);
        const data = await response.json();
        
        if (data.success) {
            debugLog('✅ Deposit info loaded:', data);
        }
    } catch (error) {
        debugLog('❌ Error loading deposit info:', error);
    }
}

function showDepositModal() {
    if (!tonConnectUI?.connected) {
        showError('Please connect your wallet first');
        tonConnectUI.connect();
        return;
    }
    
    const modal = document.getElementById('deposit-modal');
    if (!modal) return;
    
    document.getElementById('deposit-form').classList.remove('hidden');
    document.getElementById('deposit-instructions').classList.add('hidden');
    document.getElementById('deposit-amount').value = '1.0';
    document.getElementById('deposit-status').classList.add('hidden');
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('deposit-modal').style.display = 'none';
}

async function processDeposit() {
    if (!tonConnectUI?.connected) {
        await tonConnectUI.connect();
        return;
    }

    if (!telegramUser) {
        showError('Please login first');
        return;
    }

    const amount = parseFloat(document.getElementById('deposit-amount').value);

    if (amount < CONFIG.MIN_DEPOSIT) {
        showError(`Minimum deposit is ${CONFIG.MIN_DEPOSIT} TON`);
        return;
    }

    const sendBtn = document.getElementById('send-deposit-btn');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>⏳</span> Processing...';

    try {
        const senderAddress = tonConnectUI.account?.address;
        
        debugLog('📤 Processing deposit:', { amount, senderAddress });
        
        // Create deposit payload
        const payloadResponse = await fetch(`${CONFIG.API_BASE}/deposit/create-payload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramUser.id.toString(),
                amount_ton: amount
            })
        });
        
        const payloadData = await payloadResponse.json();
        
        if (!payloadData.success) {
            throw new Error(payloadData.error || 'Failed to create deposit');
        }
        
        debugLog('✅ Payload created:', payloadData);
        
        // Send transaction
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600,
            messages: [
                {
                    address: payloadData.transaction.address,
                    amount: payloadData.transaction.amount,
                    payload: payloadData.transaction.payload
                }
            ]
        };
        
        const result = await tonConnectUI.sendTransaction(transaction);
        debugLog('✅ Transaction sent:', result);
        
        // Verify deposit
        const verifyResponse = await fetch(`${CONFIG.API_BASE}/deposit/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramUser.id.toString(),
                transaction_hash: result.boc,
                amount_ton: amount,
                from_address: senderAddress,
                reference: payloadData.reference,
                memo: payloadData.memo_plain
            })
        });
        
        const verifyData = await verifyResponse.json();
        debugLog('✅ Deposit verified:', verifyData);
        
        if (verifyData.success) {
            showTransactionSuccess(result.boc, payloadData.reference);
            setTimeout(() => {
                loadUserBalance();
                loadUserStats();
                loadTransactionHistory();
            }, 3000);
        } else {
            throw new Error(verifyData.error || 'Verification failed');
        }
        
    } catch (error) {
        debugLog('❌ Deposit error:', error);
        showError(error.message || 'Deposit failed');
        
        const statusEl = document.getElementById('deposit-status');
        if (statusEl) {
            statusEl.className = 'status-message error';
            statusEl.textContent = error.message || 'Deposit failed. Please try again.';
            statusEl.classList.remove('hidden');
        }
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
}

function showTransactionSuccess(txHash, reference) {
    document.getElementById('deposit-form').classList.add('hidden');
    document.getElementById('deposit-instructions').classList.remove('hidden');
    document.getElementById('tx-hash').textContent = txHash.slice(0, 40) + '...';
    document.getElementById('tx-reference').textContent = reference;
}

function showTransactionSuccess(txHash, reference) {
    document.getElementById('deposit-form').classList.add('hidden');
    document.getElementById('deposit-instructions').classList.remove('hidden');
    document.getElementById('tx-hash').textContent = txHash.slice(0, 40) + '...';
    document.getElementById('tx-reference').textContent = reference;
}

// ==================== UTILITY FUNCTIONS ====================
function refreshBalance() {
    loadUserBalance();
    if (tonConnectUI?.account) {
        loadWalletBalance(tonConnectUI.account.address);
    }
}

function refreshTransactions() {
    loadTransactionHistory();
}

function copyWalletAddress() {
    const fullAddress = document.querySelector('[data-full-address]')?.getAttribute('data-full-address');
    if (fullAddress) {
        navigator.clipboard.writeText(fullAddress);
        showToast('Address copied!');
    }
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'status-message error';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '2000';
    toast.style.minWidth = '200px';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'status-message success';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '2000';
    toast.style.minWidth = '200px';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

function debugLog(message, data = null) {
    if (!CONFIG.DEBUG) return;
    
    const debugElement = document.getElementById('debug-info');
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (data) {
        try {
            logMessage += `\n${JSON.stringify(data, null, 2)}`;
        } catch (e) {
            logMessage += `\n[Unstringifiable Data]`;
        }
    }
    
    if (debugElement) {
        debugElement.textContent = logMessage + '\n\n' + debugElement.textContent;
    }
    
    console.log(logMessage, data || '');
}

function toggleDebug() {
    const content = document.getElementById('debug-info');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (content && toggleIcon) {
        content.classList.toggle('hidden');
        toggleIcon.textContent = content.classList.contains('hidden') ? '▶' : '▼';
    }
}

// Make functions global for HTML onclick
window.showDepositModal = showDepositModal;
window.closeModal = closeModal;
window.processDeposit = processDeposit;
window.refreshBalance = refreshBalance;
window.refreshTransactions = refreshTransactions;
window.copyWalletAddress = copyWalletAddress;
window.toggleDebug = toggleDebug;
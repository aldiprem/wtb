// games/js/games.js - VERSION FIXED

document.addEventListener("DOMContentLoaded", () => {
    
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#0f0f0f');

    const initDataUnsafe = tg.initDataUnsafe || {};
    const user = initDataUnsafe.user;
    let currentUser = user;
    let tonConnectUI = null;
    let isWalletConnected = false;
    let webAddress = 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra';

    // ==================== TELEGRAM USER ====================
    async function loadUserBalance(telegramId, username, firstName) {
        try {
            const response = await fetch('/api/games/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    username: username,
                    first_name: firstName
                })
            });
            
            const data = await response.json();
            const balanceEl = document.getElementById('userBalance');
            if (data.success && balanceEl) {
                // Tampilkan balance dalam TON dengan 2 desimal
                balanceEl.textContent = data.balance.toFixed(2) + ' TON';
                return data.balance;
            } else if (balanceEl) {
                balanceEl.textContent = "0 TON";
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = "0 TON";
        }
        return 0;
    }

    function redirectToPage(url) {
        if (url && url !== '') {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
            setTimeout(() => {
                window.location.href = url;
            }, 50);
            return true;
        }
        return false;
    }

    // ==================== UPDATE HEADER DEPOSIT BUTTON ====================
    function updateHeaderDepositButton() {
        const headerBtn = document.getElementById('headerDepositBtn');
        if (!headerBtn) return;
        
        // Clear existing content
        headerBtn.innerHTML = '';
        
        if (isWalletConnected && tonConnectUI && tonConnectUI.account) {
            // Wallet connected - tampilkan tombol deposit (hijau) dengan icon plus
            headerBtn.innerHTML = '<i class="fas fa-plus"></i>';
            headerBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            headerBtn.style.width = '28px';
            headerBtn.style.height = '28px';
            headerBtn.style.padding = '0';
            headerBtn.style.borderRadius = '50%';
            headerBtn.style.gap = '0';
            headerBtn.title = 'Deposit TON';
        } else {
            // Wallet not connected - tampilkan tombol connect wallet (biru)
            headerBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
            headerBtn.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            headerBtn.style.width = 'auto';
            headerBtn.style.height = 'auto';
            headerBtn.style.padding = '6px 12px';
            headerBtn.style.borderRadius = '20px';
            headerBtn.style.gap = '6px';
            headerBtn.title = 'Connect Wallet';
        }
    }

    // ==================== TON CONNECT ====================
    function initTonConnect() {
        if (!window.TON_CONNECT_UI) {
            console.log('Waiting for TON Connect...');
            setTimeout(initTonConnect, 500);
            return;
        }
        
        const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
        
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: manifestUrl,
            buttonRootId: 'depositTonConnect',
            language: 'en'
        });

        tonConnectUI.onStatusChange(async (wallet) => {
            console.log('Wallet status changed:', wallet);
            
            const walletStatus = document.getElementById('depositWalletStatus');
            const depositForm = document.getElementById('depositForm');
            const disconnectContainer = document.getElementById('disconnectContainer');
            
            if (wallet && currentUser) {
                isWalletConnected = true;
                updateHeaderDepositButton();
                
                // Update wallet address - jangan block jika gagal
                try {
                    await updateUserWallet(currentUser.id, wallet.account.address);
                } catch (err) {
                    console.warn('Wallet update failed but continuing:', err);
                }
                
                // Update modal UI
                if (walletStatus) walletStatus.style.display = 'none';
                if (depositForm) {
                    depositForm.style.display = 'block';
                    const depositAddress = document.getElementById('depositAddress');
                    if (depositAddress) depositAddress.textContent = webAddress;
                }
                if (disconnectContainer) disconnectContainer.style.display = 'block';
                
                // Setup disconnect button
                const disconnectBtn = document.getElementById('disconnectWalletBtn');
                if (disconnectBtn) {
                    // Remove old listener to avoid duplicate
                    const newBtn = disconnectBtn.cloneNode(true);
                    disconnectBtn.parentNode.replaceChild(newBtn, disconnectBtn);
                    newBtn.addEventListener('click', disconnectWallet);
                }
            } else {
                isWalletConnected = false;
                updateHeaderDepositButton();
                
                if (walletStatus) walletStatus.style.display = 'block';
                if (depositForm) depositForm.style.display = 'none';
                if (disconnectContainer) disconnectContainer.style.display = 'none';
            }
        });
    }

    async function updateUserWallet(telegramId, walletAddress) {
        try {
            // Gunakan endpoint yang benar di games_service.py
            const response = await fetch('/api/games/user/wallet', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    telegram_id: telegramId.toString(),
                    wallet_address: walletAddress
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Wallet updated:', data);
            } else {
                console.error('❌ Wallet update failed:', response.status);
            }
        } catch (error) {
            console.error('Error updating wallet:', error);
        }
    }


    function base64EncodeComment(comment) {
        try {
            if (comment.length > 120) {
                comment = comment.substring(0, 120);
            }
            const encoder = new TextEncoder();
            const commentBytes = encoder.encode(comment);
            const prefix = new Uint8Array([0, 0, 0, 0]);
            const fullBytes = new Uint8Array(prefix.length + commentBytes.length);
            fullBytes.set(prefix);
            fullBytes.set(commentBytes, prefix.length);
            let binary = '';
            for (let i = 0; i < fullBytes.length; i++) {
                binary += String.fromCharCode(fullBytes[i]);
            }
            return btoa(binary);
        } catch (e) {
            console.error('Error encoding comment:', e);
            return undefined;
        }
    }

    async function processDepositTON() {
        if (!tonConnectUI || !tonConnectUI.connected) {
            await tonConnectUI.openModal();
            return;
        }

        const amount = parseFloat(document.getElementById('tonAmount').value);
        
        if (isNaN(amount) || amount < 0.1) {
            alert('Minimum deposit 0.1 TON');
            return;
        }

        if (!currentUser || !currentUser.id) {
            alert('User tidak ditemukan');
            return;
        }

        const sendBtn = document.getElementById('sendDepositBtn');
        const originalBtnText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const senderAddress = tonConnectUI.account?.address;
            const memo = `deposit:${currentUser.id}:${Date.now()}`;
            const amountNano = Math.floor(amount * 1_000_000_000).toString();

            // Format standar TON untuk comment text cukup di encode ke base64
            const encoder = new TextEncoder();
            const memoBytes = encoder.encode(memo);
            
            // Konversi ke base64
            let binary = '';
            for (let i = 0; i < memoBytes.length; i++) {
                binary += String.fromCharCode(memoBytes[i]);
            }
            const payloadBase64 = btoa(binary);

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: webAddress,
                    amount: amountNano
                }]
            };

            console.log('📤 Sending TON deposit:', transaction);
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('✅ Transaction sent:', result);

            // Verifikasi deposit ke backend games
            const verifyResponse = await fetch('/api/games/verify-ton-deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: currentUser.id.toString(),
                    transaction_hash: result.boc,
                    amount_ton: amount,
                    from_address: senderAddress,
                    memo: memo
                })
            });

            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
                // Tampilkan instruksi sukses
                document.getElementById('depositForm').style.display = 'none';
                document.getElementById('depositInstructions').style.display = 'block';
                document.getElementById('depositTxHash').textContent = result.boc.slice(0, 30) + '...';
                
                // REFRESH BALANCE - Pastikan balance terupdate
                const fullName = (currentUser.first_name || '') + (currentUser.last_name ? ' ' + currentUser.last_name : '');
                const newBalance = await loadUserBalance(currentUser.id, currentUser.username || '', fullName);
                
                console.log('✅ Deposit successful! New balance:', newBalance);
                
                // Update balance di header
                const balanceEl = document.getElementById('userBalance');
                if (balanceEl && newBalance !== undefined) {
                    balanceEl.textContent = newBalance.toLocaleString('id-ID');
                }
                
                // Tampilkan notifikasi sukses dengan nominal
                alert(`✅ Deposit ${amount} TON berhasil!\nSaldo Anda: ${newBalance.toLocaleString('id-ID')} IDR`);
                
                setTimeout(() => {
                    closeModal();
                }, 5000);
            } else {
                console.error('❌ Verification failed:', verifyData);
                alert('Deposit gagal diverifikasi: ' + (verifyData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Deposit error:', error);
            
            if (error.message?.includes('rejected')) {
                alert('Transaksi dibatalkan oleh user');
            } else if (error.message?.includes('No enough funds')) {
                alert('❌ Saldo TON tidak cukup!\n\nSilakan isi saldo wallet TON Anda terlebih dahulu.\n\nMinimal deposit: 0.1 TON');
            } else if (error.message?.includes('payload')) {
                alert('Gagal kirim deposit, silakan coba lagi');
            } else {
                alert('Gagal memproses deposit: ' + error.message);
            }
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnText;
        }
    }

    // ==================== MODAL FUNCTIONS ====================
    function showDepositModal() {
        const modal = document.getElementById('depositModal');
        if (!modal) return;
        
        document.getElementById('depositForm').style.display = 'none';
        document.getElementById('depositInstructions').style.display = 'none';
        
        if (isWalletConnected && tonConnectUI && tonConnectUI.account) {
            document.getElementById('depositWalletStatus').style.display = 'none';
            document.getElementById('depositForm').style.display = 'block';
            document.getElementById('depositAddress').textContent = webAddress;
        } else {
            document.getElementById('depositWalletStatus').style.display = 'block';
        }
        
        document.getElementById('tonAmount').value = '1.0';
        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
        
        document.getElementById('depositForm').style.display = 'none';
        document.getElementById('depositInstructions').style.display = 'none';
        document.getElementById('depositWalletStatus').style.display = 'block';
    }

    // ==================== DISCONNECT WALLET ====================
    async function disconnectWallet() {
        if (!tonConnectUI) return;
        
        try {
            await tonConnectUI.disconnect();
            console.log('✅ Wallet disconnected');
            
            isWalletConnected = false;
            updateHeaderDepositButton();
            
            // Reset UI modal
            const walletStatus = document.getElementById('depositWalletStatus');
            const depositForm = document.getElementById('depositForm');
            const disconnectContainer = document.getElementById('disconnectContainer');
            
            if (walletStatus) walletStatus.style.display = 'block';
            if (depositForm) depositForm.style.display = 'none';
            if (disconnectContainer) disconnectContainer.style.display = 'none';
            
            // Reset deposit address
            const depositAddress = document.getElementById('depositAddress');
            if (depositAddress) depositAddress.textContent = '';
            
            // Tampilkan notifikasi
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            
            alert('Wallet berhasil diputuskan');
        } catch (error) {
            console.error('Disconnect error:', error);
            alert('Gagal memutuskan wallet: ' + error.message);
        }
    }


    // ==================== HEADER BUTTON HANDLER ====================
    async function handleHeaderButtonClick() {
        if (isWalletConnected && tonConnectUI && tonConnectUI.account) {
            // Jika sudah connect, buka modal deposit
            showDepositModal();
        } else {
            // Jika belum connect, buka modal wallet
            if (tonConnectUI) {
                await tonConnectUI.openModal();
            } else {
                // Init dulu kalau belum
                initTonConnect();
                setTimeout(async () => {
                    if (tonConnectUI) {
                        await tonConnectUI.openModal();
                    }
                }, 500);
            }
        }
    }

    // ==================== INITIALIZATION ====================
    if (user) {
        currentUser = user;
        const fullName = (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '');
        loadUserBalance(user.id, user.username || '', fullName);
    } else {
        const balanceEl = document.getElementById("userBalance");
        if (balanceEl) balanceEl.textContent = "0";
    }

    // Init TON Connect
    initTonConnect();

    // Setup header deposit button
    const headerDepositBtn = document.getElementById('headerDepositBtn');
    if (headerDepositBtn) {
        headerDepositBtn.addEventListener('click', handleHeaderButtonClick);
    }

    // Setup modal close
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('depositModal');
        if (modal && e.target === modal) closeModal();
    });

    // Setup send deposit button
    const sendDepositBtn = document.getElementById('sendDepositBtn');
    if (sendDepositBtn) {
        sendDepositBtn.addEventListener('click', processDepositTON);
    }

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const redirectUrl = this.getAttribute('data-url');
            
            if (redirectUrl && redirectUrl !== '') {
                redirectToPage(redirectUrl);
                return;
            }
            
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    });

    console.log('✅ Games page ready with dynamic wallet button');
});

// Global function untuk copy address
window.copyDepositAddress = function() {
    const address = document.getElementById('depositAddress')?.textContent;
    if (address) {
        navigator.clipboard.writeText(address);
        alert('Address copied!');
    }
};

// Global function close modal
window.closeModal = function() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.style.display = 'none';
};
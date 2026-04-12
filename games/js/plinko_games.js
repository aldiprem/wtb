// games/js/plinko_games.js - PERBAIKAN LENGKAP UNTUK DROP BALL

(function() {
    console.log('🎰 Plinko Games Initialized');

    const API_BASE = window.location.origin;
    let currentRisk = 'medium';
    let telegramUser = null;
    let canvas = null;
    let ctx = null;
    let currentBetAmount = 1.0;
    let ballCount = 1;
    
    // Track active balls dan pending drops
    let activeBalls = [];
    let ballsToDrop = 0;
    let isProcessingDrop = false;
    let currentSessionBalls = []; // Balls yang sedang berjalan dalam sesi ini
    let pendingBalanceUpdate = 0; // Accumulator untuk update balance

    let multiplierAreas = [];
    
    // --- PHYSICS VARIABLES ---
    let balls = [];
    const GRAVITY = 0.2;
    const BOUNCE = 0.3;
    const PIN_RADIUS = 3;
    const BALL_RADIUS = 5;
    
    // --- SPAWNER VARIABLES ---
    let spawnerX = 0;
    let spawnerDir = 1;
    const spawnerSpeed = 0.5;
    let animationId = null;
    let isGameRunning = true;

    const RISK_MULTIPLIERS = {
        low: [5, 2.5, 2, 0.8, 0.5, 0.2, 0.5, 0.8, 2, 2.5, 5],
        medium: [10, 5, 2.5, 0.5, 0.2, 0.1, 0.2, 0.5, 2.5, 5, 10],
        high: [20, 10, 5, 2, 0.5, 0.1, 0.0, 0.1, 0.5, 2, 5, 10, 20]
    };

    let viewCount = parseInt(localStorage.getItem('plinko_views') || '0');

    function updateViewCount() {
        if (!sessionStorage.getItem('plinko_view_counted')) {
            viewCount++;
            localStorage.setItem('plinko_views', viewCount);
            sessionStorage.setItem('plinko_view_counted', 'true');
        }
        
        const viewsElement = document.getElementById('totalViews');
        if (viewsElement) {
            viewsElement.textContent = viewCount;
        }
    }

    function updateUILabels() {
        const riskLabels = { low: 'Low', medium: 'Medium', high: 'High' };
        const riskLabel = document.getElementById('currentRiskLabel');
        if (riskLabel) riskLabel.textContent = riskLabels[currentRisk];
        
        const betLabel = document.getElementById('currentBetLabel');
        if (betLabel) {
            if (currentBetAmount && currentBetAmount > 0) {
                betLabel.textContent = formatNumberWithCommas(currentBetAmount);
            } else {
                betLabel.textContent = '1.00';
                currentBetAmount = 1.0;
            }
        }
        
        const ballLabel = document.getElementById('ballCountLabel');
        if (ballLabel) ballLabel.textContent = (ballCount || 1) + ' Bola';
    }

    // Fungsi Render Cerobong
    function drawSpawner() {
        ctx.fillStyle = '#334155';
        ctx.fillRect(spawnerX - 15, 0, 30, 25);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(spawnerX, 25, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlinkoBoard() {
        if (!canvas || !ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        drawSpawner();

        const startY = 60; 
        const rowSpacing = 28;
        const colSpacing = 26;
        const totalRows = 9;
        const initialDots = 3;

        for (let row = 0; row < totalRows; row++) {
            const y = startY + row * rowSpacing;
            const dotsInRow = initialDots + row;
            const rowWidth = (dotsInRow - 1) * colSpacing;
            const rowStartX = (w / 2) - (rowWidth / 2);
            
            for (let col = 0; col < dotsInRow; col++) {
                const x = rowStartX + col * colSpacing;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            }
        }
        
        // Draw multiplier slots display
        updateMultiplierAreas();
        drawMultiplierSlotsDisplay();
    }
    
    function drawMultiplierSlotsDisplay() {
        const wrapper = document.querySelector('.multiplier-slots-wrapper');
        if (!wrapper) return;
        
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const wrapperRect = wrapper.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        const startX = wrapperRect.left - canvasRect.left;
        const width = wrapperRect.width;
        const segmentWidth = width / multipliers.length;
        
        for (let i = 0; i < multipliers.length; i++) {
            const mult = multipliers[i];
            let color = '#9ca3af';
            if (mult >= 5) color = '#f87171';
            else if (mult >= 2) color = '#fbbf24';
            else if (mult >= 1) color = '#34d399';
            
            ctx.font = 'bold 10px Inter';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            const x = startX + (i * segmentWidth) + (segmentWidth / 2);
            const y = canvas.height - 15;
            ctx.fillText(mult.toString(), x, y);
        }
    }

    // --- GAME LOOP (ANIMASI) ---
    function update() {
        if (!canvas || !ctx) return;
        
        drawPlinkoBoard();

        const maxRange = 10; 
        spawnerX += spawnerDir * spawnerSpeed;
        if (Math.abs(spawnerX - canvas.width / 2) > maxRange) spawnerDir *= -1;

        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            ball.vy += GRAVITY;
            ball.x += ball.vx;
            ball.y += ball.vy;

            const startY = 60;
            const rowSpacing = 28;
            const colSpacing = 26;
            
            const currentRow = Math.floor((ball.y - startY) / rowSpacing);
            if (currentRow >= 0 && currentRow < 9) {
                const dots = 3 + currentRow;
                const rWidth = (dots - 1) * colSpacing;
                const leftWall = (canvas.width / 2) - (rWidth / 2) - 10;
                const rightWall = (canvas.width / 2) + (rWidth / 2) + 10;

                if (ball.x < leftWall) {
                    ball.x = leftWall;
                    ball.vx *= -BOUNCE;
                } else if (ball.x > rightWall) {
                    ball.x = rightWall;
                    ball.vx *= -BOUNCE;
                }
            }

            const multiplierWrapper = document.querySelector('.multiplier-slots-wrapper');
            if (multiplierWrapper && ball.y > canvas.height - 60) {
                const wrapperWidth = multiplierWrapper.clientWidth;
                const wrapperLeft = (canvas.width - wrapperWidth) / 2;
                const wrapperRight = wrapperLeft + wrapperWidth;
                
                if (ball.x < wrapperLeft) ball.x = wrapperLeft;
                if (ball.x > wrapperRight) ball.x = wrapperRight;
            }

            for (let r = 0; r < 9; r++) {
                const dots = 3 + r;
                const rowWidth = (dots - 1) * colSpacing;
                const rowStartX = (canvas.width / 2) - (rowWidth / 2);
                for (let c = 0; c < dots; c++) {
                    const px = rowStartX + c * colSpacing;
                    const py = startY + r * rowSpacing;
                    const dx = ball.x - px;
                    const dy = ball.y - py;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < BALL_RADIUS + PIN_RADIUS) {
                        const angle = Math.atan2(dy, dx);
                        ball.vx += Math.cos(angle) * 1.5;
                        ball.vy *= -BOUNCE;
                        ball.y = py + Math.sin(angle) * (BALL_RADIUS + PIN_RADIUS);
                    }
                }
            }

            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            
            // Gradient untuk bola
            const gradient = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_RADIUS);
            gradient.addColorStop(0, '#ff6b6b');
            gradient.addColorStop(1, '#ef4444');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ef4444';
            ctx.fill();
            ctx.shadowBlur = 0;

            // Check if ball hit multiplier area
            const isHit = checkMultiplierHit(ball);
            
            if (isHit || ball.y > canvas.height + 100) {
                balls.splice(i, 1);
                checkAllBallsComplete();
            }
        }

        animationId = requestAnimationFrame(update);
    }
    
    function checkAllBallsComplete() {
        if (balls.length === 0 && isProcessingDrop) {
            // Semua bola sudah selesai, update final balance
            setTimeout(async () => {
                await finalizeBalanceUpdate();
                isProcessingDrop = false;
                currentSessionBalls = [];
                console.log('✅ All balls completed, session finished');
            }, 500);
        }
    }
    
    async function finalizeBalanceUpdate() {
        if (pendingBalanceUpdate !== 0 && telegramUser?.id) {
            try {
                // Kirim net win ke server (HANYA TAMBAHAN, karena bet sudah dipotong)
                const response = await fetch(`${API_BASE}/api/plinko/update-net-balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: telegramUser.id,
                        net_change: pendingBalanceUpdate  // Ini hanya win amount (positif)
                    })
                });
                const data = await response.json();
                if (data.success) {
                    await loadUserBalance();
                    console.log(`✅ Balance updated: +${pendingBalanceUpdate} TON`);
                }
            } catch (error) {
                console.error('Error finalizing balance:', error);
                await loadUserBalance();
            }
            pendingBalanceUpdate = 0;
        }
    }

    // Fungsi untuk update area multiplier
    function updateMultiplierAreas() {
        const wrapper = document.querySelector('.multiplier-slots-wrapper');
        if (!wrapper || !canvas) return;
        
        const wrapperRect = wrapper.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        const startX = wrapperRect.left - canvasRect.left;
        const width = wrapperRect.width;
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const segmentWidth = width / multipliers.length;
        
        multiplierAreas = [];
        for (let i = 0; i < multipliers.length; i++) {
            multiplierAreas.push({
                index: i,
                multiplier: multipliers[i],
                x: startX + (i * segmentWidth),
                width: segmentWidth,
                bottomY: canvas.height - 15
            });
        }
    }

    function checkMultiplierHit(ball) {
        console.log('🎯 [DEBUG] checkMultiplierHit called, ball.y:', ball.y, 'canvas.height:', canvas.height);
        
        if (ball.y + BALL_RADIUS < canvas.height - 40) {
            console.log('🎯 [DEBUG] Ball not at bottom yet');
            return false;
        }
        
        console.log('🎯 [DEBUG] Ball at bottom, checking multipliers');
        updateMultiplierAreas();
        
        for (const area of multiplierAreas) {
            if (ball.x >= area.x && ball.x <= area.x + area.width) {
                console.log('🎯 [DEBUG] Hit area:', area.index, 'multiplier:', area.multiplier);
                
                const winAmount = ball.bet * area.multiplier;
                const netChange = winAmount;
                
                pendingBalanceUpdate += netChange;
                
                animateSlot(area.index);
                showResult(area.multiplier, winAmount, netChange);
                
                const roundHash = generateRoundHash();
                
                console.log('🎯 [DEBUG] About to call saveGameResult, telegramUser:', telegramUser);
                
                // 🔥 PANGGIL SAVE GAME RESULT
                saveGameResult(ball.bet, area.multiplier, winAmount, roundHash);
                
                return true;
            }
        }
        console.log('🎯 [DEBUG] No multiplier area hit');
        return false;
    }
    
    function showResult(multiplier, winAmount, netChange) {
        const resultDiv = document.getElementById('resultDisplay');
        const resultMultiplier = document.getElementById('resultMultiplier');
        const resultWin = document.getElementById('resultWin');
        
        resultDiv.style.display = 'block';
        resultMultiplier.textContent = `${multiplier}x`;

        const winText = winAmount > 0 ? `+${winAmount.toFixed(2)}` : `${winAmount.toFixed(2)}`;
        resultWin.textContent = winText;
        
        if (multiplier >= 5) {
            resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
            resultDiv.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        } else if (multiplier >= 2) {
            resultDiv.style.background = 'rgba(245, 158, 11, 0.2)';
            resultDiv.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        } else {
            resultDiv.style.background = 'rgba(16, 185, 129, 0.2)';
            resultDiv.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        }
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
    }

    async function updateUserBalance(telegramId, netChange) {
        if (netChange === 0) return;
        try {
            await fetch(`${API_BASE}/api/plinko/update-net-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    net_change: netChange
                })
            });
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }

    function animateSlot(slotIndex) {
        const slots = document.querySelectorAll('.multiplier-slot');
        if (slots[slotIndex]) {
            slots[slotIndex].classList.add('active', 'pulse');
            
            setTimeout(() => {
                slots[slotIndex].classList.remove('active', 'pulse');
            }, 800);
        }
    }

    function renderMultiplierSlots() {
        const wrapper = document.getElementById('multiplierSlotsWrapper');
        if (!wrapper) return;
        
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        
        let html = '';
        for (let i = 0; i < multipliers.length; i++) {
            const mult = multipliers[i];
            let riskClass = '';
            
            if (mult >= 5) riskClass = 'high';
            else if (mult >= 2) riskClass = 'medium';
            else if (mult >= 1) riskClass = 'low';
            else riskClass = 'zero';
            
            const displayValue = mult % 1 === 0 ? mult : mult.toFixed(1);
            
            html += `<div class="multiplier-slot ${riskClass}" data-index="${i}" data-multiplier="${mult}">
                        ${displayValue}
                    </div>`;
        }
        
        wrapper.innerHTML = html;
    }

    // Generate random round hash
    function generateRoundHash() {
        return 'plinko_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    }

    // PERBAIKAN TOTAL untuk fungsi dropBalls
    async function dropBalls() {
        console.log('🎯 dropBalls called');
        console.log('🎯 telegramUser:', telegramUser);
        
        // AMBIL LANGSUNG dari input panel, jangan pakai currentBetAmount yang belum update
        const betInput = document.getElementById('panelBetAmount');
        let betAmount = 0;
        
        if (betInput) {
            betAmount = parseFloat(betInput.value);
            if (isNaN(betAmount) || betAmount <= 0) {
                betAmount = 1.0;
                betInput.value = '1.0';
            }
        } else {
            betAmount = currentBetAmount;
            if (isNaN(betAmount) || betAmount <= 0) {
                betAmount = 1.0;
            }
        }
        
        // PASTIKAN currentBetAmount terupdate
        currentBetAmount = betAmount;
        
        console.log('💰 Bet amount:', currentBetAmount, 'TON');
        
        // VALIDASI - jika masih 0 atau invalid, SET DEFAULT
        if (!currentBetAmount || currentBetAmount <= 0 || isNaN(currentBetAmount)) {
            console.log('⚠️ Invalid bet amount, setting to 1.0');
            currentBetAmount = 1.0;
            if (betInput) betInput.value = '1.0';
        }
        
        // VALIDASI MINIMAL (0.1 TON)
        if (currentBetAmount < 0.1) {
            console.log('⚠️ Bet too small, setting to 0.1');
            currentBetAmount = 0.1;
            if (betInput) betInput.value = '0.1';
        }
        
        // UPDATE LABEL
        updateUILabels();
        
        // CEK ULANG setelah update
        if (currentBetAmount < 0.1) {
            alert('Minimal taruhan 0.1 TON');
            toggleBetPanel();
            return;
        }
        
        // CEK PROSES BERJALAN
        if (isProcessingDrop) {
            alert('Masih ada bola yang berjalan, tunggu sebentar...');
            return;
        }
        
        // CEK JUMLAH BOLA
        if (ballCount <= 0) {
            ballCount = 1;
            updateUILabels();
        }
        
        const totalBet = currentBetAmount * ballCount;
        
        // LOAD BALANCE TERBARU
        const currentBalance = await loadUserBalance();
        console.log('💰 Current balance:', currentBalance, 'TON');
        console.log('💰 Total bet required:', totalBet, 'TON');
        
        if (currentBalance < totalBet) {
            alert(`Saldo tidak cukup!\nSaldo: ${currentBalance.toFixed(2)} TON\nDibutuhkan: ${totalBet.toFixed(2)} TON\n\nSilakan deposit terlebih dahulu.`);
            return;
        }
        
        isProcessingDrop = true;
        pendingBalanceUpdate = 0;
        
        try {
            // DEDUCT BALANCE
            const deductResponse = await fetch(`${API_BASE}/api/plinko/deduct-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: telegramUser?.id,
                    amount: totalBet
                })
            });
            
            const deductData = await deductResponse.json();
            
            if (!deductData.success) {
                alert(deductData.error || 'Gagal memotong saldo');
                isProcessingDrop = false;
                return;
            }
            
            // UPDATE UI BALANCE
            await loadUserBalance();
            console.log(`💰 Balance deducted: ${totalBet} TON`);
            
            // JATUHKAN BOLA
            for (let i = 0; i < ballCount; i++) {
                setTimeout(() => {
                    dropSingleBall();
                }, i * 250);
            }
            
            // SIMPAN BET KE LOCALSTORAGE
            localStorage.setItem('plinko_bet_amount', currentBetAmount);
            
        } catch (error) {
            console.error('Error in dropBalls:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
            isProcessingDrop = false;
        }
    }
    
    // Fungsi untuk menjatuhkan satu bola
    function dropSingleBall() {
        // Random offset untuk variasi
        const randomOffset = (Math.random() - 0.5) * 16;
        const startX = Math.min(Math.max(spawnerX + randomOffset, 20), canvas.width - 20);
        
        balls.push({
            id: Date.now() + Math.random(),
            x: startX,
            y: 28,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 1,
            bet: currentBetAmount
        });
        
        console.log(`🎾 Ball dropped, active balls: ${balls.length}`);
    }

    // Fungsi helper untuk format angka ribuan
    function formatNumberWithCommas(number) {
        // Pisahkan bagian integer dan desimal
        let parts = number.toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];
        
        // Format integer part dengan comma
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        // Gabungkan kembali
        return decimalPart ? integerPart + '.' + decimalPart : integerPart;
    }

    async function loadUserBalance() {
        try {
            const tg = window.Telegram.WebApp;
            const user = tg.initDataUnsafe?.user;
            
            if (!user || !user.id) {
                document.getElementById('userBalance').textContent = '0';
                return 0;
            }
            
            const response = await fetch(`${API_BASE}/api/games/balance/${user.id}`);
            const data = await response.json();
            
            const balanceEl = document.getElementById('userBalance');
            const panelBalanceEl = document.getElementById('panelUserBalance');
            
            if (data.success) {
                const formattedBalance = formatNumberWithCommas(data.balance);
                // HAPUS ' TON' dari sini
                if (balanceEl) balanceEl.textContent = formattedBalance;
                if (panelBalanceEl) panelBalanceEl.textContent = formattedBalance;
                return data.balance;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
        return 0;
    }

    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/stats`);
            const data = await response.json();
            
            if (data.success) {
                // Total Win Amount (Jackpot)
                const totalWinAmount = data.total_win_amount || 0;
                document.getElementById('totalWinAmount').textContent = formatNumberWithCommas(totalWinAmount);
                document.getElementById('biggestWin').textContent = `${data.biggest_multiplier || 0}x`;
                
                // Last Player Info (stat-lasted)
                const lastPlayerName = data.last_player || '-';
                const lastPlayerMultiplier = data.last_multiplier || '0';
                
                document.getElementById('lastPlayerName').textContent = lastPlayerName;
                document.getElementById('lastPlayerMultiplier').textContent = `${lastPlayerMultiplier}x`;
                
                // Update avatar untuk stat-lasted dari data terakhir
                if (data.last_player && data.history && data.history.length > 0) {
                    const lastGame = data.history[0];
                    if (lastGame && lastGame.photo_url) {
                        const avatarImg = document.getElementById('userAvatarImg');
                        if (avatarImg) avatarImg.src = lastGame.photo_url;
                    }
                }
                
                // Round Hash
                if (data.current_hash) {
                    document.getElementById('roundHash').textContent = data.current_hash.substring(0, 12) + '...';
                } else {
                    document.getElementById('roundHash').textContent = '-';
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async function updateUserAvatar() {
        try {
            const tg = window.Telegram.WebApp;
            const user = tg.initDataUnsafe?.user;
            
            if (user && user.photo_url) {
                const avatarImg = document.getElementById('userAvatarImg');
                if (avatarImg) {
                    avatarImg.src = user.photo_url;
                }
            } else if (user && user.first_name) {
                const initial = user.first_name.charAt(0).toUpperCase();
                const avatarImg = document.getElementById('userAvatarImg');
                if (avatarImg) {
                    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=6c5ce7&color=fff&size=64`;
                }
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
        }
    }

    async function loadHistory(limit = 10, isFullscreen = false) {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/history?limit=${isFullscreen ? 100 : limit}`);
            const data = await response.json();
            
            console.log('📜 History response:', data);
            
            const historyList = document.getElementById(isFullscreen ? 'fullscreenHistoryList' : 'historyList');
            
            if (!historyList) return;
            
            if (!data.success || !data.history || data.history.length === 0) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-gamepad"></i>
                        <p>Belum ada riwayat permainan</p>
                    </div>
                `;
                return;
            }
            
            console.log(`📜 Rendering ${data.history.length} history items`);
            
            let html = '';
            
            for (const game of data.history) {
                // Tentukan kelas multiplier
                let multiplierClass = 'zero';
                let multiplierColor = 'zero';
                if (game.multiplier >= 5) {
                    multiplierClass = 'high';
                    multiplierColor = 'high';
                } else if (game.multiplier >= 2) {
                    multiplierClass = 'medium';
                    multiplierColor = 'medium';
                } else if (game.multiplier >= 1) {
                    multiplierClass = 'low';
                    multiplierColor = 'low';
                }
                
                // Tentukan kelas win (merah untuk rugi, hijau untuk untung)
                let winClass = 'neutral';
                let winAmount = game.win_amount || 0;
                let betAmount = game.bet_amount || 0;
                let isProfit = winAmount > betAmount;
                let isLoss = winAmount < betAmount;
                
                let winText = `${winAmount.toFixed(2)}`;
                let borderColor = '';
                
                if (isProfit) {
                    winClass = 'positive';
                    winText = `+${(winAmount - betAmount).toFixed(2)}`;
                    borderColor = 'border-green';
                } else if (isLoss) {
                    winClass = 'negative';
                    winText = `-${(betAmount - winAmount).toFixed(2)}`;
                    borderColor = 'border-red';
                } else {
                    borderColor = 'border-neutral';
                }
                
                // Format waktu
                let timeFormatted = '-';
                if (game.created_at) {
                    const playTime = new Date(game.created_at);
                    if (!isNaN(playTime.getTime())) {
                        timeFormatted = playTime.toLocaleString('id-ID', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        });
                    }
                }
                
                const playerName = game.username || 'Anonymous';
                
                // Gunakan photo_url dari database
                let avatarUrl = game.photo_url;
                if (!avatarUrl) {
                    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=6c5ce7&color=fff&size=64&bold=true&length=2`;
                }
                
                html += `
                    <div class="history-item ${borderColor}" data-hash="${game.round_hash || ''}">
                        <div class="history-item-content">
                            <div class="history-avatar">
                                <img src="${avatarUrl}" alt="${playerName}" 
                                    onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(playerName.charAt(0))}&background=6c5ce7&color=fff&size=64&bold=true'">
                            </div>
                            <div class="history-info">
                                <div class="history-player-name">${escapeHtml(playerName)}</div>
                                <div class="history-time">
                                    <i class="fas fa-clock"></i>
                                    <span>${timeFormatted}</span>
                                </div>
                            </div>
                            <div class="history-result">
                                <div class="history-multiplier ${multiplierColor}">${game.multiplier || 0}x</div>
                                <div class="history-win ${winClass}">${winText}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            historyList.innerHTML = html;
            
            // Event click untuk copy hash
            document.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', () => {
                    const hash = item.dataset.hash;
                    if (hash && hash !== 'undefined') {
                        navigator.clipboard.writeText(hash);
                        showToast('Round Hash copied!', 'success');
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ Error loading history:', error);
            const historyList = document.getElementById(isFullscreen ? 'fullscreenHistoryList' : 'historyList');
            if (historyList) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Gagal memuat riwayat: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    // Fungsi helper untuk escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Fungsi showToast untuk notifikasi copy
    function showToast(message, type = 'info') {
        // Cek apakah toast container sudah ada
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.className = `toast-notification ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    async function saveGameResult(betAmount, multiplier, winAmount, roundHash) {
        console.log('💾 [SAVE GAME RESULT] Called with:', {
            betAmount, multiplier, winAmount, roundHash
        });
        
        try {
            const tg = window.Telegram.WebApp;
            const user = tg.initDataUnsafe?.user;
            
            if (!user || !user.id) {
                console.error('❌ Cannot save game: No user data');
                alert('ERROR: No user data! Cannot save game.');
                return;
            }
            
            let photoUrl = null;
            if (user && user.photo_url) {
                photoUrl = user.photo_url;
            }
            
            // 🔥 PERUBAHAN: Gunakan first_name sebagai tampilan, username sebagai backup
            const displayName = user.first_name || user.username || 'Anonymous';
            
            const payload = {
                bet_amount: betAmount,
                multiplier: multiplier,
                win_amount: winAmount,
                round_hash: roundHash,
                risk_level: currentRisk,
                user_id: user.id,
                username: displayName,
                photo_url: photoUrl,
                is_forced: false,
                cheat_reason: ''
            };
            
            console.log('💾 [SAVE] Sending payload:', payload);
            
            const response = await fetch(`${API_BASE}/api/plinko/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Game saved successfully');
                await loadStats();
                await loadHistory();
            } else {
                console.error('❌ Failed to save game:', data.error);
            }
        } catch (error) {
            console.error('❌ Error saving game:', error);
        }
    }

    // ==================== PANEL FUNCTIONS ====================
    function closeAllPanels() {
        const riskPanel = document.getElementById('riskPanel');
        const betPanel = document.getElementById('betPanel');
        const ballsPanel = document.getElementById('ballsPanel');
        
        if (riskPanel) riskPanel.style.display = 'none';
        if (betPanel) betPanel.style.display = 'none';
        if (ballsPanel) ballsPanel.style.display = 'none';
        
        const chevronRisk = document.getElementById('riskChevron');
        const chevronBet = document.getElementById('betChevron');
        const chevronBall = document.getElementById('ballChevron');
        
        if (chevronRisk) chevronRisk.className = 'fas fa-chevron-down';
        if (chevronBet) chevronBet.className = 'fas fa-chevron-up';
        if (chevronBall) chevronBall.className = 'fas fa-chevron-up';
    }

    function toggleRiskPanel() {
        const panel = document.getElementById('riskPanel');
        const chevron = document.getElementById('riskChevron');
        
        if (panel.style.display === 'none') {
            closeAllPanels();
            panel.style.display = 'block';
            if (chevron) chevron.className = 'fas fa-chevron-up';
        } else {
            panel.style.display = 'none';
            if (chevron) chevron.className = 'fas fa-chevron-down';
        }
    }

    function toggleBetPanel() {
        const panel = document.getElementById('betPanel');
        const chevron = document.getElementById('betChevron');
        
        if (panel.style.display === 'none') {
            closeAllPanels();
            panel.style.display = 'block';
            if (chevron) chevron.className = 'fas fa-chevron-down';
            loadUserBalance();
            const betInput = document.getElementById('panelBetAmount');
            if (betInput) {
                // TAMPILKAN currentBetAmount yang valid
                if (currentBetAmount && currentBetAmount > 0) {
                    betInput.value = currentBetAmount;
                } else {
                    betInput.value = '1.0';
                    currentBetAmount = 1.0;
                }
            }
        } else {
            panel.style.display = 'none';
            if (chevron) chevron.className = 'fas fa-chevron-up';
        }
    }

    function toggleBallsPanel() {
        const panel = document.getElementById('ballsPanel');
        const chevron = document.getElementById('ballChevron');
        
        if (panel.style.display === 'none') {
            closeAllPanels();
            panel.style.display = 'block';
            if (chevron) chevron.className = 'fas fa-chevron-down';
        } else {
            panel.style.display = 'none';
            if (chevron) chevron.className = 'fas fa-chevron-up';
        }
    }

    function setBetAmount(percent) {
        loadUserBalance().then(balance => {
            let amount = balance * (percent / 100);
            amount = Math.round(amount * 10) / 10;
            if (amount < 0.1) amount = 0.1;
            const betInput = document.getElementById('panelBetAmount');
            if (betInput) betInput.value = amount.toFixed(1);
        });
    }

    async function confirmBet() {
        const betInput = document.getElementById('panelBetAmount');
        let amount = parseFloat(betInput?.value || 0);
        
        if (isNaN(amount) || amount < 0.1) {
            amount = 0.1;
            if (betInput) betInput.value = amount.toFixed(1);
        }
        
        // BATASI MAKSIMAL (opsional, misal max 100 TON)
        const maxBet = 100;
        if (amount > maxBet) {
            amount = maxBet;
            if (betInput) betInput.value = amount.toFixed(1);
            alert(`Maksimal taruhan ${maxBet} TON`);
        }
        
        currentBetAmount = amount;
        updateUILabels();
        
        // SIMPAN KE LOCALSTORAGE
        localStorage.setItem('plinko_bet_amount', currentBetAmount);
        
        const panel = document.getElementById('betPanel');
        const chevron = document.getElementById('betChevron');
        if (panel) panel.style.display = 'none';
        if (chevron) chevron.className = 'fas fa-chevron-up';
        
        console.log(`✅ Bet confirmed: ${currentBetAmount.toFixed(2)} TON`);
        
        // NOTIFIKASI SINGKAT
        const betLabel = document.getElementById('currentBetLabel');
        if (betLabel) {
            const originalColor = betLabel.style.color;
            betLabel.style.color = '#10b981';
            setTimeout(() => {
                betLabel.style.color = originalColor;
            }, 1000);
        }
    }

    function setBallCount(count) {
        ballCount = count;
        updateUILabels();
        
        document.querySelectorAll('.ball-option').forEach(opt => {
            opt.classList.remove('active');
            if (parseInt(opt.dataset.balls) === count) {
                opt.classList.add('active');
            }
        });
        
        const panel = document.getElementById('ballsPanel');
        const chevron = document.getElementById('ballChevron');
        if (panel) panel.style.display = 'none';
        if (chevron) chevron.className = 'fas fa-chevron-up';
    }

    function generateBallsGrid() {
        const grid = document.getElementById('ballsGrid');
        if (!grid) return;
        
        let html = '';
        for (let i = 1; i <= 10; i++) {
            html += `<div class="ball-option ${i === ballCount ? 'active' : ''}" data-balls="${i}">${i} Bola</div>`;
        }
        grid.innerHTML = html;
        
        document.querySelectorAll('.ball-option').forEach(opt => {
            opt.addEventListener('click', () => {
                setBallCount(parseInt(opt.dataset.balls));
            });
        });
    }

    function setRisk(risk) {
        currentRisk = risk;
        renderMultiplierSlots();
        updateUILabels();
        
        document.querySelectorAll('.risk-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.risk === risk) {
                btn.classList.add('active');
            }
        });
        
        const panel = document.getElementById('riskPanel');
        const chevron = document.getElementById('riskChevron');
        if (panel) panel.style.display = 'none';
        if (chevron) chevron.className = 'fas fa-chevron-down';
    }

    // Fix input number agar bisa diketik
    function fixInputNumber() {
        const betInput = document.getElementById('panelBetAmount');
        if (betInput) {
            betInput.addEventListener('input', function(e) {
                let value = this.value;
                if (value === '' || value === null) {
                    return;
                }
                let numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue < 0.1) {
                    this.value = 0.1;
                }
            });
            
            betInput.addEventListener('blur', function() {
                if (this.value === '' || this.value === null) {
                    this.value = '0.1';
                }
                let numValue = parseFloat(this.value);
                if (isNaN(numValue)) {
                    this.value = '0.1';
                }
                if (numValue < 0.1) {
                    this.value = '0.1';
                }
            });
        }
    }

    function getTelegramUserSafe() {
        try {
            const tg = window.Telegram.WebApp;
            
            // Method 1: initDataUnsafe
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                return tg.initDataUnsafe.user;
            }
            
            // Method 2: Parse from initData
            if (tg.initData) {
                const params = new URLSearchParams(tg.initData);
                const userParam = params.get('user');
                if (userParam) {
                    return JSON.parse(decodeURIComponent(userParam));
                }
            }
            
            // Method 3: Global variable (if set by parent)
            if (window.TelegramUser) {
                return window.TelegramUser;
            }
            
            console.error('❌ Cannot get Telegram user from any source');
            return null;
        } catch (error) {
            console.error('❌ Error getting Telegram user:', error);
            return null;
        }
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        const tg = window.Telegram.WebApp;
        tg.expand();
        
        // 🔥 AMBIL TELEGRAM USER DENGAN CARA YANG LEBIH AMAN
        let user = null;
        
        // Cara 1: Dari initDataUnsafe
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            user = tg.initDataUnsafe.user;
            console.log('👤 User from initDataUnsafe:', user);
        }
        
        // Cara 2: Backup dari WebApp (jika ada)
        if (!user && tg.initData) {
            try {
                const params = new URLSearchParams(tg.initData);
                const userParam = params.get('user');
                if (userParam) {
                    user = JSON.parse(decodeURIComponent(userParam));
                    console.log('👤 User from initData parse:', user);
                }
            } catch(e) {
                console.error('Error parsing initData:', e);
            }
        }
        
        // Cara 3: Fallback ke mock (HANYA UNTUK DEBUG - HAPUS NANTI)
        if (!user || !user.id) {
            console.warn('⚠️ No user data from Telegram, using fallback (DEBUG MODE)');
            user = {
                id: 7998861975,  // ID dari log Anda
                first_name: 'Test User',
                username: 'test_user',
                photo_url: null
            };
        }
        
        telegramUser = user;
        
        console.log('✅ Final telegramUser:', telegramUser);
        console.log('✅ User ID:', telegramUser?.id);
        
        // Jika tidak ada user ID, tampilkan error di UI
        if (!telegramUser?.id) {
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = 'ERROR: No User';
            alert('ERROR: Cannot identify Telegram user. Please restart the app.');
            return;
        }
        
        await loadUserBalance();
        await updateUserAvatar();
        
        canvas = document.getElementById('plinkoCanvas');
        ctx = canvas.getContext('2d');
        
        function resizeCanvas() {
            const container = canvas.parentElement;
            canvas.width = Math.min(container.clientWidth, 800);
            canvas.height = 320;
            spawnerX = canvas.width / 2;
            drawPlinkoBoard();
            updateMultiplierAreas();
        }
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        
        // Event Listeners
        document.getElementById('playBtn')?.addEventListener('click', dropBalls);
        document.getElementById('refreshHistory')?.addEventListener('click', () => {
            loadStats();
            loadHistory();
        });
        
        // Control bar listeners
        document.getElementById('riskLevelTrigger')?.addEventListener('click', toggleRiskPanel);
        document.getElementById('betInfoTrigger')?.addEventListener('click', toggleBetPanel);
        document.getElementById('ballCountTrigger')?.addEventListener('click', toggleBallsPanel);
        
        // Close panel buttons
        document.getElementById('closeRiskPanel')?.addEventListener('click', toggleRiskPanel);
        document.getElementById('closeBetPanel')?.addEventListener('click', toggleBetPanel);
        document.getElementById('closeBallsPanel')?.addEventListener('click', toggleBallsPanel);
        
        // Risk buttons
        document.querySelectorAll('.risk-btn').forEach(btn => {
            btn.addEventListener('click', () => setRisk(btn.dataset.risk));
        });
        
        // Percent buttons
        document.querySelectorAll('.percent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const percent = parseInt(btn.dataset.percent);
                setBetAmount(percent);
            });
        });
        
        // Confirm bet button
        document.getElementById('confirmBetPanelBtn')?.addEventListener('click', confirmBet);
        
        // Fix input number
        fixInputNumber();
        
        // Close panels on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.control-panel') && !e.target.closest('.pagination-item')) {
                closeAllPanels();
            }
        });
        
        await loadStats();
        await loadHistory();
        updateViewCount();
        renderMultiplierSlots();
        generateBallsGrid();
        
        // PERBAIKAN: Set default bet amount ke panel input dan currentBetAmount
        const betInput = document.getElementById('panelBetAmount');

        // SET DEFAULT BET AMOUNT dari localStorage
        let savedBet = localStorage.getItem('plinko_bet_amount');
        if (savedBet && parseFloat(savedBet) >= 0.1) {
            currentBetAmount = parseFloat(savedBet);
        } else {
            currentBetAmount = 1.0;
        }

        // PASTIKAN panelBetAmount terisi
        if (betInput) {
            betInput.value = currentBetAmount.toFixed(1);
        }

        // PASTIKAN currentBetAmount TIDAK 0 atau null
        if (!currentBetAmount || currentBetAmount <= 0) {
            currentBetAmount = 1.0;
            if (betInput) betInput.value = '1.0';
        }

        // Pastikan ballCount ada nilainya
        if (!ballCount || ballCount < 1) {
            ballCount = 1;
        }

        // UPDATE LABELS
        updateUILabels();

        // Fullscreen history button
        const fullscreenBtn = document.getElementById('fullscreenHistoryBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', async () => {
                const modal = document.getElementById('fullscreenHistoryModal');
                if (modal) {
                    modal.style.display = 'flex';
                    await loadHistory(100, true);
                }
            });
        }

        // Close fullscreen modal
        const closeFullscreen = document.getElementById('closeFullscreenHistory');
        if (closeFullscreen) {
            closeFullscreen.addEventListener('click', () => {
                const modal = document.getElementById('fullscreenHistoryModal');
                if (modal) modal.style.display = 'none';
            });
        }

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('fullscreenHistoryModal');
            if (modal && e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Simpan ke localStorage setiap kali bet berubah
        const originalConfirmBet = confirmBet;
        window.confirmBet = async function() {
            await originalConfirmBet();
            localStorage.setItem('plinko_bet_amount', currentBetAmount);
        };

        console.log('✅ Plinko Games Ready');
        console.log('✅ Initial bet amount:', currentBetAmount, 'TON');
        console.log('Ball count:', ballCount);

        update();
    }
    init();

    // Global function untuk copy round hash
    window.copyRoundHash = function() {
        const hashElement = document.getElementById('roundHash');
        if (hashElement) {
            const hashText = hashElement.textContent;
            if (hashText && hashText !== '-') {
                navigator.clipboard.writeText(hashText);
                const container = document.getElementById('roundHashContainer');
                const originalBg = container.style.background;
                container.style.background = 'rgba(16, 185, 129, 0.2)';
                setTimeout(() => {
                    container.style.background = originalBg;
                }, 300);
                
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
            }
        }
    };
})();
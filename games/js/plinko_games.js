// games/js/plinko_games.js
(function() {
    console.log('🎰 Plinko Games Initialized');

    const API_BASE = window.location.origin;
    let currentRisk = 'medium';
    let telegramUser = null;
    let canvas = null;
    let ctx = null;

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

    const RISK_MULTIPLIERS = {
        low: [5, 4, 3, 2, 1, 0.5, 1, 2, 3, 4, 5],
        medium: [15, 10, 5, 2.5, 1, 0.2, 1, 2.5, 5, 10, 15],
        high: [20, 10, 2, 1.5, 0.8, 0.5, 0.1, 0.0, 0.1, 0.5, 0.8, 1.5, 2, 10, 20]
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
                
                // Outer glow
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.fill();
                
                // Inner peg
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            }
        }
    }

    // --- GAME LOOP (ANIMASI) ---
    function update() {
        if (!canvas || !ctx) return;
        
        drawPlinkoBoard();

        // Gerakkan Cerobong (Hanya di antara 3 titik teratas)
        const maxRange = 10; 
        spawnerX += spawnerDir * spawnerSpeed;
        if (Math.abs(spawnerX - canvas.width / 2) > maxRange) spawnerDir *= -1;

        // Di dalam loop balls.forEach di fungsi update()
        balls.forEach((ball, index) => {
            ball.vy += GRAVITY;
            ball.x += ball.vx;
            ball.y += ball.vy;

            const startY = 60;
            const rowSpacing = 28;
            const colSpacing = 26;
            
            // --- TAMBAHAN: PEMBATAS SAMPING (INVISIBLE WALLS) ---
            // Hitung baris saat ini berdasarkan posisi Y bola
            const currentRow = Math.floor((ball.y - startY) / rowSpacing);
            if (currentRow >= 0 && currentRow < 9) {
                const dots = 3 + currentRow;
                const rWidth = (dots - 1) * colSpacing;
                const leftWall = (canvas.width / 2) - (rWidth / 2) - 10; // -10 buffer
                const rightWall = (canvas.width / 2) + (rWidth / 2) + 10; // +10 buffer

                // Pantulkan jika menabrak batas luar titik-titik
                if (ball.x < leftWall) {
                    ball.x = leftWall;
                    ball.vx *= -BOUNCE;
                } else if (ball.x > rightWall) {
                    ball.x = rightWall;
                    ball.vx *= -BOUNCE;
                }
            }

            // Pembatas berdasarkan lebar multiplier wrapper
            const multiplierWrapper = document.querySelector('.multiplier-slots-wrapper');
            if (multiplierWrapper && ball.y > canvas.height - 60) {
                const wrapperWidth = multiplierWrapper.clientWidth;
                const wrapperLeft = (canvas.width - wrapperWidth) / 2;
                const wrapperRight = wrapperLeft + wrapperWidth;
                
                if (ball.x < wrapperLeft) ball.x = wrapperLeft;
                if (ball.x > wrapperRight) ball.x = wrapperRight;
            }

            // --- LOGIKA TABRAKAN PIN LAMA ANDA ---
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

            // Gambar Bola
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();

            // Cek tabrakan dengan dinding multiplier
            checkMultiplierWalls(ball);

            // Cek validasi masuk slot (sebelum bola dihapus)
            let isHit = false;
            if (ball.y + BALL_RADIUS >= canvas.height - 20) {
                isHit = checkMultiplierHit(ball);
            }

            // Hapus bola setelah valid atau sudah lewat batas
            if (ball.y > canvas.height + 50 || isHit) {
                balls.splice(index, 1);
            }
        });

        animationId = requestAnimationFrame(update);
    }

    // Load stats from API
    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/stats`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('biggestWin').textContent = `${data.biggest_multiplier || 0}x`;
                
                // Tampilkan last player dengan avatar dari Telegram
                const lastPlayerName = data.last_player || '-';
                const lastPlayerMultiplier = data.last_multiplier || '0';
                
                document.getElementById('lastPlayerName').textContent = lastPlayerName;
                document.getElementById('lastPlayerMultiplier').textContent = `${lastPlayerMultiplier}x`;
                document.getElementById('roundHash').textContent = data.current_hash ? data.current_hash.substring(0, 12) + '...' : '-';
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
                // Generate avatar from initial
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

    // Load history
    async function loadHistory() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/history`);
            const data = await response.json();
            
            const tbody = document.getElementById('historyBody');
            
            if (!data.success || !data.history || data.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Belum ada riwayat</td></td>';
                return;
            }
            
            let html = '';
            for (const game of data.history) {
                const winClass = game.win_amount > 0 ? 'win-positive' : '';
                html += `
                    <tr>
                        <td><code>${game.round_hash.substring(0, 10)}...</code></td>
                        <td>${game.username || 'Anonymous'}</td>
                        <td>${game.bet_amount.toLocaleString()}</td>
                        <td><strong>${game.multiplier}x</strong></td>
                        <td class="${winClass}">${game.win_amount.toLocaleString()}</td>
                        <td>${new Date(game.created_at).toLocaleString()}</td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    // Save game result
    async function saveGameResult(betAmount, multiplier, winAmount, roundHash) {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bet_amount: betAmount,
                    multiplier: multiplier,
                    win_amount: winAmount,
                    round_hash: roundHash,
                    risk_level: currentRisk,
                    user_id: telegramUser?.id || null,
                    username: telegramUser?.username || telegramUser?.first_name || 'Anonymous'
                })
            });
            
            const data = await response.json();
            if (data.success) {
                loadStats();
                loadHistory();
            }
        } catch (error) {
            console.error('Error saving game:', error);
        }
    }

    // Generate random round hash
    function generateRoundHash() {
        return 'plinko_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    }

    function finalizeGame(ball) {
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const segment = canvas.width / multipliers.length;
        let slotIndex = Math.floor(ball.x / segment);
        slotIndex = Math.min(Math.max(slotIndex, 0), multipliers.length - 1);
        
        const multiplier = multipliers[slotIndex];
        const winAmount = Math.floor(ball.bet * multiplier);
        const roundHash = generateRoundHash();
        
        animateSlot(slotIndex);
        
        // Animate ball drop result
        const resultDiv = document.getElementById('resultDisplay');
        const resultMultiplier = document.getElementById('resultMultiplier');
        const resultWin = document.getElementById('resultWin');
        
        resultDiv.style.display = 'block';
        resultMultiplier.textContent = `${multiplier}x`;
        resultWin.textContent = `Win: ${winAmount.toLocaleString()}`;
        
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
        
        saveGameResult(ball.bet, multiplier, winAmount, roundHash);
    }

    // Get Telegram user
    async function getTelegramUser() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            return window.Telegram.WebApp.initDataUnsafe.user;
        }
        return { id: 1, first_name: 'Guest', username: 'guest' };
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

    // Animasi slot saat bola jatuh
    function animateSlot(slotIndex) {
        const slots = document.querySelectorAll('.multiplier-slot');
        if (slots[slotIndex]) {
            slots[slotIndex].classList.add('active', 'pulse');
            
            setTimeout(() => {
                slots[slotIndex].classList.remove('active', 'pulse');
            }, 800);
        }
    }

    // Drop Ball (Dipicu Tombol)
    async function playGame() {
        const betAmount = parseInt(document.getElementById('betAmount').value);
        if (isNaN(betAmount) || betAmount < 100) {
            alert('Minimal taruhan 100');
            return;
        }

        balls.push({
            x: spawnerX,
            y: 25,
            vx: (Math.random() - 0.5) * 1,
            vy: 0,
            bet: betAmount
        });
    }

    // Fungsi untuk menentukan slot multiplier berdasarkan posisi X bola
    function getMultiplierFromPosition(x) {
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const segment = canvas.width / multipliers.length;
        let slotIndex = Math.floor(x / segment);
        slotIndex = Math.min(Math.max(slotIndex, 0), multipliers.length - 1);
        return {
            index: slotIndex,
            multiplier: multipliers[slotIndex]
        };
    }

    // Ganti fungsi finalizeGame
    function finalizeGame(ball) {
        // Cek apakah bola sudah melewati batas bawah multiplier slots
        const multiplierWrapper = document.querySelector('.multiplier-slots-wrapper');
        const wrapperRect = multiplierWrapper?.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        // Konversi posisi bola ke koordinat relatif canvas
        const ballScreenY = canvasRect.top + ball.y;
        const wrapperTopY = wrapperRect?.top || 0;
        
        // Bola dianggap valid jika sudah melewati posisi Y multiplier wrapper
        // atau sudah mencapai batas bawah canvas
        if (ball.y >= canvas.height - 20) {
            const result = getMultiplierFromPosition(ball.x);
            
            const winAmount = Math.floor(ball.bet * result.multiplier);
            const roundHash = generateRoundHash();
            
            animateSlot(result.index);
            
            // Tampilkan hasil
            const resultDiv = document.getElementById('resultDisplay');
            const resultMultiplier = document.getElementById('resultMultiplier');
            const resultWin = document.getElementById('resultWin');
            
            resultDiv.style.display = 'block';
            resultMultiplier.textContent = `${result.multiplier}x`;
            resultWin.textContent = `Win: ${winAmount.toLocaleString()}`;
            
            if (result.multiplier >= 5) {
                resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
                resultDiv.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            } else if (result.multiplier >= 2) {
                resultDiv.style.background = 'rgba(245, 158, 11, 0.2)';
                resultDiv.style.borderColor = 'rgba(245, 158, 11, 0.5)';
            } else {
                resultDiv.style.background = 'rgba(16, 185, 129, 0.2)';
                resultDiv.style.borderColor = 'rgba(16, 185, 129, 0.5)';
            }
            
            setTimeout(() => {
                resultDiv.style.display = 'none';
            }, 3000);
            
            saveGameResult(ball.bet, result.multiplier, winAmount, roundHash);
            return true;
        }
        return false;
    }

    // Fungsi untuk update area multiplier berdasarkan posisi di canvas
    function updateMultiplierAreas() {
        const wrapper = document.querySelector('.multiplier-slots-wrapper');
        if (!wrapper) return;
        
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
                // Batas bawah area multiplier (posisi Y)
                bottomY: canvas.height - 15
            });
        }
    }

    // Fungsi untuk cek tabrakan dengan dinding pemisah multiplier
    function checkMultiplierWalls(ball) {
        if (ball.y < canvas.height - 80) return false; // Hanya cek di area bawah
        
        const wrapper = document.querySelector('.multiplier-slots-wrapper');
        if (!wrapper) return false;
        
        const wrapperRect = wrapper.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        const leftWall = wrapperRect.left - canvasRect.left;
        const rightWall = wrapperRect.right - canvasRect.left;
        
        let hit = false;
        
        // Cek tabrakan dengan dinding kiri
        if (ball.x - BALL_RADIUS < leftWall && ball.vx < 0) {
            ball.x = leftWall + BALL_RADIUS;
            ball.vx *= -BOUNCE;
            hit = true;
        }
        
        // Cek tabrakan dengan dinding kanan
        if (ball.x + BALL_RADIUS > rightWall && ball.vx > 0) {
            ball.x = rightWall - BALL_RADIUS;
            ball.vx *= -BOUNCE;
            hit = true;
        }
        
        return hit;
    }

    // Fungsi untuk cek validasi bola masuk ke multiplier slot
    function checkMultiplierHit(ball) {
        // Hanya cek ketika bola sudah di area bawah
        if (ball.y + BALL_RADIUS < canvas.height - 40) return false;
        
        updateMultiplierAreas();
        
        for (const area of multiplierAreas) {
            // Cek apakah posisi X bola berada di dalam area multiplier
            if (ball.x >= area.x && ball.x <= area.x + area.width) {
                // Bola dianggap valid
                const winAmount = Math.floor(ball.bet * area.multiplier);
                const roundHash = generateRoundHash();
                
                // Animasi highlight slot
                animateSlot(area.index);
                
                // Tampilkan hasil
                const resultDiv = document.getElementById('resultDisplay');
                const resultMultiplier = document.getElementById('resultMultiplier');
                const resultWin = document.getElementById('resultWin');
                
                resultDiv.style.display = 'block';
                resultMultiplier.textContent = `${area.multiplier}x`;
                resultWin.textContent = `Win: ${winAmount.toLocaleString()}`;
                
                if (area.multiplier >= 5) {
                    resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
                    resultDiv.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                } else if (area.multiplier >= 2) {
                    resultDiv.style.background = 'rgba(245, 158, 11, 0.2)';
                    resultDiv.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                } else {
                    resultDiv.style.background = 'rgba(16, 185, 129, 0.2)';
                    resultDiv.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }
                
                setTimeout(() => {
                    resultDiv.style.display = 'none';
                }, 3000);
                
                saveGameResult(ball.bet, area.multiplier, winAmount, roundHash);
                return true; // Bola sudah diproses
            }
        }
        return false;
    }

    // Tambahkan fungsi ini di plinko_games.js setelah deklarasi variabel
    async function loadUserBalance() {
        try {
            const tg = window.Telegram.WebApp;
            const user = tg.initDataUnsafe?.user;
            
            if (!user || !user.id) {
                document.getElementById('userBalance').textContent = '0 TON';
                return 0;
            }
            
            const response = await fetch('/api/games/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: user.id,
                    username: user.username || '',
                    first_name: user.first_name || 'User'
                })
            });
            
            const data = await response.json();
            const balanceEl = document.getElementById('userBalance');
            
            if (data.success && balanceEl) {
                balanceEl.textContent = data.balance.toFixed(2) + ' TON';
                return data.balance;
            } else if (balanceEl) {
                balanceEl.textContent = '0 TON';
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) balanceEl.textContent = '0 TON';
        }
        return 0;
    }

    // Initialize
    async function init() {
        telegramUser = await getTelegramUser();
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
        
        // Risk buttons
        document.querySelectorAll('.risk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRisk = btn.dataset.risk;
                drawPlinkoBoard();
                renderMultiplierSlots();
            });
        });
        
        // Play button
        document.getElementById('playBtn').addEventListener('click', playGame);
        
        // Refresh button
        document.getElementById('refreshHistory').addEventListener('click', () => {
            loadStats();
            loadHistory();
        });
        
        await loadStats();
        await loadHistory();
        updateViewCount();
        renderMultiplierSlots();
        
        // Start animation loop
        update();

        console.log('✅ Plinko Games Ready');
    }
    
    init();
})();
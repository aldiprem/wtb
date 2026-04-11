// games/js/plinko_games.js - FULL WORKING VERSION
(function() {
    console.log('🎰 Plinko Games Initialized');

    const API_BASE = window.location.origin;
    let currentRisk = 'medium';
    let telegramUser = null;
    let canvas = null;
    let ctx = null;
    let animationId = null;

    let multiplierAreas = [];
    
    // PHYSICS VARIABLES
    let balls = [];
    const GRAVITY = 0.2;
    const BOUNCE = 0.4;
    const PIN_RADIUS = 4;
    const BALL_RADIUS = 6;
    
    let spawnerX = 0;
    let spawnerDir = 1;
    const spawnerSpeed = 0.8;

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
        if (viewsElement) viewsElement.textContent = viewCount;
    }

    // DRAW SPAWNER / DROPPER
    function drawSpawner() {
        ctx.fillStyle = '#334155';
        ctx.fillRect(spawnerX - 15, 0, 30, 20);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(spawnerX, 20, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(spawnerX, 18, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // DRAW PLINKO BOARD WITH PINS
    function drawPlinkoBoard() {
        if (!canvas || !ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        
        drawSpawner();

        const startY = 55;
        const rowSpacing = 28;
        const colSpacing = 26;
        const totalRows = 10;
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
                ctx.arc(x, y, PIN_RADIUS + 1, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
                ctx.fill();
                
                // Inner peg
                ctx.beginPath();
                ctx.arc(x, y, PIN_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                
                // Highlight
                ctx.beginPath();
                ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = '#FFF5CC';
                ctx.fill();
            }
        }
        
        // Draw side walls
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(10, h - 40);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w - 10, 0);
        ctx.lineTo(w - 10, h - 40);
        ctx.stroke();
    }

    // COLLISION DETECTION WITH PINS
    function handlePinCollisions(ball) {
        const startY = 55;
        const rowSpacing = 28;
        const colSpacing = 26;
        const totalRows = 10;
        
        for (let row = 0; row < totalRows; row++) {
            const y = startY + row * rowSpacing;
            const dotsInRow = 3 + row;
            const rowWidth = (dotsInRow - 1) * colSpacing;
            const rowStartX = (canvas.width / 2) - (rowWidth / 2);
            
            for (let col = 0; col < dotsInRow; col++) {
                const px = rowStartX + col * colSpacing;
                const py = y;
                const dx = ball.x - px;
                const dy = ball.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < BALL_RADIUS + PIN_RADIUS) {
                    const angle = Math.atan2(dy, dx);
                    const force = 2.5;
                    ball.vx += Math.cos(angle) * force;
                    ball.vy = Math.abs(ball.vy) * -BOUNCE;
                    
                    // Reposition to avoid stuck
                    const overlap = BALL_RADIUS + PIN_RADIUS - dist;
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                    
                    // Add small random factor
                    ball.vx += (Math.random() - 0.5) * 0.8;
                    
                    return true;
                }
            }
        }
        return false;
    }

    // WALL COLLISIONS
    function handleWallCollisions(ball) {
        const leftWall = 15;
        const rightWall = canvas.width - 15;
        
        if (ball.x - BALL_RADIUS < leftWall) {
            ball.x = leftWall + BALL_RADIUS;
            ball.vx = Math.abs(ball.vx) * 0.7;
        }
        if (ball.x + BALL_RADIUS > rightWall) {
            ball.x = rightWall - BALL_RADIUS;
            ball.vx = -Math.abs(ball.vx) * 0.7;
        }
    }

    // UPDATE MULTIPLIER AREAS FROM CANVAS POSITION
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
                bottomY: canvas.height - 25
            });
        }
    }

    // CHECK MULTIPLIER WALLS (BOUNDARIES BETWEEN SLOTS)
    function checkMultiplierWalls(ball) {
        if (ball.y < canvas.height - 70) return false;
        
        updateMultiplierAreas();
        
        for (let i = 0; i < multiplierAreas.length - 1; i++) {
            const wallX = multiplierAreas[i].x + multiplierAreas[i].width;
            
            if (Math.abs(ball.x - wallX) < BALL_RADIUS + 2) {
                if (ball.vx > 0 && ball.x > wallX) {
                    ball.x = wallX - BALL_RADIUS;
                    ball.vx = -Math.abs(ball.vx) * 0.5;
                } else if (ball.vx < 0 && ball.x < wallX) {
                    ball.x = wallX + BALL_RADIUS;
                    ball.vx = Math.abs(ball.vx) * 0.5;
                }
                return true;
            }
        }
        return false;
    }

    // CHECK IF BALL HITS MULTIPLIER SLOT
    function checkMultiplierHit(ball) {
        if (ball.y + BALL_RADIUS < canvas.height - 35) return false;
        
        updateMultiplierAreas();
        
        for (const area of multiplierAreas) {
            if (ball.x >= area.x && ball.x <= area.x + area.width) {
                finalizeGame(ball, area);
                return true;
            }
        }
        return false;
    }

    // ANIMATE SLOT HIGHLIGHT
    function animateSlot(slotIndex) {
        const slots = document.querySelectorAll('.multiplier-slot');
        if (slots[slotIndex]) {
            slots[slotIndex].classList.add('active', 'pulse');
            setTimeout(() => {
                slots[slotIndex].classList.remove('active', 'pulse');
            }, 600);
        }
    }

    // GENERATE ROUND HASH
    function generateRoundHash() {
        return 'plinko_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    }

    // SAVE GAME RESULT TO BACKEND
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

    // FINALIZE GAME - SHOW RESULT
    function finalizeGame(ball, area) {
        const winAmount = Math.floor(ball.bet * area.multiplier);
        const roundHash = generateRoundHash();
        
        animateSlot(area.index);
        
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
    }

    // ANIMATION LOOP
    function animate() {
        if (!canvas || !ctx) return;
        
        drawPlinkoBoard();
        
        // Move spawner
        const maxRange = 30;
        spawnerX += spawnerDir * spawnerSpeed;
        if (spawnerX > canvas.width / 2 + maxRange) spawnerDir = -1;
        if (spawnerX < canvas.width / 2 - maxRange) spawnerDir = 1;
        
        // Update balls
        for (let i = 0; i < balls.length; i++) {
            const ball = balls[i];
            
            // Apply gravity
            ball.vy += GRAVITY;
            ball.x += ball.vx;
            ball.y += ball.vy;
            
            // Check collisions
            handlePinCollisions(ball);
            handleWallCollisions(ball);
            checkMultiplierWalls(ball);
            
            // Check if hit multiplier slot
            let isHit = checkMultiplierHit(ball);
            
            // Draw ball
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ball.x - 1.5, ball.y - 1.5, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ff8888';
            ctx.fill();
            
            // Remove ball if out of bounds or hit
            if (ball.y > canvas.height + 50 || isHit) {
                balls.splice(i, 1);
                i--;
            }
        }
        
        animationId = requestAnimationFrame(animate);
    }

    // LOAD STATS FROM API
    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/stats`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('biggestWin').textContent = `${data.biggest_multiplier || 0}x`;
                document.getElementById('lastPlayer').textContent = data.last_player || '-';
                document.getElementById('lastTime').textContent = data.last_time || '-';
                document.getElementById('roundHash').textContent = data.current_hash ? data.current_hash.substring(0, 12) + '...' : '-';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // LOAD HISTORY FROM API
    async function loadHistory() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/history`);
            const data = await response.json();
            
            const tbody = document.getElementById('historyBody');
            
            if (!data.success || !data.history || data.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Belum ada riwayat</td></tr>';
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

    // GET TELEGRAM USER
    async function getTelegramUser() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            return window.Telegram.WebApp.initDataUnsafe.user;
        }
        return { id: 1, first_name: 'Guest', username: 'guest' };
    }

    // RENDER MULTIPLIER SLOTS UI
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
            html += `<div class="multiplier-slot ${riskClass}" data-index="${i}" data-multiplier="${mult}">${displayValue}</div>`;
        }
        wrapper.innerHTML = html;
    }

    // PLAY GAME - DROP BALL
    async function playGame() {
        const betAmount = parseInt(document.getElementById('betAmount').value);
        if (isNaN(betAmount) || betAmount < 100) {
            alert('Minimal taruhan 100');
            return;
        }
        
        balls.push({
            x: spawnerX,
            y: 20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 2,
            bet: betAmount
        });
    }

    // RESIZE CANVAS
    function resizeCanvas() {
        if (!canvas) return;
        const container = canvas.parentElement;
        const maxWidth = Math.min(container.clientWidth, 500);
        canvas.width = maxWidth;
        canvas.height = 380;
        spawnerX = canvas.width / 2;
        drawPlinkoBoard();
        updateMultiplierAreas();
    }

    // INITIALIZE
    async function init() {
        telegramUser = await getTelegramUser();
        
        canvas = document.getElementById('plinkoCanvas');
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }
        ctx = canvas.getContext('2d');
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Risk buttons
        document.querySelectorAll('.risk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRisk = btn.dataset.risk;
                renderMultiplierSlots();
                drawPlinkoBoard();
                updateMultiplierAreas();
            });
        });
        
        // Play button
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.addEventListener('click', playGame);
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshHistory');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadStats();
                loadHistory();
            });
        }
        
        await loadStats();
        await loadHistory();
        updateViewCount();
        renderMultiplierSlots();
        
        // Start animation
        animate();
        
        console.log('✅ Plinko Games Ready');
    }
    
    init();
})();
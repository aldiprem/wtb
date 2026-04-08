// games/js/plinko_games.js
(function() {
    console.log('🎰 Plinko Games Initialized');

    const API_BASE = window.location.origin;
    let currentRisk = 'medium';
    let telegramUser = null;
    let animationFrame = null;
    let canvas = null;
    let ctx = null;
    let balls = [];
    let spawnerX = 0;
    let spawnerDir = 1;
    const GRAVITY = 0.15;
    const BOUNCE = 0.4;
    const FRICTION = 0.98;

    const RISK_MULTIPLIERS = {
        low: [5, 4, 3, 2, 1, 0.5, 1, 2, 3, 4, 5],
        medium: [15, 10, 5, 2.5, 1, 0.2, 1, 2.5, 5, 10, 15],
        high: [20, 10, 5, 1.5, 0.8, 0.5, 0.1, 0.0, 0.1, 0.5, 0.8, 1,5, 5, 10, 20]
    };

    let viewCount = parseInt(localStorage.getItem('plinko_views') || '0');

    function updateViewCount() {
        // Cek apakah user sudah di-count di session ini
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

    function drawPlinkoBoard() {
        if (!canvas || !ctx) return;
        
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        
        const startY = 50;       // Vertical starting position
        const rowSpacing = 28;   // Vertical distance between rows
        const colSpacing = 26;   // Horizontal distance between pegs
        const totalRows = 9;     // As per your visual example (3 dots to 11 dots)
        const initialDots = 3;   // Starting number of dots at the top row

        for (let row = 0; row < totalRows; row++) {
            const y = startY + row * rowSpacing;
            const dotsInRow = initialDots + row; // Row 0: 3, Row 1: 4, etc.
            
            // Calculate the starting X for this row to keep it centered
            // Formula: (Canvas Width / 2) - ((Total Width of Dots in Row) / 2)
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

    // Load stats from API
    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE}/api/plinko/stats`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('totalPlayers').textContent = data.total_players || 0;
                document.getElementById('biggestWin').textContent = `${data.biggest_multiplier || 0}x`;
                document.getElementById('lastPlayer').textContent = data.last_player || '-';
                document.getElementById('lastTime').textContent = data.last_time || '-';
                document.getElementById('roundHash').textContent = data.current_hash ? data.current_hash.substring(0, 12) + '...' : '-';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Load history
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

    // Play game
    async function playGame() {
        const betAmount = parseInt(document.getElementById('betAmount').value);
        
        if (isNaN(betAmount) || betAmount < 100) {
            alert('Minimal taruhan 100');
            return;
        }
        
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const randomIndex = Math.floor(Math.random() * multipliers.length);
        const multiplier = multipliers[randomIndex];
        const winAmount = Math.floor(betAmount * multiplier);
        const roundHash = generateRoundHash();

        animateSlot(randomIndex);
        
        // Animate ball drop
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
        
        // Save to database
        await saveGameResult(betAmount, multiplier, winAmount, roundHash);
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
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
            
            // Sesuai dengan class di CSS: low, medium, high, zero
            if (mult >= 5) riskClass = 'high';
            else if (mult >= 2) riskClass = 'medium';
            else if (mult >= 1) riskClass = 'low';
            else riskClass = 'zero';
            
            // Bulatkan angka desimal ke 1 digit kalo perlu
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
            
            // Hapus class setelah animasi selesai
            setTimeout(() => {
                slots[slotIndex].classList.remove('active', 'pulse');
            }, 800);
        }
    }

    // Fungsi Animasi Utama (Loop)
    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPlinkoBoard();
        drawSpawner();

        // Update & Draw Balls
        balls.forEach((ball, index) => {
            ball.vy += GRAVITY;
            ball.x += ball.vx;
            ball.y += ball.vy;
            ball.vx *= FRICTION;

            // Collision dengan Pin
            checkPinCollision(ball);

            // Gambar Bola
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ff4757';
            ctx.fill();

            // Cek jika sampai bawah (Multiplier)
            if (ball.y > canvas.height - 20) {
                handleBallLand(ball);
                balls.splice(index, 1);
            }
        });

        // Update Spawner Position (Bergerak di antara 3 titik atas)
        const range = 30; // Jarak gerak kanan-kiri
        spawnerX += spawnerDir * 0.8;
        if (Math.abs(spawnerX - canvas.width / 2) > range) {
            spawnerDir *= -1;
        }

        requestAnimationFrame(update);
    }

    function drawSpawner() {
        ctx.fillStyle = '#333';
        ctx.fillRect(spawnerX - 15, 0, 30, 20); // Cerobong
        ctx.beginPath();
        ctx.arc(spawnerX, 20, 10, 0, Math.PI);
        ctx.fill();
    }

    function checkPinCollision(ball) {
        // Logika sederhana deteksi tabrakan dengan titik-titik pin
        // Anda perlu menyimpan koordinat pin dalam array saat drawPlinkoBoard()
        // Untuk performa, kita gunakan perhitungan matematis berdasarkan row/col
        const rowSpacing = 28;
        const colSpacing = 26;
        const startY = 50;
        
        // Prediksi baris mana bola berada
        const row = Math.floor((ball.y - startY) / rowSpacing);
        if (row >= 0 && row < 15) {
            const dotsInRow = 3 + row;
            const rowWidth = (dotsInRow - 1) * colSpacing;
            const rowStartX = (canvas.width / 2) - (rowWidth / 2);
            
            for (let col = 0; col < dotsInRow; col++) {
                const pinX = rowStartX + col * colSpacing;
                const pinY = startY + row * rowSpacing;
                
                const dx = ball.x - pinX;
                const dy = ball.y - pinY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 7) { // 7 = radius pin (2) + radius bola (4) + buffer
                    const angle = Math.atan2(dy, dx);
                    ball.vx += Math.cos(angle) * 2; // Pantulan ke samping
                    ball.vy *= -BOUNCE; // Pantulan ke atas (melambat)
                    
                    // Cegah bola nempel di pin
                    ball.x = pinX + Math.cos(angle) * 7;
                    ball.y = pinY + Math.sin(angle) * 7;
                }
            }
        }
    }

    // Fungsi saat tombol "Drop Ball" diklik
    async function playGame() {
        const betAmount = parseInt(document.getElementById('betAmount').value);
        if (isNaN(betAmount) || betAmount < 100) return alert('Minimal 100');

        // Tambahkan bola baru ke sistem physics
        balls.push({
            x: spawnerX,
            y: 20,
            vx: (Math.random() - 0.5) * 1, // Sedikit variasi arah awal
            vy: 0,
            bet: betAmount
        });
    }

    function handleBallLand(ball) {
        // Hitung index slot berdasarkan posisi X terakhir bola
        const multipliers = RISK_MULTIPLIERS[currentRisk];
        const sectionWidth = canvas.width / multipliers.length;
        const index = Math.floor(ball.x / sectionWidth);
        const safeIndex = Math.max(0, Math.min(index, multipliers.length - 1));
        
        const multiplier = multipliers[safeIndex];
        const winAmount = Math.floor(ball.bet * multiplier);
        
        animateSlot(safeIndex);
        showResult(multiplier, winAmount);
        saveGameResult(ball.bet, multiplier, winAmount, generateRoundHash());
    }

    // Initialize
    async function init() {
        telegramUser = await getTelegramUser();
        
        canvas = document.getElementById('plinkoCanvas');
        ctx = canvas.getContext('2d');
        
        function resizeCanvas() {
            const container = canvas.parentElement;
            const width = container.clientWidth;
            canvas.width = Math.min(width, 800);
            
            // Change from 500 to 350 (or whatever fits your 9 rows)
            canvas.height = 350; 
            
            drawPlinkoBoard();
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
        requestAnimationFrame(update);

        console.log('✅ Plinko Games Ready');
    }
    
    init();
})();
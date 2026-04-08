// games/js/plinko_games.js
(function() {
    console.log('🎰 Plinko Games Initialized');

    const API_BASE = window.location.origin;
    let currentRisk = 'medium';
    let telegramUser = null;
    let animationFrame = null;
    let canvas = null;
    let ctx = null;

    // Risk multipliers
    const RISK_MULTIPLIERS = {
        low: [1.2, 1.5, 2, 2.5, 3, 2.5, 2, 1.5, 1.2],
        medium: [0.8, 1.2, 2, 3, 5, 3, 2, 1.2, 0.8],
        high: [0.5, 0.8, 1.5, 3, 10, 3, 1.5, 0.8, 0.5]
    };

    // Draw Plinko board
    function drawPlinkoBoard() {
        if (!canvas || !ctx) return;
        
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        
        // Draw pegs
        const rows = 12;
        const cols = 9;
        const startX = w / 2;
        const startY = 60;
        const spacingX = w / (cols + 1);
        const spacingY = (h - 120) / rows;
        
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 0;
        
        for (let row = 0; row <= rows; row++) {
            const y = startY + row * spacingY;
            const offsetX = (row % 2 === 0) ? 0 : spacingX / 2;
            
            for (let col = 0; col < cols; col++) {
                const x = startX - (cols / 2) * spacingX + col * spacingX + offsetX;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            }
        }
        
        // Draw slots at bottom
        const slotY = h - 50;
        const slotWidth = w / (RISK_MULTIPLIERS[currentRisk].length);
        
        for (let i = 0; i < RISK_MULTIPLIERS[currentRisk].length; i++) {
            const x = i * slotWidth;
            const mult = RISK_MULTIPLIERS[currentRisk][i];
            
            ctx.fillStyle = mult >= 5 ? 'rgba(239, 68, 68, 0.3)' : 
                           mult >= 2 ? 'rgba(245, 158, 11, 0.3)' : 
                           'rgba(16, 185, 129, 0.3)';
            ctx.fillRect(x, slotY, slotWidth, 40);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`${mult}x`, x + slotWidth / 2, slotY + 25);
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

    // Initialize
    async function init() {
        telegramUser = await getTelegramUser();
        
        canvas = document.getElementById('plinkoCanvas');
        ctx = canvas.getContext('2d');
        
        function resizeCanvas() {
            const container = canvas.parentElement;
            const width = container.clientWidth;
            canvas.width = Math.min(width, 800);
            canvas.height = 500;
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
        
        console.log('✅ Plinko Games Ready');
    }
    
    init();
})();
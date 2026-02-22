// Inisialisasi Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 15, 20);
camera.lookAt(5, 0, 5);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(5, 2, 5);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
scene.add(directionalLight);

// Grid and ground
const gridHelper = new THREE.GridHelper(20, 20, 0xaaaaaa, 0x444444);
scene.add(gridHelper);

// Game variables
const GRID_SIZE = 10; // 10x10 grid
const BLOCK_SIZE = 1;
const TOTAL_BLOCKS = GRID_SIZE * GRID_SIZE * GRID_SIZE; // 1000 blocks

let blocks = [];
let blockPositions = [];
let blocksPlaced = 0;
let gameActive = true;
let gameWon = false;
let buildSpeed = 1; // blocks per second
let lastBuildTime = 0;
let startTime = Date.now();
let likeCount = 0;
let giftCount = 0;

// Initialize empty 3D array
for (let x = 0; x < GRID_SIZE; x++) {
    blockPositions[x] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        blockPositions[x][y] = [];
        for (let z = 0; z < GRID_SIZE; z++) {
            blockPositions[x][y][z] = false;
        }
    }
}

// Create boundary walls
function createBoundaries() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
    
    // Bottom floor
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(GRID_SIZE, 0.1, GRID_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    floor.position.set(GRID_SIZE/2 - 0.5, -0.05, GRID_SIZE/2 - 0.5);
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Walls (semi-transparent)
    const wallHeight = GRID_SIZE;
    
    // Back wall
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(GRID_SIZE, wallHeight, 0.1),
        wallMaterial
    );
    backWall.position.set(GRID_SIZE/2 - 0.5, wallHeight/2 - 0.5, -0.05);
    scene.add(backWall);
    
    // Front wall
    const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(GRID_SIZE, wallHeight, 0.1),
        wallMaterial
    );
    frontWall.position.set(GRID_SIZE/2 - 0.5, wallHeight/2 - 0.5, GRID_SIZE - 0.95);
    scene.add(frontWall);
    
    // Left wall
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, wallHeight, GRID_SIZE),
        wallMaterial
    );
    leftWall.position.set(-0.05, wallHeight/2 - 0.5, GRID_SIZE/2 - 0.5);
    scene.add(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, wallHeight, GRID_SIZE),
        wallMaterial
    );
    rightWall.position.set(GRID_SIZE - 0.95, wallHeight/2 - 0.5, GRID_SIZE/2 - 0.5);
    scene.add(rightWall);
}

createBoundaries();

// Create block with random texture-like color
function createBlock(x, y, z) {
    // Minecraft-like colors
    const colors = [
        0x8B6B4D, // Dirt
        0x7C7C7C, // Stone
        0x2D2D2D, // Coal
        0x5A7C5A, // Grass
        0x4A4A4A, // Cobblestone
        0x8B8B8B, // Iron
        0xF0E68C  // Gold-ish
    ];
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const block = new THREE.Mesh(geometry, material);
    
    block.position.set(x, y, z);
    block.castShadow = true;
    block.receiveShadow = true;
    
    // Add wireframe for fun
    if (Math.random() > 0.8) {
        const wireframe = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        block.add(wireframe);
    }
    
    return block;
}

// Find next position to place block
function findNextBlockPosition() {
    // Simple spiral pattern: fill from bottom up, layer by layer
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let z = 0; z < GRID_SIZE; z++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!blockPositions[x][y][z]) {
                    return { x, y, z };
                }
            }
        }
    }
    return null; // Full
}

// Place a block
function placeBlock() {
    if (!gameActive || gameWon) return false;
    
    const pos = findNextBlockPosition();
    if (!pos) {
        // Game won!
        gameWon = true;
        showVictory();
        return false;
    }
    
    const block = createBlock(pos.x, pos.y + 0.5, pos.z); // +0.5 to center
    scene.add(block);
    blocks.push(block);
    blockPositions[pos.x][pos.y][pos.z] = true;
    blocksPlaced++;
    
    updateUI();
    return true;
}

// Victory sequence
function showVictory() {
    gameActive = false;
    gameWon = true;
    
    const overlay = document.getElementById('victory-overlay');
    const countdownEl = document.getElementById('victory-countdown');
    const countdownNum = document.getElementById('countdown-number');
    const victoryBlocks = document.getElementById('victory-blocks');
    const victoryTime = document.getElementById('victory-time');
    const victoryLikes = document.getElementById('victory-likes');
    
    victoryBlocks.textContent = blocksPlaced;
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    victoryTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    victoryLikes.textContent = likeCount;
    
    overlay.style.display = 'flex';
    
    let countdown = 5;
    countdownEl.textContent = countdown;
    countdownNum.textContent = countdown;
    
    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        countdownNum.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(interval);
            resetGame();
            overlay.style.display = 'none';
        }
    }, 1000);
}

// Reset game
function resetGame() {
    // Remove all blocks
    blocks.forEach(block => scene.remove(block));
    blocks = [];
    
    // Reset positions
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                blockPositions[x][y][z] = false;
            }
        }
    }
    
    blocksPlaced = 0;
    gameActive = true;
    gameWon = false;
    startTime = Date.now();
    
    updateUI();
}

// Update UI
function updateUI() {
    document.getElementById('total-blocks').textContent = TOTAL_BLOCKS;
    document.getElementById('blocks-placed').textContent = blocksPlaced;
    
    const percent = ((blocksPlaced / TOTAL_BLOCKS) * 100).toFixed(1);
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-percent').textContent = percent + '%';
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('time-elapsed').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// TikTok Simulation Functions
function simulateLike() {
    likeCount++;
    document.getElementById('like-count').textContent = likeCount;
    
    // Every 1000 likes = speed boost
    if (likeCount % 1000 === 0) {
        buildSpeed += 0.5;
        showAlert(`🚀 SPEED BOOST! Kecepatan: ${buildSpeed}x`, '#44ff44');
    }
    
    // Every 5000 likes = reset
    if (likeCount % 5000 === 0 && likeCount > 0) {
        showAlert('💥 RESET DIPICU! Game akan restart...', '#ff4444');
        setTimeout(() => resetGame(), 2000);
    }
}

function simulateGift(isBig = false) {
    giftCount++;
    document.getElementById('gift-count').textContent = giftCount;
    
    if (isBig) {
        showAlert('🎉 HADIAH BESAR! INSTANT WIN!', 'gold');
        
        // Fill all remaining blocks instantly
        while (blocksPlaced < TOTAL_BLOCKS) {
            placeBlock();
        }
    } else {
        showAlert('🎁 Hadiah Kecil! Block Random!', '#ffaa00');
        // Place 5 random blocks
        for (let i = 0; i < 5; i++) {
            placeBlock();
        }
    }
}

function showAlert(message, color) {
    const alertEl = document.getElementById('tiktok-alert');
    alertEl.textContent = message;
    alertEl.style.color = color;
    
    setTimeout(() => {
        alertEl.textContent = '';
    }, 3000);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const now = Date.now() / 1000; // in seconds
    
    // Auto build
    if (gameActive && !gameWon) {
        if (now - lastBuildTime > 1 / buildSpeed) {
            placeBlock();
            lastBuildTime = now;
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}

animate();

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Simulate TikTok interactions (for testing)
setInterval(() => {
    if (Math.random() > 0.7) {
        simulateLike();
    }
}, 3000);

setInterval(() => {
    if (Math.random() > 0.9) {
        simulateGift(Math.random() > 0.8);
    }
}, 5000);

// Manual controls for testing (you can remove in production)
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        resetGame();
    } else if (e.key === 'l' || e.key === 'L') {
        simulateLike();
    } else if (e.key === 'g' || e.key === 'G') {
        simulateGift(false);
    } else if (e.key === 'b' || e.key === 'B') {
        simulateGift(true);
    }
});

// Initialize UI
updateUI();
console.log('Game initialized! Grid size:', GRID_SIZE, 'Total blocks:', TOTAL_BLOCKS);

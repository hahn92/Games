const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const COLORS = [
    '#8fd3f4', '#ff512f', '#ffe082', '#dd2476', '#5ec2e6', '#f44336', '#26d0ce'
];
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let current, next, score = 0, highScore = localStorage.getItem('tetrisHighScore') || 0;
let gameInterval, speed = 500, isPlaying = false;

// Partículas al limpiar líneas
let lineParticles = [];

// Flash de líneas completas
let flashLines = [];   // índices de filas en flash
let flashTimer = 0;    // frames restantes de flash
const FLASH_FRAMES = 6;
let pendingClearLines = []; // filas a eliminar después del flash

const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,1,0],[0,1,1]], // S
    [[0,1,1],[1,1,0]], // Z
    [[1,0,0],[1,1,1]], // J
    [[0,0,1],[1,1,1]]  // L
];

// Helpers para color con brillo ajustado
function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));
    return `rgb(${r},${g},${b})`;
}

// Dibuja un bloque con efecto 3D (biselado)
function drawBlock3D(px, py, color, alpha) {
    alpha = alpha !== undefined ? alpha : 1;
    const b = 3; // grosor del borde 3D
    const x = px * BLOCK_SIZE;
    const y = py * BLOCK_SIZE;
    const s = BLOCK_SIZE;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Cara base
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);

    // Cara superior más clara
    ctx.fillStyle = adjustColor(color, 70);
    ctx.fillRect(x, y, s, b);

    // Cara izquierda más clara
    ctx.fillStyle = adjustColor(color, 40);
    ctx.fillRect(x, y, b, s);

    // Cara derecha más oscura
    ctx.fillStyle = adjustColor(color, -40);
    ctx.fillRect(x + s - b, y, b, s);

    // Cara inferior más oscura
    ctx.fillStyle = adjustColor(color, -60);
    ctx.fillRect(x, y + s - b, s, b);

    // Borde muy oscuro exterior
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

    ctx.restore();
}

// Calcula la posición ghost de la pieza actual
function getGhostY() {
    if (!current) return null;
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) {
        gy++;
    }
    return gy;
}

// Spawnea partículas desde una fila
function spawnLineParticles(row) {
    const count = 18;
    for (let i = 0; i < count; i++) {
        const cx = (Math.random() * COLS) * BLOCK_SIZE;
        const cy = row * BLOCK_SIZE + BLOCK_SIZE / 2;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const speed = 2 + Math.random() * 4;
        const colorIdx = Math.floor(Math.random() * COLORS.length);
        lineParticles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.025 + Math.random() * 0.02,
            size: 3 + Math.random() * 4,
            color: COLORS[colorIdx]
        });
    }
}

function updateLineParticles() {
    for (let i = lineParticles.length - 1; i >= 0; i--) {
        const p = lineParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= p.decay;
        if (p.life <= 0) {
            lineParticles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 4;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

function drawBoard() {
    // Fondo con degradado oscuro
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0d0d0d');
    bgGrad.addColorStop(1, '#141414');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid sutil
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= COLS; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * BLOCK_SIZE, 0);
        ctx.lineTo(gx * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let gy = 0; gy <= ROWS; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * BLOCK_SIZE);
        ctx.lineTo(canvas.width, gy * BLOCK_SIZE);
        ctx.stroke();
    }
    ctx.restore();

    // Dibuja el tablero fijo
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                const color = COLORS[board[y][x] - 1];
                // Flash de línea completa
                if (flashLines.includes(y)) {
                    const flashPhase = Math.floor(flashTimer / 1) % 2;
                    drawBlock3D(x, y, flashPhase === 0 ? '#ffffff' : color);
                } else {
                    drawBlock3D(x, y, color);
                }
            }
        }
    }

    // Ghost piece
    if (current) {
        const ghostY = getGhostY();
        if (ghostY !== current.y) {
            const ghostColor = COLORS[current.color];
            for (let y = 0; y < current.shape.length; y++) {
                for (let x = 0; x < current.shape[y].length; x++) {
                    if (current.shape[y][x]) {
                        const bx = (current.x + x) * BLOCK_SIZE;
                        const by = (ghostY + y) * BLOCK_SIZE;
                        ctx.save();
                        ctx.globalAlpha = 0.2;
                        ctx.strokeStyle = ghostColor;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                        ctx.restore();
                    }
                }
            }
        }
    }

    // Pieza activa con glow
    if (current) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = COLORS[current.color];
        for (let y = 0; y < current.shape.length; y++) {
            for (let x = 0; x < current.shape[y].length; x++) {
                if (current.shape[y][x]) {
                    drawBlock3D(current.x + x, current.y + y, COLORS[current.color]);
                }
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Dibuja partículas de líneas
    updateLineParticles();
}

function randomPiece() {
    const type = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[type],
        x: Math.floor(COLS/2) - Math.ceil(SHAPES[type][0].length/2),
        y: 0,
        color: type
    };
}

function collide(shape, x, y) {
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                let nx = x + j, ny = y + i;
                if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) return true;
            }
        }
    }
    return false;
}

function merge() {
    for (let y = 0; y < current.shape.length; y++) {
        for (let x = 0; x < current.shape[y].length; x++) {
            if (current.shape[y][x]) {
                board[current.y + y][current.x + x] = current.color + 1;
            }
        }
    }
}

function clearLines() {
    let rowsToClear = [];
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell)) {
            rowsToClear.push(y);
        }
    }
    if (rowsToClear.length === 0) return;

    // Spawnea partículas para cada fila antes del flash
    rowsToClear.forEach(row => spawnLineParticles(row));

    // Activa el flash
    flashLines = rowsToClear;
    flashTimer = FLASH_FRAMES;
    pendingClearLines = rowsToClear;

    // Dibuja inmediatamente el flash
    drawBoard();
}

// Ejecuta la eliminación real de filas (después del flash)
function executeClearLines() {
    const lines = pendingClearLines.length;

    // Eliminar filas de mayor a menor índice para no alterar índices
    pendingClearLines.sort((a, b) => b - a);
    pendingClearLines.forEach(row => {
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(0));
    });

    flashLines = [];
    pendingClearLines = [];

    score += lines * 100;
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    // Aumenta la velocidad
    speed = Math.max(100, speed - lines * 20);
    clearInterval(gameInterval);
    gameInterval = setInterval(tick, speed);
}

function tick() {
    if (!current) return;

    // Si hay flash activo, decrementar y esperar
    if (flashTimer > 0) {
        flashTimer--;
        drawBoard();
        if (flashTimer === 0) {
            executeClearLines();
            current = next;
            next = randomPiece();
            if (collide(current.shape, current.x, current.y)) {
                gameOver();
                return;
            }
        }
        return;
    }

    // Si hay líneas pendientes de limpiar, esperar
    if (pendingClearLines.length > 0) return;

    if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
    } else {
        merge();
        clearLines();
        // Si no hubo líneas que limpiar, avanza a la siguiente pieza
        if (flashTimer === 0 && pendingClearLines.length === 0) {
            current = next;
            next = randomPiece();
            if (collide(current.shape, current.x, current.y)) {
                gameOver();
                return;
            }
        }
    }
    drawBoard();
}

function rotate() {
    let newShape = current.shape[0].map((_, i) => current.shape.map(row => row[i])).reverse();
    if (!collide(newShape, current.x, current.y)) current.shape = newShape;
    drawBoard();
}

function move(dx) {
    if (!collide(current.shape, current.x + dx, current.y)) {
        current.x += dx;
        drawBoard();
    }
}

function drop() {
    while (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
    }
    tick();
}

function startGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    speed = 500;
    lineParticles = [];
    flashLines = [];
    flashTimer = 0;
    pendingClearLines = [];
    current = randomPiece();
    next = randomPiece();
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    document.getElementById('highScore').textContent = highScore;
    drawBoard();
    clearInterval(gameInterval);
    gameInterval = setInterval(tick, speed);
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
}

function restartGame() {
    startGame();
}

function gameOver() {
    clearInterval(gameInterval);
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    isPlaying = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Controles táctiles
document.getElementById('btnRotate').addEventListener('click', () => isPlaying && rotate());
document.getElementById('btnLeft').addEventListener('click', () => isPlaying && move(-1));
document.getElementById('btnRight').addEventListener('click', () => isPlaying && move(1));
document.getElementById('btnDown').addEventListener('click', () => isPlaying && tick());

window.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Space"].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'ArrowDown') tick();
    if (e.key === 'ArrowUp') rotate();
    if (e.key === ' ' || e.key === 'Space') drop();
});

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
drawBoard();

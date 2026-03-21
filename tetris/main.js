const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const COLORS = [
    '#8fd3f4', '#ff512f', '#ffe082', '#dd2476', '#5ec2e6', '#f44336', '#26d0ce'
];

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let current, next, holdPiece = null;
let score = 0, highScore = localStorage.getItem('tetrisHighScore') || 0;
let gameInterval, speed = 500, isPlaying = false;
let totalLines = 0, level = 1;
let canHold = true;

// --- Combo ---
let combo = 0;
let comboMessage = null; // { text, y, life }

// Partículas al limpiar líneas
let lineParticles = [];

// Flash de líneas completas
let flashLines = [];
let flashTimer = 0;
const FLASH_FRAMES = 6;
let pendingClearLines = [];

// Paneles laterales (dibujados en el canvas, a la derecha del tablero)
// El canvas es 320×640. El tablero ocupa 10×32=320px de ancho, exactamente todo.
// Dibujamos paneles encima del tablero como overlays (esquinas).
const PANEL_W = 80;
const PANEL_H = 70;

const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,1,0],[0,1,1]], // S
    [[0,1,1],[1,1,0]], // Z
    [[1,0,0],[1,1,1]], // J
    [[0,0,1],[1,1,1]]  // L
];

// Puntuación estándar Tetris
const LINE_SCORES = [0, 100, 300, 500, 800];

function scoreForLines(n) {
    return (LINE_SCORES[n] || 0) * level;
}

function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));
    return `rgb(${r},${g},${b})`;
}

function drawBlock3D(px, py, color, alpha) {
    alpha = alpha !== undefined ? alpha : 1;
    const b = 3;
    const x = px * BLOCK_SIZE;
    const y = py * BLOCK_SIZE;
    const s = BLOCK_SIZE;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = adjustColor(color, 70);
    ctx.fillRect(x, y, s, b);
    ctx.fillStyle = adjustColor(color, 40);
    ctx.fillRect(x, y, b, s);
    ctx.fillStyle = adjustColor(color, -40);
    ctx.fillRect(x + s - b, y, b, s);
    ctx.fillStyle = adjustColor(color, -60);
    ctx.fillRect(x, y + s - b, s, b);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.restore();
}

// Dibuja mini-bloque para paneles de hold/next en el canvas principal
function drawMiniBlock3D(px, py, color, size, offX, offY) {
    const b = 2;
    const x = offX + px * size;
    const y = offY + py * size;
    const s = size;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = adjustColor(color, 60);
    ctx.fillRect(x, y, s, b);
    ctx.fillStyle = adjustColor(color, 30);
    ctx.fillRect(x, y, b, s);
    ctx.fillStyle = adjustColor(color, -40);
    ctx.fillRect(x + s - b, y, b, s);
    ctx.fillStyle = adjustColor(color, -55);
    ctx.fillRect(x, y + s - b, s, b);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.restore();
}

// Dibuja un panel de pieza (hold / next) como overlay en el canvas
function drawPiecePanel(shape, colorIdx, panelX, panelY, label) {
    ctx.save();
    // Fondo del panel
    ctx.fillStyle = 'rgba(10,10,20,0.82)';
    ctx.strokeStyle = 'rgba(143,211,244,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, PANEL_W, PANEL_H, 6);
    ctx.fill();
    ctx.stroke();

    // Etiqueta
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#8fd3f4';
    ctx.textAlign = 'center';
    ctx.fillText(label, panelX + PANEL_W / 2, panelY + 13);

    if (shape) {
        const cols = shape[0].length;
        const rowsS = shape.length;
        const blockSz = Math.min(Math.floor((PANEL_W - 16) / cols), Math.floor((PANEL_H - 24) / rowsS), 18);
        const offX = panelX + Math.floor((PANEL_W - cols * blockSz) / 2);
        const offY = panelY + 18 + Math.floor((PANEL_H - 24 - rowsS * blockSz) / 2);
        const color = COLORS[colorIdx];

        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        for (let r = 0; r < rowsS; r++) {
            for (let c = 0; c < cols; c++) {
                if (shape[r][c]) {
                    drawMiniBlock3D(c, r, color, blockSz, offX, offY);
                }
            }
        }
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

// Panel de HUD (nivel, líneas) en el canvas
function drawHUDPanel() {
    const panelX = canvas.width - PANEL_W - 2;
    const panelY = PANEL_H * 2 + 10;
    const ph = 68;

    ctx.save();
    ctx.fillStyle = 'rgba(10,10,20,0.82)';
    ctx.strokeStyle = 'rgba(143,211,244,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, PANEL_W, ph, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('NIVEL', panelX + PANEL_W / 2, panelY + 14);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffe082';
    ctx.fillText(level, panelX + PANEL_W / 2, panelY + 34);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('LÍNEAS', panelX + PANEL_W / 2, panelY + 50);

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(totalLines, panelX + PANEL_W / 2, panelY + 66);

    ctx.restore();
}

function getGhostY() {
    if (!current) return null;
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
}

function spawnLineParticles(row) {
    const count = 18;
    for (let i = 0; i < count; i++) {
        const cx = (Math.random() * COLS) * BLOCK_SIZE;
        const cy = row * BLOCK_SIZE + BLOCK_SIZE / 2;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const spd = 2 + Math.random() * 4;
        const colorIdx = Math.floor(Math.random() * COLORS.length);
        lineParticles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
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
        ctx.beginPath(); ctx.moveTo(gx * BLOCK_SIZE, 0); ctx.lineTo(gx * BLOCK_SIZE, canvas.height); ctx.stroke();
    }
    for (let gy = 0; gy <= ROWS; gy++) {
        ctx.beginPath(); ctx.moveTo(0, gy * BLOCK_SIZE); ctx.lineTo(canvas.width, gy * BLOCK_SIZE); ctx.stroke();
    }
    ctx.restore();

    // Tablero fijo
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                const color = COLORS[board[y][x] - 1];
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

    // Partículas
    updateLineParticles();

    // Paneles de overlay: Hold (arriba izquierda) y Next (arriba derecha)
    if (isPlaying || holdPiece || next) {
        // HOLD panel - esquina superior izquierda
        drawPiecePanel(
            holdPiece ? holdPiece.shape : null,
            holdPiece ? holdPiece.color : 0,
            2, 2, 'HOLD'
        );

        // NEXT panel - esquina superior derecha
        if (next) {
            drawPiecePanel(
                next.shape,
                next.color,
                canvas.width - PANEL_W - 2, 2, 'NEXT'
            );
        }

        // HUD panel (nivel/líneas) - derecha debajo de NEXT
        drawHUDPanel();

        // Indicador "C/Shift=Hold"
        ctx.save();
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(143,211,244,0.6)';
        ctx.textAlign = 'left';
        ctx.fillText('C/⇧=Hold', 4, PANEL_H + 8);
        ctx.restore();
    }

    // Combo message
    if (comboMessage) {
        comboMessage.life--;
        comboMessage.y -= 0.5;
        if (comboMessage.life <= 0) {
            comboMessage = null;
        } else {
            ctx.save();
            ctx.globalAlpha = Math.min(1, comboMessage.life / 20);
            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(comboMessage.text, canvas.width / 2, comboMessage.y);
            ctx.fillStyle = '#ff512f';
            ctx.fillText(comboMessage.text, canvas.width / 2, comboMessage.y);
            ctx.restore();
        }
    }
}

function updateScoreDOM() {
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    document.getElementById('highScore').textContent = highScore;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function randomPiece() {
    const type = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[type],
        x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
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
        if (board[y].every(cell => cell)) rowsToClear.push(y);
    }
    if (rowsToClear.length === 0) {
        combo = 0;
        return;
    }

    rowsToClear.forEach(row => spawnLineParticles(row));
    flashLines = rowsToClear;
    flashTimer = FLASH_FRAMES;
    pendingClearLines = rowsToClear;
    drawBoard();
}

function executeClearLines() {
    const lines = pendingClearLines.length;

    pendingClearLines.sort((a, b) => b - a);
    pendingClearLines.forEach(row => {
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(0));
    });

    flashLines = [];
    pendingClearLines = [];

    // Puntuación estándar Tetris
    let pts = scoreForLines(lines);
    score += pts;
    totalLines += lines;

    // Combo
    combo++;
    if (combo > 1) {
        const bonus = (combo - 1) * 50 * level;
        score += bonus;
        comboMessage = {
            text: `COMBO ×${combo}  +${bonus}`,
            y: ROWS * BLOCK_SIZE / 2,
            life: 80
        };
    }

    // Nivel: cada 10 líneas
    const newLevel = Math.floor(totalLines / 10) + 1;
    if (newLevel !== level) {
        level = newLevel;
        comboMessage = comboMessage || {
            text: `NIVEL ${level}`,
            y: ROWS * BLOCK_SIZE / 2,
            life: 80
        };
        comboMessage.text = `NIVEL ${level}`;
        comboMessage.life = 80;
    }

    // Velocidad por nivel (500ms → 80ms en nivel 10+)
    speed = Math.max(80, 500 - (level - 1) * 48);
    clearInterval(gameInterval);
    gameInterval = setInterval(tick, speed);

    updateScoreDOM();
}

function spawnNext() {
    current = next;
    next = randomPiece();
    canHold = true;
    if (collide(current.shape, current.x, current.y)) {
        gameOver();
        return false;
    }
    return true;
}

function holdCurrentPiece() {
    if (!canHold || !current) return;
    canHold = false;
    if (holdPiece === null) {
        holdPiece = { shape: current.shape, color: current.color };
        current = next;
        next = randomPiece();
        current.x = Math.floor(COLS / 2) - Math.ceil(current.shape[0].length / 2);
        current.y = 0;
    } else {
        const temp = { shape: current.shape, color: current.color };
        current = {
            shape: holdPiece.shape,
            x: Math.floor(COLS / 2) - Math.ceil(holdPiece.shape[0].length / 2),
            y: 0,
            color: holdPiece.color
        };
        holdPiece = temp;
    }
    if (collide(current.shape, current.x, current.y)) {
        gameOver();
        return;
    }
    drawBoard();
}

function tick() {
    if (!current) return;

    if (flashTimer > 0) {
        flashTimer--;
        drawBoard();
        if (flashTimer === 0) {
            executeClearLines();
            if (!spawnNext()) return;
        }
        return;
    }

    if (pendingClearLines.length > 0) return;

    if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
    } else {
        merge();
        clearLines();
        if (flashTimer === 0 && pendingClearLines.length === 0) {
            if (!spawnNext()) return;
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
    totalLines = 0;
    level = 1;
    speed = 500;
    combo = 0;
    comboMessage = null;
    lineParticles = [];
    flashLines = [];
    flashTimer = 0;
    pendingClearLines = [];
    holdPiece = null;
    canHold = true;
    current = randomPiece();
    next = randomPiece();
    updateScoreDOM();
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
    document.getElementById('finalScore').textContent = `Puntaje: ${score}  |  Nivel: ${level}  |  Líneas: ${totalLines}`;
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

// Botón hold en móvil (si existe)
const btnHold = document.getElementById('btnHold');
if (btnHold) btnHold.addEventListener('click', () => isPlaying && holdCurrentPiece());

window.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Space", "c", "C", "Shift"].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'ArrowDown') tick();
    if (e.key === 'ArrowUp') rotate();
    if (e.key === ' ' || e.key === 'Space') drop();
    if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') holdCurrentPiece();
});

// Swipe gestures en el canvas
(function() {
    var swipeStartX, swipeStartY;
    var MIN_SWIPE = 30;

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        var tc = document.getElementById('touchControls');
        if (tc) tc.style.display = 'none';
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        var dx = e.changedTouches[0].clientX - swipeStartX;
        var dy = e.changedTouches[0].clientY - swipeStartY;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (!isPlaying) return;
        if (Math.max(absDx, absDy) < MIN_SWIPE) {
            // TAP: rotar pieza (más intuitivo en móvil)
            rotate();
        } else if (absDx > absDy) {
            if (dx > 0) { move(1); }
            else        { move(-1); }
        } else {
            if (dy > 0) { drop(); }
            else        { rotate(); }
        }
    }, { passive: false });
})();

updateScoreDOM();
drawBoard();

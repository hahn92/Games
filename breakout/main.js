const canvas = document.getElementById('breakoutCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
let paddleX = WIDTH/2 - PADDLE_WIDTH/2;
let ballX = WIDTH/2 - BALL_SIZE/2;
let ballY = HEIGHT - 40;
let ballSpeedX = 4, ballSpeedY = -4;
let bricks = [], rows = 5, cols = 10, brickWidth = 54, brickHeight = 18, brickPadding = 8, brickOffsetTop = 40, brickOffsetLeft = 20;
let score = 0, highScore = localStorage.getItem('breakoutHighScore') || 0;
let isPlaying = false, gameInterval;
let speed = 1000/60;

// Teclas presionadas para movimiento continuo
const keys = {};

// --- Visual enhancements ---
// Ball trail
const ballTrail = [];
const TRAIL_LENGTH = 6;

// Brick particles
let brickParticles = [];

// Ripples on paddle bounce
let ripples = [];

// Stars background (static)
const stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.3
    });
}

function createBricks() {
    bricks = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            bricks.push({
                x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                y: r * (brickHeight + brickPadding) + brickOffsetTop,
                status: 1,
                color: `hsl(${(r*cols+c)*20},80%,60%)`
            });
        }
    }
}

// Lighten/darken color helpers using hsl parsing
function adjustHSLColor(hslStr, lightnessOffset) {
    const match = hslStr.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
    if (!match) return hslStr;
    const h = parseInt(match[1]);
    const s = parseInt(match[2]);
    const l = Math.max(0, Math.min(100, parseInt(match[3]) + lightnessOffset));
    return `hsl(${h},${s}%,${l}%)`;
}

function spawnBrickParticles(brick) {
    const count = 8 + Math.floor(Math.random() * 5);
    const cx = brick.x + brickWidth / 2;
    const cy = brick.y + brickHeight / 2;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        brickParticles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            gravity: 0.08,
            life: 1.0,
            decay: 0.025 + Math.random() * 0.03,
            radius: 2 + Math.random() * 3,
            color: brick.color
        });
    }
}

function spawnRipple(x, y) {
    ripples.push({ x, y, radius: 4, maxRadius: 24, life: 1.0 });
}

function updateBrickParticles() {
    brickParticles = brickParticles.filter(p => p.life > 0);
    brickParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life -= p.decay;
    });
}

function updateRipples() {
    ripples = ripples.filter(r => r.life > 0);
    ripples.forEach(r => {
        r.radius += 1.2;
        r.life = 1 - r.radius / r.maxRadius;
    });
}

function drawBrickParticles() {
    brickParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawRipples() {
    ripples.forEach(r => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.life * 0.7);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // --- Fondo oscuro con estrellas ---
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Estrellas estáticas
    stars.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, s.size, s.size);
        ctx.restore();
    });

    // --- Trail de la pelota ---
    ballTrail.forEach((pos, i) => {
        const ratio = i / TRAIL_LENGTH;
        const alpha = 0.05 + ratio * 0.45;
        const radius = (BALL_SIZE / 2) * (0.3 + ratio * 0.7);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffe082';
        ctx.beginPath();
        ctx.arc(pos.x + BALL_SIZE/2, pos.y + BALL_SIZE/2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // --- Partículas de ladrillo ---
    drawBrickParticles();

    // --- Ripples ---
    drawRipples();

    // --- Paleta con gradiente y brillo ---
    const paddleGrad = ctx.createLinearGradient(paddleX, 0, paddleX + PADDLE_WIDTH, 0);
    paddleGrad.addColorStop(0, '#ffffff');
    paddleGrad.addColorStop(0.5, '#00e5ff');
    paddleGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = paddleGrad;
    ctx.fillRect(paddleX, HEIGHT-PADDLE_HEIGHT-10, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Destello superior en la paleta
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddleX + 2, HEIGHT-PADDLE_HEIGHT-10, PADDLE_WIDTH - 4, 3);
    ctx.restore();

    // --- Bola con glow ---
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // --- Ladrillos con efecto 3D ---
    bricks.forEach(brick => {
        if (brick.status) {
            const bx = brick.x;
            const by = brick.y;
            const bw = brickWidth;
            const bh = brickHeight;
            const baseColor = brick.color;
            const lightColor = adjustHSLColor(baseColor, 30);
            const darkColor = adjustHSLColor(baseColor, -30);

            // Cara principal
            ctx.fillStyle = baseColor;
            ctx.fillRect(bx, by, bw, bh);

            // Cara superior clara (efecto 3D)
            ctx.fillStyle = lightColor;
            ctx.fillRect(bx, by, bw, 4);

            // Cara inferior oscura (efecto 3D)
            ctx.fillStyle = darkColor;
            ctx.fillRect(bx, by + bh - 4, bw, 4);

            // Borde derecho oscuro
            ctx.fillStyle = darkColor;
            ctx.fillRect(bx + bw - 3, by, 3, bh);

            // Destello blanco esquina superior izquierda
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(bx + 2, by + 2, 6, 3);
            ctx.restore();
        }
    });
}

function update() {
    // Movimiento continuo de la paleta
    if (keys['ArrowLeft'] || keys['left']) paddleX -= PADDLE_SPEED;
    if (keys['ArrowRight'] || keys['right']) paddleX += PADDLE_SPEED;
    paddleX = Math.max(0, Math.min(WIDTH-PADDLE_WIDTH, paddleX));

    // Actualizar trail
    ballTrail.push({ x: ballX, y: ballY });
    if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();

    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Rebote lateral
    if (ballX <= 0 || ballX + BALL_SIZE >= WIDTH) ballSpeedX *= -1;
    // Rebote arriba
    if (ballY <= 0) ballSpeedY *= -1;
    // Rebote con paleta
    if (ballY + BALL_SIZE >= HEIGHT-PADDLE_HEIGHT-10 && ballX + BALL_SIZE > paddleX && ballX < paddleX + PADDLE_WIDTH) {
        ballSpeedY *= -1;
        ballY = HEIGHT-PADDLE_HEIGHT-10-BALL_SIZE;
        ballSpeedX += (Math.random()-0.5)*2;
        spawnRipple(ballX + BALL_SIZE/2, HEIGHT-PADDLE_HEIGHT-10);
    }
    // Rebote con ladrillos
    bricks.forEach(brick => {
        if (brick.status && ballX + BALL_SIZE > brick.x && ballX < brick.x + brickWidth && ballY + BALL_SIZE > brick.y && ballY < brick.y + brickHeight) {
            ballSpeedY *= -1;
            brick.status = 0;
            spawnBrickParticles(brick);
            score += 10;
            updateScore();
        }
    });
    // Fin de juego
    if (ballY + BALL_SIZE > HEIGHT) {
        ballTrail.length = 0;
        gameOver();
    }
    // Siguiente nivel
    if (bricks.every(b => !b.status)) {
        rows = Math.min(rows+1, 10);
        createBricks();
        resetBall();
    }

    updateBrickParticles();
    updateRipples();
    draw();
}

function resetBall() {
    ballX = WIDTH/2 - BALL_SIZE/2;
    ballY = HEIGHT - 40;
    ballSpeedX = 4 * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = -4;
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    document.getElementById('highScore').textContent = highScore;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('breakoutHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function startGame() {
    paddleX = WIDTH/2 - PADDLE_WIDTH/2;
    score = 0;
    rows = 5;
    brickParticles = [];
    ripples = [];
    ballTrail.length = 0;
    createBricks();
    resetBall();
    updateScore();
    draw();
    clearInterval(gameInterval);
    gameInterval = setInterval(update, speed);
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

// Teclado - movimiento continuo
window.addEventListener('keydown', e => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// Controles táctiles - movimiento continuo (mantener presionado)
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

btnLeft.addEventListener('mousedown', () => { keys['left'] = true; });
btnLeft.addEventListener('mouseup', () => { keys['left'] = false; });
btnLeft.addEventListener('mouseleave', () => { keys['left'] = false; });
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['left'] = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['left'] = false; });
btnLeft.addEventListener('touchcancel', () => { keys['left'] = false; });

btnRight.addEventListener('mousedown', () => { keys['right'] = true; });
btnRight.addEventListener('mouseup', () => { keys['right'] = false; });
btnRight.addEventListener('mouseleave', () => { keys['right'] = false; });
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['right'] = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['right'] = false; });
btnRight.addEventListener('touchcancel', () => { keys['right'] = false; });

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
draw();

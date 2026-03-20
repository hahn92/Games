const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 16;
const PADDLE_SPEED = 6;
let playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
let aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
let ballX = WIDTH/2 - BALL_SIZE/2;
let ballY = HEIGHT/2 - BALL_SIZE/2;
let ballSpeedX = 5, ballSpeedY = 3;
let playerScore = 0, highScore = localStorage.getItem('pongHighScore') || 0;
let isPlaying = false, gameInterval;
let speed = 1000/60;

// Teclas presionadas para movimiento continuo
const keys = {};

// --- Visual enhancements ---
// Ball trail
const ballTrail = [];
const TRAIL_LENGTH = 8;

// Particles
let particles = [];

// Flash effect
let flashSide = null; // 'left' or 'right'
let flashFrames = 0;
const FLASH_DURATION = 10;

function spawnPaddleParticles(x, y) {
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * Math.PI * 0.6 + (ballSpeedX > 0 ? 0 : Math.PI);
        const speed = 2 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.06 + Math.random() * 0.04,
            radius: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#00e5ff' : '#ffffff'
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
    });
}

function drawParticles() {
    particles.forEach(p => {
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

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // --- Fondo con degradado ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0a0a1a');
    bgGrad.addColorStop(1, '#000510');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Viñeta radial
    const vignette = ctx.createRadialGradient(WIDTH/2, HEIGHT/2, HEIGHT*0.3, WIDTH/2, HEIGHT/2, HEIGHT*0.85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // --- Flash de punto ---
    if (flashFrames > 0) {
        const alpha = (flashFrames / FLASH_DURATION) * 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ff88';
        if (flashSide === 'left') {
            ctx.fillRect(0, 0, WIDTH/2, HEIGHT);
        } else {
            ctx.fillRect(WIDTH/2, 0, WIDTH/2, HEIGHT);
        }
        ctx.restore();
        flashFrames--;
    }

    // --- Línea central con círculos ---
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8fd3f4';
    for (let yy = 10; yy < HEIGHT; yy += 20) {
        ctx.beginPath();
        ctx.arc(WIDTH/2, yy, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

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

    // --- Partículas ---
    drawParticles();

    // --- Paletas con gradiente ---
    // Paleta jugador
    const playerGrad = ctx.createLinearGradient(0, playerY, 0, playerY + PADDLE_HEIGHT);
    playerGrad.addColorStop(0, '#aaaaaa');
    playerGrad.addColorStop(0.5, '#ffffff');
    playerGrad.addColorStop(1, '#aaaaaa');
    ctx.fillStyle = playerGrad;
    ctx.fillRect(0, playerY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Paleta AI
    const aiGrad = ctx.createLinearGradient(0, aiY, 0, aiY + PADDLE_HEIGHT);
    aiGrad.addColorStop(0, '#aaaaaa');
    aiGrad.addColorStop(0.5, '#ffffff');
    aiGrad.addColorStop(1, '#aaaaaa');
    ctx.fillStyle = aiGrad;
    ctx.fillRect(WIDTH - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // --- Bola con glow ---
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function moveAI() {
    let center = aiY + PADDLE_HEIGHT/2;
    if (center < ballY) aiY += 4;
    else if (center > ballY + BALL_SIZE) aiY -= 4;
    aiY = Math.max(0, Math.min(HEIGHT-PADDLE_HEIGHT, aiY));
}

function update() {
    // Movimiento continuo del jugador
    if (keys['ArrowUp'] || keys['up']) playerY -= PADDLE_SPEED;
    if (keys['ArrowDown'] || keys['down']) playerY += PADDLE_SPEED;
    playerY = Math.max(0, Math.min(HEIGHT-PADDLE_HEIGHT, playerY));

    // Actualizar trail
    ballTrail.push({ x: ballX, y: ballY });
    if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();

    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Rebote arriba/abajo
    if (ballY <= 0 || ballY + BALL_SIZE >= HEIGHT) ballSpeedY *= -1;

    // Rebote con jugador
    if (ballX <= PADDLE_WIDTH && ballY + BALL_SIZE > playerY && ballY < playerY + PADDLE_HEIGHT) {
        ballSpeedX *= -1;
        ballX = PADDLE_WIDTH;
        ballSpeedY += (Math.random()-0.5)*2;
        spawnPaddleParticles(PADDLE_WIDTH, ballY + BALL_SIZE/2);
    }
    // Rebote con AI
    if (ballX + BALL_SIZE >= WIDTH-PADDLE_WIDTH && ballY + BALL_SIZE > aiY && ballY < aiY + PADDLE_HEIGHT) {
        ballSpeedX *= -1;
        ballX = WIDTH-PADDLE_WIDTH-BALL_SIZE;
        ballSpeedY += (Math.random()-0.5)*2;
        spawnPaddleParticles(WIDTH - PADDLE_WIDTH, ballY + BALL_SIZE/2);
    }
    // Punto jugador
    if (ballX + BALL_SIZE >= WIDTH) {
        playerScore++;
        flashSide = 'left';
        flashFrames = FLASH_DURATION;
        ballTrail.length = 0;
        resetBall();
        updateScore();
    }
    // Punto AI (fin de juego)
    if (ballX <= 0) {
        ballTrail.length = 0;
        gameOver();
    }

    updateParticles();
    moveAI();
    draw();
}

function resetBall() {
    ballX = WIDTH/2 - BALL_SIZE/2;
    ballY = HEIGHT/2 - BALL_SIZE/2;
    ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = 3 * (Math.random() > 0.5 ? 1 : -1);
}

function updateScore() {
    document.getElementById('score').textContent = playerScore;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + playerScore;
    }
    document.getElementById('highScore').textContent = highScore;
    if (playerScore > highScore) {
        highScore = playerScore;
        localStorage.setItem('pongHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function startGame() {
    playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
    aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
    playerScore = 0;
    particles = [];
    ballTrail.length = 0;
    flashFrames = 0;
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
    document.getElementById('finalScore').textContent = 'Puntaje: ' + playerScore;
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
    if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// Controles táctiles - movimiento continuo (mantener presionado)
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');

btnUp.addEventListener('mousedown', () => { keys['up'] = true; });
btnUp.addEventListener('mouseup', () => { keys['up'] = false; });
btnUp.addEventListener('mouseleave', () => { keys['up'] = false; });
btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); keys['up'] = true; });
btnUp.addEventListener('touchend', (e) => { e.preventDefault(); keys['up'] = false; });
btnUp.addEventListener('touchcancel', () => { keys['up'] = false; });

btnDown.addEventListener('mousedown', () => { keys['down'] = true; });
btnDown.addEventListener('mouseup', () => { keys['down'] = false; });
btnDown.addEventListener('mouseleave', () => { keys['down'] = false; });
btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); keys['down'] = true; });
btnDown.addEventListener('touchend', (e) => { e.preventDefault(); keys['down'] = false; });
btnDown.addEventListener('touchcancel', () => { keys['down'] = false; });

document.getElementById('score').textContent = playerScore;
document.getElementById('highScore').textContent = highScore;
draw();

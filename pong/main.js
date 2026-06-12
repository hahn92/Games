const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 16;
const PADDLE_SPEED = 6;
const WIN_SCORE = 7;

let playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
let aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
let ballX = WIDTH/2 - BALL_SIZE/2;
let ballY = HEIGHT/2 - BALL_SIZE/2;
let ballSpeedX = 5, ballSpeedY = 3;
let playerScore = 0, aiScore = 0;
let highScore = localStorage.getItem('pongHighScore') || 0;
let isPlaying = false, gameInterval;
let speed = 1000/60;


// --- Dificultad de IA ---
// 0=Fácil, 1=Normal, 2=Difícil
let aiDifficulty = 1;
const AI_PROFILES = [
    { maxSpeed: 2.8, errorRange: 48 },   // Fácil
    { maxSpeed: 4.0, errorRange: 22 },   // Normal
    { maxSpeed: 5.5, errorRange: 6  }    // Difícil
];
let aiError = 0; // offset aleatorio actual de la IA

// --- Velocidad progresiva de la bola ---
const BALL_INITIAL_SPEED = 5;
const BALL_MAX_SPEED = 10;
let rallyBounces = 0; // rebotes consecutivos sin anotar

// --- Rally counter ---
let rallyCount = 0; // rebotes consecutivos sin que nadie anote
let rallyMessage = null; // { text, life, y }

// --- Impact flash points ---
let impactFlashes = []; // { x, y, life, radius }

// Teclas presionadas para movimiento continuo
const keys = {};

// Ball trail
const ballTrail = [];
const TRAIL_LENGTH = 8;

// Particles
let particles = [];

// Flash effect (al anotar)
let flashSide = null;
let flashFrames = 0;
const FLASH_DURATION = 10;

function spawnPaddleParticles(x, y) {
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * Math.PI * 0.6 + (ballSpeedX > 0 ? 0 : Math.PI);
        const spd = 2 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1.0,
            decay: 0.06 + Math.random() * 0.04,
            radius: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#00e5ff' : '#ffffff'
        });
    }
}

function spawnWallImpact(x, y) {
    impactFlashes.push({ x, y, life: 1.0, radius: 4 });
    // partículas pequeñas de pared
    for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x, y,
            vx: Math.cos(angle) * (1 + Math.random() * 2),
            vy: Math.sin(angle) * (1 + Math.random() * 2),
            life: 0.7,
            decay: 0.08 + Math.random() * 0.05,
            radius: 1.5 + Math.random() * 1.5,
            color: '#8fd3f4'
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function updateImpactFlashes() {
    for (let i = impactFlashes.length - 1; i >= 0; i--) {
        const f = impactFlashes[i];
        f.life -= 0.1;
        f.radius += 2;
        if (f.life <= 0) { impactFlashes.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = f.life * 0.7;
        ctx.strokeStyle = '#8fd3f4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function drawDifficultyButtons() {
    if (isPlaying) return;
    const labels = ['Fácil', 'Normal', 'Difícil'];
    const btnW = 70, btnH = 26, gap = 8;
    const totalW = labels.length * btnW + (labels.length - 1) * gap;
    const startX = (WIDTH - totalW) / 2;
    const btnY = HEIGHT - 70;

    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((lbl, i) => {
        const bx = startX + i * (btnW + gap);
        const selected = aiDifficulty === i;
        ctx.fillStyle = selected ? '#8fd3f4' : 'rgba(143,211,244,0.15)';
        ctx.strokeStyle = selected ? '#8fd3f4' : 'rgba(143,211,244,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, btnY, btnW, btnH, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = selected ? '#000' : '#8fd3f4';
        ctx.fillText(lbl, bx + btnW / 2, btnY + btnH / 2);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px monospace';
    ctx.fillText('Teclas 1/2/3 para cambiar dificultad', WIDTH / 2, btnY + btnH + 14);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Fondo con degradado
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

    // Flash de punto
    if (flashFrames > 0) {
        const alpha = (flashFrames / FLASH_DURATION) * 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ff88';
        if (flashSide === 'left') ctx.fillRect(0, 0, WIDTH/2, HEIGHT);
        else ctx.fillRect(WIDTH/2, 0, WIDTH/2, HEIGHT);
        ctx.restore();
        flashFrames--;
    }

    // Línea central
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8fd3f4';
    for (let yy = 10; yy < HEIGHT; yy += 20) {
        ctx.beginPath(); ctx.arc(WIDTH/2, yy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Trail de la pelota
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

    // Partículas
    drawParticles();

    // Impact flashes
    updateImpactFlashes();

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

    // Marcador prominente
    ctx.save();
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillText(`${playerScore}`, WIDTH / 4, 14);
    ctx.fillText(`${aiScore}`, 3 * WIDTH / 4, 14);
    // Marcador hasta WIN_SCORE
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(143,211,244,0.5)';
    ctx.fillText(`meta: ${WIN_SCORE}`, WIDTH / 2, 18);
    ctx.restore();

    // Bola con glow
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Rally message
    if (rallyMessage) {
        rallyMessage.life--;
        rallyMessage.y -= 0.4;
        if (rallyMessage.life <= 0) rallyMessage = null;
        else {
            ctx.save();
            ctx.globalAlpha = Math.min(1, rallyMessage.life / 20);
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(rallyMessage.text, WIDTH / 2, rallyMessage.y);
            ctx.fillStyle = '#ffe082';
            ctx.fillText(rallyMessage.text, WIDTH / 2, rallyMessage.y);
            ctx.restore();
        }
    }

    // Pantalla de inicio: botones de dificultad
    drawDifficultyButtons();

    // Labels de dificultad en juego (pequeño, esquina)
    if (isPlaying) {
        const diffLabels = ['FÁCIL', 'NORMAL', 'DIFÍCIL'];
        ctx.save();
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(143,211,244,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(`IA: ${diffLabels[aiDifficulty]}  (1/2/3)`, WIDTH / 2, HEIGHT - 10);
        ctx.restore();
    }
}

function moveAI() {
    const profile = AI_PROFILES[aiDifficulty];
    // Error se actualiza periódicamente para simular imprecisión
    if (Math.random() < 0.03) {
        aiError = (Math.random() - 0.5) * profile.errorRange;
    }
    const target = ballY + aiError;
    let center = aiY + PADDLE_HEIGHT / 2;
    const diff = target - center;
    const move = Math.min(Math.abs(diff), profile.maxSpeed) * Math.sign(diff);
    aiY += move;
    aiY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, aiY));
}

function getBallSpeed() {
    return Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
}

function limitBallSpeed() {
    const spd = getBallSpeed();
    if (spd > BALL_MAX_SPEED) {
        const ratio = BALL_MAX_SPEED / spd;
        ballSpeedX *= ratio;
        ballSpeedY *= ratio;
    }
}

function update() {
    // Movimiento jugador
    if (keys['ArrowUp'] || keys['up']) playerY -= PADDLE_SPEED;
    if (keys['ArrowDown'] || keys['down']) playerY += PADDLE_SPEED;
    playerY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, playerY));

    // Trail
    ballTrail.push({ x: ballX, y: ballY });
    if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();

    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Rebote arriba/abajo (paredes)
    if (ballY <= 0) {
        ballSpeedY = Math.abs(ballSpeedY);
        spawnWallImpact(ballX + BALL_SIZE / 2, 0);
        GameAudio.hit();
    }
    if (ballY + BALL_SIZE >= HEIGHT) {
        ballSpeedY = -Math.abs(ballSpeedY);
        spawnWallImpact(ballX + BALL_SIZE / 2, HEIGHT);
        GameAudio.hit();
    }

    // Rebote con paleta jugador
    if (ballX <= PADDLE_WIDTH && ballX > 0 && ballY + BALL_SIZE > playerY && ballY < playerY + PADDLE_HEIGHT) {
        ballSpeedX = Math.abs(ballSpeedX);
        ballX = PADDLE_WIDTH;
        const offset = (ballY + BALL_SIZE / 2 - (playerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ballSpeedY = offset * 5;
        // Acelerar levemente en cada rebote
        ballSpeedX *= 1.04;
        limitBallSpeed();
        rallyCount++;
        rallyBounces++;
        spawnPaddleParticles(PADDLE_WIDTH, ballY + BALL_SIZE / 2);
        checkRallyMilestone();
        GameAudio.paddle();
    }
    // Rebote con paleta AI
    if (ballX + BALL_SIZE >= WIDTH - PADDLE_WIDTH && ballX + BALL_SIZE < WIDTH && ballY + BALL_SIZE > aiY && ballY < aiY + PADDLE_HEIGHT) {
        ballSpeedX = -Math.abs(ballSpeedX);
        ballX = WIDTH - PADDLE_WIDTH - BALL_SIZE;
        const offset = (ballY + BALL_SIZE / 2 - (aiY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ballSpeedY = offset * 5;
        ballSpeedX *= 1.04;
        limitBallSpeed();
        rallyCount++;
        rallyBounces++;
        spawnPaddleParticles(WIDTH - PADDLE_WIDTH, ballY + BALL_SIZE / 2);
        checkRallyMilestone();
        GameAudio.paddle();
    }

    // Punto jugador
    if (ballX + BALL_SIZE >= WIDTH) {
        playerScore++;
        flashSide = 'left';
        flashFrames = FLASH_DURATION;
        ballTrail.length = 0;
        rallyCount = 0;
        updateScore();
        GameAudio.score();
        if (playerScore >= WIN_SCORE) { gameOver('player'); return; }
        resetBall();
    }
    // Punto AI
    if (ballX <= 0) {
        aiScore++;
        flashSide = 'right';
        flashFrames = FLASH_DURATION;
        ballTrail.length = 0;
        rallyCount = 0;
        updateScore();
        GameAudio.score();
        if (aiScore >= WIN_SCORE) { gameOver('ai'); return; }
        resetBall();
    }

    updateParticles();
    moveAI();
    draw();
}

function checkRallyMilestone() {
    if (rallyCount === 5 || rallyCount === 10 || rallyCount === 15 || rallyCount === 20) {
        rallyMessage = {
            text: `¡Rally ×${rallyCount}!`,
            y: HEIGHT / 2,
            life: 90
        };
    }
}

function resetBall() {
    ballX = WIDTH/2 - BALL_SIZE/2;
    ballY = HEIGHT/2 - BALL_SIZE/2;
    // Velocidad inicial cada punto (no acumula)
    const dir = Math.random() > 0.5 ? 1 : -1;
    ballSpeedX = BALL_INITIAL_SPEED * dir;
    ballSpeedY = (2 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1);
    rallyBounces = 0;
}

function updateScore() {
    document.getElementById('score').textContent = `${playerScore} – ${aiScore}`;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = `${playerScore} – ${aiScore}`;
    }
    document.getElementById('highScore').textContent = highScore;
    if (playerScore > highScore) {
        highScore = playerScore;
        localStorage.setItem('pongHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function startGame() {
    GameAudio.start();
    playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
    aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
    playerScore = 0;
    aiScore = 0;
    rallyCount = 0;
    rallyMessage = null;
    particles = [];
    impactFlashes = [];
    ballTrail.length = 0;
    flashFrames = 0;
    aiError = 0;
    resetBall();
    updateScore();
    draw();
    rafClear(gameInterval);
    gameInterval = rafInterval(update, speed);
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
}

function restartGame() {
    startGame();
}

function gameOver(winner) {
    rafClear(gameInterval);
    GameAudio.gameOver();
    const popup = document.getElementById('gameOverPopup');
    const finalEl = document.getElementById('finalScore');
    if (winner === 'player') {
        finalEl.textContent = `¡Ganaste!  ${playerScore} – ${aiScore}`;
    } else {
        finalEl.textContent = `¡La IA gana!  ${playerScore} – ${aiScore}`;
    }
    popup.style.display = 'flex';
    isPlaying = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

document.getElementById('startBtn').addEventListener('click', () => { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', () => {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Teclado - movimiento continuo + dificultad
window.addEventListener('keydown', e => {
    if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if (e.key === '1') { aiDifficulty = 0; if (!isPlaying) draw(); }
    if (e.key === '2') { aiDifficulty = 1; if (!isPlaying) draw(); }
    if (e.key === '3') { aiDifficulty = 2; if (!isPlaying) draw(); }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// Click en botones de dificultad (pantalla de inicio)
canvas.addEventListener('click', e => {
    if (isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (WIDTH / rect.width);
    const cy = (e.clientY - rect.top) * (HEIGHT / rect.height);
    const btnW = 70, btnH = 26, gap = 8;
    const totalW = 3 * btnW + 2 * gap;
    const startX = (WIDTH - totalW) / 2;
    const btnY = HEIGHT - 70;
    for (let i = 0; i < 3; i++) {
        const bx = startX + i * (btnW + gap);
        if (cx >= bx && cx <= bx + btnW && cy >= btnY && cy <= btnY + btnH) {
            aiDifficulty = i;
            draw();
            break;
        }
    }
});

// Controles táctiles - movimiento continuo
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

document.getElementById('score').textContent = `${playerScore} – ${aiScore}`;
document.getElementById('highScore').textContent = highScore;
draw();

// Controles táctiles directos en canvas
(function() {
    var isTouching = false;
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        isTouching = true;
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!isTouching || !isPlaying) return;
        var rect = canvas.getBoundingClientRect();
        var scaleY = canvas.height / rect.height;
        var ty = (e.touches[0].clientY - rect.top) * scaleY;
        playerY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, ty - PADDLE_HEIGHT / 2));
    }, { passive: false });
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        isTouching = false;
    }, { passive: false });
    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
})();

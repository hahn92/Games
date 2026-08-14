/* Breakout — ladrillos con vida (maxStatus 2 = invencible hasta dos golpes),
 * power-ups que caen al romper, ondas de impacto y particulas por ladrillo.
 * El brillo de cada ladrillo se dibuja sin save/restore: solo cambia
 * globalAlpha y se repone al salir, porque el bucle recorre todos los
 * ladrillos en cada frame.
 */
const canvas = document.getElementById('breakoutCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BASE_PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;

let paddleX = WIDTH/2 - BASE_PADDLE_WIDTH/2;
let paddleWidth = BASE_PADDLE_WIDTH;

// --- Sistema de vidas ---
let lives = 3;

// --- Bolas (puede haber varias) ---
let balls = [];

// --- Power-ups ---
let powerUps = [];
let activePowerUps = {}; // { widePaddle: timerMs, slowBall: timerMs }

// --- Niveles ---
let currentLevel = 1;
let levelTransition = false;
let levelTransitionTimer = 0;
const LEVEL_TRANSITION_FRAMES = 120;

let bricks = [], rows = 5, cols = 10;
const brickWidth = 54, brickHeight = 18, brickPadding = 8, brickOffsetTop = 40, brickOffsetLeft = 20;
/* El récord va por GU.highScore: la comparación, la escritura y el valor
 * por defecto en un solo sitio. `highScore` se mantiene porque el resto
 * del fichero la usa. */
var gameBest = GU.highScore('breakoutHighScore');

let score = 0, highScore = gameBest.display(0);
let isPlaying = false, gameInterval;
let speed = 1000/60;


// Teclas presionadas para movimiento continuo

// Ball trail (para la primera bola)
const ballTrail = [];
const TRAIL_LENGTH = 6;

// Brick particles
const brickParticles = new Particles(200);   // pooled, see game-utils.js

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

// --- Power-up types ---
const POWERUP_TYPES = [
    { id: 'extraBall', color: '#66bb6a', label: '+BOLA' },
    { id: 'widePaddle', color: '#42a5f5', label: 'PALETA' },
    { id: 'slowBall', color: '#ffee58', label: 'LENTO' }
];

function createBricks() {
    bricks = [];
    // Más filas y bloques invencibles en niveles superiores
    const numRows = Math.min(5 + currentLevel - 1, 9);
    const invincibleRows = currentLevel >= 2 ? Math.floor((currentLevel - 1) / 2) : 0;

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < cols; c++) {
            const isInvincible = currentLevel >= 2 && r >= numRows - invincibleRows;
            bricks.push({
                x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                y: r * (brickHeight + brickPadding) + brickOffsetTop,
                status: isInvincible ? 2 : 1, // 2=invencible (2 golpes), 1=normal
                maxStatus: isInvincible ? 2 : 1,
                color: isInvincible
                    ? '#888888'
                    : `hsl(${(r * cols + c) * 18 + currentLevel * 30},80%,55%)`
            });
        }
    }
}

function adjustHSLColor(hslStr, lightnessOffset) {
    const match = hslStr.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
    if (!match) return hslStr;
    const h = parseInt(match[1]);
    const s = parseInt(match[2]);
    const l = Math.max(0, Math.min(100, parseInt(match[3]) + lightnessOffset));
    return `hsl(${h},${s}%,${l}%)`;
}

function adjustRGBColor(hex, offset) {
    if (hex.startsWith('hsl')) return adjustHSLColor(hex, offset > 0 ? 25 : -25);
    return hex;
}

function spawnBrickParticles(brick) {
    const count = 8 + Math.floor(Math.random() * 5);
    const cx = brick.x + brickWidth / 2;
    const cy = brick.y + brickHeight / 2;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        brickParticles.add(
            cx, cy, Math.cos(angle) * spd, Math.sin(angle) * spd, {
            life: 1 / ((0.025 + Math.random() * 0.03) * 60),
            size: 2 + Math.random() * 3,
            color: brick.color, gravity: 0.08
        });
    }
}

function spawnRipple(x, y) {
    ripples.push({ x, y, radius: 4, maxRadius: 24, life: 1.0 });
}

function updateBrickParticles() { brickParticles.update(); }

function updateRipples() {
    ripples = ripples.filter(r => r.life > 0);
    ripples.forEach(r => {
        r.radius += 1.2;
        r.life = 1 - r.radius / r.maxRadius;
    });
}

function drawBrickParticles() { brickParticles.draw(ctx); }

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

function drawPowerUps() {
    powerUps.forEach(p => {
        if (!p.active) return;
        const type = POWERUP_TYPES.find(t => t.id === p.type);
        if (!type) return;
        // Cápsula que cae
        const pw = 44, ph = 18;
        const cx = p.x + pw / 2, cy = p.y + ph / 2;
        ctx.save();
        ctx.fillStyle = type.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, pw / 2, ph / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type.label, cx, cy);
        ctx.restore();
    });
}

function drawActivePowerUps() {
    // Indicadores de power-ups activos en la parte inferior del canvas
    let idx = 0;
    if (activePowerUps.widePaddle > 0) {
        drawPowerUpIndicator(POWERUP_TYPES.find(t => t.id === 'widePaddle'), activePowerUps.widePaddle / (10 * 60), idx++);
    }
    if (activePowerUps.slowBall > 0) {
        drawPowerUpIndicator(POWERUP_TYPES.find(t => t.id === 'slowBall'), activePowerUps.slowBall / (8 * 60), idx++);
    }
}

function drawPowerUpIndicator(type, ratio, idx) {
    const bw = 56, bh = 10;
    const bx = 6 + idx * (bw + 6);
    const by = HEIGHT - bh - 22;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = type.color;
    ctx.fillRect(bx, by, Math.floor(bw * ratio), bh);
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(type.label, bx + 2, by - 2);
    ctx.restore();
}

function drawLives() {
    // Vidas como círculos en la esquina inferior derecha
    const r = 7;
    const spacing = 20;
    const y = HEIGHT - 14;
    // Shadow state set once for the whole batch (never per-element in a loop)
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ffe082';
    ctx.fillStyle = '#ffe082';
    for (let i = 0; i < lives; i++) {
        const cx = WIDTH - 10 - i * spacing;
        ctx.beginPath();
        ctx.arc(cx, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`VIDAS`, WIDTH - 10 - lives * spacing - 4, y + 4);
    ctx.restore();
}

function drawLevelHUD() {
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(143,211,244,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`NIVEL ${currentLevel}`, 6, HEIGHT - 8);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Fondo oscuro con estrellas
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.globalAlpha = 1;

    // Trail de la primera bola
    ctx.fillStyle = '#ffe082';
    ballTrail.forEach((pos, i) => {
        const ratio = i / TRAIL_LENGTH;
        const radius = (BALL_SIZE / 2) * (0.3 + ratio * 0.7);
        ctx.globalAlpha = 0.05 + ratio * 0.45;
        ctx.beginPath();
        ctx.arc(pos.x + BALL_SIZE/2, pos.y + BALL_SIZE/2, radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Partículas de ladrillo
    drawBrickParticles();

    // Ripples
    drawRipples();

    // Power-ups cayendo
    drawPowerUps();

    // Paleta con gradiente
    const pw = paddleWidth;
    const paddleGrad = ctx.createLinearGradient(paddleX, 0, paddleX + pw, 0);
    paddleGrad.addColorStop(0, '#ffffff');
    paddleGrad.addColorStop(0.5, activePowerUps.widePaddle > 0 ? '#42a5f5' : '#00e5ff');
    paddleGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = paddleGrad;
    ctx.fillRect(paddleX, HEIGHT - PADDLE_HEIGHT - 10, pw, PADDLE_HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddleX + 2, HEIGHT - PADDLE_HEIGHT - 10, pw - 4, 3);
    ctx.restore();

    // Bolas — shadow state set once for the whole batch
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#ffe082';
    balls.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x + BALL_SIZE/2, b.y + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.restore();

    // Ladrillos con efecto 3D
    bricks.forEach(brick => {
        if (!brick.status) return;
        const bx = brick.x, by = brick.y;
        const bw = brickWidth, bh = brickHeight;
        let baseColor = brick.color;

        // Bloque invencible (gris) oscurecido si fue golpeado
        if (brick.maxStatus === 2 && brick.status === 1) {
            baseColor = '#555555';
        }

        const isHSL = baseColor.startsWith('hsl');
        const lightColor = isHSL ? adjustHSLColor(baseColor, 30) : '#ffffff';
        const darkColor = isHSL ? adjustHSLColor(baseColor, -30) : '#333333';

        ctx.fillStyle = baseColor;
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = lightColor;
        ctx.fillRect(bx, by, bw, 4);
        ctx.fillStyle = darkColor;
        ctx.fillRect(bx, by + bh - 4, bw, 4);
        ctx.fillStyle = darkColor;
        ctx.fillRect(bx + bw - 3, by, 3, bh);
        /* corría por cada ladrillo y cada frame solo para acotar el alpha */
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + 2, by + 2, 6, 3);
        ctx.globalAlpha = 1;

        // Indicador visual de HP en bloques invencibles
        if (brick.maxStatus === 2) {
            ctx.save();
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = brick.status === 2 ? '#ffffff' : '#aaaaaa';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brick.status === 2 ? '2' : '1', bx + bw / 2, by + bh / 2);
            ctx.restore();
        }
    });

    // HUD
    drawLives();
    drawLevelHUD();
    drawActivePowerUps();

    // Transición de nivel
    if (levelTransition) {
        const alpha = Math.min(1, Math.min(levelTransitionTimer, LEVEL_TRANSITION_FRAMES - levelTransitionTimer) / 30);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 38px monospace';
        ctx.fillStyle = '#8fd3f4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`NIVEL ${currentLevel}`, WIDTH / 2, HEIGHT / 2);
        ctx.restore();
    }
}

function applyPowerUp(type) {
    if (type === 'extraBall') {
        if (balls.length < 4) {
            const b = balls[0] || { x: WIDTH/2, y: HEIGHT/2, speedX: 4, speedY: -4 };
            balls.push({
                x: b.x, y: b.y,
                speedX: b.speedX * (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.4),
                speedY: -Math.abs(b.speedY) * (0.8 + Math.random() * 0.4)
            });
        }
    } else if (type === 'widePaddle') {
        activePowerUps.widePaddle = 10 * 60; // 10 segundos a 60fps
        paddleWidth = Math.min(BASE_PADDLE_WIDTH * 1.7, 136);
    } else if (type === 'slowBall') {
        activePowerUps.slowBall = 8 * 60;
        balls.forEach(b => {
            b.speedX *= 0.65;
            b.speedY *= 0.65;
        });
    }
}

function updatePowerUps() {
    const pw2 = 44, ph2 = 18;
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        if (!p.active) continue;
        p.y += 2;
        // Capturado con paleta
        if (p.y + ph2 >= HEIGHT - PADDLE_HEIGHT - 10 &&
            p.x + pw2 > paddleX && p.x < paddleX + paddleWidth) {
            applyPowerUp(p.type);
            p.active = false;
            continue;
        }
        // Fuera del campo
        if (p.y > HEIGHT) p.active = false;
    }
    powerUps = powerUps.filter(p => p.active);

    // Decrementar timers de power-ups activos
    if (activePowerUps.widePaddle > 0) {
        activePowerUps.widePaddle--;
        if (activePowerUps.widePaddle <= 0) {
            paddleWidth = BASE_PADDLE_WIDTH;
            activePowerUps.widePaddle = 0;
        }
    }
    if (activePowerUps.slowBall > 0) {
        activePowerUps.slowBall--;
        if (activePowerUps.slowBall <= 0) {
            activePowerUps.slowBall = 0;
        }
    }
}

function trySpawnPowerUp(brick) {
    if (Math.random() > 0.20) return; // 20% de probabilidad
    const typeIdx = Math.floor(Math.random() * POWERUP_TYPES.length);
    const type = POWERUP_TYPES[typeIdx];
    powerUps.push({
        x: brick.x + brickWidth / 2 - 22,
        y: brick.y + brickHeight / 2 - 9,
        type: type.id,
        active: true
    });
}

function update() {
    if (levelTransition) {
        levelTransitionTimer--;
        if (levelTransitionTimer <= 0) {
            levelTransition = false;
        }
        draw();
        return;
    }

    // Movimiento paleta
    if (keys.down('left')) paddleX -= PADDLE_SPEED;
    if (keys.down('right')) paddleX += PADDLE_SPEED;
    paddleX = Math.max(0, Math.min(WIDTH - paddleWidth, paddleX));

    // Trail de la primera bola
    if (balls.length > 0) {
        ballTrail.push({ x: balls[0].x, y: balls[0].y });
        if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();
    }

    // Actualizar power-ups
    updatePowerUps();

    // Actualizar cada bola
    let ballsToRemove = [];
    balls.forEach((ball, bi) => {
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Rebote lateral
        if (ball.x <= 0) { ball.speedX = Math.abs(ball.speedX); ball.x = 0; GameAudio.hit(); }
        if (ball.x + BALL_SIZE >= WIDTH) { ball.speedX = -Math.abs(ball.speedX); ball.x = WIDTH - BALL_SIZE; GameAudio.hit(); }

        // Rebote arriba
        if (ball.y <= 0) { ball.speedY = Math.abs(ball.speedY); ball.y = 0; GameAudio.hit(); }

        // Rebote con paleta
        if (ball.y + BALL_SIZE >= HEIGHT - PADDLE_HEIGHT - 10 &&
            ball.y + BALL_SIZE < HEIGHT - 5 &&
            ball.x + BALL_SIZE > paddleX && ball.x < paddleX + paddleWidth) {
            ball.speedY = -Math.abs(ball.speedY);
            ball.y = HEIGHT - PADDLE_HEIGHT - 10 - BALL_SIZE;
            // Ángulo basado en dónde golpeó la paleta
            const offset = (ball.x + BALL_SIZE / 2 - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
            ball.speedX += offset * 1.5;
            // Limitar velocidad
            const spd = Math.sqrt(ball.speedX ** 2 + ball.speedY ** 2);
            const maxSpd = activePowerUps.slowBall > 0 ? 4 : 7;
            if (spd > maxSpd) { ball.speedX *= maxSpd / spd; ball.speedY *= maxSpd / spd; }
            spawnRipple(ball.x + BALL_SIZE / 2, HEIGHT - PADDLE_HEIGHT - 10);
            GameAudio.paddle();
        }

        // Rebote con ladrillos
        bricks.forEach(brick => {
            if (!brick.status) return;
            if (ball.x + BALL_SIZE > brick.x && ball.x < brick.x + brickWidth &&
                ball.y + BALL_SIZE > brick.y && ball.y < brick.y + brickHeight) {
                ball.speedY *= -1;
                brick.status--;
                if (brick.status <= 0) {
                    brick.status = 0;
                    spawnBrickParticles(brick);
                    trySpawnPowerUp(brick);
                    score += 10 * currentLevel;
                    updateScore();
                    GameAudio.brick();
                } else {
                    // Golpe en bloque invencible: partículas pequeñas
                    spawnBrickParticles({ ...brick, color: '#aaaaaa' });
                    GameAudio.brick();
                }
            }
        });

        // Bola perdida
        if (ball.y + BALL_SIZE > HEIGHT) {
            ballsToRemove.push(bi);
        }
    });

    // Quitar bolas perdidas
    for (let i = ballsToRemove.length - 1; i >= 0; i--) {
        balls.splice(ballsToRemove[i], 1);
    }

    // Si no quedan bolas
    if (balls.length === 0) {
        ballTrail.length = 0;
        lives--;
        if (lives <= 0) {
            gameOver();
            return;
        } else {
            // Perder una vida: reponer bola
            resetBall();
        }
    }

    // Siguiente nivel: todos los ladrillos destruidos
    if (bricks.every(b => b.status === 0)) {
        GameAudio.win();
        currentLevel++;
        createBricks();
        resetBall();
        // Limpiar power-ups activos
        powerUps = [];
        activePowerUps = {};
        paddleWidth = BASE_PADDLE_WIDTH;
        // Mostrar transición
        levelTransition = true;
        levelTransitionTimer = LEVEL_TRANSITION_FRAMES;
    }

    updateBrickParticles();
    updateRipples();
    draw();
}

function resetBall() {
    const baseSpd = Math.min(4 + (currentLevel - 1) * 0.3, 7);
    balls = [{
        x: WIDTH/2 - BALL_SIZE/2,
        y: HEIGHT - 60,
        speedX: baseSpd * (Math.random() > 0.5 ? 1 : -1),
        speedY: -baseSpd
    }];
    ballTrail.length = 0;
}

var gameHud = GU.hud({
    score: document.getElementById('score'),
    highScore: document.getElementById('highScore'),
    mobile: { el: document.getElementById('mobileScore'), format: function () {
        return 'Puntaje: ' + score;
    } }
});

function updateScore() {
    gameBest.submit(score);
    highScore = gameBest.display(0);
    gameHud.set({ score: score, highScore: highScore });
}

function startGame() {
    GameAudio.start();
    paddleX = WIDTH/2 - BASE_PADDLE_WIDTH/2;
    paddleWidth = BASE_PADDLE_WIDTH;
    score = 0;
    lives = 3;
    currentLevel = 1;
    levelTransition = false;
    brickParticles.clear();
    ripples = [];
    powerUps = [];
    activePowerUps = {};
    ballTrail.length = 0;
    createBricks();
    resetBall();
    updateScore();
    draw();
    rafClear(gameInterval);
    gameInterval = rafInterval(update, speed);
    isPlaying = true;
    gameControls.running();
}

function restartGame() {
    startGame();
}

function gameOver() {
    rafClear(gameInterval);
    GameAudio.gameOver();
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = `Puntaje: ${score}  |  Nivel: ${currentLevel}`;
    isPlaying = false;
    gameControls.idle();
}

var gameControls = GU.controls({ start: startGame, restart: restartGame, playAgain: startGame, popup: 'gameOverPopup' });

// Teclado - movimiento continuo
/* GU.keys ata por ACCIÓN y suelta todo al perder el foco: antes, alt-tab con
 * una flecha pulsada dejaba la pala corriendo sola al volver. */
var keys = GU.keys({
    left:  ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd']
}, { preventDefault: true });

/* Los botones táctiles inyectan la MISMA acción que el teclado con keys.set(),
 * en vez de escribir en un mapa aparte: así la lógica consulta un solo sitio. */
function holdButton(btn, action) {
    if (!btn) return;
    var down = function (e) { if (e.cancelable) e.preventDefault(); keys.set(action, true); };
    var up   = function () { keys.set(action, false); };
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);
}

// Controles táctiles
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

holdButton(btnLeft, 'left');

holdButton(btnRight, 'right');

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
draw();

// Controles táctiles directos en canvas
(function() {
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (!isPlaying) {
            startGame();
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!isPlaying) return;
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var tx = (e.touches[0].clientX - rect.left) * scaleX;
        paddleX = Math.max(0, Math.min(WIDTH - paddleWidth, tx - paddleWidth / 2));
    }, { passive: false });
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
    }, { passive: false });
    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
})();

// ===== Saltador (Doodle Jump) =====
const canvas = document.getElementById('saltadorCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 360
const H = canvas.height;  // 600

// ---- Constantes ----
const GRAVITY = 0.32;
const JUMP_VELOCITY = -11.5;      // rebote normal
const SPRING_VELOCITY = -20;      // muelle (súper salto)
const MOVE_ACCEL = 0.9;
const MOVE_MAX = 6.5;
const MOVE_FRICTION = 0.86;
const PLAYER_W = 34;
const PLAYER_H = 38;
const PLAT_W = 64;
const PLAT_H = 14;
const PLAT_GAP_MIN = 60;
const PLAT_GAP_MAX = 95;
const SCROLL_LINE = H * 0.42;      // cuando el jugador sube por encima, hacemos scroll

// Tipos de plataforma
const T_NORMAL = 0;
const T_MOVING = 1;
const T_BREAK = 2;
const T_SPRING = 3;

const COL_NORMAL = '#4ade80';
const COL_MOVING = '#8fd3f4';
const COL_BREAK = '#ff512f';
const COL_SPRING = '#ffe066';

// ---- Estado ----
let state = {
    running: false,
    over: false,
    score: 0,
    highScore: 0,
    maxHeight: 0,     // altura mundial alcanzada (negativa hacia arriba)
    cameraY: 0,       // desplazamiento acumulado de cámara
    difficulty: 0,    // 0..1 según altura
    shake: 0,
};

const player = {
    x: W / 2,
    y: H - 120,
    vx: 0,
    vy: 0,
    facing: 1,
    blink: 0,
    blinkTimer: 60,
    squish: 0,        // para animación de aterrizaje (lerp)
};

let platforms = [];

// Pool de partículas compartido (game-utils.js)
const MAX_PARTICLES = 50;
const particles = new Particles(MAX_PARTICLES);
function spawnParticles(x, y, n, color, spread) {
    for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.5 + Math.random() * (spread || 3);
        /* 16-30 frames at 60fps; only vx is damped, so the spray still falls */
        if (!particles.add(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd - 1, {
            life: (16 + Math.random() * 14) / 60,
            size: 2 + Math.random() * 2.5,
            color: color, gravity: 0.12, drag: [0.96, 1], shape: 'square'
        })) break;
    }
}

// Estrellas de fondo (precomputadas)
const stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() < 0.8 ? 1 : 2,
        alpha: 0.2 + Math.random() * 0.6,
    });
}

// Caché de gradiente de fondo
let bgGrad = null;
function buildBg() {
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a1340');
    bgGrad.addColorStop(1, '#0c0a1e');
}
buildBg();

// ---- DOM ----
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const popup = document.getElementById('gameOverPopup');
const popupTitle = document.getElementById('popupTitle');
const finalScore = document.getElementById('finalScore');
const finalBest = document.getElementById('finalBest');
const mobileScore = document.getElementById('mobileScore');

function loadHigh() {
    state.highScore = GameStore.getNum('saltadorHighScore', 0);
    highScoreEl.textContent = state.highScore;
}
function saveHigh() {
    GameStore.set('saltadorHighScore', state.highScore);
}
loadHigh();

function updateHUD() {
    scoreEl.textContent = state.score;
    highScoreEl.textContent = state.highScore;
    mobileScore.textContent = 'Altura: ' + state.score + '   Récord: ' + state.highScore;
}

// ---- Generación de plataformas ----
function makePlatform(x, y, type) {
    const p = { x: x, y: y, type: type, broken: false, dir: 1, range: 0, baseX: x };
    if (type === T_MOVING) {
        p.dir = Math.random() < 0.5 ? -1 : 1;
        p.speed = 0.8 + Math.random() * 1.0;
        p.range = 40 + Math.random() * 50;
    }
    return p;
}

function pickType() {
    const d = state.difficulty;
    const r = Math.random();
    // a más dificultad, más móviles/rompibles
    if (r < 0.06 + d * 0.05) return T_SPRING;     // muelle (raro pero presente)
    if (r < 0.10 + d * 0.25) return T_BREAK;
    if (r < 0.20 + d * 0.45) return T_MOVING;
    return T_NORMAL;
}

function buildInitialPlatforms() {
    platforms = [];
    // plataforma base segura bajo el jugador
    platforms.push(makePlatform(W / 2 - PLAT_W / 2, H - 70, T_NORMAL));
    let y = H - 70;
    while (y > -200) {
        y -= PLAT_GAP_MIN + Math.random() * (PLAT_GAP_MAX - PLAT_GAP_MIN);
        const x = Math.random() * (W - PLAT_W);
        platforms.push(makePlatform(x, y, pickType()));
    }
}

function spawnPlatformAbove(topY) {
    const gap = PLAT_GAP_MIN + Math.random() * (PLAT_GAP_MAX - PLAT_GAP_MIN) * (0.7 + state.difficulty * 0.5);
    const y = topY - gap;
    const x = Math.random() * (W - PLAT_W);
    let type = pickType();
    // evita que dos rompibles seguidas hagan imposible avanzar: si es rompible, baja prob
    platforms.push(makePlatform(x, y, type));
    return y;
}

// ---- Input ----
let keyLeft = false, keyRight = false;
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keyLeft = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keyRight = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keyLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keyRight = false;
});

// Touch: mantener pulsada mitad izquierda/derecha
let touchLeft = false, touchRight = false;
function handleTouch(e) {
    touchLeft = false; touchRight = false;
    if (!state.running) return;
    for (let i = 0; i < e.touches.length; i++) {
        const x = GU.pointerPos(canvas, e.touches[i]).x;
        if (x < W / 2) touchLeft = true; else touchRight = true;
    }
}
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
canvas.addEventListener('touchcancel', (e) => { touchLeft = false; touchRight = false; }, { passive: false });

startBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });

// ---- Inicio ----
function startGame() {
    state.running = true;
    state.over = false;
    state.score = 0;
    state.maxHeight = 0;
    state.cameraY = 0;
    state.difficulty = 0;
    state.shake = 0;
    player.x = W / 2 - PLAYER_W / 2;
    player.y = H - 120;
    player.vx = 0;
    player.vy = JUMP_VELOCITY;
    player.facing = 1;
    player.squish = 0;
    player.blink = 0;
    player.blinkTimer = 60;
    keyLeft = keyRight = touchLeft = touchRight = false;
    particles.clear();
    buildInitialPlatforms();
    popup.style.display = 'none';
    restartBtn.disabled = false;
    updateHUD();
    GameAudio.start();
}

// ---- Actualización ----
function bounce(vel, isSpring) {
    player.vy = vel;
    player.squish = 1;
    if (isSpring) {
        GameAudio.powerUp();
        spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H, 14, COL_SPRING, 4);
    } else {
        GameAudio.jump();
        spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H, 6, '#ffffff', 2.5);
    }
}

function update() {
    if (!state.running) return;

    // movimiento horizontal
    const left = keyLeft || touchLeft;
    const right = keyRight || touchRight;
    if (left && !right) { player.vx -= MOVE_ACCEL; player.facing = -1; }
    else if (right && !left) { player.vx += MOVE_ACCEL; player.facing = 1; }
    else player.vx *= MOVE_FRICTION;
    if (player.vx > MOVE_MAX) player.vx = MOVE_MAX;
    if (player.vx < -MOVE_MAX) player.vx = -MOVE_MAX;
    player.x += player.vx;

    // wrap horizontal
    if (player.x + PLAYER_W < 0) player.x = W;
    else if (player.x > W) player.x = -PLAYER_W;

    // gravedad
    player.vy += GRAVITY;
    player.y += player.vy;

    // squish lerp de vuelta a 0
    player.squish += (0 - player.squish) * 0.18;

    // blink
    player.blinkTimer--;
    if (player.blinkTimer <= 0) {
        player.blink = 6;
        player.blinkTimer = 80 + Math.floor(Math.random() * 100);
    }
    if (player.blink > 0) player.blink--;

    // colisión con plataformas (solo cayendo)
    if (player.vy > 0) {
        const px = player.x + PLAYER_W / 2;
        const feet = player.y + PLAYER_H;
        for (let i = 0; i < platforms.length; i++) {
            const pl = platforms[i];
            if (pl.broken) continue;
            if (px > pl.x && px < pl.x + PLAT_W) {
                if (feet > pl.y && feet < pl.y + PLAT_H + 12 && player.vy > 0) {
                    if (pl.type === T_SPRING) {
                        bounce(SPRING_VELOCITY, true);
                    } else if (pl.type === T_BREAK) {
                        // se rompe: no rebota, se cae a través
                        pl.broken = true;
                        GameAudio.hit();
                        spawnParticles(pl.x + PLAT_W / 2, pl.y, 10, COL_BREAK, 3);
                    } else {
                        bounce(JUMP_VELOCITY, false);
                    }
                    break;
                }
            }
        }
    }

    // mover plataformas móviles
    for (let i = 0; i < platforms.length; i++) {
        const pl = platforms[i];
        if (pl.type === T_MOVING && !pl.broken) {
            pl.x += pl.dir * pl.speed;
            if (pl.x < 0) { pl.x = 0; pl.dir = 1; }
            else if (pl.x > W - PLAT_W) { pl.x = W - PLAT_W; pl.dir = -1; }
        }
    }

    // scroll de cámara cuando el jugador sube
    if (player.y < SCROLL_LINE) {
        const dy = SCROLL_LINE - player.y;
        player.y = SCROLL_LINE;
        state.cameraY += dy;
        // mueve plataformas y partículas hacia abajo
        for (let i = 0; i < platforms.length; i++) platforms[i].y += dy;
        particles.each(function (p) { p.y += dy; });
        // puntuación = altura (en decímetros aprox)
        const h = Math.floor(state.cameraY / 5);
        if (h > state.score) {
            state.score = h;
            updateHUD();
        }
        // dificultad
        state.difficulty = Math.min(1, state.cameraY / 6000);
    }

    // reciclar plataformas que salieron por abajo y crear nuevas arriba
    let topY = H;
    for (let i = 0; i < platforms.length; i++) {
        if (platforms[i].y < topY) topY = platforms[i].y;
    }
    platforms = platforms.filter(pl => pl.y < H + 20);
    while (topY > -40) {
        topY = spawnPlatformAbove(topY);
    }

    // partículas
    particles.update();

    if (state.shake > 0) state.shake--;

    // caída fatal
    if (player.y > H + 20) {
        endGame();
    }
}

function endGame() {
    state.running = false;
    state.over = true;
    state.shake = 8;
    restartBtn.disabled = true;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        saveHigh();
        finalBest.textContent = '¡Nuevo récord!';
    } else {
        finalBest.textContent = 'Récord: ' + state.highScore;
    }
    finalScore.textContent = 'Altura: ' + state.score;
    popupTitle.textContent = '¡Te caíste!';
    popup.style.display = 'flex';
    updateHUD();
    GameAudio.gameOver();
}

// ---- Dibujo ----
function drawBackground() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    // estrellas parallax
    ctx.fillStyle = '#ffffff';
    const off = (state.cameraY * 0.15) % H;
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        let y = (s.y + off) % H;
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
}

function drawPlatform(pl) {
    let color;
    if (pl.type === T_NORMAL) color = COL_NORMAL;
    else if (pl.type === T_MOVING) color = COL_MOVING;
    else if (pl.type === T_BREAK) color = COL_BREAK;
    else color = COL_SPRING;

    ctx.fillStyle = color;
    roundRect(pl.x, pl.y, PLAT_W, PLAT_H, 6);
    ctx.fill();
    // brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(pl.x + 4, pl.y + 2, PLAT_W - 8, 3);

    if (pl.type === T_SPRING) {
        // muelle dibujado encima
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const mx = pl.x + PLAT_W / 2;
        ctx.beginPath();
        ctx.moveTo(mx - 6, pl.y);
        ctx.lineTo(mx - 6, pl.y - 8);
        ctx.lineTo(mx + 6, pl.y - 5);
        ctx.lineTo(mx - 6, pl.y - 2);
        ctx.stroke();
    } else if (pl.type === T_MOVING) {
        // flechitas de dirección
        ctx.fillStyle = 'rgba(12,10,30,0.5)';
        ctx.fillRect(pl.x + PLAT_W / 2 - 1, pl.y + 4, 2, 6);
    }
}

function roundRect(x, y, w, h, r) { GU.roundRectPath(ctx, x, y, w, h, r); }

function drawPlayer() {
    const cx = player.x + PLAYER_W / 2;
    const cy = player.y + PLAYER_H / 2;
    // squish: al rebotar se estira vertical un poco
    const sq = player.squish;
    const sx = 1 - sq * 0.18;
    const sy = 1 + sq * 0.22;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);

    ctx.shadowBlur = 14;
    ctx.shadowColor = '#a78bfa';

    // cuerpo (cuerpo redondeado morado tipo criatura)
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.ellipse(0, 0, PLAYER_W / 2, PLAYER_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // panza más clara
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.ellipse(0, 4, PLAYER_W / 2 - 8, PLAYER_H / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // patas
    ctx.fillStyle = '#7c5cf0';
    ctx.fillRect(-9, PLAYER_H / 2 - 4, 6, 8);
    ctx.fillRect(3, PLAYER_H / 2 - 4, 6, 8);

    // ojos (mira hacia facing)
    const eyeOff = player.facing * 4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6 + eyeOff, -4, 5, 0, Math.PI * 2);
    ctx.arc(7 + eyeOff, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    // pupilas (o blink)
    if (player.blink > 0) {
        ctx.strokeStyle = '#1a1340';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10 + eyeOff, -4); ctx.lineTo(-2 + eyeOff, -4);
        ctx.moveTo(3 + eyeOff, -4); ctx.lineTo(11 + eyeOff, -4);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#1a1340';
        ctx.beginPath();
        ctx.arc(-6 + eyeOff + player.facing, -4, 2.4, 0, Math.PI * 2);
        ctx.arc(7 + eyeOff + player.facing, -4, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }
    // sonrisa
    ctx.strokeStyle = '#5b21b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(2 + eyeOff * 0.5, 4, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();
}

function drawParticles() {
    particles.draw(ctx);
}

function draw() {
    let ox = 0, oy = 0;
    if (state.shake > 0) {
        // Deterministic jitter from the shake counter (no Math.random in render)
        ox = Math.sin(state.shake * 12.9898) * state.shake * 0.5;
        oy = Math.cos(state.shake * 78.233) * state.shake * 0.5;
    }
    ctx.save();
    ctx.translate(ox, oy);

    drawBackground();

    for (let i = 0; i < platforms.length; i++) {
        if (!platforms[i].broken) drawPlatform(platforms[i]);
    }
    drawParticles();
    if (state.running) drawPlayer();

    ctx.restore();

    if (!state.running && !state.over) {
        ctx.fillStyle = 'rgba(12,10,30,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText('Pulsa Iniciar', W / 2, H / 2);
        ctx.textAlign = 'left';
    }
}

// ---- Loop ----
let lastFrameTs = 0;
function loop(ts) {
    if (ts - lastFrameTs < 15) {
        requestAnimationFrame(loop);
        return;
    }
    lastFrameTs = ts;
    update();
    draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
updateHUD();

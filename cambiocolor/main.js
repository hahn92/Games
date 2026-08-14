// Cambio de Color — Reflex color-matching game.
// La pelota cae con gravedad; cada tap la impulsa hacia arriba.
// Los anillos giratorios bajan desde arriba con 4 arcos de colores.
// La pelota debe pasar por el sector cuyo color coincida con el suyo.
// Al pasar un anillo, el color de la pelota cambia automáticamente.
//
// Mobile-first 360x560, requestAnimationFrame + delta time.

var canvas = document.getElementById('cambioCanvas');
var ctx    = canvas.getContext('2d');

var W = canvas.width;   // 360
var H = canvas.height;  // 560

/* ─────────────────────── Constantes ─────────────────────── */
var TAU          = Math.PI * 2;
var BALL_X       = W / 2;          // pelota centrada horizontalmente
var BALL_START_Y = H * 0.72;       // ~403
var BALL_R       = 14;

var GRAVITY      = 860;
var JUMP_V       = -380;
var MAX_FALL     = 750;
var MAX_UP       = -500;

var RING_R       = 112;            // radio externo
var RING_r       = 72;             // radio interno (hueco)
// grosor = 40 > 2*BALL_R (28) — sin tunneling

var SPAWN_GAP    = 340;            // separación entre anillos
var START_SCROLL = 100;            // px/s iniciales
var MAX_SCROLL   = 220;
var SCROLL_PER_PT= 1.5;            // aceleración más suave (era 3)

var PASS_MARGIN  = 28;             // px — zona de paso

/* ─────────────────────── Paleta ─────────────────────── */
var PALETTE = [
    { main: '#ff3aa4', glow: '#ff8ac4', name: 'MAGENTA' },
    { main: '#40d4ff', glow: '#8ce8ff', name: 'CIAN'    },
    { main: '#ffd54a', glow: '#ffe994', name: 'AMBAR'   },
    { main: '#6ef26e', glow: '#b6fbaa', name: 'VERDE'   }
];

var COL = {
    bgTop:    '#140b35',
    bgMid:    '#24093e',
    bgBot:    '#06031a',
    star:     'rgba(255,255,255,0.55)',
    ringEdge: 'rgba(255,255,255,0.30)',
    white:    '#ffffff',
    danger:   '#ff512f',
    hudBg:    'rgba(0,0,0,0.48)'
};

/* ─────────────────────── Estado ─────────────────────── */
var ball      = { x: BALL_X, y: BALL_START_Y, vy: 0, color: 0, trail: [] };
var obstacles = [];
var particles = [];
var stars     = [];
var score     = 0;
/* El récord va por GU.highScore: comparar, guardar y el valor por defecto
 * en un solo sitio. `best` se mantiene porque el resto del fichero la lee. */
var gameBest = GU.highScore('cambiocolorHighScore');

var best      = gameBest.display(0);
var scrollSpeed  = START_SCROLL;
var isPlaying    = false;
var isOver       = false;
/* decay 0.790 reproduce la duración del decremento lineal anterior
 * (14 → 0 restando 40 por segundo, unos 21 frames). La amplitud usaba la mitad
 * del valor, así que hit() recibe la mitad. */
var shake = new Shake({ decay: 0.790 });
var flashT       = 0;
var colorFlashT  = 0;
var lastT        = 0;
var animId       = null;

/* ─────────────────────── DOM ─────────────────────── */
var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');

highScoreEl.textContent = best;

/* ─────────────────────── Helpers ─────────────────────── */
function rand(a, b)    { return a + Math.random() * (b - a); }
function buildStars() {
    stars = [];
    for (var i = 0; i < 55; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            s: Math.random() < 0.75 ? 1 : 2,
            a: 0.2 + Math.random() * 0.55
        });
    }
}
buildStars();

var gameHud = GU.hud({
    score: scoreEl,
    mobile: { el: mobileScoreEl, format: function () {
        return 'Puntos: ' + score + ' · Récord: ' + Math.max(best, score);
    } }
});

function updateHUD() {
    gameHud.set({ score: score });
}

function resetState() {
    ball.x = BALL_X; ball.y = BALL_START_Y;
    ball.vy = 0; ball.color = 0; ball.trail.length = 0;
    obstacles.length = 0;
    particles.length = 0;
    score = 0;
    scrollSpeed = START_SCROLL;
    shake.stop();
    flashT = 0; colorFlashT = 0;
    isPlaying = false; isOver = false;
    seedInitialObstacles();
    updateHUD();
}

/* ─────────────────────── Spawner ─────────────────────── */
function makeRing(cy) {
    // Permutación aleatoria de [0,1,2,3]
    var colors = [0,1,2,3];
    for (var i = colors.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var tmp = colors[i]; colors[i] = colors[j]; colors[j] = tmp;
    }
    var dir      = Math.random() < 0.5 ? -1 : 1;
    var baseSpeed= 0.7 + Math.min(score, 60) * 0.01;
    return {
        cy:       cy,
        rotation: rand(0, TAU),
        rotSpeed: dir * baseSpeed,
        colors:   colors,
        scored:   false
    };
}

function seedInitialObstacles() {
    var y0 = -60;
    obstacles.push(makeRing(y0));
    obstacles.push(makeRing(y0 - SPAWN_GAP));
}

function maybeSpawn() {
    if (!obstacles.length) { seedInitialObstacles(); return; }
    var minY = Infinity;
    for (var i = 0; i < obstacles.length; i++) {
        if (obstacles[i].cy < minY) minY = obstacles[i].cy;
    }
    if (minY > -SPAWN_GAP) {
        obstacles.push(makeRing(minY - SPAWN_GAP));
    }
}

/* ─────────────────────── Color de la pelota ─────────────────────── */
function changeBallColor() {
    var opts = [];
    for (var i = 0; i < 4; i++) if (i !== ball.color) opts.push(i);
    ball.color = opts[(Math.random() * opts.length) | 0];
    GameAudio.powerUp();
    colorFlashT = 0.5;
}

/* ─────────────────────── Sector activo de un anillo ─────────────────────── */
// Devuelve el índice de color del sector en la posición de entrada de la pelota.
// La pelota entra por debajo del anillo (ángulo π/2 = 6 en punto).
function getActiveSector(ring) {
    var local = Math.PI / 2 - ring.rotation;
    local = ((local % TAU) + TAU) % TAU;
    var s = (local / (Math.PI / 2)) | 0;
    return clamp(s, 0, 3);
}

/* ─────────────────────── Colisión ─────────────────────── */
function checkRing(ring) {
    var dy    = ball.y - ring.cy;
    var adist = Math.abs(dy);
    if (adist - BALL_R > RING_R) return { hit: false };
    if (adist + BALL_R < RING_r) return { hit: false };

    // Ángulo de la pelota respecto al anillo: siempre ±π/2 (al centro)
    var angleWorld = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    var local = angleWorld - ring.rotation;
    local = ((local % TAU) + TAU) % TAU;

    var sectorW = Math.PI / 2;
    var sector  = clamp((local / sectorW) | 0, 0, 3);
    var obColor = ring.colors[sector];

    // Tolerancia en bordes de sector
    var inside = local - sector * sectorW;
    var TOL = 0.18;
    if (inside < TOL) {
        var prev = (sector + 3) % 4;
        if (ring.colors[prev] === ball.color) return { hit: true, wrong: false };
    }
    if (inside > sectorW - TOL) {
        var next = (sector + 1) % 4;
        if (ring.colors[next] === ball.color) return { hit: true, wrong: false };
    }

    return { hit: true, wrong: obColor !== ball.color };
}

/* ─────────────────────── Partículas ─────────────────────── */
function spawnPassParticles(x, y) {
    var pal = PALETTE[ball.color];
    for (var i = 0; i < 12; i++) {
        var ang = Math.random() * TAU;
        var sp  = 70 + Math.random() * 150;
        particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60,
            t: 0, life: 0.5, color: pal.glow, size: 2 + Math.random() * 2
        });
    }
}

function spawnColorParticles(x, y, colorIdx) {
    for (var i = 0; i < 16; i++) {
        var pal = PALETTE[colorIdx];
        var ang = (i / 16) * TAU;
        var sp  = 90 + Math.random() * 160;
        particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            t: 0, life: 0.6, color: pal.main, size: 2 + Math.random() * 3
        });
    }
}

function spawnDeathParticles(x, y) {
    for (var i = 0; i < 22; i++) {
        var ang = Math.random() * TAU;
        var sp  = 90 + Math.random() * 220;
        particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
            t: 0, life: 0.7, color: COL.danger, size: 2 + Math.random() * 3
        });
    }
}

/* ─────────────────────── Update ─────────────────────── */
function update(dt) {
    scrollSpeed = Math.min(MAX_SCROLL, START_SCROLL + score * SCROLL_PER_PT);

    // Física
    ball.vy += GRAVITY * dt;
    if (ball.vy > MAX_FALL) ball.vy = MAX_FALL;
    if (ball.vy < MAX_UP)   ball.vy = MAX_UP;
    ball.y  += ball.vy * dt;

    // Trail
    ball.trail.push(ball.y);
    if (ball.trail.length > 7) ball.trail.shift();

    // Límites
    if (ball.y > H + BALL_R) { endGame('fall'); return; }
    if (ball.y < -40) { ball.y = -40; if (ball.vy < 0) ball.vy = 80; }

    // Obstáculos
    var wrongHit = false;
    for (var i = obstacles.length - 1; i >= 0; i--) {
        var o = obstacles[i];
        o.cy       += scrollSpeed * dt;
        o.rotation += o.rotSpeed * dt;

        // Colisión
        if (!o.scored && Math.abs(ball.y - o.cy) < RING_R + BALL_R + 2) {
            var r = checkRing(o);
            if (r.hit && r.wrong) wrongHit = true;
        }

        // Pasar el anillo → sumar punto + cambiar color
        if (!o.scored && o.cy > ball.y + PASS_MARGIN) {
            o.scored = true;
            score++;
            flashT = 0.35;
            changeBallColor();
            spawnPassParticles(BALL_X, ball.y);
            spawnColorParticles(BALL_X, ball.y, ball.color);
            updateHUD();
            if (score % 10 === 0) GameAudio.scoreHigh();
            else                  GameAudio.score();
        }

        if (o.cy > H + RING_R + 20) obstacles.splice(i, 1);
    }

    // Partículas
    for (var k = particles.length - 1; k >= 0; k--) {
        var p = particles[k];
        p.t  += dt;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vy += 300 * dt;
        if (p.t > p.life) particles.splice(k, 1);
    }

    // Efectos
    flashT      = Math.max(0, flashT - dt * 2.0);
    colorFlashT = Math.max(0, colorFlashT - dt * 1.8);
    shake.update(dt);

    maybeSpawn();

    if (wrongHit) endGame('wrong');
}

/* ─────────────────────── Render ─────────────────────── */

/* El fondo es completamente estático: mismos topes y misma geometría en cada
 * frame. Se construía uno por frame igualmente. */
var bgGrad = GU.gradientMemo();

function drawBackground() {
    ctx.fillStyle = bgGrad('bg:' + H, function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0,    COL.bgTop);
        g.addColorStop(0.55, COL.bgMid);
        g.addColorStop(1,    COL.bgBot);
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = s.a;
        ctx.fillStyle   = COL.star;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // Línea guía vertical
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(BALL_X, 0);
    ctx.lineTo(BALL_X, H);
    ctx.stroke();
}

function drawRing(o) {
    var cx = BALL_X;
    var cy = o.cy;
    var sectorW = Math.PI / 2;
    var radius  = (RING_R + RING_r) / 2; // 92

    // Determinar sector activo (el que tocará la pelota al entrar por abajo)
    var activeSector = getActiveSector(o);
    var activePal    = PALETTE[o.colors[activeSector]];

    // Halo suave del anillo completo
    ctx.globalAlpha = 0.18;
    ctx.lineWidth   = RING_R - RING_r + 10;
    ctx.strokeStyle = activePal.glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4 sectores coloreados
    ctx.lineWidth = RING_R - RING_r;
    for (var i = 0; i < 4; i++) {
        var a0 = o.rotation + i * sectorW;
        var a1 = a0 + sectorW;
        ctx.strokeStyle = PALETTE[o.colors[i]].main;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, a0, a1);
        ctx.stroke();
    }

    // Sector activo: glow extra para que destaque
    var sa0 = o.rotation + activeSector * sectorW;
    var sa1 = sa0 + sectorW;
    ctx.lineWidth   = RING_R - RING_r + 6;
    ctx.strokeStyle = activePal.glow;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, sa0, sa1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Bordes interior y exterior
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = COL.ringEdge;
    ctx.beginPath(); ctx.arc(cx, cy, RING_R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, RING_r, 0, TAU); ctx.stroke();

    // ── Indicador de color activo en la zona de entrada (6 en punto) ──
    // Solo visible cuando el anillo está por encima del área de la pelota
    if (!o.scored) {
        var indicatorX = cx;
        var indicatorY = cy + radius; // punto exacto en el anillo a las 6 en punto

        // Círculo de color activo en el punto de entrada
        ctx.fillStyle   = activePal.main;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY, 9, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Triángulo apuntando hacia abajo (flecha guía bajo el anillo)
        var tipY = cy + RING_R + 20;
        ctx.fillStyle   = activePal.main;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(indicatorX - 9, cy + RING_R + 4);
        ctx.lineTo(indicatorX + 9, cy + RING_R + 4);
        ctx.lineTo(indicatorX,     tipY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function drawBall() {
    var pal = PALETTE[ball.color];

    // Trail
    for (var i = 0; i < ball.trail.length; i++) {
        var ty = ball.trail[i];
        var a  = (i + 1) / ball.trail.length;
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle   = pal.glow;
        ctx.beginPath();
        ctx.arc(BALL_X, ty, BALL_R * (0.55 + a * 0.25), 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cuerpo (gradient radial)
    var g = ctx.createRadialGradient(
        BALL_X - BALL_R * 0.35, ball.y - BALL_R * 0.4, 1,
        BALL_X, ball.y, BALL_R + 2
    );
    g.addColorStop(0,    pal.glow);
    g.addColorStop(0.55, pal.main);
    g.addColorStop(1,    '#000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(BALL_X, ball.y, BALL_R, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(BALL_X - BALL_R * 0.35, ball.y - BALL_R * 0.4, BALL_R * 0.32, 0, TAU);
    ctx.fill();
}

function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = Math.max(0, 1 - p.t / p.life);
        ctx.globalAlpha = a;
        ctx.fillStyle   = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawFlashes() {
    if (flashT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 0.14) + ')';
        ctx.fillRect(0, 0, W, H);
    }
    if (colorFlashT > 0) {
        var pal = PALETTE[ball.color];
        ctx.globalAlpha = colorFlashT * 0.32;
        ctx.fillStyle   = pal.glow;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }
}

// Indicador de color grande en la parte inferior
function drawColorIndicator() {
    var pal = PALETTE[ball.color];
    var cx  = W / 2;
    var cy  = H - 36;
    var r   = 22;

    // Fondo oscuro
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - 68, H - 66, 136, 52);

    // Círculo de color (pelota actual)
    var cg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r + 2);
    cg.addColorStop(0, pal.glow);
    cg.addColorStop(0.6, pal.main);
    cg.addColorStop(1, '#000');
    ctx.fillStyle   = cg;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Etiqueta "TU COLOR"
    ctx.fillStyle    = 'rgba(255,255,255,0.55)';
    ctx.font         = '10px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TU COLOR', cx, H - 65);

    // Nombre del color
    ctx.fillStyle = pal.glow;
    ctx.font      = 'bold 13px monospace';
    ctx.fillText(pal.name, cx, H - 52);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';
}

function drawHUD() {
    // Barra superior
    ctx.fillStyle = COL.hudBg;
    ctx.fillRect(0, 0, W, 30);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 14px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Puntos: ' + score, 8, 15);
    ctx.textAlign = 'right';
    ctx.fillText('Récord: ' + Math.max(best, score), W - 8, 15);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

    drawColorIndicator();
}

function drawInitialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CAMBIO DE COLOR', W / 2, H / 2 - 90);

    // Instrucciones con iconos de colores
    ctx.font      = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Toca para saltar la pelota.',    W / 2, H / 2 - 44);
    ctx.fillText('Pasa por el sector que tenga',   W / 2, H / 2 - 22);
    ctx.fillText('el mismo color que tu pelota.',  W / 2, H / 2 - 4);
    ctx.fillText('La flecha en el anillo indica',  W / 2, H / 2 + 18);
    ctx.fillText('por dónde debes entrar.',        W / 2, H / 2 + 36);
    ctx.fillText('Al pasar, tu color cambia.',     W / 2, H / 2 + 54);

    ctx.font      = 'bold 15px monospace';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Pulsa INICIAR o toca aquí',      W / 2, H / 2 + 96);
    ctx.textAlign = 'left';
}

function render() {
    ctx.save();
    shake.translate(ctx);   /* no hace nada si no hay sacudida activa */

    drawBackground();

    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (o.cy < -RING_R - 40 || o.cy > H + RING_R + 40) continue;
        drawRing(o);
    }

    drawBall();
    drawParticles();
    drawFlashes();
    drawHUD();

    if (!isPlaying && !isOver) drawInitialOverlay();

    ctx.restore();
}

/* ─────────────────────── Loop ─────────────────────── */
function loop(ts) {
    animId = requestAnimationFrame(loop);
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT  = ts;
    if (dt > 0.033) dt = 0.033;
    if (isPlaying && !isOver) update(dt);
    render();
}

/* ─────────────────────── Input ─────────────────────── */
function doJump() {
    if (!isPlaying || isOver) return;
    ball.vy = JUMP_V;
    GameAudio.jump();
}

/* ─────────────────────── Start / End ─────────────────────── */
function startGame() {
    resetState();
    isPlaying = true;
    isOver    = false;
    lastT     = 0;
    popup.style.display  = 'none';
    gameControls.running();
    updateHUD();
    GameAudio.start();
}

function endGame(reason) {
    if (isOver) return;
    isOver    = true;
    isPlaying = false;
    shake.hit(7);
    spawnDeathParticles(BALL_X, ball.y);
    if (gameBest.submit(score)) {
        best = gameBest.value;
    }
    highScoreEl.textContent  = best;
    finalScoreEl.textContent = 'Puntos: ' + score;
    finalBestEl.textContent  = 'Récord: ' + best;
    popup.style.display      = 'flex';
    startBtn.disabled        = false;
    GameAudio.gameOver();
}

/* ─────────────────────── Eventos ─────────────────────── */
var gameControls = GU.controls({ start: startGame });

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (!isPlaying && !isOver) { startGame(); doJump(); return; }
    if (isOver) return;
    doJump();
}, { passive: false });

canvas.addEventListener('mousedown', function() {
    if (!isPlaying && !isOver) { startGame(); doJump(); return; }
    if (isOver) return;
    doJump();
});

document.addEventListener('keydown', function(e) {
    var k = e.key;
    if (k === ' ' || k === 'Spacebar' || k === 'w' || k === 'W' || k === 'ArrowUp') {
        e.preventDefault();
        if (!isPlaying && !isOver) { startGame(); doJump(); return; }
        if (isOver) return;
        doJump();
    }
});

/* ─────────────────────── Arranque ─────────────────────── */
resetState();
render();
animId = requestAnimationFrame(loop);

// Ritmo — Piano-Tiles single-tap rhythm game.
// 4 carriles, bloques caen desde arriba. Toca el carril cuando el bloque cruce
// la línea de impacto. Velocidad creciente, 3 vidas, combos y récord persistente.
// Mobile-first 360x560, requestAnimationFrame + delta time, sin shadowBlur en
// loops, sin emojis en canvas, audio vía GameAudio (fuera del render).

var canvas = document.getElementById('ritmoCanvas');
var ctx = canvas.getContext('2d');

var W = canvas.width;   // 360
var H = canvas.height;  // 560

/* ─────────────────────── Constantes de juego ─────────────────────── */
var LANES         = 4;
var LANE_W        = W / LANES;            // 90 px
var HIT_LINE_Y    = H - 80;               // y de la línea de impacto
var HIT_WINDOW    = 70;                   // altura del rectángulo válido sobre la línea
var PERFECT_WIN   = 22;                   // ± distancia al centro para "perfecto"
var TILE_H        = 70;                   // alto del bloque
var START_SPEED   = 210;                  // px/s iniciales
var MAX_SPEED     = 540;
var SPEED_ACCEL   = 0.55;                 // px/s² continuo
var START_SPAWN   = 0.75;                 // seg entre spawns al inicio
var MIN_SPAWN     = 0.28;
var SPAWN_DECAY   = 0.018;                // reducción por segundo
var LIVES_MAX     = 3;
var MIN_LANE_GAP_PX = 110;                // separación mínima vertical entre tiles del mismo carril

/* ─────────────────────── Paleta ─────────────────────── */
var COL = {
    bgTop:   '#130738',
    bgMid:   '#2a0d5a',
    bgBot:   '#090218',
    laneLine:'rgba(255,255,255,0.07)',
    hitLine: '#8fd3f4',
    hitGlow: 'rgba(143,211,244,0.35)',
    tile: [
        { a: '#ff7ad9', b: '#a8247d' },   // carril 0 - rosa
        { a: '#ffd866', b: '#c27a11' },   // carril 1 - oro
        { a: '#7bf0c6', b: '#1e8a64' },   // carril 2 - turquesa
        { a: '#8fb4ff', b: '#2b4fa8' }    // carril 3 - azul
    ],
    perfect: '#ffffff',
    miss:    '#ff512f',
    heart:   '#ff5a7a',
    heartOff:'#3a1c2a',
    star:    'rgba(255,255,255,0.5)'
};

/* ─────────────────────── Estado ─────────────────────── */
var tiles         = [];         // {lane, y (top), hit, perfect, fadeT}
var pops          = [];         // {x, y, t, color, kind}      -> efectos hit/miss
var lanePulse     = [0,0,0,0];  // brillo temporal de cada carril al tocar
var score         = 0;
var combo         = 0;
var bestCombo     = 0;
var lives         = LIVES_MAX;
var speed         = START_SPEED;
var spawnEvery    = START_SPAWN;
var spawnTimer    = 0;
var hitFlash      = 0;          // flash global pequeño al acertar
var screenShake   = 0;
var shakeOffX     = 0;
var shakeOffY     = 0;
var elapsed       = 0;
/* El récord va por GU.highScore: comparar, guardar y el valor por defecto
 * en un solo sitio. `best` se mantiene porque el resto del fichero la lee. */
var gameBest = GU.highScore('ritmoHighScore');

var best          = gameBest.display(0);
var isPlaying     = false;
var isOver        = false;
var lastT         = 0;
var animId        = null;
var stars         = [];         // fondo cacheado

/* ─────────────────────── DOM refs ─────────────────────── */
var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var comboEl      = document.getElementById('combo');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');

highScoreEl.textContent = best;

/* ─────────────────────── Helpers ─────────────────────── */
function roundRect(x, y, w, h, r) { GU.roundRectPath(ctx, x, y, w, h, r); }

function buildStars() {
    stars = [];
    for (var i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            s: Math.random() < 0.7 ? 1 : 2,
            a: 0.25 + Math.random() * 0.55
        });
    }
}
buildStars();

var gameHud = GU.hud({
    score: scoreEl,
    combo: comboEl,
    mobile: { el: mobileScoreEl, format: function () {
        return 'Puntos: ' + score + ' · Combo: ' + combo + ' · Vidas: ' + lives;
    } }
});

function updateHUD() {
    gameHud.set({ score: score, combo: combo });
}

function resetState() {
    tiles.length = 0;
    pops.length = 0;
    lanePulse = [0,0,0,0];
    score = 0;
    combo = 0;
    bestCombo = 0;
    lives = LIVES_MAX;
    speed = START_SPEED;
    spawnEvery = START_SPAWN;
    spawnTimer = 0;
    hitFlash = 0;
    screenShake = 0;
    elapsed = 0;
    isPlaying = false;
    isOver = false;
    updateHUD();
}

/* ─────────────────────── Spawner ─────────────────────── */
function canSpawnInLane(lane) {
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        if (t.lane === lane && !t.hit && t.y < MIN_LANE_GAP_PX) return false;
    }
    return true;
}

function spawnTile() {
    // Elegir un carril válido al azar
    var pool = [];
    for (var i = 0; i < LANES; i++) if (canSpawnInLane(i)) pool.push(i);
    if (!pool.length) return;
    var lane = pool[(Math.random() * pool.length) | 0];
    tiles.push({
        lane: lane,
        y: -TILE_H,
        hit: false,
        perfect: false,
        fadeT: 0,
        dead: false
    });
}

/* ─────────────────────── Input ─────────────────────── */
function handleTap(x, y) {
    if (!isPlaying || isOver) return;
    var lane = (x / LANE_W) | 0;
    if (lane < 0) lane = 0;
    if (lane >= LANES) lane = LANES - 1;
    lanePulse[lane] = 1;

    // Buscar el tile más bajo (el más cercano a la línea) en ese carril
    var target = null, targetDist = 1e9;
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        if (t.hit || t.lane !== lane) continue;
        var cy = t.y + TILE_H / 2;
        if (cy > HIT_LINE_Y + HIT_WINDOW / 2) continue; // ya pasó
        if (cy < HIT_LINE_Y - HIT_WINDOW / 2) continue; // aún lejos
        var d = Math.abs(cy - HIT_LINE_Y);
        if (d < targetDist) { targetDist = d; target = t; }
    }

    if (target) {
        target.hit = true;
        target.fadeT = 0;
        target.perfect = targetDist <= PERFECT_WIN;
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        var base = target.perfect ? 3 : 2;
        var bonus = Math.floor(combo / 10);
        score += base + bonus;
        hitFlash = target.perfect ? 0.5 : 0.25;
        pops.push({
            x: lane * LANE_W + LANE_W / 2,
            y: HIT_LINE_Y,
            t: 0,
            color: target.perfect ? COL.perfect : COL.tile[lane].a,
            kind: target.perfect ? 'perfect' : 'good'
        });
        // audio: combos grandes → scoreHigh, resto → score
        if (combo > 0 && combo % 10 === 0) {
            GameAudio.scoreHigh();
        } else {
            GameAudio.score();
        }
        updateHUD();
    } else {
        // tap vacío/fuera de ventana: romper combo y restar vida
        loseLife(lane, HIT_LINE_Y);
        GameAudio.miss();
    }
}

function loseLife(lane, y) {
    combo = 0;
    lives--;
    screenShake = 10;
    pops.push({
        x: lane * LANE_W + LANE_W / 2,
        y: y,
        t: 0,
        color: COL.miss,
        kind: 'miss'
    });
    updateHUD();
    if (lives <= 0) endGame();
}

/* ─────────────────────── Update ─────────────────────── */
function update(dt) {
    elapsed += dt;

    // Dificultad progresiva
    speed = Math.min(MAX_SPEED, speed + SPEED_ACCEL * dt * 60);
    spawnEvery = Math.max(MIN_SPAWN, spawnEvery - SPAWN_DECAY * dt);

    // Spawn
    spawnTimer += dt;
    if (spawnTimer >= spawnEvery) {
        spawnTimer = 0;
        spawnTile();
    }

    // Tiles
    for (var i = tiles.length - 1; i >= 0; i--) {
        var t = tiles[i];
        if (t.hit) {
            t.fadeT += dt;
            if (t.fadeT > 0.25) tiles.splice(i, 1);
            continue;
        }
        t.y += speed * dt;
        // ¿ya pasó la línea sin tap? → miss (eliminar y restar vida)
        if (t.y > HIT_LINE_Y + HIT_WINDOW / 2) {
            tiles.splice(i, 1);
            loseLife(t.lane, HIT_LINE_Y);
            GameAudio.miss();
        }
    }

    // Efectos
    for (var j = pops.length - 1; j >= 0; j--) {
        pops[j].t += dt;
        if (pops[j].t > 0.45) pops.splice(j, 1);
    }
    for (var k = 0; k < LANES; k++) {
        lanePulse[k] = Math.max(0, lanePulse[k] - dt * 3.5);
    }
    hitFlash = Math.max(0, hitFlash - dt * 2.2);
    screenShake = Math.max(0, screenShake - dt * 40);
    // precomputar offset de shake fuera del render
    if (screenShake > 0) {
        shakeOffX = (Math.random() - 0.5) * screenShake * 0.5;
        shakeOffY = (Math.random() - 0.5) * screenShake * 0.5;
    } else {
        shakeOffX = 0;
        shakeOffY = 0;
    }
}

/* ─────────────────────── Render ─────────────────────── */
function drawBackground() {
    // gradiente vertical (cacheado por simplicidad, reconstruido cada frame pero
    // W/H no cambian y el coste es bajo — a diferencia de los per-elemento gradients)
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bgTop);
    g.addColorStop(0.55, COL.bgMid);
    g.addColorStop(1, COL.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // estrellas (fillRect es más barato que arc)
    for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = s.a;
        ctx.fillStyle = COL.star;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // líneas de carril
    ctx.strokeStyle = COL.laneLine;
    ctx.lineWidth = 1;
    for (var l = 1; l < LANES; l++) {
        ctx.beginPath();
        ctx.moveTo(l * LANE_W, 0);
        ctx.lineTo(l * LANE_W, H);
        ctx.stroke();
    }

    // pulso de carril al tocar
    for (var p = 0; p < LANES; p++) {
        if (lanePulse[p] > 0) {
            ctx.globalAlpha = lanePulse[p] * 0.25;
            ctx.fillStyle = COL.tile[p].a;
            ctx.fillRect(p * LANE_W, 0, LANE_W, H);
        }
    }
    ctx.globalAlpha = 1;
}

function drawHitLine() {
    // banda translúcida de zona de golpe
    ctx.fillStyle = COL.hitGlow;
    ctx.fillRect(0, HIT_LINE_Y - HIT_WINDOW / 2, W, HIT_WINDOW);
    // línea principal
    ctx.strokeStyle = COL.hitLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, HIT_LINE_Y);
    ctx.lineTo(W, HIT_LINE_Y);
    ctx.stroke();
    // destellos a los lados
    ctx.fillStyle = COL.hitLine;
    ctx.beginPath(); ctx.arc(6, HIT_LINE_Y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 6, HIT_LINE_Y, 3, 0, Math.PI * 2); ctx.fill();
}

function drawTiles() {
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        var x = t.lane * LANE_W + 6;
        var w = LANE_W - 12;
        var palette = COL.tile[t.lane];
        if (t.hit) {
            // animación de desvanecimiento al acertar
            var a = Math.max(0, 1 - t.fadeT / 0.25);
            ctx.globalAlpha = a;
            var grow = t.fadeT * 40;
            roundRect(x - grow / 2, t.y - grow / 2, w + grow, TILE_H + grow, 14);
            ctx.fillStyle = palette.a;
            ctx.fill();
            ctx.globalAlpha = 1;
            continue;
        }
        // El gradiente va de t.y a t.y+TILE_H y el tile cae cada frame, así que
        // la clave sería la posición: no se puede memoizar sin fugar un gradiente
        // por frame. Se reconstruye, pero UNA sola vez por tile — los sub-elementos
        // (borde, brillo, onda) reutilizan colores planos.
        var g2 = ctx.createLinearGradient(0, t.y, 0, t.y + TILE_H);
        g2.addColorStop(0, palette.a);
        g2.addColorStop(1, palette.b);
        roundRect(x, t.y, w, TILE_H, 12);
        ctx.fillStyle = g2;
        ctx.fill();
        // borde sutil
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // highlight superior
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundRect(x + 4, t.y + 4, w - 8, 10, 6);
        ctx.fill();
        // linea central decorativa (onda de sonido)
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        var midY = t.y + TILE_H * 0.68;
        ctx.moveTo(x + 10, midY);
        ctx.lineTo(x + w * 0.25, midY - 6);
        ctx.lineTo(x + w * 0.45, midY + 6);
        ctx.lineTo(x + w * 0.65, midY - 6);
        ctx.lineTo(x + w - 10, midY);
        ctx.stroke();
    }
}

function drawPops() {
    for (var i = 0; i < pops.length; i++) {
        var p = pops[i];
        var a = Math.max(0, 1 - p.t / 0.45);
        var r = 10 + p.t * 90;
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        if (p.kind === 'perfect') {
            ctx.globalAlpha = a;
            ctx.fillStyle = COL.perfect;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PERFECT', p.x, p.y - 18 - p.t * 20);
            ctx.textAlign = 'left';
        }
        ctx.globalAlpha = 1;
    }
}

function drawHeart(x, y, size, on) {
    var s = size;
    ctx.fillStyle = on ? COL.heart : COL.heartOff;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.55, y, x - s * 0.55, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.55, y + s * 0.65, x, y + s * 0.85, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.85, x + s * 0.55, y + s * 0.65, x + s * 0.55, y + s * 0.35);
    ctx.bezierCurveTo(x + s * 0.55, y, x, y, x, y + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawHUD() {
    // banda superior
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, 30);
    // score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Puntos: ' + score, 8, 15);
    ctx.textAlign = 'right';
    ctx.fillText('Récord: ' + Math.max(best, score), W - 8, 15);
    // vidas (corazones a la derecha, debajo)
    for (var i = 0; i < LIVES_MAX; i++) {
        drawHeart(W - 14 - i * 18, 38, 13, i < lives);
    }
    // combo en el centro si > 1
    if (combo > 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd866';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('x' + combo, W / 2, 52);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

function drawGlobalFlash() {
    if (hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (hitFlash * 0.15) + ')';
        ctx.fillRect(0, 0, W, H);
    }
}

function drawInitialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RITMO', W / 2, H / 2 - 60);
    ctx.font = '14px monospace';
    ctx.fillText('Toca el carril cuando el bloque', W / 2, H / 2 - 20);
    ctx.fillText('cruce la línea brillante.', W / 2, H / 2 + 0);
    ctx.fillText('3 vidas · combos crecientes', W / 2, H / 2 + 20);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Pulsa INICIAR o toca aquí', W / 2, H / 2 + 70);
    ctx.textAlign = 'left';
}

function render() {
    ctx.save();
    if (screenShake > 0) {
        ctx.translate(shakeOffX, shakeOffY);
    }
    drawBackground();
    drawHitLine();
    drawTiles();
    drawPops();
    drawGlobalFlash();
    drawHUD();
    if (!isPlaying && !isOver) drawInitialOverlay();
    ctx.restore();
}

/* ─────────────────────── Loop ─────────────────────── */
function loop(ts) {
    animId = requestAnimationFrame(loop);
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.08) dt = 0.08;            // evitar saltos tras tab inactivo
    if (isPlaying && !isOver) update(dt);
    render();
}

/* ─────────────────────── Start / End ─────────────────────── */
function startGame() {
    resetState();
    isPlaying = true;
    isOver = false;
    lastT = 0;
    popup.style.display = 'none';
    gameControls.running();
    updateHUD();
    GameAudio.start();
}

function endGame() {
    if (isOver) return;
    isOver = true;
    isPlaying = false;
    if (gameBest.submit(score)) {
        best = gameBest.value;
    }
    highScoreEl.textContent = best;
    finalScoreEl.textContent = 'Puntos: ' + score + ' · Mejor combo: x' + bestCombo;
    finalBestEl.textContent = 'Récord: ' + best;
    popup.style.display = 'flex';
    startBtn.disabled = false;
    GameAudio.gameOver();
}

/* ─────────────────────── Eventos ─────────────────────── */
var gameControls = GU.controls({ start: startGame });

// Tap / clic sobre el canvas
function canvasPos(clientX, clientY) {
    return GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
}

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    // si el juego no ha empezado, el primer tap arranca
    if (!isPlaying && !isOver) { startGame(); return; }
    if (isOver) return;
    var touches = e.changedTouches;
    for (var i = 0; i < touches.length; i++) {
        var p = canvasPos(touches[i].clientX, touches[i].clientY);
        handleTap(p.x, p.y);
    }
}, { passive: false });

canvas.addEventListener('mousedown', function (e) {
    if (!isPlaying && !isOver) { startGame(); return; }
    if (isOver) return;
    var p = canvasPos(e.clientX, e.clientY);
    handleTap(p.x, p.y);
});

// Teclado: A S K L → carriles 0..3 (alternativa desktop)
document.addEventListener('keydown', function (e) {
    if (!isPlaying || isOver) return;
    var lane = -1;
    var k = e.key.toLowerCase();
    if (k === 'a' || k === '1' || k === 'arrowleft') lane = 0;
    else if (k === 's' || k === '2') lane = 1;
    else if (k === 'k' || k === '3') lane = 2;
    else if (k === 'l' || k === '4' || k === 'arrowright') lane = 3;
    if (lane >= 0) {
        e.preventDefault();
        handleTap(lane * LANE_W + LANE_W / 2, HIT_LINE_Y);
    }
});

/* ─────────────────────── Arranque del render loop ─────────────────────── */
resetState();
render();
animId = requestAnimationFrame(loop);

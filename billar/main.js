'use strict';
/* =========================================================
   Billar — main.js
   Canvas 380×620 (vertical / cenital).
   Física:
     - Fricción exponencial sobre la velocidad.
     - Colisiones elásticas círculo-círculo con separación
       por penetración + impulso a lo largo de la normal.
     - Rebote contra los rieles (cojines) con restitución.
     - 6 troneras; si una bola entra dentro de su radio, se emboca.
   Apuntado: arrastrar desde la bola blanca. La distancia del
   arrastre define la potencia; la dirección, el tiro.
   ========================================================= */

(function () {

/* ── Canvas & contexto ──────────────────────────────────── */
var canvas = document.getElementById('billarCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 380
var H = canvas.height;  // 620

/* ── DOM ────────────────────────────────────────────────── */
var scoreEl     = document.getElementById('score');
var ballsEl     = document.getElementById('balls');
var highScoreEl = document.getElementById('highScore');
var startBtn    = document.getElementById('startBtn');
var restartBtn  = document.getElementById('restartBtn');
var playAgainBtn= document.getElementById('playAgainBtn');
var popup       = document.getElementById('gameOverPopup');
var popupTitle  = document.getElementById('popupTitle');
var finalScoreEl= document.getElementById('finalScore');
var finalBestEl = document.getElementById('finalBest');
var mobileScore = document.getElementById('mobileScore');

/* ── Persistencia ───────────────────────────────────────── */
var HS_KEY = 'billarHighScore';
var highScore = GameStore.getNum(HS_KEY, 0);
highScoreEl.textContent = highScore;

/* ── Constantes de mesa ─────────────────────────────────── */
var RAIL = 26;                 // grosor del riel/cojín
var PLAY_L = RAIL, PLAY_R = W - RAIL;
var PLAY_T = RAIL, PLAY_B = H - RAIL;
var BALL_R = 11;
var POCKET_R = 19;             // radio de tronera
var FRICTION = 1.4;            // coef. de fricción (mayor = para antes)
var RESTITUTION = 0.92;        // rebote bola-bola
var WALL_REST = 0.78;          // rebote contra cojín
var MIN_SPEED = 4;             // por debajo de esto la bola se detiene
var MAX_POWER = 1750;          // velocidad máxima del tiro
var DRAG_MAX = 150;            // px de arrastre para potencia máxima

/* ── Troneras (6) ───────────────────────────────────────── */
var pockets = [
    { x: PLAY_L + 2, y: PLAY_T + 2 },
    { x: W / 2,      y: PLAY_T - 4 },
    { x: PLAY_R - 2, y: PLAY_T + 2 },
    { x: PLAY_L + 2, y: PLAY_B - 2 },
    { x: W / 2,      y: PLAY_B + 4 },
    { x: PLAY_R - 2, y: PLAY_B - 2 }
];

/* ── Colores de bolas (1..7 + 8) ────────────────────────── */
var BALL_COLORS = {
    1: '#ffcf33', 2: '#3366ff', 3: '#ff3b30', 4: '#a64dff',
    5: '#ff8c1a', 6: '#1fbf4f', 7: '#a33b1f', 8: '#1a1a1a'
};

/* ── Estado ─────────────────────────────────────────────── */
var STATE = { IDLE: 0, AIM: 1, MOVING: 2, OVER: 3 };
var state = STATE.IDLE;
var score = 0;
var lastTime = 0;
var rafId = null;
var screenShake = 0;

var balls = [];      // {x,y,vx,vy,r,num,color,pocketed,sinkScale}
var cue = null;      // referencia a la bola blanca
/* Pool compartido (game-utils.js). Semi-implícito: este bucle amortiguaba
   la velocidad antes de mover, y ese orden cambia la trayectoria. */
var particles = new Particles(180, { semiImplicit: true });

/* ── Apuntado ───────────────────────────────────────────── */
var aiming = false;
var aimX = 0, aimY = 0;        // posición actual del puntero
var foulMsg = 0;               // temporizador del mensaje de falta

/* ── Gradientes cacheados ───────────────────────────────── */
var feltGrad = null;
function buildGradients() {
    feltGrad = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, H * 0.7);
    feltGrad.addColorStop(0, '#0f4d33');
    feltGrad.addColorStop(1, '#072518');
}

/* ═══════════════════════════════════════════════════════════
   SETUP DE BOLAS
═══════════════════════════════════════════════════════════ */
function makeBall(num, x, y) {
    return {
        x: x, y: y, vx: 0, vy: 0, r: BALL_R,
        num: num,
        color: num === 0 ? '#f5f5f5' : BALL_COLORS[num],
        striped: num >= 9,           // (no usado; reserva)
        pocketed: false,
        sinkScale: 1                 // animación de hundimiento
    };
}

function rackBalls() {
    balls = [];
    /* Triángulo de 8 bolas hacia la parte superior de la mesa */
    var startY = 170;
    var spacing = BALL_R * 2 + 1;
    var order = [1, 2, 3, 8, 4, 5, 6, 7]; // 8 en el centro del rack
    var idx = 0;
    var rows = [1, 2, 3, 2]; // 1+2+3+2 = 8
    var cx = W / 2;
    for (var row = 0; row < rows.length; row++) {
        var count = rows[row];
        var y = startY - row * (spacing * 0.88);
        var rowStartX = cx - (count - 1) * spacing / 2;
        for (var c = 0; c < count; c++) {
            if (idx >= order.length) break;
            var x = rowStartX + c * spacing;
            balls.push(makeBall(order[idx], x, y));
            idx++;
        }
    }
    /* Bola blanca abajo */
    cue = makeBall(0, W / 2, H - 150);
    balls.push(cue);
}

function remainingColored() {
    var n = 0;
    for (var i = 0; i < balls.length; i++) {
        if (balls[i].num !== 0 && !balls[i].pocketed) n++;
    }
    return n;
}

/* ═══════════════════════════════════════════════════════════
   PARTÍCULAS (pool)
═══════════════════════════════════════════════════════════ */
function spawnSink(x, y, color) {
    for (var i = 0; i < 14; i++) {
        var ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
        var spd = 40 + Math.random() * 90;
        /* px/s -> px/frame; alpha arranca en life/maxLife como antes */
        var lf = 0.5 + Math.random() * 0.3;
        particles.add(x, y, Math.cos(ang) * spd / 60, Math.sin(ang) * spd / 60, {
            life: lf, alpha: lf / 0.8,
            size: 2 + Math.random() * 2.5,
            color: color, drag: 0.92, shape: 'square'
        });
    }
}
function updateParticles(dt) {
    particles.update(dt);
}

/* ═══════════════════════════════════════════════════════════
   FÍSICA
═══════════════════════════════════════════════════════════ */
function anyMoving() {
    for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b.pocketed) continue;
        if (b.vx * b.vx + b.vy * b.vy > MIN_SPEED * MIN_SPEED) return true;
    }
    return false;
}

function updatePhysics(dt) {
    var i, b;
    /* Integración + fricción */
    for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.pocketed) {
            if (b.sinkScale > 0) b.sinkScale -= dt * 3;
            continue;
        }
        var fr = Math.exp(-FRICTION * dt);
        b.vx *= fr; b.vy *= fr;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        var sp2 = b.vx * b.vx + b.vy * b.vy;
        if (sp2 < MIN_SPEED * MIN_SPEED) { b.vx = 0; b.vy = 0; }
    }

    /* Colisiones contra cojines */
    for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.pocketed) continue;
        var hitWall = false;
        if (b.x - b.r < PLAY_L) { b.x = PLAY_L + b.r; b.vx = -b.vx * WALL_REST; hitWall = true; }
        else if (b.x + b.r > PLAY_R) { b.x = PLAY_R - b.r; b.vx = -b.vx * WALL_REST; hitWall = true; }
        if (b.y - b.r < PLAY_T) { b.y = PLAY_T + b.r; b.vy = -b.vy * WALL_REST; hitWall = true; }
        else if (b.y + b.r > PLAY_B) { b.y = PLAY_B - b.r; b.vy = -b.vy * WALL_REST; hitWall = true; }
        if (hitWall && (Math.abs(b.vx) + Math.abs(b.vy)) > 60) pendingWall = true;
    }

    /* Colisiones bola-bola (elásticas) */
    for (i = 0; i < balls.length; i++) {
        var b1 = balls[i];
        if (b1.pocketed) continue;
        for (var j = i + 1; j < balls.length; j++) {
            var b2 = balls[j];
            if (b2.pocketed) continue;
            var dx = b2.x - b1.x, dy = b2.y - b1.y;
            var dist2 = dx * dx + dy * dy;
            var minD = b1.r + b2.r;
            if (dist2 < minD * minD && dist2 > 0.0001) {
                var dist = Math.sqrt(dist2);
                var nx = dx / dist, ny = dy / dist;
                var overlap = minD - dist;
                /* separación */
                b1.x -= nx * overlap * 0.5; b1.y -= ny * overlap * 0.5;
                b2.x += nx * overlap * 0.5; b2.y += ny * overlap * 0.5;
                /* velocidad relativa a lo largo de la normal */
                var rvx = b2.vx - b1.vx, rvy = b2.vy - b1.vy;
                var relV = rvx * nx + rvy * ny;
                if (relV < 0) {
                    var impulse = -(1 + RESTITUTION) * relV / 2;
                    b1.vx -= impulse * nx; b1.vy -= impulse * ny;
                    b2.vx += impulse * nx; b2.vy += impulse * ny;
                    if (Math.abs(relV) > 90) pendingClack = true;
                }
            }
        }
    }

    /* Troneras */
    for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.pocketed) continue;
        for (var p = 0; p < pockets.length; p++) {
            var pdx = b.x - pockets[p].x, pdy = b.y - pockets[p].y;
            if (pdx * pdx + pdy * pdy < POCKET_R * POCKET_R) {
                sinkBall(b);
                break;
            }
        }
    }
}

/* señales de sonido (procesadas tras el update, fuera de render) */
var pendingClack = false;
var pendingWall = false;
var sunkThisTurn = [];

function sinkBall(b) {
    b.pocketed = true;
    b.vx = 0; b.vy = 0;
    spawnSink(b.x, b.y, b.num === 0 ? '#bbbbbb' : b.color);
    sunkThisTurn.push(b);
    screenShake = Math.max(screenShake, 6);
}

/* Procesa los resultados al final de un turno (cuando todo se detiene) */
function resolveTurn() {
    var foul = false;
    var gained = 0;
    for (var i = 0; i < sunkThisTurn.length; i++) {
        var b = sunkThisTurn[i];
        if (b.num === 0) {
            foul = true;
        } else if (b.num === 8) {
            gained += 200;
        } else {
            gained += 100;
        }
    }
    if (gained > 0) { score += gained; GameAudio.score(); }
    if (foul) {
        score = Math.max(0, score - 75);
        foulMsg = 2.2;
        GameAudio.gameOver(); // sonido de falta (penalización)
        /* reponer la bola blanca */
        respawnCue();
    }
    sunkThisTurn = [];
    updateHud();

    /* Victoria: todas las de color embocadas */
    if (remainingColored() === 0) {
        endGame(true);
    }
}

function respawnCue() {
    cue.pocketed = false;
    cue.sinkScale = 1;
    cue.vx = 0; cue.vy = 0;
    /* buscar punto libre en la zona baja */
    var tryX = W / 2, tryY = H - 150;
    cue.x = tryX; cue.y = tryY;
    /* empujar si solapa con otra */
    for (var k = 0; k < 30; k++) {
        var clash = false;
        for (var i = 0; i < balls.length; i++) {
            var b = balls[i];
            if (b === cue || b.pocketed) continue;
            var dx = b.x - cue.x, dy = b.y - cue.y;
            if (dx * dx + dy * dy < (BALL_R * 2.2) * (BALL_R * 2.2)) { clash = true; break; }
        }
        if (!clash) break;
        cue.x = PLAY_L + BALL_R + Math.random() * (PLAY_R - PLAY_L - BALL_R * 2);
        cue.y = H - 200 + Math.random() * 80;
    }
}

/* ═══════════════════════════════════════════════════════════
   TIRO
═══════════════════════════════════════════════════════════ */
function shoot() {
    if (cue.pocketed) return;
    var dx = cue.x - aimX, dy = cue.y - aimY; // tirar en dirección opuesta al arrastre
    var drag = Math.sqrt(dx * dx + dy * dy);
    if (drag < 6) return;
    var power = Math.min(drag, DRAG_MAX) / DRAG_MAX;
    var speed = power * MAX_POWER;
    var nx = dx / drag, ny = dy / drag;
    cue.vx = nx * speed;
    cue.vy = ny * speed;
    state = STATE.MOVING;
    pendingClack = false; pendingWall = false;
    GameAudio.paddle(); // golpe del taco
}

/* ═══════════════════════════════════════════════════════════
   DIBUJO
═══════════════════════════════════════════════════════════ */
function drawTable() {
    /* riel exterior (madera) */
    ctx.fillStyle = '#5a3318';
    roundRectPath(2, 2, W - 4, H - 4, 14);
    ctx.fill();
    /* paño */
    ctx.fillStyle = feltGrad;
    ctx.fillRect(PLAY_L, PLAY_T, PLAY_R - PLAY_L, PLAY_B - PLAY_T);

    /* líneas de cojín neón */
    ctx.strokeStyle = 'rgba(143,211,244,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PLAY_L, PLAY_T, PLAY_R - PLAY_L, PLAY_B - PLAY_T);

    /* punto de cabeza (línea base de la blanca) */
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PLAY_L, H - 170);
    ctx.lineTo(PLAY_R, H - 170);
    ctx.stroke();

    /* troneras */
    for (var i = 0; i < pockets.length; i++) {
        var p = pockets[i];
        ctx.beginPath();
        ctx.fillStyle = '#020806';
        ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawBalls() {
    for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b.pocketed && b.sinkScale <= 0) continue;
        var r = b.r * (b.pocketed ? Math.max(0, b.sinkScale) : 1);
        if (r <= 0.5) continue;

        /* sombra */
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.arc(b.x + 2.5, b.y + 3, r, 0, Math.PI * 2);
        ctx.fill();

        /* cuerpo (gradiente radial por bola con offset de luz) */
        var g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.15, b.x, b.y, r);
        g.addColorStop(0, lighten(b.color, 70));
        g.addColorStop(0.5, b.color);
        g.addColorStop(1, darken(b.color, 40));
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        /* círculo blanco con número (excepto blanca) */
        if (b.num !== 0) {
            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(b.x, b.y, r * 0.46, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.font = 'bold ' + Math.round(r * 0.7) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(b.num), b.x, b.y + 0.5);
        }

        /* brillo especular */
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.arc(b.x - r * 0.32, b.y - r * 0.36, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawAim() {
    if (!aiming || cue.pocketed) return;
    var dx = cue.x - aimX, dy = cue.y - aimY;
    var drag = Math.sqrt(dx * dx + dy * dy);
    if (drag < 4) return;
    var nx = dx / drag, ny = dy / drag;
    var power = Math.min(drag, DRAG_MAX) / DRAG_MAX;

    /* línea de guía (proyección) */
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(143,211,244,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(cue.x + nx * 240, cue.y + ny * 240);
    ctx.stroke();
    ctx.restore();

    /* círculo fantasma en la dirección */
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.arc(cue.x + nx * 30, cue.y + ny * 30, BALL_R, 0, Math.PI * 2);
    ctx.stroke();

    /* taco (línea desde el lado opuesto) */
    ctx.strokeStyle = '#c9a063';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cue.x - nx * (18 + power * 40), cue.y - ny * (18 + power * 40));
    ctx.lineTo(cue.x - nx * (18 + power * 40 + 130), cue.y - ny * (18 + power * 40 + 130));
    ctx.stroke();

    /* barra de potencia */
    var barW = 150, barH = 12, bx = (W - barW) / 2, by = H - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRectPath(bx, by, barW, barH, 6); ctx.fill();
    var pg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    pg.addColorStop(0, '#8fd3f4'); pg.addColorStop(1, '#ff512f');
    ctx.fillStyle = pg;
    roundRectPath(bx, by, barW * power, barH, 6); ctx.fill();
}

function drawParticles() {
    particles.draw(ctx);
}

function drawHud() {
    if (foulMsg > 0) {
        ctx.fillStyle = 'rgba(255,81,47,' + Math.min(1, foulMsg) + ')';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¡Falta! -75', W / 2, 60);
    }
}

function drawIdle() {
    ctx.fillStyle = feltGrad;
    ctx.fillRect(0, 0, W, H);
    drawTable();
    drawBalls();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BILLAR', W / 2, H / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Pulsa Iniciar para jugar', W / 2, H / 2 + 14);
}

/* ── helpers de color ───────────────────────────────────── */
function lighten(hex, amt) { return shade(hex, amt); }
function darken(hex, amt) { return shade(hex, -amt); }

function roundRectPath(x, y, w, h, r) { GU.roundRectPath(ctx, x, y, w, h, r); }

/* ═══════════════════════════════════════════════════════════
   HUD
═══════════════════════════════════════════════════════════ */
var gameHud = GU.hud({
    score: scoreEl,
    balls: ballsEl,
    mobile: { el: mobileScore, format: function () {
        return 'Puntos: ' + score + '  ·  Bolas: ' + remainingColored() + '  ·  Récord: ' + highScore;
    } }
});

function updateHud() {
    gameHud.set({ score: score, balls: remainingColored() });
}

/* ═══════════════════════════════════════════════════════════
   FLUJO DE JUEGO
═══════════════════════════════════════════════════════════ */
function startGame() {
    score = 0;
    particles.clear();
    sunkThisTurn = [];
    foulMsg = 0;
    screenShake = 0;
    pendingClack = false; pendingWall = false;
    rackBalls();
    state = STATE.AIM;
    aiming = false;
    restartBtn.disabled = false;
    popup.style.display = 'none';
    updateHud();
    GameAudio.start();
    if (!rafId) { lastTime = performance.now(); rafId = requestAnimationFrame(loop); }
}

function endGame(win) {
    state = STATE.OVER;
    if (score > highScore) {
        highScore = score;
        GameStore.set(HS_KEY, highScore);
        highScoreEl.textContent = highScore;
    }
    popupTitle.textContent = win ? '¡Mesa limpia!' : 'Fin del juego';
    finalScoreEl.textContent = 'Puntos: ' + score;
    finalBestEl.textContent = 'Récord: ' + highScore;
    popup.style.display = 'flex';
    if (win) GameAudio.win(); else GameAudio.gameOver();
    updateHud();
}

/* ═══════════════════════════════════════════════════════════
   LOOP
═══════════════════════════════════════════════════════════ */
function loop(ts) {
    if (ts - lastTime < 15) { rafId = requestAnimationFrame(loop); return; }
    var dt = Math.min((ts - lastTime) / 1000, 0.033);
    lastTime = ts;

    if (state === STATE.IDLE) {
        drawIdle();
        rafId = requestAnimationFrame(loop);
        return;
    }
    if (state === STATE.OVER) {
        rafId = requestAnimationFrame(loop);
        return;
    }

    if (state === STATE.MOVING) {
        updatePhysics(dt);
        /* sonidos diferidos (fuera de render) */
        if (pendingClack) { GameAudio.hit(); pendingClack = false; }
        if (pendingWall) { GameAudio.tick(); pendingWall = false; }
        if (!anyMoving()) {
            resolveTurn();
            if (state !== STATE.OVER) state = STATE.AIM;
        }
    }
    updateParticles(dt);
    if (foulMsg > 0) foulMsg -= dt;

    /* shake */
    var sx = 0, sy = 0;
    if (screenShake > 0) {
        sx = (Math.random() - 0.5) * screenShake;
        sy = (Math.random() - 0.5) * screenShake;
        screenShake -= dt * 30;
        if (screenShake < 0) screenShake = 0;
    }
    if (sx || sy) { ctx.save(); ctx.translate(sx, sy); }

    drawTable();
    drawBalls();
    drawParticles();
    if (state === STATE.AIM) drawAim();
    drawHud();

    if (sx || sy) ctx.restore();

    rafId = requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════════════════════
   INPUT
═══════════════════════════════════════════════════════════ */
function canvasPos(clientX, clientY) {
    return GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
}

function onDown(x, y) {
    if (state !== STATE.AIM || cue.pocketed) return;
    aiming = true;
    aimX = x; aimY = y;
}
function onMove(x, y) {
    if (!aiming) return;
    aimX = x; aimY = y;
}
function onUp() {
    if (!aiming) return;
    aiming = false;
    if (state === STATE.AIM) shoot();
}

canvas.addEventListener('mousedown', function (e) {
    var p = canvasPos(e.clientX, e.clientY); onDown(p.x, p.y);
});
canvas.addEventListener('mousemove', function (e) {
    var p = canvasPos(e.clientX, e.clientY); onMove(p.x, p.y);
});
window.addEventListener('mouseup', function () { onUp(); });

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var p = canvasPos(t.clientX, t.clientY); onDown(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var p = canvasPos(t.clientX, t.clientY); onMove(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    onUp();
}, { passive: false });

/* botones */
var gameControls = GU.controls({ start: startGame, popup: 'gameOverPopup' });

/* ── init ───────────────────────────────────────────────── */
buildGradients();
rackBalls();
updateHud();
state = STATE.IDLE;
lastTime = performance.now();
rafId = requestAnimationFrame(loop);

})();

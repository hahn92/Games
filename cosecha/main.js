// La Cosecha — Gestión de recursos simple.
// El jugador administra una granja 3×3: planta semillas, espera que maduren
// y cosecha para obtener monedas. Invierte en semillas más rentables.
// 90 segundos, monedas totales = puntuación final.
//
// Mobile-first 360x560, requestAnimationFrame + delta time.
// Sin emojis, sin shadowBlur, sin setInterval.

var canvas = document.getElementById('cosechaCanvas');
var ctx    = canvas.getContext('2d');

var W = canvas.width;   // 360
var H = canvas.height;  // 560

/* ─────────────────────── Layout ─────────────────────── */
// HUD top (monedas / tiempo / récord)       : y  ≤ 74
// Grid 3×3 de terrenos                      : y 92..386
// Mercado (3 semillas)                      : y 406..526
// Texto de ayuda                            : y 534..554

var HUD_H        = 74;

var GRID_ROWS    = 3;
var GRID_COLS    = 3;
var GRID_TOP     = 92;
var GRID_PAD     = 14;
var CELL_W       = (W - GRID_PAD * (GRID_COLS + 1)) / GRID_COLS;  // ~98
var CELL_H       = 98;
var GRID_BOTTOM  = GRID_TOP + GRID_ROWS * CELL_H + (GRID_ROWS - 1) * 2;

var SHOP_TOP     = 406;
var SHOP_H       = 120;
var SLOT_W       = (W - 40) / 3;
var SLOT_GAP     = 10;

/* ─────────────────────── Parámetros de juego ─────────────────────── */
var START_COINS  = 10;
var GAME_LEN     = 90;          // segundos

// cost = coste monedas, grow = seg para madurar, yield = monedas al cosechar
var SEEDS = [
    { id: 0, name: 'Trigo',    cost: 1,  grow: 5,  yield: 3,  color: '#e9c66b', stalk: '#8c5a1a' },
    { id: 1, name: 'Maíz',     cost: 4,  grow: 10, yield: 11, color: '#ffd83a', stalk: '#2e7d2e' },
    { id: 2, name: 'Calabaza', cost: 12, grow: 20, yield: 40, color: '#ff7a1f', stalk: '#2e7d2e' }
];

/* ─────────────────────── Paleta ─────────────────────── */
var COL = {
    bgTop:   '#2a180a',
    bgMid:   '#3a2410',
    bgBot:   '#1a0f06',
    sky0:    '#4d8ec9',
    sky1:    '#fbb871',
    soil0:   '#6b421c',
    soil1:   '#4b2c10',
    soilHi:  '#8a5a2b',
    plotEmpty: '#5b3718',
    plotHover: '#7a4a22',
    plotMature:'#c48024',
    hudBg:   'rgba(0,0,0,0.55)',
    text:    '#f2e6c7',
    textDim: '#c7b98a',
    gold:    '#ffd54a',
    danger:  '#ff512f',
    shopBg:  'rgba(24,16,8,0.82)',
    slotBg:  '#3a2410',
    slotSel: '#ffd54a',
    slotDim: '#2b1a0c'
};

/* ─────────────────────── Estado ─────────────────────── */
var plots = [];         // 9 plots; cada uno: { seedId, plantedAt, matureAt } o null
var coins = START_COINS;
var earned = START_COINS;  // monedas totales ganadas (score)
var best = GameStore.getNum('cosechaHighScore', 0);
var selectedSeed = 0;   // índice de SEEDS
var timeLeft = GAME_LEN;
var isPlaying = false;
var isOver = false;
var particles = [];
var flashTimer = 0;
var shakeTimer = 0;
var lastT = 0;
var animId = null;
var tickSoundTimer = 0;
var lastTickSecond = -1;

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

/* ─────────────────────── Utilidades ─────────────────────── */
function now() { return performance.now() / 1000; }

function plotRect(idx) {
    var r = Math.floor(idx / GRID_COLS);
    var c = idx % GRID_COLS;
    var x = GRID_PAD + c * (CELL_W + GRID_PAD);
    var y = GRID_TOP + r * (CELL_H + 2);
    return { x: x, y: y, w: CELL_W, h: CELL_H };
}

function slotRect(i) {
    var x = 20 + i * (SLOT_W + SLOT_GAP) - (i > 0 ? SLOT_GAP : 0);
    // distribuir proporcionalmente 3 slots en (W - 40) con 2 gaps
    x = 20 + i * ((W - 40 - 2 * SLOT_GAP) / 3 + SLOT_GAP);
    return { x: x, y: SHOP_TOP + 8, w: (W - 40 - 2 * SLOT_GAP) / 3, h: SHOP_H - 20 };
}

function plotAtPoint(px, py) {
    for (var i = 0; i < 9; i++) {
        var r = plotRect(i);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
}

function slotAtPoint(px, py) {
    if (py < SHOP_TOP || py > SHOP_TOP + SHOP_H) return -1;
    for (var i = 0; i < 3; i++) {
        var r = slotRect(i);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
}

function plantProgress(plot) {
    if (!plot) return 0;
    var elapsed = now() - plot.plantedAt;
    return Math.max(0, Math.min(1, elapsed / (plot.matureAt - plot.plantedAt)));
}

function isMature(plot) { return plot && plantProgress(plot) >= 1; }

/* ─────────────────────── Partículas ─────────────────────── */
function spawnCoinBurst(cx, cy, amount) {
    var n = Math.min(14, 4 + Math.floor(amount / 4));
    for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 80 + Math.random() * 140;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            life: 0.7 + Math.random() * 0.3,
            maxLife: 1.0,
            type: 'coin',
            size: 4 + Math.random() * 3
        });
    }
}

function spawnSeedPuff(cx, cy) {
    for (var i = 0; i < 8; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        var sp = 30 + Math.random() * 60;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 20,
            life: 0.5,
            maxLife: 0.5,
            type: 'dust',
            size: 3 + Math.random() * 2
        });
    }
}

function spawnDenyShake(cx, cy) {
    for (var i = 0; i < 6; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 40 + Math.random() * 60;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.35,
            maxLife: 0.35,
            type: 'deny',
            size: 3
        });
    }
    shakeTimer = 0.25;
}

function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt; // gravedad
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

/* ─────────────────────── Acciones ─────────────────────── */
function resetGame() {
    plots = [];
    for (var i = 0; i < 9; i++) plots.push(null);
    coins = START_COINS;
    earned = START_COINS;
    selectedSeed = 0;
    timeLeft = GAME_LEN;
    particles.length = 0;
    flashTimer = 0;
    shakeTimer = 0;
    lastTickSecond = -1;
    isOver = false;
    updateHUD();
    hidePopup();
}

function startGame() {
    resetGame();
    isPlaying = true;
    startBtn.disabled = true;
    restartBtn.disabled = false;
    lastT = now();
    GameAudio.start();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
}

function endGame() {
    isPlaying = false;
    isOver = true;
    startBtn.disabled = false;
    if (earned > best) {
        best = earned;
        GameStore.set('cosechaHighScore', best);
        highScoreEl.textContent = best;
    }
    GameAudio.gameOver();
    showPopup();
}

function tryPlant(plotIdx) {
    if (!isPlaying || isOver) return;
    var seed = SEEDS[selectedSeed];
    var plot = plots[plotIdx];
    if (plot) {
        // ¿está maduro? → cosecha
        if (isMature(plot)) {
            harvest(plotIdx);
        } else {
            // crecimiento en progreso: no puede plantar encima
            var r = plotRect(plotIdx);
            spawnDenyShake(r.x + r.w / 2, r.y + r.h / 2);
            GameAudio.noMatch();
        }
        return;
    }
    // plot vacío
    if (coins < seed.cost) {
        var r2 = plotRect(plotIdx);
        spawnDenyShake(r2.x + r2.w / 2, r2.y + r2.h / 2);
        GameAudio.noMatch();
        return;
    }
    coins -= seed.cost;
    var t = now();
    plots[plotIdx] = {
        seedId: seed.id,
        plantedAt: t,
        matureAt: t + seed.grow
    };
    var r3 = plotRect(plotIdx);
    spawnSeedPuff(r3.x + r3.w / 2, r3.y + r3.h / 2);
    GameAudio.place();
    updateHUD();
}

function harvest(plotIdx) {
    var plot = plots[plotIdx];
    if (!plot) return;
    var seed = SEEDS[plot.seedId];
    coins += seed.yield;
    earned += seed.yield;
    var r = plotRect(plotIdx);
    spawnCoinBurst(r.x + r.w / 2, r.y + r.h / 2, seed.yield);
    plots[plotIdx] = null;
    flashTimer = 0.2;
    if (seed.yield >= 20) GameAudio.scoreHigh(); else GameAudio.score();
    updateHUD();
}

/* ─────────────────────── HUD ─────────────────────── */
function updateHUD() {
    scoreEl.textContent = earned;
    highScoreEl.textContent = best;
    if (mobileScoreEl) {
        mobileScoreEl.innerHTML = '<span style="color:#ffd54a">Monedas: ' + coins + '</span> · ' +
            '<span style="color:#8fd3f4">Ganadas: ' + earned + '</span> · ' +
            '<span style="color:#ff8a5a">' + Math.ceil(timeLeft) + 's</span>';
    }
}

function showPopup() {
    popup.style.display = 'flex';
    finalScoreEl.textContent = 'Monedas ganadas: ' + earned;
    finalBestEl.textContent  = 'Récord: ' + best;
}
function hidePopup() { popup.style.display = 'none'; }

/* ─────────────────────── Render ─────────────────────── */

function drawBackground() {
    // cielo en la parte superior, tierra abajo
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2e4a74');
    g.addColorStop(0.22, '#7a5b3a');
    g.addColorStop(0.35, COL.bgTop);
    g.addColorStop(1, COL.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sol en la parte alta
    ctx.fillStyle = 'rgba(255,215,120,0.18)';
    ctx.beginPath(); ctx.arc(W * 0.82, 44, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,170,0.55)';
    ctx.beginPath(); ctx.arc(W * 0.82, 44, 14, 0, Math.PI * 2); ctx.fill();

    // franja horizontal simulando horizonte
    ctx.fillStyle = 'rgba(40,22,10,0.25)';
    ctx.fillRect(0, GRID_TOP - 18, W, 6);
}

function drawHUD() {
    // fondo HUD
    ctx.fillStyle = COL.hudBg;
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = 'rgba(255,213,74,0.3)';
    ctx.fillRect(0, HUD_H - 2, W, 2);

    // Moneda actual (izquierda)
    drawCoinIcon(22, 26, 10);
    ctx.fillStyle = COL.gold;
    ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(coins), 40, 28);
    ctx.fillStyle = COL.textDim;
    ctx.font = '10px Segoe UI';
    ctx.fillText('DISPONIBLE', 16, 50);

    // Tiempo (centro)
    var warn = timeLeft <= 10 && isPlaying;
    ctx.fillStyle = warn ? COL.danger : COL.text;
    ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.max(0, Math.ceil(timeLeft)) + 's', W / 2, 28);
    ctx.fillStyle = COL.textDim;
    ctx.font = '10px Segoe UI';
    ctx.fillText('TIEMPO', W / 2, 50);

    // Score total (derecha)
    ctx.fillStyle = COL.text;
    ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(earned), W - 16, 28);
    ctx.fillStyle = COL.textDim;
    ctx.font = '10px Segoe UI';
    ctx.fillText('GANADAS', W - 16, 50);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Barra de tiempo en el fondo del HUD
    var pct = Math.max(0, timeLeft / GAME_LEN);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, HUD_H - 6, W, 4);
    ctx.fillStyle = warn ? COL.danger : COL.gold;
    ctx.fillRect(0, HUD_H - 6, W * pct, 4);
}

function drawCoinIcon(x, y, r) {
    // moneda circular con brillo, sin texto
    var g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.2, x, y, r);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(0.55, '#ffd54a');
    g.addColorStop(1, '#b27d1a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5210';
    ctx.lineWidth = 1;
    ctx.stroke();
    // detalle central
    ctx.strokeStyle = 'rgba(122,82,16,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, y); ctx.lineTo(x + r * 0.35, y);
    ctx.stroke();
}

function drawPlotBase(x, y, w, h, hover) {
    // sombra bajo el terreno
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(x + 2, y + 4, w, h, 10); ctx.fill();

    // fondo tierra
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hover ? COL.plotHover : COL.soil0);
    g.addColorStop(1, COL.soil1);
    ctx.fillStyle = g;
    roundRect(x, y, w, h, 10); ctx.fill();

    // borde superior iluminado
    ctx.strokeStyle = 'rgba(255,220,160,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 2);
    ctx.lineTo(x + w - 8, y + 2);
    ctx.stroke();

    // surcos — cache simple
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
        var ly = y + h * (i / 4);
        ctx.beginPath();
        ctx.moveTo(x + 6, ly); ctx.lineTo(x + w - 6, ly);
        ctx.stroke();
    }

    // borde externo
    ctx.strokeStyle = '#2d1808';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 10); ctx.stroke();
}

function drawPlant(cx, cy, seed, progress, mature, timeAcc) {
    // Tallo y hojas — crece con el progreso
    var scale = 0.25 + 0.75 * progress;
    var sway = mature ? Math.sin(timeAcc * 3 + cx) * 2 : 0;

    // tallo verde
    ctx.strokeStyle = seed.stalk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 20);
    ctx.quadraticCurveTo(cx + sway, cy + 10 - scale * 14, cx + sway, cy - scale * 20);
    ctx.stroke();

    // hojas (dos, a los lados del tallo)
    if (progress > 0.18) {
        ctx.fillStyle = seed.stalk;
        var ly = cy + 8 - scale * 14;
        ctx.beginPath();
        ctx.ellipse(cx - 8 * scale, ly, 8 * scale, 4 * scale, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 8 * scale, ly, 8 * scale, 4 * scale, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cabeza del cultivo según tipo
    var topY = cy - scale * 20 + sway * 0.5;
    if (seed.id === 0) {
        // Trigo: espigas rectas
        if (progress > 0.3) {
            ctx.strokeStyle = seed.color;
            ctx.lineWidth = 2;
            var spikes = 5;
            for (var s = 0; s < spikes; s++) {
                var sy = topY + s * 3;
                ctx.beginPath();
                ctx.moveTo(cx + sway - 4 * scale, sy);
                ctx.lineTo(cx + sway + 4 * scale, sy - 2);
                ctx.stroke();
            }
            // punta
            ctx.strokeStyle = mature ? '#fff0b0' : seed.color;
            ctx.beginPath();
            ctx.moveTo(cx + sway, topY);
            ctx.lineTo(cx + sway, topY - 10 * scale);
            ctx.stroke();
        }
    } else if (seed.id === 1) {
        // Maíz: mazorca alargada
        if (progress > 0.3) {
            ctx.fillStyle = seed.color;
            var mh = 22 * scale;
            roundRect(cx + sway - 5 * scale, topY - mh, 10 * scale, mh, 4 * scale);
            ctx.fill();
            // granos
            ctx.fillStyle = 'rgba(120,70,10,0.6)';
            for (var gi = 0; gi < 3; gi++) {
                var gyy = topY - mh + mh * (0.22 + gi * 0.28);
                ctx.fillRect(cx + sway - 4 * scale, gyy, 8 * scale, 1.5);
            }
            // hoja verde envolvente
            ctx.fillStyle = seed.stalk;
            ctx.beginPath();
            ctx.moveTo(cx + sway - 6 * scale, topY);
            ctx.quadraticCurveTo(cx + sway - 12 * scale, topY - 8, cx + sway - 3 * scale, topY - mh + 6);
            ctx.lineTo(cx + sway - 1 * scale, topY - mh + 6);
            ctx.lineTo(cx + sway - 1 * scale, topY);
            ctx.closePath();
            ctx.fill();
        }
    } else {
        // Calabaza: círculo naranja con surcos
        if (progress > 0.25) {
            var pr = 14 * scale;
            var g = ctx.createRadialGradient(cx + sway - pr * 0.3, topY - pr * 0.3, pr * 0.2, cx + sway, topY, pr);
            g.addColorStop(0, '#ffb066');
            g.addColorStop(0.6, seed.color);
            g.addColorStop(1, '#a44a08');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(cx + sway, topY, pr, 0, Math.PI * 2); ctx.fill();
            // surcos
            ctx.strokeStyle = 'rgba(110,50,5,0.55)';
            ctx.lineWidth = 1.2;
            for (var k = -1; k <= 1; k++) {
                ctx.beginPath();
                ctx.ellipse(cx + sway, topY, pr * 0.35 + k * pr * 0.28, pr, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            // rabito
            ctx.strokeStyle = seed.stalk;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + sway, topY - pr);
            ctx.lineTo(cx + sway + 2, topY - pr - 6);
            ctx.stroke();
        }
    }

    // Anillo de progreso / maduración
    if (!mature) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy + 22, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = COL.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy + 22, 16, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
    } else {
        // halo de madurez
        var pulse = 0.55 + 0.35 * Math.sin(timeAcc * 5);
        ctx.fillStyle = 'rgba(255,213,74,' + (0.18 * pulse).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fill();
        // pequeña estrella "listo" arriba a la derecha
        drawStar(cx + 18, cy - 22, 4, 8, COL.gold);
    }
}

function drawStar(x, y, rInner, rOuter, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var r = (i % 2 === 0) ? rOuter : rInner;
        var px = x + Math.cos(a) * r;
        var py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawGrid(timeAcc) {
    for (var i = 0; i < 9; i++) {
        var r = plotRect(i);
        drawPlotBase(r.x, r.y, r.w, r.h, false);
        var plot = plots[i];
        if (plot) {
            var seed = SEEDS[plot.seedId];
            var prog = plantProgress(plot);
            drawPlant(r.x + r.w / 2, r.y + r.h / 2, seed, prog, prog >= 1, timeAcc);
        } else {
            // Icono sutil "toca para plantar"
            ctx.fillStyle = 'rgba(255,213,74,0.2)';
            ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 4, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function drawShop() {
    // barra separadora
    ctx.fillStyle = COL.shopBg;
    ctx.fillRect(0, SHOP_TOP, W, SHOP_H);
    ctx.fillStyle = 'rgba(255,213,74,0.25)';
    ctx.fillRect(0, SHOP_TOP, W, 1);

    ctx.fillStyle = COL.textDim;
    ctx.font = 'bold 11px Segoe UI';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MERCADO DE SEMILLAS', 12, SHOP_TOP + 16);

    for (var i = 0; i < 3; i++) {
        var slot = slotRect(i);
        var seed = SEEDS[i];
        var selected = selectedSeed === i;
        var affordable = coins >= seed.cost;

        // fondo slot
        ctx.fillStyle = selected ? '#4d3010' : (affordable ? COL.slotBg : COL.slotDim);
        roundRect(slot.x, slot.y, slot.w, slot.h, 10); ctx.fill();

        // borde seleccionado
        ctx.strokeStyle = selected ? COL.slotSel : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = selected ? 2.5 : 1;
        roundRect(slot.x, slot.y, slot.w, slot.h, 10); ctx.stroke();

        // mini planta — simple
        var cx = slot.x + slot.w / 2;
        var cy = slot.y + slot.h / 2 - 6;
        drawSeedIcon(cx, cy, seed, affordable);

        // nombre
        ctx.fillStyle = affordable ? COL.text : 'rgba(200,180,130,0.5)';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(seed.name, cx, slot.y + slot.h - 22);

        // coste
        drawCoinIcon(cx - 10, slot.y + slot.h - 10, 5);
        ctx.fillStyle = affordable ? COL.gold : 'rgba(255,213,74,0.4)';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText(String(seed.cost), cx - 2, slot.y + slot.h - 6);

        // retorno (+yield)
        ctx.fillStyle = affordable ? '#8fd3f4' : 'rgba(143,211,244,0.4)';
        ctx.font = '10px Segoe UI';
        ctx.textAlign = 'right';
        ctx.fillText('+' + seed.yield, slot.x + slot.w - 6, slot.y + slot.h - 6);
    }
    ctx.textAlign = 'left';
}

function drawSeedIcon(cx, cy, seed, bright) {
    var alpha = bright ? 1 : 0.55;
    // base pequeña (tierra)
    ctx.fillStyle = 'rgba(60,30,10,' + (0.55 * alpha) + ')';
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    // tallo
    ctx.strokeStyle = 'rgba(80,140,40,' + alpha + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy - 10); ctx.stroke();

    // cabeza según tipo (ligeras variantes)
    if (seed.id === 0) {
        ctx.strokeStyle = 'rgba(233,198,107,' + alpha + ')';
        ctx.lineWidth = 2;
        for (var s = 0; s < 4; s++) {
            var sy = cy - 10 + s * 2.4;
            ctx.beginPath();
            ctx.moveTo(cx - 5, sy); ctx.lineTo(cx + 5, sy - 1);
            ctx.stroke();
        }
    } else if (seed.id === 1) {
        ctx.fillStyle = 'rgba(255,216,58,' + alpha + ')';
        roundRect(cx - 4, cy - 14, 8, 16, 3); ctx.fill();
    } else {
        var g = ctx.createRadialGradient(cx - 3, cy - 13, 1, cx, cy - 10, 10);
        g.addColorStop(0, 'rgba(255,176,102,' + alpha + ')');
        g.addColorStop(1, 'rgba(164,74,8,' + alpha + ')');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy - 10, 9, 0, Math.PI * 2); ctx.fill();
    }
}

function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = Math.max(0, p.life / p.maxLife);
        if (p.type === 'coin') {
            ctx.globalAlpha = a;
            drawCoinIcon(p.x, p.y, p.size);
        } else if (p.type === 'dust') {
            ctx.globalAlpha = a * 0.7;
            ctx.fillStyle = '#c9a269';
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else if (p.type === 'deny') {
            ctx.globalAlpha = a;
            ctx.fillStyle = COL.danger;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
    }
    ctx.globalAlpha = 1;
}

function drawFooter() {
    // Pequeño consejo inferior
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '10px Segoe UI';
    ctx.textAlign = 'center';
    var txt = isPlaying
        ? 'Elige semilla · Toca un terreno · Cosecha al madurar'
        : (isOver ? 'Partida terminada — pulsa Iniciar' : 'Pulsa Iniciar para empezar');
    ctx.fillText(txt, W / 2, H - 6);
    ctx.textAlign = 'left';
}

function drawFlash() {
    if (flashTimer > 0) {
        ctx.fillStyle = 'rgba(255,213,74,' + (flashTimer * 0.7).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
    }
}

/* ─────────────────────── Utility: rounded-rect path ─────────────────────── */
function roundRect(x, y, w, h, r) { GU.roundRectPath(ctx, x, y, w, h, r); }

/* ─────────────────────── Game Loop ─────────────────────── */
var timeAcc = 0;

function loop(tsMs) {
    var nowS = tsMs / 1000;
    var dt = Math.min(0.05, nowS - lastT);
    lastT = nowS;
    timeAcc += dt;

    if (isPlaying && !isOver) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            endGame();
        }
        // aviso de tic por cada segundo bajo los últimos 5
        var secLeft = Math.ceil(timeLeft);
        if (timeLeft <= 5 && secLeft !== lastTickSecond && secLeft > 0) {
            lastTickSecond = secLeft;
            GameAudio.tick();
        }
    }

    updateParticles(dt);
    flashTimer = Math.max(0, flashTimer - dt);
    shakeTimer = Math.max(0, shakeTimer - dt);

    // Shake offset
    var sx = 0, sy = 0;
    if (shakeTimer > 0) {
        var amp = shakeTimer * 10;
        sx = (Math.random() - 0.5) * amp;
        sy = (Math.random() - 0.5) * amp;
    }

    ctx.save();
    ctx.translate(sx, sy);

    drawBackground();
    drawGrid(timeAcc);
    drawShop();
    drawParticles();
    drawHUD();
    drawFooter();
    drawFlash();

    ctx.restore();

    updateHUD();

    animId = requestAnimationFrame(loop);
}

/* ─────────────────────── Input ─────────────────────── */
function canvasPoint(e) { return GU.pointerPos(canvas, e); }

function handleTap(e) {
    if (!isPlaying && !isOver) return;
    if (isOver) return;
    var p = canvasPoint(e);

    // Shop?
    var si = slotAtPoint(p.x, p.y);
    if (si >= 0) {
        selectedSeed = si;
        GameAudio.click();
        return;
    }

    // Plot?
    var pi = plotAtPoint(p.x, p.y);
    if (pi >= 0) tryPlant(pi);
}

canvas.addEventListener('click', function (e) {
    e.preventDefault();
    handleTap(e);
});
canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    handleTap(e);
}, { passive: false });

/* Botones */
startBtn.addEventListener('click',     function () { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click',   function () { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });

/* ─────────────────────── Render inicial (título) ─────────────────────── */
function initialRender() {
    resetGame();
    isPlaying = false;
    timeAcc = 0;
    // un frame estático para que el canvas no se vea vacío
    ctx.save();
    drawBackground();
    drawGrid(0);
    drawShop();
    drawHUD();
    // overlay "pulsa Iniciar"
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HUD_H, W, GRID_BOTTOM - HUD_H + 6);
    ctx.fillStyle = COL.gold;
    ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LA COSECHA', W / 2, HUD_H + 80);
    ctx.fillStyle = COL.text;
    ctx.font = '13px Segoe UI';
    ctx.fillText('Planta, espera, cosecha, reinvierte', W / 2, HUD_H + 108);
    ctx.fillText('Maximiza tus monedas en 90s', W / 2, HUD_H + 128);
    ctx.fillStyle = COL.gold;
    ctx.font = 'bold 14px Segoe UI';
    ctx.fillText('Pulsa INICIAR', W / 2, HUD_H + 170);
    ctx.textAlign = 'left';
    drawFooter();
    ctx.restore();
}

initialRender();

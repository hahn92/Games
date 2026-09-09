/* Galería de Tiro — dianas que cruzan en tres carriles, con tiempo y munición.
 *
 * La regla que le da forma: el cargador tiene seis balas y recargar cuesta
 * tiempo. Sin eso, la estrategia óptima sería tocar la pantalla sin mirar.
 * Con eso, cada disparo es una decisión — y fallar duele el doble, porque
 * gastas bala y acercas la recarga.
 *
 * Las dianas negras restan; distinguirlas a tiempo es el juego. */
(function () {
'use strict';

var canvas = document.getElementById('tiroCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 420
var H = canvas.height;   // 520

var LANES = [130, 225, 320];      // y de cada carril
var ROUND_TIME = 60;              // s
var CLIP = 6;                     // balas por cargador
var RELOAD_TIME = 1.1;            // s

var targets = [];
var score = 0, ammo = CLIP, timeLeft = ROUND_TIME, combo = 0, bestCombo = 0;
var reloading = 0;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';              // idle | playing | over
var spawnTimer = 0;

var shake = new Shake({ decay: 0.87, max: 9 });
var fx    = new Particles(300);
var gMemo = GU.gradientMemo();
var best  = GU.highScore('tiroBest');

var hud = GU.hud({
    score: 'score',
    ammo:  'ammoLabel',
    time:  { el: 'timeLabel', format: function (v) { return v + 's'; } },
    combo: 'comboLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return score + ' pts  ·  ' + Math.ceil(timeLeft) + 's  ·  ' +
               (reloading > 0 ? 'RECARGANDO' : ammo + '/' + CLIP + ' balas');
    } }
});

/* ── Dianas ───────────────────────────────────────────────────────── */

var KINDS = {
    normal: { r: 26, pts: 100, color: '#ff512f', ring: '#f4f1ea', speed: 1.0 },
    small:  { r: 16, pts: 250, color: '#ffd54a', ring: '#3a2f10', speed: 1.5 },
    bonus:  { r: 22, pts: 500, color: '#8fff6a', ring: '#123a12', speed: 1.9 },
    penal:  { r: 24, pts: -300, color: '#2b2b33', ring: '#ff512f', speed: 1.2 }
};

function spawnTarget() {
    var roll = Math.random();
    var kind = roll < 0.45 ? 'normal' : roll < 0.68 ? 'small' : roll < 0.82 ? 'bonus' : 'penal';
    var k = KINDS[kind];
    var lane = GU.randInt(0, LANES.length - 1);
    var dir = Math.random() < 0.5 ? 1 : -1;
    var base = 70 + timePressure() * 60;
    targets.push({
        kind: kind, r: k.r, pts: k.pts,
        x: dir > 0 ? -k.r - 6 : W + k.r + 6,
        y: LANES[lane] + GU.rand(-14, 14),
        vx: dir * base * k.speed,
        /* Un balanceo vertical suave para que no sean una fila de patos: la fase
         * se fija al nacer, nunca se saca en el dibujado. */
        phase: GU.rand(0, Math.PI * 2),
        bob: GU.rand(4, 12),
        hit: false, hitT: 0
    });
}

/* 0 al principio de la ronda, 1 al final: todo lo que acelera cuelga de aquí. */
function timePressure() { return 1 - timeLeft / ROUND_TIME; }

/* ── Disparo ──────────────────────────────────────────────────────── */

function shoot(x, y) {
    if (gamePhase !== 'playing') return;
    if (reloading > 0) return;
    if (ammo <= 0) { startReload(); return; }

    ammo--;
    GameAudio.shoot();
    shake.hit(3);
    fx.burst(x, y, 5, { color: '#ffe98a', speed: 60, life: 0.25, size: 1.8 });

    /* Se busca de delante hacia atrás en el array, que es el orden de dibujo:
     * si dos se solapan, le das a la que se ve encima. */
    for (var i = targets.length - 1; i >= 0; i--) {
        var t = targets[i];
        if (t.hit) continue;
        if (GU.dist2(x, y, t.x, t.y) > t.r * t.r) continue;

        t.hit = true; t.hitT = 0.35;
        if (t.pts > 0) {
            combo++;
            if (combo > bestCombo) bestCombo = combo;
            /* El combo multiplica en escalones, no de forma continua: así el
             * jugador sabe cuándo ha subido de tramo. */
            var mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
            score += t.pts * mult;
            fx.burst(t.x, t.y, 16, { color: KINDS[t.kind].color, speed: 130, life: 0.6, size: 3 });
            if (mult > 1) GameAudio.scoreHigh(); else GameAudio.score();
        } else {
            combo = 0;
            score = Math.max(0, score + t.pts);
            shake.hit(9);
            fx.burst(t.x, t.y, 20, { color: '#ff512f', speed: 140, life: 0.7, size: 3 });
            GameAudio.bomb();
        }
        syncHud();
        if (ammo === 0) startReload();
        return;
    }

    /* Fallo: rompe el combo. Es lo que impide barrer la pantalla a ciegas. */
    combo = 0;
    GameAudio.miss();
    syncHud();
    if (ammo === 0) startReload();
}

function startReload() {
    if (reloading > 0) return;
    reloading = RELOAD_TIME;
    GameAudio.click();
    syncHud();
}

/* ── Ronda ────────────────────────────────────────────────────────── */

function startGame() {
    targets = [];
    score = 0; ammo = CLIP; timeLeft = ROUND_TIME; combo = 0; bestCombo = 0;
    reloading = 0; spawnTimer = 0;
    fx.clear();
    gamePhase = 'playing';
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function endGame() {
    gamePhase = 'over';
    var record = best.submit(score);
    syncHud();
    gameControls.idle();
    over.show({
        overScore: 'Puntuación: ' + score,
        overCombo: 'Mejor racha: ' + bestCombo + ' seguidas'
    });
    GameAudio.gameOver();
}

function syncHud() {
    hud.set({
        score: score,
        ammo:  reloading > 0 ? '···' : ammo + '/' + CLIP,
        time:  Math.ceil(Math.max(0, timeLeft)),
        combo: combo,
        best:  best.display(0)
    });
}

/* ── Bucle ────────────────────────────────────────────────────────── */

function update(dt) {
    if (gamePhase !== 'playing') return;

    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; syncHud(); endGame(); return; }

    if (reloading > 0) {
        reloading -= dt;
        if (reloading <= 0) { reloading = 0; ammo = CLIP; GameAudio.powerUp(); syncHud(); }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnTarget();
        spawnTimer = GU.rand(0.55, 1.1) - timePressure() * 0.32;
    }

    for (var i = targets.length - 1; i >= 0; i--) {
        var t = targets[i];
        t.x += t.vx * dt;
        t.y += Math.sin((timeLeft + t.phase) * 2.2) * t.bob * dt;
        if (t.hit) {
            t.hitT -= dt;
            if (t.hitT <= 0) { targets.splice(i, 1); continue; }
        }
        if (t.x < -60 || t.x > W + 60) targets.splice(i, 1);
    }
    syncHud();
}

rafLoop(function (dt) {
    update(dt);
    shake.update(dt);
    fx.update(dt);
    draw();
});

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0d1c30');
        g.addColorStop(1, '#060d18');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawBooth();

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }
    drawTargets();
    fx.draw(ctx);
    if (shaking) ctx.restore();

    drawAmmoBar();
    if (gamePhase === 'idle') drawIdle();
}

function drawBooth() {
    /* Tres barras horizontales: los carriles de la caseta de feria. */
    for (var i = 0; i < LANES.length; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(0, LANES[i] - 34, W, 68);
        ctx.fillStyle = 'rgba(143,211,244,0.16)';
        ctx.fillRect(0, LANES[i] + 34, W, 2);
    }
}

function drawTargets() {
    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var k = KINDS[t.kind];
        var r = t.r * (t.hit ? 1 + (0.35 - t.hitT) * 1.4 : 1);
        var alpha = t.hit ? Math.max(0, t.hitT / 0.35) : 1;

        ctx.globalAlpha = alpha;
        /* Diana concéntrica dibujada con arcos, nunca con texto ni emoji. */
        ctx.fillStyle = k.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = k.ring;
        ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.66, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = k.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.33, 0, Math.PI * 2); ctx.fill();

        if (t.kind === 'penal') {
            /* Aspa blanca: la única marca que hace falta leer rápido. */
            ctx.strokeStyle = '#ff512f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(t.x - r * 0.45, t.y - r * 0.45); ctx.lineTo(t.x + r * 0.45, t.y + r * 0.45);
            ctx.moveTo(t.x + r * 0.45, t.y - r * 0.45); ctx.lineTo(t.x - r * 0.45, t.y + r * 0.45);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
}

function drawAmmoBar() {
    var bx = 14, by = H - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    GU.roundRectPath(ctx, bx - 6, by - 12, CLIP * 17 + 12, 26, 8);
    ctx.fill();
    for (var i = 0; i < CLIP; i++) {
        ctx.fillStyle = (reloading > 0) ? '#4a4f5e' : (i < ammo ? '#ffd54a' : '#3a3f4c');
        ctx.fillRect(bx + i * 17, by - 7, 9, 16);
    }
    if (reloading > 0) {
        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('RECARGANDO', bx + CLIP * 17 + 16, by + 5);
    }

    /* Reloj a la derecha, en rojo en los últimos diez segundos. */
    ctx.textAlign = 'right';
    ctx.fillStyle = timeLeft <= 10 ? '#ff512f' : '#cfe8f5';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(Math.ceil(Math.max(0, timeLeft)) + 's', W - 14, by + 7);
    ctx.textAlign = 'left';

    if (combo >= 5) {
        ctx.fillStyle = combo >= 10 ? '#8fff6a' : '#ffd54a';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('x' + (combo >= 10 ? 3 : 2) + '  racha ' + combo, W / 2, 40);
        ctx.textAlign = 'left';
    }
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'GALERÍA DE TIRO',
        lines: ['Seis balas, un minuto, y las negras restan'],
        titleSize: 25,
        bg: 'rgba(6,13,24,0.78)',
        color: '#ffd54a',
        lineColor: '#8fd3f4'
    });
}

/* ── Entrada ──────────────────────────────────────────────────────── */

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    shoot(p.x, p.y);
});
GU.swipe(canvas, {
    preventDefault: true,
    onTap: function (p) { shoot(p.x, p.y); }
});
GU.keys({ reload: ['r'] }, { onPress: function () { if (ammo < CLIP) startReload(); } });

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

syncHud();
draw();

}());

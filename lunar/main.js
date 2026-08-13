/* Alunizaje — bajar el módulo a una plataforma con el combustible justo.
 *
 * Todo el juego es un compromiso entre tres números: velocidad vertical, ángulo
 * y combustible. Posarse cuenta sólo si llegas LENTO y DERECHO; frenar de golpe
 * al final gasta más que frenar pronto, que es exactamente la lección del
 * original de 1969.
 *
 * La física va en unidades de mundo por segundo y se integra con el dt del
 * bucle, no por frame, para que la caída sea la misma en una pantalla de 60Hz
 * que en una de 120. */
(function () {
'use strict';

var canvas = document.getElementById('lunarCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 560

var GRAVITY   = 26;      // px/s² — bastante menos que la Tierra, se nota
var THRUST    = 62;      // px/s² del motor principal
var ROT_SPEED = 2.1;     // rad/s de los propulsores de actitud
var FUEL_MAIN = 17;      // unidades/s con el motor a fondo
var FUEL_ROT  = 4;       // unidades/s girando

/* Límites del posado. Son el juego entero: aflojarlos lo vuelve trivial. */
var MAX_LAND_VY    = 34;        // px/s de caída
var MAX_LAND_VX    = 22;
var MAX_LAND_ANGLE = 0.16;      // rad respecto a la vertical

var SHIP_W = 16, SHIP_H = 18;

var terrain = [];        // [{x, y}] perfil, de izquierda a derecha
var pads = [];           // [{x1, x2, y, mult}]
var ship = null;
var stars = [];

var level = 1;
var score = 0;
var fuel = 100;
var status = 'idle';     // idle | flying | landed | crashed
var msg = '';

var shake = new Shake({ decay: 0.85, max: 16 });
var fx    = new Particles(260);
var gMemo = GU.gradientMemo();

var best = GU.highScore('lunarBest');

var hud = GU.hud({
    score: 'score',
    level: 'levelLabel',
    fuel:  { el: 'fuelLabel', format: function (v) { return Math.max(0, Math.round(v)) + '%'; } },
    vy:    { el: 'vyLabel',   format: function (v) { return v.toFixed(0); } },
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        if (!ship) return 'Nivel ' + level;
        return 'Comb. ' + Math.max(0, Math.round(fuel)) + '%  ·  Vert. ' +
               Math.round(ship.vy) + '  ·  ' + score + ' pts';
    } }
});

/* ── Terreno ──────────────────────────────────────────────────────── */

/* El perfil se genera por segmentos y DESPUÉS se aplanan las plataformas, así
 * que una plataforma es siempre horizontal de verdad. Generarla ya plana dentro
 * del recorrido dejaba escalones de un píxel en los bordes por el redondeo, y
 * ahí la nave "chocaba" contra una pared invisible al posarse. */
function buildTerrain() {
    terrain = [];
    pads = [];
    var segs = 26;
    var step = W / segs;
    var y = H - 90 - GU.rand(0, 40);
    for (var i = 0; i <= segs; i++) {
        terrain.push({ x: i * step, y: y });
        var swing = 26 + level * 3;
        y += GU.rand(-swing, swing);
        y = clamp(y, H * 0.45, H - 34);
    }

    /* Menos plataformas y más estrechas según sube el nivel. La estrecha vale
     * más: es la única forma de subir puntos rápido. */
    var padCount = Math.max(1, 3 - Math.floor((level - 1) / 3));
    var used = [];
    for (var p = 0; p < padCount; p++) {
        var width = Math.max(2, 4 - Math.floor(level / 3));   // en segmentos
        var start;
        for (var attempt = 0; attempt < 40; attempt++) {
            start = GU.randInt(1, segs - width - 1);
            var clash = false;
            for (var u = 0; u < used.length; u++) {
                if (Math.abs(used[u] - start) < width + 2) { clash = true; break; }
            }
            if (!clash) break;
        }
        used.push(start);

        var flatY = terrain[start].y;
        for (var k = start; k <= start + width; k++) terrain[k].y = flatY;
        pads.push({
            x1: terrain[start].x,
            x2: terrain[start + width].x,
            y: flatY,
            mult: width <= 2 ? 5 : (width === 3 ? 3 : 2)
        });
    }
}

function buildStars() {
    stars = [];
    for (var i = 0; i < 70; i++) {
        stars.push({
            x: GU.rand(0, W),
            y: GU.rand(0, H * 0.75),
            r: GU.rand(0.6, 1.6),
            a: GU.rand(0.25, 0.9)
        });
    }
}

/* Altura del suelo bajo una x, interpolando el segmento que le toca. */
function groundY(x) {
    for (var i = 0; i < terrain.length - 1; i++) {
        var a = terrain[i], b = terrain[i + 1];
        if (x >= a.x && x <= b.x) {
            var t = (x - a.x) / (b.x - a.x);
            return a.y + (b.y - a.y) * t;
        }
    }
    return terrain[terrain.length - 1].y;
}

function padUnder(x) {
    for (var i = 0; i < pads.length; i++) {
        if (x >= pads[i].x1 && x <= pads[i].x2) return pads[i];
    }
    return null;
}

/* ── Estado ───────────────────────────────────────────────────────── */

function newShip() {
    ship = {
        x: GU.rand(W * 0.2, W * 0.8),
        y: 54,
        vx: GU.rand(-14, 14),
        vy: 6,
        angle: 0,
        thrusting: false
    };
}

function startLevel() {
    buildTerrain();
    newShip();
    fx.clear();
    status = 'flying';
    msg = '';
    syncHud();
}

function startGame() {
    level = 1;
    score = 0;
    fuel = 100;
    buildStars();
    startLevel();
    gameControls.running();
    over.hide();
    GameAudio.start();
}

/* ── Física ───────────────────────────────────────────────────────── */

function update(dt) {
    if (status !== 'flying' || !ship) return;

    var wantThrust = keys.down('thrust') && fuel > 0;
    var wantLeft   = keys.down('left')   && fuel > 0;
    var wantRight  = keys.down('right')  && fuel > 0;

    if (wantLeft)  { ship.angle -= ROT_SPEED * dt; fuel -= FUEL_ROT * dt; }
    if (wantRight) { ship.angle += ROT_SPEED * dt; fuel -= FUEL_ROT * dt; }
    ship.angle = clamp(ship.angle, -Math.PI / 2, Math.PI / 2);

    ship.thrusting = wantThrust;
    if (wantThrust) {
        /* El empuje sale por la cola, así que su dirección es la del morro. */
        ship.vx += Math.sin(ship.angle) * THRUST * dt;
        ship.vy -= Math.cos(ship.angle) * THRUST * dt;
        fuel -= FUEL_MAIN * dt;
        spawnFlame();
    }
    if (fuel < 0) fuel = 0;

    ship.vy += GRAVITY * dt;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    /* Los laterales envuelven: salirse por un lado y reaparecer por el otro es
     * más amable que estrellarse contra un muro que no se ve. */
    if (ship.x < -SHIP_W) ship.x = W + SHIP_W;
    if (ship.x > W + SHIP_W) ship.x = -SHIP_W;

    var gy = groundY(ship.x);
    if (ship.y + SHIP_H / 2 >= gy) {
        ship.y = gy - SHIP_H / 2;
        resolveTouchdown(gy);
    }
    syncHud();
}

function resolveTouchdown(gy) {
    var pad = padUnder(ship.x);
    var slow    = ship.vy <= MAX_LAND_VY && Math.abs(ship.vx) <= MAX_LAND_VX;
    var upright = Math.abs(ship.angle) <= MAX_LAND_ANGLE;

    if (pad && slow && upright) {
        status = 'landed';
        /* Lo que sobra de combustible vale puntos: aterrizar rápido y con
         * margen renta más que planear hasta el último gramo. */
        var gained = 100 * pad.mult + Math.round(fuel) * 2 + level * 20;
        score += gained;
        msg = 'Posado limpio  +' + gained;
        GameAudio.win();
        setTimeout(nextLevel, 1400);
    } else {
        status = 'crashed';
        msg = !pad ? 'Fuera de plataforma'
            : !upright ? 'Inclinado de más'
            : 'Demasiado rápido';
        shake.hit(16);
        fx.burst(ship.x, gy - 4, 34, { color: '#ff9a5a', speed: 130, life: 0.9, size: 3, gravity: 40 });
        GameAudio.explode();
        setTimeout(endGame, 1200);
    }
}

function nextLevel() {
    level++;
    /* Repostaje parcial: no puedes vivir de rentas, pero tampoco te quedas sin
     * nada por haber apurado el nivel anterior. */
    fuel = Math.min(100, fuel + 42);
    startLevel();
    GameAudio.start();
}

function endGame() {
    var record = best.submit(score);
    syncHud();
    gameControls.idle();
    over.show({
        overTitle: record ? '¡Nuevo récord!' : 'Módulo destruido',
        overScore: 'Puntuación: ' + score,
        overLevel: 'Alunizajes: ' + (level - 1)
    });
    GameAudio.gameOver();
}

function spawnFlame() {
    /* Nace en la cola, con la velocidad de la nave restada para que el chorro
     * se quede atrás en vez de viajar pegado. */
    var back = ship.angle + Math.PI;
    var bx = ship.x + Math.sin(back) * SHIP_H * 0.55;
    var by = ship.y - Math.cos(back) * SHIP_H * 0.55;
    fx.add(bx, by,
        Math.sin(back) * GU.rand(40, 80) + ship.vx * 0.3,
        -Math.cos(back) * GU.rand(40, 80) + ship.vy * 0.3,
        { color: GU.pick(['#ffd54a', '#ff9a3c', '#fff2b0']), life: 0.3, size: 2.4 });
}

function syncHud() {
    hud.set({
        score: score,
        level: level,
        fuel:  fuel,
        vy:    ship ? ship.vy : 0,
        best:  best.display(0)
    });
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('sky', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05060f');
        g.addColorStop(0.7, '#0a1226');
        g.addColorStop(1, '#141a33');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawStars();

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }

    drawTerrain();
    drawPads();
    fx.draw(ctx);
    if (ship && status !== 'crashed') drawShip();

    if (shaking) ctx.restore();

    drawGauges();
    if (msg) drawMessage();
    if (status === 'idle') drawIdle();
}

function drawStars() {
    /* fillRect y no arc: para un punto de 1px la diferencia se nota y no se ve. */
    for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
        ctx.fillRect(s.x, s.y, s.r, s.r);
    }
}

function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var i = 0; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = '#2b2f45';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(terrain[0].x, terrain[0].y);
    for (var j = 1; j < terrain.length; j++) ctx.lineTo(terrain[j].x, terrain[j].y);
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawPads() {
    for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(p.x1, p.y - 3, p.x2 - p.x1, 5);
        /* El multiplicador, en texto plano; nunca emoji sobre canvas. */
        ctx.fillStyle = '#7ff4ff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('x' + p.mult, (p.x1 + p.x2) / 2, p.y - 9);
        ctx.textAlign = 'left';
    }
}

function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    /* Módulo dibujado con formas: cuerpo octogonal, tobera y tres patas. */
    ctx.fillStyle = '#d8dee9';
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_H / 2);
    ctx.lineTo(SHIP_W / 2, -SHIP_H / 6);
    ctx.lineTo(SHIP_W / 2, SHIP_H / 6);
    ctx.lineTo(0, SHIP_H / 2);
    ctx.lineTo(-SHIP_W / 2, SHIP_H / 6);
    ctx.lineTo(-SHIP_W / 2, -SHIP_H / 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, -SHIP_H / 8, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#aab4c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-SHIP_W / 2 + 1, SHIP_H / 6); ctx.lineTo(-SHIP_W / 2 - 3, SHIP_H / 2 + 3);
    ctx.moveTo(SHIP_W / 2 - 1, SHIP_H / 6);  ctx.lineTo(SHIP_W / 2 + 3, SHIP_H / 2 + 3);
    ctx.moveTo(0, SHIP_H / 2);               ctx.lineTo(0, SHIP_H / 2 + 3);
    ctx.stroke();

    ctx.fillStyle = '#6b7386';
    ctx.fillRect(-3, SHIP_H / 2 - 1, 6, 4);

    ctx.restore();
}

function drawGauges() {
    /* Barra de combustible arriba a la izquierda. El color avisa antes de que
     * el número importe. */
    var bw = 92, bh = 8, bx = 12, by = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    var f = clamp(fuel / 100, 0, 1);
    ctx.fillStyle = f > 0.4 ? '#8fff6a' : f > 0.18 ? '#ffd54a' : '#ff512f';
    ctx.fillRect(bx, by, bw * f, bh);
    ctx.fillStyle = '#cfe8f5';
    ctx.font = '11px monospace';
    ctx.fillText('COMB', bx, by + bh + 12);

    if (!ship) return;
    /* Velocidad vertical: en verde mientras esté dentro del margen de posado.
     * Es la lectura que de verdad decide si el intento va a salir bien. */
    var okV = ship.vy <= MAX_LAND_VY;
    var okA = Math.abs(ship.angle) <= MAX_LAND_ANGLE;
    ctx.textAlign = 'right';
    ctx.fillStyle = okV ? '#8fff6a' : '#ff512f';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('VERT ' + ship.vy.toFixed(0), W - 12, by + 9);
    ctx.fillStyle = okA ? '#8fff6a' : '#ff512f';
    ctx.fillText('INCL ' + (ship.angle * 57.3).toFixed(0) + '°', W - 12, by + 25);
    ctx.textAlign = 'left';
}

function drawMessage() {
    ctx.fillStyle = status === 'landed' ? '#8fff6a' : '#ff512f';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(msg, W / 2, H / 2);
    ctx.textAlign = 'left';
}

function drawIdle() {
    ctx.fillStyle = 'rgba(5,6,15,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ALUNIZAJE', W / 2, H / 2 - 12);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Posa lento y derecho en la plataforma', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Bucle ────────────────────────────────────────────────────────────
 * Arrancado aquí abajo, fuera de sí mismo: un bucle que sólo se referencia
 * dentro nunca llega a correr y el juego se queda quieto sin dar error. */
rafLoop(function (dt) {
    update(dt);
    shake.update(dt);
    fx.update(dt);
    draw();
});

/* ── Entrada ──────────────────────────────────────────────────────── */

var keys = GU.keys({
    thrust: ['ArrowUp', 'w', ' '],
    left:   ['ArrowLeft', 'a'],
    right:  ['ArrowRight', 'd']
}, { preventDefault: true });

/* En móvil el canvas se divide en tres: los tercios laterales giran y el
 * central empuja. Mantener pulsado funciona, que es lo que pide el juego. */
var touches = {};
function zoneOf(clientX) {
    var rect = canvas.getBoundingClientRect();
    var rel = (clientX - rect.left) / rect.width;
    return rel < 0.33 ? 'left' : rel > 0.67 ? 'right' : 'thrust';
}
function applyTouches() {
    var want = { left: false, right: false, thrust: false };
    for (var id in touches) if (Object.prototype.hasOwnProperty.call(touches, id)) want[touches[id]] = true;
    keys.set('left', want.left);
    keys.set('right', want.right);
    keys.set('thrust', want.thrust);
}
canvas.addEventListener('touchstart', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        touches[t.identifier] = zoneOf(t.clientX);
    }
    applyTouches();
    e.preventDefault();
}, { passive: false });
function endTouch(e) {
    for (var i = 0; i < e.changedTouches.length; i++) delete touches[e.changedTouches[i].identifier];
    applyTouches();
}
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

buildStars();
buildTerrain();
syncHud();
draw();

}());

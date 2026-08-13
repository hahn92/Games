// Minigolf — 9 hoyos con par, rebotes en las paredes, obstáculos y arena.
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('golfCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 440
var H = canvas.height;   // 620

var BALL_R  = 7;
var HOLE_R  = 12;
var FRICTION = 0.55;      // fracción de velocidad retenida por segundo
var STOP_V   = 8;         // por debajo de esto la bola se considera parada
var MAX_POWER = 780;      // px/s con el tirador al máximo
var MAX_DRAG  = 110;      // px de arrastre que equivalen a fuerza máxima
var MAX_STROKES = 10;     // tope por hoyo, para que nadie se atasque

var shake = new GU.Shake({ decay: 0.86 });
var fx    = new Particles(180, { semiImplicit: true });

/* ── Diseño de los hoyos ──
 *
 * Todo son rectángulos y círculos en coordenadas del canvas. `walls` son
 * obstáculos macizos con los que la bola choca; `sand` frena; `water` reinicia
 * el golpe. El césped jugable es todo lo que queda dentro del marco. */
var HOLES = [
    { par: 2, tee: [220, 540], cup: [220, 120], walls: [], sand: [], water: [] },
    { par: 3, tee: [90, 540],  cup: [350, 120],
      walls: [{ x: 180, y: 240, w: 80, h: 200 }], sand: [], water: [] },
    { par: 3, tee: [220, 545], cup: [220, 110],
      walls: [{ x: 60, y: 300, w: 130, h: 26 }, { x: 250, y: 300, w: 130, h: 26 }],
      sand: [{ x: 170, y: 380, w: 100, h: 70 }], water: [] },
    { par: 4, tee: [80, 545],  cup: [360, 110],
      walls: [{ x: 140, y: 160, w: 26, h: 260 }, { x: 274, y: 200, w: 26, h: 260 }],
      sand: [], water: [] },
    { par: 3, tee: [220, 550], cup: [220, 105],
      walls: [{ x: 130, y: 250, w: 180, h: 26 }],
      sand: [], water: [{ x: 150, y: 340, w: 140, h: 90 }] },
    { par: 4, tee: [70, 550],  cup: [370, 105],
      walls: [{ x: 100, y: 400, w: 240, h: 24 }, { x: 100, y: 240, w: 240, h: 24 }],
      sand: [{ x: 60, y: 280, w: 90, h: 100 }], water: [] },
    { par: 4, tee: [220, 555], cup: [220, 100],
      walls: [{ x: 60, y: 420, w: 120, h: 24 }, { x: 260, y: 420, w: 120, h: 24 },
              { x: 160, y: 250, w: 120, h: 24 }],
      sand: [], water: [{ x: 60, y: 300, w: 90, h: 80 }, { x: 290, y: 300, w: 90, h: 80 }] },
    { par: 5, tee: [70, 555],  cup: [370, 100],
      walls: [{ x: 130, y: 130, w: 24, h: 220 }, { x: 286, y: 270, w: 24, h: 220 },
              { x: 130, y: 460, w: 180, h: 24 }],
      sand: [{ x: 180, y: 160, w: 90, h: 80 }], water: [] },
    { par: 4, tee: [220, 555], cup: [220, 95],
      walls: [{ x: 40, y: 350, w: 150, h: 24 }, { x: 250, y: 350, w: 150, h: 24 },
              { x: 190, y: 180, w: 24, h: 120 }, { x: 226, y: 180, w: 24, h: 120 }],
      sand: [{ x: 150, y: 420, w: 140, h: 70 }], water: [] }
];

var MARGIN = 22;          // marco de madera

/* ── Estado ── */
var gs = {
    status: 'idle',       // idle | ready | aiming | rolling | sunk | over
    hole: 0,
    strokes: 0,
    total: 0,
    parTotal: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    lastX: 0, lastY: 0,   // desde dónde repetir si cae al agua
    aimX: 0, aimY: 0,
    dragging: false,
    msg: '', msgT: 0,
    sunkT: 0
};

var hud = GU.hud({
    hole:    { el: 'holeLabel',   format: function (v) { return 'Hoyo: ' + v + ' / ' + HOLES.length; } },
    par:     { el: 'parLabel',    format: function (v) { return 'Par: ' + v; } },
    strokes: { el: 'strokeLabel', format: function (v) { return 'Golpes: ' + v; } },
    total:   { el: 'totalLabel',  format: function (v) { return 'Total: ' + (v > 0 ? '+' + v : v); } },
    best:    { el: 'bestLabel',   format: function (v) { return 'Mejor: ' + v; } },
    mobile:  { el: 'mobileScore', html: function (v) {
        return 'Hoyo <b>' + v.hole + '/' + HOLES.length + '</b> &nbsp; Par ' + v.par +
               ' &nbsp; Golpes: <b>' + v.strokes + '</b>';
    } }
});

/* El récord es "golpes respecto al par" sumado: menor es mejor, y puede ser
 * negativo. Por eso {lower:true} y no el 0 por defecto de un marcador. */
var best = GU.highScore('minigolfBest', { lower: true });
var overPopup = GU.popup('overPopup');

function hole() { return HOLES[gs.hole]; }

/* ═══════════════ Partida ═══════════════ */

function newGame() {
    gs.hole = 0;
    gs.total = 0;
    gs.parTotal = 0;
    gs.status = 'ready';
    startHole();
    overPopup.hide();
    GameAudio.start();
}

function startHole() {
    var h = hole();
    gs.strokes = 0;
    gs.x = h.tee[0]; gs.y = h.tee[1];
    gs.lastX = gs.x; gs.lastY = gs.y;
    gs.vx = 0; gs.vy = 0;
    gs.status = 'ready';
    gs.sunkT = 0;
    fx.clear();
    syncHud();
}

function syncHud() {
    hud.set({
        hole: gs.hole + 1,
        par: hole().par,
        strokes: gs.strokes,
        total: gs.total,
        best: best.has() ? fmtRel(best.value) : '—'
    });
}

function fmtRel(v) { return v > 0 ? '+' + v : String(v); }

/* ═══════════════ Golpe ═══════════════ */

/* Se tira de la bola hacia ATRÁS y se suelta, como un tirachinas: es el gesto
 * que todo el mundo espera de un minigolf táctil y funciona igual con ratón. */
function beginAim(px, py) {
    if (gs.status !== 'ready') return;
    if (GU.dist(px, py, gs.x, gs.y) > 60) return;    // hay que agarrar la bola
    gs.status = 'aiming';
    gs.dragging = true;
    gs.aimX = px; gs.aimY = py;
}

function moveAim(px, py) {
    if (gs.status !== 'aiming') return;
    gs.aimX = px; gs.aimY = py;
}

function releaseAim() {
    if (gs.status !== 'aiming') return;
    gs.dragging = false;
    var dx = gs.x - gs.aimX, dy = gs.y - gs.aimY;
    var d = Math.hypot(dx, dy);
    if (d < 6) { gs.status = 'ready'; return; }       // toque suelto, no golpe

    var power = Math.min(d, MAX_DRAG) / MAX_DRAG;
    gs.vx = (dx / d) * power * MAX_POWER;
    gs.vy = (dy / d) * power * MAX_POWER;
    gs.lastX = gs.x; gs.lastY = gs.y;
    gs.strokes++;
    gs.status = 'rolling';
    syncHud();
    GameAudio.paddle();
}

/* ═══════════════ Física ═══════════════ */

function update(dt) {
    shake.update(dt);
    fx.update(dt);
    if (gs.msgT > 0) gs.msgT -= dt;

    if (gs.status === 'sunk') {
        gs.sunkT += dt;
        if (gs.sunkT > 1.1) nextHole();
        return;
    }
    if (gs.status !== 'rolling') return;

    /* Subpasos: a fuerza máxima la bola avanza 13px por frame, casi el doble de
     * su radio, y se colaría entre una pared y otra sin tocarlas. */
    var steps = 6, sdt = dt / steps;
    for (var s = 0; s < steps; s++) {
        if (gs.status !== 'rolling') return;
        step(sdt);
    }
}

function step(dt) {
    var h = hole();

    /* La arena frena mucho más: se aplica antes de mover, para que el efecto
     * se note ya en el paso en que se entra. */
    var f = inAny(h.sand, gs.x, gs.y) ? 0.02 : FRICTION;
    var k = Math.pow(f, dt);
    gs.vx *= k; gs.vy *= k;

    gs.x += gs.vx * dt;
    gs.y += gs.vy * dt;

    bounceWalls();
    bounceObstacles(h.walls);

    if (inAny(h.water, gs.x, gs.y)) return splash();

    var cup = h.cup;
    var d = GU.dist(gs.x, gs.y, cup[0], cup[1]);
    /* Para colar hay que llegar al hoyo Y no ir demasiado rápido: si no, la
     * bola pasa por encima, que es exactamente lo que hace una de verdad. */
    if (d < HOLE_R - 2 && Math.hypot(gs.vx, gs.vy) < 260) return sink();

    if (Math.hypot(gs.vx, gs.vy) < STOP_V) {
        gs.vx = 0; gs.vy = 0;
        gs.status = 'ready';
        /* Tope de golpes: el hoyo se cierra igualmente y hay que puntuarlo por
         * el mismo camino que uno colado, o el par de ese hoyo no entraría en
         * el total y el resultado final saldría corto. */
        if (gs.strokes >= MAX_STROKES) {
            setMsg('Máximo de golpes');
            GameAudio.miss();
            concludeHole();
        }
    }
}

function bounceWalls() {
    var lo = MARGIN + BALL_R, hiX = W - MARGIN - BALL_R, hiY = H - MARGIN - BALL_R;
    var hit = false;
    if (gs.x < lo)  { gs.x = lo;  gs.vx = -gs.vx * 0.72; hit = true; }
    if (gs.x > hiX) { gs.x = hiX; gs.vx = -gs.vx * 0.72; hit = true; }
    if (gs.y < lo)  { gs.y = lo;  gs.vy = -gs.vy * 0.72; hit = true; }
    if (gs.y > hiY) { gs.y = hiY; gs.vy = -gs.vy * 0.72; hit = true; }
    if (hit && Math.hypot(gs.vx, gs.vy) > 90) GameAudio.hit();
}

/* Rebote contra un rectángulo: se resuelve por el eje de MENOR penetración.
 * Elegir el otro mete la bola dentro del obstáculo y la deja vibrando. */
function bounceObstacles(walls) {
    for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        var cx = GU.clamp(gs.x, w.x, w.x + w.w);
        var cy = GU.clamp(gs.y, w.y, w.y + w.h);
        var dx = gs.x - cx, dy = gs.y - cy;
        if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

        if (dx === 0 && dy === 0) {
            /* Centro exacto: no hay normal. Se empuja por donde menos hay que
             * recorrer para salir. */
            var left = gs.x - w.x, right = w.x + w.w - gs.x;
            var top = gs.y - w.y, bot = w.y + w.h - gs.y;
            var m = Math.min(left, right, top, bot);
            if (m === left)       { gs.x = w.x - BALL_R;         gs.vx = -Math.abs(gs.vx) * 0.72; }
            else if (m === right) { gs.x = w.x + w.w + BALL_R;   gs.vx =  Math.abs(gs.vx) * 0.72; }
            else if (m === top)   { gs.y = w.y - BALL_R;         gs.vy = -Math.abs(gs.vy) * 0.72; }
            else                  { gs.y = w.y + w.h + BALL_R;   gs.vy =  Math.abs(gs.vy) * 0.72; }
        } else {
            var d = Math.hypot(dx, dy) || 1;
            var nx = dx / d, ny = dy / d;
            gs.x = cx + nx * BALL_R;
            gs.y = cy + ny * BALL_R;
            var dot = gs.vx * nx + gs.vy * ny;
            gs.vx = (gs.vx - 2 * dot * nx) * 0.72;
            gs.vy = (gs.vy - 2 * dot * ny) * 0.72;
        }
        if (Math.hypot(gs.vx, gs.vy) > 90) { GameAudio.hit(); shake.hit(3); }
    }
}

function inAny(rects, x, y) {
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    return false;
}

function splash() {
    GameAudio.splash();
    shake.hit(8);
    fx.burst(gs.x, gs.y, 16, {
        color: '#5eb8ff', speed: [40, 140], size: [1.5, 3.2],
        life: [0.3, 0.6], gravity: 0.4, drag: [0.94, 0.94]
    });
    /* Penalización estándar: un golpe y se repite desde donde saliste. */
    gs.strokes++;
    gs.x = gs.lastX; gs.y = gs.lastY;
    gs.vx = 0; gs.vy = 0;
    gs.status = 'ready';
    setMsg('¡Al agua! +1 golpe');
    syncHud();
}

function sink() {
    gs.vx = 0; gs.vy = 0;
    gs.x = hole().cup[0]; gs.y = hole().cup[1];

    var rel = gs.strokes - hole().par;
    setMsg(nameFor(gs.strokes, hole().par));
    if (rel <= -2) { GameAudio.scoreHigh(); shake.hit(10); }
    else if (rel <= 0) GameAudio.score();
    else GameAudio.goal();

    fx.burst(gs.x, gs.y, 20, {
        colors: ['#fddb92', '#8fd3f4', '#4ade80'], speed: [50, 150],
        size: [1.5, 3], life: [0.4, 0.8], drag: [0.93, 0.93]
    });
    concludeHole();
}

/* Único sitio donde un hoyo suma al resultado, lo hayas colado o te hayas
 * quedado sin golpes. Tener dos caminos era justo lo que dejaba fuera el par
 * del hoyo cuando se agotaba el tope. */
function concludeHole() {
    gs.total += gs.strokes - hole().par;
    gs.parTotal += hole().par;
    gs.status = 'sunk';
    gs.sunkT = 0;
    syncHud();
}

function nameFor(strokes, par) {
    if (strokes === 1) return '¡HOYO EN UNO!';
    var rel = strokes - par;
    if (rel <= -3) return '¡Albatros!';
    if (rel === -2) return '¡Eagle!';
    if (rel === -1) return '¡Birdie!';
    if (rel === 0)  return 'Par';
    if (rel === 1)  return 'Bogey';
    if (rel === 2)  return 'Doble bogey';
    return '+' + rel;
}

function nextHole() {
    gs.hole++;
    if (gs.hole >= HOLES.length) return endGame();
    startHole();
}

function endGame() {
    gs.status = 'over';
    var record = best.submit(gs.total);
    syncHud();
    GameAudio.win();
    overPopup.show({
        overTitle: record ? '¡Nuevo récord!' : 'Vuelta terminada',
        overScore: 'Resultado: ' + fmtRel(gs.total) + ' (' + (gs.parTotal + gs.total) + ' golpes)',
        overBest:  'Mejor vuelta: ' + (best.has() ? fmtRel(best.value) : '—')
    });
}

function setMsg(t) { gs.msg = t; gs.msgT = 1.6; }

/* ═══════════════ Dibujo ═══════════════ */

var grads = GU.gradientMemo();

function draw() {
    ctx.save();
    shake.translate(ctx);

    // marco de madera
    ctx.fillStyle = grads('wood', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#7a4f28');
        g.addColorStop(1, '#4e3018');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    // césped
    ctx.fillStyle = grads('grass', function () {
        var g = ctx.createLinearGradient(0, MARGIN, 0, H - MARGIN);
        g.addColorStop(0, '#3f9e4d');
        g.addColorStop(1, '#2c7a39');
        return g;
    });
    ctx.fillRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);

    if (gs.status === 'idle') { ctx.restore(); drawIdle(); return; }

    drawStripes();
    var h = hole();
    drawZones(h.sand, '#e8d18a', '#d4b96a');
    drawZones(h.water, '#3f8fd0', '#2f6ea8');
    drawCup(h.cup);
    drawWalls(h.walls);
    if (gs.status === 'aiming') drawAim();
    drawBall();
    fx.draw(ctx);

    ctx.restore();
    drawHud();
    drawMsg();
}

/* Franjas de césped cortado: un solo fillStyle para todas. */
function drawStripes() {
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (var y = MARGIN; y < H - MARGIN; y += 56) {
        ctx.fillRect(MARGIN, y, W - MARGIN * 2, 28);
    }
}

function drawZones(list, fill, edge) {
    if (!list.length) return;
    for (var i = 0; i < list.length; i++) {
        var r = list[i];
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, 14);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function wallGrad(h) {
    return grads('wall:' + h, function () {
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#a9713d');
        g.addColorStop(1, '#6d4522');
        return g;
    });
}

function drawWalls(walls) {
    for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.roundRect(w.x + 3, w.y + 4, w.w, w.h, 6);
        ctx.fill();
        /* Keyed por altura: los obstáculos van de 24 a 260 px y un degradado
         * construido para 26 dejaría los largos casi planos. Hay seis alturas
         * distintas en todo el juego, así que la caché está acotada. */
        ctx.fillStyle = wallGrad(w.h);
        ctx.translate(w.x, w.y);
        ctx.beginPath();
        ctx.roundRect(0, 0, w.w, w.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.translate(-w.x, -w.y);
    }
}

function drawCup(cup) {
    ctx.fillStyle = '#12210f';
    ctx.beginPath();
    ctx.arc(cup[0], cup[1], HOLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // bandera
    ctx.strokeStyle = '#e8e8ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cup[0], cup[1] - 2);
    ctx.lineTo(cup[0], cup[1] - 46);
    ctx.stroke();
    ctx.fillStyle = '#ff512f';
    ctx.beginPath();
    ctx.moveTo(cup[0], cup[1] - 46);
    ctx.lineTo(cup[0] + 26, cup[1] - 38);
    ctx.lineTo(cup[0], cup[1] - 30);
    ctx.closePath();
    ctx.fill();
}

function drawAim() {
    var dx = gs.x - gs.aimX, dy = gs.y - gs.aimY;
    var d = Math.hypot(dx, dy);
    if (d < 4) return;
    var power = Math.min(d, MAX_DRAG) / MAX_DRAG;
    var ux = dx / d, uy = dy / d;

    // guía punteada en la dirección del tiro
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(gs.x, gs.y);
    ctx.lineTo(gs.x + ux * power * 190, gs.y + uy * power * 190);
    ctx.stroke();
    ctx.setLineDash([]);

    // banda de fuerza detrás de la bola
    ctx.strokeStyle = power > 0.85 ? '#ff512f' : '#fddb92';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gs.x, gs.y);
    ctx.lineTo(gs.x - ux * Math.min(d, MAX_DRAG), gs.y - uy * Math.min(d, MAX_DRAG));
    ctx.stroke();
}

function drawBall() {
    if (gs.status === 'sunk' && gs.sunkT > 0.25) return;   // ya cayó dentro
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(gs.x + 2, gs.y + 3, BALL_R, BALL_R * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(gs.x, gs.y);
    ctx.fillStyle = grads('ball', function () {
        var g = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.4, 0.5, 0, 0, BALL_R);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.6, '#e6e9ee');
        g.addColorStop(1, '#9aa3b0');
        return g;
    });
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(-gs.x, -gs.y);
}

function drawHud() {
    ctx.fillStyle = 'rgba(8,20,12,0.78)';
    ctx.fillRect(0, 0, W, 34);
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px sans-serif';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Hoyo ' + (gs.hole + 1) + '/' + HOLES.length, 12, 17);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e8ea';
    ctx.fillText('Par ' + hole().par + '  ·  Golpes ' + gs.strokes, W / 2, 17);

    ctx.textAlign = 'right';
    ctx.fillStyle = gs.total > 0 ? '#ff8a70' : '#4ade80';
    ctx.fillText(fmtRel(gs.total), W - 12, 17);
}

function drawIdle() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8,20,12,0.72)';
    ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('MINIGOLF', W / 2, H / 2 - 30);
    ctx.fillStyle = '#e8e8ea';
    ctx.font = '15px sans-serif';
    ctx.fillText('Arrastra desde la bola hacia atrás', W / 2, H / 2 + 6);
    ctx.fillText('y suelta, como un tirachinas', W / 2, H / 2 + 30);
}

function drawMsg() {
    if (gs.msgT <= 0) return;
    ctx.globalAlpha = Math.min(1, gs.msgT / 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#fddb92';
    ctx.fillText(gs.msg, W / 2, H * 0.3);
    ctx.globalAlpha = 1;
}

/* ═══════════════ Bucle ═══════════════ */

rafLoop(function (dt) {
    update(dt);
    draw();
});

/* ═══════════════ Entrada ═══════════════ */

canvas.addEventListener('mousedown', function (e) {
    var p = GU.pointerPos(canvas, e);
    beginAim(p.x, p.y);
});
canvas.addEventListener('mousemove', function (e) {
    if (!gs.dragging) return;
    var p = GU.pointerPos(canvas, e);
    moveAim(p.x, p.y);
});
window.addEventListener('mouseup', releaseAim);

/* Táctil: el mismo gesto. No se usa GU.swipe aquí porque esto no es un swipe
 * direccional sino un arrastre continuo del que hace falta la posición en cada
 * momento para dibujar la guía. */
canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var p = GU.pointerPos(canvas, e);
    beginAim(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var p = GU.pointerPos(canvas, e);
    moveAim(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    releaseAim();
}, { passive: false });

var gameControls = GU.controls({ start: newGame });
document.getElementById('skipBtn').addEventListener('click', function () {
    if (gs.status === 'idle' || gs.status === 'over') return;
    /* Saltar cuenta como si hubieras hecho el máximo: no es un atajo gratis. */
    gs.strokes = MAX_STROKES;
    GameAudio.miss();
    concludeHole();
    nextHole();
});

syncHud();

}());

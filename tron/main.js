/* Estelas de Luz — tres motos rivales sobre una rejilla. Todo el que se mueve
 * deja un rastro sólido detrás; chocar contra un rastro, contra un rival o
 * contra el muro te elimina. Gana el último que quede.
 *
 * El juego es de REJILLA, no de píxeles: cada moto ocupa una celda entera y
 * avanza de celda en celda a un tic fijo. Eso es lo que hace que los rastros
 * casen exactamente y que un pasillo de una celda sea de una celda de verdad.
 * Interpolar la posición para dibujar sería más suave pero abriría huecos donde
 * el jugador cree que cabe y no cabe. */
(function () {
'use strict';

var canvas = document.getElementById('tronCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 420
var H = canvas.height;   // 420

var CELL = 7;
var COLS = Math.floor(W / CELL);   // 60
var ROWS = Math.floor(H / CELL);   // 60

/* Un tic cada TICK_MS. Más rápido por ronda, con un suelo: por debajo de ~55ms
 * el jugador ya no llega a reaccionar en un pasillo estrecho. */
var TICK_BASE = 110;
var TICK_MIN  = 55;

var COLORS = [
    { body: '#00e5ff', trail: '#0090aa', glow: '#7ff4ff' },   // jugador
    { body: '#ff512f', trail: '#a32a17', glow: '#ff9a80' },
    { body: '#ffd54a', trail: '#a88a1e', glow: '#ffe89a' },
    { body: '#8fff6a', trail: '#4d9a35', glow: '#c4ffb0' }
];
var NAMES = ['Tú', 'Roja', 'Ámbar', 'Verde'];

var DIRS = [
    { dx:  0, dy: -1 },   // 0 arriba
    { dx:  1, dy:  0 },   // 1 derecha
    { dx:  0, dy:  1 },   // 2 abajo
    { dx: -1, dy:  0 }    // 3 izquierda
];

/* grid[i] = 0 vacío, o 1+índice de la moto que dejó el rastro. Un Uint8Array
 * plano en vez de un array de arrays: se limpia de una llamada y el índice se
 * calcula con una multiplicación. */
var grid = new Uint8Array(COLS * ROWS);

var riders = [];
var running = false;
var round = 0;
var score = 0;
var tickMs = TICK_BASE;
var tickHandle = null;
var deathFx = [];          // destellos de choque, se dibujan y se apagan

var shake = new Shake({ decay: 0.86, max: 12 });
var fx    = new Particles(240);
var gMemo = GU.gradientMemo();

var best = GU.highScore('tronBest');

var hud = GU.hud({
    score: 'score',
    round: 'roundLabel',
    alive: 'aliveLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return 'Ronda ' + round + '  ·  ' + score + ' pts  ·  ' + aliveCount() + ' en pista';
    } }
});

function idx(c, r) { return r * COLS + c; }
function aliveCount() {
    var n = 0;
    for (var i = 0; i < riders.length; i++) if (riders[i].alive) n++;
    return n;
}

/* ── Arranque de ronda ────────────────────────────────────────────── */

function makeRiders() {
    /* Las cuatro esquinas, cada una mirando hacia el centro. Repartirlas así
     * garantiza que nadie empieza encarado a un rival a quemarropa. */
    var m = 6;
    var starts = [
        { c: m,            r: ROWS - 1 - m, dir: 0 },
        { c: COLS - 1 - m, r: m,            dir: 2 },
        { c: COLS - 1 - m, r: ROWS - 1 - m, dir: 0 },
        { c: m,            r: m,            dir: 2 }
    ];
    var count = Math.min(4, 2 + Math.floor(round / 3));   // 2 rivales, luego 3 y 4
    var out = [];
    for (var i = 0; i < count; i++) {
        out.push({
            i: i,
            c: starts[i].c,
            r: starts[i].r,
            dir: starts[i].dir,
            next: starts[i].dir,
            alive: true,
            human: i === 0,
            col: COLORS[i]
        });
        grid[idx(starts[i].c, starts[i].r)] = i + 1;
    }
    return out;
}

function startRound() {
    grid.fill(0);
    deathFx.length = 0;
    fx.clear();
    riders = makeRiders();
    tickMs = Math.max(TICK_MIN, TICK_BASE - round * 6);
    rafClear(tickHandle);
    tickHandle = rafInterval(tick, tickMs);
    running = true;
    syncHud();
}

function startGame() {
    round = 1;
    score = 0;
    gameControls.running();
    over.hide();
    startRound();
    GameAudio.start();
}

/* ── Decisión de la IA ────────────────────────────────────────────── */

/* Cuenta cuántas celdas libres hay en línea recta desde (c,r) hacia `dir`.
 * Es una mirada barata pero suficiente: lo que mata a una IA de tron es meterse
 * en un callejón, y esto lo ve venir. */
function runway(c, r, dir, cap) {
    var d = DIRS[dir], n = 0;
    var cc = c, rr = r;
    while (n < cap) {
        cc += d.dx; rr += d.dy;
        if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) break;
        if (grid[idx(cc, rr)]) break;
        n++;
    }
    return n;
}

/* Espacio abierto alcanzable, por inundación acotada. Distingue el pasillo
 * largo pero cerrado del hueco que de verdad lleva a alguna parte — un runway
 * solo no ve la diferencia y es como las IA acaban encerrándose ellas solas. */
var floodSeen = new Int32Array(COLS * ROWS);
var floodStamp = 0;
var floodQueue = new Int32Array(COLS * ROWS);
function openSpace(c, r, cap) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 0;
    if (grid[idx(c, r)]) return 0;
    floodStamp++;
    var head = 0, tail = 0, n = 0;
    floodQueue[tail++] = idx(c, r);
    floodSeen[idx(c, r)] = floodStamp;
    while (head < tail && n < cap) {
        var cur = floodQueue[head++];
        n++;
        var cx = cur % COLS, cy = (cur - cx) / COLS;
        for (var k = 0; k < 4; k++) {
            var nx = cx + DIRS[k].dx, ny = cy + DIRS[k].dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            var ni = idx(nx, ny);
            if (grid[ni] || floodSeen[ni] === floodStamp) continue;
            floodSeen[ni] = floodStamp;
            floodQueue[tail++] = ni;
        }
    }
    return n;
}

function aiChoose(rd) {
    /* Nunca da media vuelta: en tron eso es chocar contra tu propio rastro. */
    var opts = [rd.dir, (rd.dir + 1) % 4, (rd.dir + 3) % 4];
    var bestDir = rd.dir, bestVal = -1;
    for (var i = 0; i < opts.length; i++) {
        var d = opts[i], dd = DIRS[d];
        var nc = rd.c + dd.dx, nr = rd.r + dd.dy;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        if (grid[idx(nc, nr)]) continue;
        /* El espacio abierto manda; el pasillo recto sólo desempata. Y una pizca
         * de preferencia por seguir recto, o la moto va dando bandazos. */
        var val = openSpace(nc, nr, 90) * 4 + runway(nc, nr, d, 14) + (d === rd.dir ? 3 : 0);
        if (val > bestVal) { bestVal = val; bestDir = d; }
    }
    rd.next = bestDir;
}

/* ── Tic ──────────────────────────────────────────────────────────── */

function tick() {
    if (!running) return;

    var i, rd;
    for (i = 0; i < riders.length; i++) {
        rd = riders[i];
        if (!rd.alive || rd.human) continue;
        aiChoose(rd);
    }

    /* Todos avanzan a la vez y DESPUÉS se resuelven los choques, para que un
     * frontal mate a los dos en vez de depender del orden del bucle. */
    var moved = [];
    for (i = 0; i < riders.length; i++) {
        rd = riders[i];
        if (!rd.alive) continue;
        rd.dir = rd.next;
        var d = DIRS[rd.dir];
        var nc = rd.c + d.dx, nr = rd.r + d.dy;
        var dead = nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || !!grid[idx(nc, nr)];
        moved.push({ rd: rd, c: nc, r: nr, dead: dead });
    }
    for (i = 0; i < moved.length; i++) {
        for (var j = i + 1; j < moved.length; j++) {
            if (moved[i].c === moved[j].c && moved[i].r === moved[j].r) {
                moved[i].dead = true; moved[j].dead = true;
            }
        }
    }
    for (i = 0; i < moved.length; i++) {
        var m = moved[i];
        if (m.dead) { kill(m.rd, m.c, m.r); continue; }
        m.rd.c = m.c; m.rd.r = m.r;
        grid[idx(m.c, m.r)] = m.rd.i + 1;
    }

    /* Un punto por tic sobrevivido: premia aguantar, no sólo ganar. */
    if (riders[0].alive) score += 1;
    syncHud();
    checkRoundEnd();
}

function kill(rd, c, r) {
    rd.alive = false;
    var px = c * CELL + CELL / 2, py = r * CELL + CELL / 2;
    /* Se recorta al canvas: si murió contra el muro, c/r caen fuera y el
     * destello se dibujaría en un borde que no se ve. */
    px = clamp(px, 4, W - 4); py = clamp(py, 4, H - 4);
    deathFx.push({ x: px, y: py, t: 1, col: rd.col.body });
    fx.burst(px, py, 18, { color: rd.col.glow, speed: 90, life: 0.55, size: 2 });
    shake.hit(rd.human ? 12 : 6);
    if (rd.human) GameAudio.explode(); else GameAudio.hit();
}

function checkRoundEnd() {
    var alive = aliveCount();
    if (riders[0].alive && alive === 1) {
        /* Último en pie: ronda ganada. */
        running = false;
        rafClear(tickHandle);
        score += 100 + round * 25;
        syncHud();
        GameAudio.win();
        setTimeout(function () {
            round++;
            startRound();
        }, 1100);
        return;
    }
    if (!riders[0].alive) {
        running = false;
        rafClear(tickHandle);
        setTimeout(endGame, 900);
    }
}

function endGame() {
    var record = best.submit(score);
    syncHud();
    gameControls.idle();
    over.show({
        overTitle: record ? '¡Nuevo récord!' : 'Te has estrellado',
        overScore: 'Puntuación: ' + score,
        overRound: 'Rondas superadas: ' + (round - 1)
    });
    GameAudio.gameOver();
}

function syncHud() {
    hud.set({
        score: score,
        round: round,
        alive: aliveCount(),
        best:  best.display(0)
    });
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05070f');
        g.addColorStop(1, '#0b1020');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawGridLines();

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }

    drawTrails();
    fx.draw(ctx);
    drawRiders();
    drawDeaths();

    if (shaking) ctx.restore();

    if (!running && riders.length === 0) drawIdle();
}

function drawGridLines() {
    /* Una rejilla tenue para que se lea la escala de celda. Dos batches de
     * líneas con un solo beginPath: 120 stroke() sueltos costaban más que todo
     * el resto del frame junto. */
    ctx.strokeStyle = 'rgba(90,160,200,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var c = 0; c <= COLS; c += 5) {
        ctx.moveTo(c * CELL + 0.5, 0);
        ctx.lineTo(c * CELL + 0.5, H);
    }
    for (var r = 0; r <= ROWS; r += 5) {
        ctx.moveTo(0, r * CELL + 0.5);
        ctx.lineTo(W, r * CELL + 0.5);
    }
    ctx.stroke();
}

function drawTrails() {
    /* Una pasada por color en vez de una por celda: así fillStyle se toca
     * cuatro veces por frame y no 3600. */
    for (var k = 0; k < COLORS.length; k++) {
        var want = k + 1, any = false;
        ctx.fillStyle = COLORS[k].trail;
        for (var i = 0; i < grid.length; i++) {
            if (grid[i] !== want) continue;
            var c = i % COLS, r = (i - c) / COLS;
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
            any = true;
        }
        if (!any) continue;
        /* El brillo del rastro va como una segunda pasada más clara y estrecha,
         * no como shadowBlur: la sombra por celda era el cuello de botella. */
        ctx.fillStyle = GU.rgba(COLORS[k].body, 0.25);
        for (var j = 0; j < grid.length; j++) {
            if (grid[j] !== want) continue;
            var c2 = j % COLS, r2 = (j - c2) / COLS;
            ctx.fillRect(c2 * CELL + 2, r2 * CELL + 2, CELL - 4, CELL - 4);
        }
    }
}

function drawRiders() {
    for (var i = 0; i < riders.length; i++) {
        var rd = riders[i];
        if (!rd.alive) continue;
        var x = rd.c * CELL, y = rd.r * CELL;
        ctx.fillStyle = rd.col.body;
        ctx.fillRect(x - 1, y - 1, CELL + 2, CELL + 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    }
}

function drawDeaths() {
    for (var i = deathFx.length - 1; i >= 0; i--) {
        var d = deathFx[i];
        d.t -= 0.045;
        if (d.t <= 0) { deathFx.splice(i, 1); continue; }
        var rad = (1 - d.t) * 34 + 4;
        ctx.strokeStyle = GU.rgba(d.col, d.t);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, rad, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawIdle() {
    ctx.fillStyle = 'rgba(5,7,15,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ESTELAS DE LUZ', W / 2, H / 2 - 14);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Pulsa Iniciar y no toques ningún rastro', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Bucle de render ──────────────────────────────────────────────────
 * El bucle de LÓGICA es el rafInterval de arriba, a tic fijo. Este otro sólo
 * pinta, a la velocidad que dé la pantalla, para que el humo y la sacudida se
 * vean suaves aunque las motos avancen a saltos. Se arranca aquí abajo, fuera
 * de sí mismo: un renderLoop que sólo se referencia dentro nunca llega a correr
 * y el juego se queda negro con la puntuación subiendo. */
function renderLoop(dt) {
    shake.update(dt);
    fx.update(dt);
    draw();
}
rafLoop(renderLoop);

/* ── Entrada ──────────────────────────────────────────────────────── */

function steer(dir) {
    var me = riders[0];
    if (!running || !me || !me.alive) return;
    /* Media vuelta prohibida: sería chocar contra el propio rastro. Se compara
     * contra `dir`, la dirección ya confirmada, y no contra `next`, o dos
     * pulsaciones rápidas en el mismo tic dejarían colar el giro de 180°. */
    if ((dir + 2) % 4 === me.dir) return;
    me.next = dir;
}

GU.keys({
    up:    ['ArrowUp', 'w'],
    right: ['ArrowRight', 'd'],
    down:  ['ArrowDown', 's'],
    left:  ['ArrowLeft', 'a']
}, {
    preventDefault: true,
    onPress: function (action) {
        steer(action === 'up' ? 0 : action === 'right' ? 1 : action === 'down' ? 2 : 3);
    }
});

/* `live: true`: aquí se conduce en continuo, así que el giro tiene que salir en
 * cuanto el dedo cruza el umbral, no al levantarlo. */
GU.swipe(canvas, {
    live: true,
    minDist: 22,
    preventDefault: true,
    onSwipe: function (d) {
        steer(d === 'up' ? 0 : d === 'right' ? 1 : d === 'down' ? 2 : 3);
    }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

syncHud();
draw();

}());

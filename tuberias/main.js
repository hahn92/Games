/* Tuberías — gira cada tramo hasta que el agua llegue a todos los grifos.
 *
 * El tablero NO se siembra al azar: se construye como un ÁRBOL DE EXPANSIÓN
 * sobre la rejilla, partiendo del depósito. Un árbol conecta todas las celdas
 * sin ciclos, así que la red resuelta existe por construcción y además es
 * única en topología — sólo hay que devolver cada pieza a su orientación.
 * Después se gira cada pieza al azar, que es lo que crea el puzzle.
 *
 * Con piezas al azar la mayoría de tableros no tendrían solución, y el jugador
 * no podría distinguir "no lo veo" de "no se puede".
 *
 * Cada celda guarda sus conexiones como CUATRO BITS (arriba, derecha, abajo,
 * izquierda). Girar es entonces una rotación de bits, y "¿encajan estas dos
 * piezas?" es mirar un bit en cada una — sin tablas de tipos de pieza. */
(function () {
'use strict';

var canvas = document.getElementById('tubCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 440
var H = canvas.height;   // 480

var SIZES = { facil: 5, medio: 7, dificil: 9 };
var N = 7;
var cell = 0;

/* Bits de conexión. El orden importa: girar 90° a la derecha es rotar los bits
 * una posición, y eso sólo funciona si van en sentido horario. */
var UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
var DIRS = [
    { bit: UP,    dr: -1, dc: 0, opp: DOWN },
    { bit: RIGHT, dr: 0,  dc: 1, opp: LEFT },
    { bit: DOWN,  dr: 1,  dc: 0, opp: UP },
    { bit: LEFT,  dr: 0,  dc: -1, opp: RIGHT }
];

var pipes = null;        // Uint8Array de máscaras de 4 bits
var filled = null;       // Uint8Array, 1 = le llega el agua
var source = { r: 0, c: 0 };
var moves = 0;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';     // idle | playing | won
var diff = 'medio';

var fx = new Particles(200);
var gMemo = GU.gradientMemo();

/* Menos giros es mejor: récord invertido, y por tamaño. */
var bests = {
    facil:   GU.highScore('tuberiasBestFacil',   { lower: true }),
    medio:   GU.highScore('tuberiasBestMedio',   { lower: true }),
    dificil: GU.highScore('tuberiasBestDificil', { lower: true })
};

var hud = GU.hud({
    moves: 'movesLabel',
    conn:  'connLabel',
    best:  { el: 'highScore', format: function (v) { return v == null ? '—' : v; } },
    mobile: { el: 'mobileScore', format: function () {
        return moves + ' giros  ·  ' + connectedCount() + '/' + (N * N) + ' con agua';
    } }
});

function idx(r, c) { return r * N + c; }
function inside(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

/* Girar 90° a la derecha = rotar los cuatro bits una posición. El &15 recorta
 * lo que se sale por arriba y el >>3 lo devuelve por abajo. */
function rot(mask) { return ((mask << 1) | (mask >> 3)) & 15; }

/* ── Generación ───────────────────────────────────────────────────── */

function newGame() {
    N = SIZES[diff];
    cell = Math.floor(Math.min(W - 24, H - 60) / N);
    pipes = new Uint8Array(N * N);
    filled = new Uint8Array(N * N);
    source = { r: (N / 2) | 0, c: (N / 2) | 0 };

    /* Árbol de expansión por recorrido aleatorio en profundidad, con pila
     * explícita: en 9×9 la versión recursiva son 81 marcos, que aguanta, pero
     * la pila deja el techo abierto por si la rejilla crece. */
    var seen = new Uint8Array(N * N);
    var stack = [source];
    seen[idx(source.r, source.c)] = 1;
    while (stack.length) {
        var cur = stack[stack.length - 1];
        var opts = [];
        for (var k = 0; k < 4; k++) {
            var nr = cur.r + DIRS[k].dr, nc = cur.c + DIRS[k].dc;
            if (!inside(nr, nc) || seen[idx(nr, nc)]) continue;
            opts.push(k);
        }
        if (!opts.length) { stack.pop(); continue; }
        var d = DIRS[GU.pick(opts)];
        var r2 = cur.r + d.dr, c2 = cur.c + d.dc;
        pipes[idx(cur.r, cur.c)] |= d.bit;
        pipes[idx(r2, c2)]       |= d.opp;
        seen[idx(r2, c2)] = 1;
        stack.push({ r: r2, c: c2 });
    }

    /* Ahora se desordena. Una pieza recta (dos bocas opuestas) sólo tiene dos
     * orientaciones distintas, así que girarla 2 veces la deja igual: se gira
     * un número al azar de veces y se cuenta cuántas piezas quedan movidas,
     * para no anunciar un puzzle ya resuelto. */
    var moved = 0;
    for (var i = 0; i < pipes.length; i++) {
        var turns = GU.randInt(0, 3);
        for (var t = 0; t < turns; t++) pipes[i] = rot(pipes[i]);
        if (turns) moved++;
    }
    if (!moved) { newGame(); return; }

    moves = 0;
    gamePhase = 'playing';
    fx.clear();
    flood();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

/* ── Agua ─────────────────────────────────────────────────────────── */

/* Inundación desde el depósito: una celda recibe agua si su vecina ya la tiene
 * Y AMBAS tienen boca hacia la otra. Comprobar sólo un lado deja pasar el agua
 * por tuberías que no se tocan, que es el fallo clásico aquí. */
function flood() {
    filled = new Uint8Array(N * N);
    var q = [source];
    filled[idx(source.r, source.c)] = 1;
    while (q.length) {
        var cur = q.pop();
        var m = pipes[idx(cur.r, cur.c)];
        for (var k = 0; k < 4; k++) {
            var d = DIRS[k];
            if (!(m & d.bit)) continue;
            var nr = cur.r + d.dr, nc = cur.c + d.dc;
            if (!inside(nr, nc) || filled[idx(nr, nc)]) continue;
            if (!(pipes[idx(nr, nc)] & d.opp)) continue;
            filled[idx(nr, nc)] = 1;
            q.push({ r: nr, c: nc });
        }
    }
}

function connectedCount() {
    if (!filled) return 0;
    var n = 0;
    for (var i = 0; i < filled.length; i++) n += filled[i];
    return n;
}

/* ── Jugada ───────────────────────────────────────────────────────── */

function turn(r, c) {
    if (gamePhase !== 'playing') return;
    pipes[idx(r, c)] = rot(pipes[idx(r, c)]);
    moves++;
    flood();
    GameAudio.click();
    syncHud();
    if (connectedCount() === N * N) win();
}

function win() {
    gamePhase = 'won';
    var record = bests[diff].submit(moves);
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            fx.burst(cellX(c) + cell / 2, cellY(r) + cell / 2, 3,
                     { color: '#4fc3f7', speed: 60, life: 0.8, size: 2 });
        }
    }
    syncHud();
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Red completa!',
            overScore: 'Lo has hecho en ' + moves + (moves === 1 ? ' giro' : ' giros'),
            overBest:  bests[diff].has() ? 'Tu mejor marca aquí: ' + bests[diff].value : ''
        });
    }, 700);
}

function syncHud() {
    hud.set({
        moves: moves,
        conn:  connectedCount() + '/' + (N * N),
        best:  bests[diff].has() ? bests[diff].value : null
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function boardX() { return (W - N * cell) / 2; }
function boardY() { return 34; }
function cellX(c) { return boardX() + c * cell; }
function cellY(r) { return boardY() + r * cell; }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#12212e');
        g.addColorStop(1, '#0a141d');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    if (!pipes) { if (gamePhase === 'idle') drawIdle(); return; }

    /* Fondo de celdas en una pasada, tuberías en otra: dos cambios de estilo
     * por frame en vez de dos por celda. */
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            GU.roundRectPath(ctx, cellX(c) + 2, cellY(r) + 2, cell - 4, cell - 4, 6);
            ctx.fill();
        }
    }

    drawPipes(false);   // secas
    drawPipes(true);    // con agua, encima
    drawSource();
    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 8);
        ctx.stroke();
    }

    if (gamePhase === 'idle') drawIdle();
}

function drawPipes(wet) {
    ctx.strokeStyle = wet ? '#4fc3f7' : '#5a6b7a';
    ctx.lineWidth = Math.max(4, cell * 0.20);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            if ((filled[idx(r, c)] === 1) !== wet) continue;
            var m = pipes[idx(r, c)];
            var cx = cellX(c) + cell / 2, cy = cellY(r) + cell / 2;
            var half = cell / 2;
            /* Cada boca es un radio desde el centro. Un solo beginPath para
             * toda la pasada: trazar pieza a pieza multiplicaba los stroke(). */
            if (m & UP)    { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - half); }
            if (m & RIGHT) { ctx.moveTo(cx, cy); ctx.lineTo(cx + half, cy); }
            if (m & DOWN)  { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + half); }
            if (m & LEFT)  { ctx.moveTo(cx, cy); ctx.lineTo(cx - half, cy); }
        }
    }
    ctx.stroke();

    /* Los extremos sueltos llevan un grifo, para que se vea dónde falta agua. */
    ctx.fillStyle = wet ? '#7fdcff' : '#43505c';
    for (var r2 = 0; r2 < N; r2++) {
        for (var c2 = 0; c2 < N; c2++) {
            if ((filled[idx(r2, c2)] === 1) !== wet) continue;
            var mm = pipes[idx(r2, c2)];
            if (bitCount(mm) !== 1) continue;
            ctx.beginPath();
            ctx.arc(cellX(c2) + cell / 2, cellY(r2) + cell / 2, cell * 0.16, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function bitCount(m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1); }

function drawSource() {
    var cx = cellX(source.c) + cell / 2, cy = cellY(source.r) + cell / 2;
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5c0d';
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'TUBERÍAS',
        lines: ['Gira los tramos hasta que llegue el agua a todos'],
        bg: 'rgba(10,20,29,0.8)',
        color: '#4fc3f7'
    });
}

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    draw();
    return fx.count > 0;
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (gamePhase !== 'playing') return;
    var c = Math.floor((x - boardX()) / cell);
    var r = Math.floor((y - boardY()) / cell);
    if (!inside(r, c)) return;
    turn(r, c);
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Rejilla de tuberías. Flechas para moverte, Enter para girar el tramo.',
    targets: function () {
        var out = [];
        if (!pipes) return out;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                out.push({ x: cellX(c) + 2, y: cellY(r) + 2, w: cell - 4, h: cell - 4,
                           id: r + ',' + c, r: r, c: c });
            }
        }
        return out;
    },
    activate: function (t) { turn(t.r, t.c); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('diffSel').addEventListener('change', function () {
    diff = this.value;
    syncHud();
});

N = SIZES[diff];
cell = Math.floor(Math.min(W - 24, H - 60) / N);
syncHud();
draw();

}());

/* Inundación — tiñe el tablero entero desde la esquina superior izquierda.
 *
 * La mancha empieza en (0,0) y cada jugada la repinta de un color, absorbiendo
 * todo lo que ya tocaba de ese color. Ganar es dejar el tablero de un color
 * antes de agotar el límite de jugadas.
 *
 * Dos cosas que no son evidentes leyendo el código:
 *
 * - **El límite sale del tablero, no de una constante bonita.** Se resuelve el
 *   tablero recién generado con una heurística glotona y el límite es ese
 *   resultado más un margen. Un límite fijo es injusto en los dos sentidos: en
 *   un tablero fácil sobra tanto que el juego no existe, y en uno malo es
 *   imposible sin que el jugador pueda saberlo.
 * - **La región se recalcula entera en cada jugada**, con una inundación desde
 *   la esquina. Llevar la frontera a mano es más rápido y es justo donde se
 *   cuelan los fallos: una casilla que entra en la mancha por dos lados a la
 *   vez, o una que se queda fuera porque se visitó antes de teñirla.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var COLORS = ['#e94f4f', '#4fc3f7', '#ffd54a', '#66bb6a', '#ab63e0', '#ff8a3d'];
var SIZES = { facil: 10, medio: 14, dificil: 18 };

var BOARD_TOP = 16;
var PALETTE_H = 74;

var N = 14;
var cell = 1;
var grid = [];              // índice de color por celda
var mine = [];              // true si la celda es de la mancha
var moves = 0, limit = 0, zone = 1;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';        // idle | playing | won | lost
var diff = 'medio';

var fx = new Particles(160);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    moves: 'movesLabel',
    limit: 'limitLabel',
    zone:  'zoneLabel',
    best:  { el: 'highScore', format: function (v) { return v == null ? '—' : v + ' jugadas'; } },
    mobile: { el: 'mobileScore', format: function (v) {
        return 'Jugada ' + v.moves + '/' + v.limit + '  ·  ' + v.zone + ' de ' + (N * N);
    } }
});

/* Un récord por tamaño: el número de jugadas de un 18×18 no dice nada frente al
 * de un 10×10, y un único marcador mezclaría los tres. Menos es mejor. */
var bests = {
    facil:   GU.highScore('inundacionBestFacil',   { lower: true }),
    medio:   GU.highScore('inundacionBestMedio',   { lower: true }),
    dificil: GU.highScore('inundacionBestDificil', { lower: true })
};

var over = GU.popup('overPopup');

function idx(r, c) { return r * N + c; }
function inside(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

function boardSize() { return Math.min(W - 24, H - BOARD_TOP - PALETTE_H - 16); }
function boardX() { return (W - boardSize()) / 2; }
function boardY() { return BOARD_TOP; }

/* ── Inundación ───────────────────────────────────────────────────── */

/* Marca en `out` toda la región conectada a la esquina que comparte color con
 * ella. Pila explícita: en 18×18 la recursiva aguantaría, pero así el techo de
 * tamaño queda abierto. */
function floodRegion(g, out) {
    for (var i = 0; i < out.length; i++) out[i] = false;
    var target = g[0];
    var stack = [0];
    out[0] = true;
    var n = 1;
    while (stack.length) {
        var p = stack.pop();
        var r = (p / N) | 0, c = p % N;
        var nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        for (var k = 0; k < 4; k++) {
            var rr = nb[k][0], cc = nb[k][1];
            if (!inside(rr, cc)) continue;
            var q = idx(rr, cc);
            if (out[q] || g[q] !== target) continue;
            out[q] = true;
            n++;
            stack.push(q);
        }
    }
    return n;
}

/* Aplica un color: primero se tiñe la región actual y sólo DESPUÉS se vuelve a
 * inundar. Hacerlo al revés —buscar vecinos del nuevo color y luego teñir— deja
 * fuera las casillas que sólo quedan conectadas a través de las recién teñidas. */
function applyColor(g, region, color) {
    for (var i = 0; i < g.length; i++) if (region[i]) g[i] = color;
    return floodRegion(g, region);
}

function solvedCount(g) {
    var first = g[0];
    for (var i = 1; i < g.length; i++) if (g[i] !== first) return false;
    return true;
}

/* Resolvedor glotón: en cada paso elige el color que más casillas añade. No es
 * óptimo —eso es NP-difícil— pero da una cota honrada de lo que cuesta el
 * tablero, que es justo lo que necesita el límite de jugadas. */
function greedySolve(g0) {
    var g = g0.slice();
    var region = new Array(g.length);
    floodRegion(g, region);
    var n = 0;
    while (!solvedCount(g) && n < 400) {
        var bestC = -1, bestGain = -1;
        for (var c = 0; c < COLORS.length; c++) {
            if (c === g[0]) continue;
            var gg = g.slice(), rr = region.slice();
            var gain = applyColor(gg, rr, c);
            if (gain > bestGain) { bestGain = gain; bestC = c; }
        }
        if (bestC < 0) break;
        applyColor(g, region, bestC);
        n++;
    }
    return n;
}

/* ── Partida ──────────────────────────────────────────────────────── */

function newGame(level) {
    diff = level || diff;
    N = SIZES[diff];
    grid = new Array(N * N);
    mine = new Array(N * N);

    /* Un tablero al azar sin más: aquí sí vale, porque cualquier configuración
     * se puede resolver (basta con ir tiñendo) y lo único que varía es cuánto
     * cuesta. Eso lo mide greedySolve y de ahí sale el límite. */
    for (var i = 0; i < grid.length; i++) grid[i] = GU.randInt(0, COLORS.length - 1);

    limit = greedySolve(grid) + (diff === 'dificil' ? 3 : 2);
    zone = floodRegion(grid, mine);
    moves = 0;
    gamePhase = 'playing';
    cell = boardSize() / N;
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function syncHud() {
    hud.set({
        moves: moves,
        limit: limit,
        zone: zone,
        best: bests[diff].has() ? bests[diff].value : null
    });
}

function play(color) {
    if (gamePhase !== 'playing') return;
    if (color === grid[0]) {           // el color que ya tienes no es jugada
        msg.show('Ese ya es tu color', 1.1);
        view.invalidate();
        return;
    }
    var before = zone;
    zone = applyColor(grid, mine, color);
    moves++;
    syncHud();

    if (zone > before) {
        GameAudio.slide();
        /* Chispas en el borde de lo ganado, no en todo el tablero: lo que
         * interesa ver es por dónde ha crecido la mancha. */
        var added = 0;
        for (var i = 0; i < mine.length && added < 26; i++) {
            if (!mine[i]) continue;
            var r = (i / N) | 0, c = i % N;
            if (r > 0 && mine[idx(r - 1, c)] && r < N - 1 && mine[idx(r + 1, c)]) continue;
            fx.burst(boardX() + c * cell + cell / 2, boardY() + r * cell + cell / 2, 1,
                     { color: COLORS[color], speed: 26, life: 0.5, size: 2 });
            added++;
        }
    } else {
        GameAudio.hit();
    }

    if (solvedCount(grid)) win();
    else if (moves >= limit) lose();
    view.invalidate();
}

function win() {
    gamePhase = 'won';
    var record = bests[diff].submit(moves);
    for (var k = 0; k < 40; k++) {
        fx.burst(GU.rand(boardX(), boardX() + boardSize()),
                 GU.rand(boardY(), boardY() + boardSize()), 2,
                 { color: GU.pick(COLORS), speed: 90, life: 0.9, size: 3, gravity: 60 });
    }
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Tablero inundado!',
            overScore: 'Lo has teñido en ' + moves + (moves === 1 ? ' jugada' : ' jugadas') +
                       ' de ' + limit,
            overRecord: bests[diff].has() ? 'Tu mejor marca aquí: ' + bests[diff].value : ''
        });
    }, 650);
}

function lose() {
    gamePhase = 'lost';
    gameControls.idle();
    GameAudio.gameOver();
    setTimeout(function () {
        over.show({
            overTitle: 'Sin jugadas',
            overScore: 'Te faltaban ' + (N * N - zone) + ' casillas',
            overRecord: bests[diff].has() ? 'Tu mejor marca aquí: ' + bests[diff].value : ''
        });
    }, 500);
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function paletteRect(i) {
    var n = COLORS.length;
    var gap = 10;
    var size = Math.min(56, (W - 32 - gap * (n - 1)) / n);
    var total = size * n + gap * (n - 1);
    return {
        x: (W - total) / 2 + i * (size + gap),
        y: H - PALETTE_H + 10,
        w: size, h: size
    };
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#131f34');
        g.addColorStop(1, '#080d18');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var bx = boardX(), by = boardY();
    cell = boardSize() / N;

    /* Una pasada por color en vez de una por celda: son hasta 324 casillas y
     * cambiar fillStyle en cada una cuesta más que dibujarlas. */
    for (var c = 0; c < COLORS.length; c++) {
        ctx.fillStyle = COLORS[c];
        for (var i = 0; i < grid.length; i++) {
            if (grid[i] !== c) continue;
            var r = (i / N) | 0, cc = i % N;
            ctx.fillRect(bx + cc * cell, by + r * cell, cell + 0.5, cell + 0.5);
        }
    }

    /* El contorno de la mancha es lo único que dice de un vistazo qué llevas
     * ganado cuando media pantalla comparte color. */
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var j = 0; j < mine.length; j++) {
        if (!mine[j]) continue;
        var r2 = (j / N) | 0, c2 = j % N;
        var x = bx + c2 * cell, y = by + r2 * cell;
        if (!inside(r2 - 1, c2) || !mine[idx(r2 - 1, c2)]) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (!inside(r2 + 1, c2) || !mine[idx(r2 + 1, c2)]) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (!inside(r2, c2 - 1) || !mine[idx(r2, c2 - 1)]) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        if (!inside(r2, c2 + 1) || !mine[idx(r2, c2 + 1)]) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(143,211,244,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, boardSize() + 2, boardSize() + 2);

    // paleta
    for (var p = 0; p < COLORS.length; p++) {
        var rect = paletteRect(p);
        ctx.fillStyle = COLORS[p];
        GU.roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10);
        ctx.fill();
        if (p === grid[0]) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 4, t.y - 4, t.w + 8, t.h + 8, 12);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, H - PALETTE_H - 22);

    if (gamePhase === 'idle') {
        GU.idleScreen(ctx, {
            title: 'INUNDACIÓN',
            lines: ['Tiñe el tablero entero desde la esquina',
                    'Pulsa Iniciar'],
            bg: 'rgba(8,13,24,0.82)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (gamePhase !== 'playing') return;
    for (var i = 0; i < COLORS.length; i++) {
        var r = paletteRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { play(i); return; }
    }
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

/* Los seis colores son los únicos objetivos: no tiene sentido navegar por las
 * casillas, que no se pueden pulsar. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Paleta de colores. Flechas para moverte, Enter para elegir.',
    targets: function () {
        if (gamePhase !== 'playing') return [];
        return COLORS.map(function (col, i) {
            var r = paletteRect(i);
            return { x: r.x, y: r.y, w: r.w, h: r.h, id: 'c' + i };
        });
    },
    activate: function (t) { play(parseInt(t.id.slice(1), 10)); },
    onChange: function () { view.invalidate(); }
});

/* Los números 1..6 también eligen color: con seis opciones fijas es más rápido
 * que ir con las flechas. */
document.addEventListener('keydown', function (e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLORS.length) { play(n - 1); e.preventDefault(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. Entre jugadas esto es una imagen fija;
 * lo único que se mueve son las chispas y el mensaje. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    msg.update(dt);
    draw();
    return fx.count > 0 || msg.active();
});

var diffSel = document.createElement('select');
diffSel.id = 'diffSel';
['facil', 'medio', 'dificil'].forEach(function (d) {
    var o = document.createElement('option');
    o.value = d;
    o.textContent = { facil: 'Fácil (10×10)', medio: 'Medio (14×14)', dificil: 'Difícil (18×18)' }[d];
    if (d === 'medio') o.selected = true;
    diffSel.appendChild(o);
});
diffSel.setAttribute('aria-label', 'Tamaño del tablero');
document.querySelector('.buttons-panel').appendChild(diffSel);
diffSel.addEventListener('change', function () {
    diff = this.value;
    syncHud();
    view.invalidate();
});

var gameControls = GU.controls({
    start:     function () { newGame(diffSel.value); },
    restart:   function () { newGame(diffSel.value); },
    playAgain: function () { newGame(diffSel.value); },
    popup:     'overPopup'
});

syncHud();

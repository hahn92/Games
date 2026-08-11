// Sudoku — generador con solución única, notas a lápiz y validación al vuelo.
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('sudokuCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 450
var H = canvas.height;   // 560

var TOP    = 46;         // franja de cronómetro y errores
var PAD_X  = 22;         // margen lateral del tablero
var GRID_Y = 56;
var CELL   = 45;
var GRID   = CELL * 9;   // 405
var PAD_Y  = 482;        // fila de números
var PAD_W  = 41;
var PAD_H  = 46;
var PAD_GAP = 4.5;

var COL = {
    bg:       '#101a2e',
    cell:     '#16223c',
    cellAlt:  '#1b2a49',   // bloques 3x3 alternos
    sel:      '#2d4a7a',
    peer:     '#1f3159',   // fila/columna/bloque del seleccionado
    same:     '#2a4466',   // mismo número en otra casilla
    given:    '#cfe0f5',
    user:     '#8fd3f4',
    wrong:    '#ff6b5e',
    note:     '#7186a8',
    line:     'rgba(143,211,244,0.18)',
    lineBold: 'rgba(143,211,244,0.55)',
    padBg:    '#1b2a49',
    padTxt:   '#cfe0f5'
};

/* Pistas por dificultad. Menos pistas no significa siempre más difícil, pero
 * es la palanca que todo el mundo espera y la única que se puede garantizar
 * sin clasificar el puzzle por técnicas de resolución. */
var DIFFS = {
    facil:   { clues: 45, label: 'Fácil'   },
    medio:   { clues: 34, label: 'Medio'   },
    dificil: { clues: 28, label: 'Difícil' }
};
var MAX_ERRORS = 3;

/* ── Estado ── */
var gs = {
    solution: null,     // int[81] resuelto
    given:    null,     // bool[81] casillas de partida
    grid:     null,     // int[81] estado actual, 0 = vacía
    notes:    null,     // array de Set-like por casilla (objeto {n:true})
    sel:      40,       // índice de casilla seleccionada
    errors:   0,
    noteMode: false,
    status:   'idle',   // idle | playing | won | lost
    diff:     'medio',
    startMs:  0,
    elapsed:  0
};

var hud   = GU.hud({
    diff:   { el: 'diffLabel',  format: function (v) { return 'Dificultad: ' + v; } },
    errors: { el: 'errLabel',   format: function (v) { return 'Errores: ' + v + ' / ' + MAX_ERRORS; } },
    time:   { el: 'timeLabel',  format: function (v) { return 'Tiempo: ' + GU.formatTime(v); } },
    best:   { el: 'bestLabel',  format: function (v) { return 'Mejor: ' + v; } },
    mobile: { el: 'mobileScore', html: function (v) {
        return 'Errores: <b>' + v.errors + '/' + MAX_ERRORS + '</b> &nbsp; ' + GU.formatTime(v.time);
    } }
});

/* Un récord por dificultad, y es un TIEMPO: menor es mejor. */
var bests = {
    facil:   GU.highScore('sudoku_best_facil',   { lower: true }),
    medio:   GU.highScore('sudoku_best_medio',   { lower: true }),
    dificil: GU.highScore('sudoku_best_dificil', { lower: true })
};

var winPopup = GU.popup('winPopup');

/* ═══════════════ Generación ═══════════════ */

function idx(r, c) { return r * 9 + c; }

/* ¿Puede ir `n` en la casilla i sin romper fila, columna ni bloque? */
function fits(g, i, n) {
    var r = (i / 9) | 0, c = i % 9;
    var br = r - r % 3, bc = c - c % 3;
    for (var k = 0; k < 9; k++) {
        if (g[r * 9 + k] === n) return false;
        if (g[k * 9 + c] === n) return false;
        if (g[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)] === n) return false;
    }
    return true;
}

/* Rellena por backtracking con candidatos barajados: sin el barajado saldría
 * siempre la misma rejilla canónica. */
function fillGrid(g, i) {
    if (i === 81) return true;
    if (g[i] !== 0) return fillGrid(g, i + 1);
    var cand = GU.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var k = 0; k < 9; k++) {
        if (!fits(g, i, cand[k])) continue;
        g[i] = cand[k];
        if (fillGrid(g, i + 1)) return true;
        g[i] = 0;
    }
    return false;
}

/* Cuenta soluciones hasta `limit`, y se corta en cuanto llega: lo único que se
 * pregunta aquí es "¿hay más de una?".
 *
 * Esto NO puede ser un backtracking ingenuo que coja la primera casilla vacía.
 * makePuzzle lo llama una vez por casilla que intenta quitar — unas 80 veces
 * por partida — y sobre una rejilla de 28 pistas la versión ingenua tarda
 * tanto que la pestaña se queda colgada al generar en Difícil. Dos cosas lo
 * arreglan y las dos hacen falta:
 *
 *   · Máscaras de bits incrementales por fila, columna y bloque, en vez de
 *     recorrer 27 casillas para saber si una cifra cabe.
 *   · Elegir siempre la casilla con MENOS candidatos (MRV), y abandonar la
 *     rama en cuanto una casilla vacía se queda sin ninguno. Eso es lo que
 *     convierte el árbol de búsqueda en algo del tamaño de un puzzle real.
 *
 * Con las dos, generar en Difícil pasa de colgarse a 1 ms.
 *
 * Ojo con una cosa: esto se FÍA de las pistas que recibe. Sólo impide que un
 * número nuevo choque, no comprueba que las que ya están sean legales, así que
 * una rejilla con dos cifras iguales en la misma fila no se detecta — se
 * intenta resolver y demostrar que no tiene solución sobre un tablero casi
 * vacío es carísimo. Aquí da igual porque la única entrada posible sale de
 * quitar casillas de una solución válida, pero no lo llames con nada más. */
var ALL_DIGITS = 0x3FE;              // bits 1..9
var POPCOUNT = (function () {
    var t = new Uint8Array(1024);
    for (var i = 1; i < 1024; i++) t[i] = t[i >> 1] + (i & 1);
    return t;
}());

function countSolutions(g, limit) {
    var rowM = new Int16Array(9), colM = new Int16Array(9), boxM = new Int16Array(9);
    for (var i = 0; i < 81; i++) {
        var v = g[i];
        if (!v) continue;
        var r = (i / 9) | 0, c = i % 9;
        var bit = 1 << v;
        rowM[r] |= bit; colM[c] |= bit; boxM[((r / 3) | 0) * 3 + ((c / 3) | 0)] |= bit;
    }
    return solveCount(g, rowM, colM, boxM, limit);
}

function solveCount(g, rowM, colM, boxM, limit) {
    var best = -1, bestMask = 0, bestCount = 10;
    for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var r = (i / 9) | 0, c = i % 9;
        var mask = ALL_DIGITS & ~(rowM[r] | colM[c] | boxM[((r / 3) | 0) * 3 + ((c / 3) | 0)]);
        var cnt = POPCOUNT[mask];
        if (cnt === 0) return 0;                    // casilla muerta: podar ya
        if (cnt < bestCount) {
            bestCount = cnt; best = i; bestMask = mask;
            if (cnt === 1) break;                   // no hay nada mejor que una
        }
    }
    if (best < 0) return 1;                         // rejilla completa

    var br = (best / 9) | 0, bc = best % 9;
    var bb = ((br / 3) | 0) * 3 + ((bc / 3) | 0);
    var total = 0;
    for (var n = 1; n <= 9; n++) {
        var b = 1 << n;
        if (!(bestMask & b)) continue;
        g[best] = n; rowM[br] |= b; colM[bc] |= b; boxM[bb] |= b;
        total += solveCount(g, rowM, colM, boxM, limit - total);
        g[best] = 0; rowM[br] &= ~b; colM[bc] &= ~b; boxM[bb] &= ~b;
        if (total >= limit) return total;
    }
    return total;
}

/* Quita casillas mientras la solución siga siendo única.
 *
 * Se quitan de dos en dos por simetría central, que es como se ven los sudokus
 * impresos. El objetivo de pistas es aproximado a propósito: forzarlo exacto
 * puede no ser alcanzable manteniendo unicidad, y el bucle se quedaría
 * girando. Se intenta cada casilla una vez y se acepta lo que salga. */
function makePuzzle(solution, targetClues) {
    var g = solution.slice();
    var order = GU.shuffle(Array.from({ length: 81 }, function (_, i) { return i; }));
    var clues = 81;

    for (var k = 0; k < order.length && clues > targetClues; k++) {
        var a = order[k], b = 80 - a;
        if (g[a] === 0) continue;
        var sa = g[a], sb = g[b];
        var pair = (a !== b);
        g[a] = 0; if (pair) g[b] = 0;
        if (countSolutions(g.slice(), 2) !== 1) {
            g[a] = sa; if (pair) g[b] = sb;      // se pasó: devolver ambas
        } else {
            clues -= pair ? 2 : 1;
        }
    }
    return g;
}

function newGame(diff) {
    gs.diff = diff || gs.diff;
    var sol = new Array(81).fill(0);
    fillGrid(sol, 0);
    var puz = makePuzzle(sol, DIFFS[gs.diff].clues);

    gs.solution = sol;
    gs.grid     = puz.slice();
    gs.given    = puz.map(function (v) { return v !== 0; });
    gs.notes    = puz.map(function () { return {}; });
    gs.errors   = 0;
    gs.noteMode = false;
    gs.status   = 'playing';
    gs.startMs  = performance.now();
    gs.elapsed  = 0;
    /* Arrancar sobre una casilla editable: dejar el cursor en una pista
     * hace pensar que el tablero no responde. */
    gs.sel = firstEmpty();

    cursor.set('c' + gs.sel);
    winPopup.hide();
    syncHud();
    GameAudio.start();
}

function firstEmpty() {
    for (var i = 0; i < 81; i++) if (!gs.given[i]) return i;
    return 40;
}

/* ═══════════════ Jugar ═══════════════ */

function place(n) {
    if (gs.status !== 'playing') return;
    var i = gs.sel;
    if (gs.given[i]) { GameAudio.miss(); return; }

    if (gs.noteMode && n > 0) {
        if (gs.notes[i][n]) delete gs.notes[i][n]; else gs.notes[i][n] = true;
        GameAudio.type();
        return;
    }

    if (n === 0) {                       // borrar
        if (gs.grid[i] === 0 && !hasNotes(i)) return;
        gs.grid[i] = 0;
        gs.notes[i] = {};
        GameAudio.slide();
        return;
    }

    if (gs.grid[i] === n) return;        // ya estaba
    gs.grid[i] = n;
    gs.notes[i] = {};

    if (n !== gs.solution[i]) {
        gs.errors++;
        GameAudio.noMatch();
        syncHud();
        if (gs.errors >= MAX_ERRORS) return lose();
        return;
    }

    /* Un número correcto limpia esa nota de sus vecinas: es lo que haría a
     * mano quien juega con lápiz, y no hacerlo convierte las notas en ruido. */
    clearPeerNotes(i, n);
    GameAudio.correct();
    if (solved()) return win();
}

function hasNotes(i) {
    for (var n in gs.notes[i]) if (gs.notes[i][n]) return true;
    return false;
}

function clearPeerNotes(i, n) {
    var r = (i / 9) | 0, c = i % 9;
    var br = r - r % 3, bc = c - c % 3;
    for (var k = 0; k < 9; k++) {
        delete gs.notes[r * 9 + k][n];
        delete gs.notes[k * 9 + c][n];
        delete gs.notes[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)][n];
    }
}

function solved() {
    for (var i = 0; i < 81; i++) if (gs.grid[i] !== gs.solution[i]) return false;
    return true;
}

function win() {
    gs.status = 'won';
    gs.elapsed = performance.now() - gs.startMs;
    var record = bests[gs.diff].submit(gs.elapsed);
    syncHud();
    GameAudio.win();
    winPopup.show({
        winTitle: record ? '¡Nuevo récord!' : '¡Sudoku resuelto!',
        winTime:  'Tiempo: ' + GU.formatTime(gs.elapsed, { ms: true }),
        winBest:  'Mejor en ' + DIFFS[gs.diff].label + ': ' +
                  (bests[gs.diff].has() ? GU.formatTime(bests[gs.diff].value) : '—')
    });
}

function lose() {
    gs.status = 'lost';
    GameAudio.gameOver();
    winPopup.show({
        winTitle: 'Demasiados errores',
        winTime:  'Fallaste ' + MAX_ERRORS + ' veces',
        winBest:  'Pulsa para intentarlo de nuevo'
    });
}

function syncHud() {
    hud.set({
        diff:   DIFFS[gs.diff].label,
        errors: gs.errors,
        time:   gs.elapsed,
        best:   bests[gs.diff].has() ? GU.formatTime(bests[gs.diff].value) : '—'
    });
}

/* ═══════════════ Entrada ═══════════════ */

function cellRect(i) {
    return {
        x: PAD_X + (i % 9) * CELL,
        y: GRID_Y + (((i / 9) | 0)) * CELL,
        w: CELL, h: CELL
    };
}

function padRect(n) {
    return { x: PAD_X + (n - 1) * (PAD_W + PAD_GAP), y: PAD_Y, w: PAD_W, h: PAD_H };
}

/* Un único punto de entrada para ratón, toque y cursor de teclado, para que
 * los tres modos no puedan divergir. */
function handleAt(x, y) {
    if (gs.status === 'idle') return;

    if (y >= GRID_Y && y < GRID_Y + GRID && x >= PAD_X && x < PAD_X + GRID) {
        var c = ((x - PAD_X) / CELL) | 0;
        var r = ((y - GRID_Y) / CELL) | 0;
        gs.sel = idx(r, c);
        cursor.set('c' + gs.sel);
        GameAudio.click();
        return;
    }

    if (y >= PAD_Y && y < PAD_Y + PAD_H) {
        for (var n = 1; n <= 9; n++) {
            var p = padRect(n);
            if (x >= p.x && x < p.x + p.w) { place(n); return; }
        }
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});

/* onTap entrega coordenadas de canvas, así que entra por el mismo handleAt
 * que el ratón — sin duplicar el mapeo de píxel a casilla. */
GU.swipe(canvas, {
    preventDefault: true,
    onTap: function (p) { handleAt(p.x, p.y); }
});

/* Cursor de teclado sobre las 81 casillas. Las flechas mueven la selección;
 * los dígitos escriben en ella. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de sudoku. Flechas para moverte, 1 a 9 para escribir, 0 o Retroceso para borrar, N para notas.',
    targets: function () {
        var out = [];
        for (var i = 0; i < 81; i++) {
            var r = cellRect(i);
            r.id = 'c' + i;
            out.push(r);
        }
        return out;
    },
    onMove:   function (t) { gs.sel = parseInt(t.id.slice(1), 10); },
    activate: function (t) { gs.sel = parseInt(t.id.slice(1), 10); }
});

canvas.addEventListener('keydown', function (e) {
    if (gs.status !== 'playing') return;
    if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        place(parseInt(e.key, 10));
    } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        place(0);
    } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        toggleNotes();
    }
});

function toggleNotes() {
    gs.noteMode = !gs.noteMode;
    var b = document.getElementById('noteBtn');
    if (b) b.textContent = gs.noteMode ? 'Notas: ON' : 'Notas: OFF';
    GameAudio.click();
}

/* ═══════════════ Dibujo ═══════════════ */

var grads = GU.gradientMemo();

function draw() {
    ctx.fillStyle = grads('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0d1526');
        g.addColorStop(1, COL.bg);
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawTopBar();
    if (gs.status === 'idle') { drawIdle(); return; }
    drawCells();
    drawNumbers();
    drawLines();
    drawCursorRing();
    drawPad();
}

function drawTopBar() {
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, 0, W, TOP);
    ctx.font = 'bold 17px sans-serif';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(DIFFS[gs.diff].label, 16, TOP / 2);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfe0f5';
    ctx.fillText(GU.formatTime(gs.elapsed), W / 2, TOP / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = gs.errors > 0 ? COL.wrong : '#6f86a8';
    ctx.fillText(gs.errors + '/' + MAX_ERRORS, W - 16, TOP / 2);
}

function drawIdle() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('SUDOKU', W / 2, H / 2 - 30);
    ctx.fillStyle = '#cfe0f5';
    ctx.font = '16px sans-serif';
    ctx.fillText('Elige dificultad y pulsa Nueva partida', W / 2, H / 2 + 10);
}

/* Fondos: bloque alterno, casillas relacionadas, mismo número, selección. */
function drawCells() {
    var sr = (gs.sel / 9) | 0, sc = gs.sel % 9;
    var sv = gs.grid[gs.sel];

    for (var i = 0; i < 81; i++) {
        var r = (i / 9) | 0, c = i % 9;
        var block = (((r / 3) | 0) + ((c / 3) | 0)) % 2 === 0;
        var fill = block ? COL.cellAlt : COL.cell;

        if (i === gs.sel) {
            fill = COL.sel;
        } else if (sv !== 0 && gs.grid[i] === sv) {
            fill = COL.same;
        } else if (r === sr || c === sc ||
                   (((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0))) {
            fill = COL.peer;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(PAD_X + c * CELL, GRID_Y + r * CELL, CELL, CELL);
    }
}

function drawNumbers() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (var i = 0; i < 81; i++) {
        var x = PAD_X + (i % 9) * CELL + CELL / 2;
        var y = GRID_Y + (((i / 9) | 0)) * CELL + CELL / 2;
        var v = gs.grid[i];

        if (v === 0) { drawNotes(i, x, y); continue; }

        if (gs.given[i]) {
            ctx.fillStyle = COL.given;
            ctx.font = 'bold 26px sans-serif';
        } else if (v !== gs.solution[i]) {
            ctx.fillStyle = COL.wrong;
            ctx.font = 'bold 26px sans-serif';
        } else {
            ctx.fillStyle = COL.user;
            ctx.font = '26px sans-serif';
        }
        ctx.fillText(String(v), x, y + 1);
    }
}

/* Notas en una mini-rejilla 3x3 dentro de la casilla. */
function drawNotes(i, cx, cy) {
    var any = false;
    for (var k in gs.notes[i]) { if (gs.notes[i][k]) { any = true; break; } }
    if (!any) return;
    ctx.fillStyle = COL.note;
    ctx.font = '11px sans-serif';
    for (var n = 1; n <= 9; n++) {
        if (!gs.notes[i][n]) continue;
        var nc = (n - 1) % 3, nr = ((n - 1) / 3) | 0;
        ctx.fillText(String(n), cx + (nc - 1) * 13, cy + (nr - 1) * 13);
    }
}

/* Las 20 líneas en dos paths — uno fino y uno grueso — en vez de una llamada
 * por línea. */
function drawLines() {
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 0; k <= 9; k++) {
        if (k % 3 === 0) continue;
        ctx.moveTo(PAD_X + k * CELL, GRID_Y);
        ctx.lineTo(PAD_X + k * CELL, GRID_Y + GRID);
        ctx.moveTo(PAD_X, GRID_Y + k * CELL);
        ctx.lineTo(PAD_X + GRID, GRID_Y + k * CELL);
    }
    ctx.stroke();

    ctx.strokeStyle = COL.lineBold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var b = 0; b <= 9; b += 3) {
        ctx.moveTo(PAD_X + b * CELL, GRID_Y);
        ctx.lineTo(PAD_X + b * CELL, GRID_Y + GRID);
        ctx.moveTo(PAD_X, GRID_Y + b * CELL);
        ctx.lineTo(PAD_X + GRID, GRID_Y + b * CELL);
    }
    ctx.stroke();
}

/* El anillo de foco lo pinta el juego, después de las piezas: es un indicador
 * de foco, no una decoración del tablero. */
function drawCursorRing() {
    var t = cursor && cursor.target();
    if (!t) return;
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 3;
    ctx.strokeRect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3);
}

/* Cuántas de cada cifra quedan por colocar. Se cuenta UNA vez por frame en un
 * recorrido de las 81 casillas; preguntarlo por cifra eran nueve recorridos,
 * 729 iteraciones por frame para nueve números. */
var padLeft = new Array(10).fill(9);

function countRemaining() {
    for (var n = 1; n <= 9; n++) padLeft[n] = 9;
    for (var i = 0; i < 81; i++) {
        var v = gs.grid[i];
        if (v !== 0 && v === gs.solution[i]) padLeft[v]--;
    }
}

function drawPad() {
    countRemaining();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var n = 1; n <= 9; n++) {
        var p = padRect(n);
        var left = padLeft[n];
        ctx.fillStyle = left <= 0 ? '#141f36' : (gs.noteMode ? '#233a63' : COL.padBg);
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 8);
        ctx.fill();

        ctx.fillStyle = left <= 0 ? '#3d4b66' : COL.padTxt;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(String(n), p.x + p.w / 2, p.y + p.h / 2 - 4);

        /* Cuántas quedan por colocar: la ayuda que más se agradece y la que
         * ningún sudoku de papel puede dar. */
        ctx.fillStyle = left <= 0 ? '#3d4b66' : '#6f86a8';
        ctx.font = '10px sans-serif';
        ctx.fillText(left > 0 ? String(left) : '✓', p.x + p.w / 2, p.y + p.h - 10);
    }
}

/* ═══════════════ Bucle ═══════════════ */

/* rafLoop, no un rAF a mano: dt viene acotado, así que una pestaña que vuelve
 * de segundo plano no salta el cronómetro de golpe. */
rafLoop(function () {
    if (gs.status === 'playing') {
        gs.elapsed = performance.now() - gs.startMs;
        hud.set({ time: gs.elapsed });
    }
    draw();
});

/* ═══════════════ Botones ═══════════════ */

document.getElementById('startBtn').addEventListener('click', function () {
    newGame(document.getElementById('diffSel').value);
});
document.getElementById('restartBtn').addEventListener('click', function () {
    if (gs.status === 'idle') return newGame(gs.diff);
    /* Reiniciar vuelve al MISMO puzzle, no a uno nuevo: querer repetir el que
     * se te ha atragantado es lo normal, y para otro está Nueva partida. */
    for (var i = 0; i < 81; i++) {
        if (!gs.given[i]) { gs.grid[i] = 0; gs.notes[i] = {}; }
    }
    gs.errors = 0;
    gs.status = 'playing';
    gs.startMs = performance.now();
    gs.elapsed = 0;
    gs.sel = firstEmpty();
    winPopup.hide();
    syncHud();
    GameAudio.start();
});
document.getElementById('noteBtn').addEventListener('click', toggleNotes);
document.getElementById('eraseBtn').addEventListener('click', function () { place(0); });
document.getElementById('playAgainBtn').addEventListener('click', function () {
    newGame(gs.diff);
});
document.getElementById('diffSel').addEventListener('change', function () {
    hud.set({ best: bests[this.value].has() ? GU.formatTime(bests[this.value].value) : '—' });
});

syncHud();

}());

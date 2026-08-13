// Nonograma (Picross) — puzzles generados y verificados por lógica pura.
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('nonoCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 460
var H = canvas.height;   // 500

var TOP  = 40;           // franja de cronómetro y errores
var CLUE_FS = 13;        // tamaño fijo de las pistas
var CLUE_STEP_X = 17;    // separación entre pistas de una fila
var CLUE_STEP_Y = 16;    // ídem de una columna
var CELL = 34;

var COL = {
    bg:      '#0f1a2b',
    clueBg:  '#152238',
    cell:    '#1d2c46',
    cellAlt: '#22334f',
    fill:    '#8fd3f4',
    mark:    '#5a6c88',
    wrong:   '#ff6b5e',
    done:    '#4ade80',
    line:    'rgba(143,211,244,0.16)',
    lineBold:'rgba(143,211,244,0.5)',
    txt:     '#cfe0f5',
    txtDim:  '#66799a'
};

var SIZES = {
    facil:   { n: 5,  label: 'Fácil (5×5)',    density: 0.55 },
    medio:   { n: 10, label: 'Medio (10×10)',  density: 0.52 },
    dificil: { n: 15, label: 'Difícil (15×15)', density: 0.5 }
};

var EMPTY = 0, FILLED = 1, MARKED = 2;   // estado de cada casilla del jugador

/* ── Estado ── */
var gs = {
    n: 10,
    sol: null,          // Uint8Array n*n, 1 = pintada
    grid: null,         // Uint8Array n*n con EMPTY/FILLED/MARKED
    rowClues: null,
    colClues: null,
    sel: 0,
    errors: 0,
    status: 'idle',
    diff: 'medio',
    startMs: 0,
    elapsed: 0,
    cell: CELL,
    gx: 0, gy: 0
};

var MAX_ERRORS = 3;

var hud = GU.hud({
    diff:   { el: 'diffLabel', format: function (v) { return 'Tamaño: ' + v; } },
    errors: { el: 'errLabel',  format: function (v) { return 'Errores: ' + v + ' / ' + MAX_ERRORS; } },
    time:   { el: 'timeLabel', format: function (v) { return 'Tiempo: ' + GU.formatTime(v); } },
    left:   { el: 'leftLabel', format: function (v) { return 'Faltan: ' + v; } },
    mobile: { el: 'mobileScore', html: function (v) {
        return 'Faltan: <b>' + v.left + '</b> &nbsp; ' + v.errors + '/' + MAX_ERRORS +
               ' &nbsp; ' + GU.formatTime(v.time);
    } }
});

var bests = {
    facil:   GU.highScore('nono_best_facil',   { lower: true }),
    medio:   GU.highScore('nono_best_medio',   { lower: true }),
    dificil: GU.highScore('nono_best_dificil', { lower: true })
};

var winPopup = GU.popup('winPopup');

/* ═══════════════ Pistas ═══════════════ */

/* Longitudes de los grupos seguidos de una línea. Una línea vacía da [0], no
 * una lista vacía: es lo que se dibuja en el margen y lo que espera el
 * solucionador. */
function cluesOf(line) {
    var out = [], run = 0;
    for (var i = 0; i < line.length; i++) {
        if (line[i]) run++;
        else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
}

function rowOf(sol, n, r) {
    var a = new Uint8Array(n);
    for (var c = 0; c < n; c++) a[c] = sol[r * n + c];
    return a;
}
function colOf(sol, n, c) {
    var a = new Uint8Array(n);
    for (var r = 0; r < n; r++) a[r] = sol[r * n + c];
    return a;
}

/* ═══════════════ Solucionador de líneas ═══════════════ */

/* Todas las colocaciones de `clues` en una línea de `len` compatibles con lo
 * que ya se sabe. `known` lleva 1 (pintada), 0 (vacía) o -1 (sin decidir).
 *
 * Devuelve la intersección de todas ellas: qué casillas salen pintadas en
 * TODAS y cuáles salen vacías en todas. Eso es exactamente lo que se puede
 * deducir de esa línea sin adivinar. */
function lineDeduce(clues, len, known) {
    var allFilled = null, allEmpty = null;
    var line = new Int8Array(len);

    function place(ci, start) {
        if (ci === clues.length) {
            for (var k = start; k < len; k++) {
                if (known[k] === 1) return;      // queda una pintada sin cubrir
                line[k] = 0;
            }
            record();
            return;
        }
        var run = clues[ci];
        /* La última posición posible deja hueco para los grupos que faltan. */
        var rest = 0;
        for (var j = ci + 1; j < clues.length; j++) rest += clues[j] + 1;
        var last = len - rest - run;

        for (var s = start; s <= last; s++) {
            var ok = true;
            for (var g = start; g < s; g++) {          // huecos antes del grupo
                if (known[g] === 1) { ok = false; break; }
            }
            if (!ok) break;                            // ya hay una pintada atrás
            for (var b = s; b < s + run; b++) {
                if (known[b] === 0) { ok = false; break; }
            }
            if (ok && s + run < len && known[s + run] === 1) ok = false;
            if (!ok) continue;

            for (var g2 = start; g2 < s; g2++) line[g2] = 0;
            for (var b2 = s; b2 < s + run; b2++) line[b2] = 1;
            if (s + run < len) line[s + run] = 0;
            place(ci + 1, s + run + 1);
        }
    }

    function record() {
        if (allFilled === null) {
            allFilled = Int8Array.from(line);
            allEmpty  = Int8Array.from(line, function (v) { return v ? 0 : 1; });
            return;
        }
        for (var k = 0; k < len; k++) {
            if (!line[k]) allFilled[k] = 0;
            if (line[k])  allEmpty[k]  = 0;
        }
    }

    if (clues.length === 1 && clues[0] === 0) {
        for (var z = 0; z < len; z++) {
            if (known[z] === 1) return null;
            line[z] = 0;
        }
        record();
    } else {
        place(0, 0);
    }
    if (allFilled === null) return null;               // línea imposible
    return { filled: allFilled, empty: allEmpty };
}

/* ¿Se puede resolver el puzzle sólo deduciendo línea a línea, sin suponer?
 *
 * Esto es lo que separa un nonograma justo de uno que obliga a probar y
 * retroceder. Un patrón aleatorio NO suele ser justo, así que se generan
 * patrones hasta que uno lo es — es más barato tirar y repetir que intentar
 * arreglar un patrón concreto. */
function logicallySolvable(rowClues, colClues, n) {
    var k = new Int8Array(n * n).fill(-1);
    var known = Array.from(k);
    var changed = true, undecided = n * n;

    while (changed && undecided > 0) {
        changed = false;
        for (var r = 0; r < n; r++) {
            var lineK = [];
            for (var c = 0; c < n; c++) lineK.push(known[r * n + c]);
            var d = lineDeduce(rowClues[r], n, lineK);
            if (!d) return false;
            for (var c2 = 0; c2 < n; c2++) {
                var i = r * n + c2;
                if (known[i] !== -1) continue;
                if (d.filled[c2]) { known[i] = 1; undecided--; changed = true; }
                else if (d.empty[c2]) { known[i] = 0; undecided--; changed = true; }
            }
        }
        for (var c3 = 0; c3 < n; c3++) {
            var colK = [];
            for (var r2 = 0; r2 < n; r2++) colK.push(known[r2 * n + c3]);
            var dc = lineDeduce(colClues[c3], n, colK);
            if (!dc) return false;
            for (var r3 = 0; r3 < n; r3++) {
                var j = r3 * n + c3;
                if (known[j] !== -1) continue;
                if (dc.filled[r3]) { known[j] = 1; undecided--; changed = true; }
                else if (dc.empty[r3]) { known[j] = 0; undecided--; changed = true; }
            }
        }
    }
    return undecided === 0;
}

/* ═══════════════ Generación ═══════════════ */

function newGame(diff) {
    gs.diff = diff || gs.diff;
    var cfg = SIZES[gs.diff];
    var n = cfg.n;

    var sol = null, rowClues = null, colClues = null;
    /* Cota dura de intentos: sin ella una mala racha bloquearía la pestaña. Si
     * se agota se acepta el último patrón igualmente — resoluble a base de
     * alguna suposición, que es peor pero jugable, y no pasa casi nunca. */
    for (var attempt = 0; attempt < 60; attempt++) {
        sol = randomPattern(n, cfg.density);
        rowClues = []; colClues = [];
        for (var r = 0; r < n; r++) rowClues.push(cluesOf(rowOf(sol, n, r)));
        for (var c = 0; c < n; c++) colClues.push(cluesOf(colOf(sol, n, c)));
        if (logicallySolvable(rowClues, colClues, n)) break;
    }

    gs.n = n;
    gs.sol = sol;
    gs.rowClues = rowClues;
    gs.colClues = colClues;
    gs.grid = new Uint8Array(n * n);
    gs.errors = 0;
    gs.status = 'playing';
    gs.startMs = performance.now();
    gs.elapsed = 0;
    gs.sel = 0;
    layout();
    cursor.set('c0');
    winPopup.hide();
    syncHud();
    GameAudio.start();
}

/* Patrón aleatorio, pero con dos correcciones que hacen los puzzles más
 * bonitos y más resolubles: sin filas ni columnas totalmente vacías (aburren y
 * dan pistas "0" de más) y con un sesgo a agrupar vecinos, que produce formas
 * en vez de confeti. */
function randomPattern(n, density) {
    var g = new Uint8Array(n * n);
    for (var i = 0; i < n * n; i++) g[i] = Math.random() < density ? 1 : 0;

    for (var pass = 0; pass < 2; pass++) {
        var next = Uint8Array.from(g);
        for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
                var live = 0;
                for (var dr = -1; dr <= 1; dr++) {
                    for (var dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        var rr = r + dr, cc = c + dc;
                        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
                        live += g[rr * n + cc];
                    }
                }
                if (live >= 5) next[r * n + c] = 1;
                else if (live <= 1) next[r * n + c] = 0;
            }
        }
        g = next;
    }

    for (var r2 = 0; r2 < n; r2++) {
        var any = false;
        for (var c2 = 0; c2 < n; c2++) if (g[r2 * n + c2]) { any = true; break; }
        if (!any) g[r2 * n + GU.randInt(0, n - 1)] = 1;
    }
    for (var c3 = 0; c3 < n; c3++) {
        var any2 = false;
        for (var r3 = 0; r3 < n; r3++) if (g[r3 * n + c3]) { any2 = true; break; }
        if (!any2) g[GU.randInt(0, n - 1) * n + c3] = 1;
    }
    return g;
}

/* El margen de pistas se mide sobre las pistas REALES del puzzle, no con una
 * constante. Un 15x15 puede tener 8 números en una línea y necesita el margen
 * entero; un 10x10 rara vez pasa de 3, y reservarle lo mismo dejaba el tablero
 * descentrado con una franja vacía enorme arriba y a la izquierda.
 *
 * La fuente de las pistas es FIJA (CLUE_FS). Escalarla con la celda haría que
 * el margen dependiese del tamaño de celda y el tamaño de celda del margen. */
function layout() {
    var maxRow = 1, maxCol = 1;
    if (gs.rowClues) {
        for (var r = 0; r < gs.rowClues.length; r++) maxRow = Math.max(maxRow, gs.rowClues[r].length);
        for (var c = 0; c < gs.colClues.length; c++) maxCol = Math.max(maxCol, gs.colClues[c].length);
    } else {
        maxRow = maxCol = Math.ceil(gs.n / 2);      // cota antes del primer reparto
    }
    var clueW = maxRow * CLUE_STEP_X + 12;
    var clueH = maxCol * CLUE_STEP_Y + 14;

    var avail = Math.min(W - clueW - 12, H - TOP - clueH - 12);
    gs.cell = Math.floor(avail / gs.n);
    var side = gs.cell * gs.n;
    gs.clueW = clueW;
    gs.clueH = clueH;
    gs.gx = clueW + (W - clueW - side) / 2;
    gs.gy = TOP + clueH + (H - TOP - clueH - side) / 2;
}

/* ═══════════════ Jugar ═══════════════ */

function toggle(i, mark) {
    if (gs.status !== 'playing') return;
    var cur = gs.grid[i];

    if (mark) {
        gs.grid[i] = (cur === MARKED) ? EMPTY : MARKED;
        GameAudio.click();
        return;
    }
    if (cur === FILLED) { gs.grid[i] = EMPTY; GameAudio.slide(); syncHud(); return; }
    if (cur === MARKED) return;               // hay que desmarcar primero

    if (gs.sol[i]) {
        gs.grid[i] = FILLED;
        GameAudio.reveal();
        syncHud();
        if (complete()) return win();
    } else {
        /* Pintar donde no toca es el único error posible: marcar de más no
         * cuenta, porque marcar es una nota del jugador y no una afirmación. */
        gs.grid[i] = MARKED;
        gs.errors++;
        GameAudio.noMatch();
        syncHud();
        if (gs.errors >= MAX_ERRORS) lose();
    }
}

function complete() {
    for (var i = 0; i < gs.n * gs.n; i++) {
        if (gs.sol[i] && gs.grid[i] !== FILLED) return false;
    }
    return true;
}

function remaining() {
    var left = 0;
    for (var i = 0; i < gs.n * gs.n; i++) if (gs.sol[i] && gs.grid[i] !== FILLED) left++;
    return left;
}

function win() {
    gs.status = 'won';
    gs.elapsed = performance.now() - gs.startMs;
    var record = bests[gs.diff].submit(gs.elapsed);
    syncHud();
    GameAudio.win();
    winPopup.show({
        winTitle: record ? '¡Nuevo récord!' : '¡Imagen revelada!',
        winTime:  'Tiempo: ' + GU.formatTime(gs.elapsed, { ms: true }),
        winBest:  'Mejor en ' + SIZES[gs.diff].label + ': ' +
                  (bests[gs.diff].has() ? GU.formatTime(bests[gs.diff].value) : '—')
    });
}

function lose() {
    gs.status = 'lost';
    GameAudio.gameOver();
    winPopup.show({
        winTitle: 'Demasiados errores',
        winTime:  'Pintaste ' + MAX_ERRORS + ' casillas equivocadas',
        winBest:  'Pulsa para empezar otro'
    });
}

function syncHud() {
    hud.set({
        diff:   SIZES[gs.diff].label,
        errors: gs.errors,
        time:   gs.elapsed,
        left:   gs.sol ? remaining() : 0
    });
}

/* ═══════════════ Entrada ═══════════════ */

function cellAt(x, y) {
    if (x < gs.gx || y < gs.gy) return -1;
    var c = ((x - gs.gx) / gs.cell) | 0;
    var r = ((y - gs.gy) / gs.cell) | 0;
    if (c < 0 || r < 0 || c >= gs.n || r >= gs.n) return -1;
    return r * gs.n + c;
}

function handleAt(x, y, mark) {
    var i = cellAt(x, y);
    if (i < 0) return;
    gs.sel = i;
    cursor.set('c' + i);
    toggle(i, mark);
}

canvas.addEventListener('mousedown', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y, e.button === 2 || e.shiftKey);
});
/* Botón derecho = marcar, así que hay que quitar el menú contextual o el
 * gesto natural del ratón abre un menú encima del tablero. */
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* En táctil no hay botón derecho: un toque pinta y el botón "Marcar" del panel
 * cambia el modo. */
var markMode = false;
GU.swipe(canvas, {
    preventDefault: true,
    onTap: function (p) { handleAt(p.x, p.y, markMode); }
});

var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de nonograma. Flechas para moverte, Enter para pintar, M para marcar.',
    targets: function () {
        var out = [];
        for (var i = 0; i < gs.n * gs.n; i++) {
            out.push({
                x: gs.gx + (i % gs.n) * gs.cell,
                y: gs.gy + ((i / gs.n) | 0) * gs.cell,
                w: gs.cell, h: gs.cell, id: 'c' + i
            });
        }
        return out;
    },
    onMove:   function (t) { gs.sel = parseInt(t.id.slice(1), 10); },
    activate: function (t) { toggle(parseInt(t.id.slice(1), 10), false); }
});

canvas.addEventListener('keydown', function (e) {
    if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggle(gs.sel, true);
    }
});

function setMarkMode(on) {
    markMode = on;
    var b = document.getElementById('markBtn');
    if (b) b.textContent = markMode ? 'Marcar: ON' : 'Marcar: OFF';
}

/* ═══════════════ Dibujo ═══════════════ */

var grads = GU.gradientMemo();

function draw() {
    ctx.fillStyle = grads('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1424');
        g.addColorStop(1, COL.bg);
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawTopBar();
    if (gs.status === 'idle') { drawIdle(); return; }
    drawClues();
    drawCells();
    drawLines();
    drawRing();
}

function drawTopBar() {
    ctx.fillStyle = '#08111f';
    ctx.fillRect(0, 0, W, TOP);
    ctx.font = 'bold 16px sans-serif';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(gs.status === 'idle' ? 'NONOGRAMA' : SIZES[gs.diff].label, 14, TOP / 2);

    ctx.textAlign = 'center';
    ctx.fillStyle = COL.txt;
    ctx.fillText(GU.formatTime(gs.elapsed), W / 2, TOP / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = gs.errors > 0 ? COL.wrong : COL.txtDim;
    ctx.fillText(gs.errors + '/' + MAX_ERRORS, W - 14, TOP / 2);
}

function drawIdle() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('NONOGRAMA', W / 2, H / 2 - 30);
    ctx.fillStyle = COL.txt;
    ctx.font = '15px sans-serif';
    ctx.fillText('Los números dicen cuántas casillas seguidas', W / 2, H / 2 + 6);
    ctx.fillText('hay que pintar en cada fila y columna', W / 2, H / 2 + 28);
}

/* Una pista se tacha en cuanto su fila o columna está resuelta: es la ayuda
 * que convierte un nonograma grande en algo llevadero. */
function drawClues() {
    var fs = CLUE_FS;
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.textBaseline = 'middle';

    for (var r = 0; r < gs.n; r++) {
        var done = lineDone(rowState(r), gs.rowClues[r]);
        ctx.fillStyle = done ? COL.txtDim : COL.txt;
        ctx.textAlign = 'right';
        var cl = gs.rowClues[r];
        var y = gs.gy + r * gs.cell + gs.cell / 2;
        for (var k = 0; k < cl.length; k++) {
            var x = gs.gx - 8 - (cl.length - 1 - k) * CLUE_STEP_X;
            ctx.fillText(String(cl[k]), x, y);
        }
    }

    for (var c = 0; c < gs.n; c++) {
        var doneC = lineDone(colState(c), gs.colClues[c]);
        ctx.fillStyle = doneC ? COL.txtDim : COL.txt;
        ctx.textAlign = 'center';
        var cc = gs.colClues[c];
        var x2 = gs.gx + c * gs.cell + gs.cell / 2;
        for (var k2 = 0; k2 < cc.length; k2++) {
            var y2 = gs.gy - 10 - (cc.length - 1 - k2) * CLUE_STEP_Y;
            ctx.fillText(String(cc[k2]), x2, y2);
        }
    }
}

function rowState(r) {
    var a = new Uint8Array(gs.n);
    for (var c = 0; c < gs.n; c++) a[c] = gs.grid[r * gs.n + c] === FILLED ? 1 : 0;
    return a;
}
function colState(c) {
    var a = new Uint8Array(gs.n);
    for (var r = 0; r < gs.n; r++) a[r] = gs.grid[r * gs.n + c] === FILLED ? 1 : 0;
    return a;
}
function lineDone(state, clues) {
    var got = cluesOf(state);
    if (got.length !== clues.length) return false;
    for (var i = 0; i < got.length; i++) if (got[i] !== clues[i]) return false;
    return true;
}

function drawCells() {
    for (var i = 0; i < gs.n * gs.n; i++) {
        var r = (i / gs.n) | 0, c = i % gs.n;
        var x = gs.gx + c * gs.cell, y = gs.gy + r * gs.cell;
        var block = ((((r / 5) | 0) + ((c / 5) | 0)) % 2) === 0;

        ctx.fillStyle = block ? COL.cell : COL.cellAlt;
        ctx.fillRect(x, y, gs.cell, gs.cell);

        var v = gs.grid[i];
        if (v === FILLED) {
            ctx.fillStyle = COL.fill;
            ctx.fillRect(x + 1, y + 1, gs.cell - 2, gs.cell - 2);
        } else if (v === MARKED) {
            /* Aspa en dos trazos dentro de un solo path. */
            ctx.strokeStyle = COL.mark;
            ctx.lineWidth = 2;
            var p = gs.cell * 0.3;
            ctx.beginPath();
            ctx.moveTo(x + p, y + p);
            ctx.lineTo(x + gs.cell - p, y + gs.cell - p);
            ctx.moveTo(x + gs.cell - p, y + p);
            ctx.lineTo(x + p, y + gs.cell - p);
            ctx.stroke();
        }
    }
}

function drawLines() {
    var side = gs.cell * gs.n;
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 0; k <= gs.n; k++) {
        if (k % 5 === 0) continue;
        ctx.moveTo(gs.gx + k * gs.cell, gs.gy);
        ctx.lineTo(gs.gx + k * gs.cell, gs.gy + side);
        ctx.moveTo(gs.gx, gs.gy + k * gs.cell);
        ctx.lineTo(gs.gx + side, gs.gy + k * gs.cell);
    }
    ctx.stroke();

    ctx.strokeStyle = COL.lineBold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var b = 0; b <= gs.n; b += 5) {
        ctx.moveTo(gs.gx + b * gs.cell, gs.gy);
        ctx.lineTo(gs.gx + b * gs.cell, gs.gy + side);
        ctx.moveTo(gs.gx, gs.gy + b * gs.cell);
        ctx.lineTo(gs.gx + side, gs.gy + b * gs.cell);
    }
    ctx.stroke();
}

function drawRing() {
    var t = cursor && cursor.target();
    if (!t) return;
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 3;
    ctx.strokeRect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3);
}

/* ═══════════════ Bucle ═══════════════ */

rafLoop(function () {
    if (gs.status === 'playing') {
        gs.elapsed = performance.now() - gs.startMs;
        hud.set({ time: gs.elapsed });
    }
    draw();
});

/* ═══════════════ Botones ═══════════════ */

var gameControls = GU.controls({
    start:     function () { newGame(document.getElementById('diffSel').value); },
    restart:   restartSamePuzzle,
    playAgain: function () { newGame(gs.diff); },
    popup:     'winPopup'
});

/* Reiniciar vuelve al MISMO patrón, no a uno nuevo: para otro está Nueva partida. */
function restartSamePuzzle() {
    if (gs.status === 'idle') return newGame(gs.diff);
    gs.grid = new Uint8Array(gs.n * gs.n);
    gs.errors = 0;
    gs.status = 'playing';
    gs.startMs = performance.now();
    gs.elapsed = 0;
    winPopup.hide();
    syncHud();
    GameAudio.start();
}
document.getElementById('markBtn').addEventListener('click', function () {
    setMarkMode(!markMode);
    GameAudio.click();
});
layout();
syncHud();

}());

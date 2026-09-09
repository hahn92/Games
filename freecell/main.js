/* FreeCell — las 52 cartas a la vista, cuatro celdas libres y ocho columnas.
 *
 * Notas que no se ven leyendo el código:
 *
 * - **Sólo se mueve UNA carta.** Lo que parece arrastrar una escalera entera es
 *   una cadena de movimientos de una en una usando las celdas y las columnas
 *   vacías como aparcamiento. El máximo es (celdas libres + 1) × 2^(columnas
 *   vacías), la fórmula estándar, y está implementada tal cual: dejarla en
 *   "celdas + 1" hace el juego mucho más difícil de lo que es, y no limitarla lo
 *   convierte en otro juego.
 * - **La columna de destino vacía no cuenta como aparcamiento** al calcular ese
 *   máximo. Es el detalle que casi todas las versiones caseras se saltan y por
 *   el que un movimiento imposible parece legal.
 * - **Deshacer guarda una instantánea completa**, como en solitario y sokoban:
 *   52 objetos diminutos son más baratos de copiar que de invertir, y la
 *   operación inversa es donde se esconden los fallos.
 * - El auto-completado sólo sube una carta cuando ya no puede hacer falta abajo
 *   —las dos del color contrario y un rango menor ya están subidas—, que es la
 *   regla segura de toda la vida.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var deckArt = GU.cards({ w: 62, h: 88 });
var CW = deckArt.w, CH = deckArt.h;

var COLS = 8, CELLS = 4;
var TOP = 16;
var FAN = 24;                    // separación vertical dentro de una columna

/* Las ocho columnas nacen ya creadas, aunque vacías. El primer `draw()` puede
 * correr ANTES de que Iniciar reparta —en móvil lo hace siempre, porque
 * MobileLayout dispara un resize que pide repintado nada más cargar— y con
 * `cols` a [] la línea `cols[c].length` explota. La excepción salta a media
 * función: se pintaban las celdas y las pilas, y el tapete se quedaba sin
 * cartas. Mismo criterio que el board de 2048, que se inicializa lleno de ceros
 * por esto mismo. */
var cols = [[], [], [], [], [], [], [], []];
var cells = [];                  // 4 huecos: carta o null
var found = { C: -1, D: -1, T: -1, P: -1 };   // rango subido por palo, -1 vacío
var sel = null;                  // {zone:'col'|'cell', i, ci}
var moves = 0, status = 'idle';
var undoStack = [];
var autoT = 0;

var fx = new Particles(160);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    moves: 'movesLabel',
    found: 'foundLabel',
    best:  { el: 'highScore', format: function (v) { return v == null ? '—' : v + ' mov.'; } },
    mobile: { el: 'mobileScore', format: function (v) {
        return v.moves + ' movimientos  ·  ' + v.found + '/52 subidas';
    } }
});

/* Menos movimientos es mejor, así que el récord va invertido: con el 0 por
 * defecto de un marcador normal la primera partida nunca sería récord. */
var best = GU.highScore('freecellBest', { lower: true });
var over = GU.popup('overPopup');

/* ── Reparto ──────────────────────────────────────────────────────── */

function newGame() {
    var deck = GU.shuffle(deckArt.deck());
    cols = [];
    for (var i = 0; i < COLS; i++) cols.push([]);
    /* Reparto estándar: de izquierda a derecha, así que las cuatro primeras
     * columnas llevan 7 cartas y las cuatro últimas 6. */
    for (var k = 0; k < deck.length; k++) cols[k % COLS].push(deck[k]);
    cells = [null, null, null, null];
    found = { C: -1, D: -1, T: -1, P: -1 };
    sel = null;
    moves = 0;
    undoStack.length = 0;
    autoT = 0;
    status = 'playing';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function foundCount() {
    var n = 0;
    for (var s in found) n += found[s] + 1;
    return n;
}

function syncHud() {
    hud.set({ moves: moves, found: foundCount(), best: best.has() ? best.value : null });
}

function snapshot() {
    undoStack.push({
        cols: cols.map(function (c) { return c.slice(); }),
        cells: cells.slice(),
        found: { C: found.C, D: found.D, T: found.T, P: found.P },
        moves: moves
    });
    if (undoStack.length > 200) undoStack.shift();
}

function undo() {
    if (status !== 'playing' || !undoStack.length) return;
    var h = undoStack.pop();
    cols = h.cols; cells = h.cells; found = h.found; moves = h.moves;
    sel = null;
    GameAudio.click();
    syncHud();
    view.invalidate();
}

/* ── Reglas ───────────────────────────────────────────────────────── */

function canStack(card, onto) {
    return deckArt.isRed(card.s) !== deckArt.isRed(onto.s) && card.r === onto.r - 1;
}

function freeCells() {
    var n = 0;
    for (var i = 0; i < CELLS; i++) if (!cells[i]) n++;
    return n;
}

function emptyCols(excluding) {
    var n = 0;
    for (var i = 0; i < COLS; i++) if (!cols[i].length && i !== excluding) n++;
    return n;
}

/* (celdas libres + 1) × 2^(columnas vacías). La columna de destino no cuenta si
 * está vacía: no puedes aparcar en el sitio donde vas a dejar la escalera. */
function maxRun(destCol) {
    return (freeCells() + 1) * Math.pow(2, emptyCols(destCol));
}

/* Cuántas cartas del final de la columna forman escalera descendente
 * alternando color. Es lo máximo que se puede intentar mover de una vez. */
function runLength(col) {
    var c = cols[col];
    if (!c.length) return 0;
    var n = 1;
    for (var i = c.length - 1; i > 0; i--) {
        if (canStack(c[i], c[i - 1])) n++;
        else break;
    }
    return n;
}

function canToFound(card) {
    return found[card.s] === card.r - 1;
}

/* La regla segura de toda la vida: una carta se puede subir sin pensar si ya no
 * puede hacer falta para colocar ninguna del color contrario. */
function safeToFound(card) {
    if (!canToFound(card)) return false;
    if (card.r <= 1) return true;              // ases y doses, siempre
    if (deckArt.isRed(card.s)) {
        return found.T >= card.r - 1 && found.P >= card.r - 1;
    }
    return found.C >= card.r - 1 && found.D >= card.r - 1;
}

/* Separado de autoStep() para poder preguntar SIN mutar: el bucle de dibujo
 * necesita saber si queda algo que subir para decidir si sigue pidiendo frames,
 * y si lo preguntara subiendo una carta no habría forma de pararlo. */
function anyAuto() {
    for (var i = 0; i < COLS; i++) {
        var c = cols[i];
        if (c.length && safeToFound(c[c.length - 1])) return true;
    }
    for (var k = 0; k < CELLS; k++) {
        if (cells[k] && safeToFound(cells[k])) return true;
    }
    return false;
}

function autoStep() {
    for (var i = 0; i < COLS; i++) {
        var c = cols[i];
        if (c.length && safeToFound(c[c.length - 1])) {
            snapshot();
            var card = c.pop();
            found[card.s] = card.r;
            moves++;
            landFx(foundRect(card.s));
            GameAudio.flip();
            syncHud();
            return true;
        }
    }
    for (var k = 0; k < CELLS; k++) {
        if (cells[k] && safeToFound(cells[k])) {
            snapshot();
            var cd = cells[k];
            cells[k] = null;
            found[cd.s] = cd.r;
            moves++;
            landFx(foundRect(cd.s));
            GameAudio.flip();
            syncHud();
            return true;
        }
    }
    return false;
}

function landFx(rect) {
    fx.burst(rect.x + CW / 2, rect.y + CH / 2, 8,
             { color: '#ffd54a', speed: 70, life: 0.5, size: 2 });
}

function checkWin() {
    if (foundCount() < 52) return;
    status = 'won';
    var record = best.submit(moves);
    for (var k = 0; k < 34; k++) {
        fx.burst(GU.rand(20, W - 20), GU.rand(20, H * 0.6), 2,
                 { color: GU.pick(['#ffd54a', '#8fd3f4', '#e94f4f']), speed: 120, life: 1, size: 3, gravity: 120 });
    }
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Resuelto!',
            overScore: 'Las 52 arriba en ' + moves + ' movimientos',
            overRecord: best.has() ? 'Tu mejor marca: ' + best.value + ' movimientos' : ''
        });
    }, 700);
}

/* ── Movimientos ──────────────────────────────────────────────────── */

function moveToCol(from, dest) {
    var src = cols[from];
    var run = runLength(from);
    var target = cols[dest];

    /* Cuántas cartas del final encajan en el destino: si está vacío, las que
     * permita el máximo; si no, hasta la que apile sobre su última carta. */
    var n = 0;
    if (!target.length) {
        n = Math.min(run, maxRun(dest));
    } else {
        for (var k = 1; k <= run; k++) {
            if (canStack(src[src.length - k], target[target.length - 1])) { n = k; break; }
        }
        if (!n) return false;
        if (n > maxRun(dest)) {
            msg.show('No caben tantas: libera celdas o columnas', 1.6);
            GameAudio.hit();
            return false;
        }
    }
    if (!n) return false;

    snapshot();
    var moving = src.splice(src.length - n, n);
    for (var i = 0; i < moving.length; i++) target.push(moving[i]);
    moves++;
    GameAudio.slide();
    syncHud();
    return true;
}

function moveToCell(from, cellIdx) {
    if (cells[cellIdx]) return false;
    var src = cols[from];
    if (!src.length) return false;
    snapshot();
    cells[cellIdx] = src.pop();
    moves++;
    GameAudio.place();
    syncHud();
    return true;
}

function moveToFound(card, take) {
    if (!canToFound(card)) return false;
    snapshot();
    take();
    found[card.s] = card.r;
    moves++;
    landFx(foundRect(card.s));
    GameAudio.flip();
    syncHud();
    return true;
}

/* ── Geometría ────────────────────────────────────────────────────── */

var GAP = 6;
function cellRect(i) {
    return { x: GAP + i * (CW + GAP), y: TOP, w: CW, h: CH };
}
function foundRect(suit) {
    var i = deckArt.SUITS.indexOf(suit);
    return { x: W - GAP - (4 - i) * (CW + GAP) + GAP, y: TOP, w: CW, h: CH };
}
function colX(i) {
    var total = COLS * CW + (COLS - 1) * GAP;
    return (W - total) / 2 + i * (CW + GAP);
}
function colY() { return TOP + CH + 22; }

/* El abanico se estrecha cuando una columna crece. Con los 24 px fijos, una
 * columna de 17 cartas —que sale sin esfuerzo en FreeCell, porque aquí se apila
 * mucho más que en el solitario clásico— se sale del canvas por abajo y las
 * últimas cartas quedan invisibles e intocables. Lo calcula la columna MÁS
 * LARGA, no cada una: si cada columna llevara su propio paso, la misma carta
 * estaría a distinta altura según la vecina y el tablero bailaría en cada
 * movimiento. */
function fan() {
    var max = 1;
    for (var i = 0; i < COLS; i++) if (cols[i].length > max) max = cols[i].length;
    if (max < 2) return FAN;
    var room = H - colY() - CH - 26;
    return Math.max(11, Math.min(FAN, room / (max - 1)));
}
function cardY(col, ci) { return colY() + ci * fan(); }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function drawSlot(rect, label) {
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    GU.roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.stroke();
    if (label) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.save();
        deckArt.suitPath(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, 16);
        ctx.fill();
        ctx.restore();
    }
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0f5c34');
        g.addColorStop(1, '#083c22');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < CELLS; i++) {
        var r = cellRect(i);
        drawSlot(r);
        if (cells[i]) deckArt.face(cells[i].s, cells[i].r).draw(ctx, r.x, r.y);
    }

    for (var s = 0; s < 4; s++) {
        var suit = deckArt.SUITS[s];
        var fr = foundRect(suit);
        drawSlot(fr, suit);
        if (found[suit] >= 0) deckArt.face(suit, found[suit]).draw(ctx, fr.x, fr.y);
    }

    for (var c = 0; c < COLS; c++) {
        var x = colX(c);
        if (!cols[c].length) {
            drawSlot({ x: x, y: colY(), w: CW, h: CH });
            continue;
        }
        for (var k = 0; k < cols[c].length; k++) {
            var card = cols[c][k];
            deckArt.face(card.s, card.r).draw(ctx, x, cardY(c, k));
        }
    }

    // selección
    if (sel) {
        var sr = selRect();
        if (sr) {
            ctx.strokeStyle = '#ffd54a';
            ctx.lineWidth = 3;
            GU.roundRectPath(ctx, sr.x - 2, sr.y - 2, sr.w + 4, sr.h + 4, 9);
            ctx.stroke();
        }
    }

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 3, t.y - 3, t.w + 6, t.h + 6, 10);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, H - 18);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'FREECELL',
            lines: ['Las 52 cartas a la vista y cuatro celdas libres',
                    'Pulsa Iniciar'],
            bg: 'rgba(6,40,22,0.86)',
            color: '#ffd54a'
        });
    }
}

function selRect() {
    if (!sel) return null;
    if (sel.zone === 'cell') return cellRect(sel.i);
    var col = cols[sel.i];
    if (!col.length) return null;
    var run = runLength(sel.i);
    var start = col.length - run;
    return { x: colX(sel.i), y: cardY(sel.i, start), w: CW, h: CH + (run - 1) * fan() };
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function hit(x, y) {
    for (var i = 0; i < CELLS; i++) {
        var r = cellRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { zone: 'cell', i: i };
    }
    for (var s = 0; s < 4; s++) {
        var fr = foundRect(deckArt.SUITS[s]);
        if (x >= fr.x && x <= fr.x + fr.w && y >= fr.y && y <= fr.y + fr.h) {
            return { zone: 'found', i: s };
        }
    }
    for (var c = 0; c < COLS; c++) {
        var cx = colX(c);
        if (x < cx || x > cx + CW) continue;
        var len = Math.max(1, cols[c].length);
        var bottom = cardY(c, len - 1) + CH;
        if (y >= colY() && y <= bottom) return { zone: 'col', i: c };
    }
    return null;
}

function handleAt(x, y) {
    if (status !== 'playing') return;
    var h = hit(x, y);
    if (!h) { sel = null; view.invalidate(); return; }

    if (!sel) {
        if (h.zone === 'col' && cols[h.i].length) sel = h;
        else if (h.zone === 'cell' && cells[h.i]) sel = h;
        if (sel) GameAudio.click();
        view.invalidate();
        return;
    }

    /* Segundo toque: destino. Tocar el mismo sitio deselecciona. */
    if (sel.zone === h.zone && sel.i === h.i) { sel = null; view.invalidate(); return; }

    var done = false;
    if (h.zone === 'found') {
        var suit = deckArt.SUITS[h.i];
        if (sel.zone === 'cell') {
            var cd = cells[sel.i];
            if (cd && cd.s === suit) done = moveToFound(cd, function () { cells[sel.i] = null; });
        } else {
            var col = cols[sel.i];
            var top = col[col.length - 1];
            if (top && top.s === suit) done = moveToFound(top, function () { col.pop(); });
        }
    } else if (h.zone === 'cell') {
        if (sel.zone === 'col') done = moveToCell(sel.i, h.i);
    } else {
        if (sel.zone === 'cell') {
            var card = cells[sel.i];
            var target = cols[h.i];
            if (card && (!target.length || canStack(card, target[target.length - 1]))) {
                snapshot();
                target.push(card);
                cells[sel.i] = null;
                moves++;
                GameAudio.slide();
                syncHud();
                done = true;
            }
        } else {
            done = moveToCol(sel.i, h.i);
        }
    }

    if (!done && !msg.active()) GameAudio.hit();
    sel = null;
    checkWin();
    view.invalidate();
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de FreeCell. Flechas para moverte, Enter para elegir.',
    targets: function () {
        if (status !== 'playing') return [];
        var out = [];
        for (var i = 0; i < CELLS; i++) {
            var r = cellRect(i);
            out.push({ x: r.x, y: r.y, w: r.w, h: r.h, id: 'cell' + i });
        }
        for (var s = 0; s < 4; s++) {
            var fr = foundRect(deckArt.SUITS[s]);
            out.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h, id: 'f' + s });
        }
        for (var c = 0; c < COLS; c++) {
            var len = Math.max(1, cols[c].length);
            out.push({ x: colX(c), y: cardY(c, len - 1), w: CW, h: CH, id: 'col' + c });
        }
        return out;
    },
    activate: function (t) { handleAt(t.x + CW / 2, t.y + CH / 2); },
    onChange: function () { view.invalidate(); }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'Z') { undo(); e.preventDefault(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. El auto-completado es lo que mantiene
 * el bucle vivo mientras queda algo que subir solo. */
var view = rafDraw(function (dt) {
    var pend = status === 'playing' && anyAuto();
    if (pend) {
        /* Una carta cada 0,12 s en vez de todas de golpe: si suben todas en el
         * mismo frame, el final de la partida se ve como un parpadeo. */
        autoT += dt;
        if (autoT > 0.12) {
            autoT = 0;
            autoStep();
            checkWin();
        }
    }
    fx.update(dt);
    msg.update(dt);
    draw();
    return pend || fx.count > 0 || msg.active();
});

var undoBtn = document.createElement('button');
undoBtn.type = 'button';
undoBtn.id = 'undoBtn';
undoBtn.textContent = 'Deshacer (Z)';
document.querySelector('.buttons-panel').appendChild(undoBtn);
undoBtn.addEventListener('click', undo);

var gameControls = GU.controls({
    start:     newGame,
    restart:   newGame,
    playAgain: newGame,
    popup:     'overPopup'
});

syncHud();

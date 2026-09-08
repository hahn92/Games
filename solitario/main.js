// Solitario Klondike — robo de 1 o 3, deshacer ilimitado y auto-completado.
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('solCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 700
var H = canvas.height;   // 680

var CW = 84, CH = 118;        // carta
var GAP = 14;
var TOP_Y = 16;               // fila de stock / waste / fundaciones
var TAB_Y = TOP_Y + CH + 26;  // fila del tablero
/* El caso peor de una columna son 6 tapadas más una escalera completa K..A:
 * 19 cartas. Con estos dos valores la última acaba en y=632, dentro de los 680
 * del canvas. Subirlos vuelve a sacar la columna por abajo. */
var FAN_DOWN = 24;            // separación de cartas boca arriba
var FAN_HIDE = 11;            // ídem boca abajo, más juntas

var SUITS = ['C', 'D', 'T', 'P'];       // corazones, diamantes, tréboles, picas
var RED = { C: true, D: true, T: false, P: false };
var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/* ── Estado ──
 *
 * Cada montón es un array de {s, r, up}. `r` es el índice 0..12, así que el as
 * es 0 y el rey 12 — comparar rangos es aritmética directa y no hay que mapear
 * nombres en el bucle de reglas. */
var gs = {
    stock: [], waste: [],
    found: [[], [], [], []],
    tab: [[], [], [], [], [], [], []],
    drag: null,          // {from, idx, cards, dx, dy, x, y}
    draw3: false,
    moves: 0,
    startMs: 0, elapsed: 0,
    status: 'idle',      // idle | playing | won
    undo: [],
    hint: null, hintT: 0,
    autoT: 0
};

var hud = GU.hud({
    moves: { el: 'movesLabel', format: function (v) { return 'Movimientos: ' + v; } },
    stock: { el: 'stockLabel', format: function (v) { return 'Mazo: ' + v; } },
    time:  { el: 'timeLabel',  format: function (v) { return 'Tiempo: ' + GU.formatTime(v); } },
    best:  { el: 'bestLabel',  format: function (v) { return 'Mejor: ' + v; } },
    mobile: { el: 'mobileScore', html: function (v) {
        return 'Mov: <b>' + v.moves + '</b> &nbsp; Mazo: ' + v.stock + ' &nbsp; ' + GU.formatTime(v.time);
    } }
});
var best = GU.highScore('solitarioBest', { lower: true });   // mejor TIEMPO
var winPopup = GU.popup('winPopup');

/* ═══════════════ Sprites de cartas ═══════════════
 *
 * Una carta es un rectángulo redondeado con dos índices y un palo dibujado a
 * mano. Son 52 caras y un dorso, cada una idéntica en cada frame y repintada
 * hasta 52 veces por frame — el caso de libro para prerenderizar. Sin esto son
 * ~200 llamadas de path por frame sólo para las esquinas.
 *
 * Nunca emoji: los palos son paths (ver la regla del proyecto). */
var faces = GU.spriteSheet(function (key) {
    if (key === 'back') return makeBack();
    var s = key[0], r = parseInt(key.slice(1), 10);
    return makeFace(s, r);
});

function makeBack() {
    return GU.sprite(CW, CH, function (c) {
        c.fillStyle = '#123a6b';
        c.beginPath(); c.roundRect(0.5, 0.5, CW - 1, CH - 1, 8); c.fill();
        c.strokeStyle = '#e8eef7'; c.lineWidth = 2;
        c.beginPath(); c.roundRect(4, 4, CW - 8, CH - 8, 6); c.stroke();
        /* El recorte va ANTES de trazar las diagonales: el beginPath que
         * necesita el rectángulo de recorte descarta el path que hubiera, así
         * que construirlas primero significaba trazar el rectángulo. */
        c.save();
        c.beginPath(); c.roundRect(4, 4, CW - 8, CH - 8, 6); c.clip();
        c.strokeStyle = 'rgba(143,211,244,0.45)';
        c.lineWidth = 1;
        c.beginPath();
        for (var i = -CH; i < CW; i += 10) {
            c.moveTo(i, 4); c.lineTo(i + CH - 8, CH - 4);
        }
        c.stroke();
        c.restore();
    });
}

function makeFace(s, r) {
    return GU.sprite(CW, CH, function (c) {
        c.fillStyle = '#fdfdfb';
        c.beginPath(); c.roundRect(0.5, 0.5, CW - 1, CH - 1, 8); c.fill();
        c.strokeStyle = '#c3ccd8'; c.lineWidth = 1;
        c.beginPath(); c.roundRect(0.5, 0.5, CW - 1, CH - 1, 8); c.stroke();

        var col = RED[s] ? '#d63c34' : '#1d2430';
        var label = RANKS[r];
        c.fillStyle = col;
        c.font = 'bold 17px sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(label, 6, 5);
        suitPath(c, s, 13, 30, 7);
        c.fill();

        // esquina inferior, girada 180° como en una baraja real
        c.save();
        c.translate(CW, CH);
        c.rotate(Math.PI);
        c.fillStyle = col;
        c.fillText(label, 6, 5);
        suitPath(c, s, 13, 30, 7);
        c.fill();
        c.restore();

        // centro
        c.fillStyle = col;
        if (r >= 10) {
            c.font = 'bold 40px serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(label, CW / 2, CH / 2 + 2);
            c.strokeStyle = col; c.lineWidth = 1.5;
            c.strokeRect(18, 26, CW - 36, CH - 52);
        } else {
            suitPath(c, s, CW / 2, CH / 2, 19);
            c.fill();
        }
    });
}

/* Los cuatro palos como paths. `k` es el radio nominal. */
function suitPath(c, s, x, y, k) {
    c.beginPath();
    if (s === 'C') {                                   // corazón
        GU.heartPath(c, x, y, k * 2);
    } else if (s === 'D') {                            // diamante
        c.moveTo(x, y - k);
        c.lineTo(x + k * 0.72, y);
        c.lineTo(x, y + k);
        c.lineTo(x - k * 0.72, y);
        c.closePath();
    } else if (s === 'T') {                            // trébol
        var rr = k * 0.46;
        c.arc(x, y - k * 0.42, rr, 0, Math.PI * 2);
        c.closePath();
        c.moveTo(x - k * 0.5 + rr, y + k * 0.18);
        c.arc(x - k * 0.5, y + k * 0.18, rr, 0, Math.PI * 2);
        c.closePath();
        c.moveTo(x + k * 0.5 + rr, y + k * 0.18);
        c.arc(x + k * 0.5, y + k * 0.18, rr, 0, Math.PI * 2);
        c.closePath();
        c.moveTo(x - k * 0.16, y + k * 0.2);
        c.lineTo(x - k * 0.30, y + k);
        c.lineTo(x + k * 0.30, y + k);
        c.lineTo(x + k * 0.16, y + k * 0.2);
        c.closePath();
    } else {                                           // pica
        c.moveTo(x, y - k);
        c.bezierCurveTo(x + k * 0.95, y - k * 0.1, x + k * 0.62, y + k * 0.45, x + k * 0.08, y + k * 0.16);
        c.lineTo(x + k * 0.30, y + k);
        c.lineTo(x - k * 0.30, y + k);
        c.lineTo(x - k * 0.08, y + k * 0.16);
        c.bezierCurveTo(x - k * 0.62, y + k * 0.45, x - k * 0.95, y - k * 0.1, x, y - k);
        c.closePath();
    }
}

function faceOf(card) { return faces.get(card.up ? card.s + card.r : 'back'); }

/* ═══════════════ Reparto ═══════════════ */

function newGame() {
    var deck = [];
    for (var si = 0; si < 4; si++) {
        for (var r = 0; r < 13; r++) deck.push({ s: SUITS[si], r: r, up: false });
    }
    GU.shuffle(deck);

    gs.tab = [[], [], [], [], [], [], []];
    for (var col = 0; col < 7; col++) {
        for (var k = 0; k <= col; k++) {
            var c = deck.pop();
            c.up = (k === col);            // sólo la última de cada columna
            gs.tab[col].push(c);
        }
    }
    gs.stock = deck;
    gs.waste = [];
    gs.found = [[], [], [], []];
    gs.drag = null;
    gs.moves = 0;
    gs.undo = [];
    gs.status = 'playing';
    gs.startMs = performance.now();
    gs.elapsed = 0;
    gs.hint = null;
    winPopup.hide();
    syncHud();
    GameAudio.start();
}

function syncHud() {
    hud.set({
        moves: gs.moves,
        stock: gs.stock.length + gs.waste.length,
        time: gs.elapsed,
        best: best.has() ? GU.formatTime(best.value) : '—'
    });
}

/* ═══════════════ Reglas ═══════════════ */

/* Al tablero: alternando color y bajando de rango. Una columna vacía sólo
 * acepta un rey — es la regla que hace que vaciar una columna sea valioso. */
function canStack(card, onto) {
    if (!onto) return card.r === 12;
    if (!onto.up) return false;
    return RED[card.s] !== RED[onto.s] && card.r === onto.r - 1;
}

/* A la fundación: mismo palo, subiendo de uno en uno, empezando por el as. */
function canFound(card, pile) {
    if (!pile.length) return card.r === 0;
    var top = pile[pile.length - 1];
    return top.s === card.s && card.r === top.r + 1;
}

/* ═══════════════ Geometría ═══════════════ */

function stockRect() { return { x: GAP, y: TOP_Y, w: CW, h: CH }; }
function wasteRect() { return { x: GAP + CW + GAP, y: TOP_Y, w: CW, h: CH }; }
function foundRect(i) {
    return { x: W - GAP - (4 - i) * (CW + GAP) + GAP, y: TOP_Y, w: CW, h: CH };
}
function tabX(col) {
    var total = 7 * CW + 6 * GAP;
    return (W - total) / 2 + col * (CW + GAP);
}
function tabCardY(col, i) {
    var y = TAB_Y;
    for (var k = 0; k < i; k++) y += gs.tab[col][k].up ? FAN_DOWN : FAN_HIDE;
    return y;
}
function tabHeight(col) {
    return tabCardY(col, gs.tab[col].length) - TAB_Y + CH;
}

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }

/* ═══════════════ Deshacer ═══════════════ */

/* Se guarda un snapshot completo antes de cada movimiento. Un mazo son 52
 * objetos diminutos, así que copiarlo es barato y evita tener que escribir (y
 * depurar) el inverso de cada tipo de jugada — que es donde suelen esconderse
 * los bugs de un solitario. Tope de 200, como el sokoban. */
function snapshot() {
    gs.undo.push({
        stock: gs.stock.map(clone),
        waste: gs.waste.map(clone),
        found: gs.found.map(function (p) { return p.map(clone); }),
        tab: gs.tab.map(function (p) { return p.map(clone); }),
        moves: gs.moves
    });
    if (gs.undo.length > 200) gs.undo.shift();
}
function clone(c) { return { s: c.s, r: c.r, up: c.up }; }

function undo() {
    if (!gs.undo.length || gs.status !== 'playing') return;
    var s = gs.undo.pop();
    gs.stock = s.stock; gs.waste = s.waste;
    gs.found = s.found; gs.tab = s.tab;
    gs.moves = s.moves;
    gs.drag = null;
    GameAudio.slide();
    syncHud();
}

/* ═══════════════ Movimientos ═══════════════ */

function drawFromStock() {
    if (gs.status !== 'playing') return;
    snapshot();
    if (!gs.stock.length) {
        if (!gs.waste.length) { gs.undo.pop(); return; }
        /* Reciclar: el waste vuelve al mazo en orden inverso y boca abajo. */
        while (gs.waste.length) {
            var c = gs.waste.pop();
            c.up = false;
            gs.stock.push(c);
        }
        gs.moves++;
        GameAudio.flip();
        syncHud();
        return;
    }
    var n = gs.draw3 ? 3 : 1;
    for (var i = 0; i < n && gs.stock.length; i++) {
        var card = gs.stock.pop();
        card.up = true;
        gs.waste.push(card);
    }
    gs.moves++;
    GameAudio.flip();
    syncHud();
}

/* Mueve `cards` al destino y da la vuelta a la carta que quede descubierta. */
function commitMove(from, cards, destKind, destIdx) {
    if (destKind === 'tab') gs.tab[destIdx] = gs.tab[destIdx].concat(cards);
    else gs.found[destIdx] = gs.found[destIdx].concat(cards);

    if (from.kind === 'waste') gs.waste.length = gs.waste.length - cards.length;
    else if (from.kind === 'found') gs.found[from.idx].length -= cards.length;
    else {
        var col = gs.tab[from.idx];
        col.length = from.at;
        /* Destapar la nueva última: es el progreso real de la partida. */
        if (col.length && !col[col.length - 1].up) {
            col[col.length - 1].up = true;
            GameAudio.flip();
        }
    }
    gs.moves++;
    syncHud();
    if (destKind === 'found') GameAudio.score(); else GameAudio.place();
    checkWin();
}

function checkWin() {
    for (var i = 0; i < 4; i++) if (gs.found[i].length !== 13) return;
    gs.status = 'won';
    gs.elapsed = performance.now() - gs.startMs;
    var record = best.submit(gs.elapsed);
    syncHud();
    GameAudio.win();
    winPopup.show({
        winTitle: record ? '¡Nuevo récord!' : '¡Solitario resuelto!',
        winTime:  GU.formatTime(gs.elapsed, { ms: true }) + ' en ' + gs.moves + ' movimientos',
        winBest:  'Mejor tiempo: ' + (best.has() ? GU.formatTime(best.value) : '—')
    });
}

/* Doble clic / botón: manda una carta a su fundación si cabe. */
function sendToFoundation(kind, idx) {
    var card = topOf(kind, idx);
    if (!card || !card.up) return false;
    for (var f = 0; f < 4; f++) {
        if (!canFound(card, gs.found[f])) continue;
        snapshot();
        var from = { kind: kind, idx: idx, at: kind === 'tab' ? gs.tab[idx].length - 1 : 0 };
        commitMove(from, [card], 'found', f);
        return true;
    }
    return false;
}

function topOf(kind, idx) {
    if (kind === 'waste') return gs.waste[gs.waste.length - 1] || null;
    if (kind === 'tab') return gs.tab[idx][gs.tab[idx].length - 1] || null;
    return gs.found[idx][gs.found[idx].length - 1] || null;
}

/* Auto-completar: cuando ya no queda nada tapado, colocar las 52 a mano es
 * puro trámite. Se lanza una carta por tick para que se vea. */
function canAutoComplete() {
    if (gs.status !== 'playing') return false;
    if (gs.stock.length || gs.waste.length) return false;
    for (var c = 0; c < 7; c++) {
        for (var i = 0; i < gs.tab[c].length; i++) if (!gs.tab[c][i].up) return false;
    }
    return true;
}

function autoStep() {
    for (var c = 0; c < 7; c++) {
        if (!gs.tab[c].length) continue;
        if (sendToFoundation('tab', c)) return true;
    }
    return false;
}

/* ═══════════════ Entrada ═══════════════ */

function pick(x, y) {
    if (gs.status !== 'playing') return;

    if (inRect(x, y, stockRect())) { drawFromStock(); return; }

    if (inRect(x, y, wasteRect()) && gs.waste.length) {
        var card = gs.waste[gs.waste.length - 1];
        gs.drag = { kind: 'waste', idx: 0, at: gs.waste.length - 1, cards: [card],
                    dx: x - wasteRect().x, dy: y - wasteRect().y, x: x, y: y };
        return;
    }

    for (var f = 0; f < 4; f++) {
        var fr = foundRect(f);
        if (!inRect(x, y, fr) || !gs.found[f].length) continue;
        var fc = gs.found[f][gs.found[f].length - 1];
        gs.drag = { kind: 'found', idx: f, at: gs.found[f].length - 1, cards: [fc],
                    dx: x - fr.x, dy: y - fr.y, x: x, y: y };
        return;
    }

    /* Tablero: se agarra desde la carta pulsada hasta el final de la columna,
     * pero sólo si TODAS están boca arriba. Se recorre de arriba abajo porque
     * las cartas se solapan y gana la de encima. */
    for (var col = 0; col < 7; col++) {
        var pile = gs.tab[col];
        var cx = tabX(col);
        if (x < cx || x >= cx + CW) continue;
        for (var i = pile.length - 1; i >= 0; i--) {
            var cy = tabCardY(col, i);
            var last = (i === pile.length - 1);
            var h = last ? CH : (pile[i].up ? FAN_DOWN : FAN_HIDE);
            if (y < cy || y >= cy + h) continue;
            if (!pile[i].up) return;                       // tapada: no se coge
            gs.drag = { kind: 'tab', idx: col, at: i, cards: pile.slice(i),
                        dx: x - cx, dy: y - cy, x: x, y: y };
            return;
        }
    }
}

function drop(x, y) {
    var d = gs.drag;
    gs.drag = null;
    if (!d) return;

    var moved = tryDrop(d, x, y);
    if (!moved) {
        /* Un arrastre que no llegó a moverse es un clic: mandar a la fundación
         * es lo que espera todo el mundo y ahorra la mitad de los gestos. */
        if (Math.abs(x - d.x) < 6 && Math.abs(y - d.y) < 6 && d.cards.length === 1) {
            sendToFoundation(d.kind, d.idx);
        } else {
            GameAudio.miss();
        }
    }
}

function tryDrop(d, x, y) {
    var card = d.cards[0];
    var from = { kind: d.kind, idx: d.idx, at: d.at };

    if (d.cards.length === 1) {
        for (var f = 0; f < 4; f++) {
            if (!inRect(x, y, foundRect(f)) || !canFound(card, gs.found[f])) continue;
            if (d.kind === 'found' && d.idx === f) return false;
            snapshot();
            commitMove(from, d.cards, 'found', f);
            return true;
        }
    }
    for (var col = 0; col < 7; col++) {
        var cx = tabX(col);
        if (x < cx - GAP / 2 || x >= cx + CW + GAP / 2) continue;
        if (y < TAB_Y - 20 || y > TAB_Y + Math.max(tabHeight(col), CH) + 40) continue;
        if (d.kind === 'tab' && d.idx === col) return false;
        var onto = gs.tab[col][gs.tab[col].length - 1] || null;
        if (!canStack(card, onto)) continue;
        snapshot();
        commitMove(from, d.cards, 'tab', col);
        return true;
    }
    return false;
}

/* ═══════════════ Dibujo ═══════════════ */

var grads = GU.gradientMemo();

function draw() {
    ctx.fillStyle = grads('felt', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1c6b3a');
        g.addColorStop(1, '#124a28');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    if (gs.status === 'idle') return drawIdle();

    drawSlot(stockRect(), gs.stock.length ? null : '↻');
    drawSlot(wasteRect(), null);
    for (var f = 0; f < 4; f++) drawSlot(foundRect(f), SUITS[f]);
    for (var c = 0; c < 7; c++) drawSlot({ x: tabX(c), y: TAB_Y, w: CW, h: CH }, null);

    if (gs.stock.length) {
        var sr = stockRect();
        faces.get('back').draw(ctx, sr.x, sr.y);
    }
    drawWaste();
    for (var f2 = 0; f2 < 4; f2++) {
        var pile = gs.found[f2];
        if (!pile.length) continue;
        var fr = foundRect(f2);
        faceOf(pile[pile.length - 1]).draw(ctx, fr.x, fr.y);
    }
    drawTableau();
    drawDrag();
}

function drawSlot(r, glyph) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    if (!glyph) return;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    if (glyph === '↻') {
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↻', r.x + r.w / 2, r.y + r.h / 2);
        return;
    }
    suitPath(ctx, glyph, r.x + r.w / 2, r.y + r.h / 2, 22);
    ctx.fill();
}

/* Con robo de 3 se ven las tres últimas escalonadas, pero sólo la de encima se
 * puede coger — es la regla, y mostrarlas explica por qué. */
function drawWaste() {
    if (!gs.waste.length) return;
    var wr = wasteRect();
    var show = gs.draw3 ? Math.min(3, gs.waste.length) : 1;
    var dragTop = gs.drag && gs.drag.kind === 'waste';
    for (var k = 0; k < show; k++) {
        var idx = gs.waste.length - show + k;
        if (dragTop && idx === gs.waste.length - 1) continue;
        faceOf(gs.waste[idx]).draw(ctx, wr.x + k * 18, wr.y);
    }
}

function drawTableau() {
    for (var col = 0; col < 7; col++) {
        var pile = gs.tab[col];
        var skipFrom = (gs.drag && gs.drag.kind === 'tab' && gs.drag.idx === col)
            ? gs.drag.at : pile.length;
        for (var i = 0; i < pile.length && i < skipFrom; i++) {
            faceOf(pile[i]).draw(ctx, tabX(col), tabCardY(col, i));
        }
    }
}

function drawDrag() {
    var d = gs.drag;
    if (!d) return;
    for (var i = 0; i < d.cards.length; i++) {
        var x = d.x - d.dx, y = d.y - d.dy + i * FAN_DOWN;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 5, CW, CH, 8);
        ctx.fill();
        faceOf(d.cards[i]).draw(ctx, x, y);
    }
}

function drawIdle() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8f2e8';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('SOLITARIO', W / 2, H / 2 - 24);
    ctx.font = '16px sans-serif';
    ctx.fillText('Klondike clásico. Pulsa Nueva partida.', W / 2, H / 2 + 14);
}

/* ═══════════════ Bucle ═══════════════ */

/* Dibujo bajo demanda — ver GU.rafDraw. Aqui hay que declarar los eventos de
 * arrastre: por defecto rafDraw no escucha el movimiento del puntero, y sin
 * ellos la carta cogida no seguiria al raton. El auto-completado se mantiene
 * vivo devolviendo true mientras le queden cartas que colocar. */
var view = rafDraw(function (dt) {
    var auto = gs.status === 'playing' && canAutoComplete();
    if (auto) {
        gs.autoT += dt;
        if (gs.autoT > 0.09) { gs.autoT = 0; autoStep(); }
    }
    draw();
    return auto;
}, { events: ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup',
              'mousemove', 'click', 'touchstart', 'touchend', 'touchmove',
              'keydown', 'keyup'] });

/* El cronometro solo se pinta en el HUD, no en el canvas, asi que no necesita
 * un frame para avanzar. */
setInterval(function () {
    if (gs.status !== 'playing') return;
    gs.elapsed = performance.now() - gs.startMs;
    hud.set({ time: gs.elapsed });
}, 250);

/* ═══════════════ Eventos ═══════════════ */

canvas.addEventListener('mousedown', function (e) {
    var p = GU.pointerPos(canvas, e);
    pick(p.x, p.y);
});
canvas.addEventListener('mousemove', function (e) {
    if (!gs.drag) return;
    var p = GU.pointerPos(canvas, e);
    gs.drag.x = p.x; gs.drag.y = p.y;
});
window.addEventListener('mouseup', function (e) {
    if (!gs.drag) return;
    var p = GU.pointerPos(canvas, e);
    drop(p.x, p.y);
});
canvas.addEventListener('dblclick', function (e) {
    var p = GU.pointerPos(canvas, e);
    if (inRect(p.x, p.y, wasteRect())) return void sendToFoundation('waste', 0);
    for (var col = 0; col < 7; col++) {
        var cx = tabX(col);
        if (p.x >= cx && p.x < cx + CW) { sendToFoundation('tab', col); return; }
    }
});

/* Táctil: arrastre continuo, así que hace falta la posición en cada momento y
 * no sirve un reconocedor de swipe. */
canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var p = GU.pointerPos(canvas, e);
    pick(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gs.drag) return;
    var p = GU.pointerPos(canvas, e);
    gs.drag.x = p.x; gs.drag.y = p.y;
}, { passive: false });
canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (!gs.drag) return;
    var p = GU.pointerPos(canvas, e);
    drop(p.x, p.y);
}, { passive: false });

var gameControls = GU.controls({ start: newGame });
document.getElementById('undoBtn').addEventListener('click', function () { GameAudio.click(); undo(); });
document.getElementById('drawSel').addEventListener('change', function () {
    gs.draw3 = this.value === '3';
});

syncHud();

}());

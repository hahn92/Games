/* Mahjong Solitario — emparejar fichas iguales hasta vaciar la figura.
 *
 * Toda la dificultad está en qué ficha está LIBRE. Una ficha lo está si no
 * tiene nada encima y además tiene libre el lado izquierdo o el derecho. Esa
 * segunda condición es la que hace que el montón se abra por los bordes y no
 * por el centro, y es la que suele implementarse mal.
 *
 * Y algo más importante: el reparto NO es aleatorio. Se coloca quitando parejas
 * de posiciones ya libres, hacia atrás, así que la figura siempre se puede
 * deshacer al menos por el camino inverso. Sembrar fichas al azar sobre una
 * figura produce tableros sin solución muy a menudo, y el jugador no tiene forma
 * de saber si se ha equivocado o si le tocó uno imposible. */
(function () {
'use strict';

var canvas = document.getElementById('mjCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 460
var H = canvas.height;   // 520

var TW = 34, TH = 44;      // tamaño de ficha
var DX = 5, DY = 5;        // desplazamiento por capa, para que se vea el relieve

/* La figura, en MEDIAS FICHAS.
 *
 * Que la unidad sea la media ficha es lo que permite desplazar una capa medio
 * hueco, como el tablero clásico. Pero por eso mismo dos fichas CONTIGUAS van a
 * distancia 2, no 1: `row()` avanza de dos en dos y las filas también. Ponerlo
 * a 1 hace que cada ficha tape media vecina y la figura entera se apelotona —
 * y `isFree` deja de tener sentido, porque su idea de "pegada al lado" es
 * exactamente una distancia de 2. */
var LAYOUT = buildLayout();

function buildLayout() {
    var slots = [];
    function row(layer, y, x0, count) {
        for (var i = 0; i < count; i++) slots.push({ l: layer, x: x0 + i * 2, y: y });
    }
    /* Capa 0: pirámide ancha */
    row(0, 0, 2, 10);
    row(0, 2, 0, 12);
    row(0, 4, 0, 12);
    row(0, 6, 2, 10);
    /* Capa 1, encima y centrada */
    row(1, 2, 6, 6);
    row(1, 4, 6, 6);
    /* Capa 2, la cumbre */
    row(2, 3, 10, 2);
    return slots;
}

/* Palos dibujados con formas: círculos, bambúes y barras. Nada de emoji. */
var SUITS = ['circ', 'bam', 'bar'];
var KINDS = [];
(function buildKinds() {
    for (var s = 0; s < SUITS.length; s++) {
        for (var n = 1; n <= 9; n++) KINDS.push({ suit: SUITS[s], n: n });
    }
}());

var tiles = [];          // [{slot, kind, gone}]
var selected = -1;
var history = [];        // para deshacer
var status = 'idle';     // idle | playing | won | over
var startMs = 0, elapsed = 0;
var hintPair = null, hintT = 0;

var fx = new Particles(200);
var gMemo = GU.gradientMemo();
/* Menos tiempo es mejor: el récord se invierte. */
var best = GU.highScore('mahjongBest', { lower: true });

var hud = GU.hud({
    left: 'leftLabel',
    pairs: 'pairsLabel',
    time: { el: 'timeLabel', format: function (v) { return GU.formatTime(v); } },
    best: { el: 'highScore', format: function (v) { return v == null ? '—' : GU.formatTime(v); } },
    mobile: { el: 'mobileScore', format: function () {
        return remaining() + ' fichas  ·  ' + GU.formatTime(elapsed) +
               '  ·  ' + freePairs().length + ' jugadas';
    } }
});

function remaining() {
    var n = 0;
    for (var i = 0; i < tiles.length; i++) if (!tiles[i].gone) n++;
    return n;
}

/* ── Libertad de una ficha ────────────────────────────────────────── */

/* Ocupa [x, x+2) en medias fichas y una altura de 2. Dos fichas se solapan si
 * se pisan en las dos dimensiones. */
function overlaps(a, b) {
    return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

function isFree(t, list) {
    if (t.gone) return false;
    var i, o;
    /* Nada encima: alguna ficha de una capa superior que se solape. */
    for (i = 0; i < list.length; i++) {
        o = list[i];
        if (o.gone || o === t) continue;
        if (o.slot.l > t.slot.l && overlaps(o.slot, t.slot)) return false;
    }
    /* Y un lado libre: se mira si hay vecina pegada a izquierda y a derecha en
     * la MISMA capa. Con las dos ocupadas, la ficha está encajonada. */
    var left = false, right = false;
    for (i = 0; i < list.length; i++) {
        o = list[i];
        if (o.gone || o === t || o.slot.l !== t.slot.l) continue;
        if (Math.abs(o.slot.y - t.slot.y) >= 2) continue;
        if (Math.abs(o.slot.x - (t.slot.x - 2)) < 0.01) left = true;
        if (Math.abs(o.slot.x - (t.slot.x + 2)) < 0.01) right = true;
    }
    return !(left && right);
}

function sameKind(a, b) { return a.kind.suit === b.kind.suit && a.kind.n === b.kind.n; }

function freePairs() {
    var free = [];
    for (var i = 0; i < tiles.length; i++) if (isFree(tiles[i], tiles)) free.push(tiles[i]);
    var out = [];
    for (var a = 0; a < free.length; a++) {
        for (var b = a + 1; b < free.length; b++) {
            if (sameKind(free[a], free[b])) out.push([free[a], free[b]]);
        }
    }
    return out;
}

/* ── Reparto resoluble ────────────────────────────────────────────── */

/* Se reparte SIMULANDO una partida ganada, hacia atrás.
 *
 * Se llena la figura entera con fichas todavía sin dibujo y se van retirando de
 * dos en dos, eligiendo cada vez dos que estén libres A LA VEZ; a esa pareja se
 * le asigna un dibujo. Como cada pareja se retiró de un estado real del tablero,
 * hacer esos mismos movimientos en orden inverso es una partida válida: el
 * reparto siempre tiene al menos una solución.
 *
 * La condición "libres a la vez" es la que hay que respetar y la que se cuela
 * fácil. No basta con ir quitando de arriba abajo: si una ficha sólo queda libre
 * DESPUÉS de retirar a su vecina, las dos nunca estuvieron disponibles al mismo
 * tiempo y esa pareja no habría podido seleccionarse nunca.
 *
 * Puede quedar atascado —dos fichas apiladas al final dejan sólo una libre— así
 * que se reintenta. En la práctica sale a la primera o a la segunda; el tope
 * evita que una mala racha cuelgue la pestaña. */
function deal() {
    var slots = LAYOUT.slice();
    if (slots.length % 2) slots.pop();          // la figura debe ser par
    var pairs = slots.length / 2;

    for (var attempt = 0; attempt < 60; attempt++) {
        tiles = slots.map(function (s) { return { slot: s, kind: null, gone: false }; });

        var pool = [];
        for (var i = 0; i < pairs; i++) pool.push(KINDS[i % KINDS.length]);
        GU.shuffle(pool);

        var placed = 0;
        while (placed < pairs) {
            var free = [];
            for (var j = 0; j < tiles.length; j++) {
                if (isFree(tiles[j], tiles)) free.push(tiles[j]);
            }
            if (free.length < 2) break;
            GU.shuffle(free);
            free[0].kind = free[1].kind = pool[placed];
            free[0].gone = true;
            free[1].gone = true;
            placed++;
        }

        if (placed === pairs) {
            /* Se devuelven todas al tablero; los dibujos ya están puestos. */
            for (var k = 0; k < tiles.length; k++) tiles[k].gone = false;
            return;
        }
    }

    /* Salvavidas: si en 60 intentos no salió (no debería), se deja lo que haya
     * emparejado y se rellena el resto, que sigue siendo jugable aunque no
     * garantizado. Mejor eso que devolver fichas sin dibujo. */
    for (var m = 0; m < tiles.length; m++) {
        tiles[m].gone = false;
        if (!tiles[m].kind) tiles[m].kind = KINDS[m % KINDS.length];
    }
}

function newGame() {
    deal();
    selected = -1;
    history = [];
    hintPair = null;
    fx.clear();
    status = 'playing';
    startMs = performance.now();
    elapsed = 0;
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

/* ── Jugada ───────────────────────────────────────────────────────── */

function tileAt(x, y) {
    /* De la capa más alta a la más baja: si dos se solapan en pantalla, se
     * elige la que se ve, no la de debajo. */
    var found = null;
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        if (t.gone) continue;
        var p = tilePos(t);
        if (x < p.x || x > p.x + TW || y < p.y || y > p.y + TH) continue;
        if (!found || t.slot.l > found.slot.l) found = t;
    }
    return found;
}

function pick(t) {
    if (status !== 'playing' || !t) return;
    if (!isFree(t, tiles)) { GameAudio.miss(); return; }

    var idx = tiles.indexOf(t);
    if (selected === idx) { selected = -1; GameAudio.click(); return; }
    if (selected < 0) { selected = idx; GameAudio.flip(); return; }

    var a = tiles[selected];
    if (sameKind(a, t)) {
        a.gone = true; t.gone = true;
        history.push([tiles.indexOf(a), idx]);
        selected = -1;
        hintPair = null;
        var pa = tilePos(a), pb = tilePos(t);
        fx.burst(pa.x + TW / 2, pa.y + TH / 2, 10, { color: '#ffd54a', speed: 90, life: 0.5, size: 2.4 });
        fx.burst(pb.x + TW / 2, pb.y + TH / 2, 10, { color: '#ffd54a', speed: 90, life: 0.5, size: 2.4 });
        GameAudio.match();
        syncHud();
        checkEnd();
    } else {
        selected = idx;      // cambiar de selección, no penalizar
        GameAudio.noMatch();
    }
}

function undo() {
    if (status !== 'playing' || !history.length) return;
    var pair = history.pop();
    tiles[pair[0]].gone = false;
    tiles[pair[1]].gone = false;
    selected = -1;
    GameAudio.click();
    syncHud();
}

function hint() {
    if (status !== 'playing') return;
    var pairs = freePairs();
    if (!pairs.length) { GameAudio.miss(); return; }
    hintPair = pairs[0];
    hintT = 1.6;
    GameAudio.reveal();
}

function checkEnd() {
    if (remaining() === 0) {
        status = 'won';
        var secs = elapsed;
        var record = best.submit(secs);
        syncHud();
        gameControls.idle();
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Figura despejada!',
            overScore: 'Tiempo: ' + GU.formatTime(secs),
            overPairs: 'Sin fichas atascadas'
        });
        GameAudio.win();
        return;
    }
    if (!freePairs().length) {
        status = 'over';
        syncHud();
        gameControls.idle();
        over.show({
            overTitle: 'Sin jugadas',
            overScore: 'Quedan ' + remaining() + ' fichas bloqueadas',
            overPairs: 'Usa Deshacer para volver atrás'
        });
        GameAudio.gameOver();
    }
}

function syncHud() {
    hud.set({
        left: remaining(),
        pairs: freePairs().length,
        time: elapsed,
        best: best.has() ? best.value : null
    });
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

/* La figura ocupa 24 medias fichas de ancho (12 columnas) y 8 de alto (4 filas),
 * y se centra en el canvas a partir de eso. Con la anchura escrita a mano se
 * descentra en cuanto cambia una fila. */
var SPAN_X = 24, SPAN_Y = 8;

function tilePos(t) {
    var baseX = (W - SPAN_X * TW / 2) / 2;
    var baseY = (H - SPAN_Y * TH / 2) / 2;
    return {
        x: baseX + t.slot.x * TW / 2 + t.slot.l * DX,
        y: baseY + t.slot.y * TH / 2 - t.slot.l * DY
    };
}

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    if (hintT > 0) hintT -= dt;
    fx.update(dt);
    draw();
    return fx.count > 0 || hintT > 0;
});

/* El reloj vive en el HUD, no en el canvas. Sacarlo del bucle de dibujo tiene
 * aqui una segunda ventaja: la linea de movil se recalcula en cada set() y la
 * suya llama a freePairs(), que recorre el tablero entero buscando parejas
 * libres. Eso pasa de 60 veces por segundo a 4. */
setInterval(function () {
    if (status !== 'playing') return;
    elapsed = performance.now() - startMs;
    syncHud();
}, 250);

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#15402b');
        g.addColorStop(1, '#0a2418');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    /* De abajo arriba, para que las capas altas tapen a las bajas. */
    var order = tiles.slice().sort(function (a, b) {
        return (a.slot.l - b.slot.l) || (a.slot.y - b.slot.y) || (a.slot.x - b.slot.x);
    });
    for (var i = 0; i < order.length; i++) {
        if (!order[i].gone) drawTile(order[i]);
    }
    fx.draw(ctx);

    var cur = cursor.target();
    if (cur) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, cur.x - 3, cur.y - 3, cur.w + 6, cur.h + 6, 6);
        ctx.stroke();
    }

    if (status === 'idle') drawIdle();
}

function drawTile(t) {
    var p = tilePos(t);
    var free = isFree(t, tiles);
    var isSel = tiles[selected] === t;
    var isHint = hintPair && hintT > 0 && (hintPair[0] === t || hintPair[1] === t);

    /* Canto: da el relieve sin sombras, que serían carísimas por ficha. */
    ctx.fillStyle = '#9c9384';
    GU.roundRectPath(ctx, p.x + 3, p.y + 3, TW, TH, 5);
    ctx.fill();

    ctx.fillStyle = free ? '#f6f2e7' : '#cdc7b8';
    GU.roundRectPath(ctx, p.x, p.y, TW, TH, 5);
    ctx.fill();

    ctx.strokeStyle = isSel ? '#00e5ff' : isHint ? '#ffd54a' : '#a49b8b';
    ctx.lineWidth = (isSel || isHint) ? 2.5 : 1;
    ctx.stroke();

    drawFace(p.x, p.y, t.kind);
}

/* Cara de la ficha: el palo decide la forma y el número cuántas se dibujan. */
function drawFace(x, y, kind) {
    var cx = x + TW / 2, cy = y + TH / 2;
    if (kind.suit === 'circ') {
        ctx.fillStyle = '#1f6fb2';
        drawCluster(cx, cy, kind.n, function (px, py, r) {
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        });
    } else if (kind.suit === 'bam') {
        ctx.fillStyle = '#2f8f3f';
        drawCluster(cx, cy, kind.n, function (px, py, r) {
            ctx.fillRect(px - r * 0.45, py - r * 1.3, r * 0.9, r * 2.6);
        });
    } else {
        ctx.fillStyle = '#b03a2e';
        drawCluster(cx, cy, kind.n, function (px, py, r) {
            ctx.fillRect(px - r * 1.2, py - r * 0.35, r * 2.4, r * 0.7);
        });
    }
    /* El número, en pequeño abajo: sin él, distinguir un 7 de un 8 de un
     * vistazo es imposible en este tamaño. */
    ctx.fillStyle = '#4a4438';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(kind.n), cx, y + TH - 4);
    ctx.textAlign = 'left';
}

/* Coloca n marcas en rejilla centrada. */
function drawCluster(cx, cy, n, paint) {
    var cols = n <= 3 ? 1 : (n <= 6 ? 2 : 3);
    var rows = Math.ceil(n / cols);
    var r = n <= 3 ? 4.4 : n <= 6 ? 3.6 : 3;
    var gapX = 9, gapY = 8;
    var k = 0;
    for (var row = 0; row < rows; row++) {
        var inRow = Math.min(cols, n - row * cols);
        for (var col = 0; col < inRow; col++) {
            var px = cx + (col - (inRow - 1) / 2) * gapX;
            var py = cy - 3 + (row - (rows - 1) / 2) * gapY;
            paint(px, py, r);
            k++;
        }
    }
}

function drawIdle() {
    ctx.fillStyle = 'rgba(10,36,24,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f6f2e7';
    ctx.font = 'bold 25px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MAHJONG SOLITARIO', W / 2, H / 2 - 14);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Empareja las fichas libres', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Entrada ──────────────────────────────────────────────────────── */

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    pick(tileAt(p.x, p.y));
});
GU.swipe(canvas, {
    preventDefault: true,
    onTap: function (p) { pick(tileAt(p.x, p.y)); }
});

/* Sólo se ofrecen al teclado las fichas LIBRES: navegar por las bloqueadas no
 * lleva a ninguna parte y multiplicaría por cuatro los pasos. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Fichas libres. Flechas para moverte, Enter para elegir y emparejar.',
    targets: function () {
        var out = [];
        for (var i = 0; i < tiles.length; i++) {
            if (!isFree(tiles[i], tiles)) continue;
            var p = tilePos(tiles[i]);
            out.push({ x: p.x, y: p.y, w: TW, h: TH, id: 't' + i, i: i });
        }
        return out;
    },
    activate: function (t) { pick(tiles[t.i]); }
});

GU.keys({ undo: ['Backspace', 'z'], hint: ['h'] }, {
    onPress: function (a) { if (a === 'undo') undo(); else hint(); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('hintBtn').addEventListener('click', function () { GameAudio.click(); hint(); });
document.getElementById('undoBtn').addEventListener('click', function () { undo(); });

deal();
status = 'idle';
syncHud();
draw();

}());

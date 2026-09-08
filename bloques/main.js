/* Bloques — encaja piezas en una rejilla de 9×9 y limpia filas, columnas y
 * cuadros de 3×3.
 *
 * No hay gravedad ni reloj: las piezas no caen ni se giran. Todo el juego es
 * decidir dónde va cada una, y por eso las tres cosas que lo sostienen son:
 *
 * - **Se dan tres piezas y no llega la siguiente hasta colocar las tres.** Con
 *   reposición inmediata se juega pieza a pieza y no hay que planificar nada;
 *   con la tanda de tres, colocar la primera condiciona a las otras dos.
 * - **La partida termina cuando ninguna de las piezas que te quedan cabe en
 *   ningún sitio.** Se comprueba de verdad, probando cada pieza en las 81
 *   posiciones: dar por perdida una partida que aún tenía hueco es la forma más
 *   rápida de que el juego parezca roto.
 * - **Limpiar varias cosas a la vez multiplica**, y encadenar limpiezas en
 *   turnos seguidos también. Sin eso, colocar donde quepa es siempre igual de
 *   bueno y no hay juego.
 *
 * El vaciado se calcula ENTERO antes de aplicarlo: si se fuera limpiando fila a
 * fila, la segunda comprobación vería la rejilla ya modificada y una columna que
 * estaba completa dejaría de estarlo por culpa de la fila que se acaba de
 * limpiar. Es el fallo clásico aquí.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var N = 9;
var TOP = 46;
var TRAY_H = 116;

/* Piezas como listas de celdas. Sin rotación: la que sale es la que hay, que es
 * lo que obliga a mirar el tablero antes de colocar. */
var SHAPES = [
    [[0,0]],
    [[0,0],[0,1]],
    [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
    [[0,0],[1,0],[1,1]],
    [[0,0],[0,1],[1,0]],
    [[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,1]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,0],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[0,2],[1,0],[1,1]]
];
var COLORS = ['#4fc3f7', '#66bb6a', '#ffd54a', '#ff8a3d', '#ab63e0', '#e94f4f', '#26c6da'];

var grid = [];
var tray = [];              // 3 piezas o null
var sel = -1;
var score = 0, combo = 0;
var status = 'idle';
var ghost = null;           // {piece, r, c, ok}

var fx = new Particles(260);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    score: 'scoreLabel',
    combo: 'comboLabel',
    best:  { el: 'highScore' },
    mobile: { el: 'mobileScore', format: function (v) {
        return v.score + ' puntos' + (v.combo > 1 ? '  ·  racha ×' + v.combo : '');
    } }
});

var best = GU.highScore('bloquesBest');
var over = GU.popup('overPopup');

function idx(r, c) { return r * N + c; }

/* ── Piezas ───────────────────────────────────────────────────────── */

function makePiece() {
    var cells = GU.pick(SHAPES);
    var maxR = 0, maxC = 0;
    for (var i = 0; i < cells.length; i++) {
        if (cells[i][0] > maxR) maxR = cells[i][0];
        if (cells[i][1] > maxC) maxC = cells[i][1];
    }
    return { cells: cells, h: maxR + 1, w: maxC + 1, color: GU.pick(COLORS) };
}

function refillTray() {
    tray = [makePiece(), makePiece(), makePiece()];
}

function fits(piece, r, c) {
    for (var i = 0; i < piece.cells.length; i++) {
        var rr = r + piece.cells[i][0], cc = c + piece.cells[i][1];
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) return false;
        if (grid[idx(rr, cc)]) return false;
    }
    return true;
}

function fitsAnywhere(piece) {
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) if (fits(piece, r, c)) return true;
    }
    return false;
}

function anyMoveLeft() {
    for (var i = 0; i < tray.length; i++) {
        if (tray[i] && fitsAnywhere(tray[i])) return true;
    }
    return false;
}

/* ── Colocar y limpiar ────────────────────────────────────────────── */

function drop(pieceIdx, r, c) {
    var piece = tray[pieceIdx];
    if (!piece || !fits(piece, r, c)) {
        GameAudio.hit();
        msg.show('Ahí no cabe', 0.9);
        view.invalidate();
        return false;
    }
    for (var i = 0; i < piece.cells.length; i++) {
        grid[idx(r + piece.cells[i][0], c + piece.cells[i][1])] = piece.color;
    }
    tray[pieceIdx] = null;
    sel = -1;
    score += piece.cells.length;
    GameAudio.place();

    clearLines();

    if (!tray[0] && !tray[1] && !tray[2]) refillTray();

    if (!anyMoveLeft()) gameOver();
    else syncHud();
    return true;
}

function clearLines() {
    var rows = [], colsFull = [], boxes = [];
    var r, c, i, k, full;

    for (r = 0; r < N; r++) {
        full = true;
        for (c = 0; c < N; c++) if (!grid[idx(r, c)]) { full = false; break; }
        if (full) rows.push(r);
    }
    for (c = 0; c < N; c++) {
        full = true;
        for (r = 0; r < N; r++) if (!grid[idx(r, c)]) { full = false; break; }
        if (full) colsFull.push(c);
    }
    for (var b = 0; b < 9; b++) {
        var br = ((b / 3) | 0) * 3, bc = (b % 3) * 3;
        full = true;
        for (r = br; r < br + 3 && full; r++) {
            for (c = bc; c < bc + 3; c++) if (!grid[idx(r, c)]) { full = false; break; }
        }
        if (full) boxes.push(b);
    }

    var total = rows.length + colsFull.length + boxes.length;
    if (!total) { combo = 0; return; }

    /* Todo lo que se limpia se marca primero y se borra después: limpiando sobre
     * la marcha, una columna completa dejaría de estarlo por culpa de la fila
     * que se acaba de vaciar. */
    var mark = {};
    for (i = 0; i < rows.length; i++) for (c = 0; c < N; c++) mark[idx(rows[i], c)] = true;
    for (i = 0; i < colsFull.length; i++) for (r = 0; r < N; r++) mark[idx(r, colsFull[i])] = true;
    for (i = 0; i < boxes.length; i++) {
        var r0 = ((boxes[i] / 3) | 0) * 3, c0 = (boxes[i] % 3) * 3;
        for (r = r0; r < r0 + 3; r++) for (c = c0; c < c0 + 3; c++) mark[idx(r, c)] = true;
    }

    for (k in mark) {
        var kk = +k;
        var pr = (kk / N) | 0, pc = kk % N;
        fx.burst(cellX(pc) + cellSize() / 2, cellY(pr) + cellSize() / 2, 4,
                 { color: grid[kk] || '#fff', speed: 90, life: 0.6, size: 3, gravity: 120 });
        grid[kk] = 0;
    }

    combo++;
    /* Limpiar varias cosas a la vez multiplica, y encadenar turnos también. */
    var gained = total * 18 * total * Math.min(combo, 5);
    score += gained;
    msg.show(total > 1 ? '¡' + total + ' a la vez! +' + gained : '+' + gained, 1.1);
    GameAudio[total > 1 ? 'scoreHigh' : 'lineClear']();
}

function gameOver() {
    status = 'over';
    var record = best.submit(score);
    gameControls.idle();
    GameAudio.gameOver();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : 'No cabe ninguna',
            overScore: score + ' puntos',
            overRecord: best.has() ? 'Tu mejor marca: ' + best.value : ''
        });
    }, 550);
}

function newGame() {
    grid = new Array(N * N).fill(0);
    refillTray();
    sel = -1;
    score = 0;
    combo = 0;
    ghost = null;
    status = 'playing';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function syncHud() {
    hud.set({ score: score, combo: combo, best: best.display(0) });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function boardSize() { return Math.min(W - 20, H - TOP - TRAY_H - 10); }
function cellSize() { return boardSize() / N; }
function bx() { return (W - boardSize()) / 2; }
function cellX(c) { return bx() + c * cellSize(); }
function cellY(r) { return TOP + r * cellSize(); }

function trayRect(i) {
    var slot = W / 3;
    return { x: i * slot + 10, y: H - TRAY_H + 12, w: slot - 20, h: TRAY_H - 26 };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function drawCell(x, y, s, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    GU.roundRectPath(ctx, x + 1, y + 1, s - 2, s - 2, Math.max(2, s * 0.16));
    ctx.fill();
    /* Un brillo arriba a la izquierda da volumen sin costar un gradiente por
     * celda: son hasta 81 por frame. */
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + 3, y + 3, s - 6, Math.max(1, s * 0.16));
    ctx.globalAlpha = 1;
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#151f36');
        g.addColorStop(1, '#070c16');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var s = cellSize();

    // fondo de la rejilla con los cuadros 3×3 alternados
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            var box = (((r / 3) | 0) + ((c / 3) | 0)) % 2;
            ctx.fillStyle = box ? 'rgba(143,211,244,0.07)' : 'rgba(143,211,244,0.03)';
            ctx.fillRect(cellX(c), cellY(r), s, s);
        }
    }

    // fantasma de la pieza elegida
    if (ghost && ghost.piece) {
        for (var g2 = 0; g2 < ghost.piece.cells.length; g2++) {
            var gr = ghost.r + ghost.piece.cells[g2][0], gc = ghost.c + ghost.piece.cells[g2][1];
            if (gr < 0 || gr >= N || gc < 0 || gc >= N) continue;
            drawCell(cellX(gc), cellY(gr), s, ghost.ok ? ghost.piece.color : '#c04040', 0.35);
        }
    }

    for (var i = 0; i < grid.length; i++) {
        if (!grid[i]) continue;
        drawCell(cellX(i % N), cellY((i / N) | 0), s, grid[i]);
    }

    // líneas de los cuadros de 3×3
    ctx.strokeStyle = 'rgba(143,211,244,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var k = 0; k <= 3; k++) {
        ctx.moveTo(bx() + k * s * 3, TOP); ctx.lineTo(bx() + k * s * 3, TOP + boardSize());
        ctx.moveTo(bx(), TOP + k * s * 3); ctx.lineTo(bx() + boardSize(), TOP + k * s * 3);
    }
    ctx.stroke();

    // bandeja
    for (var t = 0; t < 3; t++) {
        var rect = trayRect(t);
        var piece = tray[t];
        if (t === sel) {
            ctx.fillStyle = 'rgba(143,211,244,0.14)';
            GU.roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.fill();
        }
        if (!piece) continue;
        var ps = Math.min(rect.w / piece.w, rect.h / piece.h, 22);
        var ox = rect.x + (rect.w - piece.w * ps) / 2;
        var oy = rect.y + (rect.h - piece.h * ps) / 2;
        var usable = status !== 'playing' || fitsAnywhere(piece);
        for (var p = 0; p < piece.cells.length; p++) {
            drawCell(ox + piece.cells[p][1] * ps, oy + piece.cells[p][0] * ps, ps,
                     piece.color, usable ? 1 : 0.3);
        }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(score + ' pts', W / 2, TOP / 2);
    if (combo > 1) {
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#66bb6a';
        ctx.fillText('racha ×' + Math.min(combo, 5), W - 52, TOP / 2);
    }

    fx.draw(ctx);

    var tg = cursor.target();
    if (tg) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, tg.x - 2, tg.y - 2, tg.w + 4, tg.h + 4, 8);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, TOP + boardSize() + 16);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'BLOQUES',
            lines: ['Encaja las piezas y limpia filas, columnas y cuadros',
                    'Pulsa Iniciar'],
            bg: 'rgba(7,12,22,0.86)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function cellAt(x, y) {
    var s = cellSize();
    var c = Math.floor((x - bx()) / s);
    var r = Math.floor((y - TOP) / s);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r: r, c: c };
}

function handleAt(x, y) {
    if (status !== 'playing') return;
    for (var t = 0; t < 3; t++) {
        var rect = trayRect(t);
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
            if (!tray[t]) return;
            sel = (sel === t) ? -1 : t;
            ghost = null;
            GameAudio.click();
            view.invalidate();
            return;
        }
    }
    var cell = cellAt(x, y);
    if (!cell) return;
    if (sel < 0) { msg.show('Elige antes una pieza', 1); view.invalidate(); return; }
    /* La pieza se coloca CENTRADA en el toque: agarrarla por su esquina superior
     * izquierda obliga a apuntar a un sitio que no se ve. */
    var piece = tray[sel];
    var r = cell.r - ((piece.h - 1) >> 1);
    var c = cell.c - ((piece.w - 1) >> 1);
    drop(sel, r, c);
    ghost = null;
    view.invalidate();
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
canvas.addEventListener('mousemove', function (e) {
    if (status !== 'playing' || sel < 0) { return; }
    var p = GU.pointerPos(canvas, e);
    var cell = cellAt(p.x, p.y);
    if (!cell) { if (ghost) { ghost = null; view.invalidate(); } return; }
    var piece = tray[sel];
    var r = cell.r - ((piece.h - 1) >> 1);
    var c = cell.c - ((piece.w - 1) >> 1);
    var prev = ghost;
    ghost = { piece: piece, r: r, c: c, ok: fits(piece, r, c) };
    if (!prev || prev.r !== r || prev.c !== c || prev.piece !== piece) view.invalidate();
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de bloques. Flechas para moverte, Enter para elegir pieza y sitio.',
    targets: function () {
        if (status !== 'playing') return [];
        var out = [], s = cellSize();
        for (var t = 0; t < 3; t++) {
            if (!tray[t]) continue;
            var rect = trayRect(t);
            out.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, id: 't' + t });
        }
        /* Con una pieza elegida sólo se ofrecen las posiciones donde cabe: las
         * otras 70 y pico casillas no llevan a ninguna parte. */
        if (sel >= 0) {
            var piece = tray[sel];
            for (var r = 0; r < N; r++) {
                for (var c = 0; c < N; c++) {
                    var pr = r - ((piece.h - 1) >> 1), pc = c - ((piece.w - 1) >> 1);
                    if (!fits(piece, pr, pc)) continue;
                    out.push({ x: cellX(c), y: cellY(r), w: s, h: s, id: 'c' + r + '_' + c });
                }
            }
        }
        return out;
    },
    activate: function (t) { handleAt(t.x + t.w / 2, t.y + t.h / 2); },
    onChange: function () { view.invalidate(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    msg.update(dt);
    draw();
    return fx.count > 0 || msg.active();
});

var gameControls = GU.controls({
    start:     newGame,
    restart:   newGame,
    playAgain: newGame,
    popup:     'overPopup'
});

syncHud();

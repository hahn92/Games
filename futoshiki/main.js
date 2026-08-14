/* Futoshiki — rellena la rejilla con 1..N sin repetir en fila ni columna, y
 * respetando los signos < y > que hay entre casillas contiguas.
 *
 * Lo que separa esto de un generador de tableros al azar es la UNICIDAD: el
 * puzzle se construye desde un cuadrado latino completo, se le cuelgan las
 * desigualdades derivadas de él (así que son ciertas por definición) y luego se
 * van quitando pistas mientras la solución siga siendo única. Sin esa
 * comprobación salen puzzles con varias soluciones, y ahí el jugador rellena
 * algo válido, el juego se lo da por malo y no hay forma de saber por qué.
 *
 * `countSolutions` es lo que hace viable generar: para en cuanto encuentra DOS.
 * Contarlas todas sobre una rejilla casi vacía es exponencial y cuelga la
 * pestaña; sólo hace falta saber si hay más de una. */
(function () {
'use strict';

var canvas = document.getElementById('futCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 440
var H = canvas.height;   // 520

var SIZES = { facil: 4, medio: 5, dificil: 6 };
var N = 5;
var CELL = 0, GAP = 0, OX = 0, OY = 0;

var solution = null;     // Uint8Array del cuadrado latino completo
var given = null;        // Uint8Array, 1 = pista fija
var grid = null;         // Uint8Array, 0 = vacía
/* Desigualdades. hRel[r][c] relaciona (r,c) con (r,c+1); vRel[r][c] con
 * (r+1,c). 0 = sin signo, 1 = "menor que", 2 = "mayor que". */
var hRel = null, vRel = null;

var sel = 0;             // casilla seleccionada
var errors = 0;
var startMs = 0, elapsed = 0;
var status = 'idle';     // idle | playing | won
var diff = 'medio';

var fx = new Particles(160);
var gMemo = GU.gradientMemo();

/* El récord es un TIEMPO y por dificultad: menor es mejor. Con el 0 por defecto
 * de un marcador normal la primera partida nunca sería récord. */
var bests = {
    facil:   GU.highScore('futoshikiBestFacil',   { lower: true }),
    medio:   GU.highScore('futoshikiBestMedio',   { lower: true }),
    dificil: GU.highScore('futoshikiBestDificil', { lower: true })
};

var hud = GU.hud({
    left:   'leftLabel',
    errors: 'errorsLabel',
    time:   { el: 'timeLabel', format: function (v) { return GU.formatTime(v); } },
    best:   { el: 'highScore', format: function (v) { return v == null ? '—' : GU.formatTime(v); } },
    mobile: { el: 'mobileScore', format: function () {
        return emptyCount() + ' por poner  ·  ' + GU.formatTime(elapsed) + '  ·  ' + errors + ' fallos';
    } }
});

function idx(r, c) { return r * N + c; }
function emptyCount() {
    if (!grid) return 0;
    var n = 0;
    for (var i = 0; i < grid.length; i++) if (!grid[i]) n++;
    return n;
}

/* ── Solucionador ─────────────────────────────────────────────────── */

/* ¿Cabe `v` en (r,c) sin romper fila, columna ni desigualdad?
 *
 * Las desigualdades sólo se comprueban contra vecinas YA rellenas. Con la
 * vecina vacía no se puede decidir nada todavía, y exigirlo cortaría ramas
 * válidas — el fallo típico al escribir esta comprobación. */
function fits(g, r, c, v) {
    var i;
    for (i = 0; i < N; i++) {
        if (i !== c && g[idx(r, i)] === v) return false;
        if (i !== r && g[idx(i, c)] === v) return false;
    }
    /* izquierda */
    if (c > 0 && g[idx(r, c - 1)]) {
        var rel = hRel[idx(r, c - 1)];
        if (rel === 1 && !(g[idx(r, c - 1)] < v)) return false;
        if (rel === 2 && !(g[idx(r, c - 1)] > v)) return false;
    }
    /* derecha */
    if (c < N - 1 && g[idx(r, c + 1)]) {
        var rr = hRel[idx(r, c)];
        if (rr === 1 && !(v < g[idx(r, c + 1)])) return false;
        if (rr === 2 && !(v > g[idx(r, c + 1)])) return false;
    }
    /* arriba */
    if (r > 0 && g[idx(r - 1, c)]) {
        var ru = vRel[idx(r - 1, c)];
        if (ru === 1 && !(g[idx(r - 1, c)] < v)) return false;
        if (ru === 2 && !(g[idx(r - 1, c)] > v)) return false;
    }
    /* abajo */
    if (r < N - 1 && g[idx(r + 1, c)]) {
        var rd = vRel[idx(r, c)];
        if (rd === 1 && !(v < g[idx(r + 1, c)])) return false;
        if (rd === 2 && !(v > g[idx(r + 1, c)])) return false;
    }
    return true;
}

/* Cuenta soluciones hasta un tope (2 basta para decidir unicidad).
 *
 * Elige siempre la casilla con MENOS candidatos y abandona la rama en cuanto
 * una se queda sin ninguno. Con la versión ingenua —primera casilla vacía—
 * generar en 6×6 tarda tanto que la pestaña se cuelga; con esto es inmediato. */
function countSolutions(g, cap) {
    var bestI = -1, bestOpts = null;
    for (var i = 0; i < g.length; i++) {
        if (g[i]) continue;
        var r = (i / N) | 0, c = i % N;
        var opts = [];
        for (var v = 1; v <= N; v++) if (fits(g, r, c, v)) opts.push(v);
        if (!opts.length) return 0;
        if (!bestOpts || opts.length < bestOpts.length) {
            bestI = i; bestOpts = opts;
            if (opts.length === 1) break;
        }
    }
    if (bestI < 0) return 1;   // sin huecos: es una solución

    var total = 0;
    for (var k = 0; k < bestOpts.length; k++) {
        g[bestI] = bestOpts[k];
        total += countSolutions(g, cap - total);
        g[bestI] = 0;
        if (total >= cap) break;
    }
    return total;
}

/* ── Generación ───────────────────────────────────────────────────── */

/* Cuadrado latino por desplazamiento cíclico y luego barajando filas, columnas
 * y símbolos. Esas tres operaciones conservan la propiedad de cuadrado latino,
 * así que sale uno válido sin backtracking. */
function makeLatin() {
    var base = [];
    for (var r = 0; r < N; r++) {
        base[r] = [];
        for (var c = 0; c < N; c++) base[r][c] = ((r + c) % N) + 1;
    }
    var rows = []; for (var i = 0; i < N; i++) rows.push(i);
    var cols = rows.slice(), syms = rows.slice();
    GU.shuffle(rows); GU.shuffle(cols); GU.shuffle(syms);

    var out = new Uint8Array(N * N);
    for (var r2 = 0; r2 < N; r2++) {
        for (var c2 = 0; c2 < N; c2++) {
            out[idx(r2, c2)] = syms[base[rows[r2]][cols[c2]] - 1] + 1;
        }
    }
    return out;
}

function newGame() {
    N = SIZES[diff];
    layout();

    for (var attempt = 0; attempt < 40; attempt++) {
        solution = makeLatin();
        hRel = new Uint8Array(N * N);
        vRel = new Uint8Array(N * N);

        /* Desigualdades DERIVADAS de la solución: son ciertas por definición y
         * nunca se contradicen entre sí. Inventarlas y luego buscar un cuadrado
         * que las cumpla es el camino largo y a menudo sin salida. */
        var wanted = Math.round(N * N * (diff === 'facil' ? 0.30 : diff === 'medio' ? 0.38 : 0.46));
        var slots = [];
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                if (c < N - 1) slots.push({ h: true, r: r, c: c });
                if (r < N - 1) slots.push({ h: false, r: r, c: c });
            }
        }
        GU.shuffle(slots);
        for (var s = 0; s < Math.min(wanted, slots.length); s++) {
            var sl = slots[s];
            if (sl.h) {
                hRel[idx(sl.r, sl.c)] = solution[idx(sl.r, sl.c)] < solution[idx(sl.r, sl.c + 1)] ? 1 : 2;
            } else {
                vRel[idx(sl.r, sl.c)] = solution[idx(sl.r, sl.c)] < solution[idx(sl.r + 1, sl.c)] ? 1 : 2;
            }
        }

        /* Se parte de la rejilla llena y se quitan pistas mientras la solución
         * siga siendo única. El orden es aleatorio, así que dos partidas con la
         * misma dificultad no se parecen. */
        grid = solution.slice();
        var order = [];
        for (var i = 0; i < N * N; i++) order.push(i);
        GU.shuffle(order);
        for (var k = 0; k < order.length; k++) {
            var keep = grid[order[k]];
            grid[order[k]] = 0;
            var probe = grid.slice();
            if (countSolutions(probe, 2) !== 1) grid[order[k]] = keep;
        }

        /* Un puzzle sin ningún hueco no es un puzzle. Con desigualdades
         * suficientes casi nunca pasa, pero la salvaguarda es barata. */
        if (emptyCount() >= 2) break;
    }

    given = new Uint8Array(N * N);
    for (var g = 0; g < grid.length; g++) given[g] = grid[g] ? 1 : 0;

    sel = firstEmpty();
    errors = 0;
    startMs = performance.now();
    elapsed = 0;
    status = 'playing';
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function firstEmpty() {
    for (var i = 0; i < grid.length; i++) if (!grid[i]) return i;
    return 0;
}

/* ── Jugada ───────────────────────────────────────────────────────── */

function place(v) {
    if (status !== 'playing') return;
    if (given[sel]) { GameAudio.miss(); return; }

    if (v === 0) { grid[sel] = 0; GameAudio.click(); syncHud(); return; }

    /* Se compara contra la solución, que es única: no hace falta reevaluar las
     * restricciones y además así el fallo se señala en el momento. */
    if (v !== solution[sel]) {
        errors++;
        GameAudio.noMatch();
        var r = (sel / N) | 0, c = sel % N;
        fx.burst(cx(c), cy(r), 10, { color: '#ff512f', speed: 80, life: 0.5, size: 2 });
        syncHud();
        return;
    }

    grid[sel] = v;
    GameAudio.place();
    var rr = (sel / N) | 0, cc = sel % N;
    fx.burst(cx(cc), cy(rr), 6, { color: '#8fff6a', speed: 60, life: 0.4, size: 2 });
    if (emptyCount() === 0) { win(); return; }
    sel = firstEmpty();
    syncHud();
}

function win() {
    status = 'won';
    elapsed = performance.now() - startMs;
    var record = bests[diff].submit(elapsed);
    syncHud();
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Rejilla completa!',
            overScore: 'Tiempo: ' + GU.formatTime(elapsed) + '  ·  ' + errors +
                       (errors === 1 ? ' fallo' : ' fallos'),
            overBest:  bests[diff].has() ? 'Tu mejor tiempo aquí: ' + GU.formatTime(bests[diff].value) : ''
        });
    }, 600);
}

function syncHud() {
    hud.set({
        left:   emptyCount(),
        errors: errors,
        time:   elapsed,
        best:   bests[diff].has() ? bests[diff].value : null
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function layout() {
    /* Entre casilla y casilla hay que dejar sitio para el signo. */
    GAP = Math.max(16, Math.floor(46 / N * 2));
    var avail = Math.min(W - 24, H - 130);
    CELL = Math.floor((avail - GAP * (N - 1)) / N);
    var side = N * CELL + GAP * (N - 1);
    OX = (W - side) / 2;
    OY = 26;
}
function cellLeft(c) { return OX + c * (CELL + GAP); }
function cellTop(r)  { return OY + r * (CELL + GAP); }
function cx(c) { return cellLeft(c) + CELL / 2; }
function cy(r) { return cellTop(r) + CELL / 2; }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1b1f30');
        g.addColorStop(1, '#0e1120');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    if (grid) {
        drawCells();
        drawRels();
        drawPad();
    }
    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 8);
        ctx.stroke();
    }

    if (status === 'idle') drawIdle();
}

function drawCells() {
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            var i = idx(r, c);
            var x = cellLeft(c), y = cellTop(r);
            ctx.fillStyle = i === sel ? '#2f3a5c'
                          : given[i]  ? '#232a42'
                                      : '#1a1f33';
            GU.roundRectPath(ctx, x, y, CELL, CELL, 8);
            ctx.fill();
            ctx.strokeStyle = i === sel ? '#00e5ff' : '#39415c';
            ctx.lineWidth = i === sel ? 2.5 : 1;
            ctx.stroke();

            if (!grid[i]) continue;
            ctx.fillStyle = given[i] ? '#8fd3f4' : '#f0f0f0';
            ctx.font = 'bold ' + Math.floor(CELL * 0.55) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(String(grid[i]), x + CELL / 2, y + CELL * 0.71);
            ctx.textAlign = 'left';
        }
    }
}

/* Los signos se dibujan como DOS SEGMENTOS en ángulo, no con texto: a este
 * tamaño un "<" tipográfico se lee mal y además hay que rotarlo para las
 * relaciones verticales, que con texto obliga a un save/rotate por signo. */
function drawRels() {
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    var arm = Math.min(9, GAP * 0.34);
    var r, c;

    ctx.beginPath();
    for (r = 0; r < N; r++) {
        for (c = 0; c < N - 1; c++) {
            var rel = hRel[idx(r, c)];
            if (!rel) continue;
            var mx = cellLeft(c) + CELL + GAP / 2, my = cy(r);
            /* La PUNTA señala al menor. rel === 1 significa "el de la izquierda
             * es menor", así que la punta va a la izquierda: un "<". El signo
             * estuvo invertido y el tablero mostraba cosas como 5 < 2 — se vio
             * mirando una captura, no leyendo el código. */
            var dir = rel === 1 ? -1 : 1;
            ctx.moveTo(mx - arm * dir * 0.6, my - arm);
            ctx.lineTo(mx + arm * dir * 0.6, my);
            ctx.lineTo(mx - arm * dir * 0.6, my + arm);
        }
    }
    for (r = 0; r < N - 1; r++) {
        for (c = 0; c < N; c++) {
            var rl = vRel[idx(r, c)];
            if (!rl) continue;
            var vx = cx(c), vy = cellTop(r) + CELL + GAP / 2;
            /* Igual en vertical: rl === 1 es "el de arriba es menor", así que la
             * punta mira hacia arriba. */
            var d2 = rl === 1 ? -1 : 1;
            ctx.moveTo(vx - arm, vy - arm * d2 * 0.6);
            ctx.lineTo(vx, vy + arm * d2 * 0.6);
            ctx.lineTo(vx + arm, vy - arm * d2 * 0.6);
        }
    }
    ctx.stroke();
}

/* Teclado numérico en pantalla: sin él el juego sería injugable con el dedo. */
function padY() { return OY + N * CELL + GAP * (N - 1) + 22; }
function padBtn(i) {
    var wpx = Math.min(48, (W - 40) / (N + 1));
    var total = (N + 1) * (wpx + 6) - 6;
    return { x: (W - total) / 2 + i * (wpx + 6), y: padY(), w: wpx, h: 44 };
}

function drawPad() {
    for (var i = 0; i <= N; i++) {
        var b = padBtn(i);
        ctx.fillStyle = i === N ? '#3a2530' : '#242c46';
        GU.roundRectPath(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fill();
        ctx.strokeStyle = '#414a68';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = i === N ? '#ff8a80' : '#e8eefc';
        ctx.font = 'bold 19px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(i === N ? '×' : String(i + 1), b.x + b.w / 2, b.y + 29);
        ctx.textAlign = 'left';
    }
}

function drawIdle() {
    ctx.fillStyle = 'rgba(14,17,32,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('FUTOSHIKI', W / 2, H / 2 - 12);
    ctx.fillStyle = '#b7c6d6';
    ctx.font = '15px Arial';
    ctx.fillText('Cuadrado latino con signos < y >', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

rafLoop(function (dt) {
    if (status === 'playing') elapsed = performance.now() - startMs;
    fx.update(dt);
    syncHud();
    draw();
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (status !== 'playing') return;
    var i;
    for (i = 0; i <= N; i++) {
        var b = padBtn(i);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            place(i === N ? 0 : i + 1);
            return;
        }
    }
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            var cxs = cellLeft(c), cys = cellTop(r);
            if (x >= cxs && x <= cxs + CELL && y >= cys && y <= cys + CELL) {
                sel = idx(r, c);
                GameAudio.click();
                return;
            }
        }
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Las cifras también por teclado físico. Sin preventDefault: Enter y los
 * números tienen que seguir funcionando sobre los botones de la página. */
GU.keys({
    n1: ['1'], n2: ['2'], n3: ['3'], n4: ['4'], n5: ['5'], n6: ['6'],
    del: ['Backspace', 'Delete', '0']
}, {
    onPress: function (a) {
        if (a === 'del') place(0);
        else place(parseInt(a.slice(1), 10));
    }
});

var cursor = GU.canvasCursor(canvas, {
    label: 'Rejilla de futoshiki. Flechas para moverte, Enter para elegir casilla o cifra.',
    targets: function () {
        var out = [], i;
        if (!grid) return out;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                out.push({ x: cellLeft(c), y: cellTop(r), w: CELL, h: CELL,
                           id: 'c' + r + ',' + c, kind: 'cell', i: idx(r, c) });
            }
        }
        for (i = 0; i <= N; i++) {
            var b = padBtn(i);
            out.push({ x: b.x, y: b.y, w: b.w, h: b.h, id: 'p' + i, kind: 'pad', v: i === N ? 0 : i + 1 });
        }
        return out;
    },
    activate: function (t) {
        if (t.kind === 'cell') { sel = t.i; GameAudio.click(); }
        else place(t.v);
    }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('diffSel').addEventListener('change', function () {
    diff = this.value;
    syncHud();
});

N = SIZES[diff];
layout();
syncHud();
draw();

}());

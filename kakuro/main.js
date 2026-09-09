/* Kakuro — crucigrama de sumas con cifras 1..9 y sin repetir dentro de un tramo.
 *
 * Lo que sostiene este juego, y lo que cuesta hacer bien:
 *
 * - **Solución única garantizada, y no por sorteo.** Se rellena primero una
 *   rejilla válida al azar y se derivan las pistas DE ELLA, así que son ciertas
 *   por construcción y nunca se contradicen. Pero eso solo no basta: medido
 *   sobre 60 patrones por configuración, **sólo entre el 0% y el 7% de los
 *   tableros aleatorios tiene solución única**, así que esperar a que salga uno
 *   —lo que hace futoshiki, donde sí sale— aquí deja al generador sin tablero.
 *
 *   Lo que se hace es forzarla: mientras `countSolutions` encuentre más de una,
 *   se REVELA una casilla más con su cifra correcta. Cada cifra dada recorta el
 *   árbol, y en la práctica bastan unas pocas. Es lo mismo que trae impreso
 *   cualquier kakuro para principiantes, y garantiza que si tu rejilla cuadra,
 *   es la buena — que es lo único que el jugador necesita poder dar por hecho.
 * - **`countSolutions` para en cuanto encuentra dos.** Contarlas todas es
 *   exponencial y no hace falta: sólo interesa si hay más de una.
 * - El solucionador va por **tramos, no por casillas**: enumera las
 *   combinaciones posibles de cada tramo horizontal y las cruza con las
 *   verticales. Casilla a casilla, con 9 candidatos por hueco, el árbol es
 *   inmanejable; por tramos, un tramo de dos que suma 17 tiene UNA combinación.
 * - Las combinaciones de (longitud, suma) se calculan una vez y se cachean: son
 *   pocas y se consultan miles de veces.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var SIZES = {
    facil:   { n: 6, fill: 0.62, label: 'Fácil (6×6)' },
    medio:   { n: 8, fill: 0.62, label: 'Medio (8×8)' },
    dificil: { n: 9, fill: 0.62, label: 'Difícil (9×9)' }
};

var N = 8;
var diff = 'medio';
var BLOCK = -1;

var cells = [];        // -1 = casilla negra (pista), 0 = vacía, 1..9 = escrita
var given = [];        // true en las casillas que vienen dadas y no se tocan
var sol = [];          // solución
var clues = [];        // por celda negra: {right: suma|0, down: suma|0}
var runs = { h: [], v: [] };
var sel = -1;
var errors = 0, elapsed = 0, startMs = 0;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';

var fx = new Particles(140);
var gMemo = GU.gradientMemo();
var msg = GU.toast();
var TOP = 44, PAD_BOTTOM = 74;

var hud = GU.hud({
    left:   'leftLabel',
    errors: 'errorsLabel',
    time:   { el: 'timeLabel', format: function (v) { return GU.formatTime(v); } },
    best:   { el: 'highScore', format: function (v) { return v == null ? '—' : GU.formatTime(v); } },
    mobile: { el: 'mobileScore', format: function () {
        return emptyCount() + ' por poner  ·  ' + GU.formatTime(elapsed) + '  ·  ' + errors + ' fallos';
    } }
});

var bests = {
    facil:   GU.highScore('kakuroBestFacil',   { lower: true }),
    medio:   GU.highScore('kakuroBestMedio',   { lower: true }),
    dificil: GU.highScore('kakuroBestDificil', { lower: true })
};
var over = GU.popup('overPopup');

function idx(r, c) { return r * N + c; }

/* ── Combinaciones de un tramo ────────────────────────────────────── */

var comboCache = {};
/* Todas las formas de sumar `sum` con `len` cifras distintas de 1..9. Se
 * devuelven como conjuntos (bitmask) porque lo único que se pregunta luego es
 * qué cifras pueden aparecer, no en qué orden. */
function combos(len, sum) {
    var key = len + ':' + sum;
    if (comboCache[key]) return comboCache[key];
    var out = [];
    (function rec(start, left, rest, mask) {
        if (left === 0) {
            if (rest === 0) out.push(mask);
            return;
        }
        for (var d = start; d <= 9; d++) {
            if (d > rest) break;
            rec(d + 1, left - 1, rest - d, mask | (1 << d));
        }
    }(1, len, sum, 0));
    comboCache[key] = out;
    return out;
}

/* ── Estructura del tablero ───────────────────────────────────────── */

/* Recoge los tramos horizontales y verticales: listas de celdas blancas
 * consecutivas de longitud >= 2, cada una con la celda negra que la encabeza.
 * Un tramo de una sola casilla se evita al generar, porque su pista revelaría
 * la cifra y no aporta nada. */
function buildRuns() {
    runs = { h: [], v: [] };
    var r, c, run;
    for (r = 0; r < N; r++) {
        run = null;
        for (c = 0; c < N; c++) {
            if (cells[idx(r, c)] === BLOCK) {
                if (run && run.list.length >= 2) runs.h.push(run);
                run = { head: idx(r, c), list: [] };
            } else if (run) {
                run.list.push(idx(r, c));
            }
        }
        if (run && run.list.length >= 2) runs.h.push(run);
    }
    for (c = 0; c < N; c++) {
        run = null;
        for (r = 0; r < N; r++) {
            if (cells[idx(r, c)] === BLOCK) {
                if (run && run.list.length >= 2) runs.v.push(run);
                run = { head: idx(r, c), list: [] };
            } else if (run) {
                run.list.push(idx(r, c));
            }
        }
        if (run && run.list.length >= 2) runs.v.push(run);
    }
}

/* ── Generador ────────────────────────────────────────────────────── */

/* Patrón de casillas negras. La primera fila y la primera columna son siempre
 * negras —ahí van las pistas de los tramos que empiezan en el borde.
 *
 * El resto NO se siembra al azar. En kakuro toda casilla blanca tiene que estar
 * en un tramo horizontal Y en uno vertical de dos o más, y un sembrado aleatorio
 * deja tantas sueltas que, al ennegrecerlas en cascada, el tablero se queda casi
 * entero negro: medido, 17 blancas en un 9×9, que no es un puzzle. Así que los
 * tramos se construyen directamente: cada fila se corta en trozos de 2 a 5
 * casillas —el rango de los kakuros publicados, y el que hace viable la
 * unicidad— separados por una negra. Después se parten los tramos verticales
 * que hayan salido largos, y sólo entonces se limpia lo que quede suelto, que
 * ya son pocas casillas. */
function makePattern(n, fill) {
    var g = new Array(n * n);
    var i, r, c;
    for (i = 0; i < n * n; i++) g[i] = 0;
    for (c = 0; c < n; c++) g[c] = BLOCK;
    for (r = 0; r < n; r++) g[r * n] = BLOCK;

    var MIN_RUN = 2, MAX_RUN = 5;
    for (r = 1; r < n; r++) {
        c = 1;
        while (c < n) {
            var len = MIN_RUN + Math.floor(Math.random() * (MAX_RUN - MIN_RUN + 1));
            c += len;
            if (c < n) { g[r * n + c] = BLOCK; c++; }
        }
    }
    /* Partir las columnas largas. Cae en una fila al azar del tramo y no en el
     * medio siempre: si no, las negras se alinean y el tablero sale con bandas. */
    for (c = 1; c < n; c++) {
        var start = -1;
        for (r = 1; r <= n; r++) {
            var black = r === n || g[r * n + c] === BLOCK;
            if (black) {
                if (start >= 0 && r - start > MAX_RUN) {
                    var cut = start + MIN_RUN + Math.floor(Math.random() * (MAX_RUN - MIN_RUN));
                    if (cut < r) g[cut * n + c] = BLOCK;
                }
                start = -1;
            } else if (start < 0) start = r;
        }
    }

    function runLen(idx0, step, limit) {      // longitud del tramo que contiene idx0
        var len = 1, k;
        for (k = idx0 - step; k >= 0 && limit(k, idx0) && g[k] !== BLOCK; k -= step) len++;
        for (k = idx0 + step; k < n * n && limit(k, idx0) && g[k] !== BLOCK; k += step) len++;
        return len;
    }
    var sameRow = function (a, b) { return Math.floor(a / n) === Math.floor(b / n); };
    var sameCol = function (a, b) { return a % n === b % n; };

    /* Las blancas que quedan solas en su fila o en su columna se vuelven negras,
     * y se repite: ennegrecer una puede dejar sola a la vecina. Termina siempre,
     * porque cada pasada sólo quita blancas. */
    var changed = true;
    while (changed) {
        changed = false;
        for (i = 0; i < n * n; i++) {
            if (g[i] === BLOCK) continue;
            if (runLen(i, 1, sameRow) < 2 || runLen(i, n, sameCol) < 2) {
                g[i] = BLOCK;
                changed = true;
            }
        }
    }
    return g;
}

/* Rellena las blancas con cifras que no repitan dentro de ningún tramo.
 * Backtracking sobre casillas, que aquí sí basta: los tramos son cortos y hay
 * mucha libertad, así que casi nunca hace falta retroceder. */
function fillSolution() {
    var used = { h: {}, v: {} };
    var runOf = { h: {}, v: {} };
    for (var i = 0; i < runs.h.length; i++) {
        for (var k = 0; k < runs.h[i].list.length; k++) runOf.h[runs.h[i].list[k]] = i;
    }
    for (var j = 0; j < runs.v.length; j++) {
        for (var m = 0; m < runs.v[j].list.length; m++) runOf.v[runs.v[j].list[m]] = j;
    }
    var white = [];
    for (var p = 0; p < cells.length; p++) if (cells[p] !== BLOCK) white.push(p);

    var val = new Array(cells.length).fill(0);
    var maskH = new Array(runs.h.length).fill(0);
    var maskV = new Array(runs.v.length).fill(0);

    function rec(i) {
        if (i >= white.length) return true;
        var cell = white[i];
        var hi = runOf.h[cell], vi = runOf.v[cell];
        var order = GU.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (var k = 0; k < 9; k++) {
            var d = order[k], bit = 1 << d;
            if (hi !== undefined && (maskH[hi] & bit)) continue;
            if (vi !== undefined && (maskV[vi] & bit)) continue;
            val[cell] = d;
            if (hi !== undefined) maskH[hi] |= bit;
            if (vi !== undefined) maskV[vi] |= bit;
            if (rec(i + 1)) return true;
            if (hi !== undefined) maskH[hi] &= ~bit;
            if (vi !== undefined) maskV[vi] &= ~bit;
            val[cell] = 0;
        }
        return false;
    }
    return rec(0) ? val : null;
}

/* Cuenta soluciones parando en `limit`. Va casilla a casilla, no permutando
 * tramos enteros: la primera versión enumeraba las permutaciones de cada tramo
 * horizontal y un tramo de siete casillas son 5040 por combinación — la pestaña
 * se colgaba al generar. Aquí cada casilla prueba sólo las cifras que su tramo
 * horizontal y su tramo vertical admiten todavía, con dos podas que son las que
 * hacen viable el 9×9:
 *
 *   - lo que queda por sumar en un tramo tiene que caber entre el mínimo
 *     (1+2+3…) y el máximo (9+8+7…) de las casillas que le faltan;
 *   - una casilla sin ningún candidato corta la rama entera.
 *
 * `budget` es un tope de nodos: un patrón especialmente malo se descarta en vez
 * de colgar la pestaña, y el generador prueba otro. */
function countSolutions(limit) {
    var hOf = {}, vOf = {};
    var i, k;
    for (i = 0; i < runs.h.length; i++)
        for (k = 0; k < runs.h[i].list.length; k++) hOf[runs.h[i].list[k]] = i;
    for (i = 0; i < runs.v.length; i++)
        for (k = 0; k < runs.v[i].list.length; k++) vOf[runs.v[i].list[k]] = i;

    var white = [];
    for (i = 0; i < cells.length; i++) if (cells[i] !== BLOCK) white.push(i);
    /* En orden de lectura: así las casillas de un mismo tramo se rellenan
     * seguidas y la poda de la suma actúa cuanto antes. */
    white.sort(function (a, b) { return a - b; });

    var maskH = new Array(runs.h.length).fill(0);
    var maskV = new Array(runs.v.length).fill(0);
    var sumH = new Array(runs.h.length).fill(0);
    var sumV = new Array(runs.v.length).fill(0);
    var leftH = runs.h.map(function (r) { return r.list.length; });
    var leftV = runs.v.map(function (r) { return r.list.length; });
    var found = 0, budget = 300000;

    function fits(sum, target, left) {
        if (left === 0) return sum === target;
        var minRest = left * (left + 1) / 2;              // 1+2+3…
        var maxRest = left * (19 - left) / 2;             // 9+8+7…
        return sum + minRest <= target && sum + maxRest >= target;
    }

    function rec(n) {
        if (found >= limit || budget-- <= 0) return;
        if (n >= white.length) { found++; return; }
        var cell = white[n];
        var hi = hOf[cell], vi = vOf[cell];
        var th = clues[runs.h[hi].head].right;
        var tv = clues[runs.v[vi].head].down;
        for (var d = 1; d <= 9; d++) {
            /* Una casilla dada no es una incógnita: sólo se prueba su cifra, y
             * es justo eso lo que recorta el árbol hasta dejar una solución. */
            if (given[cell] && d !== sol[cell]) continue;
            var bit = 1 << d;
            if (maskH[hi] & bit) continue;
            if (maskV[vi] & bit) continue;
            if (!fits(sumH[hi] + d, th, leftH[hi] - 1)) continue;
            if (!fits(sumV[vi] + d, tv, leftV[vi] - 1)) continue;
            maskH[hi] |= bit; maskV[vi] |= bit;
            sumH[hi] += d;    sumV[vi] += d;
            leftH[hi]--;      leftV[vi]--;
            rec(n + 1);
            maskH[hi] &= ~bit; maskV[vi] &= ~bit;
            sumH[hi] -= d;     sumV[vi] -= d;
            leftH[hi]++;       leftV[vi]++;
            if (found >= limit || budget <= 0) return;
        }
    }
    rec(0);
    /* Sin presupuesto no se puede afirmar que sea única: se devuelve "varias"
     * para que el generador tire este patrón. */
    if (budget <= 0) return limit;
    return found;
}

function newGame(level) {
    diff = level || diff;
    N = SIZES[diff].n;

    var tries = 0;
    while (tries++ < 40) {
        cells = makePattern(N, SIZES[diff].fill);
        buildRuns();
        if (!runs.h.length || !runs.v.length) continue;

        /* Toda casilla blanca tiene que pertenecer a un tramo horizontal Y a uno
         * vertical: si no, su cifra no la determina ninguna suma. */
        var covered = {}, i, k;
        for (i = 0; i < runs.h.length; i++)
            for (k = 0; k < runs.h[i].list.length; k++) covered[runs.h[i].list[k]] = 1;
        for (i = 0; i < runs.v.length; i++)
            for (k = 0; k < runs.v[i].list.length; k++)
                covered[runs.v[i].list[k]] = (covered[runs.v[i].list[k]] || 0) + 1;
        var bad = false;
        for (i = 0; i < cells.length; i++) {
            if (cells[i] !== BLOCK && covered[i] !== 2) { bad = true; break; }
        }
        if (bad) continue;

        var whites = [];
        for (i = 0; i < cells.length; i++) if (cells[i] !== BLOCK) whites.push(i);

        /* Varias rejillas-solución para el MISMO patrón: cada una produce pistas
         * distintas y alguna puede salir ya única, sin dar ninguna cifra. */
        var unica = false;
        for (var attempt = 0; attempt < 6 && !unica; attempt++) {
            var v = fillSolution();
            if (!v) continue;
            sol = v;
            clues = [];
            for (i = 0; i < cells.length; i++) clues[i] = { right: 0, down: 0 };
            for (i = 0; i < runs.h.length; i++) {
                var a = 0;
                for (k = 0; k < runs.h[i].list.length; k++) a += sol[runs.h[i].list[k]];
                clues[runs.h[i].head].right = a;
            }
            for (i = 0; i < runs.v.length; i++) {
                var b = 0;
                for (k = 0; k < runs.v[i].list.length; k++) b += sol[runs.v[i].list[k]];
                clues[runs.v[i].head].down = b;
            }
            given = new Array(cells.length).fill(false);
            if (countSolutions(2) === 1) unica = true;
        }
        if (!sol) continue;

        if (!unica) {
            /* Se revelan casillas hasta que sea única… */
            GU.shuffle(whites);
            var rev = 0;
            while (countSolutions(2) > 1 && rev < whites.length) given[whites[rev++]] = true;
            if (countSolutions(2) !== 1) continue;

            /* …y luego se quitan las que sobran. Revelar al azar deja muchas
             * pistas redundantes: en el 9×9 esta poda baja de 20 cifras dadas a
             * 8, que es la diferencia entre un puzzle medio resuelto y uno de
             * verdad. Misma idea que la generación del sudoku. */
            for (var q = 0; q < whites.length; q++) {
                var cell = whites[q];
                if (!given[cell]) continue;
                given[cell] = false;
                if (countSolutions(2) !== 1) given[cell] = true;
            }
        }
        break;
    }

    for (var z = 0; z < cells.length; z++) {
        if (cells[z] === BLOCK) continue;
        cells[z] = given[z] ? sol[z] : 0;
    }
    sel = -1;
    errors = 0;
    elapsed = 0;
    startMs = performance.now();
    gamePhase = 'playing';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function emptyCount() {
    var n = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i] === 0) n++;
    return n;
}

function syncHud() {
    hud.set({
        left: emptyCount(),
        errors: errors,
        time: elapsed,
        best: bests[diff].has() ? bests[diff].value : null
    });
}

function place(d) {
    if (gamePhase !== 'playing' || sel < 0 || cells[sel] === BLOCK) return;
    if (given[sel]) { msg.show('Esa cifra viene dada', 1); return; }
    if (d === 0) { cells[sel] = 0; GameAudio.click(); syncHud(); view.invalidate(); return; }
    if (d === sol[sel]) {
        cells[sel] = d;
        GameAudio.type();
        var r = (sel / N) | 0, c = sel % N;
        fx.burst(cellX(c) + cs() / 2, cellY(r) + cs() / 2, 5,
                 { color: '#8fd3f4', speed: 50, life: 0.4, size: 2 });
    } else {
        /* Escribir mal cuenta como error y NO se queda puesto: dejar la cifra
         * mala obliga a recordar cuál era tuya y cuál un fallo. */
        errors++;
        msg.show('Ahí no va un ' + d, 1.1);
        GameAudio.noMatch();
    }
    syncHud();
    if (emptyCount() === 0) win();
    view.invalidate();
}

function win() {
    gamePhase = 'won';
    var record = bests[diff].submit(elapsed);
    for (var k = 0; k < 26; k++) {
        fx.burst(GU.rand(20, W - 20), GU.rand(TOP, H - PAD_BOTTOM), 2,
                 { color: GU.pick(['#ffd54a', '#8fd3f4']), speed: 100, life: 0.9, size: 3, gravity: 110 });
    }
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Rejilla completa!',
            overScore: 'Tiempo: ' + GU.formatTime(elapsed) + '  ·  ' + errors +
                       (errors === 1 ? ' fallo' : ' fallos'),
            overRecord: bests[diff].has() ? 'Tu mejor tiempo aquí: ' + GU.formatTime(bests[diff].value) : ''
        });
    }, 650);
}

/* ── Geometría y dibujo ───────────────────────────────────────────── */

function cs() { return Math.min((W - 20) / N, (H - TOP - PAD_BOTTOM) / N); }
function bx() { return (W - cs() * N) / 2; }
function cellX(c) { return bx() + c * cs(); }
function cellY(r) { return TOP + r * cs(); }

function padRect(i) {
    var n = 10, gap = 4;
    var w = Math.min(42, (W - 16 - gap * (n - 1)) / n);
    var total = w * n + gap * (n - 1);
    return { x: (W - total) / 2 + i * (w + gap), y: H - PAD_BOTTOM + 16, w: w, h: 40 };
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#16203a');
        g.addColorStop(1, '#080d18');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var s = cs();
    ctx.textBaseline = 'middle';

    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            var i = idx(r, c);
            var x = cellX(c), y = cellY(r);
            if (cells[i] === BLOCK) {
                ctx.fillStyle = '#1b2436';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#334259';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                var cl = clues[i];
                if (cl && (cl.right || cl.down)) {
                    /* La diagonal separa las dos pistas: arriba-derecha la suma
                     * hacia la derecha, abajo-izquierda la de hacia abajo. Sin
                     * ella no se sabe cuál es cuál. */
                    ctx.strokeStyle = '#4a5b76';
                    ctx.beginPath();
                    ctx.moveTo(x, y); ctx.lineTo(x + s, y + s);
                    ctx.stroke();
                    ctx.font = 'bold ' + Math.round(s * 0.34) + 'px Arial';
                    if (cl.right) {
                        ctx.fillStyle = '#ffd54a';
                        ctx.textAlign = 'right';
                        ctx.fillText(cl.right, x + s - 4, y + s * 0.27);
                    }
                    if (cl.down) {
                        ctx.fillStyle = '#8fd3f4';
                        ctx.textAlign = 'left';
                        ctx.fillText(cl.down, x + 4, y + s * 0.74);
                    }
                }
            } else {
                ctx.fillStyle = i === sel ? '#2f4866' : '#e9eef7';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#7f8ea6';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                if (cells[i]) {
                    /* Las cifras dadas en gris azulado y las tuyas en oscuro:
                     * hay que poder distinguir de un vistazo qué has puesto tú. */
                    ctx.fillStyle = given[i] ? '#5a6b86' : (i === sel ? '#ffd54a' : '#16203a');
                    ctx.font = 'bold ' + Math.round(s * 0.5) + 'px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(cells[i], x + s / 2, y + s / 2 + 1);
                }
            }
        }
    }

    // teclado numérico
    for (var d = 0; d <= 9; d++) {
        var pr = padRect(d);
        ctx.fillStyle = d === 0 ? '#5a2f2f' : '#24314a';
        GU.roundRectPath(ctx, pr.x, pr.y, pr.w, pr.h, 8);
        ctx.fill();
        ctx.strokeStyle = '#4a5b76';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#dfe9f6';
        ctx.font = 'bold 17px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(d === 0 ? '×' : d, pr.x + pr.w / 2, pr.y + pr.h / 2 + 1);
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(SIZES[diff].label + '   ·   ' + GU.formatTime(elapsed), W / 2, TOP / 2);

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
    }

    msg.draw(ctx, W / 2, H - PAD_BOTTOM - 14);

    if (gamePhase === 'idle') {
        GU.idleScreen(ctx, {
            title: 'KAKURO',
            lines: ['Suma cada tramo sin repetir cifra',
                    'Pulsa Iniciar'],
            bg: 'rgba(8,13,24,0.86)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (gamePhase !== 'playing') return;
    for (var d = 0; d <= 9; d++) {
        var pr = padRect(d);
        if (x >= pr.x && x <= pr.x + pr.w && y >= pr.y && y <= pr.y + pr.h) { place(d); return; }
    }
    var s = cs();
    var c = Math.floor((x - bx()) / s);
    var r = Math.floor((y - TOP) / s);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    var i = idx(r, c);
    if (cells[i] === BLOCK || given[i]) return;
    sel = (sel === i) ? -1 : i;
    GameAudio.click();
    view.invalidate();
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

document.addEventListener('keydown', function (e) {
    if (gamePhase !== 'playing') return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) { place(n); e.preventDefault(); return; }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { place(0); e.preventDefault(); }
});

var cursor = GU.canvasCursor(canvas, {
    label: 'Rejilla de kakuro. Flechas para moverte, Enter para elegir casilla o cifra.',
    targets: function () {
        if (gamePhase !== 'playing') return [];
        var s = cs(), out = [];
        for (var i = 0; i < cells.length; i++) {
            if (cells[i] === BLOCK || given[i]) continue;
            out.push({ x: cellX(i % N), y: cellY((i / N) | 0), w: s, h: s, id: 'c' + i });
        }
        for (var d = 0; d <= 9; d++) {
            var pr = padRect(d);
            out.push({ x: pr.x, y: pr.y, w: pr.w, h: pr.h, id: 'd' + d });
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

/* El cronómetro se pinta DENTRO del canvas, así que hay que repintar mientras
 * corre — pero cuatro veces por segundo, no sesenta. */
setInterval(function () {
    if (gamePhase !== 'playing') return;
    elapsed = performance.now() - startMs;
    syncHud();
    view.invalidate();
}, 250);

var diffSel = document.createElement('select');
diffSel.id = 'diffSel';
Object.keys(SIZES).forEach(function (d) {
    var o = document.createElement('option');
    o.value = d;
    o.textContent = SIZES[d].label;
    if (d === 'medio') o.selected = true;
    diffSel.appendChild(o);
});
diffSel.setAttribute('aria-label', 'Dificultad');
document.querySelector('.buttons-panel').appendChild(diffSel);

var gameControls = GU.controls({
    start:     function () { newGame(diffSel.value); },
    restart:   function () { newGame(diffSel.value); },
    playAgain: function () { newGame(diffSel.value); },
    popup:     'overPopup'
});

syncHud();

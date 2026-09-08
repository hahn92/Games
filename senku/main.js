/* Senku — solitario de clavijas sobre el tablero inglés de 33 huecos.
 *
 * Una ficha salta sobre una vecina ortogonal y cae en el hueco de detrás; la
 * saltada se retira. Se gana con una sola ficha en el tablero.
 *
 * Notas que no se ven leyendo el código:
 *
 * - **El tablero es una cruz, no un cuadrado.** Las cuatro esquinas de 2×2 no
 *   existen, y confundir "fuera del array" con "casilla inexistente" es lo que
 *   hace que se puedan encadenar saltos imposibles por la esquina. Por eso hay
 *   tres estados por celda —NADA, HUECO, FICHA— y no un booleano.
 * - **El salto es siempre de distancia 2 en línea recta**, nunca en diagonal, y
 *   exige que la de en medio tenga ficha y la de destino esté vacía. Las tres
 *   condiciones a la vez: quitar cualquiera convierte el juego en otra cosa.
 * - **Deshacer guarda el tablero entero**, no el inverso del salto. Son 49
 *   enteros: copiarlo es más barato que escribir y depurar la operación inversa,
 *   que es donde se esconden los fallos de este tipo de juego (mismo criterio
 *   que sokoban y solitario).
 * - El final por bloqueo se detecta buscando si queda ALGÚN salto legal, no
 *   contando fichas: se puede perder con muchas fichas repartidas y sueltas.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var SIZE = 7;
var NADA = 0, HUECO = 1, FICHA = 2;

/* La cruz inglesa: las cuatro esquinas de 2×2 quedan fuera del tablero. */
function isCell(r, c) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    var corner = (r < 2 || r > 4) && (c < 2 || c > 4);
    return !corner;
}

var board = [];
var sel = -1;
var moves = 0;
var status = 'idle';        // idle | playing | won | over
var undoStack = [];

var fx = new Particles(140);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    pegs:  'pegsLabel',
    moves: 'movesLabel',
    best:  { el: 'highScore', format: function (v) { return v == null ? '—' : v + ' fichas'; } },
    mobile: { el: 'mobileScore', format: function (v) {
        return v.pegs + ' fichas  ·  ' + v.moves + ' movimientos';
    } }
});

/* El récord es el MENOR número de fichas con el que se acaba atascado — una
 * sola es la victoria. Con el 0 por defecto de un marcador normal, la primera
 * partida nunca sería récord. */
var best = GU.highScore('senkuBest', { lower: true });
var over = GU.popup('overPopup');

function idx(r, c) { return r * SIZE + c; }

function cellSize() { return Math.min(W - 40, H - 120) / SIZE; }
function boardX() { return (W - cellSize() * SIZE) / 2; }
function boardY() { return 30; }
function cx(c) { return boardX() + c * cellSize() + cellSize() / 2; }
function cy(r) { return boardY() + r * cellSize() + cellSize() / 2; }

/* ── Reglas ───────────────────────────────────────────────────────── */

function newGame() {
    board = new Array(SIZE * SIZE);
    for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
            board[idx(r, c)] = isCell(r, c) ? FICHA : NADA;
        }
    }
    board[idx(3, 3)] = HUECO;        // el único hueco de salida, en el centro
    sel = -1;
    moves = 0;
    undoStack.length = 0;
    status = 'playing';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function pegCount() {
    var n = 0;
    for (var i = 0; i < board.length; i++) if (board[i] === FICHA) n++;
    return n;
}

/* Los cuatro saltos posibles desde una casilla. Se devuelven completos —origen,
 * saltada y destino— para no recalcular la de en medio en el sitio donde se
 * aplica el movimiento, que es donde se cuela el error de signo. */
function jumpsFrom(r, c) {
    var out = [];
    if (board[idx(r, c)] !== FICHA) return out;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var k = 0; k < 4; k++) {
        var mr = r + dirs[k][0], mc = c + dirs[k][1];
        var tr = r + dirs[k][0] * 2, tc = c + dirs[k][1] * 2;
        if (!isCell(mr, mc) || !isCell(tr, tc)) continue;
        if (board[idx(mr, mc)] !== FICHA) continue;
        if (board[idx(tr, tc)] !== HUECO) continue;
        out.push({ from: idx(r, c), over: idx(mr, mc), to: idx(tr, tc) });
    }
    return out;
}

function anyJump() {
    for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
            if (jumpsFrom(r, c).length) return true;
        }
    }
    return false;
}

function doJump(j) {
    undoStack.push(board.slice());
    if (undoStack.length > 200) undoStack.shift();
    board[j.from] = HUECO;
    board[j.over] = HUECO;
    board[j.to] = FICHA;
    moves++;
    sel = -1;

    var r = (j.over / SIZE) | 0, c = j.over % SIZE;
    fx.burst(cx(c), cy(r), 9, { color: '#ffd54a', speed: 90, life: 0.55, size: 3, gravity: 120 });
    GameAudio.place();
    syncHud();

    if (pegCount() === 1) win();
    else if (!anyJump()) blocked();
}

function undo() {
    if (status !== 'playing' || !undoStack.length) return;
    board = undoStack.pop();
    moves = Math.max(0, moves - 1);
    sel = -1;
    GameAudio.click();
    syncHud();
    view.invalidate();
}

function win() {
    status = 'won';
    var record = best.submit(1);
    for (var k = 0; k < 30; k++) {
        fx.burst(GU.rand(boardX(), W - boardX()), GU.rand(boardY(), boardY() + cellSize() * SIZE), 2,
                 { color: GU.pick(['#ffd54a', '#8fd3f4', '#66bb6a']), speed: 110, life: 1, size: 3, gravity: 90 });
    }
    gameControls.idle();
    GameAudio.win();
    var centro = board[idx(3, 3)] === FICHA;
    setTimeout(function () {
        over.show({
            overTitle: centro ? '¡Perfecto, y en el centro!' : '¡Una sola ficha!',
            overScore: centro
                ? 'La solución clásica del tablero inglés, en ' + moves + ' movimientos'
                : 'Te ha quedado una ficha, pero fuera del centro (' + moves + ' movimientos)',
            overRecord: record ? '¡Nuevo récord!' : 'Tu mejor marca: ' + best.value + ' fichas'
        });
    }, 700);
}

function blocked() {
    status = 'over';
    var left = pegCount();
    var record = best.submit(left);
    gameControls.idle();
    GameAudio.gameOver();
    setTimeout(function () {
        over.show({
            overTitle: 'Sin saltos posibles',
            overScore: 'Te quedan ' + left + ' fichas sueltas',
            overRecord: record ? '¡Aun así es tu mejor marca!' : 'Tu mejor marca: ' + best.value + ' fichas'
        });
    }, 500);
}

function syncHud() {
    hud.set({ pegs: pegCount(), moves: moves, best: best.has() ? best.value : null });
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#33230f');
        g.addColorStop(1, '#1a1209');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var s = cellSize();

    // tablero: madera con los huecos rebajados
    ctx.fillStyle = '#7a5326';
    GU.roundRectPath(ctx, boardX() - 12, boardY() - 12, s * SIZE + 24, s * SIZE + 24, 18);
    ctx.fill();
    ctx.strokeStyle = '#4a3115';
    ctx.lineWidth = 3;
    ctx.stroke();

    var jumps = sel >= 0 ? jumpsFrom((sel / SIZE) | 0, sel % SIZE) : [];
    var targets = {};
    for (var t = 0; t < jumps.length; t++) targets[jumps[t].to] = true;

    for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
            if (!isCell(r, c)) continue;
            var i = idx(r, c);
            var x = cx(c), y = cy(r);

            // hueco rebajado
            ctx.fillStyle = '#4d3315';
            ctx.beginPath();
            ctx.arc(x, y, s * 0.27, 0, Math.PI * 2);
            ctx.fill();

            if (targets[i]) {                     // destino legal del salto
                ctx.fillStyle = 'rgba(143,211,244,0.55)';
                ctx.beginPath();
                ctx.arc(x, y, s * 0.16, 0, Math.PI * 2);
                ctx.fill();
            }

            if (board[i] === FICHA) {
                var grad = gMemo('peg' + (i === sel ? 'S' : ''), function () {
                    var g = ctx.createRadialGradient(-s * 0.12, -s * 0.14, s * 0.04, 0, 0, s * 0.34);
                    if (i === sel) {
                        g.addColorStop(0, '#fff3c4'); g.addColorStop(0.55, '#ffd54a'); g.addColorStop(1, '#b8860b');
                    } else {
                        g.addColorStop(0, '#eaf3ff'); g.addColorStop(0.55, '#8fd3f4'); g.addColorStop(1, '#2b6ea8');
                    }
                    return g;
                }, [s, i === sel]);
                /* Gradiente construido en el origen y trasladado: si no, sería
                 * uno por ficha y por frame, hasta 32 por frame. */
                ctx.save();
                ctx.translate(x, y);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    fx.draw(ctx);

    var tg = cursor.target();
    if (tg) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tg.x + tg.w / 2, tg.y + tg.h / 2, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, H - 46);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'SENKU',
            lines: ['Salta una ficha sobre otra y cómetela',
                    'Termina con una sola. Pulsa Iniciar'],
            bg: 'rgba(26,18,9,0.86)',
            color: '#ffd54a',
            lineColor: '#e8d8b8'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function cellAt(x, y) {
    var s = cellSize();
    var c = Math.floor((x - boardX()) / s);
    var r = Math.floor((y - boardY()) / s);
    if (!isCell(r, c)) return -1;
    return idx(r, c);
}

function handleAt(x, y) {
    if (status !== 'playing') return;
    var i = cellAt(x, y);
    if (i < 0) return;
    var r = (i / SIZE) | 0, c = i % SIZE;

    if (board[i] === FICHA) {
        /* Tocar una ficha sin saltos posibles no la selecciona: dejarla marcada
         * hace creer que el problema es el destino. */
        if (!jumpsFrom(r, c).length) {
            msg.show('Esa ficha no puede saltar', 1.2);
            GameAudio.hit();
        } else {
            sel = (sel === i) ? -1 : i;
            GameAudio.click();
        }
        view.invalidate();
        return;
    }

    if (sel >= 0 && board[i] === HUECO) {
        var jumps = jumpsFrom((sel / SIZE) | 0, sel % SIZE);
        for (var k = 0; k < jumps.length; k++) {
            if (jumps[k].to === i) { doJump(jumps[k]); view.invalidate(); return; }
        }
        msg.show('Desde ahí no se salta a ese hueco', 1.2);
        GameAudio.hit();
        view.invalidate();
    }
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

/* Al teclado se le ofrecen sólo las casillas que sirven ahora mismo: con una
 * ficha elegida, sus destinos; sin nada elegido, las fichas que pueden saltar.
 * Pasear por las 33 casillas multiplica los pasos sin llevar a ninguna parte. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de senku. Flechas para moverte, Enter para elegir.',
    targets: function () {
        if (status !== 'playing') return [];
        var s = cellSize(), out = [];
        function push(i) {
            var r = (i / SIZE) | 0, c = i % SIZE;
            out.push({ x: cx(c) - s * 0.32, y: cy(r) - s * 0.32, w: s * 0.64, h: s * 0.64, id: 'p' + i });
        }
        if (sel >= 0) {
            push(sel);
            var js = jumpsFrom((sel / SIZE) | 0, sel % SIZE);
            for (var k = 0; k < js.length; k++) push(js[k].to);
        } else {
            for (var r = 0; r < SIZE; r++) {
                for (var c = 0; c < SIZE; c++) {
                    if (jumpsFrom(r, c).length) push(idx(r, c));
                }
            }
        }
        return out;
    },
    activate: function (t) {
        var i = parseInt(t.id.slice(1), 10);
        handleAt(cx(i % SIZE), cy((i / SIZE) | 0));
    },
    onChange: function () { view.invalidate(); }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'Z') { undo(); e.preventDefault(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    msg.update(dt);
    draw();
    return fx.count > 0 || msg.active();
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

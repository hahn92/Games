/* Gato Supremo — tres en raya dentro de tres en raya.
 *
 * Nueve tableros pequeños dentro de uno grande. Ganar un pequeño te da esa
 * casilla del grande, y se gana con tres en raya en el grande.
 *
 * La regla que lo convierte en un juego de verdad: **la casilla que eliges manda
 * al rival al tablero correspondiente**. Si juegas en la esquina superior
 * derecha de tu tablero, el rival juega en el tablero de la esquina superior
 * derecha. Si ese tablero ya está decidido o lleno, juega donde quiera.
 *
 * Consecuencias en el código:
 *
 * - **El estado no es sólo el tablero: incluye a dónde está obligado el que
 *   mueve.** Sin ese dato la posición no está definida y la búsqueda evalúa
 *   posiciones que no existen. Va en `forced`.
 * - **Un tablero pequeño empatado no cuenta para nadie**, pero sí queda cerrado.
 *   Tratarlo como "libre" deja jugar en él para siempre.
 * - El evaluador puntúa por tableros ganados, con el centro y las esquinas
 *   pesando más —igual que en el tres en raya normal— y **castiga mandar al
 *   rival a un tablero libre**, que es el error caro de este juego: regalar la
 *   elección vale más que casi cualquier casilla.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var YOU = 1, AI = 2;
var TOP = 46;
var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
var WEIGHT = [3, 2, 3, 2, 4, 2, 3, 2, 3];      // esquinas y centro valen más

var gs = null;
var turn = YOU;
var status = 'idle';
var thinking = false;
var wins = GameStore.getNum('gatosupremoWins', 0);
var lastMove = -1;

var fx = new Particles(200);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    you:  'youLabel',
    ai:   'aiLabel',
    wins: 'winsLabel',
    mobile: { el: 'mobileScore', format: function (v) {
        return 'Tableros — tú ' + v.you + '  ·  máquina ' + v.ai;
    } }
});

var over = GU.popup('overPopup');

/* ── Estado ───────────────────────────────────────────────────────── */

function newState() {
    return {
        cells: new Uint8Array(81),      // 9 tableros × 9 casillas
        boards: new Uint8Array(9),      // 0 libre, 1 YOU, 2 AI, 3 empatado
        forced: -1                      // tablero obligado, o -1
    };
}

function cloneState(s) {
    return { cells: s.cells.slice(), boards: s.boards.slice(), forced: s.forced };
}

function winnerOf(arr, base) {
    for (var i = 0; i < LINES.length; i++) {
        var a = arr[base + LINES[i][0]], b = arr[base + LINES[i][1]], c = arr[base + LINES[i][2]];
        if (a && a === b && a === c) return a;
    }
    return 0;
}

function boardFull(s, b) {
    for (var i = 0; i < 9; i++) if (!s.cells[b * 9 + i]) return false;
    return true;
}

function legalMoves(s) {
    var out = [];
    for (var b = 0; b < 9; b++) {
        if (s.boards[b]) continue;                       // decidido o empatado
        if (s.forced >= 0 && b !== s.forced) continue;
        for (var i = 0; i < 9; i++) {
            if (!s.cells[b * 9 + i]) out.push(b * 9 + i);
        }
    }
    return out;
}

function place(s, mv, who) {
    s.cells[mv] = who;
    var b = (mv / 9) | 0, i = mv % 9;
    if (!s.boards[b]) {
        var w = winnerOf(s.cells, b * 9);
        if (w) s.boards[b] = w;
        else if (boardFull(s, b)) s.boards[b] = 3;       // empatado: cerrado, de nadie
    }
    /* La casilla jugada manda al rival a ESE tablero, salvo que ya esté cerrado
     * o lleno: entonces juega libre. */
    s.forced = (s.boards[i] || boardFull(s, i)) ? -1 : i;
    return s;
}

function bigWinner(s) {
    /* Sólo cuentan los ganados: un 3 (empate) no es de nadie y no puede formar
     * línea, así que se filtra antes de mirar. */
    var arr = new Uint8Array(9);
    for (var i = 0; i < 9; i++) arr[i] = s.boards[i] === 3 ? 0 : s.boards[i];
    return winnerOf(arr, 0);
}

function gameOver(s) {
    return bigWinner(s) !== 0 || legalMoves(s).length === 0;
}

/* ── IA ───────────────────────────────────────────────────────────── */

var ai = GU.minimax({
    moves: function (s) { return legalMoves(s); },
    apply: function (s, mv, side) {
        var ns = place(cloneState(s), mv, side);
        return { state: ns, side: side === AI ? YOU : AI };
    },
    isOver: gameOver,
    evaluate: function (s, maxSide, depth) {
        var opp = maxSide === AI ? YOU : AI;
        var big = bigWinner(s);
        if (big === maxSide) return 100000 + depth;
        if (big === opp) return -100000 - depth;

        var score = 0, i;
        for (i = 0; i < 9; i++) {
            if (s.boards[i] === maxSide) score += 25 * WEIGHT[i];
            else if (s.boards[i] === opp) score -= 25 * WEIGHT[i];
        }
        /* Líneas del tablero grande a medio hacer. */
        for (i = 0; i < LINES.length; i++) {
            var mine = 0, theirs = 0;
            for (var k = 0; k < 3; k++) {
                var v = s.boards[LINES[i][k]];
                if (v === maxSide) mine++;
                else if (v === opp) theirs++;
            }
            if (mine && !theirs) score += mine * mine * 12;
            if (theirs && !mine) score -= theirs * theirs * 12;
        }
        /* Casillas centrales de cada tablero pequeño. */
        for (i = 0; i < 9; i++) {
            if (s.boards[i]) continue;
            var c = s.cells[i * 9 + 4];
            if (c === maxSide) score += 3;
            else if (c === opp) score -= 3;
        }
        /* Mandar al rival a un tablero libre es regalarle la elección: es el
         * error caro de este juego y tiene que doler en la evaluación. */
        if (s.forced === -1) score -= 18;
        return score;
    },
    order: function (moves, s) {
        /* Primero las que ganan un tablero pequeño y las que no dejan libre al
         * rival: son las candidatas buenas, así que la poda corta antes. */
        return moves.slice().sort(function (a, b) { return rank(s, b) - rank(s, a); });
    }
});

function rank(s, mv) {
    var b = (mv / 9) | 0, i = mv % 9;
    var t = cloneState(s);
    t.cells[mv] = AI;
    var r = 0;
    if (winnerOf(t.cells, b * 9) === AI) r += 40 * WEIGHT[b];
    if (!(t.boards[i] || boardFull(t, i))) r += 8;     // no le deja elegir
    r += WEIGHT[i];
    return r;
}

function aiDepth() {
    var free = legalMoves(gs).length;
    /* El factor de ramificación aquí es el número de casillas libres del
     * tablero obligado —casi siempre pocas—, pero cuando el rival queda libre
     * son hasta 81. La profundidad se ajusta a eso, no al total de jugadas. */
    if (free <= 6) return 7;
    if (free <= 12) return 5;
    if (free <= 30) return 4;
    return 3;
}

function aiTurn() {
    if (status !== 'playing' || turn !== AI) return;
    var res = ai.best(gs, AI, aiDepth());
    thinking = false;
    if (res.move == null) { finish(); view.invalidate(); return; }
    apply(res.move, AI);
    view.invalidate();
}

/* ── Partida ──────────────────────────────────────────────────────── */

function newGame() {
    gs = newState();
    turn = YOU;
    status = 'playing';
    thinking = false;
    lastMove = -1;
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function apply(mv, who) {
    var b = (mv / 9) | 0;
    var before = gs.boards[b];
    place(gs, mv, who);
    lastMove = mv;
    GameAudio.click();

    if (!before && gs.boards[b] && gs.boards[b] !== 3) {
        var p = smallCenter(b);
        fx.burst(p.x, p.y, 18, {
            color: gs.boards[b] === YOU ? '#8fd3f4' : '#ff8a3d',
            speed: 110, life: 0.8, size: 3
        });
        GameAudio.score();
        msg.show(gs.boards[b] === YOU ? 'Tablero tuyo' : 'Tablero de la máquina', 1);
    }
    syncHud();

    if (gameOver(gs)) { finish(); return; }
    turn = who === YOU ? AI : YOU;
    if (turn === AI) {
        thinking = true;
        setTimeout(function () { aiTurn(); view.invalidate(); }, 320);
    }
}

function humanMove(mv) {
    if (status !== 'playing' || turn !== YOU || thinking) return;
    if (legalMoves(gs).indexOf(mv) < 0) {
        msg.show(gs.forced >= 0 ? 'Te toca en el tablero resaltado' : 'Ahí no se puede', 1.2);
        GameAudio.hit();
        view.invalidate();
        return;
    }
    apply(mv, YOU);
    view.invalidate();
}

function counts() {
    var y = 0, a = 0;
    if (!gs) return { you: 0, ai: 0 };
    for (var i = 0; i < 9; i++) {
        if (gs.boards[i] === YOU) y++;
        else if (gs.boards[i] === AI) a++;
    }
    return { you: y, ai: a };
}

function finish() {
    status = 'over';
    var w = bigWinner(gs);
    var c = counts();
    if (w === YOU) {
        wins++;
        GameStore.setNum('gatosupremoWins', wins);
        GameAudio.win();
        for (var k = 0; k < 26; k++) {
            fx.burst(GU.rand(20, W - 20), GU.rand(TOP, H - 20), 2,
                     { color: GU.pick(['#8fd3f4', '#ffd54a']), speed: 120, life: 1, size: 3, gravity: 120 });
        }
    } else {
        GameAudio.gameOver();
    }
    gameControls.idle();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: w === YOU ? '¡Ganas tú!' : (w === AI ? 'Gana la máquina' : 'Empate'),
            overScore: 'Tableros ganados: ' + c.you + ' - ' + c.ai,
            overRecord: 'Partidas ganadas: ' + wins
        });
    }, 650);
}

function syncHud() {
    var c = counts();
    hud.set({ you: c.you, ai: c.ai, wins: wins });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function bigSize() { return Math.min(W - 24, H - TOP - 30); }
function bigX() { return (W - bigSize()) / 2; }
function smallSize() { return bigSize() / 3; }
function cellSize() { return smallSize() / 3; }

function cellRect(mv) {
    var b = (mv / 9) | 0, i = mv % 9;
    var bx = bigX() + (b % 3) * smallSize();
    var by = TOP + ((b / 3) | 0) * smallSize();
    return {
        x: bx + (i % 3) * cellSize() + 3,
        y: by + ((i / 3) | 0) * cellSize() + 3,
        w: cellSize() - 6,
        h: cellSize() - 6
    };
}

function smallCenter(b) {
    return {
        x: bigX() + (b % 3) * smallSize() + smallSize() / 2,
        y: TOP + ((b / 3) | 0) * smallSize() + smallSize() / 2
    };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function drawMark(x, y, r, who) {
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.lineCap = 'round';
    if (who === YOU) {
        ctx.strokeStyle = '#8fd3f4';
        ctx.beginPath();
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
        ctx.stroke();
    } else {
        ctx.strokeStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1a2340');
        g.addColorStop(1, '#080d18');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    if (gs) {
        var ss = smallSize(), cz = cellSize();
        var legal = status === 'playing' && turn === YOU ? legalMoves(gs) : [];
        var legalBoards = {};
        for (var l = 0; l < legal.length; l++) legalBoards[(legal[l] / 9) | 0] = true;

        for (var b = 0; b < 9; b++) {
            var bx = bigX() + (b % 3) * ss, by = TOP + ((b / 3) | 0) * ss;

            /* El tablero donde toca jugar va resaltado: sin eso la regla del
             * juego es invisible y hay que deducirla de la última jugada. */
            if (legalBoards[b]) {
                ctx.fillStyle = 'rgba(143,211,244,0.10)';
                ctx.fillRect(bx, by, ss, ss);
            }
            if (gs.boards[b] === YOU) ctx.fillStyle = 'rgba(143,211,244,0.16)';
            else if (gs.boards[b] === AI) ctx.fillStyle = 'rgba(255,138,61,0.16)';
            else if (gs.boards[b] === 3) ctx.fillStyle = 'rgba(120,130,150,0.14)';
            else ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(bx, by, ss, ss);

            // rejilla interna
            ctx.strokeStyle = 'rgba(180,200,225,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var g2 = 1; g2 < 3; g2++) {
                ctx.moveTo(bx + g2 * cz, by + 5); ctx.lineTo(bx + g2 * cz, by + ss - 5);
                ctx.moveTo(bx + 5, by + g2 * cz); ctx.lineTo(bx + ss - 5, by + g2 * cz);
            }
            ctx.stroke();

            for (var i = 0; i < 9; i++) {
                var v = gs.cells[b * 9 + i];
                if (!v) continue;
                var r = cellRect(b * 9 + i);
                drawMark(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.3, v);
            }

            // marca grande del tablero ganado, encima de las casillas
            if (gs.boards[b] && gs.boards[b] !== 3) {
                var c = smallCenter(b);
                ctx.globalAlpha = 0.85;
                drawMark(c.x, c.y, ss * 0.3, gs.boards[b]);
                ctx.globalAlpha = 1;
            }
        }

        // rejilla grande, por encima
        ctx.strokeStyle = '#8fd3f4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (var k = 1; k < 3; k++) {
            ctx.moveTo(bigX() + k * ss, TOP); ctx.lineTo(bigX() + k * ss, TOP + bigSize());
            ctx.moveTo(bigX(), TOP + k * ss); ctx.lineTo(bigX() + bigSize(), TOP + k * ss);
        }
        ctx.stroke();

        // última jugada
        if (lastMove >= 0) {
            var lr = cellRect(lastMove);
            ctx.strokeStyle = '#ffd54a';
            ctx.lineWidth = 2;
            ctx.strokeRect(lr.x, lr.y, lr.w, lr.h);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 17px Arial';
        ctx.fillStyle = turn === YOU ? '#8fd3f4' : '#ff8a3d';
        ctx.fillText(status === 'over' ? 'Fin'
                   : (turn === YOU
                      ? (gs.forced >= 0 ? 'Te toca en el tablero resaltado' : 'Te toca: elige tablero')
                      : 'Piensa la máquina'),
                     W / 2, TOP / 2);
    }

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
    }

    msg.draw(ctx, W / 2, H - 16);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'GATO SUPREMO',
            lines: ['Tu jugada decide dónde juega el rival',
                    'Pulsa Iniciar'],
            bg: 'rgba(8,13,24,0.86)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (status !== 'playing') return;
    for (var mv = 0; mv < 81; mv++) {
        var r = cellRect(mv);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { humanMove(mv); return; }
    }
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Gato supremo. Flechas para moverte, Enter para jugar.',
    targets: function () {
        if (status !== 'playing' || turn !== YOU) return [];
        return legalMoves(gs).map(function (mv) {
            var r = cellRect(mv);
            return { x: r.x, y: r.y, w: r.w, h: r.h, id: 'm' + mv, mv: mv };
        });
    },
    activate: function (t) { humanMove(t.mv); },
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

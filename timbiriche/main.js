/* Timbiriche (Dots and Boxes) — 4×4 cuadros, contra la máquina.
 *
 * Cada turno se traza una línea entre dos puntos contiguos. Quien cierra el
 * cuarto lado de un cuadro se lo queda y VUELVE A JUGAR.
 *
 * Lo que hay que entender de este juego, y que la IA tiene que saber:
 *
 * - **El turno extra es el juego.** Al final de la partida el tablero queda
 *   partido en cadenas de cuadros, y quien se ve obligado a abrir la primera
 *   se la regala entera al rival. Por eso la decisión difícil no es cerrar,
 *   es cuándo entregar y cuál cadena.
 * - Eso se traduce en el motor de búsqueda de una forma muy concreta: `apply`
 *   devuelve **a quién le toca**, y devuelve el mismo lado cuando la jugada ha
 *   cerrado cuadro. Una IA que alterne el turno a ciegas no ve las cadenas —
 *   es el mismo fallo que en mancala.
 * - **La profundidad se sube al final.** Con 40 líneas libres el árbol es
 *   impracticable y da igual, porque casi ninguna jugada temprana es mala; con
 *   pocas líneas es cuando se decide la partida y ahí se busca hondo.
 * - El orden de jugadas prueba primero las que cierran cuadro. No cambia el
 *   resultado de la búsqueda, sólo lo que cuesta llegar a él.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var N = 4;                       // cuadros por lado
var DOTS = N + 1;
var HN = DOTS * N;               // líneas horizontales: (N+1) filas × N
var VN = N * DOTS;               // líneas verticales:   N filas × (N+1)

var YOU = 0, AI = 1;
var gs = null;
var turn = YOU;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';             // idle | playing | over
var wins = GameStore.getNum('timbiricheWins', 0);
var thinking = false;

var fx = new Particles(180);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    you:  'youLabel',
    ai:   'aiLabel',
    wins: 'winsLabel',
    mobile: { el: 'mobileScore', format: function (v) {
        return 'Tú ' + v.you + '  -  ' + v.ai + ' máquina';
    } }
});

var over = GU.popup('overPopup');

/* ── Estado ───────────────────────────────────────────────────────────
 * h[r * N + c]  línea horizontal bajo el punto (r, c) → (r, c+1)
 * v[r * DOTS + c] línea vertical de (r, c) → (r+1, c)
 * owner[r * N + c] dueño del cuadro, o -1
 * Una jugada es {t: 'h'|'v', i: índice}: un solo entero por línea, así que
 * copiar el estado en la búsqueda es copiar tres arrays cortos. */
function newState() {
    return {
        h: new Uint8Array(HN),
        v: new Uint8Array(VN),
        owner: new Int8Array(N * N).fill(-1),
        score: [0, 0]
    };
}

function cloneState(s) {
    return {
        h: s.h.slice(), v: s.v.slice(), owner: s.owner.slice(),
        score: [s.score[0], s.score[1]]
    };
}

function sidesOf(s, r, c) {
    return (s.h[r * N + c] ? 1 : 0) +
           (s.h[(r + 1) * N + c] ? 1 : 0) +
           (s.v[r * DOTS + c] ? 1 : 0) +
           (s.v[r * DOTS + c + 1] ? 1 : 0);
}

function legalMoves(s) {
    var out = [];
    for (var i = 0; i < HN; i++) if (!s.h[i]) out.push({ t: 'h', i: i });
    for (var j = 0; j < VN; j++) if (!s.v[j]) out.push({ t: 'v', i: j });
    return out;
}

/* Traza la línea y cierra los cuadros que complete. Devuelve cuántos ha
 * cerrado, que es lo que decide si se repite turno. */
function place(s, mv, who) {
    if (mv.t === 'h') s.h[mv.i] = 1; else s.v[mv.i] = 1;
    var closed = 0;
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            if (s.owner[r * N + c] >= 0) continue;
            if (sidesOf(s, r, c) === 4) {
                s.owner[r * N + c] = who;
                s.score[who]++;
                closed++;
            }
        }
    }
    return closed;
}

function boardFull(s) {
    for (var i = 0; i < HN; i++) if (!s.h[i]) return false;
    for (var j = 0; j < VN; j++) if (!s.v[j]) return false;
    return true;
}

/* ── IA ───────────────────────────────────────────────────────────── */

var ai = GU.minimax({
    moves: function (s) { return legalMoves(s); },
    apply: function (s, mv, side) {
        var ns = cloneState(s);
        var closed = place(ns, mv, side);
        /* Cerrar cuadro REPITE turno: devolver el mismo lado es lo que hace que
         * la búsqueda vea las cadenas en vez de una jugada suelta. */
        return { state: ns, side: closed > 0 ? side : (side === AI ? YOU : AI) };
    },
    isOver: function (s) { return boardFull(s); },
    evaluate: function (s, maxSide, depth) {
        var mine = s.score[maxSide], theirs = s.score[1 - maxSide];
        if (boardFull(s)) {
            if (mine > theirs) return 1000 + depth;
            if (mine < theirs) return -1000 - depth;
            return 0;
        }
        /* Diferencia de cuadros, y un castigo por los cuadros que quedan a un
         * solo lado de cerrarse: son los que el rival se lleva gratis en cuanto
         * le toque. Sin ese término la IA regala cadenas sin verlo. */
        var loose = 0;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                if (s.owner[r * N + c] < 0 && sidesOf(s, r, c) === 3) loose++;
            }
        }
        return (mine - theirs) * 10 - loose * 2;
    },
    order: function (moves, s, side) {
        /* Primero las que cierran cuadro, después las que no dan el tercer lado
         * a ninguno. Es el orden que más poda: la mejor jugada suele ser una de
         * las primeras. */
        return moves.slice().sort(function (a, b) {
            return rank(s, b) - rank(s, a);
        });
    }
});

function rank(s, mv) {
    var t = cloneState(s);
    var closed = place(t, mv, 0);
    if (closed) return 100 + closed;
    var loose = 0;
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            if (t.owner[r * N + c] < 0 && sidesOf(t, r, c) === 3) loose++;
        }
    }
    return -loose;
}

function aiDepth() {
    var free = legalMoves(gs).length;
    /* Con el tablero abierto casi ninguna jugada es mala y el árbol es enorme;
     * al final es cuando se gana o se pierde. Medido: el peor turno baja de
     * varios segundos a decenas de ms. */
    if (free <= 10) return 12;
    if (free <= 16) return 8;
    if (free <= 24) return 6;
    return 4;
}

function aiTurn() {
    if (gamePhase !== 'playing' || turn !== AI) return;
    var res = ai.best(gs, AI, aiDepth());
    thinking = false;
    if (!res.move) { finish(); view.invalidate(); return; }
    var closed = place(gs, res.move, AI);
    GameAudio[closed ? 'score' : 'click']();
    if (closed) celebrate(AI);
    syncHud();

    if (boardFull(gs)) { finish(); }
    else if (closed) {
        msg.show('La máquina repite', 0.9);
        thinking = true;
        setTimeout(function () { aiTurn(); view.invalidate(); }, 420);
    } else {
        turn = YOU;
    }
    view.invalidate();
}

/* ── Partida ──────────────────────────────────────────────────────── */

function newGame() {
    gs = newState();
    turn = YOU;
    gamePhase = 'playing';
    thinking = false;
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function celebrate(who) {
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            if (gs.owner[r * N + c] !== who) continue;
            if (Math.random() > 0.5) continue;
            fx.burst(px(c) + step() / 2, py(r) + step() / 2, 4, {
                color: who === YOU ? '#8fd3f4' : '#ff8a3d',
                speed: 70, life: 0.6, size: 3
            });
        }
    }
}

function humanMove(mv) {
    if (gamePhase !== 'playing' || turn !== YOU || thinking) return;
    var closed = place(gs, mv, YOU);
    GameAudio[closed ? 'score' : 'click']();
    if (closed) celebrate(YOU);
    syncHud();

    if (boardFull(gs)) { finish(); }
    else if (closed) {
        msg.show('¡Otra vez!', 0.8);
    } else {
        turn = AI;
        thinking = true;
        setTimeout(function () { aiTurn(); view.invalidate(); }, 380);
    }
    view.invalidate();
}

function finish() {
    gamePhase = 'over';
    var y = gs.score[YOU], a = gs.score[AI];
    if (y > a) {
        wins++;
        GameStore.setNum('timbiricheWins', wins);
        GameAudio.win();
    } else {
        GameAudio.gameOver();
    }
    gameControls.idle();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: y > a ? '¡Ganas tú!' : (y < a ? 'Gana la máquina' : 'Empate'),
            overScore: y + ' cuadros contra ' + a,
            overRecord: 'Partidas ganadas: ' + wins
        });
    }, 600);
}

function syncHud() {
    hud.set({ you: gs ? gs.score[YOU] : 0, ai: gs ? gs.score[AI] : 0, wins: wins });
}

/* ── Geometría ────────────────────────────────────────────────────── */

/* -190 en vertical y no -130: el tablero tiene que dejar sitio abajo para el
 * marcador Y para la línea de aviso, que si no se pintan una encima de otra. */
function step() { return Math.min(W - 80, H - 190) / N; }
function originX() { return (W - step() * N) / 2; }
function originY() { return 54; }
function px(c) { return originX() + c * step(); }
function py(r) { return originY() + r * step(); }

/* Rectángulo sensible de cada línea, también usado por el cursor de teclado. */
function moveRect(mv) {
    var s = step(), grab = Math.min(22, s * 0.34);
    if (mv.t === 'h') {
        var r = (mv.i / N) | 0, c = mv.i % N;
        return { x: px(c) + 6, y: py(r) - grab / 2, w: s - 12, h: grab };
    }
    var rr = (mv.i / DOTS) | 0, cc = mv.i % DOTS;
    return { x: px(cc) - grab / 2, y: py(rr) + 6, w: grab, h: s - 12 };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#16233c');
        g.addColorStop(1, '#080d18');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    if (gs) {
        var s = step();

        // cuadros ganados
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                var o = gs.owner[r * N + c];
                if (o < 0) continue;
                ctx.fillStyle = o === YOU ? 'rgba(143,211,244,0.28)' : 'rgba(255,138,61,0.28)';
                ctx.fillRect(px(c), py(r), s, s);
                ctx.fillStyle = o === YOU ? '#8fd3f4' : '#ff8a3d';
                ctx.font = 'bold ' + Math.round(s * 0.42) + 'px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(o === YOU ? 'T' : 'M', px(c) + s / 2, py(r) + s / 2 + 1);
            }
        }

        // líneas trazadas
        ctx.lineCap = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#dfe9f6';
        ctx.beginPath();
        for (var i = 0; i < HN; i++) {
            if (!gs.h[i]) continue;
            var hr = (i / N) | 0, hc = i % N;
            ctx.moveTo(px(hc), py(hr)); ctx.lineTo(px(hc + 1), py(hr));
        }
        for (var j = 0; j < VN; j++) {
            if (!gs.v[j]) continue;
            var vr = (j / DOTS) | 0, vc = j % DOTS;
            ctx.moveTo(px(vc), py(vr)); ctx.lineTo(px(vc), py(vr + 1));
        }
        ctx.stroke();

        // puntos, encima de las líneas
        ctx.fillStyle = '#ffd54a';
        for (var a = 0; a < DOTS; a++) {
            for (var b = 0; b < DOTS; b++) {
                ctx.beginPath();
                ctx.arc(px(b), py(a), 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // marcador y turno
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 17px Arial';
        ctx.fillStyle = turn === YOU ? '#8fd3f4' : '#ff8a3d';
        ctx.fillText(gamePhase === 'over' ? 'Fin' : (turn === YOU ? 'Te toca' : 'Piensa la máquina'),
                     W / 2, 26);

        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText('Tú ' + gs.score[YOU], W * 0.28, H - 34);
        ctx.fillStyle = '#ff8a3d';
        ctx.fillText(gs.score[AI] + ' Máquina', W * 0.72, H - 34);
    }

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 6);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, H - 70);

    if (gamePhase === 'idle') {
        GU.idleScreen(ctx, {
            title: 'TIMBIRICHE',
            lines: ['Cierra cuadros: quien cierra, repite turno',
                    'Pulsa Iniciar'],
            bg: 'rgba(8,13,24,0.85)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

/* Se elige la línea libre cuyo centro cae más cerca del toque, no la que
 * contiene el punto: entre dos líneas los rectángulos sensibles dejan huecos, y
 * en un móvil eso son toques que no hacen nada. */
function handleAt(x, y) {
    if (gamePhase !== 'playing' || turn !== YOU || thinking) return;
    var moves = legalMoves(gs);
    var best = null, bestD = Infinity;
    for (var k = 0; k < moves.length; k++) {
        var r = moveRect(moves[k]);
        var d = GU.dist2(x, y, r.x + r.w / 2, r.y + r.h / 2);
        if (d < bestD) { bestD = d; best = moves[k]; }
    }
    var lim = step() * 0.5;
    if (best && bestD <= lim * lim) humanMove(best);
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de timbiriche. Flechas para moverte, Enter para trazar la línea.',
    targets: function () {
        if (gamePhase !== 'playing' || turn !== YOU) return [];
        return legalMoves(gs).map(function (mv) {
            var r = moveRect(mv);
            return { x: r.x, y: r.y, w: r.w, h: r.h, id: mv.t + mv.i, mv: mv };
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

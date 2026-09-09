/* Backgammon — quince fichas por bando, dos dados y el recorrido de siempre.
 *
 * Representación: `board[0..23]` con un entero por punta. Positivo son fichas
 * tuyas, negativo de la máquina, y el valor absoluto cuántas hay. Un solo array
 * de 24 enteros describe la posición entera, así que copiarlo para probar una
 * jugada es trivial y no hay dos estructuras que se puedan desincronizar.
 *
 * Tú vas de la punta 23 hacia la 0 y tu casa son las puntas 0-5; la máquina va
 * al revés y la suya son las 18-23. Con esa convención "avanzar" es restar para
 * ti y sumar para ella, y las dos direcciones caben en la misma función.
 *
 * Las reglas que se implementan mal, y que aquí están:
 *
 * - **Con una ficha en la barra no se puede mover nada más.** Es lo primero que
 *   comprueba el generador de jugadas, no un caso especial añadido después.
 * - **Una punta con dos o más fichas rivales está cerrada**; con exactamente una
 *   se come, y esa ficha va a la barra. Con cero o propias, libre.
 * - **Los dobles se juegan cuatro veces**, no dos.
 * - **Sacar fichas exige tener las quince en casa**, y con un dado mayor que la
 *   distancia sólo se puede sacar si no queda ninguna ficha más atrás. Sin esa
 *   segunda condición se sacan fichas que aún no tocaban.
 * - **Si sólo se puede jugar uno de los dos dados, hay que jugar el mayor.** Es
 *   la regla que casi nadie implementa; se resuelve probando las dos secuencias
 *   antes de dejar elegir.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var YOU = 1, AI = -1;
var BAR = 24, OFF = 25;

var board = [];
var bar = { 1: 0, '-1': 0 };
var off = { 1: 0, '-1': 0 };
var dice = [];              // dados sin usar
var turn = YOU;
var sel = -1;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';        // idle | rolling | moving | over
var wins = GameStore.getNum('backgammonWins', 0);
var dieAnim = 0;
var animDice = [];

var fx = new Particles(200);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    you:  'youLabel',
    ai:   'aiLabel',
    wins: 'winsLabel',
    mobile: { el: 'mobileScore', format: function (v) {
        return 'Sacadas — tú ' + v.you + '  ·  máquina ' + v.ai;
    } }
});

var over = GU.popup('overPopup');

/* ── Posición inicial ─────────────────────────────────────────────── */

function setup() {
    board = new Array(24).fill(0);
    board[23] = 2;  board[12] = 5;  board[7] = 3;  board[5] = 5;      // tuyas
    board[0] = -2;  board[11] = -5; board[16] = -3; board[18] = -5;   // de la máquina
    bar = { 1: 0, '-1': 0 };
    off = { 1: 0, '-1': 0 };
}

function dirOf(who) { return who === YOU ? -1 : 1; }
function homeStart(who) { return who === YOU ? 0 : 18; }
function entryPoint(who, die) { return who === YOU ? 24 - die : die - 1; }

function ownsPoint(p, who) { return who === YOU ? board[p] > 0 : board[p] < 0; }
function blocked(p, who) {
    var v = board[p];
    return who === YOU ? v <= -2 : v >= 2;
}
function isBlot(p, who) {      // una sola ficha rival: comible
    var v = board[p];
    return who === YOU ? v === -1 : v === 1;
}

function allHome(who) {
    if (bar[who]) return false;
    for (var p = 0; p < 24; p++) {
        if (!ownsPoint(p, who)) continue;
        if (who === YOU && p > 5) return false;
        if (who === AI && p < 18) return false;
    }
    return true;
}

/* ¿Queda alguna ficha más atrás que `p` (hacia la entrada)? Es lo que decide si
 * un dado mayor que la distancia sirve para sacar. */
function anyBehind(who, p) {
    if (who === YOU) {
        for (var i = p + 1; i <= 5; i++) if (board[i] > 0) return true;
    } else {
        for (var j = 18; j < p; j++) if (board[j] < 0) return true;
    }
    return false;
}

/* ── Jugadas legales ──────────────────────────────────────────────── */

/* Devuelve la lista de {from, to, die}. `from` puede ser BAR y `to` puede ser
 * OFF. Con ficha en la barra sólo se ofrecen las reentradas: es lo primero, no
 * un caso añadido luego. */
function legalMoves(who, avail) {
    var out = [], i, d;
    var seen = {};

    if (bar[who] > 0) {
        for (i = 0; i < avail.length; i++) {
            d = avail[i];
            var e = entryPoint(who, d);
            if (blocked(e, who)) continue;
            var k = 'B' + e;
            if (seen[k]) continue;
            seen[k] = true;
            out.push({ from: BAR, to: e, die: d });
        }
        return out;
    }

    for (var p = 0; p < 24; p++) {
        if (!ownsPoint(p, who)) continue;
        for (i = 0; i < avail.length; i++) {
            d = avail[i];
            var t = p + dirOf(who) * d;
            if (t >= 0 && t < 24) {
                if (blocked(t, who)) continue;
                var key = p + '-' + t;
                if (seen[key]) continue;
                seen[key] = true;
                out.push({ from: p, to: t, die: d });
            } else if (allHome(who)) {
                /* Sacar: exacto siempre vale; pasarse sólo si no queda ninguna
                 * ficha más atrás dentro de la casa. */
                var dist = who === YOU ? p + 1 : 24 - p;
                if (d === dist || (d > dist && !anyBehind(who, p))) {
                    var k2 = p + '-off';
                    if (seen[k2]) continue;
                    seen[k2] = true;
                    out.push({ from: p, to: OFF, die: d });
                }
            }
        }
    }
    return out;
}

function applyMove(mv, who) {
    var hit = false;
    if (mv.from === BAR) bar[who]--;
    else board[mv.from] -= who;

    if (mv.to === OFF) {
        off[who]++;
    } else {
        if (isBlot(mv.to, who)) {
            board[mv.to] = 0;
            bar[-who]++;
            hit = true;
        }
        board[mv.to] += who;
    }
    return hit;
}

/* Cuántos dados se pueden llegar a jugar con esta mano. Es lo que permite
 * aplicar la regla del dado mayor sin casos especiales: se prueban las dos
 * secuencias y se descarta la que juegue menos. */
var mpBudget = 0;
function maxPlayable(who, avail) {
    if (!avail.length) return 0;
    /* Tope de nodos: con dobles son cuatro dados y el árbol de secuencias se
     * dispara. Quedarse corto sólo puede hacer que se permita una jugada que
     * desaprovecha un dado; colgar la pestaña es peor. */
    if (mpBudget-- <= 0) return avail.length;
    var moves = legalMoves(who, avail);
    if (!moves.length) return 0;
    var best = 0;
    for (var i = 0; i < moves.length; i++) {
        var snapshot = { b: board.slice(), bar: { 1: bar[1], '-1': bar['-1'] }, off: { 1: off[1], '-1': off['-1'] } };
        applyMove(moves[i], who);
        var rest = avail.slice();
        rest.splice(rest.indexOf(moves[i].die), 1);
        var n = 1 + maxPlayable(who, rest);
        board = snapshot.b; bar = snapshot.bar; off = snapshot.off;
        if (n > best) best = n;
        if (best === avail.length) break;
    }
    return best;
}

/* Filtra las jugadas que dejarían sin jugar más dados de los necesarios: es la
 * regla "si sólo puedes jugar uno, juega el mayor". */
function usableMoves(who) {
    var moves = legalMoves(who, dice);
    if (moves.length <= 1) return moves;
    mpBudget = 4000;
    var best = maxPlayable(who, dice);
    if (best <= 1) {
        /* Sólo se puede jugar un dado: hay que jugar el mayor de los posibles. */
        var mayor = -1;
        for (var i = 0; i < moves.length; i++) if (moves[i].die > mayor) mayor = moves[i].die;
        return moves.filter(function (m) { return m.die === mayor; });
    }
    return moves.filter(function (m) {
        var snapshot = { b: board.slice(), bar: { 1: bar[1], '-1': bar['-1'] }, off: { 1: off[1], '-1': off['-1'] } };
        applyMove(m, who);
        var rest = dice.slice();
        rest.splice(rest.indexOf(m.die), 1);
        var n = 1 + maxPlayable(who, rest);
        board = snapshot.b; bar = snapshot.bar; off = snapshot.off;
        return n >= best;
    });
}

/* ── Turnos ───────────────────────────────────────────────────────── */

function rollDice() {
    var a = GU.rollDie(6), b = GU.rollDie(6);
    /* Los dobles se juegan CUATRO veces. */
    dice = a === b ? [a, a, a, a] : [a, b];
    return [a, b];
}

function startTurn() {
    gamePhase = 'rolling';
    dieAnim = 0.45;
    view.invalidate();
    setTimeout(function () {
        rollDice();
        dieAnim = 0;
        gamePhase = 'moving';
        sel = -1;
        var moves = usableMoves(turn);
        if (!moves.length) {
            msg.show(turn === YOU ? 'No tienes jugada: pasas' : 'La máquina no puede mover', 1.4);
            setTimeout(endTurn, 900);
        } else if (turn === AI) {
            setTimeout(aiPlay, 420);
        }
        view.invalidate();
    }, 480);
}

function endTurn() {
    if (gamePhase === 'over') return;
    dice = [];
    sel = -1;
    turn = turn === YOU ? AI : YOU;
    startTurn();
}

function afterMove() {
    syncHud();
    if (off[YOU] === 15 || off[AI] === 15) { finish(); return; }
    if (!dice.length || !usableMoves(turn).length) {
        setTimeout(endTurn, turn === AI ? 400 : 250);
    } else if (turn === AI) {
        setTimeout(aiPlay, 380);
    }
}

/* IA por heurística: puntúa la posición resultante de cada jugada. No hay
 * búsqueda profunda porque con dos dados aleatorios el árbol se abre en 21
 * tiradas por nivel y no compensa; lo que sí decide partidas es no dejar fichas
 * solas y hacer puntas seguidas. */
function scorePosition(who) {
    var s = 0, p;
    s += off[who] * 60;
    s -= off[-who] * 60;
    s -= bar[who] * 45;
    s += bar[-who] * 45;
    for (p = 0; p < 24; p++) {
        var v = board[p];
        if (!v) continue;
        var mine = (v > 0 ? YOU : AI) === who;
        var n = Math.abs(v);
        /* Distancia al final: cuanto más avanzada, mejor. */
        var progress = who === YOU ? (24 - p) : (p + 1);
        var owner = v > 0 ? YOU : AI;
        var prog2 = owner === YOU ? (24 - p) : (p + 1);
        if (mine) {
            s += prog2 * 0.6;
            if (n === 1) s -= 22;                 // ficha sola: se la comen
            if (n >= 2) s += 14;                  // punta hecha
            if (n >= 2 && ((who === YOU && p <= 5) || (who === AI && p >= 18))) s += 8;
        } else {
            s -= prog2 * 0.6;
            if (n === 1) s += 16;                 // blot rival: objetivo
            if (n >= 2) s -= 10;
        }
    }
    return s;
}

function aiPlay() {
    if (gamePhase !== 'moving' || turn !== AI) return;
    var moves = usableMoves(AI);
    if (!moves.length) { endTurn(); return; }

    var best = null, bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
        var snapshot = { b: board.slice(), bar: { 1: bar[1], '-1': bar['-1'] }, off: { 1: off[1], '-1': off['-1'] } };
        applyMove(moves[i], AI);
        var sc = scorePosition(AI);
        board = snapshot.b; bar = snapshot.bar; off = snapshot.off;
        if (sc > bestScore) { bestScore = sc; best = moves[i]; }
    }
    doMove(best, AI);
}

function doMove(mv, who) {
    var hit = applyMove(mv, who);
    dice.splice(dice.indexOf(mv.die), 1);
    if (hit) {
        var p = pointPos(mv.to);
        fx.burst(p.x, p.y + p.dir * 30, 14,
                 { color: '#e94f4f', speed: 110, life: 0.7, size: 3, gravity: 90 });
        msg.show(who === YOU ? '¡Le comes una!' : 'Te come una', 1.2);
        GameAudio.explode();
    } else if (mv.to === OFF) {
        GameAudio.score();
    } else {
        GameAudio.place();
    }
    sel = -1;
    afterMove();
    view.invalidate();
}

function finish() {
    gamePhase = 'over';
    var youWin = off[YOU] === 15;
    if (youWin) {
        wins++;
        GameStore.setNum('backgammonWins', wins);
        GameAudio.win();
        for (var k = 0; k < 28; k++) {
            fx.burst(GU.rand(20, W - 20), GU.rand(20, H - 20), 2,
                     { color: GU.pick(['#ffd54a', '#8fd3f4']), speed: 120, life: 1, size: 3, gravity: 120 });
        }
    } else {
        GameAudio.gameOver();
    }
    gameControls.idle();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: youWin ? '¡Ganas la partida!' : 'Gana la máquina',
            overScore: 'Sacadas: ' + off[YOU] + ' contra ' + off[AI],
            overRecord: 'Partidas ganadas: ' + wins
        });
    }, 700);
}

function newGame() {
    setup();
    dice = [];
    sel = -1;
    turn = YOU;
    gamePhase = 'moving';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    startTurn();
}

function syncHud() {
    hud.set({ you: off[YOU], ai: off[AI], wins: wins });
}

/* ── Geometría ────────────────────────────────────────────────────── */

var BAR_W = 34, BEAR_W = 46;
function boardLeft() { return 8; }
function boardW() { return W - 16 - BEAR_W; }
function pointW() { return (boardW() - BAR_W) / 12; }
function checkerR() { return Math.min(pointW() * 0.42, 17); }

/* Punta → x en pantalla y sentido (arriba/abajo). Las 12 primeras van abajo, de
 * derecha a izquierda; las otras 12 arriba, de izquierda a derecha. Es el
 * recorrido en U del tablero real. */
function pointPos(p) {
    var pw = pointW();
    var half = p < 12 ? 0 : 1;
    var i = p < 12 ? p : p - 12;
    var x, dir, y;
    if (half === 0) {
        var col = 11 - i;
        x = boardLeft() + col * pw + (col >= 6 ? BAR_W : 0) + pw / 2;
        y = H - 14;
        dir = -1;
    } else {
        var col2 = i;
        x = boardLeft() + col2 * pw + (col2 >= 6 ? BAR_W : 0) + pw / 2;
        y = 14;
        dir = 1;
    }
    return { x: x, y: y, dir: dir };
}

function checkerPos(p, k) {
    var pos = pointPos(p);
    var r = checkerR();
    var step = Math.min(r * 2, (H / 2 - 30) / 5);
    return { x: pos.x, y: pos.y + pos.dir * (r + k * step) };
}

function barRect() {
    return { x: boardLeft() + 6 * pointW(), y: 0, w: BAR_W, h: H };
}
function bearRect() {
    return { x: W - BEAR_W - 4, y: 30, w: BEAR_W - 6, h: H - 60 };
}
function diceRect(i, n) {
    var s = 34;
    if (n == null) n = dice.length;
    return { x: W / 2 - BEAR_W / 2 + (i - n / 2) * (s + 8), y: H / 2 - s / 2, w: s, h: s };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#4a3018');
        g.addColorStop(1, '#2a1a0c');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var pw = pointW();

    // puntas
    for (var p = 0; p < 24; p++) {
        var pos = pointPos(p);
        ctx.fillStyle = p % 2 === 0 ? '#c9a06a' : '#8b5e34';
        ctx.beginPath();
        ctx.moveTo(pos.x - pw / 2 + 2, pos.y);
        ctx.lineTo(pos.x + pw / 2 - 2, pos.y);
        ctx.lineTo(pos.x, pos.y + pos.dir * (H / 2 - 34));
        ctx.closePath();
        ctx.fill();
    }

    // barra central
    var br = barRect();
    ctx.fillStyle = '#3a2415';
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.strokeStyle = '#1d1208';
    ctx.lineWidth = 2;
    ctx.strokeRect(br.x, br.y, br.w, br.h);

    // zona de sacadas
    var be = bearRect();
    ctx.fillStyle = 'rgba(20,12,6,0.6)';
    GU.roundRectPath(ctx, be.x, be.y, be.w, be.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // fichas
    for (var q = 0; q < 24; q++) {
        var n = Math.abs(board[q]);
        var who = board[q] > 0 ? YOU : AI;
        for (var k = 0; k < Math.min(n, 5); k++) {
            var c = checkerPos(q, k);
            drawChecker(c.x, c.y, who, q === sel && k === n - 1);
        }
        if (n > 5) {
            var c5 = checkerPos(q, 4);
            ctx.fillStyle = '#1d1208';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(n, c5.x, c5.y);
        }
    }

    // barra: fichas comidas
    [YOU, AI].forEach(function (w) {
        for (var i = 0; i < bar[w]; i++) {
            drawChecker(br.x + br.w / 2, H / 2 + (w === YOU ? 1 : -1) * (30 + i * 14), w,
                        sel === BAR && turn === w);
        }
    });

    // sacadas apiladas
    [YOU, AI].forEach(function (w) {
        for (var i = 0; i < off[w]; i++) {
            ctx.fillStyle = w === YOU ? '#8fd3f4' : '#e0e6ef';
            var y = w === YOU ? be.y + be.h - 8 - i * 7 : be.y + 8 + i * 7;
            ctx.fillRect(be.x + 5, y - 4, be.w - 10, 5);
        }
    });

    // destinos posibles de la ficha elegida
    if (gamePhase === 'moving' && turn === YOU && sel >= 0) {
        var moves = usableMoves(YOU).filter(function (m) { return m.from === sel; });
        for (var mi = 0; mi < moves.length; mi++) {
            var m = moves[mi];
            if (m.to === OFF) {
                ctx.strokeStyle = '#ffd54a';
                ctx.lineWidth = 3;
                GU.roundRectPath(ctx, be.x, be.y, be.w, be.h, 8);
                ctx.stroke();
            } else {
                var tp = pointPos(m.to);
                ctx.fillStyle = 'rgba(255,213,74,0.5)';
                ctx.beginPath();
                ctx.arc(tp.x, tp.y + tp.dir * (checkerR() + 4), checkerR() * 0.55, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // dados: los que giran mientras se tira, o los que quedan por usar
    var shown = dieAnim > 0 ? animDice : dice;
    for (var d = 0; d < shown.length; d++) {
        var dr = diceRect(d, shown.length);
        GU.drawDie(ctx, dr.x, dr.y, dr.w, shown[d], { face: turn === YOU ? '#f4f1ea' : '#e8d8c8' });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = turn === YOU ? '#8fd3f4' : '#ff8a3d';
    ctx.fillText(gamePhase === 'over' ? 'Fin'
               : gamePhase === 'rolling' ? 'Tirando…'
               : (turn === YOU ? (bar[YOU] ? 'Reentra desde la barra' : 'Te toca')
                               : 'Juega la máquina'),
                 W / 2 - BEAR_W / 2, H / 2 - 34);

    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 8);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2 - BEAR_W / 2, H / 2 + 44);

    if (gamePhase === 'idle') {
        GU.idleScreen(ctx, {
            title: 'BACKGAMMON',
            lines: ['Saca tus quince fichas antes que la máquina',
                    'Pulsa Iniciar'],
            bg: 'rgba(26,16,8,0.86)',
            color: '#ffd54a',
            lineColor: '#e8d8b8'
        });
    }
}

function drawChecker(x, y, who, highlight) {
    var r = checkerR();
    ctx.fillStyle = who === YOU ? '#2b6ea8' : '#c9c2b6';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = highlight ? '#ffd54a' : (who === YOU ? '#8fd3f4' : '#7c7368');
    ctx.lineWidth = highlight ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = who === YOU ? 'rgba(143,211,244,0.35)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function pointAt(x, y) {
    var be = bearRect();
    if (x >= be.x && x <= be.x + be.w && y >= be.y && y <= be.y + be.h) return OFF;
    var br = barRect();
    if (x >= br.x && x <= br.x + br.w) return BAR;
    var pw = pointW();
    for (var p = 0; p < 24; p++) {
        var pos = pointPos(p);
        if (x < pos.x - pw / 2 || x > pos.x + pw / 2) continue;
        var top = p < 12 ? H / 2 : 0;
        if (y >= top && y <= top + H / 2) return p;
    }
    return -1;
}

function handleAt(x, y) {
    if (gamePhase !== 'moving' || turn !== YOU) return;
    var p = pointAt(x, y);
    if (p < 0) return;
    var moves = usableMoves(YOU);

    if (sel < 0) {
        if (bar[YOU] > 0) { sel = BAR; GameAudio.click(); view.invalidate(); return; }
        if (p !== BAR && p !== OFF && ownsPoint(p, YOU)) {
            var has = moves.some(function (m) { return m.from === p; });
            if (!has) { msg.show('Esa ficha no puede moverse', 1.2); GameAudio.hit(); }
            else { sel = p; GameAudio.click(); }
        }
        view.invalidate();
        return;
    }

    var candidates = moves.filter(function (m) { return m.from === sel && m.to === p; });
    if (candidates.length) {
        /* Con dos dados que llegan al mismo sitio da igual cuál se gaste, salvo
         * que uno deje más jugadas después; usableMoves ya ha filtrado eso. */
        doMove(candidates[0], YOU);
        return;
    }
    if (p === sel) { sel = -1; view.invalidate(); return; }
    if (ownsPoint(p, YOU) && moves.some(function (m) { return m.from === p; })) {
        sel = p;
    } else {
        msg.show('Ahí no puedes', 1);
        GameAudio.hit();
    }
    view.invalidate();
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de backgammon. Flechas para moverte, Enter para elegir.',
    targets: function () {
        if (gamePhase !== 'moving' || turn !== YOU) return [];
        var moves = usableMoves(YOU), out = [], seen = {}, r = checkerR();
        function add(p, id) {
            if (seen[id]) return;
            seen[id] = true;
            if (p === OFF) {
                var be = bearRect();
                out.push({ x: be.x, y: be.y, w: be.w, h: be.h, id: id });
            } else if (p === BAR) {
                var br = barRect();
                out.push({ x: br.x, y: H / 2 - 20, w: br.w, h: 40, id: id });
            } else {
                var c = checkerPos(p, 0);
                out.push({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2, id: id });
            }
        }
        for (var i = 0; i < moves.length; i++) {
            if (sel < 0) add(moves[i].from, 'f' + moves[i].from);
            else if (moves[i].from === sel) add(moves[i].to, 't' + moves[i].to);
        }
        return out;
    },
    activate: function (t) {
        var p = t.id.slice(1) === String(OFF) ? OFF : (t.id.slice(1) === String(BAR) ? BAR : +t.id.slice(1));
        if (p === OFF) { var be = bearRect(); handleAt(be.x + be.w / 2, be.y + be.h / 2); }
        else if (p === BAR) { var br = barRect(); handleAt(br.x + br.w / 2, H / 2); }
        else { var c = checkerPos(p, 0); handleAt(c.x, c.y); }
    },
    onChange: function () { view.invalidate(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    if (dieAnim > 0) {
        dieAnim -= dt;
        /* Los dados que giran son OTRO array: escribir sobre `dice` mientras
         * rueda corrompería los dados disponibles del turno, que es estado de
         * juego y no decoración. */
        animDice = [GU.rollDie(6), GU.rollDie(6)];
    }
    fx.update(dt);
    msg.update(dt);
    draw();
    return dieAnim > 0 || fx.count > 0 || msg.active();
});

var gameControls = GU.controls({
    start:     newGame,
    restart:   newGame,
    playAgain: newGame,
    popup:     'overPopup'
});

setup();
syncHud();

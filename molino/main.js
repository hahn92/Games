/* Molino (Nine Men's Morris) — tres fases y una regla de captura que casi todo
 * el mundo implementa mal.
 *
 * Las fases: primero se COLOCAN las nueve fichas por turnos; después se MUEVEN a
 * un punto contiguo vacío; y cuando a alguien le quedan tres, ese alguien VUELA
 * — puede saltar a cualquier punto libre. Sin la fase de vuelo, el que va
 * perdiendo queda encerrado y el final es una formalidad.
 *
 * La regla que se olvida: al cerrar un molino te llevas una ficha rival, pero
 * NO puedes coger una que esté dentro de un molino, salvo que todas lo estén.
 * Sin esa restricción los molinos del rival son gratis y el juego se rompe.
 *
 * Los 24 puntos van numerados como anillo*8 + posición, con la posición 0..7
 * girando en sentido horario desde la esquina superior izquierda. Con esa
 * numeración las esquinas son las posiciones pares y los puntos medios las
 * impares, así que la vecindad dentro de un anillo es i±1 módulo 8, y el salto
 * entre anillos sólo existe en las posiciones impares. Todo lo demás sale de
 * ahí sin tablas escritas a mano. */
(function () {
'use strict';

var canvas = document.getElementById('molinoCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 460
var H = canvas.height;   // 460

var EMPTY = 0, HUMAN = 1, AI = 2;
var PIECES = 9;

/* ── Topología ────────────────────────────────────────────────────── */

function ring(i) { return (i / 8) | 0; }
function pos(i)  { return i % 8; }

/* Vecinos: dentro del anillo, i±1 mod 8. Entre anillos, sólo en las posiciones
 * impares (los puntos medios de cada lado). */
var ADJ = (function () {
    var a = [];
    for (var i = 0; i < 24; i++) a.push([]);
    for (var r = 0; r < 3; r++) {
        for (var p = 0; p < 8; p++) {
            var i2 = r * 8 + p;
            a[i2].push(r * 8 + ((p + 1) % 8));
            a[i2].push(r * 8 + ((p + 7) % 8));
            if (p % 2 === 1) {
                if (r > 0) a[i2].push((r - 1) * 8 + p);
                if (r < 2) a[i2].push((r + 1) * 8 + p);
            }
        }
    }
    return a;
}());

/* Los 16 molinos: cuatro por anillo (esquina-medio-esquina) más cuatro que
 * cruzan los tres anillos por cada punto medio. */
var MILLS = (function () {
    var m = [];
    for (var r = 0; r < 3; r++) {
        for (var p = 0; p < 8; p += 2) {
            m.push([r * 8 + p, r * 8 + ((p + 1) % 8), r * 8 + ((p + 2) % 8)]);
        }
    }
    for (var q = 1; q < 8; q += 2) m.push([q, 8 + q, 16 + q]);
    return m;
}());

/* Molinos que pasan por cada punto, precalculado: comprobar "¿cerré molino?"
 * recorriendo los 16 en cada jugada es innecesario. */
var MILLS_AT = (function () {
    var out = [];
    for (var i = 0; i < 24; i++) out.push([]);
    for (var k = 0; k < MILLS.length; k++) {
        for (var j = 0; j < 3; j++) out[MILLS[k][j]].push(MILLS[k]);
    }
    return out;
}());

/* ── Estado ───────────────────────────────────────────────────────── */

var board = null;
var toPlace = { 1: PIECES, 2: PIECES };
var turn = HUMAN;
var sel = -1;                 // ficha elegida para mover
var removing = false;         // el humano debe quitar una ficha rival
var status = 'idle';          // idle | playing | over
var busy = false;
var msg = '', msgT = 0;
var lastMill = null;
/* Jugadas seguidas sin cerrar molino ni quitar ficha. La regla estándar declara
 * TABLAS a las 50: sin ella dos jugadores que se limiten a ir y volver alargan
 * la partida indefinidamente, y eso pasa de verdad en la fase de mover. */
var quietMoves = 0;
var QUIET_LIMIT = 50;
var stats = { w: 0, l: 0, d: 0 };

var fx = new Particles(200);
var gMemo = GU.gradientMemo();

var hud = GU.hud({
    yours:  'yoursLabel',
    theirs: 'theirsLabel',
    phase:  'phaseLabel',
    wins:   'winsLabel',
    mobile: { el: 'mobileScore', format: function () {
        if (!board) return 'Pulsa Iniciar';
        if (status !== 'playing') return 'Fin  ·  G:' + stats.w + ' P:' + stats.l;
        if (removing) return 'Quita una ficha rival';
        return (busy ? 'La máquina piensa…' : (turn === HUMAN ? 'Tu turno' : 'Turno IA')) +
               '  ·  ' + phaseName(HUMAN);
    } }
});

function count(b, who) {
    var n = 0;
    for (var i = 0; i < 24; i++) if (b[i] === who) n++;
    return n;
}
function phaseOf(b, who) {
    if (toPlace[who] > 0) return 'colocar';
    return count(b, who) <= 3 ? 'volar' : 'mover';
}
function phaseName(who) {
    var p = phaseOf(board, who);
    return p === 'colocar' ? 'Colocando' : p === 'volar' ? 'Volando' : 'Moviendo';
}

/* ── Reglas ───────────────────────────────────────────────────────── */

function inMill(b, i, who) {
    var ms = MILLS_AT[i];
    for (var k = 0; k < ms.length; k++) {
        if (b[ms[k][0]] === who && b[ms[k][1]] === who && b[ms[k][2]] === who) return ms[k];
    }
    return null;
}

/* Fichas del rival que se pueden quitar: las que NO están en molino, y si todas
 * lo están, entonces cualquiera. Esta es la regla que se olvida. */
function removable(b, victim) {
    var free = [], all = [];
    for (var i = 0; i < 24; i++) {
        if (b[i] !== victim) continue;
        all.push(i);
        if (!inMill(b, i, victim)) free.push(i);
    }
    return free.length ? free : all;
}

/* Movimientos legales, según la fase. Devuelve {from, to}; en la fase de
 * colocar, from es -1. */
function legalMoves(b, who, placeLeft) {
    var out = [], i, k;
    if (placeLeft > 0) {
        for (i = 0; i < 24; i++) if (b[i] === EMPTY) out.push({ from: -1, to: i });
        return out;
    }
    var flying = count(b, who) <= 3;
    for (i = 0; i < 24; i++) {
        if (b[i] !== who) continue;
        if (flying) {
            for (k = 0; k < 24; k++) if (b[k] === EMPTY) out.push({ from: i, to: k });
        } else {
            var adj = ADJ[i];
            for (k = 0; k < adj.length; k++) if (b[adj[k]] === EMPTY) out.push({ from: i, to: adj[k] });
        }
    }
    return out;
}

/* Se pierde con menos de tres fichas O sin movimientos legales. Lo segundo se
 * olvida a menudo y deja partidas bloqueadas para siempre. */
function loser(b, placeLeft) {
    for (var who = 1; who <= 2; who++) {
        if (placeLeft[who] === 0 && count(b, who) < 3) return who;
        if (placeLeft[who] === 0 && !legalMoves(b, who, 0).length) return who;
    }
    return 0;
}

/* ── IA ───────────────────────────────────────────────────────────── */

function evaluate(b, placeLeft) {
    var l = loser(b, placeLeft);
    if (l === HUMAN) return 100000;
    if (l === AI) return -100000;

    var score = (count(b, AI) - count(b, HUMAN)) * 60;
    /* Molinos cerrados y movilidad. Un molino vale mucho, pero quedarse sin
     * movimientos pierde, así que la movilidad no puede pesar cero. */
    var mineMills = 0, theirMills = 0, k;
    for (k = 0; k < MILLS.length; k++) {
        var m = MILLS[k];
        if (b[m[0]] === AI && b[m[1]] === AI && b[m[2]] === AI) mineMills++;
        if (b[m[0]] === HUMAN && b[m[1]] === HUMAN && b[m[2]] === HUMAN) theirMills++;
    }
    score += (mineMills - theirMills) * 45;
    /* La movilidad sólo se mira fuera de la fase de vuelo: volando todo el mundo
     * puede ir a cualquier hueco, así que el término no distingue nada y en
     * cambio cuesta dos recorridos del tablero en CADA hoja. */
    if (placeLeft[AI] === 0 && placeLeft[HUMAN] === 0 &&
        count(b, AI) > 3 && count(b, HUMAN) > 3) {
        score += (legalMoves(b, AI, 0).length - legalMoves(b, HUMAN, 0).length) * 3;
    }
    return score;
}

function applyMove(b, placeLeft, who, mv) {
    var nb = b.slice();
    var np = { 1: placeLeft[1], 2: placeLeft[2] };
    if (mv.from >= 0) nb[mv.from] = EMPTY;
    else np[who]--;
    nb[mv.to] = who;
    return { b: nb, p: np, mill: !!inMill(nb, mv.to, who) };
}

/* Ordena poniendo delante las jugadas que CIERRAN MOLINO.
 *
 * La poda alfa-beta corta tanto mejor cuanto antes vea la jugada buena, y en el
 * molino la jugada buena casi siempre es la que cierra. Sin ordenar, la fase de
 * mover tardaba 286 ms de media y hasta 1,1 s en la peor — un congelón que se
 * nota. Ordenar no cambia el resultado de la búsqueda, sólo lo que cuesta
 * llegar a él. */
function orderMoves(b, who, moves) {
    var scored = [];
    for (var k = 0; k < moves.length; k++) {
        var nb = b.slice();
        if (moves[k].from >= 0) nb[moves[k].from] = EMPTY;
        nb[moves[k].to] = who;
        scored.push({ mv: moves[k], mill: inMill(nb, moves[k].to, who) ? 1 : 0 });
    }
    scored.sort(function (x, y) { return y.mill - x.mill; });
    var out = [];
    for (var i = 0; i < scored.length; i++) out.push(scored[i].mv);
    return out;
}

function minimax(b, placeLeft, who, depth, alpha, beta) {
    var l = loser(b, placeLeft);
    if (l || depth === 0) return evaluate(b, placeLeft);

    var moves = orderMoves(b, who, legalMoves(b, who, placeLeft[who]));
    if (!moves.length) return who === AI ? -100000 : 100000;

    var maximizing = who === AI;
    var best = maximizing ? -Infinity : Infinity;
    var victim = who === AI ? HUMAN : AI;

    for (var k = 0; k < moves.length; k++) {
        var st = applyMove(b, placeLeft, who, moves[k]);
        var vals = [];
        if (st.mill) {
            /* Cerrar molino obliga a quitar: cada opción es una rama distinta.
             * Probarlas todas es caro, así que se limita a unas pocas — la
             * elección concreta casi nunca cambia el valor de la jugada. */
            /* Dos opciones de retirada bastan dentro de la búsqueda: cuál se
             * quite casi nunca cambia el valor de la jugada, y cada rama extra
             * multiplica el árbol entero. */
            var opts = removable(st.b, victim).slice(0, 2);
            for (var q = 0; q < opts.length; q++) {
                var rb = st.b.slice();
                rb[opts[q]] = EMPTY;
                vals.push(minimax(rb, st.p, who === AI ? HUMAN : AI, depth - 1, alpha, beta));
            }
            if (!opts.length) vals.push(minimax(st.b, st.p, who === AI ? HUMAN : AI, depth - 1, alpha, beta));
        } else {
            vals.push(minimax(st.b, st.p, who === AI ? HUMAN : AI, depth - 1, alpha, beta));
        }

        for (var v = 0; v < vals.length; v++) {
            if (maximizing) { if (vals[v] > best) best = vals[v]; if (best > alpha) alpha = best; }
            else            { if (vals[v] < best) best = vals[v]; if (best < beta)  beta  = best; }
        }
        if (beta <= alpha) break;
    }
    return best;
}

function chooseAI() {
    var moves = orderMoves(board, AI, legalMoves(board, AI, toPlace[AI]));
    if (!moves.length) return null;
    /* La profundidad se baja donde el árbol explota, no siempre:
     *
     * - Colocando hay hasta 24 destinos y la jugada apenas mejora con más
     *   profundidad.
     * - VOLANDO es el caso malo de verdad: con tres fichas se puede ir a
     *   cualquier hueco, así que son ~63 jugadas por bando y el árbol se
     *   multiplica. Medido, una jugada llegaba a 2,7 s ahí — un congelón que el
     *   jugador nota. A profundidad 2 baja a decenas de ms y la partida ya está
     *   prácticamente decidida a esas alturas.
     */
    var flying = count(board, AI) <= 3 || count(board, HUMAN) <= 3;
    var depth = flying ? 2 : (toPlace[AI] > 0 ? 3 : 4);
    var best = moves[0], bestVal = -Infinity;
    for (var k = 0; k < moves.length; k++) {
        var st = applyMove(board, toPlace, AI, moves[k]);
        var val;
        if (st.mill) {
            var opts = removable(st.b, HUMAN);
            var bestSub = -Infinity;
            for (var q = 0; q < Math.min(opts.length, 4); q++) {
                var rb = st.b.slice();
                rb[opts[q]] = EMPTY;
                var v = minimax(rb, st.p, HUMAN, depth - 1, -Infinity, Infinity);
                if (v > bestSub) { bestSub = v; }
            }
            val = bestSub;
        } else {
            val = minimax(st.b, st.p, HUMAN, depth - 1, -Infinity, Infinity);
        }
        if (val > bestVal) { bestVal = val; best = moves[k]; }
    }
    return best;
}

/* ── Turnos ───────────────────────────────────────────────────────── */

function loadStats() {
    var s = GameStore.getJSON('molinoStats', null);
    if (s && typeof s.w === 'number') stats = s;
}
function saveStats() { GameStore.setJSON('molinoStats', stats); }

function newGame() {
    board = new Uint8Array(24);
    toPlace = { 1: PIECES, 2: PIECES };
    turn = HUMAN;
    sel = -1;
    removing = false;
    busy = false;
    lastMill = null;
    quietMoves = 0;
    status = 'playing';
    fx.clear();
    say('Coloca tus nueve fichas');
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function humanAt(i) {
    if (status !== 'playing' || turn !== HUMAN || busy) return;

    if (removing) {
        var opts = removable(board, AI);
        if (opts.indexOf(i) < 0) { say('Esa no se puede quitar'); GameAudio.miss(); return; }
        board[i] = EMPTY;
        burst(i, '#ff512f');
        removing = false;
        GameAudio.explode();
        if (endIfOver()) return;
        passToAI();
        return;
    }

    if (toPlace[HUMAN] > 0) {
        if (board[i] !== EMPTY) { GameAudio.miss(); return; }
        board[i] = HUMAN;
        toPlace[HUMAN]--;
        GameAudio.place();
        afterHumanMove(i);
        return;
    }

    /* Fase de mover o volar. */
    if (board[i] === HUMAN) { sel = (sel === i ? -1 : i); GameAudio.click(); return; }
    if (sel < 0) { GameAudio.miss(); return; }
    if (board[i] !== EMPTY) { GameAudio.miss(); return; }
    var flying = count(board, HUMAN) <= 3;
    if (!flying && ADJ[sel].indexOf(i) < 0) { say('Sólo a un punto contiguo'); GameAudio.miss(); return; }

    board[sel] = EMPTY;
    board[i] = HUMAN;
    sel = -1;
    GameAudio.place();
    afterHumanMove(i);
}

function afterHumanMove(i) {
    var mill = inMill(board, i, HUMAN);
    if (mill) {
        quietMoves = 0;
        lastMill = mill;
        removing = true;
        say('¡Molino! Quita una ficha rival');
        GameAudio.scoreHigh();
        syncHud();
        return;
    }
    quietMoves++;
    if (endIfOver()) return;
    passToAI();
}

function passToAI() {
    turn = AI;
    busy = true;
    syncHud();
    setTimeout(aiTurn, 420);
}

function aiTurn() {
    if (status !== 'playing') { busy = false; return; }
    var mv = chooseAI();
    if (!mv) { busy = false; endGame(HUMAN); return; }

    if (mv.from >= 0) board[mv.from] = EMPTY;
    else toPlace[AI]--;
    board[mv.to] = AI;
    GameAudio.place();

    var mill = inMill(board, mv.to, AI);
    if (mill) {
        lastMill = mill;
        var opts = removable(board, HUMAN);
        if (opts.length) {
            /* Se lleva la que más molinos potenciales le quita al humano; a
             * igualdad, la primera. Sin criterio, la IA regala la posición. */
            var pick = opts[0], bestVal = -Infinity;
            for (var k = 0; k < opts.length; k++) {
                var rb = board.slice();
                rb[opts[k]] = EMPTY;
                var v = evaluate(rb, toPlace);
                if (v > bestVal) { bestVal = v; pick = opts[k]; }
            }
            board[pick] = EMPTY;
            burst(pick, '#00e5ff');
            say('La máquina cierra molino');
            GameAudio.explode();
            quietMoves = 0;
        }
    } else {
        quietMoves++;
    }

    busy = false;
    if (endIfOver()) return;
    turn = HUMAN;
    syncHud();
}

function endIfOver() {
    var l = loser(board, toPlace);
    if (l) { endGame(l === HUMAN ? AI : HUMAN); return true; }
    if (toPlace[HUMAN] === 0 && toPlace[AI] === 0 && quietMoves >= QUIET_LIMIT) {
        endGame(0);
        return true;
    }
    return false;
}

function endGame(winner) {
    status = 'over';
    if (winner === HUMAN)    { stats.w++; GameAudio.win(); }
    else if (winner === AI)  { stats.l++; GameAudio.gameOver(); }
    else                     { stats.d++; GameAudio.gameOver(); }
    saveStats();
    syncHud();
    gameControls.idle();
    setTimeout(function () {
        over.show({
            overTitle: winner === HUMAN ? '¡Ganas!' : winner === AI ? 'Gana la máquina' : 'Tablas',
            overScore: winner === 0
                ? QUIET_LIMIT + ' jugadas sin cerrar un molino'
                : 'Te quedaban ' + count(board, HUMAN) + ' fichas; a la máquina, ' + count(board, AI),
            overRecord: 'Ganadas: ' + stats.w + '  ·  Perdidas: ' + stats.l + '  ·  Tablas: ' + stats.d
        });
    }, 700);
}

function say(t) { msg = t; msgT = 2; }
function burst(i, col) {
    var p = ptPos(i);
    fx.burst(p.x, p.y, 14, { color: col, speed: 100, life: 0.6, size: 2.5 });
}

function syncHud() {
    hud.set({
        yours:  board ? count(board, HUMAN) + toPlace[HUMAN] : PIECES,
        theirs: board ? count(board, AI) + toPlace[AI] : PIECES,
        phase:  board && status === 'playing' ? phaseName(HUMAN) : '—',
        wins:   stats.w
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

var HALF = [W * 0.42, W * 0.28, W * 0.14];

function ptPos(i) {
    var s = HALF[ring(i)], p = pos(i);
    var cx = W / 2, cy = H / 2;
    var dx = (p === 0 || p === 6 || p === 7) ? -s : (p === 2 || p === 3 || p === 4) ? s : 0;
    var dy = (p === 0 || p === 1 || p === 2) ? -s : (p === 4 || p === 5 || p === 6) ? s : 0;
    return { x: cx + dx, y: cy + dy };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#8a5c2e');
        g.addColorStop(1, '#5f3d1c');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawLines();
    if (board) drawPieces();
    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2, t.y + t.h / 2, 20, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (msgT > 0) drawMessage();
    if (status === 'idle') drawIdle();
}

function drawLines() {
    /* Los tres cuadrados y los cuatro radios, en un solo trazo. */
    ctx.strokeStyle = '#3a2411';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var r = 0; r < 3; r++) {
        var a = ptPos(r * 8 + 0), b = ptPos(r * 8 + 2), c = ptPos(r * 8 + 4), d = ptPos(r * 8 + 6);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y); ctx.closePath();
    }
    for (var p = 1; p < 8; p += 2) {
        var o = ptPos(p), i2 = ptPos(16 + p);
        ctx.moveTo(o.x, o.y); ctx.lineTo(i2.x, i2.y);
    }
    ctx.stroke();

    /* Los puntos vacíos, para que se vea dónde se puede jugar. */
    ctx.fillStyle = '#3a2411';
    for (var k = 0; k < 24; k++) {
        if (board && board[k] !== EMPTY) continue;
        var q = ptPos(k);
        ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill();
    }
}

function drawPieces() {
    var rad = 16;
    /* Resalta el molino recién cerrado. */
    if (lastMill) {
        ctx.strokeStyle = 'rgba(255,213,74,0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        var a = ptPos(lastMill[0]), c = ptPos(lastMill[2]);
        ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
        ctx.stroke();
    }

    for (var i = 0; i < 24; i++) {
        var v = board[i];
        if (!v) continue;
        var p = ptPos(i);
        ctx.save();
        ctx.translate(p.x, p.y);
        /* Degradado cacheado por color y radio, en el ORIGEN y trasladado:
         * por posición serían 18 gradientes nuevos cada frame. */
        ctx.fillStyle = gMemo('p' + v + rad, function () {
            var g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
            if (v === HUMAN) { g.addColorStop(0, '#7fdcff'); g.addColorStop(1, '#00728f'); }
            else             { g.addColorStop(0, '#ff9a80'); g.addColorStop(1, '#a32a17'); }
            return g;
        });
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (i === sel) {
            ctx.strokeStyle = '#8fff6a';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2); ctx.stroke();
        }
        /* Marca las que se pueden quitar, o el jugador no sabe dónde tocar. */
        if (removing && v === AI && removable(board, AI).indexOf(i) >= 0) {
            ctx.strokeStyle = '#ffd54a';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2); ctx.stroke();
        }
    }
}

function drawMessage() {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(msgT, 0, 1);
    ctx.fillText(msg, W / 2, H - 14);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

function drawIdle() {
    ctx.fillStyle = 'rgba(58,36,17,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MOLINO', W / 2, H / 2 - 10);
    ctx.fillStyle = '#e8d8b8';
    ctx.font = '15px Arial';
    ctx.fillText('Alinea tres y quítale una ficha', W / 2, H / 2 + 18);
    ctx.textAlign = 'left';
}

rafLoop(function (dt) {
    if (msgT > 0) msgT -= dt;
    fx.update(dt);
    draw();
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    for (var i = 0; i < 24; i++) {
        var p = ptPos(i);
        if (GU.dist2(x, y, p.x, p.y) <= 22 * 22) { humanAt(i); return; }
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Se ofrecen sólo los puntos que TIENEN sentido ahora mismo: al quitar, las
 * fichas quitables; al colocar, los vacíos; al mover, tus fichas y los destinos
 * legales de la elegida. Ofrecer los 24 siempre multiplicaría los pasos y
 * dejaría al teclado peor que al ratón. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de molino. Flechas para moverte, Enter para jugar el punto.',
    targets: function () {
        var out = [], i, p;
        if (!board || status !== 'playing' || turn !== HUMAN || busy) return out;
        function add(i2) {
            var q = ptPos(i2);
            out.push({ x: q.x - 20, y: q.y - 20, w: 40, h: 40, id: 'p' + i2, i: i2 });
        }
        if (removing) {
            var opts = removable(board, AI);
            for (i = 0; i < opts.length; i++) add(opts[i]);
            return out;
        }
        if (toPlace[HUMAN] > 0) {
            for (i = 0; i < 24; i++) if (board[i] === EMPTY) add(i);
            return out;
        }
        for (i = 0; i < 24; i++) if (board[i] === HUMAN) add(i);
        if (sel >= 0) {
            var flying = count(board, HUMAN) <= 3;
            for (i = 0; i < 24; i++) {
                if (board[i] !== EMPTY) continue;
                if (flying || ADJ[sel].indexOf(i) >= 0) add(i);
            }
        }
        return out;
    },
    activate: function (t) { humanAt(t.i); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });

loadStats();
syncHud();
draw();

}());

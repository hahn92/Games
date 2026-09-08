/* Mancala (Kalah) — seis hoyos por lado, cuatro semillas en cada uno.
 *
 * Las dos reglas que hacen el juego, y las dos que se implementan mal:
 *
 * 1. TURNO EXTRA. Si la última semilla cae en tu propio granero, repites. Eso
 *    convierte el juego en encadenar jugadas, y es de donde salen los turnos
 *    largos que deciden la partida.
 * 2. CAPTURA. Si la última cae en un hoyo TUYO que estaba VACÍO y el de enfrente
 *    tiene semillas, te llevas las dos cosas. Olvidar el "que estaba vacío" o el
 *    "tuyo" convierte la captura en algo que pasa todo el rato.
 *
 * Y la que se olvida siempre: al sembrar se SALTA el granero del rival. Sin eso
 * el contador de semillas deja de cuadrar y el rival gana puntos que nadie le
 * ha dado.
 *
 * El tablero es un array de 14: 0-5 hoyos del humano, 6 su granero, 7-12 hoyos
 * de la máquina, 13 el suyo. Con esa numeración sembrar es avanzar el índice
 * módulo 14, y "el de enfrente" es 12 - i. */
(function () {
'use strict';

var canvas = document.getElementById('mancalaCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 620
var H = canvas.height;   // 320

var PITS = 6;
var SEEDS = 4;
var HUMAN_STORE = 6, AI_STORE = 13;

var board = null;        // 14 posiciones
var turn = 'human';
var status = 'idle';     // idle | playing | over
var busy = false;
var msg = '', msgT = 0;
var lastSown = -1;
var stats = { w: 0, l: 0, d: 0 };

var fx = new Particles(200);
var gMemo = GU.gradientMemo();

var hud = GU.hud({
    you:    'youLabel',
    cpu:    'cpuLabel',
    wins:   'winsLabel',
    mobile: { el: 'mobileScore', format: function () {
        if (!board) return 'Pulsa Iniciar';
        var t = status !== 'playing' ? '—' : (busy ? 'La máquina juega…' : (turn === 'human' ? 'Tu turno' : 'Turno IA'));
        return t + '  ·  Tú ' + board[HUMAN_STORE] + ' — ' + board[AI_STORE] + ' IA';
    } }
});

/* ── Reglas ───────────────────────────────────────────────────────── */

function newBoard() {
    var b = new Array(14).fill(SEEDS);
    b[HUMAN_STORE] = 0;
    b[AI_STORE] = 0;
    return b;
}

function isMine(i, who) {
    return who === 'human' ? (i >= 0 && i <= 5) : (i >= 7 && i <= 12);
}
function storeOf(who) { return who === 'human' ? HUMAN_STORE : AI_STORE; }
function otherStore(who) { return who === 'human' ? AI_STORE : HUMAN_STORE; }

function sideEmpty(b, who) {
    var from = who === 'human' ? 0 : 7;
    for (var i = from; i < from + PITS; i++) if (b[i] > 0) return false;
    return true;
}

/* Siembra desde `pit` y devuelve { again, captured }. Trabaja sobre el tablero
 * que se le pase, para poder usarla también en la búsqueda de la IA sin tocar
 * el tablero real. */
function sow(b, pit, who) {
    var seeds = b[pit];
    if (!seeds) return null;
    b[pit] = 0;
    var i = pit;
    while (seeds > 0) {
        i = (i + 1) % 14;
        if (i === otherStore(who)) continue;   // el granero del rival se salta
        b[i]++;
        seeds--;
    }

    var again = (i === storeOf(who));
    var captured = 0;
    /* Captura: última semilla en hoyo propio que estaba vacío (ahora tiene 1) y
     * con semillas enfrente. */
    if (!again && isMine(i, who) && b[i] === 1) {
        var opp = 12 - i;
        if (b[opp] > 0) {
            captured = b[opp] + 1;
            b[storeOf(who)] += captured;
            b[opp] = 0;
            b[i] = 0;
        }
    }
    return { last: i, again: again, captured: captured };
}

/* Fin: un lado se queda sin semillas. El otro se lleva TODO lo que le quede en
 * sus hoyos — sin esa recogida el marcador final no suma las 48 semillas. */
function finishIfOver(b) {
    var hEmpty = sideEmpty(b, 'human'), aEmpty = sideEmpty(b, 'ai');
    if (!hEmpty && !aEmpty) return false;
    var from = hEmpty ? 7 : 0;
    for (var i = from; i < from + PITS; i++) {
        b[hEmpty ? AI_STORE : HUMAN_STORE] += b[i];
        b[i] = 0;
    }
    return true;
}

/* ── IA ───────────────────────────────────────────────────────────── */

/* Minimax con poda alfa-beta. El turno extra complica el árbol: tras una jugada
 * que repite, el que mueve NO cambia, así que la recursión tiene que llevar de
 * quién es el turno y no alternar a ciegas. Ignorarlo es lo que hace que una IA
 * de mancala no vea las cadenas, que es justo donde está el juego. */
function evaluate(b) {
    /* Diferencia de graneros más una pizca por semillas en el propio lado: las
     * que aún tienes son munición para encadenar. */
    var mine = 0, theirs = 0, i;
    for (i = 7; i <= 12; i++) mine += b[i];
    for (i = 0; i <= 5; i++) theirs += b[i];
    return (b[AI_STORE] - b[HUMAN_STORE]) * 10 + (mine - theirs);
}

function legalMoves(b, who) {
    var out = [], from = who === 'human' ? 0 : 7;
    for (var i = from; i < from + PITS; i++) if (b[i] > 0) out.push(i);
    return out;
}

function minimax(b, depth, who, alpha, beta) {
    if (depth === 0) return evaluate(b);
    var moves = legalMoves(b, who);
    if (!moves.length) {
        var end = b.slice();
        finishIfOver(end);
        return evaluate(end);
    }

    var maximizing = who === 'ai';
    var best = maximizing ? -Infinity : Infinity;
    for (var k = 0; k < moves.length; k++) {
        var nb = b.slice();
        var res = sow(nb, moves[k], who);
        var over = finishIfOver(nb);
        var val;
        if (over) {
            val = evaluate(nb);
        } else if (res.again) {
            /* Turno extra: sigue moviendo EL MISMO, y no se gasta profundidad
             * de más porque la cadena es una sola jugada desde fuera. */
            val = minimax(nb, depth - 1, who, alpha, beta);
        } else {
            val = minimax(nb, depth - 1, who === 'ai' ? 'human' : 'ai', alpha, beta);
        }

        if (maximizing) {
            if (val > best) best = val;
            if (best > alpha) alpha = best;
        } else {
            if (val < best) best = val;
            if (best < beta) beta = best;
        }
        if (beta <= alpha) break;
    }
    return best;
}

function chooseAI() {
    var moves = legalMoves(board, 'ai');
    if (!moves.length) return -1;
    var best = moves[0], bestVal = -Infinity;
    for (var k = 0; k < moves.length; k++) {
        var nb = board.slice();
        var res = sow(nb, moves[k], 'ai');
        var over = finishIfOver(nb);
        var val = over ? evaluate(nb)
                : res.again ? minimax(nb, 6, 'ai', -Infinity, Infinity)
                            : minimax(nb, 6, 'human', -Infinity, Infinity);
        if (val > bestVal) { bestVal = val; best = moves[k]; }
    }
    return best;
}

/* ── Turnos ───────────────────────────────────────────────────────── */

function loadStats() {
    var s = GameStore.getJSON('mancalaStats', null);
    if (s && typeof s.w === 'number') stats = s;
}
function saveStats() { GameStore.setJSON('mancalaStats', stats); }

function newGame() {
    board = newBoard();
    turn = 'human';
    status = 'playing';
    busy = false;
    msg = 'Empiezas tú';
    msgT = 1.6;
    lastSown = -1;
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function humanPlay(pit) {
    if (status !== 'playing' || turn !== 'human' || busy) return;
    if (!isMine(pit, 'human') || board[pit] === 0) { GameAudio.miss(); return; }

    var res = sow(board, pit, 'human');
    lastSown = res.last;
    burstAt(res.last);
    GameAudio.place();
    if (res.captured) { say('¡Captura de ' + res.captured + '!'); GameAudio.score(); }

    if (finishIfOver(board)) { endGame(); return; }

    if (res.again) {
        say('Turno extra');
        GameAudio.scoreHigh();
        syncHud();
        return;
    }
    turn = 'ai';
    busy = true;
    syncHud();
    setTimeout(function () { aiTurn(); view.invalidate(); }, 550);
}

function aiTurn() {
    if (status !== 'playing') { busy = false; return; }
    var pit = chooseAI();
    if (pit < 0) { busy = false; endGame(); return; }

    var res = sow(board, pit, 'ai');
    lastSown = res.last;
    burstAt(res.last);
    GameAudio.place();
    if (res.captured) say('La máquina captura ' + res.captured);

    if (finishIfOver(board)) { busy = false; endGame(); return; }

    if (res.again) {
        say('La máquina repite');
        syncHud();
        setTimeout(function () { aiTurn(); view.invalidate(); }, 550);
        return;
    }
    busy = false;
    turn = 'human';
    say('Te toca');
    syncHud();
}

function endGame() {
    status = 'over';
    var h = board[HUMAN_STORE], a = board[AI_STORE];
    if (h > a)      { stats.w++; GameAudio.win(); }
    else if (a > h) { stats.l++; GameAudio.gameOver(); }
    else            { stats.d++; GameAudio.gameOver(); }
    saveStats();
    syncHud();
    gameControls.idle();
    setTimeout(function () {
        over.show({
            overTitle: h > a ? '¡Ganas!' : a > h ? 'Gana la máquina' : 'Empate',
            overScore: 'Tú ' + h + '  —  ' + a + ' la máquina',
            overRecord: 'Ganadas: ' + stats.w + '  ·  Perdidas: ' + stats.l + '  ·  Empates: ' + stats.d
        });
    }, 700);
}

function say(t) { msg = t; msgT = 1.8; }

function burstAt(i) {
    var p = pitPos(i);
    fx.burst(p.x, p.y, 8, { color: '#ffd54a', speed: 70, life: 0.5, size: 2 });
}

function syncHud() {
    hud.set({
        you:  board ? board[HUMAN_STORE] : 0,
        cpu:  board ? board[AI_STORE] : 0,
        wins: stats.w
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

var STORE_W = 74, PIT_R = 34, MARGIN = 20;

/* Los hoyos del humano van abajo de izquierda a derecha (0..5) y los de la
 * máquina arriba de derecha a izquierda (7..12), que es como se ve un mancala
 * real: el recorrido de siembra es un círculo antihorario. */
function pitPos(i) {
    var innerW = W - MARGIN * 2 - STORE_W * 2 - 20;
    var step = innerW / PITS;
    if (i === HUMAN_STORE) return { x: W - MARGIN - STORE_W / 2, y: H / 2 };
    if (i === AI_STORE)    return { x: MARGIN + STORE_W / 2, y: H / 2 };
    if (i <= 5) {
        return { x: MARGIN + STORE_W + 10 + step * (i + 0.5), y: H * 0.68 };
    }
    var k = 12 - i;      // 7 -> 5 ... 12 -> 0
    return { x: MARGIN + STORE_W + 10 + step * (k + 0.5), y: H * 0.32 };
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#5a3a1c');
        g.addColorStop(1, '#3a2411');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    /* Tabla del tablero */
    ctx.fillStyle = '#6b4522';
    GU.roundRectPath(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.fill();
    ctx.strokeStyle = '#8a5c2e';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (board) {
        drawStore(AI_STORE);
        drawStore(HUMAN_STORE);
        for (var i = 0; i < 14; i++) {
            if (i === HUMAN_STORE || i === AI_STORE) continue;
            drawPit(i);
        }
    }
    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2, t.y + t.h / 2, PIT_R + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (msgT > 0) drawMessage();
    if (status === 'idle') drawIdle();
}

function drawStore(which) {
    var p = pitPos(which);
    ctx.fillStyle = '#452a13';
    GU.roundRectPath(ctx, p.x - STORE_W / 2, 26, STORE_W, H - 52, STORE_W / 2);
    ctx.fill();
    ctx.strokeStyle = '#2e1c0d';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawSeeds(p.x, p.y, board[which], STORE_W * 0.36, which === HUMAN_STORE);

    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(board[which]), p.x, which === HUMAN_STORE ? H - 34 : 48);
    ctx.fillStyle = '#c9a978';
    ctx.font = '11px monospace';
    ctx.fillText(which === HUMAN_STORE ? 'TÚ' : 'IA', p.x, which === HUMAN_STORE ? H - 18 : 64);
    ctx.textAlign = 'left';
}

function drawPit(i) {
    var p = pitPos(i);
    var mine = i <= 5;
    var playable = status === 'playing' && turn === 'human' && mine && board[i] > 0 && !busy;

    ctx.fillStyle = '#452a13';
    ctx.beginPath();
    ctx.arc(p.x, p.y, PIT_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = i === lastSown ? '#ffd54a' : (playable ? '#8fff6a' : '#2e1c0d');
    ctx.lineWidth = (i === lastSown || playable) ? 2.5 : 2;
    ctx.stroke();

    drawSeeds(p.x, p.y, board[i], PIT_R * 0.62, mine);

    ctx.fillStyle = '#e8d8b8';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(board[i]), p.x, p.y + PIT_R + 16);
    ctx.textAlign = 'left';
}

/* Las semillas se colocan en espiral determinista a partir del índice, nunca
 * con Math.random(): un frame repintado dos veces —como pasa en un resize— las
 * movería de sitio. */
function drawSeeds(cxp, cyp, n, radius, warm) {
    if (!n) return;
    var show = Math.min(n, 14);
    for (var k = 0; k < show; k++) {
        var ang = k * 2.399963;                 // ángulo áureo: reparte sin huecos
        var rad = radius * Math.sqrt((k + 0.5) / show);
        var x = cxp + Math.cos(ang) * rad;
        var y = cyp + Math.sin(ang) * rad;
        ctx.fillStyle = warm ? '#f0b23c' : '#c8d6e8';
        ctx.beginPath();
        ctx.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x - 1.2, y - 1.2, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMessage() {
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(msgT, 0, 1);
    ctx.fillText(msg, W / 2, H / 2 + 6);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

function drawIdle() {
    ctx.fillStyle = 'rgba(58,36,17,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MANCALA', W / 2, H / 2 - 10);
    ctx.fillStyle = '#e8d8b8';
    ctx.font = '15px Arial';
    ctx.fillText('Siembra, captura y encadena turnos extra', W / 2, H / 2 + 18);
    ctx.textAlign = 'left';
}

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    if (msgT > 0) msgT -= dt;
    fx.update(dt);
    draw();
    return fx.count > 0 || msgT > 0;
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    for (var i = 0; i <= 5; i++) {
        var p = pitPos(i);
        if (GU.dist2(x, y, p.x, p.y) <= PIT_R * PIT_R) { humanPlay(i); return; }
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Sólo se ofrecen al teclado los hoyos JUGABLES: recorrer los del rival y los
 * vacíos no lleva a ninguna jugada y multiplica los pasos. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Hoyos de tu lado. Flechas para moverte, Enter para sembrar.',
    targets: function () {
        var out = [];
        if (!board || status !== 'playing' || turn !== 'human') return out;
        for (var i = 0; i <= 5; i++) {
            if (!board[i]) continue;
            var p = pitPos(i);
            out.push({ x: p.x - PIT_R, y: p.y - PIT_R, w: PIT_R * 2, h: PIT_R * 2, id: 'p' + i, i: i });
        }
        return out;
    },
    activate: function (t) { humanPlay(t.i); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });

loadStats();
syncHud();
draw();

}());

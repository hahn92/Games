/* Cinco en Raya (Gomoku) — 15×15, gana quien alinee cinco.
 *
 * Un minimax completo aquí es inviable: el tablero tiene 225 casillas y el
 * factor de ramificación en la apertura es de ese orden. La IA usa lo que de
 * verdad se usa en gomoku: EVALUACIÓN POR AMENAZAS. Cada jugada candidata se
 * puntúa mirando las cuatro direcciones y contando lo que crea o impide —
 * cinco, cuatro abierto, tres abierto, etc.
 *
 * Y una regla que decide partidas: la IA puntúa TAMBIÉN la casilla desde el
 * punto de vista del rival, y se queda con el máximo de las dos. Sin eso hace
 * lo clásico de las IA malas de gomoku: seguir construyendo su línea mientras
 * el humano completa la suya.
 *
 * Los candidatos se limitan a las casillas con una piedra a distancia 2. En un
 * tablero vacío eso es una casilla; a media partida son unas 40 en vez de 200,
 * y es lo que hace que el turno sea instantáneo. */
(function () {
'use strict';

var canvas = document.getElementById('gomokuCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 480
var H = canvas.height;   // 480

var N = 15;
var MARGIN = 18;
var STEP = (W - MARGIN * 2) / (N - 1);

var EMPTY = 0, HUMAN = 1, AI = 2;

var board = null;
var turn = HUMAN;
var status = 'idle';      // idle | playing | over
var lastMove = null;
var winLine = null;
var thinking = false;
var stats = { w: 0, l: 0, d: 0 };

var fx = new Particles(160);
var gMemo = GU.gradientMemo();

var hud = GU.hud({
    wins:   'winsLabel',
    losses: 'lossesLabel',
    turn:   { el: 'turnLabel', format: function (v) { return v; } },
    mobile: { el: 'mobileScore', format: function () {
        var t = status !== 'playing' ? '—'
              : thinking ? 'IA pensando…'
              : (turn === HUMAN ? 'Tu turno' : 'Turno IA');
        return t + '  ·  G:' + stats.w + ' P:' + stats.l + ' E:' + stats.d;
    } }
});

function idx(r, c) { return r * N + c; }
function inside(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

/* ── Partida ──────────────────────────────────────────────────────── */

function loadStats() {
    var s = GameStore.getJSON('gomokuStats', null);
    if (s && typeof s.w === 'number') stats = s;
}
function saveStats() { GameStore.setJSON('gomokuStats', stats); }

function newGame() {
    board = new Uint8Array(N * N);
    turn = HUMAN;
    status = 'playing';
    lastMove = null;
    winLine = null;
    thinking = false;
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function place(r, c, who) {
    board[idx(r, c)] = who;
    lastMove = { r: r, c: c };
    var line = findWin(r, c, who);
    if (line) { finish(who, line); return true; }
    if (isFull()) { finish(0, null); return true; }
    return false;
}

function isFull() {
    for (var i = 0; i < board.length; i++) if (!board[i]) return false;
    return true;
}

function humanMove(r, c) {
    if (status !== 'playing' || turn !== HUMAN || thinking) return;
    if (board[idx(r, c)] !== EMPTY) { GameAudio.miss(); return; }
    GameAudio.place();
    if (place(r, c, HUMAN)) return;
    turn = AI;
    thinking = true;
    syncHud();
    /* Un respiro antes de responder: instantáneo se lee como un fallo. */
    setTimeout(function () { aiMove(); view.invalidate(); }, 260);
}

function aiMove() {
    if (status !== 'playing') { thinking = false; return; }
    var best = chooseAI();
    thinking = false;
    if (!best) { finish(0, null); return; }
    GameAudio.place();
    if (place(best.r, best.c, AI)) return;
    turn = HUMAN;
    syncHud();
}

/* ── Detección de línea ───────────────────────────────────────────── */

var LINES = [[0, 1], [1, 0], [1, 1], [1, -1]];

/* Devuelve las cinco (o más) casillas de la línea ganadora, o null. Se cuenta
 * hacia los dos lados desde la piedra recién puesta: recorrer el tablero entero
 * en cada jugada sería 225 casillas por cuatro direcciones, sin necesidad. */
function findWin(r, c, who) {
    for (var k = 0; k < 4; k++) {
        var dr = LINES[k][0], dc = LINES[k][1];
        var cells = [{ r: r, c: c }];
        var i, rr, cc;
        for (i = 1; i < 5; i++) {
            rr = r + dr * i; cc = c + dc * i;
            if (!inside(rr, cc) || board[idx(rr, cc)] !== who) break;
            cells.push({ r: rr, c: cc });
        }
        for (i = 1; i < 5; i++) {
            rr = r - dr * i; cc = c - dc * i;
            if (!inside(rr, cc) || board[idx(rr, cc)] !== who) break;
            cells.unshift({ r: rr, c: cc });
        }
        if (cells.length >= 5) return cells;
    }
    return null;
}

/* ── IA por amenazas ──────────────────────────────────────────────── */

/* Casillas vacías con alguna piedra a distancia <= 2. En el tablero vacío no
 * hay ninguna, así que el primer movimiento se fuerza al centro. */
function candidates() {
    var out = [];
    var any = false;
    for (var i = 0; i < board.length; i++) if (board[i]) { any = true; break; }
    if (!any) return [{ r: (N / 2) | 0, c: (N / 2) | 0 }];

    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            if (board[idx(r, c)] !== EMPTY) continue;
            var near = false;
            for (var dr = -2; dr <= 2 && !near; dr++) {
                for (var dc = -2; dc <= 2; dc++) {
                    var rr = r + dr, cc = c + dc;
                    if (!inside(rr, cc) || board[idx(rr, cc)] === EMPTY) continue;
                    near = true; break;
                }
            }
            if (near) out.push({ r: r, c: c });
        }
    }
    return out;
}

/* Puntúa poner una piedra de `who` en (r,c) sumando las cuatro direcciones.
 * `open` cuenta los extremos libres: un tres ABIERTO por los dos lados vale
 * muchísimo más que uno tapado, y no distinguirlo es lo que hace que una IA de
 * gomoku bloquee lo que no debe. */
function scoreAt(r, c, who) {
    var total = 0;
    for (var k = 0; k < 4; k++) {
        var dr = LINES[k][0], dc = LINES[k][1];
        var run = 1, open = 0, i, rr, cc;

        for (i = 1; i < 5; i++) {
            rr = r + dr * i; cc = c + dc * i;
            if (!inside(rr, cc)) break;
            if (board[idx(rr, cc)] === who) { run++; continue; }
            if (board[idx(rr, cc)] === EMPTY) open++;
            break;
        }
        for (i = 1; i < 5; i++) {
            rr = r - dr * i; cc = c - dc * i;
            if (!inside(rr, cc)) break;
            if (board[idx(rr, cc)] === who) { run++; continue; }
            if (board[idx(rr, cc)] === EMPTY) open++;
            break;
        }

        if (run >= 5)               total += 1000000;
        else if (run === 4 && open >= 1) total += open === 2 ? 100000 : 12000;
        else if (run === 3 && open >= 1) total += open === 2 ? 6000 : 700;
        else if (run === 2 && open >= 1) total += open === 2 ? 400 : 60;
        else if (run === 1 && open === 2) total += 20;
    }
    return total;
}

function chooseAI() {
    var cands = candidates();
    if (!cands.length) return null;
    var best = null, bestVal = -1;
    for (var i = 0; i < cands.length; i++) {
        var r = cands[i].r, c = cands[i].c;
        var mine   = scoreAt(r, c, AI);
        var theirs = scoreAt(r, c, HUMAN);
        /* El máximo de atacar y defender, con una pizca de ventaja al ataque
         * para desempatar: a igualdad de amenaza, mejor crearla que taparla.
         * Sumarlas en vez de tomar el máximo hace que dos amenazas flojas pesen
         * más que una mortal, y ahí es donde se pierde la partida. */
        var val = Math.max(mine * 1.05, theirs);
        if (val > bestVal) { bestVal = val; best = cands[i]; }
    }
    return best;
}

/* ── Fin ──────────────────────────────────────────────────────────── */

function finish(who, line) {
    status = 'over';
    winLine = line;
    if (who === HUMAN)      { stats.w++; GameAudio.win(); }
    else if (who === AI)    { stats.l++; GameAudio.gameOver(); }
    else                    { stats.d++; GameAudio.gameOver(); }
    saveStats();
    if (line) {
        for (var i = 0; i < line.length; i++) {
            fx.burst(px(line[i].c), py(line[i].r), 12,
                     { color: who === HUMAN ? '#00e5ff' : '#ff512f', speed: 90, life: 0.7, size: 2.5 });
        }
    }
    syncHud();
    gameControls.idle();
    setTimeout(function () {
        over.show({
            overTitle: who === HUMAN ? '¡Ganas!' : who === AI ? 'Gana la máquina' : 'Tablas',
            overScore: who === 0 ? 'El tablero se ha llenado'
                                 : 'Cinco en raya' ,
            overRecord: 'Ganadas: ' + stats.w + '  ·  Perdidas: ' + stats.l + '  ·  Tablas: ' + stats.d
        });
    }, 800);
}

function syncHud() {
    hud.set({
        wins: stats.w,
        losses: stats.l,
        turn: status !== 'playing' ? '—' : (thinking ? 'IA…' : (turn === HUMAN ? 'Tú' : 'IA'))
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function px(c) { return MARGIN + c * STEP; }
function py(r) { return MARGIN + r * STEP; }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#d9a441');
        g.addColorStop(1, '#c08b32');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    if (board) drawStones();
    fx.draw(ctx);
    if (winLine) drawWinLine();

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
    }

    if (status === 'idle') drawIdle();
}

function drawGrid() {
    /* Las 30 líneas en un solo trazo: una por una eran 30 stroke() por frame. */
    ctx.strokeStyle = 'rgba(60,40,10,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < N; i++) {
        ctx.moveTo(px(0), py(i) + 0.5); ctx.lineTo(px(N - 1), py(i) + 0.5);
        ctx.moveTo(px(i) + 0.5, py(0)); ctx.lineTo(px(i) + 0.5, py(N - 1));
    }
    ctx.stroke();

    /* Los cinco puntos de referencia del goban. */
    ctx.fillStyle = 'rgba(60,40,10,0.8)';
    var pts = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
    for (var k = 0; k < pts.length; k++) {
        ctx.beginPath();
        ctx.arc(px(pts[k][1]), py(pts[k][0]), 3.2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStones() {
    var rad = STEP * 0.42;
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            var v = board[idx(r, c)];
            if (!v) continue;
            var x = px(c), y = py(r);
            /* Degradado cacheado por color y radio, construido en el ORIGEN y
             * trasladado: por posición serían hasta 225 gradientes por frame. */
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = gMemo('s' + v + rad, function () {
                var g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
                if (v === HUMAN) { g.addColorStop(0, '#7fdcff'); g.addColorStop(1, '#00728f'); }
                else             { g.addColorStop(0, '#ff9a80'); g.addColorStop(1, '#a32a17'); }
                return g;
            });
            ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            if (lastMove && lastMove.r === r && lastMove.c === c) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(x, y, rad + 2, 0, Math.PI * 2); ctx.stroke();
            }
        }
    }
}

function drawWinLine() {
    var a = winLine[0], b = winLine[winLine.length - 1];
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px(a.c), py(a.r));
    ctx.lineTo(px(b.c), py(b.r));
    ctx.stroke();
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'CINCO EN RAYA',
        lines: ['Alinea cinco antes que la máquina'],
        bg: 'rgba(30,20,5,0.75)',
        color: '#ffd54a',
        lineColor: '#f0e2c0'
    });
}

/* Dibujo bajo demanda — ver GU.rafDraw. El bucle sigue vivo mientras haya
 * particulas; la jugada de la IA llega por setTimeout y avisa ella. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    draw();
    return fx.count > 0;
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    var c = Math.round((x - MARGIN) / STEP);
    var r = Math.round((y - MARGIN) / STEP);
    if (!inside(r, c)) return;
    /* Tolerancia: hay que caer cerca del cruce, no en cualquier parte. */
    if (Math.abs(x - px(c)) > STEP * 0.5 || Math.abs(y - py(r)) > STEP * 0.5) return;
    humanMove(r, c);
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Sin esto el juego sería sólo de ratón. Se ofrecen únicamente los cruces
 * VACÍOS: recorrer los 225 incluyendo los ocupados multiplicaría los pasos sin
 * llevar a ninguna jugada. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de cinco en raya. Flechas para moverte, Enter para poner piedra.',
    targets: function () {
        var out = [];
        if (!board) return out;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                if (board[idx(r, c)] !== EMPTY) continue;
                out.push({ x: px(c) - STEP / 2, y: py(r) - STEP / 2, w: STEP, h: STEP,
                           id: r + ',' + c, r: r, c: c });
            }
        }
        return out;
    },
    activate: function (t) { humanMove(t.r, t.c); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });

loadStats();
syncHud();
draw();

}());

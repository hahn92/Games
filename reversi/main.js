// Reversi (Othello) — vs IA (minimax prof. 4 + pesos posicionales) o 2 jugadores
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('reversiCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 448

var TOP = 48;           // franja superior para contadores
var SQ  = 50;           // 400 / 8
var BX  = 0;
var BY  = TOP;

var BLACK = 1, WHITE = 2;
var DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// Tabla de pesos posicionales (esquinas muy valiosas, casillas X penalizadas)
var WEIGHTS = [
    [120,-20, 20,  5,  5, 20,-20,120],
    [-20,-40, -5, -5, -5, -5,-40,-20],
    [ 20, -5, 15,  3,  3, 15, -5, 20],
    [  5, -5,  3,  3,  3,  3, -5,  5],
    [  5, -5,  3,  3,  3,  3, -5,  5],
    [ 20, -5, 15,  3,  3, 15, -5, 20],
    [-20,-40, -5, -5, -5, -5,-40,-20],
    [120,-20, 20,  5,  5, 20,-20,120]
];

/* ── Estado ── */
var gs = {
    board: null,
    turn: BLACK,
    status: 'idle',      // idle | playing | win-b | win-w | draw
    mode: 'ai',
    aiColor: WHITE,
    aiThinking: false,
    valid: [],           // movimientos válidos del turno actual [{r,c,flips:[]}]
    flipping: [],        // animaciones de volteo [{r,c,to,t}]
    lastMove: null       // {r,c}
};

/* ── Stats ── */
var mobileScoreEl = document.getElementById('mobileScore');
var stats = (function () {
    return GameStore.getJSON('reversiStats', { w: 0, l: 0, d: 0 });
}());
function saveStats() { GameStore.setJSON('reversiStats', stats); }

function countDiscs(b) {
    var bl = 0, wh = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        if (b[r][c] === BLACK) bl++;
        else if (b[r][c] === WHITE) wh++;
    }
    return { b: bl, w: wh };
}

var gameHud = GU.hud({
    status: null,
    turn:   null,
    think:  null,
    discs:  null,
    record: null,
    mobile: { el: mobileScoreEl, format: function () {
        var cnt = gs.board ? countDiscs(gs.board) : { b: 2, w: 2 };
        var st;
        if (gs.status === 'win-b') st = '¡Ganan Negras!';
        else if (gs.status === 'win-w') st = '¡Ganan Blancas!';
        else if (gs.status === 'draw') st = '¡Empate!';
        else if (gs.status === 'idle') st = 'Pulsa Nueva Partida';
        else if (gs.aiThinking) st = 'IA pensando...';
        else st = (gs.turn === BLACK ? 'Turno: Negras' : 'Turno: Blancas');
        return st + ' · ⚫' + cnt.b + ' ⚪' + cnt.w + ' · G:' + stats.w + ' P:' + stats.l;
    } }
});

function updateMobileScore() {
    var cnt = gs.board ? countDiscs(gs.board) : { b: 2, w: 2 };
    gameHud.set({
        status: gs.status, turn: gs.turn, think: gs.aiThinking,
        discs: cnt.b + '-' + cnt.w, record: stats.w + '-' + stats.l
    });
}

/* ── Inicialización ── */
function makeBoard() {
    var b = [];
    for (var r = 0; r < 8; r++) { b[r] = []; for (var c = 0; c < 8; c++) b[r][c] = 0; }
    b[3][3] = WHITE; b[3][4] = BLACK;
    b[4][3] = BLACK; b[4][4] = WHITE;
    return b;
}

function newGame() {
    gs.board = makeBoard();
    gs.turn = BLACK;
    gs.status = 'playing';
    gs.aiThinking = false;
    gs.flipping = [];
    gs.lastMove = null;
    refreshValid();
    updateModeLabel();
    updateMobileScore();
    closePopup();
    GameAudio.start();
    if (gs.mode === 'ai' && gs.aiColor === BLACK) scheduleAi();
}

/* ── Reglas ── */
function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opp(p) { return p === BLACK ? WHITE : BLACK; }
function copyBoard(b) { return b.map(function (row) { return row.slice(); }); }

// Devuelve la lista de fichas que se voltean al jugar (r,c) con color, o [] si ilegal
function flipsFor(b, r, c, color) {
    if (b[r][c] !== 0) return [];
    var all = [];
    for (var d = 0; d < DIRS.length; d++) {
        var dr = DIRS[d][0], dc = DIRS[d][1];
        var line = [];
        var rr = r + dr, cc = c + dc;
        while (inB(rr, cc) && b[rr][cc] === opp(color)) {
            line.push([rr, cc]); rr += dr; cc += dc;
        }
        if (line.length > 0 && inB(rr, cc) && b[rr][cc] === color) {
            for (var i = 0; i < line.length; i++) all.push(line[i]);
        }
    }
    return all;
}

function legalMoves(b, color) {
    var moves = [];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var f = flipsFor(b, r, c, color);
        if (f.length > 0) moves.push({ r: r, c: c, flips: f });
    }
    return moves;
}

function refreshValid() {
    gs.valid = (gs.status === 'playing') ? legalMoves(gs.board, gs.turn) : [];
}

// Aplica un movimiento al board (sin animación). Devuelve flips.
function applyMove(b, r, c, color) {
    var f = flipsFor(b, r, c, color);
    if (f.length === 0) return null;
    b[r][c] = color;
    for (var i = 0; i < f.length; i++) b[f[i][0]][f[i][1]] = color;
    return f;
}

/* ── Turno humano ── */
function tryHumanMove(r, c) {
    if (gs.status !== 'playing' || gs.aiThinking) return;
    if (gs.mode === 'ai' && gs.turn === gs.aiColor) return;
    var mv = null;
    for (var i = 0; i < gs.valid.length; i++)
        if (gs.valid[i].r === r && gs.valid[i].c === c) { mv = gs.valid[i]; break; }
    if (!mv) { GameAudio.noMatch(); return; }
    placeMove(mv);
}

function placeMove(mv) {
    var color = gs.turn;
    gs.board[mv.r][mv.c] = color;
    gs.lastMove = { r: mv.r, c: mv.c };
    GameAudio.place();
    // animación de volteo
    for (var i = 0; i < mv.flips.length; i++)
        gs.flipping.push({ r: mv.flips[i][0], c: mv.flips[i][1], to: color, t: 0, delay: i * 0.03 });
    if (mv.flips.length > 0) GameAudio.flip();
    // aplicar lógicamente las fichas volteadas
    for (var j = 0; j < mv.flips.length; j++) gs.board[mv.flips[j][0]][mv.flips[j][1]] = color;
    advanceTurn();
}

function advanceTurn() {
    var next = opp(gs.turn);
    var nextMoves = legalMoves(gs.board, next);
    if (nextMoves.length > 0) {
        gs.turn = next;
    } else {
        // el siguiente pasa; ¿puede el actual seguir?
        var sameMoves = legalMoves(gs.board, gs.turn);
        if (sameMoves.length === 0) { endGame(); return; }
        // turno se mantiene (oponente pasa)
    }
    refreshValid();
    updateMobileScore();
    if (gs.mode === 'ai' && gs.turn === gs.aiColor && gs.status === 'playing') scheduleAi();
}

function endGame() {
    var cnt = countDiscs(gs.board);
    if (cnt.b > cnt.w) gs.status = 'win-b';
    else if (cnt.w > cnt.b) gs.status = 'win-w';
    else gs.status = 'draw';
    gs.valid = [];
    if (gs.mode === 'ai') {
        var humanColor = opp(gs.aiColor);
        var humanWon = (humanColor === BLACK && gs.status === 'win-b') || (humanColor === WHITE && gs.status === 'win-w');
        if (gs.status === 'draw') stats.d++;
        else if (humanWon) stats.w++;
        else stats.l++;
        saveStats();
    }
    updateMobileScore();
    if (gs.status === 'draw') {
        GameAudio.gameOver();
    } else if (gs.mode === '2p') {
        GameAudio.win();
    } else {
        var humanWonF = (opp(gs.aiColor) === BLACK && gs.status === 'win-b') ||
                        (opp(gs.aiColor) === WHITE && gs.status === 'win-w');
        if (humanWonF) GameAudio.win(); else GameAudio.gameOver();
    }
    setTimeout(showResultPopup, 700);
}

/* ── IA: minimax con poda alfa-beta, profundidad 4 ── */
function scheduleAi() {
    gs.aiThinking = true;
    updateMobileScore();
    setTimeout(function () { doAiMove(); view.invalidate(); }, 320);
}

function evalBoard(b, color) {
    // pesos posicionales + esquinas; combinado con movilidad al final de partida
    var score = 0, oc = opp(color);
    var empties = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        if (b[r][c] === 0) { empties++; continue; }
        if (b[r][c] === color) score += WEIGHTS[r][c];
        else score -= WEIGHTS[r][c];
    }
    // movilidad
    var myMob = legalMoves(b, color).length;
    var opMob = legalMoves(b, oc).length;
    score += (myMob - opMob) * 5;
    // en el endgame, prioriza diferencia de fichas
    if (empties < 12) {
        var cnt = countDiscs(b);
        var diff = (color === BLACK ? cnt.b - cnt.w : cnt.w - cnt.b);
        score += diff * 8;
    }
    return score;
}

function minimax(b, depth, alpha, beta, current, aiColor) {
    var moves = legalMoves(b, current);
    if (depth === 0) return evalBoard(b, aiColor);
    if (moves.length === 0) {
        // pasa; si el otro tampoco puede, fin
        var oppMoves = legalMoves(b, opp(current));
        if (oppMoves.length === 0) {
            var cnt = countDiscs(b);
            var diff = (aiColor === BLACK ? cnt.b - cnt.w : cnt.w - cnt.b);
            return diff > 0 ? 100000 : (diff < 0 ? -100000 : 0);
        }
        return minimax(b, depth - 1, alpha, beta, opp(current), aiColor);
    }
    var maximizing = (current === aiColor);
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
        var nb = copyBoard(b);
        applyMove(nb, moves[i].r, moves[i].c, current);
        var val = minimax(nb, depth - 1, alpha, beta, opp(current), aiColor);
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

function doAiMove() {
    if (gs.status !== 'playing') { gs.aiThinking = false; return; }
    var color = gs.aiColor;
    var moves = legalMoves(gs.board, color);
    if (moves.length === 0) { gs.aiThinking = false; gs.turn = color; advanceTurn(); return; }
    var best = null, bestVal = -Infinity;
    for (var i = 0; i < moves.length; i++) {
        var nb = copyBoard(gs.board);
        applyMove(nb, moves[i].r, moves[i].c, color);
        var val = minimax(nb, 3, -Infinity, Infinity, opp(color), color);
        if (val > bestVal) { bestVal = val; best = moves[i]; }
    }
    gs.aiThinking = false;
    gs.turn = color;
    if (best) placeMove(best);
}

/* ── Dibujo ── */

/* El degradado de una ficha sólo depende de su radio y su color, nunca de la
 * casilla: se construye en el origen y se traslada. Antes se creaba uno por
 * ficha y por frame — hasta 64 radiales por frame en un tablero lleno. Con dos
 * radios en uso (14 en los contadores, SQ*0.4 en el tablero) la caché tiene
 * cuatro entradas y no crece más. */
var discGrad = GU.gradientMemo();

function drawDisc(cx, cy, radius, color, alpha) {
    alpha = (alpha === undefined) ? 1 : alpha;
    ctx.globalAlpha = alpha;
    var grad = discGrad(color + ':' + radius, function () {
        var light, base, dark;
        if (color === BLACK) { light = '#5a6273'; base = '#1c2230'; dark = '#06080d'; }
        else { light = '#ffffff'; base = '#e6ebf2'; dark = '#9aa6b8'; }
        var g = ctx.createRadialGradient(
            -radius * 0.35, -radius * 0.38, radius * 0.05,
            0, 0, radius
        );
        g.addColorStop(0, light);
        g.addColorStop(0.45, base);
        g.addColorStop(1, dark);
        return g;
    });
    /* translate en lugar de save/restore: esto se llama hasta 64 veces por
     * frame y el par cuesta más que deshacer la traslación a mano. */
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = 1;
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    // franja superior con contadores
    var cnt = gs.board ? countDiscs(gs.board) : { b: 2, w: 2 };
    ctx.fillStyle = '#11182b';
    ctx.fillRect(0, 0, W, TOP);

    // contador negras (izquierda)
    drawDisc(28, TOP / 2, 14, BLACK, 1);
    ctx.fillStyle = '#cfd8e6';
    ctx.font = 'bold 22px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(String(cnt.b), 48, TOP / 2 + 1);

    // contador blancas (derecha)
    drawDisc(W - 28, TOP / 2, 14, WHITE, 1);
    ctx.textAlign = 'right';
    ctx.fillText(String(cnt.w), W - 48, TOP / 2 + 1);

    // indicador de turno (centro)
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    var tlabel;
    if (gs.status === 'idle') tlabel = 'REVERSI';
    else if (gs.status.indexOf('win') === 0 || gs.status === 'draw') tlabel = 'FIN';
    else if (gs.aiThinking) tlabel = 'IA...';
    else tlabel = gs.turn === BLACK ? 'Negras' : 'Blancas';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(tlabel, W / 2, TOP / 2 + 1);

    // tablero
    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            var x = BX + c * SQ, y = BY + r * SQ;
            var dark = (r + c) % 2 === 1;
            ctx.fillStyle = dark ? '#15803d' : '#19924a';
            ctx.fillRect(x, y, SQ, SQ);
        }
    }
    // líneas de rejilla
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(BX + i * SQ, BY); ctx.lineTo(BX + i * SQ, BY + 8 * SQ); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(BX, BY + i * SQ); ctx.lineTo(BX + 8 * SQ, BY + i * SQ); ctx.stroke();
    }

    if (!gs.board) return;

    // construir conjunto de fichas en animación de volteo para saltarlas
    var animSet = {};
    for (var a = 0; a < gs.flipping.length; a++) {
        var fl = gs.flipping[a];
        animSet[fl.r * 8 + fl.c] = fl;
    }

    // fichas estáticas
    for (var rr = 0; rr < 8; rr++) {
        for (var cc = 0; cc < 8; cc++) {
            var v = gs.board[rr][cc];
            if (v === 0) continue;
            if (animSet[rr * 8 + cc]) continue;
            var ccx = BX + cc * SQ + SQ / 2;
            var ccy = BY + rr * SQ + SQ / 2;
            drawDisc(ccx, ccy, SQ * 0.4, v, 1);
        }
    }

    // fichas en volteo (escala horizontal para simular giro)
    for (var f = 0; f < gs.flipping.length; f++) {
        var fa = gs.flipping[f];
        if (fa.t < 0) continue;
        var cx = BX + fa.c * SQ + SQ / 2;
        var cy = BY + fa.r * SQ + SQ / 2;
        var prog = fa.t; // 0..1
        var scaleX = Math.abs(Math.cos(prog * Math.PI));
        var showColor = prog < 0.5 ? opp(fa.to) : fa.to;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scaleX, 1);
        drawDisc(0, 0, SQ * 0.4, showColor, 1);
        ctx.restore();
    }

    // indicadores de movimientos válidos (solo turno humano)
    var showHints = gs.status === 'playing' && !gs.aiThinking &&
        !(gs.mode === 'ai' && gs.turn === gs.aiColor);
    if (showHints) {
        ctx.fillStyle = gs.turn === BLACK ? 'rgba(20,24,34,0.55)' : 'rgba(255,255,255,0.55)';
        for (var m = 0; m < gs.valid.length; m++) {
            var mv = gs.valid[m];
            var hx = BX + mv.c * SQ + SQ / 2;
            var hy = BY + mv.r * SQ + SQ / 2;
            ctx.beginPath();
            ctx.arc(hx, hy, SQ * 0.12, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // marca del último movimiento
    if (gs.lastMove) {
        ctx.strokeStyle = '#ff512f';
        ctx.lineWidth = 2;
        var lx = BX + gs.lastMove.c * SQ;
        var ly = BY + gs.lastMove.r * SQ;
        ctx.strokeRect(lx + 2, ly + 2, SQ - 4, SQ - 4);
    }

    drawCursor();
}

/* ── Cursor de teclado ──
 * Reversi expone tryHumanMove(r, c), así que el cursor no necesita fabricar
 * coordenadas: llama al mismo punto de entrada que el clic, con la celda. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de Reversi. Flechas para moverte, Enter para colocar ficha.',
    targets: function () {
        var out = [];
        for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
            out.push({ x: BX + c * SQ, y: BY + r * SQ, w: SQ, h: SQ, id: r + ',' + c, r: r, c: c });
        }
        return out;
    },
    activate: function (t) { tryHumanMove(t.r, t.c); }
});

function drawCursor() {
    var t = cursor && cursor.target(); if (!t) return;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.strokeRect(t.x + 1.5, t.y + 1.5, SQ - 3, SQ - 3);
    ctx.strokeStyle = '#181818'; ctx.lineWidth = 1;
    ctx.strokeRect(t.x + 3.5, t.y + 3.5, SQ - 7, SQ - 7);
}

/* ── Animación / loop ── */
/* Dibujo bajo demanda — ver GU.rafDraw. El volteo de las fichas es la unica
 * animacion, asi que mientras queden fichas girando pedimos el siguiente frame
 * y al acabar el tablero se queda quieto sin gastar nada. */
var view = GU.rafDraw(function (dt) {
    // actualizar volteos
    if (gs.flipping.length > 0) {
        for (var i = gs.flipping.length - 1; i >= 0; i--) {
            var fl = gs.flipping[i];
            if (fl.delay > 0) { fl.delay -= dt; fl.t = -1; continue; }
            fl.t += dt * 4;
            if (fl.t >= 1) gs.flipping.splice(i, 1);
        }
    }
    draw();
    return gs.flipping.length > 0;
});

/* ── Entrada (click/tap con escalado) ── */
function canvasToCell(clientX, clientY) {
    var p = GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
    var px = p.x, py = p.y;
    if (py < BY) return null;
    var c = Math.floor((px - BX) / SQ);
    var r = Math.floor((py - BY) / SQ);
    if (!inB(r, c)) return null;
    return { r: r, c: c };
}

canvas.addEventListener('click', function (e) {
    var cell = canvasToCell(e.clientX, e.clientY);
    if (cell) tryHumanMove(cell.r, cell.c);
});
canvas.addEventListener('touchstart', function (e) {
    if (!e.touches.length) return;
    e.preventDefault();
    var t = e.touches[0];
    var cell = canvasToCell(t.clientX, t.clientY);
    if (cell) tryHumanMove(cell.r, cell.c);
}, { passive: false });

/* ── Botones / modo ── */
function updateModeLabel() {
    var label = gs.mode === 'ai' ? 'vs IA' : '2 Jugadores';
    var btns = document.querySelectorAll('.btn-mode');
    for (var i = 0; i < btns.length; i++) btns[i].textContent = label;
    var bl = document.getElementById('bottomLabel');
    if (bl) bl.textContent = gs.mode === 'ai' ? 'Blancas: IA' : 'Blancas: Jugador 2';
}

function toggleMode() {
    gs.mode = gs.mode === 'ai' ? '2p' : 'ai';
    newGame();
}

/* Los controles salen dos veces —panel de escritorio y tira de móvil— así que
 * van por clase, no por id. GU.buttons cablea las dos copias de golpe. */
GU.buttons('.btn-new', newGame);
GU.buttons('.btn-mode', toggleMode);

/* ── Popup de resultado ── */
function showResultPopup() {
    var cnt = countDiscs(gs.board);
    var title, msg;
    if (gs.status === 'draw') { title = '¡Empate!'; }
    else if (gs.status === 'win-b') { title = 'Ganan las Negras'; }
    else { title = 'Ganan las Blancas'; }
    msg = 'Negras ' + cnt.b + ' — ' + cnt.w + ' Blancas';

    var pop = document.createElement('div');
    pop.className = 'popup';
    pop.id = 'reversiPopup';
    var content = document.createElement('div');
    content.className = 'popup-content';
    var h = document.createElement('h2'); h.textContent = title;
    var p = document.createElement('p'); p.textContent = msg;
    var statLine = document.createElement('p');
    statLine.style.fontSize = '1rem';
    statLine.style.color = '#888';
    statLine.textContent = 'Ganadas: ' + stats.w + ' · Perdidas: ' + stats.l + ' · Empates: ' + stats.d;
    var btn = document.createElement('button');
    btn.className = 'btn-new';
    btn.style.cssText = 'background:var(--grad-primary);color:#222;border:none;border-radius:8px;padding:0.9rem 2rem;font-size:1.05rem;font-weight:bold;cursor:pointer;margin-top:0.5rem;';
    btn.textContent = 'Jugar de nuevo';
    btn.addEventListener('click', function () { GameAudio.click(); newGame(); });
    content.appendChild(h); content.appendChild(p);
    if (gs.mode === 'ai') content.appendChild(statLine);
    content.appendChild(btn);
    pop.appendChild(content);
    document.body.appendChild(pop);
}
function closePopup() {
    var p = document.getElementById('reversiPopup');
    if (p) p.remove();
}

/* ── Arranque ── */
gs.board = makeBoard();
gs.status = 'idle';
updateModeLabel();
updateMobileScore();
// auto-iniciar primera partida
newGame();

})();

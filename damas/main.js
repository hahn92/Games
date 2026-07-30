// Damas (inglesas/americanas) — vs IA (minimax + alpha-beta) o 2 jugadores
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('damasCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 360
var H = canvas.height;  // 432

var BY = 32;            // board top y
var BX = 0;
var SQ = 45;            // 360 / 8

/* ──────────────────────────────────────────────
   Estado del juego
   board[r][c] = null | { c:'r'|'b', king:bool }
   'r' = Rojas (humano, abajo, avanza hacia arriba, dr=-1)
   'b' = Azules (IA, arriba, avanza hacia abajo, dr=+1)
   ────────────────────────────────────────────── */
var gs = {
    board: null,
    turn: 'r',
    sel: null,         // {r,c}
    moves: [],         // movimientos legales de la pieza seleccionada
    status: 'idle',    // idle | playing | win-r | win-b
    mode: 'ai',
    aiColor: 'b',
    aiThinking: false,
    lastMove: null     // {fr,fc,tr,tc}
};

/* ── Stats persistentes (vs IA) ── */
var mobileScoreEl = document.getElementById('mobileScore');
var stats = (function () {
    try { return JSON.parse(localStorage.getItem('damasStats') || '{"w":0,"l":0}'); }
    catch (e) { return { w: 0, l: 0 }; }
}());
function saveStats() { try { localStorage.setItem('damasStats', JSON.stringify(stats)); } catch (e) {} }

function updateMobileScore() {
    if (!mobileScoreEl) return;
    var st = gs.status === 'win-r' ? '¡Ganan Rojas!'
           : gs.status === 'win-b' ? '¡Ganan Azules!'
           : gs.status === 'idle'  ? 'Pulsa Nueva Partida'
           : gs.aiThinking         ? 'IA pensando...'
           : (gs.turn === 'r' ? 'Turno: Rojas' : 'Turno: Azules');
    mobileScoreEl.textContent = st + ' · G:' + stats.w + ' P:' + stats.l;
}

/* ── Inicialización del tablero ── */
function makeBoard() {
    var b = [];
    for (var r = 0; r < 8; r++) {
        b[r] = [];
        for (var c = 0; c < 8; c++) {
            var dark = (r + c) % 2 === 1;   // las fichas van en casillas oscuras
            if (dark && r < 3)      b[r][c] = { c: 'b', king: false };
            else if (dark && r > 4) b[r][c] = { c: 'r', king: false };
            else                    b[r][c] = null;
        }
    }
    return b;
}

function newGame() {
    gs.board = makeBoard();
    gs.turn = 'r';
    gs.sel = null;
    gs.moves = [];
    gs.lastMove = null;
    gs.aiThinking = false;
    gs.status = 'playing';
    updateModeLabel();
    updateMobileScore();
    GameAudio.start();
    if (gs.mode === 'ai' && gs.aiColor === 'r') {
        gs.aiThinking = true;
        setTimeout(doAiMove, 300);
    }
}

/* ── Helpers ── */
function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function copyBoard(b) {
    return b.map(function (row) {
        return row.map(function (p) { return p ? { c: p.c, king: p.king } : null; });
    });
}
function dirsFor(p) {
    // direcciones de fila válidas para un peón / dama
    if (p.king) return [-1, 1];
    return p.c === 'r' ? [-1] : [1];   // rojas suben, azules bajan
}

/* ──────────────────────────────────────────────
   Generación de movimientos
   Captura obligatoria: si existe alguna captura,
   sólo se permiten capturas. Las capturas se
   encadenan desde una misma ficha.
   Cada move: { fr,fc,tr,tc, caps:[{r,c}...] }
   ────────────────────────────────────────────── */
function getJumpsFrom(b, r, c, piece, captured) {
    // Devuelve secuencias de saltos (encadenadas) desde (r,c)
    var seqs = [];
    var rowDirs = dirsFor(piece);
    var found = false;
    for (var i = 0; i < rowDirs.length; i++) {
        var dr = rowDirs[i];
        var cols = [-1, 1];
        for (var j = 0; j < cols.length; j++) {
            var dc = cols[j];
            var mr = r + dr, mc = c + dc;       // casilla saltada (rival)
            var lr = r + 2 * dr, lc = c + 2 * dc; // aterrizaje
            if (!inB(lr, lc)) continue;
            var mid = b[mr] && b[mr][mc];
            if (!mid || mid.c === piece.c) continue;
            // no saltar dos veces la misma ficha
            var already = false;
            for (var k = 0; k < captured.length; k++)
                if (captured[k].r === mr && captured[k].c === mc) { already = true; break; }
            if (already) continue;
            if (b[lr][lc]) continue; // aterrizaje ocupado
            found = true;
            // simular salto
            var nb = copyBoard(b);
            nb[lr][lc] = nb[r][c];
            nb[r][c] = null;
            nb[mr][mc] = null;
            // ¿corona en este salto? (peón llega al fondo) -> el salto termina
            var becameKing = !piece.king &&
                ((piece.c === 'r' && lr === 0) || (piece.c === 'b' && lr === 7));
            var newPiece = becameKing ? { c: piece.c, king: true } : piece;
            if (becameKing) nb[lr][lc] = newPiece;
            var newCaptured = captured.concat([{ r: mr, c: mc }]);
            var cont = becameKing ? [] : getJumpsFrom(nb, lr, lc, newPiece, newCaptured);
            if (cont.length === 0) {
                seqs.push({ fr: r, fc: c, tr: lr, tc: lc, caps: newCaptured });
            } else {
                for (var s = 0; s < cont.length; s++) {
                    seqs.push({ fr: r, fc: c, tr: cont[s].tr, tc: cont[s].tc, caps: cont[s].caps });
                }
            }
        }
    }
    return seqs;
}

function getSimpleMovesFrom(b, r, c, piece) {
    var moves = [];
    var rowDirs = dirsFor(piece);
    for (var i = 0; i < rowDirs.length; i++) {
        var dr = rowDirs[i];
        [-1, 1].forEach(function (dc) {
            var nr = r + dr, nc = c + dc;
            if (inB(nr, nc) && !b[nr][nc]) {
                moves.push({ fr: r, fc: c, tr: nr, tc: nc, caps: [] });
            }
        });
    }
    return moves;
}

function getAllMoves(b, color) {
    var jumps = [];
    var simple = [];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p || p.c !== color) continue;
        var js = getJumpsFrom(b, r, c, p, []);
        if (js.length) jumps = jumps.concat(js);
        else simple = simple.concat(getSimpleMovesFrom(b, r, c, p));
    }
    // Captura obligatoria
    return jumps.length ? jumps : simple;
}

function getMovesFor(b, r, c) {
    // movimientos legales para la ficha de (r,c), respetando captura obligatoria global
    var p = b[r][c];
    if (!p) return [];
    var all = getAllMoves(b, p.c);
    return all.filter(function (m) { return m.fr === r && m.fc === c; });
}

/* ── Aplicar un movimiento sobre el tablero global ── */
function applyMove(b, mv) {
    var nb = copyBoard(b);
    var p = nb[mv.fr][mv.fc];
    nb[mv.fr][mv.fc] = null;
    for (var i = 0; i < mv.caps.length; i++) nb[mv.caps[i].r][mv.caps[i].c] = null;
    // coronación
    if (!p.king && ((p.c === 'r' && mv.tr === 0) || (p.c === 'b' && mv.tr === 7))) {
        p = { c: p.c, king: true };
    }
    nb[mv.tr][mv.tc] = p;
    return nb;
}

function countPieces(b, color) {
    var n = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++)
        if (b[r][c] && b[r][c].c === color) n++;
    return n;
}

/* ── Ejecutar movimiento (estado global) ── */
function executeMove(mv) {
    gs.board = applyMove(gs.board, mv);
    gs.lastMove = { fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc };
    var captured = mv.caps.length > 0;
    gs.turn = gs.turn === 'r' ? 'b' : 'r';
    gs.sel = null;
    gs.moves = [];
    // ¿fin de partida? (rival sin fichas o sin movimientos)
    var oppMoves = getAllMoves(gs.board, gs.turn);
    if (countPieces(gs.board, gs.turn) === 0 || oppMoves.length === 0) {
        // el jugador que acaba de mover gana
        var winner = gs.turn === 'r' ? 'b' : 'r';
        gs.status = winner === 'r' ? 'win-r' : 'win-b';
        if (gs.mode === 'ai') {
            if (winner === gs.aiColor) stats.l++; else stats.w++;
            saveStats();
        }
    }
    updateMobileScore();
    return captured;
}

/* ──────────────────────────────────────────────
   IA — minimax con poda alfa-beta, profundidad 6
   Maximiza para 'b' (azules, IA por defecto).
   ────────────────────────────────────────────── */
var AI_DEPTH = 6;

function evaluate(b) {
    // positivo = bueno para azules ('b'); ponderación por avance y damas
    var score = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p) continue;
        var v = p.king ? 175 : 100;
        // bonus por avance hacia coronación
        if (!p.king) {
            v += p.c === 'b' ? r * 4 : (7 - r) * 4;
        }
        // bonus por control central
        if (c >= 2 && c <= 5) v += 4;
        // bonus borde lateral (más seguro)
        if (c === 0 || c === 7) v += 6;
        score += p.c === 'b' ? v : -v;
    }
    return score;
}

function minimax(b, depth, alpha, beta, color) {
    var isMax = color === 'b';
    var moves = getAllMoves(b, color);
    var opp = color === 'b' ? 'r' : 'b';
    if (moves.length === 0) {
        // color no puede mover -> pierde
        return isMax ? -100000 + depth : 100000 - depth;
    }
    if (depth === 0) return evaluate(b);
    var i, ns, v;
    if (isMax) {
        var best = -Infinity;
        for (i = 0; i < moves.length; i++) {
            ns = applyMove(b, moves[i]);
            v = minimax(ns, depth - 1, alpha, beta, opp);
            if (v > best) best = v;
            if (best > alpha) alpha = best;
            if (beta <= alpha) break;
        }
        return best;
    } else {
        var best2 = Infinity;
        for (i = 0; i < moves.length; i++) {
            ns = applyMove(b, moves[i]);
            v = minimax(ns, depth - 1, alpha, beta, opp);
            if (v < best2) best2 = v;
            if (best2 < beta) beta = best2;
            if (beta <= alpha) break;
        }
        return best2;
    }
}

function getBestMove() {
    var col = gs.aiColor;
    var isMax = col === 'b';
    var opp = col === 'b' ? 'r' : 'b';
    var moves = getAllMoves(gs.board, col);
    if (!moves.length) return null;
    // barajar para variar entre movimientos equivalentes
    for (var i = moves.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = moves[i]; moves[i] = moves[j]; moves[j] = t;
    }
    var best = isMax ? -Infinity : Infinity, bestMv = moves[0];
    for (var k = 0; k < moves.length; k++) {
        var ns = applyMove(gs.board, moves[k]);
        var v = minimax(ns, AI_DEPTH - 1, -Infinity, Infinity, opp);
        if ((isMax && v > best) || (!isMax && v < best)) { best = v; bestMv = moves[k]; }
    }
    return bestMv;
}

function doAiMove() {
    if (gs.status !== 'playing') { gs.aiThinking = false; return; }
    var mv = getBestMove();
    if (mv) {
        var captured = executeMove(mv);
        if (gs.status === 'win-r' || gs.status === 'win-b') GameAudio.gameOver();
        else if (captured) GameAudio.brick();
        else GameAudio.place();
    }
    gs.aiThinking = false;
}

/* ════════════════════════════════════════════════════
   RENDERIZADO — tema oscuro neón, fichas 3D
   ════════════════════════════════════════════════════ */

/* ── Paletas por color de ficha ── */
var RED  = { hi: '#ff8a5c', mid: '#ff512f', lo: '#7a1505', ring: '#ffb38a', glow: '#ff512f', crown: '#ffe08a' };
var BLU  = { hi: '#bfeaff', mid: '#3aa0e0', lo: '#0a2a52', ring: '#8fd3f4', glow: '#8fd3f4', crown: '#ffe08a' };
function pal(color) { return color === 'r' ? RED : BLU; }

function sqXY(r, c) { return { x: BX + c * SQ, y: BY + r * SQ }; }

function accentGrad(x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#8fd3f4'); g.addColorStop(0.5, '#b07898'); g.addColorStop(1, '#ff512f');
    return g;
}

function drawBoard() {
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var p = sqXY(r, c);
        var isLight = (r + c) % 2 === 0;
        var g = ctx.createLinearGradient(p.x, p.y, p.x + SQ, p.y + SQ);
        if (isLight) { g.addColorStop(0, '#c8a858'); g.addColorStop(1, '#b49040'); }
        else         { g.addColorStop(0, '#253a6a'); g.addColorStop(1, '#142248'); }
        ctx.fillStyle = g; ctx.fillRect(p.x, p.y, SQ, SQ);
    }
    ctx.strokeStyle = accentGrad(BX, BY, BX + 8 * SQ, BY + 8 * SQ);
    ctx.lineWidth = 2.5; ctx.strokeRect(BX + 1.25, BY + 1.25, 8 * SQ - 2.5, 8 * SQ - 2.5);
}

function drawHighlights() {
    if (gs.lastMove) {
        [[gs.lastMove.fr, gs.lastMove.fc], [gs.lastMove.tr, gs.lastMove.tc]].forEach(function (s) {
            var p = sqXY(s[0], s[1]);
            ctx.fillStyle = 'rgba(255,210,0,0.28)'; ctx.fillRect(p.x, p.y, SQ, SQ);
        });
    }
    if (gs.sel) {
        var sp = sqXY(gs.sel.r, gs.sel.c);
        ctx.fillStyle = 'rgba(143,211,244,0.45)'; ctx.fillRect(sp.x, sp.y, SQ, SQ);
        ctx.strokeStyle = 'rgba(143,211,244,0.95)'; ctx.lineWidth = 2.5;
        ctx.strokeRect(sp.x + 1.5, sp.y + 1.5, SQ - 3, SQ - 3);
        gs.moves.forEach(function (m) {
            var mp = sqXY(m.tr, m.tc), cx2 = mp.x + SQ / 2, cy2 = mp.y + SQ / 2;
            if (m.caps.length) {
                ctx.strokeStyle = 'rgba(255,81,47,0.85)'; ctx.lineWidth = SQ * 0.11;
                ctx.beginPath(); ctx.arc(cx2, cy2, SQ * 0.40, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(143,211,244,0.55)';
                ctx.beginPath(); ctx.arc(cx2, cy2, SQ * 0.19, 0, Math.PI * 2); ctx.fill();
            }
        });
    }
}

/* ── Ficha con gradiente radial 3D (look connectfour) ── */
function drawPiece(piece, r, c) {
    var pos = sqXY(r, c), cx = pos.x + SQ / 2, cy = pos.y + SQ / 2;
    var rad = SQ * 0.38;
    var C = pal(piece.c);

    // sombra de contacto
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, cy + rad * 0.42, rad * 0.92, rad * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    // disco base (anillo exterior)
    var gr = ctx.createRadialGradient(cx - rad * 0.30, cy - rad * 0.32, rad * 0.08, cx, cy, rad);
    gr.addColorStop(0, C.hi); gr.addColorStop(0.55, C.mid); gr.addColorStop(1, C.lo);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();

    // anillo grabado interior
    ctx.strokeStyle = C.lo; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.ring; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.62, 0, Math.PI * 2); ctx.stroke();

    // realce especular
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath(); ctx.ellipse(cx - rad * 0.28, cy - rad * 0.32, rad * 0.30, rad * 0.20, -0.5, 0, Math.PI * 2); ctx.fill();

    // borde con brillo
    ctx.strokeStyle = C.glow; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();

    // corona (dama)
    if (piece.king) {
        drawCrown(cx, cy, rad * 0.62, C);
    }
}

function drawCrown(cx, cy, s, C) {
    // corona estilizada con 3 puntas dibujada con paths
    ctx.fillStyle = C.crown;
    ctx.beginPath();
    var by = cy + s * 0.42;     // base inferior
    var ty = cy - s * 0.48;     // alto de las puntas
    var my = cy - s * 0.05;     // valle entre puntas
    var lw = s * 0.78;          // mitad de ancho
    ctx.moveTo(cx - lw, by);
    ctx.lineTo(cx - lw, ty);
    ctx.lineTo(cx - lw * 0.5, my);
    ctx.lineTo(cx, ty);
    ctx.lineTo(cx + lw * 0.5, my);
    ctx.lineTo(cx + lw, ty);
    ctx.lineTo(cx + lw, by);
    ctx.closePath();
    ctx.fill();
    // banda de la base
    ctx.fillRect(cx - lw, by - s * 0.10, lw * 2, s * 0.20);
    // contorno
    ctx.strokeStyle = 'rgba(120,70,0,0.7)'; ctx.lineWidth = 1;
    ctx.stroke();
    // gemas en las puntas
    ctx.fillStyle = C.glow;
    [[cx - lw, ty], [cx, ty], [cx + lw, ty]].forEach(function (pt) {
        ctx.beginPath(); ctx.arc(pt[0], pt[1], s * 0.13, 0, Math.PI * 2); ctx.fill();
    });
}

/* ── HUD superior e inferior ── */
function drawHUD() {
    var gTop = ctx.createLinearGradient(0, 0, W, 0);
    gTop.addColorStop(0, '#08101e'); gTop.addColorStop(1, '#140810');
    ctx.fillStyle = gTop; ctx.fillRect(0, 0, W, BY);
    ctx.strokeStyle = accentGrad(0, BY, W, BY); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, BY - 0.75); ctx.lineTo(W, BY - 0.75); ctx.stroke();

    var tx = gs.status === 'idle'  ? 'DAMAS'
           : gs.status === 'win-r' ? '¡Ganan Rojas!'
           : gs.status === 'win-b' ? '¡Ganan Azules!'
           : gs.aiThinking         ? 'IA pensando...'
           : gs.turn === 'r'       ? 'Turno: Rojas' : 'Turno: Azules';
    var txCol = (gs.status === 'win-r' || gs.status === 'win-b') ? '#ffd54a'
              : gs.aiThinking ? '#8fd3f4' : '#f0f0f0';
    ctx.fillStyle = txCol; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tx, W / 2, BY / 2);
    ctx.fillStyle = gs.mode === 'ai' ? '#8fd3f4' : '#ffd54a';
    ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(gs.mode === 'ai' ? 'vs IA' : '2P', W - 5, BY / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Barra inferior: contador de fichas
    var botY = BY + 8 * SQ;
    var gBot = ctx.createLinearGradient(0, botY, 0, H);
    gBot.addColorStop(0, '#140810'); gBot.addColorStop(1, '#08101e');
    ctx.fillStyle = gBot; ctx.fillRect(0, botY, W, H - botY);
    ctx.strokeStyle = accentGrad(0, botY, W, botY); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, botY + 0.75); ctx.lineTo(W, botY + 0.75); ctx.stroke();

    var nr = countPieces(gs.board, 'r'), nb = countPieces(gs.board, 'b');
    // mini ficha roja
    var ry = botY + 22;
    var rg = ctx.createRadialGradient(W / 2 - 70, ry - 4, 2, W / 2 - 70, ry, 12);
    rg.addColorStop(0, RED.hi); rg.addColorStop(1, RED.lo);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(W / 2 - 70, ry, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = RED.glow; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(nr, W / 2 - 52, ry);
    // mini ficha azul
    var bg = ctx.createRadialGradient(W / 2 + 30, ry - 4, 2, W / 2 + 30, ry, 12);
    bg.addColorStop(0, BLU.hi); bg.addColorStop(1, BLU.lo);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(W / 2 + 30, ry, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = BLU.glow; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(nb, W / 2 + 48, ry);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawIdleOverlay() {
    ctx.fillStyle = 'rgba(4,8,18,0.84)'; ctx.fillRect(BX, BY, 8 * SQ, 8 * SQ);
    ctx.fillStyle = accentGrad(W / 2 - 60, BY + 4 * SQ - 22, W / 2 + 60, BY + 4 * SQ - 2);
    ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DAMAS', W / 2, BY + 4 * SQ - 18);
    ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(143,211,244,0.80)';
    ctx.fillText('Pulsa "Nueva Partida"', W / 2, BY + 4 * SQ + 22);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

function render() {
    ctx.clearRect(0, 0, W, H);
    drawBoard();
    if (gs.status !== 'idle') {
        drawHighlights();
        for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++)
            if (gs.board[r][c]) drawPiece(gs.board[r][c], r, c);
    } else {
        drawIdleOverlay();
    }
    drawHUD();
}

/* ── Entrada ── */
function getSquare(px, py) {
    var c = Math.floor((px - BX) / SQ), r = Math.floor((py - BY) / SQ);
    return (r < 0 || r > 7 || c < 0 || c > 7) ? null : { r: r, c: c };
}

function handleClick(px, py) {
    if (gs.status !== 'playing') return;
    if (gs.mode === 'ai' && gs.turn === gs.aiColor) return;
    if (gs.aiThinking) return;
    var sq = getSquare(px, py); if (!sq) return;

    // ¿clic en un destino válido?
    if (gs.sel) {
        for (var i = 0; i < gs.moves.length; i++) {
            if (gs.moves[i].tr === sq.r && gs.moves[i].tc === sq.c) {
                var captured = executeMove(gs.moves[i]);
                if (gs.status === 'win-r' || gs.status === 'win-b') GameAudio.gameOver();
                else if (captured) GameAudio.brick();
                else GameAudio.place();
                if (gs.mode === 'ai' && gs.status === 'playing' && gs.turn === gs.aiColor) {
                    gs.aiThinking = true; setTimeout(doAiMove, 300);
                }
                return;
            }
        }
    }

    // seleccionar una ficha propia que tenga movimientos
    var p = gs.board[sq.r][sq.c];
    if (p && p.c === gs.turn) {
        var mv = getMovesFor(gs.board, sq.r, sq.c);
        if (mv.length) {
            gs.sel = sq; gs.moves = mv;
            GameAudio.click();
        } else {
            gs.sel = null; gs.moves = [];
        }
    } else {
        gs.sel = null; gs.moves = [];
    }
}

/* ── Eventos ── */
canvas.addEventListener('click', function (e) {
    var rect = canvas.getBoundingClientRect();
    handleClick((e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height));
});
canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect(), t = e.touches[0];
    handleClick((t.clientX - rect.left) * (W / rect.width), (t.clientY - rect.top) * (H / rect.height));
}, { passive: false });

function updateModeLabel() {
    document.querySelectorAll('.btn-mode').forEach(function (b) {
        b.textContent = gs.mode === 'ai' ? 'vs IA' : '2 Jugadores';
    });
    var lbl = document.getElementById('bottomLabel');
    if (lbl) lbl.textContent = gs.mode === 'ai' ? 'Azules: IA' : 'Azules: Humano';
}
document.querySelectorAll('.btn-new').forEach(function (b) {
    b.addEventListener('click', function () { GameAudio.click(); newGame(); });
});
document.querySelectorAll('.btn-mode').forEach(function (b) {
    b.addEventListener('click', function () {
        GameAudio.click();
        gs.mode = gs.mode === 'ai' ? '2p' : 'ai';
        gs.aiColor = 'b';
        updateModeLabel();
        newGame();
    });
});

/* ── Init ── */
gs.board = makeBoard();
gs.status = 'idle';
updateModeLabel();
updateMobileScore();
var lastRenderTs = 0;
requestAnimationFrame(function loop(ts) {
    if (ts - lastRenderTs >= 15) { lastRenderTs = ts; render(); }
    requestAnimationFrame(loop);
});

}());

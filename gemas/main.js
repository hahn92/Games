/* ═══════════════════════════════════════════════════════════════════
 * GEMAS — catálogo de juegos JS
 * Mecánica: Match-3 por intercambio. Toca una gema y luego una
 * adyacente para intercambiarlas. Alinea 3+ del mismo tipo para
 * hacerlas estallar; las cascadas encadenan combos que multiplican
 * la puntuación. 30 movimientos por ronda. Récord persistente en
 * localStorage.
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── canvas & DOM ───────────────────────────────────────────── */
    var canvas = document.getElementById('gemasCanvas');
    var ctx    = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;

    var scoreEl     = document.getElementById('score');
    var movesEl     = document.getElementById('movesLeft');
    var highEl      = document.getElementById('highScore');
    var mobileScore = document.getElementById('mobileScore');
    var startBtn    = document.getElementById('startBtn');
    var restartBtn  = document.getElementById('restartBtn');
    var gameOverPop = document.getElementById('gameOverPopup');
    var finalScore  = document.getElementById('finalScore');
    var finalBest   = document.getElementById('finalBest');
    var playAgain   = document.getElementById('playAgainBtn');

    /* ── constantes ─────────────────────────────────────────────── */
    var COLS = 8, ROWS = 8;
    var CELL = 44;
    var BOARD_X = (W - COLS * CELL) / 2;    // 4
    var BOARD_Y = 100;
    var BOARD_W = COLS * CELL;
    var BOARD_H = ROWS * CELL;
    var NUM_TYPES = 6;
    var MOVES_PER_ROUND = 30;
    var GEM_RADIUS = CELL * 0.38;           // ~16.7
    var FALL_SPEED = 9;                     // px por step ~60fps
    var SWAP_SPEED = 5;
    var FADE_SPEED = 0.09;
    var DELTA_THR = 15;

    /* ── paleta de gemas (6 tipos, 6 formas distintas) ─────────── */
    var GEM_COLORS = [
        { base: '#ff4757', light: '#ffa0a7', dark: '#7a1a21' }, // 0 rojo   → rombo
        { base: '#3fa9ff', light: '#8fd0ff', dark: '#0f3f77' }, // 1 azul   → círculo
        { base: '#2ecc71', light: '#8fe3b2', dark: '#155e34' }, // 2 verde  → triángulo
        { base: '#ffd93d', light: '#ffee99', dark: '#8a6b00' }, // 3 amar   → hexágono
        { base: '#c66cff', light: '#e4b2ff', dark: '#5b1f8a' }, // 4 púrp   → estrella
        { base: '#ff9f43', light: '#ffc98a', dark: '#8a4e0f' }  // 5 naranj → cuadrado
    ];

    /* ── estado ─────────────────────────────────────────────────── */
    var board = [];          // board[r][c] = {type,x,y,tx,ty,fading,fadeT} | null
    var selected = null;     // {r,c}
    var hover = null;        // {r,c} — highlight bajo cursor
    var phase = 'menu';      // menu | idle | swap-forward | swap-back | clearing | falling | gameover
    var pendingSwap = null;  // recuerda el swap para revertir
    var cascade = 0;
    var score = 0;
    var moves = MOVES_PER_ROUND;
    var highScore = 0;
    var running = false;
    var lastTs = 0;
    var particles = [];
    var comboMsg = '';
    var comboMsgT = 0;
    var screenShake = 0;
    var shakeOx = 0, shakeOy = 0;
    var bgStars = [];        // decoración fondo pre-calculada

    /* ── localStorage ──────────────────────────────────────────── */
    function loadHigh() {
        try {
            var v = parseInt(localStorage.getItem('gemasHighScore') || '0', 10);
            highScore = isNaN(v) ? 0 : v;
        } catch (e) { highScore = 0; }
    }
    function saveHigh() {
        try { localStorage.setItem('gemasHighScore', String(highScore)); } catch (e) {}
    }

    /* ── HUD ───────────────────────────────────────────────────── */
    function updateHUD() {
        if (scoreEl) scoreEl.textContent = score;
        if (movesEl) movesEl.textContent = moves;
        if (highEl)  highEl.textContent  = highScore;
        if (mobileScore) mobileScore.textContent =
            'Puntos: ' + score + '  •  Movs: ' + moves + '  •  Récord: ' + highScore;
    }

    /* ── gradientes cacheados ──────────────────────────────────── */
    var bgGrad = null;
    var gemGrads = [];        // uno por tipo (centrado en 0,0)
    function buildGradients() {
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#140a2a');
        bgGrad.addColorStop(1, '#05061a');
        gemGrads.length = 0;
        for (var t = 0; t < NUM_TYPES; t++) {
            var col = GEM_COLORS[t];
            var g = ctx.createRadialGradient(-GEM_RADIUS * 0.35, -GEM_RADIUS * 0.4, 0, 0, 0, GEM_RADIUS);
            g.addColorStop(0, col.light);
            g.addColorStop(0.55, col.base);
            g.addColorStop(1, col.dark);
            gemGrads.push(g);
        }
    }

    /* ── fondo decorativo (pre-calculado, sin Math.random en render) */
    function buildBgStars() {
        bgStars.length = 0;
        for (var i = 0; i < 36; i++) {
            bgStars.push({
                x: Math.floor(Math.random() * W),
                y: Math.floor(Math.random() * H),
                s: 1 + Math.random() * 1.4,
                a: 0.12 + Math.random() * 0.28
            });
        }
    }

    /* ── helpers de coordenadas ────────────────────────────────── */
    function cellX(c) { return BOARD_X + c * CELL + CELL / 2; }
    function cellY(r) { return BOARD_Y + r * CELL + CELL / 2; }
    function inBoard(px, py) {
        return px >= BOARD_X && px < BOARD_X + BOARD_W &&
               py >= BOARD_Y && py < BOARD_Y + BOARD_H;
    }
    function cellAt(px, py) {
        var c = Math.floor((px - BOARD_X) / CELL);
        var r = Math.floor((py - BOARD_Y) / CELL);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
        return { r: r, c: c };
    }
    function adjacent(a, b) {
        return (a.r === b.r && Math.abs(a.c - b.c) === 1) ||
               (a.c === b.c && Math.abs(a.r - b.r) === 1);
    }

    /* ── construir tablero sin matches iniciales ───────────────── */
    function randomTypeFor(r, c) {
        var t, tries = 0;
        while (tries++ < 60) {
            t = Math.floor(Math.random() * NUM_TYPES);
            if (c >= 2 &&
                board[r][c - 1] && board[r][c - 1].type === t &&
                board[r][c - 2] && board[r][c - 2].type === t) continue;
            if (r >= 2 &&
                board[r - 1][c] && board[r - 1][c].type === t &&
                board[r - 2][c] && board[r - 2][c].type === t) continue;
            return t;
        }
        return t;
    }
    function buildBoard() {
        board = [];
        for (var r = 0; r < ROWS; r++) {
            board[r] = [];
            for (var c = 0; c < COLS; c++) {
                board[r][c] = null;
            }
        }
        for (var r2 = 0; r2 < ROWS; r2++) {
            for (var c2 = 0; c2 < COLS; c2++) {
                var t = randomTypeFor(r2, c2);
                board[r2][c2] = makeGem(t, r2, c2);
            }
        }
    }
    function makeGem(type, r, c, spawnY) {
        var x = cellX(c);
        var y = (typeof spawnY === 'number') ? spawnY : cellY(r);
        return {
            type: type,
            x: x, y: y,
            tx: cellX(c), ty: cellY(r),
            fading: false, fadeT: 0
        };
    }

    /* ── detectar matches ──────────────────────────────────────── */
    function findMatches() {
        var out = {}; // "r,c" -> true
        // horizontal
        for (var r = 0; r < ROWS; r++) {
            var run = 1;
            for (var c = 1; c <= COLS; c++) {
                var prev = board[r][c - 1];
                var cur  = c < COLS ? board[r][c] : null;
                var same = !!(prev && cur && !prev.fading && !cur.fading && prev.type === cur.type);
                if (same) run++;
                else {
                    if (run >= 3) {
                        for (var k = c - run; k < c; k++) out[r + ',' + k] = true;
                    }
                    run = 1;
                }
            }
        }
        // vertical
        for (var c2 = 0; c2 < COLS; c2++) {
            var run2 = 1;
            for (var r2 = 1; r2 <= ROWS; r2++) {
                var prev2 = board[r2 - 1][c2];
                var cur2  = r2 < ROWS ? board[r2][c2] : null;
                var same2 = !!(prev2 && cur2 && !prev2.fading && !cur2.fading && prev2.type === cur2.type);
                if (same2) run2++;
                else {
                    if (run2 >= 3) {
                        for (var k2 = r2 - run2; k2 < r2; k2++) out[k2 + ',' + c2] = true;
                    }
                    run2 = 1;
                }
            }
        }
        return out;
    }
    function hasMatches(m) { for (var k in m) return true; return false; }

    /* ── intercambio ───────────────────────────────────────────── */
    function swapCells(r1, c1, r2, c2) {
        var a = board[r1][c1], b = board[r2][c2];
        board[r1][c1] = b;
        board[r2][c2] = a;
        if (a) { a.tx = cellX(c2); a.ty = cellY(r2); }
        if (b) { b.tx = cellX(c1); b.ty = cellY(r1); }
    }

    /* ── iniciar swap tras input ──────────────────────────────── */
    function tryStartSwap(a, b) {
        if (!adjacent(a, b)) return false;
        if (phase !== 'idle') return false;
        if (moves <= 0) return false;
        pendingSwap = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
        swapCells(a.r, a.c, b.r, b.c);
        phase = 'swap-forward';
        cascade = 0;
        GameAudio.slide();
        return true;
    }

    /* ── iniciar limpieza de matches ───────────────────────────── */
    function startClearing(matches) {
        var count = 0;
        var firstX = 0, firstY = 0;
        for (var key in matches) {
            var parts = key.split(',');
            var r = +parts[0], c = +parts[1];
            var g = board[r][c];
            if (!g || g.fading) continue;
            g.fading = true;
            g.fadeT = 0;
            count++;
            var col = GEM_COLORS[g.type].base;
            firstX = g.x; firstY = g.y;
            for (var i = 0; i < 6; i++) {
                particles.push({
                    x: g.x, y: g.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.9) * 3.5,
                    life: 1,
                    color: col,
                    size: 2 + Math.random() * 2.5
                });
            }
        }
        // score: base 20 por gema, +50 bonus cada gema >3 en un grupo (aprox via count-3)
        // cascade: cada cascada suma 0.5x multiplicador
        var mult = 1 + cascade * 0.5;
        var bonus = count > 3 ? (count - 3) * 30 : 0;
        var gained = Math.floor((count * 20 + bonus) * mult);
        score += gained;

        // mensaje & audio (fuera del render loop)
        if (cascade >= 1) {
            GameAudio.scoreHigh();
            screenShake = Math.min(16, 6 + cascade * 2);
            comboMsg = 'COMBO x' + (cascade + 1);
            comboMsgT = 1;
        } else if (count >= 5) {
            GameAudio.scoreHigh();
            screenShake = 10;
            comboMsg = '¡' + count + ' EN LÍNEA!';
            comboMsgT = 1;
        } else if (count >= 4) {
            GameAudio.scoreHigh();
            comboMsg = '¡4 en línea!';
            comboMsgT = 0.8;
        } else {
            GameAudio.match();
        }

        phase = 'clearing';
    }

    /* ── gravedad + rellenar con nuevas gemas ──────────────────── */
    function applyGravityAndRefill() {
        for (var c = 0; c < COLS; c++) {
            // recoger gemas existentes de abajo hacia arriba
            var stack = [];
            for (var r = ROWS - 1; r >= 0; r--) {
                if (board[r][c] && !board[r][c].fading) {
                    stack.push(board[r][c]);
                }
            }
            // reconstruir columna
            var filled = stack.length;
            var missing = ROWS - filled;
            // parte de abajo: stack[0..filled-1]
            for (var i = 0; i < filled; i++) {
                var rr = ROWS - 1 - i;
                board[rr][c] = stack[i];
                stack[i].tx = cellX(c);
                stack[i].ty = cellY(rr);
            }
            // parte de arriba: nuevas gemas, posición inicial por encima del tablero (desplazadas)
            for (var j = 0; j < missing; j++) {
                var rrr = missing - 1 - j;        // 0..missing-1 (arriba)
                var t = Math.floor(Math.random() * NUM_TYPES);
                var spawnY = BOARD_Y - (j + 1) * CELL - 8;
                board[rrr][c] = makeGem(t, rrr, c, spawnY);
            }
        }
        phase = 'falling';
    }

    /* ── reshuffle si no hay jugadas válidas ───────────────────── */
    function hasValidMove() {
        // probamos cada swap adyacente sin mutar de verdad
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                // swap con derecha
                if (c + 1 < COLS) {
                    swapCellsNoTween(r, c, r, c + 1);
                    var m1 = findMatches();
                    swapCellsNoTween(r, c, r, c + 1);
                    if (hasMatches(m1)) return true;
                }
                // swap con abajo
                if (r + 1 < ROWS) {
                    swapCellsNoTween(r, c, r + 1, c);
                    var m2 = findMatches();
                    swapCellsNoTween(r, c, r + 1, c);
                    if (hasMatches(m2)) return true;
                }
            }
        }
        return false;
    }
    function swapCellsNoTween(r1, c1, r2, c2) {
        var a = board[r1][c1];
        board[r1][c1] = board[r2][c2];
        board[r2][c2] = a;
    }
    function reshuffleBoard() {
        // reasigna tipos aleatoriamente sin perder las referencias (para animar suave)
        var types = [];
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                if (board[r][c]) types.push(board[r][c].type);
            }
        }
        // intentamos un barajado que no produzca match inicial
        var ok = false, attempts = 0;
        while (!ok && attempts++ < 30) {
            // Fisher-Yates
            for (var i = types.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = types[i]; types[i] = types[j]; types[j] = tmp;
            }
            var idx = 0;
            for (var rr = 0; rr < ROWS; rr++) {
                for (var cc = 0; cc < COLS; cc++) {
                    if (board[rr][cc]) board[rr][cc].type = types[idx++];
                }
            }
            ok = !hasMatches(findMatches()) && hasValidMove();
        }
    }

    /* ── input ─────────────────────────────────────────────────── */
    function canvasCoord(clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        var sx = W / r.width, sy = H / r.height;
        return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
    }
    function onPointerDown(e) {
        if (!running) return;
        if (phase !== 'idle') return;
        e.preventDefault();
        var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
        var p = canvasCoord(t.clientX, t.clientY);
        if (!inBoard(p.x, p.y)) return;
        var cell = cellAt(p.x, p.y);
        if (!cell) return;
        if (!selected) {
            selected = cell;
            GameAudio.click();
            return;
        }
        if (selected.r === cell.r && selected.c === cell.c) {
            selected = null;  // deseleccionar
            return;
        }
        if (adjacent(selected, cell)) {
            if (tryStartSwap(selected, cell)) {
                selected = null;
            }
        } else {
            selected = cell;  // nueva selección
            GameAudio.click();
        }
    }
    function onPointerMove(e) {
        if (!running) { hover = null; return; }
        var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
        var p = canvasCoord(t.clientX, t.clientY);
        if (!inBoard(p.x, p.y)) { hover = null; return; }
        hover = cellAt(p.x, p.y);
    }
    function onPointerLeave() { hover = null; }
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseleave', onPointerLeave);

    /* ── transición de fase al quedar todo en reposo ───────────── */
    function allAtRest() {
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var g = board[r][c];
                if (!g) continue;
                if (g.fading && g.fadeT < 1) return false;
                if (!g.fading) {
                    if (Math.abs(g.x - g.tx) > 0.5 || Math.abs(g.y - g.ty) > 0.5) return false;
                }
            }
        }
        return true;
    }
    function removeFadedGems() {
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                if (board[r][c] && board[r][c].fading && board[r][c].fadeT >= 1) {
                    board[r][c] = null;
                }
            }
        }
    }

    function processSettle() {
        if (phase === 'swap-forward') {
            var m = findMatches();
            if (hasMatches(m)) {
                // swap válido → consumir un movimiento
                moves = Math.max(0, moves - 1);
                updateHUD();
                startClearing(m);
            } else {
                // revertir
                var ps = pendingSwap;
                swapCells(ps.r1, ps.c1, ps.r2, ps.c2);
                phase = 'swap-back';
                GameAudio.noMatch();
            }
            return;
        }
        if (phase === 'swap-back') {
            phase = 'idle';
            return;
        }
        if (phase === 'clearing') {
            removeFadedGems();
            applyGravityAndRefill();
            return;
        }
        if (phase === 'falling') {
            var m2 = findMatches();
            if (hasMatches(m2)) {
                cascade++;
                startClearing(m2);
            } else {
                cascade = 0;
                // ¿se acabaron los movimientos?
                if (moves <= 0) {
                    endGame();
                } else {
                    // Si no hay jugadas, barajar (raro con 8x8 y 6 tipos)
                    if (!hasValidMove()) {
                        reshuffleBoard();
                        comboMsg = 'Sin jugadas — Barajando';
                        comboMsgT = 1;
                    }
                    phase = 'idle';
                    updateHUD();
                }
            }
            return;
        }
    }

    /* ── actualización ─────────────────────────────────────────── */
    function update(dt) {
        var step = dt / 16.67;

        // animación de cada gema
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var g = board[r][c];
                if (!g) continue;
                if (g.fading) {
                    g.fadeT = Math.min(1, g.fadeT + FADE_SPEED * step);
                } else {
                    var dx = g.tx - g.x, dy = g.ty - g.y;
                    var sp = (phase === 'swap-forward' || phase === 'swap-back') ? SWAP_SPEED : FALL_SPEED;
                    sp *= step;
                    if (Math.abs(dx) <= sp) g.x = g.tx; else g.x += (dx > 0 ? 1 : -1) * sp;
                    if (Math.abs(dy) <= sp) g.y = g.ty; else g.y += (dy > 0 ? 1 : -1) * sp;
                }
            }
        }

        // partículas
        for (var i = particles.length - 1; i >= 0; i--) {
            var pa = particles[i];
            pa.vy += 0.18 * step;
            pa.x += pa.vx * step;
            pa.y += pa.vy * step;
            pa.life -= 0.025 * step;
            if (pa.life <= 0) particles.splice(i, 1);
        }

        // mensaje combo
        if (comboMsgT > 0) comboMsgT = Math.max(0, comboMsgT - 0.018 * step);

        // shake
        if (screenShake > 0) {
            screenShake = Math.max(0, screenShake - 0.55 * step);
            shakeOx = (Math.random() - 0.5) * screenShake;
            shakeOy = (Math.random() - 0.5) * screenShake;
        } else { shakeOx = 0; shakeOy = 0; }

        // transiciones de fase
        if ((phase === 'swap-forward' || phase === 'swap-back' ||
             phase === 'clearing'     || phase === 'falling') && allAtRest()) {
            processSettle();
        }
    }

    /* ── dibujo de una gema (formas distintas por tipo) ────────── */
    function pathGem(type, r) {
        ctx.beginPath();
        switch (type) {
            case 0: // rombo
                ctx.moveTo(0, -r);
                ctx.lineTo(r, 0);
                ctx.lineTo(0, r);
                ctx.lineTo(-r, 0);
                ctx.closePath();
                break;
            case 1: // círculo
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                break;
            case 2: // triángulo
                ctx.moveTo(0, -r);
                ctx.lineTo(r * 0.92, r * 0.72);
                ctx.lineTo(-r * 0.92, r * 0.72);
                ctx.closePath();
                break;
            case 3: // hexágono
                for (var i = 0; i < 6; i++) {
                    var a = Math.PI / 3 * i - Math.PI / 2;
                    var px = Math.cos(a) * r, py = Math.sin(a) * r;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            case 4: // estrella de 5 puntas
                for (var j = 0; j < 10; j++) {
                    var ra = (j % 2 === 0) ? r : r * 0.48;
                    var ang = (Math.PI / 5) * j - Math.PI / 2;
                    var x2 = Math.cos(ang) * ra, y2 = Math.sin(ang) * ra;
                    if (j === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
                }
                ctx.closePath();
                break;
            case 5: // cuadrado redondeado
                var sr = r * 0.88, rd = 5;
                ctx.moveTo(-sr + rd, -sr);
                ctx.lineTo(sr - rd, -sr);
                ctx.quadraticCurveTo(sr, -sr, sr, -sr + rd);
                ctx.lineTo(sr, sr - rd);
                ctx.quadraticCurveTo(sr, sr, sr - rd, sr);
                ctx.lineTo(-sr + rd, sr);
                ctx.quadraticCurveTo(-sr, sr, -sr, sr - rd);
                ctx.lineTo(-sr, -sr + rd);
                ctx.quadraticCurveTo(-sr, -sr, -sr + rd, -sr);
                ctx.closePath();
                break;
        }
    }

    function drawGem(g) {
        var alpha = 1;
        var scale = 1;
        if (g.fading) {
            alpha = 1 - g.fadeT;
            scale = 1 + g.fadeT * 0.35;
        }
        ctx.setTransform(1, 0, 0, 1, shakeOx + g.x, shakeOy + g.y);
        if (scale !== 1) ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        var r = GEM_RADIUS;

        // sombra
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(2, r * 0.7, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // cuerpo
        ctx.fillStyle = gemGrads[g.type];
        pathGem(g.type, r);
        ctx.fill();

        // borde
        ctx.strokeStyle = GEM_COLORS[g.type].dark;
        ctx.lineWidth = 1.5;
        pathGem(g.type, r);
        ctx.stroke();

        // highlight especular
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.26, r * 0.13, -0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        if (scale !== 1) ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);
    }

    /* ── render ────────────────────────────────────────────────── */
    function render() {
        ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);

        // fondo
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // estrellitas decorativas (batch)
        for (var s = 0; s < bgStars.length; s++) {
            var st = bgStars[s];
            ctx.fillStyle = 'rgba(255,255,255,' + st.a.toFixed(2) + ')';
            ctx.fillRect(st.x, st.y, st.s, st.s);
        }

        // título
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('GEMAS', W / 2, 32);

        // HUD superior
        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 14px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Puntos', 12, 58);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Segoe UI, Arial, sans-serif';
        ctx.fillText(String(score), 12, 80);

        ctx.fillStyle = '#ffb347';
        ctx.font = 'bold 14px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Movs', W - 12, 58);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Segoe UI, Arial, sans-serif';
        ctx.fillText(String(moves), W - 12, 80);

        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = 'bold 12px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Récord: ' + highScore, W / 2, 62);

        // fondo del tablero
        ctx.fillStyle = 'rgba(10,6,28,0.55)';
        ctx.fillRect(BOARD_X - 2, BOARD_Y - 2, BOARD_W + 4, BOARD_H + 4);
        ctx.strokeStyle = 'rgba(143,211,244,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(BOARD_X - 2, BOARD_Y - 2, BOARD_W + 4, BOARD_H + 4);

        // grid tenue
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (var gi = 1; gi < COLS; gi++) {
            var gx = BOARD_X + gi * CELL;
            ctx.beginPath();
            ctx.moveTo(gx, BOARD_Y);
            ctx.lineTo(gx, BOARD_Y + BOARD_H);
            ctx.stroke();
        }
        for (var gj = 1; gj < ROWS; gj++) {
            var gy = BOARD_Y + gj * CELL;
            ctx.beginPath();
            ctx.moveTo(BOARD_X, gy);
            ctx.lineTo(BOARD_X + BOARD_W, gy);
            ctx.stroke();
        }

        // hover (solo si idle)
        if (running && phase === 'idle' && hover) {
            var hx = BOARD_X + hover.c * CELL;
            var hy = BOARD_Y + hover.r * CELL;
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(hx, hy, CELL, CELL);
        }

        // marco de selección
        if (running && selected) {
            var sxp = BOARD_X + selected.c * CELL;
            var syp = BOARD_Y + selected.r * CELL;
            ctx.strokeStyle = '#ffd93d';
            ctx.lineWidth = 3;
            ctx.strokeRect(sxp + 2, syp + 2, CELL - 4, CELL - 4);
            // indicador pulsante con barra
            var pulse = 0.5 + 0.5 * Math.sin(lastTs * 0.008);
            ctx.fillStyle = 'rgba(255,217,61,' + (0.18 * pulse).toFixed(3) + ')';
            ctx.fillRect(sxp + 2, syp + 2, CELL - 4, CELL - 4);
        }

        // gemas
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var g = board[r][c];
                if (!g) continue;
                drawGem(g);
            }
        }
        ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);

        // partículas (batch por color no es útil aquí; cada una es pequeña)
        for (var pi = 0; pi < particles.length; pi++) {
            var pa = particles[pi];
            ctx.globalAlpha = Math.max(0, pa.life);
            ctx.fillStyle = pa.color;
            ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
        }
        ctx.globalAlpha = 1;

        // mensaje de combo
        if (comboMsgT > 0 && comboMsg) {
            var a = Math.min(1, comboMsgT * 1.2);
            var ofs = (1 - comboMsgT) * 12;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffd93d';
            ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(comboMsg, W / 2, BOARD_Y + BOARD_H + 28 - ofs);
            ctx.globalAlpha = 1;
        }

        // guía inferior
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 12px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        var guide = running
            ? (selected ? 'Elige una gema adyacente para intercambiar' : 'Toca una gema para seleccionarla')
            : 'Pulsa Iniciar';
        ctx.fillText(guide, W / 2, H - 14);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    /* ── loop ──────────────────────────────────────────────────── */
    function loop(ts) {
        if (!lastTs) lastTs = ts;
        var dt = ts - lastTs;
        if (dt < DELTA_THR) { requestAnimationFrame(loop); return; }
        lastTs = ts;
        if (running) update(dt);
        render();
        requestAnimationFrame(loop);
    }

    /* ── flujo de partida ──────────────────────────────────────── */
    function startGame() {
        if (running) return;
        running = true;
        score = 0;
        moves = MOVES_PER_ROUND;
        particles.length = 0;
        selected = null;
        hover = null;
        pendingSwap = null;
        cascade = 0;
        comboMsg = '';
        comboMsgT = 0;
        screenShake = 0;
        buildBoard();
        // por si el builder deja accidentalmente un tablero sin jugadas
        if (!hasValidMove()) reshuffleBoard();
        phase = 'idle';
        gameOverPop.style.display = 'none';
        if (startBtn)   startBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = false;
        updateHUD();
        GameAudio.start();
    }
    function endGame() {
        running = false;
        phase = 'gameover';
        var newRecord = false;
        if (score > highScore) {
            highScore = score;
            saveHigh();
            newRecord = true;
            GameAudio.win();
        } else {
            GameAudio.gameOver();
        }
        if (finalScore) finalScore.textContent = 'Puntos: ' + score;
        if (finalBest)  finalBest.textContent  = newRecord ? '¡Nuevo récord!' : 'Récord: ' + highScore;
        if (gameOverPop) gameOverPop.style.display = 'flex';
        if (startBtn)   startBtn.disabled = false;
        if (restartBtn) restartBtn.disabled = true;
        updateHUD();
    }

    /* ── botones ───────────────────────────────────────────────── */
    if (startBtn)   startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', function () {
        running = false;
        startGame();
    });
    if (playAgain)  playAgain.addEventListener('click', function () {
        gameOverPop.style.display = 'none';
        startGame();
    });

    // teclado: enter/espacio inicia; flechas + espacio = mini navegación
    document.addEventListener('keydown', function (e) {
        if (!running) {
            if (e.key === 'Enter' || e.key === ' ') {
                startGame(); e.preventDefault();
            }
            return;
        }
        if (phase !== 'idle') return;
        if (!selected) selected = { r: 0, c: 0 };
        if (e.key === 'ArrowUp')    { selected.r = Math.max(0, selected.r - 1); e.preventDefault(); }
        if (e.key === 'ArrowDown')  { selected.r = Math.min(ROWS - 1, selected.r + 1); e.preventDefault(); }
        if (e.key === 'ArrowLeft')  { selected.c = Math.max(0, selected.c - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { selected.c = Math.min(COLS - 1, selected.c + 1); e.preventDefault(); }
        if (e.key === ' ' || e.key === 'Enter') {
            // intentar swap con la gema a la derecha como default
            var tgt = { r: selected.r, c: Math.min(COLS - 1, selected.c + 1) };
            if (tgt.r === selected.r && tgt.c === selected.c) tgt = { r: Math.min(ROWS - 1, selected.r + 1), c: selected.c };
            if (adjacent(selected, tgt)) tryStartSwap(selected, tgt);
            e.preventDefault();
        }
    });

    /* ── init ──────────────────────────────────────────────────── */
    loadHigh();
    buildGradients();
    buildBgStars();
    buildBoard();  // tablero de fondo visible en menú
    updateHUD();
    requestAnimationFrame(loop);
})();

// Sokoban — Empuja Cajas
// Tiles: 0=floor, 1=wall, 2=target, 3=box, 4=box-on-target, 5=player, 6=player-on-target

(function () {
    'use strict';

    // ── Levels (each is an array of strings; '@'=player, '$'=box, '.'=target, '*'=box+target, '+'=player+target, '#'=wall, ' '=floor)
    var LEVELS = [
        // 1 – Intro (7×7)
        [
            '#######',
            '#     #',
            '# $   #',
            '# .   #',
            '#   @ #',
            '#     #',
            '#######'
        ],
        // 2 – Two boxes (8×8)
        [
            '########',
            '#      #',
            '# $$ . #',
            '#  ..  #',
            '#   $  #',
            '#  @   #',
            '#      #',
            '########'
        ],
        // 3 – Cross swap (9×7): push both boxes to swapped targets
        [
            '#########',
            '#       #',
            '#  $ .  #',
            '#       #',
            '#  . $  #',
            '#   @   #',
            '#########'
        ],
        // 4 – L-shape (9×9)
        [
            '#########',
            '#   #   #',
            '# $ . $ #',
            '#   #   #',
            '###   ###',
            '#   #   #',
            '# . @ . #',
            '#       #',
            '#########'
        ],
        // 5 – Cross (9×9)
        [
            '  #####  ',
            '  #   #  ',
            '###$  ###',
            '#  . .  #',
            '# $@$ . #',
            '#  . .  #',
            '###  $###',
            '  #   #  ',
            '  #####  '
        ],
        // 6 – Warehouse (10×8)
        [
            '##########',
            '#        #',
            '# $$  .. #',
            '#  $  .  #',
            '# ..  $  #',
            '#   @    #',
            '#        #',
            '##########'
        ],
        // 7 – Zigzag (10×10)
        [
            '##########',
            '#        #',
            '# $  $.  #',
            '#  ## #  #',
            '#  .$ #  #',
            '#  ## #  #',
            '#  $. #  #',
            '# @      #',
            '# .      #',
            '##########'
        ],
        // 8 – Four corners (11×11)
        [
            '###########',
            '#         #',
            '# $  $  $ #',
            '#    #    #',
            '#  #   #  #',
            '# . # @ . #',
            '#  #   #  #',
            '#    #    #',
            '# .  $  . #',
            '#         #',
            '###########'
        ],
        // 9 – Spiral (11×11)
        [
            '###########',
            '#    @    #',
            '# # ##### #',
            '# #   $ # #',
            '# # # # # #',
            '# # #.# # #',
            '#  .#$    #',
            '#  . $  # #',
            '# ####### #',
            '#         #',
            '###########'
        ],
        // 10 – Grand finale (11×11)
        [
            '###########',
            '#    @    #',
            '#  $   $  #',
            '# ##   ## #',
            '# .  .  . #',
            '#    ##   #',
            '#      .  #',
            '# ###  #  #',
            '#  $   $  #',
            '#         #',
            '###########'
        ]
    ];

    // ── Parse level string-array into a 2D grid ──────────────────────
    function parseLevel(lines) {
        var grid = [], playerPos = { r: 0, c: 0 };
        for (var r = 0; r < lines.length; r++) {
            var row = [];
            for (var c = 0; c < lines[r].length; c++) {
                var ch = lines[r][c];
                if (ch === '#')  row.push(1);
                else if (ch === '.') row.push(2);
                else if (ch === '$') row.push(3);
                else if (ch === '*') row.push(4);
                else if (ch === '@') { row.push(5); playerPos = { r: r, c: c }; }
                else if (ch === '+') { row.push(6); playerPos = { r: r, c: c }; }
                else row.push(0);
            }
            grid.push(row);
        }
        return { grid: grid, player: playerPos };
    }

    // ── Deep copy a grid ─────────────────────────────────────────────
    function copyGrid(grid) {
        return grid.map(function (row) { return row.slice(); });
    }

    // ── State ─────────────────────────────────────────────────────────
    var canvas = document.getElementById('sokobanCanvas');
    var ctx    = canvas.getContext('2d');
    var CW = canvas.width, CH = canvas.height;

    var gameState = 'idle'; // idle | playing | win
    var currentLevel = 0;
    var moves = 0;
    var grid = [];
    var player = { r: 0, c: 0 };
    var history = []; // stack of {grid, player, moves}
    var animating = false;

    // ── UI refs ──────────────────────────────────────────────────────
    var startBtn    = document.getElementById('startBtn');
    var restartBtn  = document.getElementById('restartBtn');
    var undoBtn     = document.getElementById('undoBtn');
    var nextLevelBtn = document.getElementById('nextLevelBtn');
    var playAgainBtn = document.getElementById('playAgainBtn');
    var levelDisplay = document.getElementById('levelDisplay');
    var movesDisplay = document.getElementById('movesDisplay');
    var bestDisplay  = document.getElementById('bestDisplay');
    var winPopup     = document.getElementById('winPopup');
    var allDonePopup = document.getElementById('allDonePopup');
    var mobileScore  = document.getElementById('mobileScore');

    // ── LocalStorage helpers ─────────────────────────────────────────
    function getBest(lvl) {
        var v = localStorage.getItem('sokoban_best_' + lvl);
        return v ? parseInt(v, 10) : null;
    }
    function setBest(lvl, val) {
        var cur = getBest(lvl);
        if (cur === null || val < cur) {
            localStorage.setItem('sokoban_best_' + lvl, val);
            return true;
        }
        return false;
    }

    // ── Load level ───────────────────────────────────────────────────
    function loadLevel(idx) {
        var parsed = parseLevel(LEVELS[idx]);
        grid   = parsed.grid;
        player = parsed.player;
        moves  = 0;
        history = [];
        updateUI();
        draw();
    }

    function updateUI() {
        levelDisplay.textContent = currentLevel + 1;
        movesDisplay.textContent = moves;
        var b = getBest(currentLevel);
        bestDisplay.textContent = b !== null ? b : '—';
        if (mobileScore) {
            mobileScore.textContent = 'Nivel ' + (currentLevel + 1) + '  |  Mov: ' + moves + '  |  Mejor: ' + (b !== null ? b : '—');
        }
    }

    // ── Win check ────────────────────────────────────────────────────
    function checkWin() {
        for (var r = 0; r < grid.length; r++) {
            for (var c = 0; c < grid[r].length; c++) {
                if (grid[r][c] === 3) return false; // unsolved box
            }
        }
        return true;
    }

    // ── Move logic ───────────────────────────────────────────────────
    function tryMove(dr, dc) {
        if (gameState !== 'playing' || animating) return;
        var nr = player.r + dr, nc = player.c + dc;
        if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) return;
        var dest = grid[nr][nc];
        if (dest === 1) return; // wall

        var snapshot = { grid: copyGrid(grid), player: { r: player.r, c: player.c }, moves: moves };

        if (dest === 3 || dest === 4) {
            // pushing a box
            var br = nr + dr, bc = nc + dc;
            if (br < 0 || br >= grid.length || bc < 0 || bc >= grid[0].length) return;
            var beyond = grid[br][bc];
            if (beyond === 1 || beyond === 3 || beyond === 4) return; // can't push

            // move box
            var boxOnTarget = (dest === 4);
            var beyondIsTarget = (beyond === 2);
            grid[br][bc] = beyondIsTarget ? 4 : 3;
            grid[nr][nc] = boxOnTarget ? 2 : 0;
            if (beyondIsTarget || dest === 4) {
                // box moved off or onto target → audio
            }
            GameAudio.slide();
        } else {
            GameAudio.click();
        }

        // move player
        var playerOnTarget = (grid[player.r][player.c] === 6);
        grid[player.r][player.c] = playerOnTarget ? 2 : 0;
        var newCellIsTarget = (grid[nr][nc] === 2);
        grid[nr][nc] = newCellIsTarget ? 6 : 5;
        player = { r: nr, c: nc };

        moves++;
        history.push(snapshot);
        if (history.length > 200) history.shift();
        undoBtn.disabled = false;

        updateUI();
        draw();

        if (checkWin()) {
            setTimeout(onWin, 300);
        }
    }

    // ── Win handler ──────────────────────────────────────────────────
    function onWin() {
        gameState = 'win';
        GameAudio.win();
        var isNew = setBest(currentLevel, moves);
        var b = getBest(currentLevel);
        document.getElementById('winMsg').textContent = 'Movimientos: ' + moves;
        document.getElementById('bestMsg').textContent = isNew ? 'Nuevo record!' : 'Mejor: ' + b;
        winPopup.style.display = 'flex';
    }

    // ── Undo ─────────────────────────────────────────────────────────
    function undo() {
        if (history.length === 0) return;
        var snap = history.pop();
        grid   = snap.grid;
        player = snap.player;
        moves  = snap.moves;
        if (history.length === 0) undoBtn.disabled = true;
        updateUI();
        draw();
    }

    // ── Drawing constants & helpers ──────────────────────────────────
    var ROWS, COLS, TILE, OX, OY;

    function calcLayout() {
        ROWS = grid.length;
        COLS = 0;
        for (var r = 0; r < ROWS; r++) if (grid[r].length > COLS) COLS = grid[r].length;
        TILE = Math.min(Math.floor((CW - 16) / COLS), Math.floor((CH - 60) / ROWS));
        OX = Math.floor((CW - COLS * TILE) / 2);
        OY = Math.floor((CH - ROWS * TILE) / 2) + 16;
    }

    function drawFloor(x, y) {
        ctx.fillStyle = '#1a2e3a';
        ctx.fillRect(x, y, TILE, TILE);
        // subtle grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
    }

    function drawWall(x, y) {
        var t = TILE, b = Math.max(3, t * 0.13);
        // Base
        ctx.fillStyle = '#1e2d3d';
        ctx.fillRect(x, y, t, t);
        // Top-left bevel — polygon (light)
        ctx.fillStyle = '#3d5570';
        ctx.beginPath();
        ctx.moveTo(x, y);       ctx.lineTo(x + t, y);
        ctx.lineTo(x + t - b, y + b); ctx.lineTo(x + b, y + b);
        ctx.lineTo(x + b, y + t - b); ctx.lineTo(x, y + t);
        ctx.closePath(); ctx.fill();
        // Bottom-right bevel — polygon (dark)
        ctx.fillStyle = '#0d1920';
        ctx.beginPath();
        ctx.moveTo(x + t, y);   ctx.lineTo(x + t, y + t);
        ctx.lineTo(x, y + t);   ctx.lineTo(x + b, y + t - b);
        ctx.lineTo(x + t - b, y + t - b); ctx.lineTo(x + t - b, y + b);
        ctx.closePath(); ctx.fill();
        // Inner face
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + b, y + b, t - b * 2, t - b * 2);
        // Horizontal mortar seam
        var fw = t - b * 2, fh = t - b * 2;
        var my = y + b + fh * 0.47;
        ctx.fillStyle = '#182433';
        ctx.fillRect(x + b, my, fw, Math.max(1, t * 0.04));
        // Offset brick rectangles
        ctx.fillStyle = '#253b4d';
        ctx.fillRect(x + b, y + b,        fw * 0.58, fh * 0.43);
        ctx.fillRect(x + b + fw * 0.62,   my + t * 0.04, fw * 0.36, fh * 0.43);
        ctx.fillRect(x + b,               my + t * 0.04, fw * 0.50, fh * 0.43);
    }

    function drawTarget(x, y) {
        drawFloor(x, y);
        var cx = x + TILE / 2, cy = y + TILE / 2, r = TILE * 0.3;
        // 8-point star burst (filled polygon)
        ctx.fillStyle = 'rgba(255,100,50,0.13)';
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
            var a = i * Math.PI / 4 - Math.PI / 8;
            var rad = (i % 2 === 0) ? r : r * 0.42;
            if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
            else         ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        // Outer ring
        ctx.strokeStyle = '#ff7043';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        // Middle ring
        ctx.strokeStyle = 'rgba(255,112,67,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2); ctx.stroke();
        // Center dot
        ctx.fillStyle = 'rgba(255,112,67,0.75)';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2); ctx.fill();
        // 4 tick marks outside ring
        ctx.strokeStyle = 'rgba(255,112,67,0.65)';
        ctx.lineWidth = 1.5;
        [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d) {
            ctx.beginPath();
            ctx.moveTo(cx + d[0] * r * 0.72, cy + d[1] * r * 0.72);
            ctx.lineTo(cx + d[0] * r * 1.08, cy + d[1] * r * 1.08);
            ctx.stroke();
        });
    }

    function drawBox(x, y, onTarget) {
        var pad   = Math.floor(TILE * 0.07);
        var inner = TILE - pad * 2;
        var bx = x + pad, by = y + pad;
        var bevel = Math.max(2, TILE * 0.1);
        var r     = Math.max(2, TILE * 0.1);
        var baseColor  = onTarget ? '#2e7d32' : '#795548';
        var lightColor = onTarget ? '#66bb6a' : '#a1887f';
        var darkColor  = onTarget ? '#1b5e20' : '#4e342e';
        var faceColor  = onTarget ? '#388e3c' : '#8d6e63';
        var glowColor  = onTarget ? 'rgba(102,187,106,0.4)' : 'rgba(200,150,60,0.18)';

        // Glow halo
        if (onTarget) {
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bx - 3, by - 3, inner + 6, inner + 6, r + 3);
            else ctx.rect(bx - 3, by - 3, inner + 6, inner + 6);
            ctx.fill();
        }

        // Box base
        ctx.fillStyle = baseColor;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, inner, inner, r); ctx.fill(); }
        else ctx.fillRect(bx, by, inner, inner);

        // Top-left bevel — polygon (light face)
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.moveTo(bx, by);                ctx.lineTo(bx + inner, by);
        ctx.lineTo(bx + inner - bevel, by + bevel);
        ctx.lineTo(bx + bevel, by + bevel);
        ctx.lineTo(bx + bevel, by + inner - bevel);
        ctx.lineTo(bx, by + inner);
        ctx.closePath(); ctx.fill();

        // Bottom-right bevel — polygon (dark shadow)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(bx + inner, by);        ctx.lineTo(bx + inner, by + inner);
        ctx.lineTo(bx, by + inner);        ctx.lineTo(bx + bevel, by + inner - bevel);
        ctx.lineTo(bx + inner - bevel, by + inner - bevel);
        ctx.lineTo(bx + inner - bevel, by + bevel);
        ctx.closePath(); ctx.fill();

        // Inner face
        ctx.fillStyle = faceColor;
        ctx.fillRect(bx + bevel, by + bevel, inner - bevel * 2, inner - bevel * 2);

        // Diagonal wood-grain lines on inner face
        var diag = inner - bevel * 2;
        ctx.strokeStyle = onTarget ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (var d = 0; d < diag * 1.4; d += Math.max(4, TILE * 0.13)) {
            ctx.beginPath();
            ctx.moveTo(bx + bevel + Math.min(d, diag), by + bevel + Math.max(0, d - diag));
            ctx.lineTo(bx + bevel + Math.max(0, d - diag), by + bevel + Math.min(d, diag));
            ctx.stroke();
        }

        // Corner rivets (4 small circles)
        var rivR = Math.max(1.5, TILE * 0.055);
        var ro   = bevel * 0.75;
        ctx.fillStyle = onTarget ? 'rgba(200,255,200,0.55)' : 'rgba(255,255,255,0.35)';
        [[bx + ro, by + ro], [bx + inner - ro, by + ro],
         [bx + ro, by + inner - ro], [bx + inner - ro, by + inner - ro]].forEach(function(p) {
            ctx.beginPath(); ctx.arc(p[0], p[1], rivR, 0, Math.PI * 2); ctx.fill();
        });

        // Cross mark
        ctx.strokeStyle = onTarget ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = Math.max(1, TILE * 0.04);
        var m = TILE * 0.24;
        ctx.beginPath();
        ctx.moveTo(x + m, y + m);         ctx.lineTo(x + TILE - m, y + TILE - m);
        ctx.moveTo(x + TILE - m, y + m);  ctx.lineTo(x + m, y + TILE - m);
        ctx.stroke();
    }

    function drawPlayer(x, y, onTarget) {
        drawFloor(x, y);
        if (onTarget) drawTarget(x, y);

        var cx = x + TILE / 2, cy = y + TILE / 2;
        var bodyR = TILE * 0.22;
        var headR = TILE * 0.13;
        var bodyY = cy + bodyR * 0.45;

        // Drop shadow ellipse
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + bodyR * 1.05, bodyR * 0.75, bodyR * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs — two small rounded rects below body
        ctx.fillStyle = '#0d47a1';
        var lw = bodyR * 0.38, lh = bodyR * 0.52;
        ctx.fillRect(cx - bodyR * 0.42, bodyY + bodyR * 0.62, lw, lh);
        ctx.fillRect(cx + bodyR * 0.04, bodyY + bodyR * 0.62, lw, lh);

        // Body circle
        ctx.fillStyle = '#1565c0';
        ctx.beginPath(); ctx.arc(cx, bodyY, bodyR, 0, Math.PI * 2); ctx.fill();

        // Arms — quadratic bezier curves left and right
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = Math.max(2, TILE * 0.09);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - bodyR * 0.82, bodyY - bodyR * 0.1);
        ctx.quadraticCurveTo(cx - bodyR * 1.28, bodyY + bodyR * 0.28, cx - bodyR * 0.85, bodyY + bodyR * 0.68);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + bodyR * 0.82, bodyY - bodyR * 0.1);
        ctx.quadraticCurveTo(cx + bodyR * 1.28, bodyY + bodyR * 0.28, cx + bodyR * 0.85, bodyY + bodyR * 0.68);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Shirt stripe
        ctx.fillStyle = '#8fd3f4';
        ctx.fillRect(cx - bodyR * 0.52, bodyY - bodyR * 0.08, bodyR * 1.04, TILE * 0.055);

        // Head
        ctx.fillStyle = '#ffcc80';
        ctx.beginPath(); ctx.arc(cx, cy - bodyR * 0.52, headR, 0, Math.PI * 2); ctx.fill();

        // Hair — upper arc
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.arc(cx, cy - bodyR * 0.52 - headR * 0.25, headR, Math.PI, 0);
        ctx.fill();

        // Eyes
        var eyeY = cy - bodyR * 0.52 - headR * 0.08;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(cx - headR * 0.34, eyeY, headR * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + headR * 0.34, eyeY, headR * 0.2, 0, Math.PI * 2); ctx.fill();
        // Eye glints
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - headR * 0.27, eyeY - headR * 0.07, headR * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + headR * 0.41, eyeY - headR * 0.07, headR * 0.07, 0, Math.PI * 2); ctx.fill();
    }

    // ── Draw HUD ─────────────────────────────────────────────────────
    function drawHUD() {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, CW, 38);
        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Nivel ' + (currentLevel + 1) + ' / ' + LEVELS.length, 12, 19);
        ctx.textAlign = 'center';
        ctx.fillText('Mov: ' + moves, CW / 2, 19);
        var b = getBest(currentLevel);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff7043';
        ctx.fillText('Mejor: ' + (b !== null ? b : '—'), CW - 12, 19);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Main draw ────────────────────────────────────────────────────
    function draw() {
        ctx.fillStyle = '#0d1f2d';
        ctx.fillRect(0, 0, CW, CH);

        if (gameState === 'idle') {
            drawIntro();
            return;
        }

        calcLayout();

        for (var r = 0; r < ROWS; r++) {
            if (!grid[r]) continue;
            for (var c = 0; c < COLS; c++) {
                var tx = OX + c * TILE, ty = OY + r * TILE;
                var cell = (grid[r] && grid[r][c] !== undefined) ? grid[r][c] : -1;
                if (cell === -1) continue; // sparse rows

                if (cell === 1) drawWall(tx, ty);
                else if (cell === 2) drawTarget(tx, ty);
                else if (cell === 3) { drawFloor(tx, ty); drawBox(tx, ty, false); }
                else if (cell === 4) { drawTarget(tx, ty); drawBox(tx, ty, true); }
                else if (cell === 5) drawPlayer(tx, ty, false);
                else if (cell === 6) drawPlayer(tx, ty, true);
                else drawFloor(tx, ty);
            }
        }

        drawHUD();
    }

    function drawIntro() {
        // Gradient overlay
        var g = ctx.createLinearGradient(0, 0, CW, CH);
        g.addColorStop(0, '#1a2980');
        g.addColorStop(1, '#26d0ce');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Empuja Cajas', CW / 2, CH * 0.28);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#cde';
        ctx.fillText('Sokoban clásico en 10 niveles', CW / 2, CH * 0.38);

        // Fake mini grid preview
        var previewTile = 28, previewRows = 5, previewCols = 7;
        var px = (CW - previewCols * previewTile) / 2;
        var py = CH * 0.48;
        var preview = [
            [1,1,1,1,1,1,1],
            [1,0,0,3,0,2,1],
            [1,0,5,0,0,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        for (var pr = 0; pr < previewRows; pr++) {
            for (var pc = 0; pc < previewCols; pc++) {
                var cell = preview[pr][pc];
                var bx = px + pc * previewTile, by = py + pr * previewTile;
                if (cell === 1) {
                    ctx.fillStyle = '#2c3e50'; ctx.fillRect(bx, by, previewTile, previewTile);
                    ctx.fillStyle = '#3d5166'; ctx.fillRect(bx, by, previewTile, 2);
                } else if (cell === 0) {
                    ctx.fillStyle = '#1a2e3a'; ctx.fillRect(bx, by, previewTile, previewTile);
                } else if (cell === 3) {
                    ctx.fillStyle = '#1a2e3a'; ctx.fillRect(bx, by, previewTile, previewTile);
                    ctx.fillStyle = '#8d6534'; ctx.fillRect(bx+3, by+3, previewTile-6, previewTile-6);
                    ctx.fillStyle = '#c4923e'; ctx.fillRect(bx+3, by+3, previewTile-6, 3);
                } else if (cell === 2) {
                    ctx.fillStyle = '#1a2e3a'; ctx.fillRect(bx, by, previewTile, previewTile);
                    ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(bx + previewTile/2, by + previewTile/2, 7, 0, Math.PI*2); ctx.stroke();
                } else if (cell === 5) {
                    ctx.fillStyle = '#1a2e3a'; ctx.fillRect(bx, by, previewTile, previewTile);
                    ctx.fillStyle = '#1565c0';
                    ctx.beginPath(); ctx.arc(bx + previewTile/2, by + previewTile/2 + 3, 7, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#ffcc80';
                    ctx.beginPath(); ctx.arc(bx + previewTile/2, by + previewTile/2 - 4, 5, 0, Math.PI*2); ctx.fill();
                }
            }
        }

        ctx.fillStyle = '#8fd3f4';
        ctx.font = '14px sans-serif';
        ctx.fillText('Presiona Iniciar para jugar', CW / 2, py + previewRows * previewTile + 30);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Input ─────────────────────────────────────────────────────────
    var DIRS = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
        W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1]
    };

    document.addEventListener('keydown', function (e) {
        if (e.key === 'z' || e.key === 'Z') { undo(); return; }
        var dir = DIRS[e.key];
        if (!dir) return;
        e.preventDefault();
        tryMove(dir[0], dir[1]);
    });

    // Touch swipe
    var touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 15) return;
        if (absDx > absDy) tryMove(0, dx > 0 ? 1 : -1);
        else               tryMove(dy > 0 ? 1 : -1, 0);
        e.preventDefault();
    }, { passive: false });

    // ── Button handlers ───────────────────────────────────────────────
    startBtn.addEventListener('click', function () {
        currentLevel = 0;
        gameState = 'playing';
        loadLevel(0);
        startBtn.disabled = true;
        restartBtn.disabled = false;
        undoBtn.disabled = true;
        GameAudio.start();
    });

    restartBtn.addEventListener('click', function () {
        loadLevel(currentLevel);
        undoBtn.disabled = true;
        GameAudio.click();
    });

    undoBtn.addEventListener('click', function () {
        undo();
        GameAudio.click();
    });

    nextLevelBtn.addEventListener('click', function () {
        winPopup.style.display = 'none';
        currentLevel++;
        if (currentLevel >= LEVELS.length) {
            allDonePopup.style.display = 'flex';
            gameState = 'idle';
        } else {
            gameState = 'playing';
            loadLevel(currentLevel);
            undoBtn.disabled = true;
            GameAudio.start();
        }
    });

    playAgainBtn.addEventListener('click', function () {
        allDonePopup.style.display = 'none';
        currentLevel = 0;
        gameState = 'playing';
        loadLevel(0);
        startBtn.disabled = true;
        restartBtn.disabled = false;
        undoBtn.disabled = true;
        GameAudio.start();
    });

    // ── Initial render ────────────────────────────────────────────────
    draw();

}());

// Conecta 4 vs IA
var canvas = document.getElementById('c4Canvas');
var ctx = canvas.getContext('2d');

var COLS = 7, ROWS = 6, WIN = 4;
var PLAYER = 1, AI = 2;
var COLORS = { 0: null, 1: '#ef5350', 2: '#fdd835' };
var COLORS_DARK = { 1: '#b71c1c', 2: '#f57f17' };
var COLORS_LIGHT = { 1: '#ffcdd2', 2: '#fffde7' };

var board = [];
var isPlaying = false;
var aiThinking = false;
var hoverCol = -1;
var wins = parseInt(localStorage.getItem('c4wins') || '0', 10);
var losses = parseInt(localStorage.getItem('c4losses') || '0', 10);
var draws = parseInt(localStorage.getItem('c4draws') || '0', 10);

// Visual state
var fallingPieces = []; // { col, toRow, currentY, player, done }
var winParticles = [];  // confetti particles
var hoverPulseTime = 0;
var animFrameId = null;

function newBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
        board[r] = [];
        for (var c = 0; c < COLS; c++) board[r][c] = 0;
    }
}

function cellSize() { return canvas.width / COLS; }

// Draw a single piece with 3D radial gradient effect
function drawPiece(cx, cy, radius, player, alpha) {
    alpha = (alpha === undefined) ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha = alpha;

    var baseColor = COLORS[player];
    var darkColor = COLORS_DARK[player];
    var lightColor = COLORS_LIGHT[player];

    // Shadow beneath the piece
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    // Main circle with radial gradient for 3D sphere effect
    var grad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.35, radius * 0.05,
        cx, cy, radius
    );
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.35, baseColor);
    grad.addColorStop(1, darkColor);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Specular highlight (small bright spot top-left)
    var specGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.35, 0,
        cx - radius * 0.3, cy - radius * 0.35, radius * 0.45
    );
    specGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    ctx.restore();
}

function drawBoard(winCells) {
    var cs = cellSize();
    var radius = cs * 0.4;

    // Board background with gradient (lighter top, darker bottom)
    var bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#1e88e5');
    bgGrad.addColorStop(1, '#0d2e6b');
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 10);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Subtle top reflection band
    var reflGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.18);
    reflGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
    reflGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height * 0.18, [10, 10, 0, 0]);
    ctx.fillStyle = reflGrad;
    ctx.fill();

    // Hover column highlight with pulsing opacity
    if (hoverCol >= 0 && isPlaying && !aiThinking) {
        hoverPulseTime += 0.08;
        var pulseAlpha = 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(hoverPulseTime));
        ctx.fillStyle = 'rgba(255,255,255,' + pulseAlpha + ')';
        ctx.beginPath();
        ctx.roundRect(hoverCol * cs, 0, cs, canvas.height, [5, 5, 5, 5]);
        ctx.fill();
    }

    // Circles
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            var cx = c * cs + cs / 2;
            var cy = r * cs + cs / 2;
            var val = board[r][c];

            if (val === 0) {
                // Empty hole — dark inset circle
                var holeGrad = ctx.createRadialGradient(cx + 2, cy + 2, 1, cx, cy, radius);
                holeGrad.addColorStop(0, '#0a2050');
                holeGrad.addColorStop(1, '#0d47a1');
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = holeGrad;
                ctx.fill();
            } else {
                // Check if this cell is being animated (skip if falling piece covers it)
                var isAnimating = false;
                for (var fi = 0; fi < fallingPieces.length; fi++) {
                    if (fallingPieces[fi].col === c && fallingPieces[fi].toRow === r && !fallingPieces[fi].done) {
                        isAnimating = true; break;
                    }
                }
                if (!isAnimating) {
                    drawPiece(cx, cy, radius, val);
                }
            }

            // Winning cell highlight ring
            if (winCells) {
                for (var i = 0; i < winCells.length; i++) {
                    if (winCells[i][0] === r && winCells[i][1] === c) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    // Draw falling pieces on top
    for (var fi = 0; fi < fallingPieces.length; fi++) {
        var fp = fallingPieces[fi];
        if (!fp.done) {
            var fpCx = fp.col * cs + cs / 2;
            var fpCy = fp.currentY;
            drawPiece(fpCx, fpCy, radius, fp.player);
        }
    }

    // Draw win particles
    for (var pi = 0; pi < winParticles.length; pi++) {
        var p = winParticles[pi];
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
    }

    // Column indicator arrow on hover
    if (hoverCol >= 0 && isPlaying && !aiThinking) {
        var ax = hoverCol * cs + cs / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(ax - 8, 5);
        ctx.lineTo(ax + 8, 5);
        ctx.lineTo(ax, 14);
        ctx.closePath();
        ctx.fill();
    }
}

// Animate falling piece
function animateFall(col, toRow, player, onDone) {
    var cs = cellSize();
    var radius = cs * 0.4;
    var startY = radius; // start at top
    var endY = toRow * cs + cs / 2;
    var fp = { col: col, toRow: toRow, currentY: startY, player: player, done: false };
    fallingPieces.push(fp);

    var velocity = 0;
    var lastStepTs = 0;

    function step(ts) {
        // Throttle to ~60fps so the fall speed doesn't depend on refresh rate
        if (ts - lastStepTs < 15) { requestAnimationFrame(step); return; }
        lastStepTs = ts;
        velocity += 0.8; // gravity acceleration
        fp.currentY += velocity;

        // Bounce slightly when landing
        if (fp.currentY >= endY) {
            fp.currentY = endY;
            fp.done = true;
            fallingPieces = fallingPieces.filter(function(f) { return !f.done; });
            drawBoard();
            if (onDone) onDone();
            return;
        }
        drawBoard();
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Spawn confetti particles from winning cells
function spawnWinParticles(winCells, player) {
    var cs = cellSize();
    var baseColor = COLORS[player];
    var altColor = player === PLAYER ? '#ff8a80' : '#fff176';
    var colors = [baseColor, altColor, '#ffffff'];

    for (var i = 0; i < winCells.length; i++) {
        var cellCx = winCells[i][1] * cs + cs / 2;
        var cellCy = winCells[i][0] * cs + cs / 2;
        for (var k = 0; k < 12; k++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 2 + Math.random() * 5;
            winParticles.push({
                x: cellCx, y: cellCy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4 + Math.random() * 6,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                life: 45 + Math.random() * 25,
                maxLife: 70,
                gravity: 0.2
            });
        }
    }

    // Particle animation loop
    function particleStep() {
        for (var pi = winParticles.length - 1; pi >= 0; pi--) {
            var p = winParticles[pi];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.rotSpeed;
            p.life--;
            if (p.life <= 0) winParticles.splice(pi, 1);
        }
        drawBoard();
        if (winParticles.length > 0) requestAnimationFrame(particleStep);
    }
    requestAnimationFrame(particleStep);
}

function dropPiece(col, player) {
    for (var r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            board[r][col] = player;
            return r;
        }
    }
    return -1;
}

function colFull(col) {
    return board[0][col] !== 0;
}

function checkWin(player) {
    // Horizontal
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c <= COLS - WIN; c++) {
            var cells = [];
            for (var k = 0; k < WIN; k++) cells.push([r, c+k]);
            if (cells.every(function(p) { return board[p[0]][p[1]] === player; })) return cells;
        }
    }
    // Vertical
    for (var r = 0; r <= ROWS - WIN; r++) {
        for (var c = 0; c < COLS; c++) {
            var cells = [];
            for (var k = 0; k < WIN; k++) cells.push([r+k, c]);
            if (cells.every(function(p) { return board[p[0]][p[1]] === player; })) return cells;
        }
    }
    // Diagonal down-right
    for (var r = 0; r <= ROWS - WIN; r++) {
        for (var c = 0; c <= COLS - WIN; c++) {
            var cells = [];
            for (var k = 0; k < WIN; k++) cells.push([r+k, c+k]);
            if (cells.every(function(p) { return board[p[0]][p[1]] === player; })) return cells;
        }
    }
    // Diagonal down-left
    for (var r = 0; r <= ROWS - WIN; r++) {
        for (var c = WIN - 1; c < COLS; c++) {
            var cells = [];
            for (var k = 0; k < WIN; k++) cells.push([r+k, c-k]);
            if (cells.every(function(p) { return board[p[0]][p[1]] === player; })) return cells;
        }
    }
    return null;
}

function isBoardFull() {
    return board[0].every(function(c) { return c !== 0; });
}

// AI scoring
function scoreWindow(window, player) {
    var opp = player === AI ? PLAYER : AI;
    var pCount = window.filter(function(c) { return c === player; }).length;
    var eCount = window.filter(function(c) { return c === 0; }).length;
    var oCount = window.filter(function(c) { return c === opp; }).length;
    if (pCount === 4) return 100;
    if (pCount === 3 && eCount === 1) return 5;
    if (pCount === 2 && eCount === 2) return 2;
    if (oCount === 3 && eCount === 1) return -4;
    return 0;
}

function scoreBoard(b, player) {
    var score = 0;
    var centerCount = 0;
    for (var r = 0; r < ROWS; r++) if (b[r][Math.floor(COLS/2)] === player) centerCount++;
    score += centerCount * 3;

    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c <= COLS - WIN; c++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r][c+k]);
            score += scoreWindow(w, player);
        }
    }
    for (var c = 0; c < COLS; c++) {
        for (var r = 0; r <= ROWS - WIN; r++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r+k][c]);
            score += scoreWindow(w, player);
        }
    }
    for (var r = 0; r <= ROWS - WIN; r++) {
        for (var c = 0; c <= COLS - WIN; c++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r+k][c+k]);
            score += scoreWindow(w, player);
        }
    }
    for (var r = 0; r <= ROWS - WIN; r++) {
        for (var c = WIN - 1; c < COLS; c++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r+k][c-k]);
            score += scoreWindow(w, player);
        }
    }
    return score;
}

function isTerminal(b) {
    if (checkWinBoard(b, PLAYER) || checkWinBoard(b, AI)) return true;
    return b[0].every(function(c) { return c !== 0; });
}

function checkWinBoard(b, player) {
    for (var r = 0; r < ROWS; r++)
        for (var c = 0; c <= COLS-WIN; c++)
            if ([0,1,2,3].every(function(k){ return b[r][c+k]===player; })) return true;
    for (var c = 0; c < COLS; c++)
        for (var r = 0; r <= ROWS-WIN; r++)
            if ([0,1,2,3].every(function(k){ return b[r+k][c]===player; })) return true;
    for (var r = 0; r <= ROWS-WIN; r++)
        for (var c = 0; c <= COLS-WIN; c++)
            if ([0,1,2,3].every(function(k){ return b[r+k][c+k]===player; })) return true;
    for (var r = 0; r <= ROWS-WIN; r++)
        for (var c = WIN-1; c < COLS; c++)
            if ([0,1,2,3].every(function(k){ return b[r+k][c-k]===player; })) return true;
    return false;
}

function getValidCols(b) {
    var cols = [];
    for (var c = 0; c < COLS; c++) if (b[0][c] === 0) cols.push(c);
    return cols;
}

function dropOnBoard(b, col, player) {
    var nb = b.map(function(row) { return row.slice(); });
    for (var r = ROWS - 1; r >= 0; r--) {
        if (nb[r][col] === 0) { nb[r][col] = player; break; }
    }
    return nb;
}

function minimax(b, depth, alpha, beta, isMax) {
    if (depth === 0 || isTerminal(b)) {
        if (checkWinBoard(b, AI)) return 100000 + depth;
        if (checkWinBoard(b, PLAYER)) return -100000 - depth;
        return scoreBoard(b, AI);
    }
    var cols = getValidCols(b);
    if (isMax) {
        var value = -Infinity;
        for (var i = 0; i < cols.length; i++) {
            var nb = dropOnBoard(b, cols[i], AI);
            value = Math.max(value, minimax(nb, depth-1, alpha, beta, false));
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return value;
    } else {
        var value = Infinity;
        for (var i = 0; i < cols.length; i++) {
            var nb = dropOnBoard(b, cols[i], PLAYER);
            value = Math.min(value, minimax(nb, depth-1, alpha, beta, true));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return value;
    }
}

function getBestCol() {
    var cols = getValidCols(board);
    var bestVal = -Infinity;
    var bestCol = cols[0];
    for (var i = 0; i < cols.length; i++) {
        var nb = dropOnBoard(board, cols[i], AI);
        var val = minimax(nb, 5, -Infinity, Infinity, false);
        if (val > bestVal) { bestVal = val; bestCol = cols[i]; }
    }
    return bestCol;
}

function getColFromX(x) {
    var cs = canvas.width / COLS;
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    return Math.floor((x - rect.left) * scaleX / cs);
}

function playerDrop(col) {
    if (!isPlaying || aiThinking) return;
    if (col < 0 || col >= COLS || colFull(col)) return;

    var toRow = -1;
    for (var r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) { toRow = r; break; }
    }
    if (toRow < 0) return;

    board[toRow][col] = PLAYER;
    GameAudio.place();
    animateFall(col, toRow, PLAYER, function() {
        var win = checkWin(PLAYER);
        if (win) { flashWin(win, PLAYER); return; }
        if (isBoardFull()) { endGame('draw'); return; }
        aiThinking = true;
        drawBoard();
        setTimeout(function() {
            var ac = getBestCol();
            var aiToRow = -1;
            for (var r = ROWS - 1; r >= 0; r--) {
                if (board[r][ac] === 0) { aiToRow = r; break; }
            }
            board[aiToRow][ac] = AI;
            GameAudio.place();
            animateFall(ac, aiToRow, AI, function() {
                var aiWin = checkWin(AI);
                if (aiWin) { flashWin(aiWin, AI); return; }
                if (isBoardFull()) { endGame('draw'); return; }
                aiThinking = false;
                drawBoard();
            });
        }, 350);
    });
}

function flashWin(cells, player) {
    spawnWinParticles(cells, player);
    var flashes = 0;
    function step() {
        if (flashes >= 6) { endGame(player === PLAYER ? 'win' : 'loss', cells); return; }
        drawBoard(cells);
        flashes++;
        setTimeout(step, 200);
    }
    step();
}

function endGame(result, winCells) {
    isPlaying = false;
    aiThinking = false;
    if (winCells) drawBoard(winCells); else drawBoard();
    var title, detail;
    if (result === 'win') {
        wins++; localStorage.setItem('c4wins', wins);
        title = '¡Ganaste! 🎉'; detail = '¡Bien jugado!';
        GameAudio.win();
    } else if (result === 'loss') {
        losses++; localStorage.setItem('c4losses', losses);
        title = 'Perdiste 😔'; detail = 'La IA ganó esta vez';
        GameAudio.gameOver();
    } else {
        draws++; localStorage.setItem('c4draws', draws);
        title = '¡Empate!'; detail = 'Tablero lleno';
        GameAudio.noMatch();
    }
    updateScores();
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('finalScore').textContent = detail;
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 600);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function updateScores() {
    document.getElementById('wins').textContent = wins;
    document.getElementById('losses').textContent = losses;
    document.getElementById('draws').textContent = draws;
    document.getElementById('mobileScore').textContent = 'W:' + wins + ' L:' + losses;
}

function startGame() {
    GameAudio.start();
    newBoard();
    isPlaying = true;
    aiThinking = false;
    hoverCol = -1;
    fallingPieces = [];
    winParticles = [];
    hoverPulseTime = 0;
    drawBoard();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    updateScores();
}

// Mouse events
canvas.addEventListener('mousemove', function(e) {
    if (!isPlaying || aiThinking) return;
    hoverCol = getColFromX(e.clientX);
    if (hoverCol < 0 || hoverCol >= COLS) hoverCol = -1;
    drawBoard();
});
canvas.addEventListener('mouseleave', function() {
    hoverCol = -1;
    if (isPlaying) drawBoard();
});
canvas.addEventListener('click', function(e) {
    var col = getColFromX(e.clientX);
    if (col >= 0 && col < COLS) playerDrop(col);
});
canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var col = getColFromX(touch.clientX);
    if (col >= 0 && col < COLS) playerDrop(col);
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isPlaying || aiThinking) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    var cs = canvas.width / COLS;
    var col = Math.floor(x / cs);
    if (col < 0 || col >= COLS) col = -1;
    if (col !== hoverCol) {
        hoverCol = col;
        drawBoard();
    }
}, { passive: false });

canvas.addEventListener('touchend', function() {
    hoverCol = -1;
    if (isPlaying) drawBoard();
});

// Ocultar touchControls al usar controles directos en canvas
(function() {
    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
})();

// Touch column buttons
document.querySelectorAll('.col-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        playerDrop(parseInt(this.dataset.col));
    });
    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        playerDrop(parseInt(this.dataset.col));
    }, { passive: false });
});

// Keyboard
document.addEventListener('keydown', function(e) {
    if (!isPlaying || aiThinking) return;
    if (e.key === 'ArrowLeft') { hoverCol = Math.max(0, (hoverCol < 0 ? 3 : hoverCol) - 1); drawBoard(); }
    if (e.key === 'ArrowRight') { hoverCol = Math.min(COLS-1, (hoverCol < 0 ? 3 : hoverCol) + 1); drawBoard(); }
    if (e.key === 'ArrowDown' || e.key === 'Enter') { if (hoverCol >= 0) playerDrop(hoverCol); }
});

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
newBoard();
drawBoard();
updateScores();

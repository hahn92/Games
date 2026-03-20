// Conecta 4 vs IA
var canvas = document.getElementById('c4Canvas');
var ctx = canvas.getContext('2d');

var COLS = 7, ROWS = 6, WIN = 4;
var PLAYER = 1, AI = 2;
var COLORS = { 0: null, 1: '#ef5350', 2: '#fdd835' };

var board = [];
var isPlaying = false;
var aiThinking = false;
var hoverCol = -1;
var wins = parseInt(localStorage.getItem('c4wins') || '0', 10);
var losses = parseInt(localStorage.getItem('c4losses') || '0', 10);
var draws = parseInt(localStorage.getItem('c4draws') || '0', 10);

function newBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
        board[r] = [];
        for (var c = 0; c < COLS; c++) board[r][c] = 0;
    }
}

function cellSize() { return canvas.width / COLS; }

function drawBoard(winCells) {
    var cs = cellSize();
    var radius = cs * 0.4;

    // Board background
    ctx.fillStyle = '#1565c0';
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 10);
    ctx.fill();

    // Hover highlight
    if (hoverCol >= 0 && isPlaying && !aiThinking) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(hoverCol * cs, 0, cs, canvas.height);
    }

    // Circles
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            var cx = c * cs + cs / 2;
            var cy = r * cs + cs / 2;
            var val = board[r][c];

            // Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = val ? 8 : 0;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);

            if (val === 0) {
                ctx.fillStyle = '#0d47a1';
            } else {
                ctx.fillStyle = COLORS[val];
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // Highlight on winning cells
            if (winCells) {
                for (var i = 0; i < winCells.length; i++) {
                    if (winCells[i][0] === r && winCells[i][1] === c) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                }
            }
        }
    }

    // Column indicator arrow on hover
    if (hoverCol >= 0 && isPlaying && !aiThinking) {
        var ax = hoverCol * cs + cs / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(ax - 8, 6);
        ctx.lineTo(ax + 8, 6);
        ctx.lineTo(ax, 14);
        ctx.closePath();
        ctx.fill();
    }
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
    // Center column preference
    var centerCount = 0;
    for (var r = 0; r < ROWS; r++) if (b[r][Math.floor(COLS/2)] === player) centerCount++;
    score += centerCount * 3;

    // Horizontal
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c <= COLS - WIN; c++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r][c+k]);
            score += scoreWindow(w, player);
        }
    }
    // Vertical
    for (var c = 0; c < COLS; c++) {
        for (var r = 0; r <= ROWS - WIN; r++) {
            var w = [];
            for (var k = 0; k < WIN; k++) w.push(b[r+k][c]);
            score += scoreWindow(w, player);
        }
    }
    // Diag
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
    // Horizontal
    for (var r = 0; r < ROWS; r++)
        for (var c = 0; c <= COLS-WIN; c++)
            if ([0,1,2,3].every(function(k){ return b[r][c+k]===player; })) return true;
    // Vertical
    for (var c = 0; c < COLS; c++)
        for (var r = 0; r <= ROWS-WIN; r++)
            if ([0,1,2,3].every(function(k){ return b[r+k][c]===player; })) return true;
    // Diag
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
    dropPiece(col, PLAYER);
    drawBoard();
    var win = checkWin(PLAYER);
    if (win) { flashWin(win, PLAYER); return; }
    if (isBoardFull()) { endGame('draw'); return; }
    aiThinking = true;
    setTimeout(function() {
        var ac = getBestCol();
        dropPiece(ac, AI);
        drawBoard();
        var aiWin = checkWin(AI);
        if (aiWin) { flashWin(aiWin, AI); return; }
        if (isBoardFull()) { endGame('draw'); return; }
        aiThinking = false;
    }, 350);
}

function flashWin(cells, player) {
    var flashes = 0;
    var orig = COLORS[player];
    var bright = player === PLAYER ? '#ff8a80' : '#fff9c4';
    function step() {
        if (flashes >= 6) { endGame(player === PLAYER ? 'win' : 'loss', cells); return; }
        var color = (flashes % 2 === 0) ? bright : orig;
        // temporarily override cell color for drawing
        var savedColors = {};
        cells.forEach(function(p) { savedColors[p[0]+','+p[1]] = board[p[0]][p[1]]; });
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
    } else if (result === 'loss') {
        losses++; localStorage.setItem('c4losses', losses);
        title = 'Perdiste 😔'; detail = 'La IA ganó esta vez';
    } else {
        draws++; localStorage.setItem('c4draws', draws);
        title = '¡Empate!'; detail = 'Tablero lleno';
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
    newBoard();
    isPlaying = true;
    aiThinking = false;
    hoverCol = -1;
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

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
newBoard();
drawBoard();
updateScores();

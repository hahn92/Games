// Buscaminas
const COLS = 16;
const ROWS = 12;
const TOTAL_MINES = 40;

let board = [];       // { mine, revealed, flagged, adjacent }
let isPlaying = false;
let firstClick = true;
let timerInterval = null;
let elapsedTime = 0;
let flaggedCount = 0;
let revealedCount = 0;
let flagMode = false;
let bestTime = parseInt(localStorage.getItem('minesweeperBest') || '0', 10) || null;

function buildBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
        board[r] = [];
        for (var c = 0; c < COLS; c++) {
            board[r][c] = { mine: false, revealed: false, flagged: false, adjacent: 0 };
        }
    }
}

function placeMines(skipRow, skipCol) {
    var placed = 0;
    while (placed < TOTAL_MINES) {
        var r = Math.floor(Math.random() * ROWS);
        var c = Math.floor(Math.random() * COLS);
        if (board[r][c].mine) continue;
        // Skip the clicked cell and its neighbors
        if (Math.abs(r - skipRow) <= 1 && Math.abs(c - skipCol) <= 1) continue;
        board[r][c].mine = true;
        placed++;
    }
    // Calculate adjacent counts
    for (var row = 0; row < ROWS; row++) {
        for (var col = 0; col < COLS; col++) {
            if (board[row][col].mine) continue;
            var count = 0;
            for (var dr = -1; dr <= 1; dr++) {
                for (var dc = -1; dc <= 1; dc++) {
                    var nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
                }
            }
            board[row][col].adjacent = count;
        }
    }
}

function renderBoard() {
    var container = document.getElementById('mineBoard');
    container.innerHTML = '';
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            var cell = document.createElement('div');
            cell.className = 'mine-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            var cellData = board[r][c];

            if (cellData.revealed) {
                cell.classList.add('revealed');
                if (cellData.mine) {
                    cell.textContent = '💣';
                    if (cellData.exploded) cell.classList.add('exploded');
                } else if (cellData.adjacent > 0) {
                    cell.textContent = cellData.adjacent;
                    cell.classList.add('n' + cellData.adjacent);
                }
            } else if (cellData.flagged) {
                cell.classList.add('flagged');
                cell.textContent = '🚩';
            }

            cell.addEventListener('click', onCellClick);
            cell.addEventListener('contextmenu', onCellRightClick);
            cell.addEventListener('touchstart', onCellTouch, { passive: false });
            container.appendChild(cell);
        }
    }
}

function updateCell(r, c) {
    var container = document.getElementById('mineBoard');
    var idx = r * COLS + c;
    var cell = container.children[idx];
    var cellData = board[r][c];

    cell.className = 'mine-cell';
    cell.textContent = '';

    if (cellData.revealed) {
        cell.classList.add('revealed');
        if (cellData.mine) {
            cell.textContent = '💣';
            if (cellData.exploded) cell.classList.add('exploded');
        } else if (cellData.adjacent > 0) {
            cell.textContent = cellData.adjacent;
            cell.classList.add('n' + cellData.adjacent);
        }
    } else if (cellData.flagged) {
        cell.classList.add('flagged');
        cell.textContent = '🚩';
    }
}

function onCellClick(e) {
    e.preventDefault();
    var r = parseInt(this.dataset.row);
    var c = parseInt(this.dataset.col);
    if (!isPlaying) return;
    if (flagMode) {
        toggleFlag(r, c);
    } else {
        revealCell(r, c);
    }
}

function onCellRightClick(e) {
    e.preventDefault();
    var r = parseInt(this.dataset.row);
    var c = parseInt(this.dataset.col);
    if (!isPlaying) return;
    toggleFlag(r, c);
}

var touchTimer = null;
function onCellTouch(e) {
    e.preventDefault();
    var cell = this;
    var r = parseInt(cell.dataset.row);
    var c = parseInt(cell.dataset.col);
    if (!isPlaying) return;

    if (flagMode) {
        toggleFlag(r, c);
        return;
    }
    // Long press = flag
    touchTimer = setTimeout(function() {
        touchTimer = null;
        toggleFlag(r, c);
    }, 500);
    cell.addEventListener('touchend', function onEnd() {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
            revealCell(r, c);
        }
        cell.removeEventListener('touchend', onEnd);
    }, { once: true });
}

function toggleFlag(r, c) {
    var cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flaggedCount += cell.flagged ? 1 : -1;
    updateCell(r, c);
    updateHUD();
}

function revealCell(r, c) {
    var cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        // Recalculate all adjacencies now
        renderBoard();
        startTimer();
    }

    floodReveal(r, c);

    if (board[r][c].mine) {
        // Hit a mine
        board[r][c].exploded = true;
        revealAllMines();
        gameOver(false);
        return;
    }

    updateHUD();
    checkWin();
}

function floodReveal(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    var cell = board[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    revealedCount++;
    updateCell(r, c);

    if (!cell.mine && cell.adjacent === 0) {
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                floodReveal(r + dr, c + dc);
            }
        }
    }
}

function revealAllMines() {
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            if (board[r][c].mine && !board[r][c].flagged) {
                board[r][c].revealed = true;
                updateCell(r, c);
            }
        }
    }
}

function checkWin() {
    var totalSafe = ROWS * COLS - TOTAL_MINES;
    if (revealedCount >= totalSafe) {
        gameOver(true);
    }
}

function startTimer() {
    elapsedTime = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        elapsedTime++;
        document.getElementById('timer').textContent = elapsedTime;
        updateHUD();
    }, 1000);
}

function updateHUD() {
    var remaining = TOTAL_MINES - flaggedCount;
    document.getElementById('mineCount').textContent = remaining;
    document.getElementById('timer').textContent = elapsedTime;
    if (bestTime) {
        document.getElementById('highScore').textContent = bestTime + 's';
    } else {
        document.getElementById('highScore').textContent = '--';
    }
    document.getElementById('mobileScore').textContent = 'Minas: ' + remaining + ' | T: ' + elapsedTime + 's';
}

function gameOver(won) {
    isPlaying = false;
    clearInterval(timerInterval);

    if (won) {
        document.getElementById('popupTitle').textContent = '¡Ganaste! 🎉';
        document.getElementById('finalScore').textContent = 'Tiempo: ' + elapsedTime + 's';
        if (!bestTime || elapsedTime < bestTime) {
            bestTime = elapsedTime;
            localStorage.setItem('minesweeperBest', bestTime);
        }
        updateHUD();
    } else {
        document.getElementById('popupTitle').textContent = '¡Boom! 💥';
        document.getElementById('finalScore').textContent = 'Pisaste una mina';
    }

    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 600);

    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function startGame() {
    buildBoard();
    renderBoard();
    isPlaying = true;
    firstClick = true;
    elapsedTime = 0;
    flaggedCount = 0;
    revealedCount = 0;

    clearInterval(timerInterval);
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    updateHUD();
}

function restartGame() {
    clearInterval(timerInterval);
    startGame();
}

// Flag toggle button (mobile)
document.getElementById('flagToggle').addEventListener('click', function() {
    flagMode = !flagMode;
    this.textContent = flagMode ? '🚩 Bandera: ON' : '🚩 Bandera: OFF';
    this.style.background = flagMode ? '#e53935' : '#ff9800';
    this.style.color = flagMode ? '#fff' : '#222';
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
buildBoard();
renderBoard();
updateHUD();

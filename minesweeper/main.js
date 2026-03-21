// Buscaminas - Enhanced

// Difficulty presets
var DIFFICULTIES = {
    easy:   { cols: 9,  rows: 9,  mines: 10, label: 'Fácil' },
    normal: { cols: 16, rows: 12, mines: 40, label: 'Normal' },
    hard:   { cols: 16, rows: 16, mines: 60, label: 'Difícil' }
};

var currentDifficulty = 'normal';
var COLS = DIFFICULTIES[currentDifficulty].cols;
var ROWS = DIFFICULTIES[currentDifficulty].rows;
var TOTAL_MINES = DIFFICULTIES[currentDifficulty].mines;

var board = [];
var isPlaying = false;
var firstClick = true;
var timerInterval = null;
var elapsedTime = 0;
var flaggedCount = 0;
var revealedCount = 0;
var flagMode = false;

function getBestTimeKey() {
    return 'minesweeperBest_' + currentDifficulty;
}
function getBestTime() {
    var v = parseInt(localStorage.getItem(getBestTimeKey()) || '0', 10);
    return v || null;
}
function setBestTime(t) {
    localStorage.setItem(getBestTimeKey(), t);
}

// ---- Build difficulty selector dynamically ----
function buildDifficultySelector() {
    var infoSide = document.getElementById('infoSide');
    var buttonsPanel = infoSide.querySelector('.buttons-panel');

    var sel = document.createElement('div');
    sel.id = 'diffSelector';
    sel.className = 'diff-selector';
    Object.keys(DIFFICULTIES).forEach(function(key) {
        var btn = document.createElement('button');
        btn.className = 'diff-btn' + (key === currentDifficulty ? ' active' : '');
        btn.dataset.diff = key;
        btn.textContent = DIFFICULTIES[key].label;
        btn.addEventListener('click', function() {
            if (key === currentDifficulty) return;
            currentDifficulty = key;
            COLS = DIFFICULTIES[key].cols;
            ROWS = DIFFICULTIES[key].rows;
            TOTAL_MINES = DIFFICULTIES[key].mines;
            document.querySelectorAll('.diff-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.diff === key);
            });
            clearInterval(timerInterval);
            elapsedTime = 0;
            startGame();
        });
        sel.appendChild(btn);
    });
    infoSide.insertBefore(sel, buttonsPanel);
}

// ---- Flags/mines counter display ----
function buildFlagCounter() {
    var scorePanel = document.querySelector('.score-panel');
    // Replace mineCount span display to show flags/total
    var mineSpan = scorePanel.querySelector('span');
    mineSpan.innerHTML = 'Minas: <span id="mineCount">40</span>';
    // Add flags display
    var flagSpan = document.createElement('span');
    flagSpan.innerHTML = 'Banderas: <span id="flagCount">0</span>/<span id="totalMines">40</span>';
    scorePanel.insertBefore(flagSpan, mineSpan.nextSibling);
}

function buildBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
        board[r] = [];
        for (var c = 0; c < COLS; c++) {
            board[r][c] = { mine: false, revealed: false, flagged: false, adjacent: 0, exploded: false };
        }
    }
}

function placeMines(skipRow, skipCol) {
    var placed = 0;
    while (placed < TOTAL_MINES) {
        var r = Math.floor(Math.random() * ROWS);
        var c = Math.floor(Math.random() * COLS);
        if (board[r][c].mine) continue;
        if (Math.abs(r - skipRow) <= 1 && Math.abs(c - skipCol) <= 1) continue;
        board[r][c].mine = true;
        placed++;
    }
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
    container.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';

    // Set board size based on difficulty
    if (currentDifficulty === 'easy') {
        container.style.width = '320px';
        container.style.height = '320px';
    } else if (currentDifficulty === 'hard') {
        container.style.width = '500px';
        container.style.height = '500px';
    } else {
        container.style.width = '500px';
        container.style.height = '380px';
    }

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
                    if (cellData.exploded) cell.classList.add('mine-hit');
                } else if (cellData.adjacent > 0) {
                    cell.textContent = cellData.adjacent;
                    cell.classList.add('n' + cellData.adjacent);
                }
            } else if (cellData.flagged) {
                cell.classList.add('flagged');
                cell.innerHTML = '<span class="flag-icon">🚩</span>';
            }

            cell.addEventListener('click', onCellClick);
            cell.addEventListener('contextmenu', onCellRightClick);
            cell.addEventListener('touchstart', onCellTouch, { passive: false });
            container.appendChild(cell);
        }
    }
}

function updateCell(r, c, revealDelay) {
    var container = document.getElementById('mineBoard');
    var idx = r * COLS + c;
    var cell = container.children[idx];
    if (!cell) return;
    var cellData = board[r][c];

    cell.className = 'mine-cell';
    cell.textContent = '';
    cell.style.transitionDelay = '';

    if (cellData.revealed) {
        cell.classList.add('revealed');

        if (revealDelay !== undefined) {
            cell.style.transitionDelay = revealDelay + 'ms';
            cell.classList.add('reveal-animate');
        }

        if (cellData.mine) {
            cell.textContent = '💣';
            if (cellData.exploded) cell.classList.add('mine-hit');
        } else if (cellData.adjacent > 0) {
            cell.textContent = cellData.adjacent;
            cell.classList.add('n' + cellData.adjacent);
        }
    } else if (cellData.flagged) {
        cell.classList.add('flagged');
        cell.innerHTML = '<span class="flag-icon">🚩</span>';
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

    var container = document.getElementById('mineBoard');
    var idx = r * COLS + c;
    var domCell = container.children[idx];
    if (!domCell) return;

    domCell.className = 'mine-cell';
    domCell.textContent = '';
    domCell.style.transitionDelay = '';

    if (cell.flagged) {
        domCell.classList.add('flagged', 'flag-bounce');
        domCell.innerHTML = '<span class="flag-icon">🚩</span>';
        setTimeout(function() { domCell.classList.remove('flag-bounce'); }, 300);
    } else {
        domCell.classList.add('flag-remove');
        setTimeout(function() { domCell.classList.remove('flag-remove'); }, 150);
    }

    updateHUD();
}

// Origin of the current flood reveal (for cascade delay calculation)
var _originR = 0, _originC = 0;

function revealCell(r, c) {
    var cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        renderBoard();
        startTimer();
    }

    _originR = r;
    _originC = c;
    floodReveal(r, c);

    if (board[r][c].mine) {
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

    var dist = Math.abs(r - _originR) + Math.abs(c - _originC);
    var delay = dist * 20;
    updateCell(r, c, delay);

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
    var mineIndex = 0;
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            if (board[r][c].mine && !board[r][c].flagged) {
                board[r][c].revealed = true;
                var container = document.getElementById('mineBoard');
                var idx = r * COLS + c;
                var domCell = container.children[idx];
                if (domCell) {
                    (function(cell, delay, exploded) {
                        setTimeout(function() {
                            cell.className = 'mine-cell revealed';
                            cell.textContent = '💣';
                            if (exploded) {
                                cell.classList.add('mine-hit');
                            } else {
                                cell.classList.add('mine-reveal');
                            }
                        }, delay);
                    })(domCell, mineIndex * 50, board[r][c].exploded);
                    mineIndex++;
                }
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

    var flagCountEl = document.getElementById('flagCount');
    var totalMinesEl = document.getElementById('totalMines');
    if (flagCountEl) flagCountEl.textContent = flaggedCount;
    if (totalMinesEl) totalMinesEl.textContent = TOTAL_MINES;

    var bestTime = getBestTime();
    var hsEl = document.getElementById('highScore');
    if (hsEl) {
        if (bestTime) {
            hsEl.textContent = bestTime + 's';
        } else {
            hsEl.textContent = '--';
        }
    }

    document.getElementById('mobileScore').textContent =
        'Minas: ' + remaining + ' | 🚩 ' + flaggedCount + '/' + TOTAL_MINES + ' | T: ' + elapsedTime + 's';
}

function applyWinAnimation() {
    var container = document.getElementById('mineBoard');
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            if (board[r][c].revealed && !board[r][c].mine) {
                var idx = r * COLS + c;
                var domCell = container.children[idx];
                if (domCell) {
                    (function(cell, row) {
                        setTimeout(function() {
                            cell.classList.add('cell-won');
                        }, row * 60);
                    })(domCell, r);
                }
            }
        }
    }
}

function gameOver(won) {
    isPlaying = false;
    clearInterval(timerInterval);

    if (won) {
        var bestTime = getBestTime();
        document.getElementById('popupTitle').textContent = '¡Ganaste! 🎉';
        document.getElementById('finalScore').textContent = 'Tiempo: ' + elapsedTime + 's';
        if (!bestTime || elapsedTime < bestTime) {
            setBestTime(elapsedTime);
        }
        applyWinAnimation();
        updateHUD();
    } else {
        document.getElementById('popupTitle').textContent = '¡Boom! 💥';
        document.getElementById('finalScore').textContent = 'Pisaste una mina';
    }

    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 800);

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
buildDifficultySelector();
buildFlagCounter();
buildBoard();
renderBoard();
updateHUD();

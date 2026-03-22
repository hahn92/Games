// Tres en Raya vs IA - Enhanced
var board = ['','','','','','','','',''];
var isPlaying = false;
var aiThinking = false;
var aiDifficulty = 'hard'; // 'easy' | 'hard'
var wins   = parseInt(localStorage.getItem('tttWins')   || '0', 10);
var losses = parseInt(localStorage.getItem('tttLosses') || '0', 10);
var draws  = parseInt(localStorage.getItem('tttDraws')  || '0', 10);
var currentPlayer = 'X'; // always X first

var LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

// ---- AI difficulty selector ---- (built dynamically, injected into info-side)
function buildAIDiffSelector() {
    var infoSide = document.getElementById('infoSide');
    var buttonsPanel = infoSide.querySelector('.buttons-panel');
    var wrap = document.createElement('div');
    wrap.className = 'ai-diff-wrap';
    wrap.innerHTML = '<span class="ai-diff-label">IA:</span>';
    ['easy','hard'].forEach(function(d) {
        var btn = document.createElement('button');
        btn.className = 'ai-diff-btn' + (d === aiDifficulty ? ' active' : '');
        btn.dataset.diff = d;
        btn.textContent = d === 'easy' ? 'Fácil' : 'Difícil';
        btn.addEventListener('click', function() {
            if (d === aiDifficulty) return;
            aiDifficulty = d;
            document.querySelectorAll('.ai-diff-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.diff === d);
            });
            if (isPlaying) startGame();
        });
        wrap.appendChild(btn);
    });
    infoSide.insertBefore(wrap, buttonsPanel);
}

// ---- Winner check ----
function checkWinner(b) {
    for (var i = 0; i < LINES.length; i++) {
        var line = LINES[i];
        if (b[line[0]] && b[line[0]] === b[line[1]] && b[line[1]] === b[line[2]]) {
            return { winner: b[line[0]], line: line };
        }
    }
    if (b.every(function(c) { return c !== ''; })) return { winner: 'draw', line: null };
    return null;
}

// ---- Minimax (hard AI) ----
function minimax(b, isMax) {
    var result = checkWinner(b);
    if (result) {
        if (result.winner === 'O') return 10;
        if (result.winner === 'X') return -10;
        return 0;
    }
    if (isMax) {
        var best = -Infinity;
        for (var i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'O';
                best = Math.max(best, minimax(b, false));
                b[i] = '';
            }
        }
        return best;
    } else {
        var best = Infinity;
        for (var i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'X';
                best = Math.min(best, minimax(b, true));
                b[i] = '';
            }
        }
        return best;
    }
}

function getBestMove() {
    if (aiDifficulty === 'easy') {
        // Random move
        var empty = [];
        for (var i = 0; i < 9; i++) { if (board[i] === '') empty.push(i); }
        return empty.length ? empty[Math.floor(Math.random() * empty.length)] : -1;
    }
    // Hard: minimax
    var bestVal = -Infinity;
    var bestMove = -1;
    for (var i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            var val = minimax(board, false);
            board[i] = '';
            if (val > bestVal) {
                bestVal = val;
                bestMove = i;
            }
        }
    }
    return bestMove;
}

// ---- Render ----
function renderBoard() {
    var cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(function(cell, i) {
        var prev = cell.dataset.value || '';
        var curr = board[i];

        // Reset classes except winner
        var wasWinner = cell.classList.contains('winner');
        cell.className = 'ttt-cell';
        if (wasWinner) cell.classList.add('winner');

        cell.dataset.value = curr;
        cell.innerHTML = '';

        if (curr === 'X') {
            cell.classList.add('x');
            cell.innerHTML = buildXSVG();
        } else if (curr === 'O') {
            cell.classList.add('o');
            cell.innerHTML = buildOSVG();
        }
    });
    updateHoverIndicator();
}

function buildXSVG() {
    return '<svg class="piece-svg x-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<line class="x-line1" x1="15" y1="15" x2="85" y2="85" stroke-linecap="round"/>' +
        '<line class="x-line2" x1="85" y1="15" x2="15" y2="85" stroke-linecap="round"/>' +
        '</svg>';
}

function buildOSVG() {
    return '<svg class="piece-svg o-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<circle class="o-circle" cx="50" cy="50" r="35"/>' +
        '</svg>';
}

function updateHoverIndicator() {
    if (!isPlaying || aiThinking) return;
    var cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(function(cell, i) {
        cell.classList.remove('hover-x', 'hover-o');
        if (board[i] === '') {
            cell.classList.add(currentPlayer === 'X' ? 'hover-x' : 'hover-o');
        }
    });
}

function highlightWinner(line) {
    var cells = document.querySelectorAll('.ttt-cell');
    line.forEach(function(i) { cells[i].classList.add('winner'); });
    drawWinLine(line);
}

function drawWinLine(line) {
    var boardEl = document.getElementById('tttBoard');
    // Remove old win line
    var old = boardEl.querySelector('.win-line');
    if (old) old.remove();

    var cells = document.querySelectorAll('.ttt-cell');
    var c0 = cells[line[0]].getBoundingClientRect();
    var c2 = cells[line[2]].getBoundingClientRect();
    var bRect = boardEl.getBoundingClientRect();

    var x1 = c0.left + c0.width  / 2 - bRect.left;
    var y1 = c0.top  + c0.height / 2 - bRect.top;
    var x2 = c2.left + c2.width  / 2 - bRect.left;
    var y2 = c2.top  + c2.height / 2 - bRect.top;

    var dx = x2 - x1;
    var dy = y2 - y1;
    var length = Math.sqrt(dx * dx + dy * dy);
    var angle  = Math.atan2(dy, dx) * 180 / Math.PI;

    var line_el = document.createElement('div');
    line_el.className = 'win-line';
    line_el.style.width  = length + 'px';
    line_el.style.left   = x1 + 'px';
    line_el.style.top    = (y1 - 3) + 'px';   // -3 = mitad del alto (6px) para centrar
    line_el.style.setProperty('--win-angle', angle + 'deg');
    boardEl.appendChild(line_el);
}

function setStatus(msg, pulsing) {
    var el = document.getElementById('statusMsg');
    el.textContent = msg;
    el.classList.remove('thinking', 'your-turn');
    if (pulsing === 'thinking') el.classList.add('thinking');
    else if (pulsing === 'turn')    el.classList.add('your-turn');
}

function animateScoreEl(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('score-bump');
    void el.offsetWidth; // force reflow
    el.classList.add('score-bump');
}

function updateScores(changedId) {
    document.getElementById('wins').textContent   = wins;
    document.getElementById('losses').textContent = losses;
    document.getElementById('draws').textContent  = draws;
    document.getElementById('mobileScore').textContent = 'W:' + wins + ' L:' + losses + ' E:' + draws;
    if (changedId) animateScoreEl(changedId);
}

function triggerDrawFlash() {
    var boardEl = document.getElementById('tttBoard');
    boardEl.classList.remove('draw-flash');
    void boardEl.offsetWidth;
    boardEl.classList.add('draw-flash');
    setTimeout(function() { boardEl.classList.remove('draw-flash'); }, 600);
}

function endGame(result) {
    isPlaying = false;
    var title, detail, changedId;

    if (result.winner === 'X') {
        wins++;
        localStorage.setItem('tttWins', wins);
        title = '¡Ganaste! 🎉';
        detail = '¡Bien jugado!';
        changedId = 'wins';
        if (result.line) highlightWinner(result.line);
        setStatus('¡Ganaste!');
        GameAudio.win();
    } else if (result.winner === 'O') {
        losses++;
        localStorage.setItem('tttLosses', losses);
        title = 'Perdiste 😔';
        detail = 'La IA ganó esta vez';
        changedId = 'losses';
        if (result.line) highlightWinner(result.line);
        setStatus('La IA ganó');
        GameAudio.gameOver();
    } else {
        draws++;
        localStorage.setItem('tttDraws', draws);
        title = '¡Empate!';
        detail = 'Nadie ganó';
        changedId = 'draws';
        triggerDrawFlash();
        setStatus('Empate');
        GameAudio.noMatch();
    }

    updateScores(changedId);
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('finalScore').textContent = detail;
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 600);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    // Clear hover hints
    document.querySelectorAll('.ttt-cell').forEach(function(c) {
        c.classList.remove('hover-x', 'hover-o');
    });
}

function playerMove(idx) {
    if (!isPlaying || aiThinking || board[idx] !== '') return;
    board[idx] = 'X';
    currentPlayer = 'O';
    GameAudio.click();
    renderBoard();
    var result = checkWinner(board);
    if (result) { endGame(result); return; }

    setStatus('IA pensando...', 'thinking');
    aiThinking = true;

    setTimeout(function() {
        var move = getBestMove();
        if (move !== -1) {
            board[move] = 'O';
            currentPlayer = 'X';
            renderBoard();
        }
        aiThinking = false;
        var r = checkWinner(board);
        if (r) { endGame(r); return; }
        setStatus('Tu turno (X)', 'turn');
        updateHoverIndicator();
    }, aiDifficulty === 'easy' ? 200 : 350);
}

function resetCellsAnimated(callback) {
    var cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(function(cell, i) {
        cell.style.transitionDelay = (i * 40) + 'ms';
        cell.classList.add('cell-exit');
    });
    setTimeout(function() {
        cells.forEach(function(cell) {
            cell.style.transitionDelay = '';
            cell.classList.remove('cell-exit');
            cell.className = 'ttt-cell';
            cell.dataset.value = '';
            cell.innerHTML = '';
        });
        // Remove win line
        var old = document.getElementById('tttBoard').querySelector('.win-line');
        if (old) old.remove();
        if (callback) callback();
    }, cells.length * 40 + 200);
}

function startGame() {
    GameAudio.start();
    currentPlayer = 'X';
    aiThinking = false;

    resetCellsAnimated(function() {
        board = ['','','','','','','','',''];
        isPlaying = true;
        setStatus('Tu turno (X)', 'turn');
        document.getElementById('gameOverPopup').style.display = 'none';
        document.getElementById('startBtn').disabled = true;
        document.getElementById('restartBtn').disabled = false;
        updateScores();
        updateHoverIndicator();
    });
}

// ---- Event listeners ----
document.querySelectorAll('.ttt-cell').forEach(function(cell) {
    cell.addEventListener('click', function() {
        playerMove(parseInt(this.dataset.index));
    });
    cell.addEventListener('touchstart', function(e) {
        e.preventDefault();
        playerMove(parseInt(this.dataset.index));
    }, { passive: false });

    cell.addEventListener('mouseenter', function() {
        if (!isPlaying || aiThinking || board[parseInt(this.dataset.index)] !== '') return;
        // Handled via CSS :hover + class
    });
});

document.getElementById('startBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});
document.getElementById('restartBtn').addEventListener('click', function() {
    GameAudio.click();
    startGame();
});
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
buildAIDiffSelector();
updateScores();

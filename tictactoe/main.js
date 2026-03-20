// Tres en Raya vs IA
var board = ['','','','','','','','',''];
var isPlaying = false;
var aiThinking = false;
var wins = parseInt(localStorage.getItem('tttWins') || '0', 10);
var losses = parseInt(localStorage.getItem('tttLosses') || '0', 10);
var draws = parseInt(localStorage.getItem('tttDraws') || '0', 10);

var LINES = [
    [0,1,2],[3,4,5],[6,7,8],  // rows
    [0,3,6],[1,4,7],[2,5,8],  // cols
    [0,4,8],[2,4,6]            // diags
];

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

function renderBoard() {
    var cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(function(cell, i) {
        cell.textContent = board[i];
        cell.className = 'ttt-cell';
        if (board[i] === 'X') cell.classList.add('x');
        if (board[i] === 'O') cell.classList.add('o');
    });
}

function highlightWinner(line) {
    var cells = document.querySelectorAll('.ttt-cell');
    line.forEach(function(i) { cells[i].classList.add('winner'); });
}

function setStatus(msg) {
    document.getElementById('statusMsg').textContent = msg;
}

function updateScores() {
    document.getElementById('wins').textContent = wins;
    document.getElementById('losses').textContent = losses;
    document.getElementById('draws').textContent = draws;
    document.getElementById('mobileScore').textContent = 'W:' + wins + ' L:' + losses + ' E:' + draws;
}

function endGame(result) {
    isPlaying = false;
    var title, detail;
    if (result.winner === 'X') {
        wins++;
        localStorage.setItem('tttWins', wins);
        title = '¡Ganaste! 🎉';
        detail = '¡Bien jugado!';
        if (result.line) highlightWinner(result.line);
        setStatus('¡Ganaste!');
    } else if (result.winner === 'O') {
        losses++;
        localStorage.setItem('tttLosses', losses);
        title = 'Perdiste 😔';
        detail = 'La IA ganó esta vez';
        if (result.line) highlightWinner(result.line);
        setStatus('La IA ganó');
    } else {
        draws++;
        localStorage.setItem('tttDraws', draws);
        title = '¡Empate!';
        detail = 'Nadie ganó';
        setStatus('Empate');
    }
    updateScores();
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('finalScore').textContent = detail;
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 500);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function playerMove(idx) {
    if (!isPlaying || aiThinking || board[idx] !== '') return;
    board[idx] = 'X';
    renderBoard();
    var result = checkWinner(board);
    if (result) { endGame(result); return; }
    setStatus('IA pensando...');
    aiThinking = true;
    setTimeout(function() {
        var move = getBestMove();
        if (move !== -1) {
            board[move] = 'O';
            renderBoard();
        }
        aiThinking = false;
        var r = checkWinner(board);
        if (r) { endGame(r); return; }
        setStatus('Tu turno (X)');
    }, 300);
}

function startGame() {
    board = ['','','','','','','','',''];
    isPlaying = true;
    aiThinking = false;
    renderBoard();
    setStatus('Tu turno (X)');
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    updateScores();
}

document.querySelectorAll('.ttt-cell').forEach(function(cell) {
    cell.addEventListener('click', function() {
        playerMove(parseInt(this.dataset.index));
    });
    cell.addEventListener('touchstart', function(e) {
        e.preventDefault();
        playerMove(parseInt(this.dataset.index));
    }, { passive: false });
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

updateScores();

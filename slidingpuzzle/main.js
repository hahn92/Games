// Puzzle 15 (Sliding Puzzle)
var SIZE = 4;
var tiles = []; // 1D array, 0 = empty
var isPlaying = false;
var moves = 0;
var timerInterval = null;
var elapsed = 0;
var bestTime = parseInt(localStorage.getItem('slidingBest') || '0', 10) || null;

function goalState() {
    var g = [];
    for (var i = 1; i < SIZE * SIZE; i++) g.push(i);
    g.push(0);
    return g;
}

function isSolved() {
    var goal = goalState();
    for (var i = 0; i < tiles.length; i++) if (tiles[i] !== goal[i]) return false;
    return true;
}

function shuffle(arr) {
    var a = arr.slice();
    // Do 1000 random moves from solved state to guarantee solvability
    var emptyIdx = a.indexOf(0);
    for (var i = 0; i < 1000; i++) {
        var row = Math.floor(emptyIdx / SIZE);
        var col = emptyIdx % SIZE;
        var neighbors = [];
        if (row > 0) neighbors.push(emptyIdx - SIZE);
        if (row < SIZE - 1) neighbors.push(emptyIdx + SIZE);
        if (col > 0) neighbors.push(emptyIdx - 1);
        if (col < SIZE - 1) neighbors.push(emptyIdx + 1);
        var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        a[emptyIdx] = a[pick];
        a[pick] = 0;
        emptyIdx = pick;
    }
    return a;
}

function renderBoard() {
    var container = document.getElementById('puzzleBoard');
    container.innerHTML = '';
    for (var i = 0; i < tiles.length; i++) {
        var tile = document.createElement('div');
        tile.className = 'puzzle-tile' + (tiles[i] === 0 ? ' empty' : '');
        tile.textContent = tiles[i] === 0 ? '' : tiles[i];
        if (tiles[i] !== 0) {
            tile.dataset.index = i;
            tile.addEventListener('click', onTileClick);
            tile.addEventListener('touchstart', function(e) {
                e.preventDefault();
                onTileClick.call(this, e);
            }, { passive: false });
        }
        container.appendChild(tile);
    }
}

function onTileClick() {
    if (!isPlaying) return;
    var idx = parseInt(this.dataset.index);
    var emptyIdx = tiles.indexOf(0);
    var row = Math.floor(idx / SIZE), col = idx % SIZE;
    var eRow = Math.floor(emptyIdx / SIZE), eCol = emptyIdx % SIZE;
    if ((Math.abs(row - eRow) === 1 && col === eCol) || (Math.abs(col - eCol) === 1 && row === eRow)) {
        tiles[emptyIdx] = tiles[idx];
        tiles[idx] = 0;
        moves++;
        renderBoard();
        updateHUD();
        if (isSolved()) { win(); }
    }
}

// Keyboard support
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    var emptyIdx = tiles.indexOf(0);
    var eRow = Math.floor(emptyIdx / SIZE), eCol = emptyIdx % SIZE;
    var swap = -1;
    if (e.key === 'ArrowUp' && eRow < SIZE - 1) swap = emptyIdx + SIZE;
    if (e.key === 'ArrowDown' && eRow > 0) swap = emptyIdx - SIZE;
    if (e.key === 'ArrowLeft' && eCol < SIZE - 1) swap = emptyIdx + 1;
    if (e.key === 'ArrowRight' && eCol > 0) swap = emptyIdx - 1;
    if (swap >= 0) {
        e.preventDefault();
        tiles[emptyIdx] = tiles[swap];
        tiles[swap] = 0;
        moves++;
        renderBoard();
        updateHUD();
        if (isSolved()) win();
    }
});

function updateHUD() {
    document.getElementById('moves').textContent = moves;
    document.getElementById('timer').textContent = elapsed;
    document.getElementById('highScore').textContent = bestTime ? bestTime + 's / ' + '-- mov' : '--';
    document.getElementById('mobileScore').textContent = moves + ' mov | ' + elapsed + 's';
}

function win() {
    isPlaying = false;
    clearInterval(timerInterval);
    if (!bestTime || elapsed < bestTime) {
        bestTime = elapsed;
        localStorage.setItem('slidingBest', bestTime);
    }
    updateHUD();
    document.getElementById('finalScore').textContent = moves + ' movimientos en ' + elapsed + 's';
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 300);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function startGame() {
    tiles = shuffle(goalState());
    moves = 0; elapsed = 0; isPlaying = true;
    clearInterval(timerInterval);
    timerInterval = setInterval(function() { elapsed++; updateHUD(); }, 1000);
    renderBoard();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
tiles = goalState();
renderBoard();
updateHUD();

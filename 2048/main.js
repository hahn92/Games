const SIZE = 4;
let board, score = 0, highScore = parseInt(localStorage.getItem('2048HighScore') || '0', 10);
let isPlaying = false;

// Track which cells are new or merged this turn for animations
let newCells = [];
let mergedCells = [];

function createBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    newCells = [];
    mergedCells = [];
    addTile();
    addTile();
    render();
}

function addTile() {
    let empty = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === 0) empty.push([r, c]);
        }
    }
    if (empty.length) {
        let [r, c] = empty[Math.floor(Math.random() * empty.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
        newCells.push(r * SIZE + c);
    }
}

function render() {
    const container = document.getElementById('game2048');
    container.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const val = board[r][c];
            const idx = r * SIZE + c;
            const tile = document.createElement('div');
            tile.className = 'tile';

            if (val) {
                // Classify tile value
                if (val > 2048) {
                    tile.classList.add('tile-super');
                } else {
                    tile.classList.add('tile-' + val);
                }
                // Responsive font size for 4-digit numbers
                if (val >= 1000) {
                    tile.style.fontSize = '';  // handled by CSS classes
                }
                tile.dataset.value = val;
                tile.textContent = val;
            } else {
                tile.dataset.value = 0;
            }

            // Animations
            if (newCells.includes(idx)) {
                tile.classList.add('tile-new');
            }
            if (mergedCells.includes(idx)) {
                tile.classList.add('tile-merged');
            }

            container.appendChild(tile);
        }
    }

    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }

    // Highlight high score if new record
    const highScoreEl = document.getElementById('highScore');
    highScoreEl.textContent = highScore;
    const highScoreParent = highScoreEl.parentElement;
    if (score > 0 && score >= highScore) {
        highScoreParent.classList.add('new-record');
    } else {
        highScoreParent.classList.remove('new-record');
    }
}

function showScoreFloat(points) {
    const container = document.getElementById('game2048');
    const el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = '+' + points;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

function move(dir) {
    let moved = false;
    let pointsGained = 0;
    newCells = [];
    mergedCells = [];

    function slide(row, rowIndex, isRow, reversed) {
        let arr = row.filter(v => v);
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                pointsGained += arr[i];
                score += arr[i];
                arr[i + 1] = 0;
                // Calculate merged cell index
                let mergedIdx;
                if (isRow) {
                    const col = reversed ? SIZE - 1 - i : i;
                    mergedIdx = rowIndex * SIZE + col;
                } else {
                    const row2 = reversed ? SIZE - 1 - i : i;
                    mergedIdx = row2 * SIZE + rowIndex;
                }
                mergedCells.push(mergedIdx);
            }
        }
        arr = arr.filter(v => v);
        while (arr.length < SIZE) arr.push(0);
        return arr;
    }

    if (dir === 'left') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide(board[r], r, true, false);
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'right') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide([...board[r]].reverse(), r, true, true).reverse();
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'up') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide(col, c, false, false);
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'down') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide([...col].reverse(), c, false, true).reverse();
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }

    if (moved) {
        addTile();
        render();
        if (pointsGained > 0) {
            showScoreFloat(pointsGained);
            GameAudio.merge();
        } else {
            GameAudio.slide();
        }
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('2048HighScore', highScore);
        }
        // Check for 2048 tile win
        let has2048 = false;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] >= 2048) has2048 = true;
        if (has2048 && !window._2048WinPlayed) { window._2048WinPlayed = true; GameAudio.win(); }
        if (isGameOver()) gameOver();
    }
}

function isGameOver() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === 0) return false;
            if (c < SIZE-1 && board[r][c] === board[r][c+1]) return false;
            if (r < SIZE-1 && board[r][c] === board[r+1][c]) return false;
        }
    }
    return true;
}

function startGame() {
    score = 0;
    window._2048WinPlayed = false;
    createBoard();
    GameAudio.start();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    const popup = document.getElementById('gameOverPopup');
    // Reset animation by removing and re-adding
    popup.style.display = 'none';
    // Force reflow then show
    void popup.offsetWidth;
    popup.style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

document.getElementById('startBtn').addEventListener('click', () => { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', () => {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Controles táctiles
document.getElementById('btnUp').addEventListener('click', () => isPlaying && move('up'));
document.getElementById('btnDown').addEventListener('click', () => isPlaying && move('down'));
document.getElementById('btnLeft').addEventListener('click', () => isPlaying && move('left'));
document.getElementById('btnRight').addEventListener('click', () => isPlaying && move('right'));

// Soporte para Swipe (mínimo 30px)
let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;

const gestureZone = document.getElementById('game2048');

gestureZone.addEventListener('touchstart', function(event) {
    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
}, false);

gestureZone.addEventListener('touchend', function(event) {
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    handleGesture();
}, false);

function handleGesture() {
    if (!isPlaying) return;
    let dx = touchendX - touchstartX;
    let dy = touchendY - touchstartY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
            if (dx > 0) move('right');
            else move('left');
        }
    } else {
        if (Math.abs(dy) > 30) {
            if (dy > 0) move('down');
            else move('up');
        }
    }
}

window.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') move('left');
        if (e.key === 'ArrowRight') move('right');
        if (e.key === 'ArrowUp') move('up');
        if (e.key === 'ArrowDown') move('down');
    }
});

// Initial display
document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
render();

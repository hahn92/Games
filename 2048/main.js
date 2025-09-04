const SIZE = 4;
let board, score = 0, highScore = localStorage.getItem('2048HighScore') || 0;
let isPlaying = false;

function createBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
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
    }
}

function render() {
    const container = document.getElementById('game2048');
    container.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const val = board[r][c];
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.value = val;
            tile.textContent = val ? val : '';
            container.appendChild(tile);
        }
    }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
}

function move(dir) {
    let moved = false;
    function slide(row) {
        let arr = row.filter(v => v);
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                score += arr[i];
                arr[i + 1] = 0;
            }
        }
        arr = arr.filter(v => v);
        while (arr.length < SIZE) arr.push(0);
        return arr;
    }
    if (dir === 'left') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide(board[r]);
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'right') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide([...board[r]].reverse()).reverse();
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'up') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide(col);
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'down') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide([...col].reverse()).reverse();
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }
    if (moved) {
        addTile();
        render();
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('2048HighScore', highScore);
        }
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
    createBoard();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

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

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
render();

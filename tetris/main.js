const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const COLORS = [
    '#8fd3f4', '#ff512f', '#ffe082', '#dd2476', '#5ec2e6', '#f44336', '#26d0ce'
];
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let current, next, score = 0, highScore = localStorage.getItem('tetrisHighScore') || 0;
let gameInterval, speed = 500, isPlaying = false;

const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,1,0],[0,1,1]], // S
    [[0,1,1],[1,1,0]], // Z
    [[1,0,0],[1,1,1]], // J
    [[0,0,1],[1,1,1]]  // L
];

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#222';
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) drawBlock(x, y, COLORS[board[y][x]-1]);
        }
    }
    if (current) {
        for (let y = 0; y < current.shape.length; y++) {
            for (let x = 0; x < current.shape[y].length; x++) {
                if (current.shape[y][x]) {
                    drawBlock(current.x + x, current.y + y, COLORS[current.color]);
                }
            }
        }
    }
}

function randomPiece() {
    const type = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[type],
        x: Math.floor(COLS/2) - Math.ceil(SHAPES[type][0].length/2),
        y: 0,
        color: type
    };
}

function collide(shape, x, y) {
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                let nx = x + j, ny = y + i;
                if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) return true;
            }
        }
    }
    return false;
}

function merge() {
    for (let y = 0; y < current.shape.length; y++) {
        for (let x = 0; x < current.shape[y].length; x++) {
            if (current.shape[y][x]) {
                board[current.y + y][current.x + x] = current.color + 1;
            }
        }
    }
}

function clearLines() {
    let lines = 0;
    for (let y = ROWS-1; y >= 0; y--) {
        if (board[y].every(cell => cell)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            lines++;
            y++;
        }
    }
    if (lines) {
        score += lines * 100;
        document.getElementById('score').textContent = score;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('tetrisHighScore', highScore);
            document.getElementById('highScore').textContent = highScore;
        }
        // Aumenta la velocidad
        speed = Math.max(100, speed - lines * 20);
        clearInterval(gameInterval);
        gameInterval = setInterval(tick, speed);
    }
}

function tick() {
    if (!current) return;
    if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
    } else {
        merge();
        clearLines();
        current = next;
        next = randomPiece();
        if (collide(current.shape, current.x, current.y)) {
            gameOver();
            return;
        }
    }
    drawBoard();
}

function rotate() {
    let newShape = current.shape[0].map((_, i) => current.shape.map(row => row[i])).reverse();
    if (!collide(newShape, current.x, current.y)) current.shape = newShape;
    drawBoard();
}

function move(dx) {
    if (!collide(current.shape, current.x + dx, current.y)) {
        current.x += dx;
        drawBoard();
    }
}

function drop() {
    while (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
    }
    tick();
}

function startGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    speed = 500;
    current = randomPiece();
    next = randomPiece();
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    drawBoard();
    clearInterval(gameInterval);
    gameInterval = setInterval(tick, speed);
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
}

function restartGame() {
    startGame();
}

function gameOver() {
    clearInterval(gameInterval);
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    isPlaying = false;
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
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Space"].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'ArrowDown') tick();
    if (e.key === 'ArrowUp') rotate();
    if (e.key === ' ' || e.key === 'Space') drop();
});

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
drawBoard();

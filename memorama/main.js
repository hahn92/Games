const SIZE = 4;
let board = [], flipped = [], matched = 0, score = 0, highScore = localStorage.getItem('memoramaHighScore') || 0;
let isPlaying = false;

function createBoard() {
    let values = [];
    for (let i = 1; i <= SIZE*SIZE/2; i++) {
        values.push(i, i);
    }
    values = shuffle(values);
    board = [];
    for (let r = 0; r < SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < SIZE; c++) {
            board[r][c] = { value: values.pop(), flipped: false, matched: false };
        }
    }
    flipped = [];
    matched = 0;
    score = 0;
    render();
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function render() {
    const container = document.getElementById('memoramaBoard');
    container.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const card = board[r][c];
            const div = document.createElement('div');
            div.className = 'card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '');
            div.textContent = card.flipped || card.matched ? card.value : '';
            div.addEventListener('click', () => flipCard(r, c));
            container.appendChild(div);
        }
    }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
}

function flipCard(r, c) {
    if (!isPlaying) return;
    const card = board[r][c];
    if (card.flipped || card.matched || flipped.length === 2) return;
    card.flipped = true;
    flipped.push({ r, c });
    render();
    if (flipped.length === 2) {
        score++;
        setTimeout(checkMatch, 700);
    }
}

function checkMatch() {
    const [a, b] = flipped;
    const cardA = board[a.r][a.c];
    const cardB = board[b.r][b.c];
    if (cardA.value === cardB.value) {
        cardA.matched = true;
        cardB.matched = true;
        matched += 2;
        if (matched === SIZE*SIZE) gameOver();
    } else {
        cardA.flipped = false;
        cardB.flipped = false;
    }
    flipped = [];
    render();
}

function startGame() {
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
    if (score > highScore || highScore === 0) {
        highScore = score;
        localStorage.setItem('memoramaHighScore', highScore);
    }
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

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
render();

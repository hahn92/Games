const canvas = document.getElementById('flappyCanvas');
const ctx = canvas.getContext('2d');
const GRAVITY = 0.5;
const FLAP = -7;
const PIPE_GAP = 120;
const PIPE_WIDTH = 50;
const PIPE_INTERVAL = 90;
const BIRD_SIZE = 32;
let birdY, birdV, pipes, score, highScore, isPlaying, frame, gameLoop, gameOverPopup;

function resetGame() {
    birdY = canvas.height / 2;
    birdV = 0;
    pipes = [];
    score = 0;
    frame = 0;
    isPlaying = false;
    highScore = localStorage.getItem('flappyHighScore') || 0;
    draw();
}

function startGame() {
    resetGame();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    gameLoop = setInterval(update, 1000/60);
}

function restartGame() {
    clearInterval(gameLoop);
    startGame();
}

function update() {
    frame++;
    birdV += GRAVITY;
    birdY += birdV;
    if (frame % PIPE_INTERVAL === 0) {
        const top = Math.random() * (canvas.height - PIPE_GAP - 80) + 40;
        pipes.push({ x: canvas.width, top });
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2;
        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
            score++;
        }
    }
    if (checkCollision()) {
        endGame();
        return;
    }
    draw();
}

function checkCollision() {
    if (birdY < 0 || birdY + BIRD_SIZE > canvas.height) return true;
    for (const pipe of pipes) {
        if (
            pipe.x < 60 + BIRD_SIZE && pipe.x + PIPE_WIDTH > 60 &&
            (birdY < pipe.top || birdY + BIRD_SIZE > pipe.top + PIPE_GAP)
        ) {
            return true;
        }
    }
    return false;
}

function endGame() {
    clearInterval(gameLoop);
    isPlaying = false;
    if (score > highScore || highScore === 0) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fondo
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Tubos
    ctx.fillStyle = '#ff512f';
    for (const pipe of pipes) {
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        ctx.fillRect(pipe.x, pipe.top + PIPE_GAP, PIPE_WIDTH, canvas.height - pipe.top - PIPE_GAP);
    }
    // Pájaro
    ctx.save();
    ctx.translate(60, birdY);
    ctx.rotate(birdV * 0.05);
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    // Puntaje
    ctx.fillStyle = '#222';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Puntaje: ' + score, 16, 40);
    ctx.fillText('Mejor: ' + highScore, 16, 70);
}

canvas.addEventListener('mousedown', () => {
    if (!isPlaying) return;
    birdV = FLAP;
});
document.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') birdV = FLAP;
});
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});
resetGame();

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 16;
let playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
let aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
let ballX = WIDTH/2 - BALL_SIZE/2;
let ballY = HEIGHT/2 - BALL_SIZE/2;
let ballSpeedX = 5, ballSpeedY = 3;
let playerScore = 0, highScore = localStorage.getItem('pongHighScore') || 0;
let isPlaying = false, gameInterval;
let speed = 1000/60;

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Fondo
    ctx.fillStyle = '#232526';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Red central
    ctx.strokeStyle = '#8fd3f4';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(WIDTH/2, 0);
    ctx.lineTo(WIDTH/2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    // Paletas
    ctx.fillStyle = '#ff512f';
    ctx.fillRect(0, playerY, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(WIDTH-PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Bola
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
}

function moveAI() {
    let center = aiY + PADDLE_HEIGHT/2;
    if (center < ballY) aiY += 4;
    else if (center > ballY + BALL_SIZE) aiY -= 4;
    aiY = Math.max(0, Math.min(HEIGHT-PADDLE_HEIGHT, aiY));
}

function update() {
    ballX += ballSpeedX;
    ballY += ballSpeedY;
    // Rebote arriba/abajo
    if (ballY <= 0 || ballY + BALL_SIZE >= HEIGHT) ballSpeedY *= -1;
    // Rebote con jugador
    if (ballX <= PADDLE_WIDTH && ballY + BALL_SIZE > playerY && ballY < playerY + PADDLE_HEIGHT) {
        ballSpeedX *= -1;
        ballX = PADDLE_WIDTH;
        ballSpeedY += (Math.random()-0.5)*2;
    }
    // Rebote con AI
    if (ballX + BALL_SIZE >= WIDTH-PADDLE_WIDTH && ballY + BALL_SIZE > aiY && ballY < aiY + PADDLE_HEIGHT) {
        ballSpeedX *= -1;
        ballX = WIDTH-PADDLE_WIDTH-BALL_SIZE;
        ballSpeedY += (Math.random()-0.5)*2;
    }
    // Punto jugador
    if (ballX + BALL_SIZE >= WIDTH) {
        playerScore++;
        resetBall();
        updateScore();
    }
    // Punto AI (fin de juego)
    if (ballX <= 0) {
        gameOver();
    }
    moveAI();
    draw();
}

function resetBall() {
    ballX = WIDTH/2 - BALL_SIZE/2;
    ballY = HEIGHT/2 - BALL_SIZE/2;
    ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = 3 * (Math.random() > 0.5 ? 1 : -1);
}

function updateScore() {
    document.getElementById('score').textContent = playerScore;
    document.getElementById('highScore').textContent = highScore;
    if (playerScore > highScore) {
        highScore = playerScore;
        localStorage.setItem('pongHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function startGame() {
    playerY = HEIGHT/2 - PADDLE_HEIGHT/2;
    aiY = HEIGHT/2 - PADDLE_HEIGHT/2;
    playerScore = 0;
    resetBall();
    updateScore();
    draw();
    clearInterval(gameInterval);
    gameInterval = setInterval(update, speed);
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
    document.getElementById('finalScore').textContent = 'Puntaje: ' + playerScore;
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
    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') playerY -= 32;
        if (e.key === 'ArrowDown') playerY += 32;
        playerY = Math.max(0, Math.min(HEIGHT-PADDLE_HEIGHT, playerY));
        draw();
    }
});

document.getElementById('score').textContent = playerScore;
document.getElementById('highScore').textContent = highScore;
draw();

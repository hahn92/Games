const canvas = document.getElementById('breakoutCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
let paddleX = WIDTH/2 - PADDLE_WIDTH/2;
let ballX = WIDTH/2 - BALL_SIZE/2;
let ballY = HEIGHT - 40;
let ballSpeedX = 4, ballSpeedY = -4;
let bricks = [], rows = 5, cols = 10, brickWidth = 54, brickHeight = 18, brickPadding = 8, brickOffsetTop = 40, brickOffsetLeft = 20;
let score = 0, highScore = localStorage.getItem('breakoutHighScore') || 0;
let isPlaying = false, gameInterval;
let speed = 1000/60;

// Teclas presionadas para movimiento continuo
const keys = {};

function createBricks() {
    bricks = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            bricks.push({
                x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                y: r * (brickHeight + brickPadding) + brickOffsetTop,
                status: 1,
                color: `hsl(${(r*cols+c)*20},80%,60%)`
            });
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Fondo
    ctx.fillStyle = '#232526';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Paleta
    ctx.fillStyle = '#ff512f';
    ctx.fillRect(paddleX, HEIGHT-PADDLE_HEIGHT-10, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Bola
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    // Ladrillos
    bricks.forEach(brick => {
        if (brick.status) {
            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brickWidth, brickHeight);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(brick.x, brick.y, brickWidth, brickHeight);
        }
    });
}

function update() {
    // Movimiento continuo de la paleta
    if (keys['ArrowLeft'] || keys['left']) paddleX -= PADDLE_SPEED;
    if (keys['ArrowRight'] || keys['right']) paddleX += PADDLE_SPEED;
    paddleX = Math.max(0, Math.min(WIDTH-PADDLE_WIDTH, paddleX));

    ballX += ballSpeedX;
    ballY += ballSpeedY;
    // Rebote lateral
    if (ballX <= 0 || ballX + BALL_SIZE >= WIDTH) ballSpeedX *= -1;
    // Rebote arriba
    if (ballY <= 0) ballSpeedY *= -1;
    // Rebote con paleta
    if (ballY + BALL_SIZE >= HEIGHT-PADDLE_HEIGHT-10 && ballX + BALL_SIZE > paddleX && ballX < paddleX + PADDLE_WIDTH) {
        ballSpeedY *= -1;
        ballY = HEIGHT-PADDLE_HEIGHT-10-BALL_SIZE;
        ballSpeedX += (Math.random()-0.5)*2;
    }
    // Rebote con ladrillos
    bricks.forEach(brick => {
        if (brick.status && ballX + BALL_SIZE > brick.x && ballX < brick.x + brickWidth && ballY + BALL_SIZE > brick.y && ballY < brick.y + brickHeight) {
            ballSpeedY *= -1;
            brick.status = 0;
            score += 10;
            updateScore();
        }
    });
    // Fin de juego
    if (ballY + BALL_SIZE > HEIGHT) gameOver();
    // Siguiente nivel
    if (bricks.every(b => !b.status)) {
        rows = Math.min(rows+1, 10);
        createBricks();
        resetBall();
    }
    draw();
}

function resetBall() {
    ballX = WIDTH/2 - BALL_SIZE/2;
    ballY = HEIGHT - 40;
    ballSpeedX = 4 * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = -4;
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    document.getElementById('highScore').textContent = highScore;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('breakoutHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

function startGame() {
    paddleX = WIDTH/2 - PADDLE_WIDTH/2;
    score = 0;
    rows = 5;
    createBricks();
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

// Teclado - movimiento continuo
window.addEventListener('keydown', e => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// Controles táctiles - movimiento continuo (mantener presionado)
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

btnLeft.addEventListener('mousedown', () => { keys['left'] = true; });
btnLeft.addEventListener('mouseup', () => { keys['left'] = false; });
btnLeft.addEventListener('mouseleave', () => { keys['left'] = false; });
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['left'] = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['left'] = false; });
btnLeft.addEventListener('touchcancel', () => { keys['left'] = false; });

btnRight.addEventListener('mousedown', () => { keys['right'] = true; });
btnRight.addEventListener('mouseup', () => { keys['right'] = false; });
btnRight.addEventListener('mouseleave', () => { keys['right'] = false; });
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['right'] = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['right'] = false; });
btnRight.addEventListener('touchcancel', () => { keys['right'] = false; });

document.getElementById('score').textContent = score;
document.getElementById('highScore').textContent = highScore;
draw();

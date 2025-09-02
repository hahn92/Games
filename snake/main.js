function restartGame() {
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPosition();
    score = 0;
    speed = 180;
    draw();
    updateScore();
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const box = 15;
const canvasSize = 600;
let snake = [{ x: 9 * box, y: 10 * box }];
let direction = 'RIGHT';
let fruit = randomPosition();
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameInterval;
let speed = 250; // milisegundos, aún más lento al inicio

// Actualiza el puntaje en pantalla
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
}

function randomPosition() {
    return {
        x: Math.floor(Math.random() * (canvasSize / box)) * box,
        y: Math.floor(Math.random() * (canvasSize / box)) * box
    };
}

function draw() {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Dibuja la serpiente
    for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = i === 0 ? '#8fd3f4' : '#5ec2e6';
        ctx.fillRect(snake[i].x, snake[i].y, box, box);
        ctx.strokeStyle = '#181818';
        ctx.strokeRect(snake[i].x, snake[i].y, box, box);
    }

    // Dibuja la fruta
    ctx.fillStyle = '#f44336';
    ctx.fillRect(fruit.x, fruit.y, box, box);
}

function moveSnake() {
    // Aumenta la velocidad cada 5 puntos, hasta un mínimo de 60ms
    let newSpeed = Math.max(60, 180 - score * 10);
    if (newSpeed !== speed) {
        speed = newSpeed;
        clearInterval(gameInterval);
        gameInterval = setInterval(moveSnake, speed);
    }
    let head = { ...snake[0] };
    if (direction === 'LEFT') head.x -= box;
    if (direction === 'RIGHT') head.x += box;
    if (direction === 'UP') head.y -= box;
    if (direction === 'DOWN') head.y += box;

    // Colisión con paredes
    if (
        head.x < 0 || head.x >= canvasSize ||
        head.y < 0 || head.y >= canvasSize
    ) {
        gameOver();
        return;
    }

    // Colisión con sí mismo
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    // Comer fruta
    if (head.x === fruit.x && head.y === fruit.y) {
        score++;
        fruit = randomPosition();
    } else {
        snake.pop();
    }
    snake.unshift(head);
    draw();
    updateScore();
}

function gameOver() {
    clearInterval(gameInterval);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
    }
    setTimeout(() => {
        alert('¡Juego terminado! Puntaje: ' + score);
    }, 100);

    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPosition();
    score = 0;
    speed = 180;
    draw();
    updateScore();
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}

// Control de teclado
window.addEventListener('keydown', e => {
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e.key)) {
        e.preventDefault(); // Evita el scroll de la página
    }
    if (e.key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
    if (e.key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
    if (e.key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
    if (e.key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
});

document.getElementById('restartBtn').addEventListener('click', restartGame);
// Inicializa el juego
updateScore();
draw();
gameInterval = setInterval(moveSnake, speed);
gameInterval = setInterval(moveSnake, speed);

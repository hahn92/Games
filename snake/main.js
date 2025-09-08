// Mostrar controles táctiles y puntaje flotante solo en móvil
function setupMobileUI() {
    const touchControls = document.getElementById('touchControls');
    const mobileScore = document.getElementById('mobileScore');
    if (isMobile()) {
        touchControls.style.display = 'flex';
        mobileScore.style.display = 'block';
        // Eventos de botones táctiles
        document.getElementById('btnUp').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'DOWN') direction = 'UP';
        });
        document.getElementById('btnDown').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'UP') direction = 'DOWN';
        });
        document.getElementById('btnLeft').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'RIGHT') direction = 'LEFT';
        });
        document.getElementById('btnRight').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'LEFT') direction = 'RIGHT';
        });
    } else {
        touchControls.style.display = 'none';
        mobileScore.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', setupMobileUI);

// Actualizar puntaje flotante en móvil
function updateMobileScore() {
    const mobileScore = document.getElementById('mobileScore');
    if (isMobile() && mobileScore) {
        mobileScore.innerHTML = `Puntaje: <b>${score}</b><br>Mejor: <b>${highScore}</b>`;
    }
}
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
let box = 15;
let canvasSize = 600;

function syncCanvasLogicSize() {
    // Si el canvas fue ajustado por el layout móvil, sincroniza las variables
    canvasSize = canvas.width;
    box = Math.floor(canvasSize / 40);
}
window.addEventListener('resize', syncCanvasLogicSize);
document.addEventListener('DOMContentLoaded', syncCanvasLogicSize);
let snake = [{ x: 9 * box, y: 10 * box }];
let direction = 'RIGHT';
let fruit = randomPosition();
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameInterval;
let speed = 250; // milisegundos, aún más lento al inicio

// Sonidos
const eatSound = new Audio('eat.mp3');
const gameOverSound = new Audio('gameover.mp3');
const moveSound = new Audio('move.mp3');

// Actualiza el puntaje en pantalla
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    updateMobileScore();
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

    // Dibuja la serpiente (circular)
    for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        const cx = seg.x + box / 2;
        const cy = seg.y + box / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, box / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#8fd3f4' : '#5ec2e6';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#181818';
        ctx.stroke();
        // Ojos para la cabeza
        if (i === 0) {
            ctx.save();
            ctx.fillStyle = '#fff';
            let eyeOffsetX = 0, eyeOffsetY = 0, pupilOffsetX = 0, pupilOffsetY = 0;
            if (direction === 'LEFT') { eyeOffsetX = -box/4; pupilOffsetX = -2; }
            if (direction === 'RIGHT') { eyeOffsetX = box/4; pupilOffsetX = 2; }
            if (direction === 'UP') { eyeOffsetY = -box/4; pupilOffsetY = -2; }
            if (direction === 'DOWN') { eyeOffsetY = box/4; pupilOffsetY = 2; }
            // Ojo izquierdo
            ctx.beginPath();
            ctx.arc(cx - box/6 + eyeOffsetX/2, cy - box/6 + eyeOffsetY/2, box/8, 0, Math.PI*2);
            ctx.fill();
            // Ojo derecho
            ctx.beginPath();
            ctx.arc(cx + box/6 + eyeOffsetX/2, cy - box/6 + eyeOffsetY/2, box/8, 0, Math.PI*2);
            ctx.fill();
            // Pupilas
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(cx - box/6 + eyeOffsetX/2 + pupilOffsetX, cy - box/6 + eyeOffsetY/2 + pupilOffsetY, box/18, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + box/6 + eyeOffsetX/2 + pupilOffsetX, cy - box/6 + eyeOffsetY/2 + pupilOffsetY, box/18, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Dibuja la fruta (manzana)
    if (!window.appleImg) {
        window.appleImg = new Image();
        window.appleImg.src = 'manzana.png';
    }
    if (window.appleImg.complete) {
        ctx.drawImage(window.appleImg, fruit.x, fruit.y, box, box);
    } else {
        window.appleImg.onload = () => {
            ctx.drawImage(window.appleImg, fruit.x, fruit.y, box, box);
        };
    }
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
        eatSound.currentTime = 0; eatSound.play();
    } else {
        snake.pop();
    }
    snake.unshift(head);
    draw();
    updateScore();
    updateMobileScore();
}

// Control de teclado
window.addEventListener('keydown', e => {
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e.key)) {
        e.preventDefault(); // Evita el scroll de la página
    }
    if (e.key === 'ArrowLeft' && direction !== 'RIGHT') { direction = 'LEFT'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowUp' && direction !== 'DOWN') { direction = 'UP'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowRight' && direction !== 'LEFT') { direction = 'RIGHT'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowDown' && direction !== 'UP') { direction = 'DOWN'; moveSound.currentTime = 0; moveSound.play(); }
});


const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

let isPlaying = false;

function startGame() {
    if (isPlaying) return;
    isPlaying = true;
    restartBtn.disabled = false;
    startBtn.disabled = true;
    syncCanvasLogicSize();
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPosition();
    score = 0;
    speed = 250;
    updateScore();
    updateMobileScore();
    draw();
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}

function restartGame() {
    if (!isPlaying) return;
    syncCanvasLogicSize();
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPosition();
    score = 0;
    speed = 250;
    updateScore();
    updateMobileScore();
    draw();
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}


function gameOver() {
    clearInterval(gameInterval);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
    }
    gameOverSound.currentTime = 0; gameOverSound.play();
    // Mostrar popup
    const popup = document.getElementById('gameOverPopup');
    const finalScore = document.getElementById('finalScore');
    popup.style.display = 'flex';
    finalScore.textContent = 'Puntaje: ' + score;
    isPlaying = false;
    startBtn.disabled = false;
    restartBtn.disabled = true;
    updateMobileScore();
}

document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

// Inicializa solo la pantalla y puntajes
syncCanvasLogicSize();
updateScore();
draw();

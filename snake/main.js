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

// Partículas al comer
let eatParticles = [];

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

// Spawnea partículas doradas al comer
function spawnEatParticles(x, y) {
    const count = 10;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 2.5;
        eatParticles.push({
            x: x + box / 2,
            y: y + box / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.04 + Math.random() * 0.03,
            size: 2 + Math.random() * 3,
            color: Math.random() > 0.5 ? '#ffd700' : '#ff8c00'
        });
    }
}

// Actualiza y dibuja partículas
function updateParticles() {
    for (let i = eatParticles.length - 1; i >= 0; i--) {
        const p = eatParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // leve gravedad
        p.life -= p.decay;
        if (p.life <= 0) {
            eatParticles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// Dibuja la fruta como manzana con canvas shapes
function drawFruit() {
    const fx = fruit.x + box / 2;
    const fy = fruit.y + box / 2 + 1;
    const r = box / 2 - 1;

    ctx.save();

    // Cuerpo de la manzana (rojo)
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(fx - r * 0.25, fy - r * 0.25, r * 0.05, fx, fy, r);
    bodyGrad.addColorStop(0, '#ff6b6b');
    bodyGrad.addColorStop(0.5, '#e53935');
    bodyGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Destello blanco arriba-izquierda
    ctx.beginPath();
    ctx.ellipse(fx - r * 0.3, fy - r * 0.35, r * 0.22, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();

    // Tallo marrón
    ctx.beginPath();
    ctx.moveTo(fx + 1, fy - r);
    ctx.quadraticCurveTo(fx + r * 0.4, fy - r - r * 0.6, fx + r * 0.3, fy - r - r * 0.9);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hoja verde
    ctx.beginPath();
    ctx.moveTo(fx + r * 0.25, fy - r - r * 0.5);
    ctx.quadraticCurveTo(fx + r * 0.7, fy - r - r * 0.85, fx + r * 0.5, fy - r - r * 0.3);
    ctx.quadraticCurveTo(fx + r * 0.1, fy - r - r * 0.4, fx + r * 0.25, fy - r - r * 0.5);
    ctx.fillStyle = '#4caf50';
    ctx.fill();

    ctx.restore();
}

function draw() {
    // Fondo mejorado: degradado muy oscuro con grid sutil
    const bgGrad = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    bgGrad.addColorStop(0, '#0a0a0a');
    bgGrad.addColorStop(1, '#111111');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Grid sutil
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= canvasSize; gx += box) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvasSize);
        ctx.stroke();
    }
    for (let gy = 0; gy <= canvasSize; gy += box) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(canvasSize, gy);
        ctx.stroke();
    }
    ctx.restore();

    // Dibuja la serpiente
    for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const cx = seg.x + box / 2;
        const cy = seg.y + box / 2;
        const isHead = i === 0;
        const tailLen = snake.length;

        // Trail: últimos 3 segmentos con opacidad reducida
        let alpha = 1.0;
        if (!isHead) {
            const fromTail = tailLen - 1 - i;
            if (fromTail === 0) alpha = 0.4;
            else if (fromTail === 1) alpha = 0.6;
            else if (fromTail === 2) alpha = 0.8;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        // Glow en la cabeza
        if (isHead) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#76ff03';
        }

        const radius = isHead ? box / 2 : box / 2 - 1;

        // Gradiente radial por segmento
        const grad = ctx.createRadialGradient(
            cx - radius * 0.2, cy - radius * 0.2, radius * 0.05,
            cx, cy, radius
        );
        if (isHead) {
            grad.addColorStop(0, '#b2ff59');
            grad.addColorStop(0.45, '#76c442');
            grad.addColorStop(1, '#1b5e20');
        } else {
            grad.addColorStop(0, '#81c784');
            grad.addColorStop(0.45, '#4caf50');
            grad.addColorStop(1, '#1b5e20');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Borde oscuro
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();

        // Escamas: pequeño arco decorativo en cada segmento (excepto cabeza)
        if (!isHead && box > 8) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.55, Math.PI * 0.2, Math.PI * 0.8);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        // Ojos para la cabeza (dibujados sin globalAlpha para que sean siempre opacos)
        if (isHead) {
            ctx.save();
            let eyeOffsetX = 0, eyeOffsetY = 0, pupilOffsetX = 0, pupilOffsetY = 0;
            if (direction === 'LEFT') { eyeOffsetX = -box / 4; pupilOffsetX = -1.5; }
            if (direction === 'RIGHT') { eyeOffsetX = box / 4; pupilOffsetX = 1.5; }
            if (direction === 'UP') { eyeOffsetY = -box / 4; pupilOffsetY = -1.5; }
            if (direction === 'DOWN') { eyeOffsetY = box / 4; pupilOffsetY = 1.5; }

            // Ojo izquierdo
            ctx.beginPath();
            ctx.arc(cx - box / 6 + eyeOffsetX / 2, cy - box / 6 + eyeOffsetY / 2, box / 8, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            // Ojo derecho
            ctx.beginPath();
            ctx.arc(cx + box / 6 + eyeOffsetX / 2, cy - box / 6 + eyeOffsetY / 2, box / 8, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            // Pupilas
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(cx - box / 6 + eyeOffsetX / 2 + pupilOffsetX, cy - box / 6 + eyeOffsetY / 2 + pupilOffsetY, box / 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + box / 6 + eyeOffsetX / 2 + pupilOffsetX, cy - box / 6 + eyeOffsetY / 2 + pupilOffsetY, box / 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Dibuja la fruta mejorada
    drawFruit();

    // Dibuja y actualiza partículas
    updateParticles();
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
        spawnEatParticles(fruit.x, fruit.y);
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
    eatParticles = [];
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
    eatParticles = [];
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

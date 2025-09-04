const canvas = document.getElementById('invadersCanvas');
const ctx = canvas.getContext('2d');
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 20;
const PLAYER_SPEED = 5;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 12;
const BULLET_SPEED = 7;
const INVADER_WIDTH = 28;
const INVADER_HEIGHT = 18;
const INVADER_ROWS = 4;
const INVADER_COLS = 8;
const INVADER_X_GAP = 12;
const INVADER_Y_GAP = 18;
const INVADER_SPEED = 1.2;
const INVADER_BULLET_SPEED = 4;
let playerX, bullets, invaders, invaderDir, invaderBullets, score, highScore, isPlaying, gameLoop, gameOverPopup;

function resetGame() {
    playerX = canvas.width / 2 - PLAYER_WIDTH / 2;
    bullets = [];
    invaders = [];
    invaderBullets = [];
    score = 0;
    isPlaying = false;
    highScore = localStorage.getItem('invadersHighScore') || 0;
    invaderDir = 1;
    // Crear invasores
    for (let r = 0; r < INVADER_ROWS; r++) {
        for (let c = 0; c < INVADER_COLS; c++) {
            invaders.push({
                x: 40 + c * (INVADER_WIDTH + INVADER_X_GAP),
                y: 40 + r * (INVADER_HEIGHT + INVADER_Y_GAP),
                alive: true
            });
        }
    }
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
    // Mover jugador
    if (keys['ArrowLeft']) playerX -= PLAYER_SPEED;
    if (keys['ArrowRight']) playerX += PLAYER_SPEED;
    playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH, playerX));
    // Mover balas
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED;
        if (bullets[i].y < 0) bullets.splice(i, 1);
    }
    // Mover invasores
    let edge = false;
    for (const inv of invaders) {
        if (!inv.alive) continue;
        inv.x += invaderDir * INVADER_SPEED;
        if (inv.x < 0 || inv.x + INVADER_WIDTH > canvas.width) edge = true;
    }
    if (edge) {
        invaderDir *= -1;
        for (const inv of invaders) {
            inv.y += INVADER_Y_GAP;
        }
    }
    // Disparos de invasores
    if (Math.random() < 0.02) {
        const shooters = invaders.filter(inv => inv.alive);
        if (shooters.length) {
            const shooter = shooters[Math.floor(Math.random() * shooters.length)];
            invaderBullets.push({ x: shooter.x + INVADER_WIDTH/2, y: shooter.y + INVADER_HEIGHT });
        }
    }
    for (let i = invaderBullets.length - 1; i >= 0; i--) {
        invaderBullets[i].y += INVADER_BULLET_SPEED;
        if (invaderBullets[i].y > canvas.height) invaderBullets.splice(i, 1);
    }
    // Colisiones balas jugador
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = 0; j < invaders.length; j++) {
            const inv = invaders[j];
            if (!inv.alive) continue;
            if (
                bullets[i].x < inv.x + INVADER_WIDTH &&
                bullets[i].x + BULLET_WIDTH > inv.x &&
                bullets[i].y < inv.y + INVADER_HEIGHT &&
                bullets[i].y + BULLET_HEIGHT > inv.y
            ) {
                inv.alive = false;
                bullets.splice(i, 1);
                score += 10;
                break;
            }
        }
    }
    // Colisiones balas invasores
    for (let i = invaderBullets.length - 1; i >= 0; i--) {
        if (
            invaderBullets[i].x > playerX &&
            invaderBullets[i].x < playerX + PLAYER_WIDTH &&
            invaderBullets[i].y > canvas.height - PLAYER_HEIGHT - 10
        ) {
            endGame();
            return;
        }
    }
    // Colisión invasor con jugador
    for (const inv of invaders) {
        if (!inv.alive) continue;
        if (inv.y + INVADER_HEIGHT > canvas.height - PLAYER_HEIGHT - 10) {
            endGame();
            return;
        }
    }
    // Victoria
    if (invaders.every(inv => !inv.alive)) {
        endGame(true);
        return;
    }
    draw();
}

function endGame(won = false) {
    clearInterval(gameLoop);
    isPlaying = false;
    if (score > highScore || highScore === 0) {
        highScore = score;
        localStorage.setItem('invadersHighScore', highScore);
    }
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = won ? '¡Ganaste! Puntaje: ' + score : '¡Perdiste! Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fondo
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Invasores
    for (const inv of invaders) {
        if (!inv.alive) continue;
        ctx.fillStyle = '#ff512f';
        ctx.fillRect(inv.x, inv.y, INVADER_WIDTH, INVADER_HEIGHT);
    }
    // Balas jugador
    ctx.fillStyle = '#ffe082';
    for (const b of bullets) {
        ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    }
    // Balas invasores
    ctx.fillStyle = '#222';
    for (const b of invaderBullets) {
        ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    }
    // Jugador
    ctx.fillStyle = '#26d0ce';
    ctx.fillRect(playerX, canvas.height - PLAYER_HEIGHT - 10, PLAYER_WIDTH, PLAYER_HEIGHT);
    // Puntaje en panel derecho
    if (document.getElementById('score')) {
        document.getElementById('score').textContent = score;
    }
    if (document.getElementById('highScore')) {
        document.getElementById('highScore').textContent = highScore;
    }
}

const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (!isPlaying) return;
    if (e.code === 'Space') {
        bullets.push({
            x: playerX + PLAYER_WIDTH/2 - BULLET_WIDTH/2,
            y: canvas.height - PLAYER_HEIGHT - 10
        });
    }
});
document.addEventListener('keyup', e => {
    keys[e.code] = false;
});
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});
resetGame();

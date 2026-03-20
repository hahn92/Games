// Endless Runner
const canvas = document.getElementById('runnerCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;   // 600
const HEIGHT = canvas.height; // 200

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = 160;
const PLAYER_SIZE = 36;

let player = { x: 80, y: GROUND_Y, vy: 0, onGround: true };
let obstacles = [];
let SPEED = 4;
let frame = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('runnerHighScore') || '0', 10);
let isPlaying = false;
let animFrameId = null;
let nextObstacle = 90;

// Clouds for parallax effect
let clouds = [
    { x: 100, y: 30, w: 60, h: 20 },
    { x: 300, y: 50, w: 80, h: 25 },
    { x: 500, y: 25, w: 50, h: 18 },
];

function spawnObstacle() {
    var w = 20 + Math.random() * 15;
    var h = 30 + Math.random() * 40;
    obstacles.push({
        x: WIDTH,
        width: w,
        height: h
    });
}

function jump() {
    if (!isPlaying) return;
    if (player.onGround) {
        player.vy = JUMP_FORCE;
        player.onGround = false;
    }
}

function updatePlayer() {
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
    }
}

function updateObstacles() {
    for (var i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= SPEED;
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function updateClouds() {
    for (var i = 0; i < clouds.length; i++) {
        clouds[i].x -= SPEED * 0.3;
        if (clouds[i].x + clouds[i].w < 0) {
            clouds[i].x = WIDTH + 20;
            clouds[i].y = 15 + Math.random() * 50;
        }
    }
}

function checkCollision() {
    var margin = 6;
    var px = player.x + margin;
    var py = player.y + margin;
    var pw = PLAYER_SIZE - margin * 2;
    var ph = PLAYER_SIZE - margin * 2;

    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var ox = o.x;
        var oy = GROUND_Y + PLAYER_SIZE - o.height;
        if (
            px < ox + o.width &&
            px + pw > ox &&
            py < oy + o.height &&
            py + ph > oy
        ) {
            return true;
        }
    }
    return false;
}

function drawBackground() {
    // Sky gradient
    var skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y + PLAYER_SIZE);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#cae8f7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        ctx.beginPath();
        ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ground
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, GROUND_Y + PLAYER_SIZE, WIDTH, HEIGHT - GROUND_Y - PLAYER_SIZE);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(0, GROUND_Y + PLAYER_SIZE, WIDTH, 4);
}

function drawPlayer() {
    ctx.font = PLAYER_SIZE + 'px serif';
    ctx.textBaseline = 'top';
    ctx.fillText('🦖', player.x, player.y);
}

function drawObstacles() {
    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var oy = GROUND_Y + PLAYER_SIZE - o.height;

        // Cactus-like: dark green body
        var grad = ctx.createLinearGradient(o.x, oy, o.x + o.width, oy);
        grad.addColorStop(0, '#2e7d32');
        grad.addColorStop(1, '#1b5e20');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(o.x, oy, o.width, o.height, 4);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(o.x + 2, oy + 2, o.width / 3, o.height - 4);
    }
}

function drawScore() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 16px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText('Puntaje: ' + score, WIDTH - 12, 10);
    ctx.textAlign = 'left';
}

function drawIdle() {
    drawBackground();
    drawPlayer();
    drawScore();
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('runnerHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
}

function gameLoop() {
    if (!isPlaying) return;

    frame++;
    SPEED += 0.001;
    score = Math.floor(frame / 6);

    // Spawn obstacles
    if (frame >= nextObstacle) {
        spawnObstacle();
        nextObstacle = frame + 80 + Math.floor(Math.random() * 40);
    }

    updatePlayer();
    updateObstacles();
    updateClouds();

    if (checkCollision()) {
        gameOver();
        return;
    }

    updateScore();

    // Draw
    drawBackground();
    drawObstacles();
    drawPlayer();
    drawScore();

    animFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    player = { x: 80, y: GROUND_Y, vy: 0, onGround: true };
    obstacles = [];
    SPEED = 4;
    frame = 0;
    score = 0;
    nextObstacle = 90;
    isPlaying = true;

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    cancelAnimationFrame(animFrameId);
    updateScore();
    animFrameId = requestAnimationFrame(gameLoop);
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animFrameId);

    // Draw final frame
    drawBackground();
    drawObstacles();
    drawPlayer();
    drawScore();

    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    if (document.getElementById('mobileStartBtn')) {
        document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

// Controls: Space / click canvas / touch canvas
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
    }
});

canvas.addEventListener('click', function() {
    jump();
});

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    jump();
}, { passive: false });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init display
document.getElementById('score').textContent = '0';
document.getElementById('highScore').textContent = highScore;
drawIdle();

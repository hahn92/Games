const canvas = document.getElementById('flappyCanvas');
const ctx = canvas.getContext('2d');
const GRAVITY = 0.5;
const FLAP = -7;
const PIPE_GAP = 120;
const PIPE_WIDTH = 50;
const PIPE_INTERVAL = 90;
const BIRD_SIZE = 32;
let birdY, birdV, pipes, score, highScore, isPlaying, frame, gameLoop, gameOverPopup;

// --- Visual extras ---
let particles = [];
let scorePopScale = 1;
let scorePopFrame = 0;

// Cloud layers
let cloudsA = []; // fast layer
let cloudsB = []; // slow layer

// Ground offset
let groundOffset = 0;

function initClouds() {
    cloudsA = [];
    cloudsB = [];
    for (let i = 0; i < 4; i++) {
        cloudsA.push({ x: Math.random() * canvas.width, y: 30 + Math.random() * 80, r: 22 + Math.random() * 18 });
    }
    for (let i = 0; i < 3; i++) {
        cloudsB.push({ x: Math.random() * canvas.width, y: 60 + Math.random() * 60, r: 28 + Math.random() * 20 });
    }
}

function spawnDeathParticles(x, y) {
    particles = [];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
        const speed = 2.5 + Math.random() * 2.5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 1,
            color: Math.random() < 0.5 ? '#ffe082' : '#ff9800'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 3, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function resetGame() {
    birdY = canvas.height / 2;
    birdV = 0;
    pipes = [];
    score = 0;
    frame = 0;
    particles = [];
    scorePopScale = 1;
    scorePopFrame = 0;
    groundOffset = 0;
    isPlaying = false;
    highScore = localStorage.getItem('flappyHighScore') || 0;
    initClouds();
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

    // Update ground offset
    groundOffset = (groundOffset + 2) % 20;

    // Update clouds
    for (const c of cloudsA) {
        c.x -= 2 * 0.3;
        if (c.x + c.r * 2.5 < 0) c.x = canvas.width + c.r;
    }
    for (const c of cloudsB) {
        c.x -= 2 * 0.1;
        if (c.x + c.r * 2.5 < 0) c.x = canvas.width + c.r;
    }

    if (frame % PIPE_INTERVAL === 0) {
        const top = Math.random() * (canvas.height - PIPE_GAP - 80) + 40;
        pipes.push({ x: canvas.width, top });
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2;
        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
            score++;
            scorePopScale = 1.3;
            scorePopFrame = 10;
        }
    }

    if (scorePopFrame > 0) {
        scorePopFrame--;
        scorePopScale = 1 + 0.3 * (scorePopFrame / 10);
    }

    updateParticles();

    if (checkCollision()) {
        spawnDeathParticles(60, birdY + BIRD_SIZE / 2);
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

// --- Drawing helpers ---

function drawCloud(x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r * 0.7, y + r * 0.2, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBackground() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#5eb8f5');
    skyGrad.addColorStop(1, '#c8eafc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Slow clouds
    for (const c of cloudsB) {
        drawCloud(c.x, c.y, c.r, 0.45);
    }
    // Fast clouds
    for (const c of cloudsA) {
        drawCloud(c.x, c.y, c.r, 0.7);
    }
}

function drawGround() {
    const groundY = canvas.height - 20;
    const groundH = 20;
    // Main ground
    ctx.fillStyle = '#c8a36a';
    ctx.fillRect(0, groundY, canvas.width, groundH);
    // Grass strip
    ctx.fillStyle = '#6dbf5e';
    ctx.fillRect(0, groundY, canvas.width, 6);
    // Animated vertical lines
    ctx.strokeStyle = '#a07840';
    ctx.lineWidth = 1;
    for (let x = -groundOffset; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, groundY + 6);
        ctx.lineTo(x, groundY + groundH);
        ctx.stroke();
    }
}

function drawPipe(pipe) {
    const capH = 14;
    const capW = PIPE_WIDTH + 8;
    const capX = pipe.x - 4;

    // Pipe gradient: dark green -> mid green -> light green -> mid green
    const makeGrad = (x, w) => {
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#1b5e20');
        g.addColorStop(0.3, '#388e3c');
        g.addColorStop(0.6, '#66bb6a');
        g.addColorStop(1, '#2e7d32');
        return g;
    };

    // Top pipe (body)
    ctx.fillStyle = makeGrad(pipe.x, PIPE_WIDTH);
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

    // Top pipe cap
    const capGradTop = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    capGradTop.addColorStop(0, '#145214');
    capGradTop.addColorStop(0.4, '#2e7d32');
    capGradTop.addColorStop(1, '#1b5e20');
    ctx.fillStyle = capGradTop;
    ctx.fillRect(capX, pipe.top - capH, capW, capH);

    // Bottom pipe (body)
    const bottomY = pipe.top + PIPE_GAP;
    const bottomH = canvas.height - bottomY;
    ctx.fillStyle = makeGrad(pipe.x, PIPE_WIDTH);
    ctx.fillRect(pipe.x, bottomY + capH, PIPE_WIDTH, bottomH - capH);

    // Bottom pipe cap
    const capGradBot = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    capGradBot.addColorStop(0, '#145214');
    capGradBot.addColorStop(0.4, '#2e7d32');
    capGradBot.addColorStop(1, '#1b5e20');
    ctx.fillStyle = capGradBot;
    ctx.fillRect(capX, bottomY, capW, capH);

    // Highlight stripe on pipes
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(pipe.x + 6, 0, 8, pipe.top);
    ctx.fillRect(pipe.x + 6, bottomY + capH, 8, bottomH);
}

function drawBird() {
    const bx = 60;
    const by = birdY + BIRD_SIZE / 2;
    const angle = Math.max(-0.5, Math.min(1.2, birdV * 0.08));
    const wingOffset = Math.sin(frame * 0.25) * 4; // wing flap animation

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(2, 4, BIRD_SIZE / 2 + 2, BIRD_SIZE / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Wing (behind body)
    ctx.save();
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.ellipse(-4, wingOffset - 2, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, BIRD_SIZE / 2);
    bodyGrad.addColorStop(0, '#ffe57a');
    bodyGrad.addColorStop(0.5, '#ffb300');
    bodyGrad.addColorStop(1, '#e65100');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2 - 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye white
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -6, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(8.5, -6.5, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10, -8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Beak (triangle)
    ctx.fillStyle = '#ff6f00';
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.lineTo(20, 0);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fill();
    // Beak detail line
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11, 1);
    ctx.lineTo(19, 1);
    ctx.stroke();

    ctx.restore();
}

function drawScore() {
    const scoreText = String(score);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(36 * scorePopScale)}px Arial`;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(scoreText, canvas.width / 2 + 2, 54);
    // White text
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreText, canvas.width / 2, 52);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    // Pipes
    for (const pipe of pipes) {
        drawPipe(pipe);
    }

    drawGround();
    drawBird();
    drawParticles();
    drawScore();

    // DOM score update
    if (document.getElementById('score')) {
        document.getElementById('score').textContent = score;
    }
    if (document.getElementById('mobileScore')) {
        document.getElementById('mobileScore').textContent = 'Puntaje: ' + score;
    }
    if (document.getElementById('highScore')) {
        document.getElementById('highScore').textContent = highScore;
    }
}

canvas.addEventListener('mousedown', () => {
    if (!isPlaying) return;
    birdV = FLAP;
});
canvas.addEventListener('touchstart', (e) => {
    if (!isPlaying) return;
    e.preventDefault();
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

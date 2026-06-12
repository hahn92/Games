const canvas = document.getElementById('flappyCanvas');
const ctx = canvas.getContext('2d');
const GRAVITY = 0.5;
const FLAP = -7;
const PIPE_WIDTH = 50;
const PIPE_INTERVAL = 90;
const BIRD_SIZE = 32;

// Gap varies with difficulty
const GAP_EASY   = 135;
const GAP_NORMAL = 115;
const GAP_HARD   = 95;
const GAP_MIN    = 85;

let birdY, birdV, pipes, score, highScore, isPlaying, frame, gameLoop, gameOverPopup;
let pipeGap = GAP_EASY;


// --- Visual extras ---
let particles = [];
let scorePopScale = 1;
let scorePopFrame = 0;

// Screen shake & flash
let shakeFrames = 0;
let flashAlpha  = 0;

// Wing flap animation
let wingFlapTimer = 0;  // counts down from 15 on each flap

// Day/night
let dayPhase = 0;           // 0 = full day, 1 = full night
let dayTarget = 0;
let stars = [];

// Cloud layers
let cloudsA = [];
let cloudsB = [];

// Ground offset
let groundOffset = 0;

// New record flag
let isNewRecord = false;
let newRecordPulse = 0;

function initStars() {
    stars = [];
    for (let i = 0; i < 40; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.6),
            r: Math.random() < 0.3 ? 1.5 : 1,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

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

function getDifficulty() {
    if (score < 10) return { label: 'Facil',   gap: GAP_EASY };
    if (score < 20) return { label: 'Normal',  gap: GAP_NORMAL };
    if (score < 35) return { label: 'Dificil', gap: GAP_HARD };
    return              { label: 'EXTREMO',  gap: GAP_MIN };
}

function getMedal(s) {
    if (s >= 50) return { label: 'PLATINO', color: '#e0e7ff', border: '#a5b4fc' };
    if (s >= 35) return { label: 'ORO',     color: '#fde68a', border: '#fbbf24' };
    if (s >= 20) return { label: 'PLATA',   color: '#e5e7eb', border: '#9ca3af' };
    if (s >= 10) return { label: 'BRONCE',  color: '#fed7aa', border: '#f97316' };
    return null;
}

function spawnDeathParticles(x, y) {
    particles = [];
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
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
    shakeFrames = 0;
    flashAlpha  = 0;
    wingFlapTimer = 0;
    deathAnimDone = false;
    isPlaying = false;
    dayPhase  = 0;
    dayTarget = 0;
    isNewRecord = false;
    newRecordPulse = 0;
    highScore = parseInt(localStorage.getItem('flappyHighScore') || '0', 10);
    pipeGap = GAP_EASY;
    initClouds();
    initStars();
    draw();
}

function startGame() {
    resetGame();
    GameAudio.start();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    gameLoop = rafInterval(update, 15);
}

function restartGame() {
    rafClear(gameLoop);
    startGame();
}

function update() {
    frame++;
    birdV += GRAVITY;
    birdY += birdV;

    // Day/night transition every 10 points
    const targetPhase = (Math.floor(score / 10) % 2 === 1) ? 1 : 0;
    dayTarget = targetPhase;
    dayPhase += (dayTarget - dayPhase) * 0.015;

    // Update pipe gap based on difficulty
    const diff = getDifficulty();
    pipeGap = diff.gap;

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

    // Star twinkle
    for (const s of stars) s.twinkle += 0.05;

    if (frame % PIPE_INTERVAL === 0) {
        const top = Math.random() * (canvas.height - pipeGap - 80) + 40;
        pipes.push({ x: canvas.width, top });
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2;
        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
            score++;
            scorePopScale = 1.3;
            scorePopFrame = 10;
            GameAudio.score();
        }
    }

    if (scorePopFrame > 0) {
        scorePopFrame--;
        scorePopScale = 1 + 0.3 * (scorePopFrame / 10);
    }

    if (shakeFrames > 0) shakeFrames--;
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.07);
    if (wingFlapTimer > 0) wingFlapTimer--;

    updateParticles();

    if (checkCollision()) {
        spawnDeathParticles(60, birdY + BIRD_SIZE / 2);
        shakeFrames = 14;
        flashAlpha  = 0.9;
        rafClear(gameLoop);
        gameLoop = rafInterval(updateDeathAnim, 15);
        return;
    }
    draw();
}

let deathAnimDone = false;
function updateDeathAnim() {
    if (shakeFrames > 0) shakeFrames--;
    flashAlpha = Math.max(0, flashAlpha - 0.06);
    updateParticles();
    draw();
    if (!deathAnimDone && shakeFrames <= 0 && flashAlpha <= 0 && particles.length === 0) {
        deathAnimDone = true;
        rafClear(gameLoop);
        endGame();
    }
}

function checkCollision() {
    if (birdY < 0 || birdY + BIRD_SIZE > canvas.height) return true;
    for (const pipe of pipes) {
        if (
            pipe.x < 60 + BIRD_SIZE && pipe.x + PIPE_WIDTH > 60 &&
            (birdY < pipe.top || birdY + BIRD_SIZE > pipe.top + pipeGap)
        ) {
            return true;
        }
    }
    return false;
}

function endGame() {
    rafClear(gameLoop);
    GameAudio.gameOver();
    isPlaying = false;
    const prevHigh = parseInt(localStorage.getItem('flappyHighScore') || '0', 10);
    isNewRecord = score > prevHigh;
    if (isNewRecord || highScore === 0) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }

    // Medal
    const medal = getMedal(score);
    const savedMedalScore = parseInt(localStorage.getItem('flappyMedalScore') || '0', 10);
    if (score > savedMedalScore) localStorage.setItem('flappyMedalScore', score);

    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    // Draw medal and new record on popup canvas overlay via final draw
    draw();
    drawPopupExtras(medal);
}

function drawPopupExtras(medal) {
    // Draw medal centered on canvas as canvas overlay (top center area)
    const cx = canvas.width / 2;
    const cy = 120;

    if (medal) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fillStyle = medal.color;
        ctx.fill();
        ctx.strokeStyle = medal.border;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(medal.label, cx, cy);
        // Ribbon
        ctx.fillStyle = medal.border;
        ctx.fillRect(cx - 5, cy + 28, 10, 18);
        ctx.fillRect(cx - 9, cy + 42, 18, 6);
        ctx.restore();
    }

    if (isNewRecord) {
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('¡NUEVO RECORD!', cx, cy + 70);
        ctx.restore();
    }
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

function lerpColor(c1, c2, t) {
    // c1, c2: [r,g,b]
    return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
}

function drawBackground() {
    // Day colors: top #5eb8f5, bottom #c8eafc
    // Night colors: top #0f172a, bottom #1e3a5f
    const dayTop   = [94,  184, 245];
    const dayBot   = [200, 234, 252];
    const nightTop = [15,  23,  42];
    const nightBot = [30,  58,  95];

    const topC = lerpColor(dayTop,   nightTop, dayPhase);
    const botC = lerpColor(dayBot,   nightBot, dayPhase);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, `rgb(${topC[0]},${topC[1]},${topC[2]})`);
    skyGrad.addColorStop(1, `rgb(${botC[0]},${botC[1]},${botC[2]})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars (visible at night)
    if (dayPhase > 0.1) {
        for (const s of stars) {
            const twinkleAlpha = (0.5 + 0.5 * Math.sin(s.twinkle)) * dayPhase;
            ctx.save();
            ctx.globalAlpha = twinkleAlpha;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Slow clouds — less visible at night
    const cloudAlpha = Math.max(0.05, 1 - dayPhase * 0.85);
    for (const c of cloudsB) {
        drawCloud(c.x, c.y, c.r, 0.45 * cloudAlpha);
    }
    for (const c of cloudsA) {
        drawCloud(c.x, c.y, c.r, 0.7 * cloudAlpha);
    }
}

function drawGround() {
    const groundY = canvas.height - 20;
    const groundH = 20;
    ctx.fillStyle = '#c8a36a';
    ctx.fillRect(0, groundY, canvas.width, groundH);
    ctx.fillStyle = '#6dbf5e';
    ctx.fillRect(0, groundY, canvas.width, 6);
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

    const makeGrad = (x, w) => {
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#1b5e20');
        g.addColorStop(0.3, '#388e3c');
        g.addColorStop(0.6, '#66bb6a');
        g.addColorStop(1, '#2e7d32');
        return g;
    };

    ctx.fillStyle = makeGrad(pipe.x, PIPE_WIDTH);
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

    const capGradTop = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    capGradTop.addColorStop(0, '#145214');
    capGradTop.addColorStop(0.4, '#2e7d32');
    capGradTop.addColorStop(1, '#1b5e20');
    ctx.fillStyle = capGradTop;
    ctx.fillRect(capX, pipe.top - capH, capW, capH);

    const bottomY = pipe.top + pipeGap;
    const bottomH = canvas.height - bottomY;
    ctx.fillStyle = makeGrad(pipe.x, PIPE_WIDTH);
    ctx.fillRect(pipe.x, bottomY + capH, PIPE_WIDTH, bottomH - capH);

    const capGradBot = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    capGradBot.addColorStop(0, '#145214');
    capGradBot.addColorStop(0.4, '#2e7d32');
    capGradBot.addColorStop(1, '#1b5e20');
    ctx.fillStyle = capGradBot;
    ctx.fillRect(capX, bottomY, capW, capH);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(pipe.x + 6, 0, 8, pipe.top);
    ctx.fillRect(pipe.x + 6, bottomY + capH, 8, bottomH);
}

function drawBird() {
    const bx = 60;
    const by = birdY + BIRD_SIZE / 2;
    const angle = Math.max(-0.5, Math.min(1.2, birdV * 0.08));
    const wingOffset = Math.sin(frame * 0.25) * 4;

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

    // Wing with flap animation
    // flapT: 1 = just flapped, 0 = idle; smoothstep easing for organic feel
    const flapT = wingFlapTimer / 15;
    const eased = flapT * flapT * (3 - 2 * flapT);
    const idleBob = Math.sin(frame * 0.22) * 3;
    // angle: 0.45 rad = drooped down, -0.95 rad = swept up on flap
    const wingAngle = 0.45 - eased * 1.4;
    const wingLen = 12 + eased * 5;
    const wingH   = 6  + eased * 3;
    ctx.save();
    ctx.translate(-3, eased > 0.01 ? 0 : idleBob * 0.4);
    ctx.rotate(wingAngle);
    // Main wing
    ctx.fillStyle = '#bf360c';
    ctx.beginPath();
    ctx.ellipse(-wingLen * 0.3, 0, wingLen, wingH, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wing highlight
    ctx.fillStyle = 'rgba(255,140,60,0.55)';
    ctx.beginPath();
    ctx.ellipse(-wingLen * 0.4, -wingH * 0.35, wingLen * 0.55, wingH * 0.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    const bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, BIRD_SIZE / 2);
    bodyGrad.addColorStop(0, '#ffe57a');
    bodyGrad.addColorStop(0.5, '#ffb300');
    bodyGrad.addColorStop(1, '#e65100');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2 - 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flash white on impact
    if (flashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2 - 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(8.5, -6.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10, -8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff6f00';
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.lineTo(20, 0);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fill();
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
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(scoreText, canvas.width / 2 + 2, 54);
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreText, canvas.width / 2, 52);
    ctx.restore();

    // Difficulty label
    const diff = getDifficulty();
    ctx.save();
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(diff.label, 8, 20);
    ctx.restore();

    // High score
    ctx.save();
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Record: ' + highScore, canvas.width - 8, 20);
    ctx.restore();
}

function draw() {
    ctx.save();
    // Screen shake
    if (shakeFrames > 0) {
        // Deterministic jitter from the frame counter (no Math.random in render)
        const sx = Math.sin(shakeFrames * 12.9898) * 3;
        const sy = Math.cos(shakeFrames * 78.233) * 2;
        ctx.translate(sx, sy);
    }

    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

    drawBackground();

    for (const pipe of pipes) {
        drawPipe(pipe);
    }

    drawGround();
    drawBird();
    drawParticles();
    drawScore();

    // White flash overlay
    if (flashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.4;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Touch feedback visual
    if (touchFeedback) {
        touchFeedback.alpha -= 0.06;
        touchFeedback.r += 2;
        if (touchFeedback.alpha <= 0) {
            touchFeedback = null;
        } else {
            ctx.globalAlpha = touchFeedback.alpha;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(touchFeedback.x, touchFeedback.y, touchFeedback.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    ctx.restore();

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

function flap() {
    birdV = FLAP;
    wingFlapTimer = 15;
    GameAudio.jump();
}

canvas.addEventListener('mousedown', () => {
    if (!isPlaying) return;
    flap();
});
// Touch feedback visual
var touchFeedback = null;
canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    touchFeedback = {
        x: (e.touches[0].clientX - rect.left) * (canvas.width / rect.width),
        y: (e.touches[0].clientY - rect.top) * (canvas.height / rect.height),
        alpha: 0.6,
        r: 20
    };
    if (!isPlaying) {
        var popup = document.getElementById('gameOverPopup');
        if (popup && popup.style.display === 'flex') {
            popup.style.display = 'none';
            startGame();
        } else {
            startGame();
        }
        flap();
    } else {
        flap();
    }
    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
}, { passive: false });
document.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') flap();
});
document.getElementById('startBtn').addEventListener('click', () => { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', () => {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});
resetGame();

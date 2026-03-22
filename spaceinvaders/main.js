const canvas = document.getElementById('invadersCanvas');
const ctx = canvas.getContext('2d');
const PLAYER_WIDTH = 48;
const PLAYER_HEIGHT = 24;
const PLAYER_SPEED = 5;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 12;
const BULLET_SPEED = 7;
const INVADER_WIDTH = 28;
const INVADER_HEIGHT = 18;
const INVADER_ROWS = 5;
const INVADER_COLS = 8;
const INVADER_X_GAP = 12;
const INVADER_Y_GAP = 18;
const INVADER_SPEED = 1.2;
const INVADER_BULLET_SPEED = 4;

const BUNKER_COUNT = 4;
const BUNKER_W = 40;
const BUNKER_H = 28;
const BUNKER_HP = 3;
let bunkers = [];

let playerX, bullets, invaders, invaderDir, invaderBullets, score, highScore, isPlaying;
let explosions = [];
let frame = 0;
let animFrameId = null;
let lastFrameTime = 0;

// Cached player gradient (rebuilt only when playerX changes)
let playerGrad = null;
let playerGradX = -1;

// Star layers
let starsA = [];
let starsB = [];

function initStars() {
    starsA = [];
    starsB = [];
    for (let i = 0; i < 60; i++) {
        starsA.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 0.8 + Math.random() * 1.2,
            brightness: 0.5 + Math.random() * 0.5
        });
    }
    for (let i = 0; i < 30; i++) {
        starsB.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 1.2 + Math.random() * 1.5,
            brightness: 0.7 + Math.random() * 0.3
        });
    }
}

function initBunkers() {
    bunkers = [];
    const spacing = canvas.width / (BUNKER_COUNT + 1);
    const bunkerY = canvas.height - PLAYER_HEIGHT - 60;
    for (let i = 0; i < BUNKER_COUNT; i++) {
        bunkers.push({
            x: spacing * (i + 1) - BUNKER_W / 2,
            y: bunkerY,
            hp: BUNKER_HP,
            cells: new Array(12).fill(true)
        });
    }
}

function resetGame() {
    playerX = canvas.width / 2 - PLAYER_WIDTH / 2;
    bullets = [];
    invaders = [];
    invaderBullets = [];
    explosions = [];
    score = 0;
    frame = 0;
    isPlaying = false;
    highScore = parseInt(localStorage.getItem('invadersHighScore') || '0');
    invaderDir = 1;
    playerGrad = null;
    playerGradX = -1;

    for (let r = 0; r < INVADER_ROWS; r++) {
        for (let c = 0; c < INVADER_COLS; c++) {
            // Pre-compute tentacle jitter offsets for Type C aliens (row 4)
            const tentacleOffsets = r === 4
                ? [4, -4, 4, -4, 4, -4]
                : null;
            invaders.push({
                x: 40 + c * (INVADER_WIDTH + INVADER_X_GAP),
                y: 40 + r * (INVADER_HEIGHT + INVADER_Y_GAP),
                alive: true,
                row: r,
                color: getInvaderColor(r),
                tentacleOffsets
            });
        }
    }
    initStars();
    initBunkers();
    draw();
}

function startGame() {
    resetGame();
    GameAudio.start();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    cancelAnimationFrame(animFrameId);
    lastFrameTime = 0;
    animFrameId = requestAnimationFrame(gameLoop);
}

function restartGame() {
    cancelAnimationFrame(animFrameId);
    startGame();
}

// RAF-based loop with 60fps throttle
function gameLoop(timestamp) {
    if (!isPlaying) return;
    animFrameId = requestAnimationFrame(gameLoop);
    const dt = timestamp - lastFrameTime;
    if (dt < 15) return; // skip if less than ~1 frame elapsed
    lastFrameTime = timestamp;
    update();
    draw();
}

function spawnExplosion(x, y, color) {
    const particles = [];
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color
        });
    }
    explosions.push({ x, y, particles, flashLife: 1 });
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.flashLife -= 0.1;
        const pts = ex.particles;
        for (let j = pts.length - 1; j >= 0; j--) {
            const p = pts[j];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= 0.05;
            if (p.life <= 0) pts.splice(j, 1);
        }
        if (pts.length === 0) explosions.splice(i, 1);
    }
}

function update() {
    frame++;

    // Move stars (batched, no per-element save/restore)
    for (let i = 0; i < starsA.length; i++) {
        starsA[i].y += 0.5;
        if (starsA[i].y > canvas.height) { starsA[i].y = 0; starsA[i].x = Math.random() * canvas.width; }
    }
    for (let i = 0; i < starsB.length; i++) {
        starsB[i].y += 0.2;
        if (starsB[i].y > canvas.height) { starsB[i].y = 0; starsB[i].x = Math.random() * canvas.width; }
    }

    // Move player
    if (!touchActive) {
        if (keys['ArrowLeft']) playerX -= PLAYER_SPEED;
        if (keys['ArrowRight']) playerX += PLAYER_SPEED;
    }
    playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH, playerX));

    // Move player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED;
        if (bullets[i].y < 0) bullets.splice(i, 1);
    }

    // Move invaders
    let edge = false;
    for (let i = 0; i < invaders.length; i++) {
        const inv = invaders[i];
        if (!inv.alive) continue;
        inv.x += invaderDir * INVADER_SPEED;
        if (inv.x < 0 || inv.x + INVADER_WIDTH > canvas.width) edge = true;
    }
    if (edge) {
        invaderDir *= -1;
        for (let i = 0; i < invaders.length; i++) {
            invaders[i].y += INVADER_Y_GAP;
        }
    }

    // Invader shooting — avoid filter() by picking random index and scanning
    if (Math.random() < 0.02) {
        const alive = invaders.filter(inv => inv.alive);
        if (alive.length) {
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            invaderBullets.push({ x: shooter.x + INVADER_WIDTH / 2, y: shooter.y + INVADER_HEIGHT });
        }
    }
    for (let i = invaderBullets.length - 1; i >= 0; i--) {
        invaderBullets[i].y += INVADER_BULLET_SPEED;
        if (invaderBullets[i].y > canvas.height) invaderBullets.splice(i, 1);
    }

    // Player bullets vs invaders
    outer: for (let i = bullets.length - 1; i >= 0; i--) {
        const bx = bullets[i].x, by = bullets[i].y;
        for (let j = 0; j < invaders.length; j++) {
            const inv = invaders[j];
            if (!inv.alive) continue;
            if (bx < inv.x + INVADER_WIDTH && bx + BULLET_WIDTH > inv.x &&
                by < inv.y + INVADER_HEIGHT && by + BULLET_HEIGHT > inv.y) {
                inv.alive = false;
                spawnExplosion(inv.x + INVADER_WIDTH / 2, inv.y + INVADER_HEIGHT / 2, inv.color);
                bullets.splice(i, 1);
                score += 10;
                updateScore();
                GameAudio.explode();
                GameAudio.score();
                continue outer;
            }
        }
    }

    // Player bullets vs bunkers
    outer2: for (let i = bullets.length - 1; i >= 0; i--) {
        const bx = bullets[i].x, by = bullets[i].y;
        for (let k = 0; k < bunkers.length; k++) {
            const bunker = bunkers[k];
            if (bunker.hp <= 0) continue;
            if (bx < bunker.x + BUNKER_W && bx + BULLET_WIDTH > bunker.x &&
                by < bunker.y + BUNKER_H && by + BULLET_HEIGHT > bunker.y) {
                damageBunker(bunker);
                bullets.splice(i, 1);
                continue outer2;
            }
        }
    }

    // Invader bullets vs bunkers
    outer3: for (let i = invaderBullets.length - 1; i >= 0; i--) {
        const bx = invaderBullets[i].x, by = invaderBullets[i].y;
        for (let k = 0; k < bunkers.length; k++) {
            const bunker = bunkers[k];
            if (bunker.hp <= 0) continue;
            if (bx < bunker.x + BUNKER_W && bx + BULLET_WIDTH > bunker.x &&
                by < bunker.y + BUNKER_H && by + BULLET_HEIGHT > bunker.y) {
                damageBunker(bunker);
                invaderBullets.splice(i, 1);
                continue outer3;
            }
        }
    }

    // Invader bullets vs player
    for (let i = invaderBullets.length - 1; i >= 0; i--) {
        if (invaderBullets[i].x > playerX &&
            invaderBullets[i].x < playerX + PLAYER_WIDTH &&
            invaderBullets[i].y > canvas.height - PLAYER_HEIGHT - 10) {
            endGame();
            return;
        }
    }

    // Invader reaches player line
    for (let i = 0; i < invaders.length; i++) {
        const inv = invaders[i];
        if (!inv.alive) continue;
        if (inv.y + INVADER_HEIGHT > canvas.height - PLAYER_HEIGHT - 10) {
            endGame();
            return;
        }
    }

    // Victory
    if (invaders.every(inv => !inv.alive)) {
        endGame(true);
        return;
    }

    updateExplosions();
}

function damageBunker(bunker) {
    bunker.hp--;
    const alive = [];
    for (let i = 0; i < bunker.cells.length; i++) {
        if (bunker.cells[i]) alive.push(i);
    }
    if (alive.length) bunker.cells[alive[Math.floor(Math.random() * alive.length)]] = false;
}

function endGame(won = false) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
    isPlaying = false;
    GameAudio.gameOver();
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invadersHighScore', highScore);
    }
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('finalScore').textContent = won ? '¡Ganaste! Puntaje: ' + score : '¡Perdiste! Puntaje: ' + score;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
    draw();
}

function updateScore() {
    const el = document.getElementById('score');
    if (el) el.textContent = score;
    const ms = document.getElementById('mobileScore');
    if (ms) ms.textContent = 'Puntaje: ' + score;
    const hs = document.getElementById('highScore');
    if (hs) hs.textContent = highScore;
}

function getInvaderColor(row) {
    if (row <= 1) return '#00e5ff';
    if (row <= 3) return '#e040fb';
    return '#ff6d00';
}

// --- Alien draw functions (no shadowBlur — too expensive per-alien) ---

function drawAlienA(x, y, w, h, poseB) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);

    ctx.fillStyle = '#00e5ff';
    ctx.strokeStyle = '#00e5ff';

    // Body
    ctx.beginPath();
    ctx.roundRect(-w * 0.4, -h * 0.3, w * 0.8, h * 0.6, 3);
    ctx.fill();

    // Antennas
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -h * 0.3);
    ctx.lineTo(-w * 0.4, -h * 0.6);
    ctx.moveTo(w * 0.25, -h * 0.3);
    ctx.lineTo(w * 0.4, -h * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w * 0.4, -h * 0.6, 2, 0, Math.PI * 2);
    ctx.arc(w * 0.4, -h * 0.6, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#001a1a';
    ctx.beginPath();
    ctx.arc(-w * 0.18, -h * 0.05, 3.5, 0, Math.PI * 2);
    ctx.arc(w * 0.18, -h * 0.05, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    const legSpread = poseB ? 0.5 : 0.35;
    const legY = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, legY); ctx.lineTo(-w * legSpread, legY + h * 0.25);
    ctx.moveTo(-w * 0.12, legY); ctx.lineTo(-w * 0.15, legY + h * 0.25);
    ctx.moveTo(w * 0.12, legY);  ctx.lineTo(w * 0.15, legY + h * 0.25);
    ctx.moveTo(w * 0.35, legY);  ctx.lineTo(w * legSpread, legY + h * 0.25);
    ctx.stroke();

    ctx.restore();
}

function drawAlienB(x, y, w, h, poseB) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);

    ctx.fillStyle = '#e040fb';
    ctx.strokeStyle = '#e040fb';

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Claws
    const clawY = poseB ? h * 0.05 : -h * 0.05;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);    ctx.lineTo(-w * 0.6, clawY);
    ctx.moveTo(-w * 0.6, clawY); ctx.lineTo(-w * 0.7, clawY - h * 0.2);
    ctx.moveTo(-w * 0.6, clawY); ctx.lineTo(-w * 0.75, clawY + h * 0.1);
    ctx.moveTo(w * 0.4, 0);     ctx.lineTo(w * 0.6, clawY);
    ctx.moveTo(w * 0.6, clawY);  ctx.lineTo(w * 0.7, clawY - h * 0.2);
    ctx.moveTo(w * 0.6, clawY);  ctx.lineTo(w * 0.75, clawY + h * 0.1);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-w * 0.18, -h * 0.08, 5, 0, Math.PI * 2);
    ctx.arc(w * 0.18, -h * 0.08, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#220022';
    ctx.beginPath();
    ctx.arc(-w * 0.18, -h * 0.08, 2.5, 0, Math.PI * 2);
    ctx.arc(w * 0.18, -h * 0.08, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth = 1.5;
    const lY = h * 0.35;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, lY); ctx.lineTo(-w * 0.3, lY + h * 0.2);
    ctx.moveTo(0, lY);         ctx.lineTo(0, lY + h * 0.2);
    ctx.moveTo(w * 0.25, lY);  ctx.lineTo(w * 0.3, lY + h * 0.2);
    ctx.stroke();

    ctx.restore();
}

function drawAlienC(x, y, w, h, poseB, tentacleOffsets) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);

    // Body
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.05, w * 0.45, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head dome
    ctx.fillStyle = '#ff9100';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.3, w * 0.3, h * 0.2, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-w * 0.18, -h * 0.12, 5, 0, Math.PI * 2);
    ctx.arc(w * 0.18, -h * 0.12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#300';
    ctx.beginPath();
    ctx.arc(-w * 0.18, -h * 0.12, 2.8, 0, Math.PI * 2);
    ctx.arc(w * 0.18, -h * 0.12, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Tentacles (pre-computed offsets, no Math.random() in render)
    ctx.strokeStyle = '#ff6d00';
    ctx.lineWidth = 2;
    const curlA = poseB ? h * 0.2 : h * 0.1;
    const curlB = poseB ? h * 0.1 : h * 0.2;
    for (let t = 0; t < 6; t++) {
        const tx = -w * 0.4 + t * (w * 0.8 / 5);
        const curl = t % 2 === 0 ? curlA : curlB;
        const jitter = tentacleOffsets ? tentacleOffsets[t] : (t % 2 === 0 ? 4 : -4);
        ctx.beginPath();
        ctx.moveTo(tx, h * 0.3);
        ctx.quadraticCurveTo(tx + jitter, h * 0.38 + curl / 2, tx, h * 0.38 + curl);
        ctx.stroke();
    }

    ctx.restore();
}

function drawInvader(inv) {
    const poseB = Math.floor(frame / 30) % 2 === 1;
    if (inv.row <= 1) drawAlienA(inv.x, inv.y, INVADER_WIDTH, INVADER_HEIGHT, poseB);
    else if (inv.row <= 3) drawAlienB(inv.x, inv.y, INVADER_WIDTH, INVADER_HEIGHT, poseB);
    else drawAlienC(inv.x, inv.y, INVADER_WIDTH, INVADER_HEIGHT, poseB, inv.tentacleOffsets);
}

function drawPlayer() {
    const cx = playerX + PLAYER_WIDTH / 2;
    const py = canvas.height - PLAYER_HEIGHT - 10;
    const by = py + PLAYER_HEIGHT;
    const glowPulse = 0.65 + 0.35 * Math.sin(frame * 0.12);

    // --- Engine exhaust plumes (behind ship) ---
    ctx.save();
    ctx.shadowBlur = 0;
    for (const side of [-1, 1]) {
        const ex = cx + side * 14;
        const eg = ctx.createRadialGradient(ex, by + 2, 0, ex, by + 3, 10);
        eg.addColorStop(0,    `rgba(140,240,255,${0.95 * glowPulse})`);
        eg.addColorStop(0.4,  `rgba(0,170,255,${0.55 * glowPulse})`);
        eg.addColorStop(1,    'rgba(0,50,200,0)');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(ex, by + 3, 5, 9 * glowPulse, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // --- Wings (swept-back delta) ---
    const wingGradL = ctx.createLinearGradient(cx - 4, py + 8, cx - 22, by);
    wingGradL.addColorStop(0, '#1e8888');
    wingGradL.addColorStop(1, '#0b3d40');
    ctx.fillStyle = wingGradL;
    ctx.beginPath();
    ctx.moveTo(cx - 6,  py + 8);
    ctx.lineTo(cx - 8,  by);
    ctx.lineTo(cx - 15, by);
    ctx.lineTo(cx - 22, by - 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(38,208,206,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 6, py + 8);
    ctx.lineTo(cx - 22, by - 5);
    ctx.stroke();

    const wingGradR = ctx.createLinearGradient(cx + 4, py + 8, cx + 22, by);
    wingGradR.addColorStop(0, '#1e8888');
    wingGradR.addColorStop(1, '#0b3d40');
    ctx.fillStyle = wingGradR;
    ctx.beginPath();
    ctx.moveTo(cx + 6,  py + 8);
    ctx.lineTo(cx + 8,  by);
    ctx.lineTo(cx + 15, by);
    ctx.lineTo(cx + 22, by - 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(38,208,206,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx + 6, py + 8);
    ctx.lineTo(cx + 22, by - 5);
    ctx.stroke();

    // --- Engine pods at wing tips ---
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#00e5ff';
    ctx.fillStyle = '#0d5a5a';
    ctx.beginPath();
    ctx.ellipse(cx - 17, by - 4, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 17, by - 4, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nozzle inner glow
    ctx.fillStyle = `rgba(100,245,255,${0.75 * glowPulse})`;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.ellipse(cx - 17, by - 4, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 17, by - 4, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Main fuselage ---
    if (playerGradX !== playerX) {
        playerGrad = ctx.createLinearGradient(cx, py - 2, cx, by);
        playerGrad.addColorStop(0,    '#b8eef5');
        playerGrad.addColorStop(0.22, '#26d0ce');
        playerGrad.addColorStop(0.7,  '#137070');
        playerGrad.addColorStop(1,    '#092f30');
        playerGradX = playerX;
    }
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#26d0ce';
    ctx.fillStyle = playerGrad;
    ctx.beginPath();
    ctx.moveTo(cx,      py - 2);
    ctx.lineTo(cx + 10, py + 9);
    ctx.lineTo(cx + 8,  by);
    ctx.lineTo(cx - 8,  by);
    ctx.lineTo(cx - 10, py + 9);
    ctx.closePath();
    ctx.fill();

    // Fuselage center highlight stripe
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(cx,      py - 2);
    ctx.lineTo(cx + 3,  py + 10);
    ctx.lineTo(cx,      py + 15);
    ctx.lineTo(cx - 3,  py + 10);
    ctx.closePath();
    ctx.fill();

    // Fuselage side panel lines
    ctx.strokeStyle = 'rgba(38,208,206,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + 5, py + 7); ctx.lineTo(cx + 7, by - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 5, py + 7); ctx.lineTo(cx - 7, by - 2); ctx.stroke();

    // --- Cockpit dome ---
    const cg = ctx.createRadialGradient(cx - 1.5, py + 4, 0.5, cx, py + 7, 6);
    cg.addColorStop(0,   'rgba(225,250,255,1)');
    cg.addColorStop(0.5, 'rgba(80,210,235,0.85)');
    cg.addColorStop(1,   'rgba(20,90,130,0.3)');
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#8fd3f4';
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(cx, py + 7, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Cannon ---
    ctx.shadowBlur = 9;
    ctx.shadowColor = '#76ff03';
    ctx.fillStyle = '#76ff03';
    ctx.beginPath();
    ctx.moveTo(cx - 2,   py - 2);
    ctx.lineTo(cx + 2,   py - 2);
    ctx.lineTo(cx + 1.5, py - 11);
    ctx.lineTo(cx - 1.5, py - 11);
    ctx.closePath();
    ctx.fill();
    // Cannon tip
    ctx.fillStyle = '#ccff88';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(cx, py - 11, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

function drawBunkers() {
    ctx.fillStyle = '#76ff03';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#76ff03';
    const cellW = BUNKER_W / 4;
    const cellH = BUNKER_H / 3;
    for (const bunker of bunkers) {
        if (bunker.hp <= 0) continue;
        ctx.globalAlpha = 0.4 + (bunker.hp / BUNKER_HP) * 0.6;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                if (!bunker.cells[row * 4 + col]) continue;
                ctx.fillRect(bunker.x + col * cellW, bunker.y + row * cellH, cellW - 1, cellH - 1);
            }
        }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawStars() {
    // Draw slow stars (starsB) as squares — faster than arc
    ctx.fillStyle = '#fff';
    for (const s of starsB) {
        ctx.globalAlpha = s.brightness * 0.5;
        ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    // Draw fast stars (starsA)
    ctx.fillStyle = '#cce4ff';
    for (const s of starsA) {
        ctx.globalAlpha = s.brightness;
        ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
}

function drawExplosions() {
    for (const ex of explosions) {
        if (ex.flashLife > 0) {
            ctx.globalAlpha = ex.flashLife * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, 14 * ex.flashLife, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const p of ex.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function draw() {
    ctx.fillStyle = '#080820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStars();

    // Draw all invaders (no per-alien shadowBlur)
    for (let i = 0; i < invaders.length; i++) {
        if (invaders[i].alive) drawInvader(invaders[i]);
    }

    // Player bullets — set state once for the whole batch
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#76ff03';
    ctx.fillStyle = '#76ff03';
    for (const b of bullets) {
        ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    }

    // Invader bullets — set state once
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff5252';
    ctx.fillStyle = '#ff5252';
    for (const b of invaderBullets) {
        ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    }
    ctx.shadowBlur = 0;

    drawBunkers();
    drawPlayer();
    drawExplosions();

    // Ground line
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#26d0ce';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 2);
    ctx.globalAlpha = 1;

    updateScore();
}

const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (!isPlaying) return;
    if (e.code === 'Space') {
        e.preventDefault();
        bullets.push({
            x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
            y: canvas.height - PLAYER_HEIGHT - 10
        });
        GameAudio.shoot();
    }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.getElementById('startBtn').addEventListener('click', () => { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', () => {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

document.getElementById('btnShoot').addEventListener('click', () => {
    if (!isPlaying) return;
    bullets.push({
        x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
        y: canvas.height - PLAYER_HEIGHT - 10
    });
    GameAudio.shoot();
});

['btnLeft', 'btnRight'].forEach(id => {
    const key = id === 'btnLeft' ? 'ArrowLeft' : 'ArrowRight';
    const btn = document.getElementById(id);
    btn.addEventListener('mousedown', () => { keys[key] = true; });
    btn.addEventListener('mouseup', () => { keys[key] = false; });
    btn.addEventListener('mouseleave', () => { keys[key] = false; });
    btn.addEventListener('touchstart', e => { e.preventDefault(); keys[key] = true; });
    btn.addEventListener('touchend', e => { e.preventDefault(); keys[key] = false; });
    btn.addEventListener('touchcancel', () => { keys[key] = false; });
});

resetGame();

// ─── CANVAS TOUCH CONTROLS ──────────────────────────────────
var touchActive = false;

(function() {
    var autoShootInterval = null;

    function getCanvasX(touch) {
        var rect = canvas.getBoundingClientRect();
        return (touch.clientX - rect.left) * (canvas.width / rect.width);
    }

    function doShoot() {
        if (!isPlaying) return;
        bullets.push({
            x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
            y: canvas.height - PLAYER_HEIGHT - 10
        });
    }

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (!isPlaying) return;
        touchActive = true;
        playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH,
            getCanvasX(e.touches[0]) - PLAYER_WIDTH / 2));
        doShoot();
        autoShootInterval = setInterval(doShoot, 400);
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!touchActive || !isPlaying) return;
        playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH,
            getCanvasX(e.touches[0]) - PLAYER_WIDTH / 2));
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        touchActive = false;
        clearInterval(autoShootInterval);
        autoShootInterval = null;
    }, { passive: false });

    canvas.addEventListener('touchcancel', function() {
        touchActive = false;
        clearInterval(autoShootInterval);
        autoShootInterval = null;
    }, { passive: false });

    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
})();

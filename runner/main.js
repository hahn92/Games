// Endless Runner — animaciones completas
var canvas = document.getElementById('runnerCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;   // 600
var HEIGHT = canvas.height;  // 200

var GRAVITY     = 0.6;
var JUMP_FORCE  = -12;
var GROUND_Y    = 155;
var PLAYER_SIZE = 36;
var PLAYER_SPEED = 4;
var PLAYER_MIN_X = 20;
var PLAYER_MAX_X = 320;

// Game state
var player = {};
var obstacles = [];
var dustParticles = [];
var SPEED = 4;
var frame = 0;
var score = 0;
var highScore = parseInt(localStorage.getItem('runnerHighScore') || '0', 10);
var isPlaying = false;
var isDying   = false;
var animFrameId = null;
var nextObstacle = 90;
var keys = {};

// Animation state
var animTick    = 0;   // increments every game frame
var blinkTimer  = 100; // countdown to next blink
var squishX     = 1;   // scale X (squish/stretch)
var squishY     = 1;   // scale Y
var wasOnGround = true;
var deathAngle  = 0;
var deathVY     = 0;
var screenShake = 0;

// Clouds
var clouds = [
    { x: 100, y: 28, w: 64, h: 22 },
    { x: 310, y: 46, w: 80, h: 26 },
    { x: 520, y: 22, w: 52, h: 18 },
];

// ─── OBSTACLE ──────────────────────────────────────────────
function spawnObstacle() {
    var w = 18 + Math.random() * 14;
    var h = 28 + Math.random() * 44;
    obstacles.push({ x: WIDTH, width: w, height: h });
}

// ─── JUMP ──────────────────────────────────────────────────
function jump() {
    if (!isPlaying || isDying) return;
    if (player.onGround) {
        player.vy = JUMP_FORCE;
        player.onGround = false;
        // Launch stretch
        squishX = 0.75;
        squishY = 1.35;
        spawnDustBurst();
    }
}

function checkJumpKeys() {
    if (keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W']) jump();
}

// ─── PLAYER UPDATE ─────────────────────────────────────────
function updatePlayer() {
    if (keys['ArrowLeft']  || keys['a'] || keys['A'])
        player.x = Math.max(PLAYER_MIN_X, player.x - PLAYER_SPEED);
    if (keys['ArrowRight'] || keys['d'] || keys['D'])
        player.x = Math.min(PLAYER_MAX_X, player.x + PLAYER_SPEED);

    player.vy += GRAVITY;
    player.y  += player.vy;

    // Landing
    if (player.y >= GROUND_Y) {
        if (!player.onGround) {
            // Landing squish
            squishX = 1.4;
            squishY = 0.6;
            spawnDustBurst();
        }
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
    }

    // Lerp squish back to 1
    squishX += (1 - squishX) * 0.18;
    squishY += (1 - squishY) * 0.18;

    // Blink timer
    blinkTimer--;
    if (blinkTimer < 0) blinkTimer = 90 + Math.floor(Math.random() * 140);
}

// ─── DUST PARTICLES ────────────────────────────────────────
function spawnDustBurst() {
    for (var i = 0; i < 5; i++) {
        dustParticles.push({
            x: player.x + 10 + Math.random() * 16,
            y: GROUND_Y + PLAYER_SIZE - 2,
            vx: -1 - Math.random() * 2,
            vy: -0.5 - Math.random() * 1.5,
            life: 18 + Math.random() * 10,
            maxLife: 28,
            r: 3 + Math.random() * 3
        });
    }
}

function spawnRunDust() {
    if (frame % 10 === 0 && player.onGround) {
        dustParticles.push({
            x: player.x + 6 + Math.random() * 10,
            y: GROUND_Y + PLAYER_SIZE - 1,
            vx: -0.5 - Math.random() * 1,
            vy: -0.2 - Math.random() * 0.6,
            life: 12,
            maxLife: 12,
            r: 2 + Math.random() * 2
        });
    }
}

function updateDust() {
    for (var i = dustParticles.length - 1; i >= 0; i--) {
        var d = dustParticles[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.05;
        d.life--;
        if (d.life <= 0) dustParticles.splice(i, 1);
    }
}

function drawDust() {
    for (var i = 0; i < dustParticles.length; i++) {
        var d = dustParticles[i];
        var alpha = (d.life / d.maxLife) * 0.5;
        ctx.fillStyle = 'rgba(180,160,100,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── OBSTACLES ─────────────────────────────────────────────
function updateObstacles() {
    for (var i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= SPEED;
        if (obstacles[i].x + obstacles[i].width < 0) obstacles.splice(i, 1);
    }
}

function drawObstacles() {
    for (var i = 0; i < obstacles.length; i++) {
        var o  = obstacles[i];
        var oy = GROUND_Y + PLAYER_SIZE - o.height;
        var grad = ctx.createLinearGradient(o.x, oy, o.x + o.width, oy);
        grad.addColorStop(0, '#2e7d32');
        grad.addColorStop(1, '#1b5e20');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(o.x, oy, o.width, o.height, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(o.x + 2, oy + 2, o.width / 3, o.height - 4);
    }
}

function updateClouds() {
    for (var i = 0; i < clouds.length; i++) {
        clouds[i].x -= SPEED * 0.25;
        if (clouds[i].x + clouds[i].w < 0) {
            clouds[i].x = WIDTH + 20;
            clouds[i].y = 12 + Math.random() * 50;
        }
    }
}

// ─── COLLISION ─────────────────────────────────────────────
function checkCollision() {
    var margin = 7;
    var px = player.x + margin, py = player.y + margin;
    var pw = PLAYER_SIZE - margin * 2, ph = PLAYER_SIZE - margin * 2;
    for (var i = 0; i < obstacles.length; i++) {
        var o  = obstacles[i];
        var ox = o.x, oy = GROUND_Y + PLAYER_SIZE - o.height;
        if (px < ox + o.width && px + pw > ox && py < oy + o.height && py + ph > oy)
            return true;
    }
    return false;
}

// ─── DRAW BACKGROUND ───────────────────────────────────────
function drawBackground() {
    var sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y + PLAYER_SIZE);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(1, '#cae8f7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (var i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        ctx.beginPath();
        ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + c.w * 0.3, c.y + c.h * 0.7, c.w * 0.3, c.h * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + c.w * 0.72, c.y + c.h * 0.65, c.w * 0.28, c.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ground
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, GROUND_Y + PLAYER_SIZE, WIDTH, HEIGHT - GROUND_Y - PLAYER_SIZE);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(0, GROUND_Y + PLAYER_SIZE, WIDTH, 4);

    // Ground detail lines
    ctx.strokeStyle = 'rgba(56,142,60,0.4)';
    ctx.lineWidth = 1;
    for (var x = (frame * SPEED * 0.5) % 40; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + PLAYER_SIZE + 6);
        ctx.lineTo(x + 18, GROUND_Y + PLAYER_SIZE + 6);
        ctx.stroke();
    }
}

// ─── DRAW DINO ─────────────────────────────────────────────
function drawDino(x, y, running, dead, deathAng) {
    var lp      = (running && player.onGround) ? Math.floor(animTick / 7) % 2 : 0;
    var isJump  = !player.onGround && !dead;
    var isBlink = blinkTimer < 3;

    // Squish/stretch transform
    var sx = dead ? 1 : squishX;
    var sy = dead ? 1 : squishY;

    ctx.save();
    // Pivot around center of dino for squish
    var pivotX = x + 18;
    var pivotY = y + PLAYER_SIZE;

    if (dead) {
        ctx.translate(pivotX, pivotY);
        ctx.rotate(deathAng);
        ctx.translate(-18, -PLAYER_SIZE);
    } else {
        ctx.translate(pivotX, pivotY);
        ctx.scale(sx, sy);
        ctx.translate(-18, -PLAYER_SIZE);
    }

    var G1 = '#43a047';
    var G2 = '#2e7d32';
    var G3 = '#a5d6a7';

    // --- Tail (animated wave) ---
    var tailWave = running ? Math.sin(animTick * 0.25) * 3 : 0;
    ctx.fillStyle = G1;
    ctx.beginPath();
    ctx.moveTo(2, 14);
    ctx.quadraticCurveTo(-4, 18 + tailWave, -10, 24 + tailWave);
    ctx.lineTo(-3, 27 + tailWave);
    ctx.lineTo(4, 22);
    ctx.closePath();
    ctx.fill();

    // --- Body ---
    ctx.fillStyle = G1;
    ctx.beginPath();
    ctx.roundRect(2, 10, 22, 17, 5);
    ctx.fill();

    // --- Belly ---
    ctx.fillStyle = G3;
    ctx.beginPath();
    ctx.ellipse(13, 19, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Neck ---
    ctx.fillStyle = G1;
    ctx.beginPath();
    ctx.roundRect(18, 5, 9, 13, 4);
    ctx.fill();

    // --- Head (slight forward lean when running) ---
    var headLean = running && player.onGround ? 2 : 0;
    ctx.fillStyle = G1;
    ctx.beginPath();
    ctx.roundRect(15 + headLean, 0, 20, 12, 4);
    ctx.fill();

    // --- Snout ---
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.roundRect(28 + headLean, 6, 9, 5, [0, 2, 2, 0]);
    ctx.fill();

    // --- Nostril ---
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.arc(34 + headLean, 3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Eye (with blink) ---
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (isBlink) {
        // Closed eye = thin ellipse
        ctx.ellipse(23 + headLean, 4, 3, 0.8, 0, 0, Math.PI * 2);
    } else {
        ctx.arc(23 + headLean, 4, 3, 0, Math.PI * 2);
    }
    ctx.fill();
    if (!isBlink) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(24 + headLean, 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(25 + headLean, 3, 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Arm ---
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.roundRect(20, 17, 6, 4, 2);
    ctx.fill();
    ctx.fillRect(24, 19, 4, 2);

    // --- Legs ---
    ctx.fillStyle = G2;
    if (dead) {
        // Dead: both legs out flat
        ctx.beginPath(); ctx.roundRect(4,  26, 7, 4, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, 26, 7, 4, 2); ctx.fill();
    } else if (isJump) {
        // Jump pose: legs tucked back
        ctx.save();
        ctx.beginPath(); ctx.roundRect(3,  26, 6, 7, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(13, 26, 6, 7, 2); ctx.fill();
        // Angled feet
        ctx.beginPath();
        ctx.moveTo(3, 32); ctx.lineTo(10, 30); ctx.lineTo(10, 33); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(13, 32); ctx.lineTo(20, 30); ctx.lineTo(20, 33); ctx.closePath();
        ctx.fill();
        ctx.restore();
    } else if (lp === 0) {
        ctx.beginPath(); ctx.roundRect(5,  26, 6, 10, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(15, 26, 6, 10, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(3,  33, 10, 4, [0,0,2,2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(13, 33, 11, 4, [0,0,2,2]); ctx.fill();
    } else {
        ctx.beginPath(); ctx.roundRect(3,  26, 6, 8,  2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(16, 26, 6, 10, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(1,  31, 9,  4, [0,0,2,2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, 33, 11, 4, [0,0,2,2]); ctx.fill();
    }

    ctx.restore();
}

function drawPlayer() {
    drawDino(player.x, player.y, isPlaying, false, 0);
}

// ─── SCORE ─────────────────────────────────────────────────
function drawScore() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 15px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText('Puntaje: ' + score, WIDTH - 12, 10);
    ctx.textAlign = 'left';
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

// ─── DEATH ANIMATION ───────────────────────────────────────
function runDeathAnim() {
    deathAngle += 0.15;
    deathVY += GRAVITY * 0.8;
    player.y += deathVY;

    if (screenShake > 0) screenShake--;

    drawBackground();
    drawDust();
    drawObstacles();

    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
    }
    drawDino(player.x, player.y, false, true, deathAngle);
    drawScore();
    ctx.restore();

    if (player.y < HEIGHT + 60) {
        animFrameId = requestAnimationFrame(runDeathAnim);
    } else {
        document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
        document.getElementById('gameOverPopup').style.display = 'flex';
        document.getElementById('startBtn').disabled = false;
        document.getElementById('restartBtn').disabled = true;
        if (document.getElementById('mobileStartBtn'))
            document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

// ─── GAME LOOP ─────────────────────────────────────────────
function drawIdle() {
    drawBackground();
    drawPlayer();
    drawScore();
}

function gameLoop() {
    if (!isPlaying) return;

    frame++;
    animTick++;
    SPEED += 0.001;
    score = Math.floor(frame / 6);

    if (frame >= nextObstacle) {
        spawnObstacle();
        nextObstacle = frame + 78 + Math.floor(Math.random() * 40);
    }

    checkJumpKeys();
    updatePlayer();
    updateObstacles();
    updateClouds();
    updateDust();
    spawnRunDust();

    if (checkCollision()) {
        gameOver();
        return;
    }

    updateScore();

    // Screen shake offset
    var shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * 5;
        shakeY = (Math.random() - 0.5) * 3;
        screenShake--;
    }

    ctx.save();
    if (shakeX || shakeY) ctx.translate(shakeX, shakeY);
    drawBackground();
    drawDust();
    drawObstacles();
    drawPlayer();
    drawScore();
    ctx.restore();

    animFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    player = { x: 80, y: GROUND_Y, vy: 0, onGround: true };
    obstacles = [];
    dustParticles = [];
    SPEED = 4;
    frame = 0;
    animTick = 0;
    score = 0;
    nextObstacle = 90;
    isPlaying = true;
    isDying   = false;
    deathAngle = 0;
    deathVY = 0;
    squishX = 1; squishY = 1;
    blinkTimer = 100;
    screenShake = 0;

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    cancelAnimationFrame(animFrameId);
    updateScore();
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    isDying = true;
    cancelAnimationFrame(animFrameId);

    // Kick death animation
    deathAngle = 0;
    deathVY = -7;
    screenShake = 14;

    animFrameId = requestAnimationFrame(runDeathAnim);
}

// ─── CONTROLS ──────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0)
        e.preventDefault();
});
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

canvas.addEventListener('click', function() { jump(); });
canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    jump();
}, { passive: false });

function addHold(id, key) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('mousedown',   function()  { keys[key] = true; });
    btn.addEventListener('touchstart',  function(e) { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('mouseup',     function()  { keys[key] = false; });
    btn.addEventListener('touchend',    function()  { keys[key] = false; });
    btn.addEventListener('touchcancel', function()  { keys[key] = false; });
    btn.addEventListener('mouseleave',  function()  { keys[key] = false; });
}
addHold('btnLeft',  'ArrowLeft');
addHold('btnRight', 'ArrowRight');

var btnJump = document.getElementById('btnJump');
if (btnJump) {
    btnJump.addEventListener('mousedown',  function()  { jump(); });
    btnJump.addEventListener('touchstart', function(e) { e.preventDefault(); jump(); }, { passive: false });
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
document.getElementById('score').textContent = '0';
document.getElementById('highScore').textContent = highScore;
drawIdle();

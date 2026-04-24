'use strict';
/* =========================================================
   Pinball Neón — main.js
   Canvas 360×580, portrait/mobile-first
   rAF game loop + delta-time, no setInterval, no emoji on canvas
   ========================================================= */

(function () {

/* ── Canvas & Context ── */
var canvas = document.getElementById('pinballCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 360
var H = canvas.height;  // 580

/* ── DOM refs ── */
var scoreEl     = document.getElementById('score');
var highScoreEl = document.getElementById('highScore');
var livesEl     = document.getElementById('lives');
var levelEl     = document.getElementById('level');
var startBtn    = document.getElementById('startBtn');
var restartBtn  = document.getElementById('restartBtn');
var playAgainBtn= document.getElementById('playAgainBtn');
var popup       = document.getElementById('gameOverPopup');
var finalScoreEl= document.getElementById('finalScore');
var newRecordEl = document.getElementById('newRecord');
var mobileScore = document.getElementById('mobileScore');

/* ── Persistence ── */
var HS_KEY = 'pinball_highscore';
var highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
highScoreEl.textContent = highScore;

/* ── Game state ── */
var STATE = { IDLE: 0, LAUNCH: 1, PLAY: 2, DEAD: 3, OVER: 4 };
var state = STATE.IDLE;
var score = 0;
var lives = 3;
var level = 1;
var lastTime = 0;
var rafId = null;

/* ── Flipper constants ── */
var FL_LEN   = 70;   // flipper length px
var FL_W     = 10;   // half-width at base
var FL_TIP   = 5;    // half-width at tip
var FL_REST_L= 0.45; // left flipper rest angle (radians, up from horizontal)
var FL_REST_R= Math.PI - 0.45;
var FL_UP_L  = -0.35;
var FL_UP_R  = Math.PI + 0.35;
var FL_SPEED = 18;   // radians/sec
var FL_PIVOT_Y = H - 68;

var flipperL = {
    x: W / 2 - 30, y: FL_PIVOT_Y,
    angle: FL_REST_L, target: FL_REST_L,
    dir: 1  // +1 = left side, -1 = right
};
var flipperR = {
    x: W / 2 + 30, y: FL_PIVOT_Y,
    angle: FL_REST_R, target: FL_REST_R,
    dir: -1
};

/* ── Ball ── */
var BALL_R = 9;
var ball = { x: W - 28, y: H - 120, vx: 0, vy: 0, active: false };

/* ── Launch plunger ── */
var plungerPower = 0;
var plungerCharging = false;

/* ── Bumpers ── */
var bumpers = [
    { x: 100, y: 160, r: 22, score: 100, lit: 0 },
    { x: 260, y: 160, r: 22, score: 100, lit: 0 },
    { x: 180, y: 220, r: 22, score: 150, lit: 0 },
    { x:  90, y: 270, r: 18, score:  80, lit: 0 },
    { x: 270, y: 270, r: 18, score:  80, lit: 0 },
];

/* ── Ramps (angled walls that guide ball) ── */
/* Each ramp: {x1,y1,x2,y2} line segment */
var ramps = [
    // Left gutter guard
    { x1: 30,  y1: H - 130, x2: flipperL.x, y2: FL_PIVOT_Y },
    // Right gutter guard
    { x1: W - 30, y1: H - 130, x2: flipperR.x, y2: FL_PIVOT_Y },
    // Upper-left angled ramp
    { x1: 20,  y1: 300, x2: 80, y2: 200 },
    // Upper-right angled ramp
    { x1: W - 20, y1: 300, x2: W - 80, y2: 200 },
    // Left side wall
    { x1: 20, y1: 100, x2: 20, y2: 300 },
    // Right side wall
    { x1: W - 20, y1: 100, x2: W - 20, y2: 300 },
    // Top-left
    { x1: 20,  y1: 100, x2: 80, y2: 60 },
    // Top-right
    { x1: W - 20, y1: 100, x2: W - 80, y2: 60 },
    // Top wall
    { x1: 80, y1: 60, x2: W - 80, y2: 60 },
    // Plunger lane right wall
    { x1: W - 20, y1: 60, x2: W - 20, y2: H - 130 },
    // Plunger lane left wall
    { x1: W - 40, y1: 160, x2: W - 40, y2: H - 68 },
];

/* ── Score popups ── */
var popups = [];

/* ── Input state ── */
var keys = { left: false, right: false, space: false };

/* ── Gravity ── */
var GRAVITY = 800; // px/s²

/* ─────────────────────────────────────────
   GEOMETRY HELPERS
───────────────────────────────────────── */

function dot(ax, ay, bx, by) { return ax * bx + ay * by; }

function segClosest(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: x1, y: y1, t: 0 };
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return { x: x1 + t * dx, y: y1 + t * dy, t: t };
}

function distSq(ax, ay, bx, by) {
    return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
}

/* ─────────────────────────────────────────
   FLIPPER TIP POSITIONS
───────────────────────────────────────── */

function flipperTip(f) {
    return {
        x: f.x + Math.cos(f.angle) * FL_LEN,
        y: f.y + Math.sin(f.angle) * FL_LEN
    };
}

/* ─────────────────────────────────────────
   BALL vs SEGMENT COLLISION
───────────────────────────────────────── */

function collideSeg(bx, by, vx, vy, x1, y1, x2, y2) {
    var cp = segClosest(bx, by, x1, y1, x2, y2);
    var dx = bx - cp.x, dy = by - cp.y;
    var d2 = dx * dx + dy * dy;
    if (d2 > BALL_R * BALL_R) return null;
    var d = Math.sqrt(d2) || 0.001;
    var nx = dx / d, ny = dy / d;
    // push ball out
    var pen = BALL_R - d;
    var nbx = bx + nx * pen;
    var nby = by + ny * pen;
    // reflect velocity
    var vdotn = vx * nx + vy * ny;
    var restitution = 0.65;
    var nvx = vx - (1 + restitution) * vdotn * nx;
    var nvy = vy - (1 + restitution) * vdotn * ny;
    return { x: nbx, y: nby, vx: nvx, vy: nvy, nx: nx, ny: ny };
}

/* ─────────────────────────────────────────
   BALL vs CIRCLE BUMPER COLLISION
───────────────────────────────────────── */

function collideBumper(b, bmp) {
    var dx = b.x - bmp.x, dy = b.y - bmp.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var minDist = BALL_R + bmp.r;
    if (dist >= minDist) return false;
    var nx = dx / (dist || 0.001);
    var ny = dy / (dist || 0.001);
    b.x = bmp.x + nx * minDist;
    b.y = bmp.y + ny * minDist;
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var minBounce = 300;
    var bounceSpeed = Math.max(speed * 1.15, minBounce);
    b.vx = nx * bounceSpeed;
    b.vy = ny * bounceSpeed;
    return true;
}

/* ─────────────────────────────────────────
   BALL vs FLIPPER COLLISION
───────────────────────────────────────── */

function collideFlipperSeg(f) {
    var tip = flipperTip(f);
    var res = collideSeg(ball.x, ball.y, ball.vx, ball.vy, f.x, f.y, tip.x, tip.y);
    if (!res) return;
    ball.x = res.x; ball.y = res.y;
    // add flipper angular velocity boost
    var angVel = (f.angle - f.target) < 0 ? 6 : 0;
    ball.vx = res.vx;
    ball.vy = res.vy - angVel * FL_LEN * 0.5;
}

/* ─────────────────────────────────────────
   PHYSICS UPDATE
───────────────────────────────────────── */

function updateBall(dt) {
    if (!ball.active) return;

    // gravity
    ball.vy += GRAVITY * dt;

    // move
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // speed cap
    var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    var MAX_SPD = 900;
    if (spd > MAX_SPD) {
        ball.vx = ball.vx / spd * MAX_SPD;
        ball.vy = ball.vy / spd * MAX_SPD;
    }

    // wall segments
    for (var i = 0; i < ramps.length; i++) {
        var r = ramps[i];
        var res = collideSeg(ball.x, ball.y, ball.vx, ball.vy, r.x1, r.y1, r.x2, r.y2);
        if (res) {
            ball.x = res.x; ball.y = res.y;
            ball.vx = res.vx; ball.vy = res.vy;
        }
    }

    // bumpers
    var bumpHit = false;
    for (var j = 0; j < bumpers.length; j++) {
        var bmp = bumpers[j];
        if (collideBumper(ball, bmp)) {
            bumpHit = true;
            var pts = bmp.score * level;
            addScore(pts);
            bmp.lit = 12;
            popups.push({ x: bmp.x, y: bmp.y - bmp.r - 8, text: '+' + pts, life: 45 });
        }
    }
    if (bumpHit) GameAudio.hit();

    // flippers
    collideFlipperSeg(flipperL);
    collideFlipperSeg(flipperR);

    // canvas boundary — left and right of main play area
    if (ball.x - BALL_R < 0) {
        ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.65;
        GameAudio.hit();
    }
    if (ball.x + BALL_R > W) {
        ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.65;
        GameAudio.hit();
    }
    if (ball.y - BALL_R < 0) {
        ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * 0.65;
        GameAudio.hit();
    }

    // drain — ball falls below flippers
    if (ball.y > H + BALL_R + 10) {
        ball.active = false;
        lives--;
        livesEl.textContent = lives;
        GameAudio.gameOver();
        if (lives <= 0) {
            setTimeout(endGame, 300);
        } else {
            state = STATE.LAUNCH;
            setTimeout(resetBall, 600);
        }
    }
}

function updateFlippers(dt) {
    function stepAngle(f, targetAngle) {
        var diff = targetAngle - f.angle;
        var step = FL_SPEED * dt;
        if (Math.abs(diff) <= step) {
            f.angle = targetAngle;
        } else {
            f.angle += Math.sign(diff) * step;
        }
    }
    var targetL = keys.left  ? FL_UP_L : FL_REST_L;
    var targetR = keys.right ? FL_UP_R : FL_REST_R;
    stepAngle(flipperL, targetL);
    stepAngle(flipperR, targetR);
}

/* ─────────────────────────────────────────
   SCORE / LEVEL
───────────────────────────────────────── */

function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    if (mobileScore) mobileScore.textContent = 'Puntaje: ' + score + '  Vidas: ' + lives;
    // level up every 5000 pts
    var newLevel = Math.floor(score / 5000) + 1;
    if (newLevel > level) {
        level = newLevel;
        levelEl.textContent = level;
        GameAudio.win();
    }
}

/* ─────────────────────────────────────────
   BALL RESET
───────────────────────────────────────── */

function resetBall() {
    // place ball in plunger lane
    ball.x = W - 28;
    ball.y = H - 120;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = false;
    plungerPower = 0;
    plungerCharging = false;
    state = STATE.LAUNCH;
}

/* ─────────────────────────────────────────
   GAME LIFECYCLE
───────────────────────────────────────── */

function startGame() {
    score = 0; lives = 3; level = 1;
    scoreEl.textContent = 0;
    livesEl.textContent = 3;
    levelEl.textContent = 1;
    if (mobileScore) mobileScore.textContent = 'Puntaje: 0  Vidas: 3';
    bumpers.forEach(function(b) { b.lit = 0; });
    popups = [];
    resetBall();
    state = STATE.LAUNCH;
    startBtn.disabled = true;
    restartBtn.disabled = false;
    popup.style.display = 'none';
    GameAudio.start();
    if (!rafId) rafId = requestAnimationFrame(loop);
}

function endGame() {
    state = STATE.OVER;
    finalScoreEl.textContent = 'Puntaje: ' + score;
    var isNew = score > highScore;
    if (isNew) {
        highScore = score;
        localStorage.setItem(HS_KEY, highScore);
        highScoreEl.textContent = highScore;
        newRecordEl.style.display = 'block';
    } else {
        newRecordEl.style.display = 'none';
    }
    popup.style.display = 'flex';
    startBtn.disabled = false;
    restartBtn.disabled = true;
}

/* ─────────────────────────────────────────
   LAUNCH PLUNGER
───────────────────────────────────────── */

function launchBall() {
    var power = Math.max(0.3, plungerPower);
    ball.vx = -60;
    ball.vy = -(400 + power * 500);
    ball.active = true;
    plungerPower = 0;
    plungerCharging = false;
    state = STATE.PLAY;
    GameAudio.score();
}

/* ─────────────────────────────────────────
   DRAW HELPERS
───────────────────────────────────────── */

function drawFlipper(f) {
    var tip = flipperTip(f);
    var angle = f.angle;
    var perpX = -Math.sin(angle);
    var perpY =  Math.cos(angle);
    var cos = Math.cos(angle), sin = Math.sin(angle);

    ctx.beginPath();
    // Build trapezoid shape
    ctx.moveTo(f.x + perpX * FL_W, f.y + perpY * FL_W);
    ctx.lineTo(f.x - perpX * FL_W, f.y - perpY * FL_W);
    ctx.lineTo(tip.x - perpX * FL_TIP, tip.y - perpY * FL_TIP);
    ctx.lineTo(tip.x + perpX * FL_TIP, tip.y + perpY * FL_TIP);
    ctx.closePath();
    ctx.fillStyle = '#8fd3f4';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawBumper(bmp) {
    ctx.beginPath();
    ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
    if (bmp.lit > 0) {
        ctx.fillStyle = '#ff512f';
        bmp.lit--;
    } else {
        ctx.fillStyle = '#1a0040';
    }
    ctx.fill();
    ctx.strokeStyle = '#cc88ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // inner ring
    ctx.beginPath();
    ctx.arc(bmp.x, bmp.y, bmp.r - 5, 0, Math.PI * 2);
    ctx.strokeStyle = bmp.lit > 0 ? '#ffcc00' : '#7733cc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawRamp(r) {
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1);
    ctx.lineTo(r.x2, r.y2);
    ctx.strokeStyle = '#3355aa';
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawBall() {
    if (!ball.active && state === STATE.LAUNCH) {
        // draw at plunger position
        ctx.beginPath();
        ctx.arc(W - 28, H - 120, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = '#e0e0ff';
        ctx.fill();
        ctx.strokeStyle = '#aaaaff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
    }
    if (!ball.active) return;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0ff';
    ctx.fill();
    ctx.strokeStyle = '#aaaaff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawPlunger() {
    if (state !== STATE.LAUNCH) return;
    // lane
    ctx.fillStyle = '#12002a';
    ctx.fillRect(W - 40, H - 68, 20, 68);
    // plunger bar
    var barH = 12 + plungerPower * 30;
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(W - 36, H - barH, 12, barH);
    // power indicator
    ctx.fillStyle = '#ff512f';
    ctx.fillRect(W - 38, H - 8, 16, 4);
    // charge bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(W - 38, H - 55, 16, 44);
    ctx.fillStyle = plungerCharging ? '#ff512f' : '#8fd3f4';
    ctx.fillRect(W - 38, H - 55 + (44 - 44 * plungerPower), 16, 44 * plungerPower);
}

function drawScorePopups() {
    for (var i = popups.length - 1; i >= 0; i--) {
        var p = popups[i];
        ctx.globalAlpha = p.life / 45;
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        p.y -= 1.2;
        p.life--;
        if (p.life <= 0) popups.splice(i, 1);
    }
    ctx.globalAlpha = 1;
}

function drawUI() {
    // top HUD
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCORE: ' + score, 8, 17);
    ctx.textAlign = 'center';
    ctx.fillText('PINBALL NEON', W / 2, 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff512f';
    // draw lives as circles
    for (var i = 0; i < lives; i++) {
        ctx.beginPath();
        ctx.arc(W - 10 - i * 16, 17, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < lives ? '#ff512f' : '#333';
        ctx.fill();
    }
    ctx.textBaseline = 'alphabetic';

    // launch hint
    if (state === STATE.LAUNCH) {
        ctx.fillStyle = 'rgba(143,211,244,0.9)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Mantén ESPACIO o toca para cargar', W / 2, H - 10);
    }
}

function drawBackground() {
    ctx.fillStyle = '#08001a';
    ctx.fillRect(0, 0, W, H);

    // subtle grid
    ctx.strokeStyle = 'rgba(80,40,120,0.18)';
    ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // drain zone indicator
    ctx.fillStyle = 'rgba(255,50,30,0.08)';
    ctx.fillRect(0, FL_PIVOT_Y + 20, W, H - FL_PIVOT_Y - 20);
    ctx.strokeStyle = 'rgba(255,80,40,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, FL_PIVOT_Y + 20);
    ctx.lineTo(W, FL_PIVOT_Y + 20);
    ctx.stroke();
}

function drawIdleScreen() {
    ctx.fillStyle = '#08001a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PINBALL', W / 2, H / 2 - 40);
    ctx.fillStyle = '#cc88ff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('NEON', W / 2, H / 2);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px monospace';
    ctx.fillText('Pulsa Iniciar para jugar', W / 2, H / 2 + 50);
    ctx.textBaseline = 'alphabetic';
}

/* ─────────────────────────────────────────
   MAIN LOOP
───────────────────────────────────────── */

function loop(ts) {
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (state === STATE.IDLE || state === STATE.OVER) {
        drawIdleScreen();
        rafId = requestAnimationFrame(loop);
        return;
    }

    // Update
    if (state === STATE.PLAY) updateBall(dt);
    updateFlippers(dt);

    // plunger charging
    if (state === STATE.LAUNCH && plungerCharging) {
        plungerPower = Math.min(1, plungerPower + dt * 1.4);
    }

    // Draw
    drawBackground();
    for (var i = 0; i < ramps.length; i++) drawRamp(ramps[i]);
    for (var j = 0; j < bumpers.length; j++) drawBumper(bumpers[j]);
    drawFlipper(flipperL);
    drawFlipper(flipperR);
    drawBall();
    drawPlunger();
    drawScorePopups();
    drawUI();

    rafId = requestAnimationFrame(loop);
}

/* ─────────────────────────────────────────
   INPUT HANDLING
───────────────────────────────────────── */

document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft'  || e.key === 'z' || e.key === 'Z') { keys.left  = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') { keys.right = true; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (state === STATE.LAUNCH && !plungerCharging) {
            plungerCharging = true;
        }
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state === STATE.LAUNCH && !ball.active) {
        // any flipper key also launches after charging
    }
});

document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft'  || e.key === 'z' || e.key === 'Z') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') keys.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp') {
        if (state === STATE.LAUNCH && plungerCharging) {
            launchBall();
        }
    }
});

/* Touch — left half = left flipper, right half = right flipper
   Tap center (no move) = plunger charge/launch */
var activeTouches = {};

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var tx = (t.clientX - rect.left) * scaleX;
        activeTouches[t.identifier] = tx;
        if (tx < W / 2) {
            keys.left = true;
        } else {
            keys.right = true;
            if (state === STATE.LAUNCH && !plungerCharging) {
                plungerCharging = true;
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var tx = activeTouches[t.identifier];
        delete activeTouches[t.identifier];
        if (tx !== undefined) {
            if (tx >= W / 2) {
                keys.right = false;
                if (state === STATE.LAUNCH && plungerCharging) {
                    launchBall();
                }
            } else {
                keys.left = false;
            }
        }
    }
    // reset if no touches
    if (Object.keys(activeTouches).length === 0) {
        keys.left = false;
        keys.right = false;
    }
}, { passive: false });

/* ─────────────────────────────────────────
   BUTTON HANDLERS
───────────────────────────────────────── */

startBtn.addEventListener('click', function () {
    startGame();
});

restartBtn.addEventListener('click', function () {
    startGame();
});

playAgainBtn.addEventListener('click', function () {
    popup.style.display = 'none';
    startGame();
});

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */

// Load high score display
highScoreEl.textContent = highScore;

// Start idle render loop
lastTime = performance.now();
rafId = requestAnimationFrame(loop);

}());

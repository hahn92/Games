'use strict';
/* =========================================================
   Pinball Neón — main.js
   Canvas 360×580, portrait/mobile-first
   Plunger lane on the right (x=LANE_SEP..LANE_R).
   Ball launches straight up the lane and is redirected into
   the play area by a guide ramp at the top.
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
var HS_KEY    = 'pinball_highscore';
var highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
highScoreEl.textContent = highScore;

/* ── Game state ── */
var STATE = { IDLE: 0, LAUNCH: 1, PLAY: 2, OVER: 3 };
var state = STATE.IDLE;
var score = 0;
var lives = 3;
var level = 1;
var lastTime = 0;
var rafId = null;

/* ── Layout ── */
var LANE_SEP = 316;   // x separator: play area | plunger lane
var LANE_R   = 352;   // x right wall of plunger lane
var PLAY_L   = 18;    // x left wall of play area
var TOP_Y    = 50;    // y top of play area

/* ── Flipper constants ── */
var FL_LEN    = 80;
var FL_W      = 10;
var FL_TIP    = 5;
var FL_REST_L = 0.42;           // resting angle for left flipper (pointing down-right)
var FL_REST_R = Math.PI - 0.42; // resting angle for right flipper (pointing down-left ≈ 2.72)
var FL_UP_L   = -0.42;          // up angle for left flipper (pointing up-right)
var FL_UP_R   = Math.PI + 0.42; // up angle for right flipper (pointing up-left ≈ 3.56)
var FL_SPEED  = 22;             // radians per second (snappy response)
var FL_PIVOT_Y = H - 88;        // 492

/* Flipper objects — target tracks the intended destination for boost detection */
var flipperL = { x: 105, y: FL_PIVOT_Y, angle: FL_REST_L, target: FL_REST_L, dir:  1 };
var flipperR = { x: 255, y: FL_PIVOT_Y, angle: FL_REST_R, target: FL_REST_R, dir: -1 };

/* ── Ball — starts in plunger lane ── */
var BALL_R = 9;
var BALL_LAUNCH_X = Math.round((LANE_SEP + LANE_R) / 2);  // 334, center of lane
var BALL_LAUNCH_Y = H - 60;   // 520 — rests on plunger tip above bottom wall
var ball = { x: BALL_LAUNCH_X, y: BALL_LAUNCH_Y, vx: 0, vy: 0, active: false };

/* ── Plunger ── */
var plungerPower    = 0;
var plungerCharging = false;

/* ── Bumpers ── */
var bumpers = [
    { x: 108, y: 178, r: 22, score: 100, lit: 0 },
    { x: 208, y: 178, r: 22, score: 100, lit: 0 },
    { x: 158, y: 255, r: 22, score: 150, lit: 0 },
    { x:  96, y: 318, r: 18, score:  80, lit: 0 },
    { x: 218, y: 318, r: 18, score:  80, lit: 0 },
];

/*
   Ramp / wall layout:

   Play area   : x=PLAY_L(18)  .. x=LANE_SEP(316)
   Plunger lane: x=LANE_SEP(316) .. x=LANE_R(352)

   The guide ramp runs from (LANE_R=352, 380) → (248, TOP_Y=50).
   This starts lower so the ball reliably hits it.

   At ball x=334 (lane center), ramp y =
     t = (334 - 352)/(248 - 352) = -18/-104 ≈ 0.173
     y  = 380 + 0.173*(50 - 380) = 380 - 57.2 ≈ 323
   Ball launched at y=520 with min vy = -(700+0.25*520)= -830:
     max rise = 830²/(2*820) = 420 px → reaches y=520-420=100 ✓ (100 < 323)

   Separator wall (LANE_SEP, 310 → LANE_SEP, H-90):
   Gap from y=310 upward lets ball exit lane into play area once
   it has been redirected by the guide ramp.
*/
var ramps = [
    /* ── Play area outline ── */
    { x1: 68,       y1: TOP_Y,   x2: 248,      y2: TOP_Y   },  // Top wall
    { x1: PLAY_L,   y1: 98,      x2: 68,       y2: TOP_Y   },  // TL corner
    { x1: 214,      y1: TOP_Y,   x2: LANE_SEP, y2: 215     },  // TR diagonal (upper right)
    { x1: PLAY_L,   y1: 98,      x2: PLAY_L,   y2: 410     },  // L wall
    { x1: PLAY_L,   y1: 265,     x2: 68,       y2: 160     },  // L inner slant (bumper guide)
    { x1: PLAY_L,   y1: 410,     x2: 82,       y2: 458     },  // L lower shoulder → flipper
    { x1: LANE_SEP, y1: 310,     x2: 248,      y2: 458     },  // R lower shoulder → flipper
    /* ── Plunger lane ── */
    { x1: LANE_SEP, y1: 310,     x2: LANE_SEP, y2: H - 10  },  // Separator (lower half only; gap above 310)
    { x1: LANE_R,   y1: TOP_Y,   x2: LANE_R,   y2: H - 10  },  // Lane right wall
    { x1: LANE_R,   y1: 380,     x2: 248,      y2: TOP_Y   },  // Guide ramp → redirects ball left
    /* ── Bottom lane walls ── */
    { x1: PLAY_L,   y1: H - 10,  x2: 82,       y2: H - 10  },  // Bottom left (drain gap in middle)
    { x1: LANE_SEP, y1: H - 10,  x2: LANE_R,   y2: H - 10  },  // Plunger lane floor
];

/* ── Slingshot kickers (triangular bumpers near lower shoulders) ── */
var slings = [
    /* Left sling: apex at (50, 390), base on the left wall */
    { x1: PLAY_L, y1: 355, x2: 55,     y2: 395, score: 50, lit: 0 },
    { x1: 55,     y1: 395, x2: PLAY_L, y2: 420, score: 50, lit: 0 },
    /* Right sling: apex at (LANE_SEP-14, 390), base on the separator */
    { x1: LANE_SEP, y1: 350, x2: LANE_SEP - 20, y2: 395, score: 50, lit: 0 },
    { x1: LANE_SEP - 20, y1: 395, x2: LANE_SEP, y2: 420, score: 50, lit: 0 },
];

/* ── Score popups ── */
var popups = [];

/* ── Input ── */
var keys = { left: false, right: false };

/* ── Gravity ── */
var GRAVITY = 820;

/* ── Audio cooldown — prevent per-frame audio spam ── */
var hitCooldown = 0;

/* ═══════════════════════════════════════════════════════════
   GEOMETRY
═══════════════════════════════════════════════════════════ */

function segClosest(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: x1, y: y1 };
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return { x: x1 + t * dx, y: y1 + t * dy };
}

function flipperTip(f) {
    return { x: f.x + Math.cos(f.angle) * FL_LEN,
             y: f.y + Math.sin(f.angle) * FL_LEN };
}

/* ═══════════════════════════════════════════════════════════
   COLLISIONS
═══════════════════════════════════════════════════════════ */

function collideSeg(bx, by, vx, vy, x1, y1, x2, y2) {
    var cp = segClosest(bx, by, x1, y1, x2, y2);
    var dx = bx - cp.x, dy = by - cp.y;
    var d2 = dx * dx + dy * dy;
    if (d2 > BALL_R * BALL_R) return null;
    var d  = Math.sqrt(d2) || 0.001;
    var nx = dx / d, ny = dy / d;
    var pen   = BALL_R - d;
    var vdotn = vx * nx + vy * ny;
    if (vdotn >= 0) return null;  // moving away — skip (prevents sticking)
    var rest  = 0.62;
    return {
        x: bx + nx * pen, y: by + ny * pen,
        vx: vx - (1 + rest) * vdotn * nx,
        vy: vy - (1 + rest) * vdotn * ny
    };
}

function collideBumper(b, bmp) {
    var dx = b.x - bmp.x, dy = b.y - bmp.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var min  = BALL_R + bmp.r;
    if (dist >= min) return false;
    var nx = dx / (dist || 0.001), ny = dy / (dist || 0.001);
    b.x = bmp.x + nx * min;
    b.y = bmp.y + ny * min;
    var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var out = Math.max(spd * 1.2, 320);
    b.vx = nx * out; b.vy = ny * out;
    return true;
}

function collideFlipperSeg(f) {
    var tip = flipperTip(f);
    var res = collideSeg(ball.x, ball.y, ball.vx, ball.vy, f.x, f.y, tip.x, tip.y);
    if (!res) return false;
    ball.x  = res.x;
    ball.y  = res.y;
    ball.vx = res.vx;
    ball.vy = res.vy;

    /*
       Boost when the flipper is actively swinging toward UP position.
       f.target is updated every frame to reflect the current goal.
       Left (dir=1):  UP target = FL_UP_L (-0.42), rest = FL_REST_L (0.42).
                      Swinging up → angle decreasing → angle > target.
       Right (dir=-1): UP target = FL_UP_R (3.56), rest = FL_REST_R (2.72).
                      Swinging up → angle increasing → target > angle.
    */
    var swinging = (f.dir > 0)
        ? (f.angle - f.target > 0.05)   // left:  angle above its up-target
        : (f.target - f.angle > 0.05);  // right: target above current angle

    if (swinging) {
        /* Angular-velocity-style boost: apply upward impulse based on swing speed */
        var boost = 360;
        ball.vy -= boost;
        /* Also add some horizontal push toward table center */
        if (f.dir > 0) ball.vx += 80;   // left flipper pushes right
        else           ball.vx -= 80;   // right flipper pushes left
    }
    return true;
}

/* ═══════════════════════════════════════════════════════════
   UPDATE
═══════════════════════════════════════════════════════════ */

function updateBall(dt) {
    if (!ball.active) return;

    ball.vy += GRAVITY * dt;
    ball.x  += ball.vx * dt;
    ball.y  += ball.vy * dt;

    /* speed cap */
    var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (spd > 1100) { ball.vx = ball.vx / spd * 1100; ball.vy = ball.vy / spd * 1100; }

    if (hitCooldown > 0) hitCooldown -= dt;

    /* ramp & wall collisions */
    var rampHit = false;
    for (var i = 0; i < ramps.length; i++) {
        var r   = ramps[i];
        var res = collideSeg(ball.x, ball.y, ball.vx, ball.vy, r.x1, r.y1, r.x2, r.y2);
        if (res) {
            ball.x = res.x; ball.y = res.y;
            ball.vx = res.vx; ball.vy = res.vy;
            rampHit = true;
        }
    }
    if (rampHit && hitCooldown <= 0) {
        GameAudio.hit();
        hitCooldown = 0.08;
    }

    /* slingshot collisions */
    var slingHit = false;
    for (var k = 0; k < slings.length; k++) {
        var sl  = slings[k];
        var sr  = collideSeg(ball.x, ball.y, ball.vx, ball.vy, sl.x1, sl.y1, sl.x2, sl.y2);
        if (sr) {
            ball.x = sr.x; ball.y = sr.y;
            ball.vx = sr.vx * 1.15; ball.vy = sr.vy * 1.15;  // slings add energy
            sl.lit = 10;
            slingHit = true;
            var pts = sl.score * level;
            addScore(pts);
            popups.push({ x: (sl.x1 + sl.x2) / 2, y: (sl.y1 + sl.y2) / 2 - 12, text: '+' + pts, life: 40 });
        }
    }
    if (slingHit && hitCooldown <= 0) {
        GameAudio.hit();
        hitCooldown = 0.12;
    }

    /* bumper collisions */
    var bumpHit = false;
    for (var j = 0; j < bumpers.length; j++) {
        var bmp = bumpers[j];
        if (collideBumper(ball, bmp)) {
            bumpHit = true;
            var pts = bmp.score * level;
            addScore(pts);
            bmp.lit = 14;
            popups.push({ x: bmp.x, y: bmp.y - bmp.r - 8, text: '+' + pts, life: 45 });
        }
    }
    if (bumpHit) { GameAudio.score(); }

    /* flipper collisions */
    var flipHit = collideFlipperSeg(flipperL) | collideFlipperSeg(flipperR);
    if (flipHit) GameAudio.paddle();

    /* hard canvas boundaries */
    if (ball.x - BALL_R < PLAY_L && ball.y > TOP_Y) {
        ball.x = PLAY_L + BALL_R;
        ball.vx = Math.abs(ball.vx) * 0.65;
        if (hitCooldown <= 0) { GameAudio.hit(); hitCooldown = 0.08; }
    }
    if (ball.x + BALL_R > LANE_R) {
        ball.x = LANE_R - BALL_R;
        ball.vx = -Math.abs(ball.vx) * 0.65;
        if (hitCooldown <= 0) { GameAudio.hit(); hitCooldown = 0.08; }
    }
    if (ball.y - BALL_R < TOP_Y) {
        ball.y = TOP_Y + BALL_R;
        ball.vy = Math.abs(ball.vy) * 0.65;
        if (hitCooldown <= 0) { GameAudio.hit(); hitCooldown = 0.08; }
    }

    /* drain */
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
    function step(f, targetAngle) {
        f.target = targetAngle;   // keep target in sync for boost detection
        var diff = targetAngle - f.angle;
        var s    = FL_SPEED * dt;
        f.angle  = Math.abs(diff) <= s ? targetAngle : f.angle + Math.sign(diff) * s;
    }
    step(flipperL, keys.left  ? FL_UP_L : FL_REST_L);
    step(flipperR, keys.right ? FL_UP_R : FL_REST_R);
}

/* ═══════════════════════════════════════════════════════════
   SCORE / LEVEL
═══════════════════════════════════════════════════════════ */

function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    if (mobileScore) mobileScore.textContent = 'Puntaje: ' + score + '  Vidas: ' + lives;
    var nl = Math.floor(score / 5000) + 1;
    if (nl > level) { level = nl; levelEl.textContent = level; GameAudio.win(); }
}

/* ═══════════════════════════════════════════════════════════
   GAME LIFECYCLE
═══════════════════════════════════════════════════════════ */

function resetBall() {
    ball.x = BALL_LAUNCH_X; ball.y = BALL_LAUNCH_Y;
    ball.vx = 0; ball.vy = 0; ball.active = false;
    plungerPower = 0; plungerCharging = false;
    state = STATE.LAUNCH;
}

function startGame() {
    score = 0; lives = 3; level = 1;
    scoreEl.textContent = 0; livesEl.textContent = 3; levelEl.textContent = 1;
    if (mobileScore) mobileScore.textContent = 'Puntaje: 0  Vidas: 3';
    bumpers.forEach(function (b) { b.lit = 0; });
    slings.forEach(function (s) { s.lit = 0; });
    popups = [];
    resetBall();
    startBtn.disabled = true; restartBtn.disabled = false;
    popup.style.display = 'none';
    GameAudio.start();
    if (!rafId) rafId = requestAnimationFrame(loop);
}

function endGame() {
    state = STATE.OVER;
    finalScoreEl.textContent = 'Puntaje: ' + score;
    var isNew = score > highScore;
    if (isNew) {
        highScore = score; localStorage.setItem(HS_KEY, highScore);
        highScoreEl.textContent = highScore; newRecordEl.style.display = 'block';
    } else {
        newRecordEl.style.display = 'none';
    }
    popup.style.display = 'flex';
    startBtn.disabled = false; restartBtn.disabled = true;
}

/* ═══════════════════════════════════════════════════════════
   LAUNCH
═══════════════════════════════════════════════════════════ */

function launchBall() {
    var power = Math.max(0.25, plungerPower);
    ball.vx = 0;
    ball.vy = -(700 + power * 600);   // -700 … -1300 px/s (min power reaches guide ramp)
    ball.active = true;
    plungerPower = 0; plungerCharging = false;
    state = STATE.PLAY;
    GameAudio.score();
}

/* ═══════════════════════════════════════════════════════════
   DRAW
═══════════════════════════════════════════════════════════ */

function drawBackground() {
    ctx.fillStyle = '#08001a';
    ctx.fillRect(0, 0, W, H);

    /* subtle grid */
    ctx.strokeStyle = 'rgba(80,40,120,0.12)';
    ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    /* drain zone hint */
    ctx.fillStyle = 'rgba(255,50,30,0.07)';
    ctx.fillRect(PLAY_L, FL_PIVOT_Y + 18, LANE_SEP - PLAY_L, H - FL_PIVOT_Y - 18);
    ctx.strokeStyle = 'rgba(255,80,40,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PLAY_L, FL_PIVOT_Y + 18); ctx.lineTo(LANE_SEP, FL_PIVOT_Y + 18);
    ctx.stroke();
}

function drawRamp(r) {
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2);
    ctx.strokeStyle = '#3355aa';
    ctx.lineWidth = 3;
    ctx.stroke();
}

/* Highlight guide ramp distinctly */
function drawGuideRamp() {
    ctx.beginPath();
    ctx.moveTo(LANE_R, 380); ctx.lineTo(248, TOP_Y);
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 3.5;
    ctx.stroke();
}

function drawBumper(bmp) {
    var lit = bmp.lit > 0;
    ctx.beginPath();
    ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#ff512f' : '#1a0040';
    ctx.fill();
    ctx.strokeStyle = '#cc88ff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath();
    ctx.arc(bmp.x, bmp.y, bmp.r - 5, 0, Math.PI * 2);
    ctx.strokeStyle = lit ? '#ffcc00' : '#7733cc';
    ctx.lineWidth = 1.5; ctx.stroke();
    if (lit) bmp.lit--;
}

function drawSlings() {
    for (var k = 0; k < slings.length; k++) {
        var sl  = slings[k];
        var lit = sl.lit > 0;
        ctx.beginPath();
        ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2);
        ctx.strokeStyle = lit ? '#ff8800' : '#556699';
        ctx.lineWidth = lit ? 4 : 2.5;
        ctx.stroke();
        if (lit) sl.lit--;
    }
}

function drawFlipper(f) {
    var tip   = flipperTip(f);
    var perpX = -Math.sin(f.angle), perpY = Math.cos(f.angle);
    ctx.beginPath();
    ctx.moveTo(f.x + perpX * FL_W,     f.y + perpY * FL_W);
    ctx.lineTo(f.x - perpX * FL_W,     f.y - perpY * FL_W);
    ctx.lineTo(tip.x - perpX * FL_TIP, tip.y - perpY * FL_TIP);
    ctx.lineTo(tip.x + perpX * FL_TIP, tip.y + perpY * FL_TIP);
    ctx.closePath();
    ctx.fillStyle = '#8fd3f4'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawBall() {
    var bx, by;
    if (ball.active) {
        bx = ball.x; by = ball.y;
    } else if (state === STATE.LAUNCH) {
        bx = BALL_LAUNCH_X; by = BALL_LAUNCH_Y;
    } else {
        return;
    }
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0ff'; ctx.fill();
    ctx.strokeStyle = '#aaaaff'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawPlunger() {
    if (state !== STATE.LAUNCH) return;
    var lx = LANE_SEP + 4, lw = LANE_R - LANE_SEP - 8;
    /* slot background */
    ctx.fillStyle = '#0d0020';
    ctx.fillRect(lx - 2, H - 78, lw + 4, 78);
    /* charge bar background */
    ctx.fillStyle = '#1a0040';
    ctx.fillRect(lx, H - 74, lw, 55);
    /* charge bar fill */
    var fh = 55 * plungerPower;
    ctx.fillStyle = plungerPower > 0.7 ? '#ff2200' : plungerCharging ? '#ff8800' : '#4488cc';
    ctx.fillRect(lx, H - 74 + (55 - fh), lw, fh);
    /* plunger tip */
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(lx, H - 16, lw, 10);
}

function drawScorePopups() {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (var i = popups.length - 1; i >= 0; i--) {
        var p = popups[i];
        ctx.globalAlpha = p.life / 45;
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(p.text, p.x, p.y);
        p.y -= 1.2; p.life--;
        if (p.life <= 0) popups.splice(i, 1);
    }
    ctx.globalAlpha = 1;
}

function drawUI() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('SCORE: ' + score, 8, 17);
    ctx.textAlign = 'center';
    ctx.fillText('PINBALL NEON', W / 2, 17);
    for (var i = 0; i < lives; i++) {
        ctx.beginPath();
        ctx.arc(W - 10 - i * 16, 17, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff512f'; ctx.fill();
    }
    ctx.textBaseline = 'alphabetic';
    if (state === STATE.LAUNCH) {
        ctx.fillStyle = 'rgba(143,211,244,0.9)';
        ctx.font = '12px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Mantén ESPACIO o toca der para cargar', W / 2, H - 8);
    }
}

function drawIdleScreen() {
    ctx.fillStyle = '#08001a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd3f4'; ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PINBALL', W / 2, H / 2 - 40);
    ctx.fillStyle = '#cc88ff'; ctx.font = 'bold 20px monospace';
    ctx.fillText('NEON', W / 2, H / 2);
    ctx.fillStyle = '#aaaaaa'; ctx.font = '14px monospace';
    ctx.fillText('Pulsa Iniciar para jugar', W / 2, H / 2 + 50);
    ctx.textBaseline = 'alphabetic';
}

/* ═══════════════════════════════════════════════════════════
   MAIN LOOP
═══════════════════════════════════════════════════════════ */

function loop(ts) {
    if (ts - lastTime < 15) { rafId = requestAnimationFrame(loop); return; }
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (state === STATE.IDLE || state === STATE.OVER) {
        drawIdleScreen(); rafId = requestAnimationFrame(loop); return;
    }

    if (state === STATE.PLAY) updateBall(dt);
    updateFlippers(dt);
    if (state === STATE.LAUNCH && plungerCharging) {
        plungerPower = Math.min(1, plungerPower + dt * 1.5);
    }

    drawBackground();
    for (var i = 0; i < ramps.length; i++) drawRamp(ramps[i]);
    drawGuideRamp();   // guide ramp drawn distinctly on top of ramps array
    drawSlings();
    for (var j = 0; j < bumpers.length; j++) drawBumper(bumpers[j]);
    drawFlipper(flipperL);
    drawFlipper(flipperR);
    drawBall();
    drawPlunger();
    drawScorePopups();
    drawUI();

    rafId = requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════════════════════
   INPUT — keyboard
═══════════════════════════════════════════════════════════ */

document.addEventListener('keydown', function (e) {
    switch (e.key) {
        case 'z': case 'Z': case 'ArrowLeft':
            keys.left = true; e.preventDefault(); break;
        case 'x': case 'X': case 'ArrowRight':
            keys.right = true; e.preventDefault(); break;
        case ' ':
            if (state === STATE.LAUNCH) plungerCharging = true;
            e.preventDefault(); break;
    }
});

document.addEventListener('keyup', function (e) {
    switch (e.key) {
        case 'z': case 'Z': case 'ArrowLeft':  keys.left  = false; break;
        case 'x': case 'X': case 'ArrowRight': keys.right = false; break;
        case ' ':
            if (state === STATE.LAUNCH && plungerCharging) launchBall();
            break;
    }
});

/* ── Touch: left half = left flipper, right half = right flipper / plunger ── */
var activeTouches = {};

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t  = e.changedTouches[i];
        var tx = (t.clientX - rect.left) * scaleX;
        activeTouches[t.identifier] = tx;
        if (tx < W / 2) {
            keys.left = true;
        } else {
            keys.right = true;
            if (state === STATE.LAUNCH) plungerCharging = true;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t  = e.changedTouches[i];
        var tx = activeTouches[t.identifier];
        delete activeTouches[t.identifier];
        if (tx !== undefined) {
            if (tx >= W / 2) {
                keys.right = false;
                if (state === STATE.LAUNCH && plungerCharging) launchBall();
            } else {
                keys.left = false;
            }
        }
    }
    if (Object.keys(activeTouches).length === 0) {
        keys.left = false; keys.right = false;
    }
}, { passive: false });

/* ── Buttons ── */
startBtn.addEventListener('click',    function () { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click',  function () { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click',function () { GameAudio.click(); popup.style.display = 'none'; startGame(); });

/* ── Boot ── */
highScoreEl.textContent = highScore;
lastTime = performance.now();
rafId = requestAnimationFrame(loop);

}());

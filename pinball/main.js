'use strict';
/* =========================================================
   Pinball Neón — main.js
   Canvas 400×620 (portrait, mobile-first).

   Layout:
     Play area : x = PLAY_L .. LANE_SEP   (main table)
     Plunger lane: x = LANE_SEP .. LANE_R (right vertical chute)

   Physics:
     - Semi-implicit Euler integration with gravity.
     - Ball vs. line-segment collision (closest-point + normal).
     - Ball vs. circle collision (bumpers).
     - Flipper boost = angular_velocity X r_contact (correct kinematics).
   ========================================================= */

(function () {

/* ── Canvas & Context ───────────────────────────────────── */
var canvas = document.getElementById('pinballCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 620

/* ── DOM refs ───────────────────────────────────────────── */
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

/* ── Persistence ────────────────────────────────────────── */
var HS_KEY    = 'pinball_highscore';
var highScore = GameStore.getNum(HS_KEY, 0);
highScoreEl.textContent = highScore;

/* ── Game state ─────────────────────────────────────────── */
var STATE = { IDLE: 0, LAUNCH: 1, PLAY: 2, OVER: 3 };
var state = STATE.IDLE;
var score = 0;
var lives = 3;
var level = 1;
var lastTime = 0;
var rafId = null;
var screenShake = 0;

/* ── Layout constants ───────────────────────────────────── */
var TOP_Y    = 45;          // top of play area
var BOT_Y    = H;      // floor of plunger lane
var LANE_W   = 30;          // plunger lane width
var LANE_R   = W - 10;      // x of lane right wall
var LANE_SEP = LANE_R - LANE_W; // x separator (play | lane)
var PLAY_L   = 12;          // x of left wall

/* ── Flipper constants ──────────────────────────────────── */
var FL_LEN     = 94;
var FL_W_BASE  = 11;
var FL_W_TIP   = 5;
var FL_REST    = 0.52;     // ~27° resting angle (downward)
var FL_UP      = -0.52;    // ~ -30° up angle
var FL_SPEED   = 28;       // rad/s — snappy
var FL_PIVOT_Y = H - 80;
/* Pivot separation: tips in resting position leave a ~24px gap (≥ ball
   diameter + small margin). DRAIN_GAP is the pivot-to-pivot distance, so each
   pivot sits half of it from the table centre — dividing by 1.8 instead of 2
   opened the gap to 45px, wide enough to swallow the ball down the middle. */
var FL_REST_DX = Math.cos(FL_REST) * FL_LEN;       // ~82
var DRAIN_GAP  = FL_REST_DX * 2 + 24;              // ~187 px between pivots
var TABLE_MID  = (PLAY_L + LANE_SEP) / 2;
var FL_PIVOT_LX = TABLE_MID - DRAIN_GAP / 2;
var FL_PIVOT_RX = TABLE_MID + DRAIN_GAP / 2;

/* Flipper objects.
   dir = +1 for left flipper (resting down-right, swings up-counterclockwise → angle decreases)
   dir = -1 for right flipper (resting down-left, swings up-clockwise → angle increases magnitude)
   We store mirror angle for right flipper and flip cos/sin via dir. */
var flipperL = {
    x: FL_PIVOT_LX, y: FL_PIVOT_Y,
    angle: FL_REST, target: FL_REST, prevAngle: FL_REST,
    dir: 1
};
var flipperR = {
    x: FL_PIVOT_RX, y: FL_PIVOT_Y,
    angle: FL_REST, target: FL_REST, prevAngle: FL_REST,
    dir: -1
};

/* ── Ball ───────────────────────────────────────────────── */
var BALL_R = 9;
var BALL_LAUNCH_X = LANE_SEP + LANE_W / 2;
var BALL_LAUNCH_Y = H - 38;
var ball = {
    x: BALL_LAUNCH_X, y: BALL_LAUNCH_Y,
    vx: 0, vy: 0,
    active: false,
    trail: []
};

/* ── Plunger ────────────────────────────────────────────── */
var plungerPower    = 0;
var plungerCharging = false;
var plungerY        = 0;   // visual offset (0..18)

/* ── Bumpers (circular) — positioned around table mid ──── */
var bumpers = [
    { x: TABLE_MID - 60, y: 215, r: 24, score: 100, lit: 0, color: '#ff3399', glow: '#ff66bb' },
    { x: TABLE_MID + 60, y: 215, r: 24, score: 100, lit: 0, color: '#33ddff', glow: '#88e8ff' },
    { x: TABLE_MID,      y: 295, r: 26, score: 150, lit: 0, color: '#ffcc00', glow: '#ffe066' }
];

/* ── Static walls / segments ────────────────────────────────
   Each: { x1, y1, x2, y2, kind, glow }
   kind: 'wall' | 'guide' | 'sling' (for color)
*/
var segments = [];

/* Build the table geometry ---------------------------------- */
function buildTable() {
    segments = [];
    function add(x1, y1, x2, y2, kind) {
        segments.push({ x1: x1, y1: y1, x2: x2, y2: y2, kind: kind || 'wall' });
    }

    /* ── Outer wall, traced as a polyline.
         Uses small rounded corners (3 segments) at the top corners. ── */
    var CORNER = 28;
    var WALL_TOP_Y = TOP_Y;

    /* Top wall (flat) */
    add(PLAY_L + CORNER, WALL_TOP_Y, LANE_SEP - CORNER, WALL_TOP_Y, 'wall');

    /* Top-left corner (arc) */
    var clCx = PLAY_L + CORNER, clCy = WALL_TOP_Y + CORNER;
    var CSTEPS = 6;
    for (var i = 0; i < CSTEPS; i++) {
        var a1 = -Math.PI / 2 - i * (Math.PI / 2) / CSTEPS;
        var a2 = -Math.PI / 2 - (i + 1) * (Math.PI / 2) / CSTEPS;
        add(clCx + Math.cos(a1) * CORNER, clCy + Math.sin(a1) * CORNER,
            clCx + Math.cos(a2) * CORNER, clCy + Math.sin(a2) * CORNER, 'wall');
    }

    /* Top-right corner (arc) */
    var crCx = LANE_SEP - CORNER, crCy = WALL_TOP_Y + CORNER;
    for (var j = 0; j < CSTEPS; j++) {
        var b1 = -Math.PI / 2 + j * (Math.PI / 2) / CSTEPS;
        var b2 = -Math.PI / 2 + (j + 1) * (Math.PI / 2) / CSTEPS;
        add(crCx + Math.cos(b1) * CORNER, crCy + Math.sin(b1) * CORNER,
            crCx + Math.cos(b2) * CORNER, crCy + Math.sin(b2) * CORNER, 'wall');
    }

    /* Left vertical wall (down to where slingshot starts) */
    add(PLAY_L, WALL_TOP_Y + CORNER, PLAY_L, 380, 'wall');
    /* Right vertical wall (separator with plunger lane) — starts BELOW the
       lane-exit gate so the ball can escape from lane to play area. */
    var SEPARATOR_TOP_Y = 150;
    add(LANE_SEP, SEPARATOR_TOP_Y, LANE_SEP, 380, 'wall');

    /* Connect outer wall to top of slingshot (small bridge) */
    add(PLAY_L,   380, PLAY_L + 6,   380, 'wall');
    add(LANE_SEP, 380, LANE_SEP - 6, 380, 'wall');
    /* Connect bottom of slingshot to start of funnel (small bridge) */
    add(PLAY_L,   448, PLAY_L + 8,   448, 'wall');
    add(LANE_SEP, 448, LANE_SEP - 8, 448, 'wall');

    /* ── Lower outer funnel walls (slope from sling base toward flipper pivot) ──
       Goes from the bottom-outer corner of the slingshot to the flipper pivot. */
    add(PLAY_L,   448, FL_PIVOT_LX - 14, FL_PIVOT_Y - 2, 'wall');
    add(LANE_SEP, 448, FL_PIVOT_RX + 14, FL_PIVOT_Y - 2, 'wall');

    /* ── Slingshots — triangular kickers above the flippers ── */
    var slL = {
        x1: PLAY_L + 6, y1: 380,
        x2: FL_PIVOT_LX - 26, y2: 410,   // hypotenuse facing the ball
        x3: PLAY_L + 8, y3: 448
    };
    var slR = {
        x1: LANE_SEP - 6, y1: 380,
        x2: FL_PIVOT_RX + 26, y2: 410,
        x3: LANE_SEP - 8, y3: 448
    };
    /* Hypotenuse + bottom segment (the ball can hit either) */
    add(slL.x1, slL.y1, slL.x2, slL.y2, 'sling');
    add(slL.x2, slL.y2, slL.x3, slL.y3, 'sling');
    add(slR.x1, slR.y1, slR.x2, slR.y2, 'sling');
    add(slR.x2, slR.y2, slR.x3, slR.y3, 'sling');
    slingTris = [slL, slR];

    /* ── Plunger lane walls ── */
    /* Lane separator continuation from y=380 to bottom (the upper part is added above) */
    add(LANE_SEP, 370, LANE_SEP, BOT_Y, 'wall');
    /* Lane right wall (full height) */
    add(LANE_R,   TOP_Y, LANE_R,   BOT_Y, 'wall');
    /* Lane floor */
    add(LANE_SEP, BOT_Y, LANE_R,   BOT_Y, 'wall');

    /* ── Lane ceiling: slanted guide that redirects the ball leftward ──
       Ball coming up the lane (x ≈ LANE_SEP+LANE_W/2) hits this slope and
       gets pushed toward the playfield. The slope starts at the lane
       right wall top and ends above the gate opening. */
    add(LANE_R, TOP_Y + 6, LANE_SEP, TOP_Y + 26, 'guide');

    /* ── Optional upper guide rails to deflect the ball into bumper field ── */
    add(PLAY_L + 32, 130, PLAY_L + 70, 170, 'guide');
    add(LANE_SEP - 32, 130, LANE_SEP - 70, 170, 'guide');
}
var slingTris = [];

/* ── Score popups ───────────────────────────────────────── */
var popups = [];

/* ── Particles ──────────────────────────────────────────── */
var particles = [];
function spawnParticles(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var v   = spd * (0.5 + Math.random() * 0.7);
        particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * v,
            vy: Math.sin(ang) * v,
            life: 24 + (Math.random() * 14) | 0,
            maxLife: 30,
            color: color,
            size: 1.5 + Math.random() * 2
        });
    }
}

/* ── Input ──────────────────────────────────────────────── */
var keys = { left: false, right: false };

/* ── Physics constants ──────────────────────────────────── */
var GRAVITY    = 950;     // px/s²
var DRAG_X     = 0.04;    // small horizontal drag per second
var REST       = 0.55;    // restitution for walls
var REST_GUIDE = 0.45;    // guides absorb a bit
var REST_BUMP  = 1.0;     // bumpers have stored energy → strong rebound
var MAX_SPEED  = 1200;

/* ── Audio cooldown ─────────────────────────────────────── */
var hitCooldown = 0;

/* ── Stall recovery (see updateBall) ────────────────────── */
var stallTimer  = 0;
var stallNudges = 0;

/* ── Cached gradients ───────────────────────────────────── */
var bgGrad = null;
var ballGrad = null;
function buildGradients() {
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a0420');
    bgGrad.addColorStop(0.5, '#160a3a');
    bgGrad.addColorStop(1, '#080018');

    ballGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, BALL_R);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.4, '#cfd8ff');
    ballGrad.addColorStop(1, '#5564a8');
}

/* ═══════════════════════════════════════════════════════════
   GEOMETRY
═══════════════════════════════════════════════════════════ */

function segClosest(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: x1, y: y1, t: 0 };
    var t = ((px - x1) * dx + (py - y1) * dy) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return { x: x1 + t * dx, y: y1 + t * dy, t: t };
}

/* ═══════════════════════════════════════════════════════════
   COLLISIONS
═══════════════════════════════════════════════════════════ */

function collideSegment(seg) {
    var cp = segClosest(ball.x, ball.y, seg.x1, seg.y1, seg.x2, seg.y2);
    var dx = ball.x - cp.x, dy = ball.y - cp.y;
    var d2 = dx * dx + dy * dy;
    if (d2 > BALL_R * BALL_R) return false;
    var d  = Math.sqrt(d2) || 0.0001;
    var nx = dx / d, ny = dy / d;
    var pen = BALL_R - d;
    var vdotn = ball.vx * nx + ball.vy * ny;
    if (vdotn >= 0) {
        // Already separating, just push out to avoid sticking.
        ball.x += nx * pen;
        ball.y += ny * pen;
        return false;
    }
    var rest = (seg.kind === 'guide') ? REST_GUIDE : REST;
    ball.x += nx * pen;
    ball.y += ny * pen;
    ball.vx -= (1 + rest) * vdotn * nx;
    ball.vy -= (1 + rest) * vdotn * ny;
    return true;
}

function collideBumper(bmp) {
    var dx = ball.x - bmp.x, dy = ball.y - bmp.y;
    var dist2 = dx * dx + dy * dy;
    var min = BALL_R + bmp.r;
    if (dist2 >= min * min) return false;
    var dist = Math.sqrt(dist2) || 0.0001;
    var nx = dx / dist, ny = dy / dist;
    /* push out */
    ball.x = bmp.x + nx * min;
    ball.y = bmp.y + ny * min;
    /* explicit kick away from bumper centre */
    var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    var out = Math.max(spd * REST_BUMP + 280, 380);
    if (out > 950) out = 950;
    ball.vx = nx * out;
    ball.vy = ny * out;
    return true;
}

/* World-space angle of a flipper.
   We store f.angle as a "swing parameter" in [FL_UP, FL_REST]:
     - left flipper:  worldAngle = f.angle           (resting tilts down-right)
     - right flipper: worldAngle = π - f.angle       (resting tilts down-left, mirror)
*/
function flipperWorldAngle(f) {
    return f.dir > 0 ? f.angle : (Math.PI - f.angle);
}

function flipperTip(f) {
    var a = flipperWorldAngle(f);
    return { x: f.x + Math.cos(a) * FL_LEN, y: f.y + Math.sin(a) * FL_LEN };
}

/* Flipper vs ball — capsule collision.
   Boost is computed from the angular velocity of the flipper at the contact point:
       v_contact = omega × r_contact   (2D cross product)
   This is the physically correct way to transfer flipper energy into the ball. */
function collideFlipper(f, dt) {
    var tip = flipperTip(f);
    var cp = segClosest(ball.x, ball.y, f.x, f.y, tip.x, tip.y);
    var dx = ball.x - cp.x, dy = ball.y - cp.y;
    var d2 = dx * dx + dy * dy;
    /* Capsule radius matches the visual line width (FL_W_BASE) */
    var capR = FL_W_BASE;
    var minD = BALL_R + capR;
    if (d2 > minD * minD) return false;
    var d  = Math.sqrt(d2) || 0.0001;
    var nx = dx / d, ny = dy / d;
    var pen = minD - d;

    /* Angular velocity in WORLD space.
       For right flipper, world angle = π - f.angle, so worldOmega = -(f.angle - f.prevAngle). */
    var localOmega = (f.angle - f.prevAngle) / Math.max(dt, 0.0001);
    var worldOmega = f.dir > 0 ? localOmega : -localOmega;

    /* Tangential velocity at contact: v = (−ry, rx) · ω  (CCW positive) */
    var rx = cp.x - f.x, ry = cp.y - f.y;
    var contactVx = -ry * worldOmega;
    var contactVy =  rx * worldOmega;

    /* Push ball out of penetration */
    ball.x += nx * pen;
    ball.y += ny * pen;

    /* Relative velocity along normal */
    var rvx = ball.vx - contactVx;
    var rvy = ball.vy - contactVy;
    var rdotn = rvx * nx + rvy * ny;

    if (rdotn < 0) {
        var restF = 0.45;
        var jn = -(1 + restF) * rdotn;
        ball.vx += jn * nx;
        ball.vy += jn * ny;

        /* Detect that flipper is swinging UP this frame.
           In our local-angle convention, "up" means angle decreases (FL_REST → FL_UP),
           i.e. localOmega < 0. */
        var swingingUp = localOmega < -3.0;
        if (swingingUp) {
            /* Extra kick proportional to omega magnitude — clamp so it never feels broken. */
            var kickMag = Math.min(Math.abs(worldOmega) * 18, 720);
            /* Kick direction: along the flipper's outward (perpendicular) normal,
               which is roughly (nx, ny) at the contact point. */
            ball.vx += nx * kickMag * 0.55;
            ball.vy += ny * kickMag * 0.55;
            /* Bias toward upward + table center */
            ball.vy -= kickMag * 0.45;
            ball.vx += (f.dir > 0 ? 1 : -1) * kickMag * 0.18;
        }
    }

    /* Speed cap */
    var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (spd > MAX_SPEED) {
        ball.vx = ball.vx / spd * MAX_SPEED;
        ball.vy = ball.vy / spd * MAX_SPEED;
    }
    return true;
}

/* ═══════════════════════════════════════════════════════════
   UPDATE
═══════════════════════════════════════════════════════════ */

function updateBall(dt) {
    if (!ball.active) return;

    if (hitCooldown > 0) hitCooldown -= dt;

    /* Sub-step integration: split each frame into 3 steps so the ball
       never jumps past a thin wall in a single frame at high speed. */
    var SUBSTEPS = 3;
    var sdt = dt / SUBSTEPS;

    var hitSegAny = false;
    var slingData = null;   // { mx, my } of first sling hit this frame
    var bumperHit = -1;     // index of first bumper hit this frame
    var flipHit   = false;

    for (var step = 0; step < SUBSTEPS; step++) {
        /* Advance the flippers inside the sub-step so that the angle delta
           collideFlipper divides by sdt really is one sub-step's worth. Stepping
           them once per frame instead made omega read 3x too high, which pinned
           the kick at its clamp and removed any control over shot strength. */
        updateFlippers(sdt);

        /* Integrate */
        ball.vy += GRAVITY * sdt;
        ball.vx *= (1 - DRAG_X * sdt);
        ball.x  += ball.vx * sdt;
        ball.y  += ball.vy * sdt;

        /* Speed cap */
        var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (spd > MAX_SPEED) {
            ball.vx = ball.vx / spd * MAX_SPEED;
            ball.vy = ball.vy / spd * MAX_SPEED;
        }

        /* ── Segments (walls, guides, slings) ── */
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (collideSegment(s)) {
                hitSegAny = true;
                if (s.kind === 'sling') {
                    var snx = -(s.y2 - s.y1), sny = (s.x2 - s.x1);
                    var snlen = Math.sqrt(snx * snx + sny * sny) || 0.0001;
                    snx /= snlen; sny /= snlen;
                    var smx = (s.x1 + s.x2) / 2, smy = (s.y1 + s.y2) / 2;
                    if ((ball.x - smx) * snx + (ball.y - smy) * sny < 0) { snx = -snx; sny = -sny; }
                    ball.vx += snx * 480;
                    ball.vy += sny * 480;
                    if (!slingData) slingData = { mx: smx, my: smy };
                }
            }
        }

        /* ── Bumpers ── */
        for (var j = 0; j < bumpers.length; j++) {
            if (collideBumper(bumpers[j]) && bumperHit < 0) bumperHit = j;
        }

        /* ── Flippers ── */
        if (collideFlipper(flipperL, sdt)) flipHit = true;
        if (collideFlipper(flipperR, sdt)) flipHit = true;
    }

    /* Trail (once per frame) */
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();

    /* ── Audio & scoring (once per frame, not per substep) ── */
    if (hitSegAny && hitCooldown <= 0) {
        GameAudio.hit();
        hitCooldown = 0.06;
    }
    if (slingData) {
        screenShake = Math.max(screenShake, 4);
        addScore(50 * level);
        popups.push({ x: slingData.mx, y: slingData.my - 14, text: '+' + (50 * level), life: 40 });
        spawnParticles(slingData.mx, slingData.my, '#ffaa44', 10, 200);
    }
    if (bumperHit >= 0) {
        var bmp = bumpers[bumperHit];
        var pts = bmp.score * level;
        addScore(pts);
        bmp.lit = 18;
        popups.push({ x: bmp.x, y: bmp.y - bmp.r - 8, text: '+' + pts, life: 45 });
        spawnParticles(bmp.x, bmp.y, bmp.glow, 14, 240);
        screenShake = Math.max(screenShake, 5);
        GameAudio.score();
    }
    if (flipHit) GameAudio.paddle();

    /* ── Stall / trapped-ball recovery ────────────────────────────────────
       The plunger lane is closed at the bottom, so a ball that comes to rest
       in it can never drain and the game locks up with no way out but
       Reiniciar. The ball can end up there from a weak shot or by rolling back
       in from the playfield, so this net is needed on top of the launch floor.
       Holding a flipper is excluded so that cradling the ball still works. */
    var curSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    var inLane = ball.x > LANE_SEP;
    if (curSpd < 45 && (inLane || !(keys.left || keys.right))) stallTimer += dt;
    else stallTimer = 0;

    if (stallTimer > 2.0) {
        stallTimer = 0;
        if (inLane) {
            /* Hand it back to the shooter, as a real machine does — no life lost. */
            stallNudges = 0;
            resetBall();
            return;
        }
        stallNudges++;
        if (stallNudges >= 3) {
            /* Wedged somewhere on the table: give up and drain it rather than
               leaving the player stuck. */
            stallNudges = 0;
            ball.y = H + BALL_R + 8;
        } else {
            ball.vy = -260;
            ball.vx += (ball.x < TABLE_MID ? 1 : -1) * 130;
            screenShake = Math.max(screenShake, 3);
        }
    }

    /* ── Drain detection ── */
    if (ball.y - BALL_R > H + 4) {
        ball.active = false;
        ball.trail.length = 0;
        lives--;
        livesEl.textContent = lives;
        if (mobileScore) mobileScore.textContent = 'Puntaje: ' + score + '  Vidas: ' + lives;
        if (lives <= 0) {
            GameAudio.gameOver();
            setTimeout(endGame, 400);
        } else {
            GameAudio.miss();
            state = STATE.LAUNCH;
            setTimeout(resetBall, 500);
        }
    }
}

function updateFlippers(dt) {
    function step(f, targetAngle) {
        f.prevAngle = f.angle;
        f.target = targetAngle;
        var diff = targetAngle - f.angle;
        var s    = FL_SPEED * dt;
        if (Math.abs(diff) <= s) f.angle = targetAngle;
        else f.angle += (diff > 0 ? 1 : -1) * s;
    }
    step(flipperL, keys.left  ? FL_UP : FL_REST);
    step(flipperR, keys.right ? FL_UP : FL_REST);
}

function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 200 * 0.016;
        p.vx *= 0.96;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

/* ═══════════════════════════════════════════════════════════
   SCORE / LEVEL
═══════════════════════════════════════════════════════════ */

function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    if (mobileScore) mobileScore.textContent = 'Puntaje: ' + score + '  Vidas: ' + lives;
    var nl = Math.floor(score / 5000) + 1;
    if (nl > level) {
        level = nl;
        levelEl.textContent = level;
        GameAudio.win();
    }
}

/* ═══════════════════════════════════════════════════════════
   GAME LIFECYCLE
═══════════════════════════════════════════════════════════ */

function resetBall() {
    ball.x = BALL_LAUNCH_X; ball.y = BALL_LAUNCH_Y;
    ball.vx = 0; ball.vy = 0;
    ball.active = false;
    ball.trail.length = 0;
    plungerPower = 0; plungerCharging = false; plungerY = 0;
    stallTimer = 0; stallNudges = 0;
    state = STATE.LAUNCH;
}

function startGame() {
    score = 0; lives = 3; level = 1;
    scoreEl.textContent = 0; livesEl.textContent = 3; levelEl.textContent = 1;
    if (mobileScore) mobileScore.textContent = 'Puntaje: 0  Vidas: 3';
    bumpers.forEach(function (b) { b.lit = 0; });
    popups = [];
    particles = [];
    screenShake = 0;
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
        highScore = score;
        GameStore.set(HS_KEY, highScore);
        highScoreEl.textContent = highScore;
        newRecordEl.style.display = 'block';
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
    var power = Math.max(0.18, plungerPower);
    ball.x = BALL_LAUNCH_X;
    ball.y = BALL_LAUNCH_Y;
    ball.vx = 0;
    /* The lane is a closed chute: a shot that fails to reach the ceiling guide
       falls back and there is no drain down there to end the ball. The floor of
       this range must therefore always clear the guide — reaching it needs
       ~980 px/s (rise of 511 px against GRAVITY), so 1020 leaves a margin.
       The ceiling is MAX_SPEED, since anything above it is clamped away on the
       first sub-step and the top of the charge meter would do nothing. */
    ball.vy = -(1020 + power * (MAX_SPEED - 1020)); // -1020..-1200
    ball.active = true;
    ball.trail.length = 0;
    plungerPower = 0; plungerCharging = false; plungerY = 0;
    state = STATE.PLAY;
    GameAudio.shoot();
}

/* ═══════════════════════════════════════════════════════════
   DRAW
═══════════════════════════════════════════════════════════ */

function drawBackground() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* Subtle grid */
    ctx.strokeStyle = 'rgba(120,80,200,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < W; x += 30) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (var y = 0; y < H; y += 30) {
        ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    /* Drain hint */
    ctx.fillStyle = 'rgba(255,80,40,0.06)';
    ctx.fillRect(FL_PIVOT_LX, FL_PIVOT_Y + 8, FL_PIVOT_RX - FL_PIVOT_LX, H - FL_PIVOT_Y - 8);

    /* Soft glow on the bottom rim */
    ctx.fillStyle = 'rgba(255,60,30,0.12)';
    ctx.fillRect(FL_PIVOT_LX, BOT_Y - 4, FL_PIVOT_RX - FL_PIVOT_LX, 4);
}

function drawSegments() {
    /* Group by kind to batch state changes */
    /* Walls */
    ctx.strokeStyle = '#5577cc';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        if (s.kind === 'wall') { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
    }
    ctx.stroke();

    /* Guides (cyan) */
    ctx.strokeStyle = '#44ddff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var k = 0; k < segments.length; k++) {
        var g = segments[k];
        if (g.kind === 'guide') { ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); }
    }
    ctx.stroke();
}

function drawSlings() {
    /* Filled triangles for slingshots */
    for (var i = 0; i < slingTris.length; i++) {
        var t = slingTris[i];
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.lineTo(t.x3, t.y3);
        ctx.closePath();
        ctx.fillStyle = '#2a1050';
        ctx.fill();
        ctx.strokeStyle = '#ff8844';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
}

function drawBumpers() {
    /* Lit ring (only for active bumpers — uses shadowBlur but only on a few) */
    for (var i = 0; i < bumpers.length; i++) {
        var b = bumpers[i];
        var litRatio = b.lit / 18;
        /* outer ring */
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = b.glow;
        ctx.lineWidth = 2;
        ctx.shadowColor = b.glow;
        ctx.shadowBlur = 12 + litRatio * 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
        /* body */
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        /* inner highlight */
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + litRatio * 0.6) + ')';
        ctx.fill();
        /* lit flash overlay */
        if (b.lit > 0) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + (litRatio * 0.4) + ')';
            ctx.fill();
            b.lit--;
        }
    }
}

function drawFlipper(f) {
    var tip = flipperTip(f);
    /* Body: a thick line (capsule) using lineCap=round */
    ctx.lineCap = 'round';
    ctx.shadowColor = '#8fd3f4';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = FL_W_BASE * 2;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    /* white outline highlight */
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    /* pivot stud */
    ctx.beginPath();
    ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawBallTrail() {
    if (!ball.active || ball.trail.length === 0) return;
    var n = ball.trail.length;
    for (var i = 0; i < n; i++) {
        var t = ball.trail[i];
        var a = (i + 1) / n * 0.4;
        var r = BALL_R * (i + 1) / n;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#aac8ff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawBall() {
    var bx, by;
    if (ball.active) { bx = ball.x; by = ball.y; }
    else if (state === STATE.LAUNCH) { bx = BALL_LAUNCH_X; by = BALL_LAUNCH_Y - plungerY; }
    else return;

    ctx.save();
    ctx.translate(bx, by);
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = '#aac8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    /* highlight */
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(-2.5, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawPlunger() {
    if (state !== STATE.LAUNCH && state !== STATE.PLAY) return;
    var lx = LANE_SEP + 6;
    var lw = LANE_W - 12;
    var baseY = BOT_Y - 2;
    /* lane background tint */
    ctx.fillStyle = 'rgba(255,60,30,0.05)';
    ctx.fillRect(LANE_SEP + 1, TOP_Y, LANE_W - 1, BOT_Y - TOP_Y);

    if (state !== STATE.LAUNCH) return;

    /* shaft */
    ctx.fillStyle = '#1a0838';
    ctx.fillRect(lx, baseY - 80, lw, 80);
    /* charge fill */
    var fh = 70 * plungerPower;
    var col = plungerPower > 0.7 ? '#ff3333' : (plungerCharging ? '#ff9933' : '#3388ff');
    ctx.fillStyle = col;
    ctx.fillRect(lx, baseY - 6 - fh, lw, fh);
    /* plunger head */
    ctx.fillStyle = '#8fd3f4';
    ctx.fillRect(lx - 2, baseY - 6 + plungerY * 0.5, lw + 4, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx - 2, baseY - 6 + plungerY * 0.5, lw + 4, 8);
}

function drawScorePopups() {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (var i = popups.length - 1; i >= 0; i--) {
        var p = popups[i];
        ctx.globalAlpha = p.life / 45;
        ctx.fillStyle = '#ffe066';
        ctx.fillText(p.text, p.x, p.y);
        p.y -= 1.2; p.life--;
        if (p.life <= 0) popups.splice(i, 1);
    }
    ctx.globalAlpha = 1;
}

function drawParticles() {
    /* batch by avoiding shadowBlur in loop */
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawUI() {
    /* Top header bar */
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('SCORE: ' + score, 8, 18);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cc88ff';
    ctx.fillText('LV ' + level, W / 2, 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('BEST ' + highScore, W - 8, 18);

    /* Lives indicator (small balls) */
    for (var i = 0; i < lives; i++) {
        ctx.beginPath();
        ctx.arc(20 + i * 14, 32, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff512f';
        ctx.fill();
    }

    ctx.textBaseline = 'alphabetic';

    /* Hints */
    if (state === STATE.LAUNCH) {
        ctx.fillStyle = 'rgba(143,211,244,0.95)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Mantén ESPACIO o desliza abajo para cargar', W / 2, H - 4);
    }
}

function drawIdleScreen() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* Title */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff66cc';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('PINBALL', W / 2, H / 2 - 50);
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#44ddff';
    ctx.fillStyle = '#ff66cc';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('NEÓN', W / 2, H / 2 - 12);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aabbdd';
    ctx.font = '14px monospace';
    ctx.fillText('Pulsa Iniciar para jugar', W / 2, H / 2 + 36);
    ctx.fillStyle = '#778899';
    ctx.font = '11px monospace';
    ctx.fillText('Z / X — flippers   |   Espacio — lanzar', W / 2, H / 2 + 60);

    ctx.textBaseline = 'alphabetic';
}

/* ═══════════════════════════════════════════════════════════
   MAIN LOOP
═══════════════════════════════════════════════════════════ */

function loop(ts) {
    if (ts - lastTime < 15) { rafId = requestAnimationFrame(loop); return; }
    var dt = Math.min((ts - lastTime) / 1000, 0.033);
    lastTime = ts;

    if (state === STATE.IDLE || state === STATE.OVER) {
        drawIdleScreen();
        rafId = requestAnimationFrame(loop);
        return;
    }

    /* Updates — during play the flippers are stepped inside updateBall's
       sub-step loop, so only drive them here when the ball is not in play. */
    if (state === STATE.PLAY) updateBall(dt);
    else updateFlippers(dt);
    if (state === STATE.LAUNCH && plungerCharging) {
        plungerPower = Math.min(1, plungerPower + dt * 1.4);
        plungerY = plungerPower * 18;
    } else if (state === STATE.LAUNCH) {
        if (plungerY > 0) plungerY = Math.max(0, plungerY - dt * 80);
    }
    updateParticles();

    /* Draw with screen shake offset */
    var sx = 0, sy = 0;
    if (screenShake > 0) {
        sx = (Math.random() - 0.5) * screenShake;
        sy = (Math.random() - 0.5) * screenShake;
        screenShake -= 0.4;
        if (screenShake < 0) screenShake = 0;
    }
    if (sx !== 0 || sy !== 0) {
        ctx.save();
        ctx.translate(sx, sy);
    }

    drawBackground();
    drawPlunger();
    drawSegments();
    drawSlings();
    drawBumpers();
    drawFlipper(flipperL);
    drawFlipper(flipperR);
    drawBallTrail();
    drawBall();
    drawParticles();
    drawScorePopups();
    drawUI();

    if (sx !== 0 || sy !== 0) ctx.restore();

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

/* ── Touch controls ────────────────────────────────────────
   Layout (canvas-relative):
     - Bottom 28% of canvas: left third = left flipper, right third = right flipper,
       middle third = plunger (hold to charge, release to launch)
     - Anywhere else: left half = left flipper, right half = right flipper
*/
var activeTouches = {};

function touchZone(tx, ty) {
    /* The plunger only exists while waiting to shoot. Claiming the middle of the
       bottom band during play would leave a dead strip right where a thumb
       lands, with no flipper response. */
    if (state === STATE.LAUNCH && ty > H * 0.72) {
        if (tx < W / 3) return 'L';
        if (tx > W * 2 / 3) return 'R';
        return 'P';
    }
    return tx < W / 2 ? 'L' : 'R';
}

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var sx = W / rect.width;
    var sy = H / rect.height;
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t  = e.changedTouches[i];
        var tx = (t.clientX - rect.left) * sx;
        var ty = (t.clientY - rect.top)  * sy;
        var z  = touchZone(tx, ty);
        activeTouches[t.identifier] = z;
        if (z === 'L') keys.left = true;
        else if (z === 'R') keys.right = true;
        else if (z === 'P' && state === STATE.LAUNCH) plungerCharging = true;
    }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var z = activeTouches[t.identifier];
        delete activeTouches[t.identifier];
        if (z === 'L') keys.left  = anyTouchInZone('L');
        else if (z === 'R') keys.right = anyTouchInZone('R');
        else if (z === 'P') {
            if (state === STATE.LAUNCH && plungerCharging) launchBall();
        }
    }
    if (Object.keys(activeTouches).length === 0) {
        keys.left = false; keys.right = false;
    }
}, { passive: false });

canvas.addEventListener('touchcancel', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
        delete activeTouches[e.changedTouches[i].identifier];
    }
    keys.left = anyTouchInZone('L');
    keys.right = anyTouchInZone('R');
}, { passive: false });

function anyTouchInZone(z) {
    for (var k in activeTouches) {
        if (activeTouches[k] === z) return true;
    }
    return false;
}

/* ── Buttons ── */
startBtn.addEventListener('click',    function () { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click',  function () { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click',function () { GameAudio.click(); popup.style.display = 'none'; startGame(); });

/* ── Boot ── */
buildTable();
buildGradients();
highScoreEl.textContent = highScore;
lastTime = performance.now();
rafId = requestAnimationFrame(loop);

}());

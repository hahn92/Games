// Endless Runner — animaciones completas + variedad de obstáculos + crouch + progresión
var canvas = document.getElementById('runnerCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;   // 600
var HEIGHT = canvas.height;  // 200

var GRAVITY     = 0.72;
var JUMP_FORCE  = -9.9;
var GROUND_Y    = 155;
var PLAYER_SIZE = 36;
var CROUCH_H    = 20;   // altura dino agachado
var PLAYER_SPEED = 4;
var PLAYER_MIN_X = 20;
var PLAYER_MAX_X = 320;

// Game state
var player = {};
var obstacles = [];
var dustParticles = [];
var milestoneMsg = null;   // { text, alpha, y }
var SPEED = 4;
var frame = 0;
var score = 0;
var highScore = parseInt(localStorage.getItem('runnerHighScore') || '0', 10);
var isPlaying = false;
var isDying   = false;
var isCrouching = false;
var animFrameId = null;
var nextObstacle = 90;
var keys = {};

// Animation state
var animTick    = 0;
var blinkTimer  = 100;
var squishX     = 1;
var squishY     = 1;
var wasOnGround = true;
var deathAngle  = 0;
var deathVY     = 0;
var screenShake = 0;

// Milestone
var lastMilestone = 0;

// Background system
var bgX     = 0;
var bgStars = [];

var BG_THEMES = [
    // 0: Día
    { s0:'#1a5fa5', s1:'#5ab0e8', s2:'#9dd4f5',
      mF:'#7ab0a0', mM:'#4a8a60', mN:'#2a6040',
      g0:'#68c46a', g1:'#52a854', g2:'#7a5218', g3:'#5c3d10',
      cRGB:'255,255,255', cA:0.92, sun:true,  sunCol:'#ffe066', stars:false },
    // 1: Tarde
    { s0:'#28569a', s1:'#6aaad8', s2:'#b0d8f0',
      mF:'#90b0a8', mM:'#6a9878', mN:'#486858',
      g0:'#70cc72', g1:'#5ab85c', g2:'#8a5c20', g3:'#6a4010',
      cRGB:'255,255,255', cA:0.88, sun:true,  sunCol:'#ffd044', stars:false },
    // 2: Atardecer
    { s0:'#b03828', s1:'#e07038', s2:'#f5c060',
      mF:'#705888', mM:'#502868', mN:'#301848',
      g0:'#8a7030', g1:'#705820', g2:'#583010', g3:'#3a1808',
      cRGB:'255,210,160', cA:0.75, sun:true,  sunCol:'#ff7722', stars:false },
    // 3: Crepúsculo
    { s0:'#100830', s1:'#281850', s2:'#502870',
      mF:'#302050', mM:'#1a1038', mN:'#0e0820',
      g0:'#201018', g1:'#180c10', g2:'#100810', g3:'#08060a',
      cRGB:'180,150,220', cA:0.45, sun:false, sunCol:'', stars:true  },
    // 4: Noche
    { s0:'#040620', s1:'#080e38', s2:'#101850',
      mF:'#121830', mM:'#080e1e', mN:'#040810',
      g0:'#0c100a', g1:'#080c08', g2:'#060806', g3:'#040604',
      cRGB:'140,160,210', cA:0.28, sun:false, sunCol:'', stars:true  },
];

// Clouds (parallax)
var clouds = [
    { x: 100, y: 28, w: 64, h: 22, speed: 0.22, type: 0 },
    { x: 310, y: 46, w: 80, h: 26, speed: 0.18, type: 1 },
    { x: 520, y: 22, w: 52, h: 18, speed: 0.28, type: 2 },
];

// ─── OBSTACLE TYPES ─────────────────────────────────────────
// type 0: cactus alto  (normal, saltar)
// type 1: cactus bajo  (pequeño, saltar O agacharse)
// type 2: pájaro volador (media altura, SOLO agacharse)

function makeCactus(xOff, tall) {
    var w = tall ? (18 + Math.random() * 12) : (12 + Math.random() * 8);
    var h = tall ? (34 + Math.random() * 28) : (14 + Math.random() * 14);
    return { x: WIDTH + xOff, width: w, height: h, type: tall ? 0 : 1 };
}
function makeBird(xOff) {
    return { x: WIDTH + xOff, width: 38, height: 22, type: 2, flapTick: 0, flyY: GROUND_Y - 3 };
}

function spawnObstacle() {
    var roll = Math.random();
    if (roll < 0.28) {
        // cactus alto solo
        obstacles.push(makeCactus(0, true));
    } else if (roll < 0.50) {
        // cactus bajo solo
        obstacles.push(makeCactus(0, false));
    } else if (roll < 0.66) {
        // pájaro
        obstacles.push(makeBird(0));
    } else if (roll < 0.82) {
        // cluster doble: alto + bajo (o bajo + alto)
        var c1 = makeCactus(0, Math.random() < 0.5);
        obstacles.push(c1);
        obstacles.push(makeCactus(c1.width + 22 + Math.random() * 16, Math.random() < 0.5));
    } else if (roll < 0.92) {
        // pájaro + cactus bajo detrás
        obstacles.push(makeBird(0));
        obstacles.push(makeCactus(60 + Math.random() * 20, false));
    } else {
        // triple cactus bajos
        var ox = 0;
        for (var ci = 0; ci < 3; ci++) {
            var c = makeCactus(ox, false);
            obstacles.push(c);
            ox += c.width + 14 + Math.random() * 8;
        }
    }
}

// ─── JUMP / CROUCH ──────────────────────────────────────────
function jump() {
    if (!isPlaying || isDying) return;
    if (player.onGround && !isCrouching) {
        player.vy = JUMP_FORCE;
        player.onGround = false;
        squishX = 0.75;
        squishY = 1.35;
        spawnDustBurst();
        GameAudio.jump();
    }
}

function checkJumpKeys() {
    if (keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W']) jump();
}

function checkCrouchKeys() {
    isCrouching = !!(keys['ArrowDown'] || keys['s'] || keys['S']) && player.onGround;
}

// ─── PLAYER UPDATE ─────────────────────────────────────────
function updatePlayer() {
    // Movimiento lateral: control total en el suelo, inercia en el aire
    if (player.onGround) {
        player.vx = 0;
        if (keys['ArrowLeft']  || keys['a'] || keys['A']) player.vx = -PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) player.vx =  PLAYER_SPEED;
        player.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, player.x + player.vx));
    } else {
        // En el aire: mantiene inercia, pequeña corrección permitida
        if (keys['ArrowLeft']  || keys['a'] || keys['A']) player.vx = Math.max(-PLAYER_SPEED, player.vx - 0.4);
        if (keys['ArrowRight'] || keys['d'] || keys['D']) player.vx = Math.min( PLAYER_SPEED, player.vx + 0.4);
        player.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, player.x + player.vx));
    }

    checkCrouchKeys();

    player.vy += GRAVITY;
    player.y  += player.vy;

    if (player.y >= GROUND_Y) {
        if (!player.onGround) {
            squishX = 1.4;
            squishY = 0.6;
            spawnDustBurst();
        }
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
    }

    squishX += (1 - squishX) * 0.18;
    squishY += (1 - squishY) * 0.18;

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
    if (frame % 10 === 0 && player.onGround && !isCrouching) {
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
        if (obstacles[i].type === 2) obstacles[i].flapTick++;
        if (obstacles[i].x + obstacles[i].width < 0) obstacles.splice(i, 1);
    }
}

function drawObstacles() {
    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (o.type === 0 || o.type === 1) {
            drawCactus(o);
        } else if (o.type === 2) {
            drawBird(o);
        }
    }
}

function drawCactus(o) {
    var oy = GROUND_Y + PLAYER_SIZE - o.height;
    ctx.save();
    ctx.translate(o.x, oy);

    var w = o.width, h = o.height;

    function cactusSegment(sx, sy, sw, sh, lit) {
        var g = ctx.createLinearGradient(sx, sy, sx + sw, sy);
        g.addColorStop(0, lit ? '#388e3c' : '#2e7d32');
        g.addColorStop(0.4, lit ? '#43a047' : '#388e3c');
        g.addColorStop(1, '#1b5e20');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, sw * 0.45);
        ctx.fill();
        // top shine
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.roundRect(sx + sw*0.2, sy + 2, sw*0.3, sh*0.25, sw*0.15); ctx.fill();
        // dark right edge
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.roundRect(sx + sw*0.72, sy + 2, sw*0.2, sh - 4, sw*0.1); ctx.fill();
    }

    // Main trunk
    cactusSegment(0, 0, w, h, true);

    if (o.type === 0) {
        var armY = h * 0.35;
        var armH = Math.max(6, h * 0.28);
        var armW = Math.max(5, w * 0.55);
        // Left arm (horizontal + vertical tip)
        cactusSegment(-armW + 2, armY, armW, w * 0.8, false);
        cactusSegment(-armW + 2, armY - armH, w * 0.8, armH + w * 0.8, false);
        // Right arm
        cactusSegment(w - 2, armY + h * 0.1, armW - 2, w * 0.8, true);
        cactusSegment(w - 2, armY + h * 0.1 - armH * 0.7, w * 0.8, armH * 0.7 + w * 0.8, true);
    }

    // Spines (small dots of light)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (var si = 0; si < 4; si++) {
        ctx.beginPath(); ctx.arc(w * 0.18, h * 0.15 + si * h * 0.2, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.82, h * 0.25 + si * h * 0.18, 1.2, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
}

function drawBird(o) {
    var bx = o.x + o.width / 2;
    var by = o.flyY;
    var flapAngle = Math.sin(o.flapTick * 0.35) * 0.55; // smooth continuous flap

    ctx.save();
    ctx.translate(bx, by);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 18, 18, 4, 0, 0, Math.PI*2); ctx.fill();

    // Wing (animated with rotation)
    ctx.save();
    ctx.rotate(flapAngle);
    var wg = ctx.createLinearGradient(-18, 0, 0, 0);
    wg.addColorStop(0, '#6d4c41'); wg.addColorStop(1, '#8d6e63');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.bezierCurveTo(-8, -5, -16, -3, -20, 2);
    ctx.bezierCurveTo(-18, 6, -10, 7, -4, 5);
    ctx.bezierCurveTo(-2, 4, -1, 2, -2, -2);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Body
    var bg = ctx.createRadialGradient(-3, -2, 1, 0, 0, 14);
    bg.addColorStop(0, '#8d6e63'); bg.addColorStop(1, '#4e342e');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.bezierCurveTo(-14, -5, -8, -8, 0, -8);
    ctx.bezierCurveTo(8, -8, 14, -4, 14, 0);
    ctx.bezierCurveTo(14, 4, 8, 8, 0, 8);
    ctx.bezierCurveTo(-8, 8, -14, 5, -14, 0);
    ctx.closePath(); ctx.fill();

    // Tail feathers
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.moveTo(-12, -2); ctx.bezierCurveTo(-18, -5, -24, -4, -26, -1);
    ctx.bezierCurveTo(-24, 1, -18, 3, -12, 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.bezierCurveTo(-17, -3, -22, -1, -24, 1);
    ctx.bezierCurveTo(-22, 3, -16, 3, -12, 1);
    ctx.closePath(); ctx.fill();

    // Head
    var hg = ctx.createRadialGradient(12, -6, 1, 12, -6, 8);
    hg.addColorStop(0, '#8d6e63'); hg.addColorStop(1, '#4e342e');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(12, -5, 8, 0, Math.PI*2); ctx.fill();

    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -7, 2.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15.6, -7.2, 1.6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(16.2, -7.8, 0.7, 0, Math.PI*2); ctx.fill();

    // Beak
    ctx.fillStyle = '#f57f17';
    ctx.beginPath();
    ctx.moveTo(18, -5); ctx.bezierCurveTo(22, -4, 27, -3, 27, -2);
    ctx.bezierCurveTo(26, -1, 21, -1, 18, -2);
    ctx.closePath(); ctx.fill();
    // Beak lower
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.moveTo(18, -2); ctx.bezierCurveTo(21, -1, 25, -1, 25, 0);
    ctx.bezierCurveTo(23, 1, 19, 1, 18, 0);
    ctx.closePath(); ctx.fill();

    ctx.restore();
}

function updateClouds() {
    for (var i = 0; i < clouds.length; i++) {
        clouds[i].x -= SPEED * clouds[i].speed;
        if (clouds[i].x + clouds[i].w < 0) {
            clouds[i].x = WIDTH + 20 + Math.random() * 80;
            clouds[i].y = 10 + Math.random() * 55;
            clouds[i].w = 40 + Math.random() * 64;
            clouds[i].h = 16 + Math.random() * 24;
            clouds[i].type = Math.floor(Math.random() * 3);
        }
    }
}

// ─── COLLISION ─────────────────────────────────────────────
function checkCollision() {
    var margin = 7;
    // Hitbox changes when crouching
    var ph = isCrouching ? CROUCH_H : (PLAYER_SIZE - margin * 2);
    var py = isCrouching ? (GROUND_Y + PLAYER_SIZE - CROUCH_H) : (player.y + margin);
    var px = player.x + margin;
    var pw = PLAYER_SIZE - margin * 2;

    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (o.type === 0 || o.type === 1) {
            var ox = o.x, oy = GROUND_Y + PLAYER_SIZE - o.height;
            if (px < ox + o.width && px + pw > ox && py < oy + o.height && py + ph > oy)
                return true;
        } else if (o.type === 2) {
            // Bird hitbox
            var bx = o.x, bby = o.flyY - 10, bw = o.width, bh = 20;
            if (px < bx + bw && px + pw > bx && py < bby + bh && py + ph > bby)
                return true;
        }
    }
    return false;
}

// ─── MILESTONE ─────────────────────────────────────────────
function checkMilestone() {
    var m = Math.floor(score / 100) * 100;
    if (m > 0 && m !== lastMilestone) {
        lastMilestone = m;
        milestoneMsg = { text: '+VELOCIDAD! x' + m, alpha: 1.0, y: HEIGHT / 2 - 20 };
        GameAudio.scoreHigh();
    }
    if (milestoneMsg) {
        milestoneMsg.alpha -= 0.018;
        milestoneMsg.y -= 0.4;
        if (milestoneMsg.alpha <= 0) milestoneMsg = null;
    }
}

// ─── BACKGROUND HELPERS ────────────────────────────────────
function getBgTheme() {
    if (score >= 1200) return 4;
    if (score >= 900)  return 3;
    if (score >= 600)  return 2;
    if (score >= 300)  return 1;
    return 0;
}

function initBgStars() {
    bgStars = [];
    for (var i = 0; i < 70; i++) {
        bgStars.push({
            x:  Math.random() * WIDTH,
            y:  Math.random() * (GROUND_Y * 0.75),
            r:  Math.random() * 1.4 + 0.3,
            tw: Math.random() * Math.PI * 2
        });
    }
}

function drawMtnLayer(scrollMul, p0, p1, p2, a0, a1, a2, baseRatio, col) {
    var gYf = GROUND_Y + PLAYER_SIZE;
    var wx  = bgX * scrollMul;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (var px = 0; px <= WIDTH + 4; px += 4) {
        var wX = px + wx;
        var h  = Math.sin(wX / p0 * Math.PI * 2) * a0
               + Math.sin(wX / p1 * Math.PI * 2 + 1.7) * a1
               + Math.sin(wX / p2 * Math.PI * 2 + 3.4) * a2;
        ctx.lineTo(px, gYf * baseRatio + h);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawCloudShape(c, th) {
    var hw = c.w / 2, hh = c.h / 2;
    var ca = 'rgba(' + th.cRGB + ',' + th.cA + ')';
    var cb = 'rgba(' + th.cRGB + ',' + (th.cA * 0.65) + ')';
    ctx.fillStyle = ca;
    if (c.type === 1) {
        // Wispy — finas franjas horizontales
        ctx.beginPath(); ctx.ellipse(c.x + hw,        c.y + hh,        hw * 1.1,  hh * 0.38, 0,     0, Math.PI*2); ctx.fill();
        ctx.fillStyle = cb;
        ctx.beginPath(); ctx.ellipse(c.x + hw * 0.55, c.y + hh * 0.65, hw * 0.5,  hh * 0.27, -0.25, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 1.5,  c.y + hh * 1.1,  hw * 0.44, hh * 0.24, 0.2,   0, Math.PI*2); ctx.fill();
    } else if (c.type === 2) {
        // Cumulus alto — apilado vertical
        ctx.beginPath(); ctx.ellipse(c.x + hw,        c.y + hh * 1.1,  hw * 0.68, hh * 0.65, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 0.75, c.y + hh * 0.72, hw * 0.54, hh * 0.58, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 1.25, c.y + hh * 0.7,  hw * 0.5,  hh * 0.55, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = cb;
        ctx.beginPath(); ctx.ellipse(c.x + hw,        c.y + hh * 0.28, hw * 0.38, hh * 0.5,  0, 0, Math.PI*2); ctx.fill();
    } else {
        // Esponjoso estándar
        ctx.beginPath(); ctx.ellipse(c.x + hw,        c.y + hh * 0.8,  hw,        hh * 0.75, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 0.35, c.y + hh * 0.85, hw * 0.5,  hh * 0.65, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 1.65, c.y + hh * 0.85, hw * 0.44, hh * 0.6,  0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = cb;
        ctx.beginPath(); ctx.ellipse(c.x + hw,        c.y + hh * 0.3,  hw * 0.35, hh * 0.5,  0, 0, Math.PI*2); ctx.fill();
    }
}

// ─── DRAW BACKGROUND ───────────────────────────────────────
function drawBackground() {
    var gYf = GROUND_Y + PLAYER_SIZE;
    var ti  = getBgTheme();
    var th  = BG_THEMES[ti];

    // Sky gradient
    var sky = ctx.createLinearGradient(0, 0, 0, gYf);
    sky.addColorStop(0,    th.s0);
    sky.addColorStop(0.55, th.s1);
    sky.addColorStop(1,    th.s2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stars (temas oscuros)
    if (th.stars) {
        var sA = ti === 3 ? 0.65 : 0.95;
        for (var si = 0; si < bgStars.length; si++) {
            var st = bgStars[si];
            var tw = 0.55 + 0.45 * Math.sin(frame * 0.05 + st.tw);
            ctx.fillStyle = 'rgba(255,255,255,' + (sA * tw) + ')';
            ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
        }
    }

    // Sol
    if (th.sun) {
        var sx = 510, sy = ti === 2 ? 46 : 28, sr = ti === 2 ? 12 : 16;
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = th.sunCol;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 2.8, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 1.7, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
    }

    // Luna (temas oscuros)
    if (!th.sun) {
        var mx = 510, my = 26;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#ccdcff';
        ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d8e8ff';
        ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = ti === 4 ? '#060c24' : '#1e1040';
        ctx.beginPath(); ctx.arc(mx + 6, my - 4, 10, 0, Math.PI*2); ctx.fill();
    }

    // Montañas — 3 capas de paralaje
    drawMtnLayer(0.04, 280, 430, 640,  14,  9,  5,  0.66, th.mF);
    drawMtnLayer(0.10, 200, 310, 460,  26, 16,  9,  0.76, th.mM);
    drawMtnLayer(0.22, 130, 200, 310,  36, 22, 13,  0.84, th.mN);

    // Nubes
    for (var ci = 0; ci < clouds.length; ci++) drawCloudShape(clouds[ci], th);

    // Suelo
    ctx.fillStyle = th.g0; ctx.fillRect(0, gYf,      WIDTH, 2);
    ctx.fillStyle = th.g1; ctx.fillRect(0, gYf + 2,  WIDTH, 6);
    ctx.fillStyle = th.g2; ctx.fillRect(0, gYf + 8,  WIDTH, 10);
    ctx.fillStyle = th.g3; ctx.fillRect(0, gYf + 18, WIDTH, HEIGHT - gYf - 18);

    // Líneas de suelo (sólo temas verdes)
    if (ti <= 1) {
        ctx.strokeStyle = 'rgba(38,100,40,0.38)';
        ctx.lineWidth = 1;
        var gOff = (frame * SPEED * 0.5) % 40;
        for (var gx = -gOff; gx < WIDTH; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, gYf + 11); ctx.lineTo(gx + 16, gYf + 11); ctx.stroke();
        }
    }

    // Sombra del jugador
    if ((isPlaying || isDying) && player.x !== undefined) {
        var airRatio    = Math.max(0, (GROUND_Y - player.y) / GROUND_Y);
        var shadowAlpha = Math.max(0.04, 0.22 - airRatio * 0.18);
        var shadowRX    = player.onGround ? 16 * squishX : 11;
        ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha + ')';
        ctx.beginPath();
        ctx.ellipse(player.x + 18, gYf + 3, shadowRX, 4, 0, 0, Math.PI*2);
        ctx.fill();
    }
}

// ─── DRAW DINO ─────────────────────────────────────────────
function drawDino(x, y, running, dead, deathAng) {
    var lp      = (running && player.onGround && !isCrouching) ? Math.floor(animTick / 5) % 4 : 0;
    var isJump  = !player.onGround && !dead;
    var isBlink = blinkTimer < 3;
    var crouch  = isCrouching && !dead;
    var sx = dead ? 1 : squishX;
    var sy = dead ? 1 : squishY;

    /* palette */
    var TOP  = '#6ecf6b';   // lit top
    var MID  = '#46a843';   // base
    var DRK  = '#2d7a2a';   // shadow / outlines
    var BELY = '#d6f0d4';   // belly
    var LEG  = '#3a8c38';   // legs

    /* ── CROUCH ─────────────────────────────────────────────── */
    if (crouch) {
        ctx.save();
        ctx.translate(x, y + PLAYER_SIZE);  // origin = ground-left

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(22, 2, 24, 4, 0, 0, Math.PI*2); ctx.fill();

        // tail
        ctx.fillStyle = DRK;
        ctx.beginPath();
        ctx.moveTo(5, -10);
        ctx.bezierCurveTo(-3, -7, -12, -3, -15, 2);
        ctx.lineTo(-10, 5); ctx.bezierCurveTo(-6, 1, 2, -3, 7, -7);
        ctx.closePath(); ctx.fill();

        // body (flat, horizontal ellipse)
        var bg = ctx.createLinearGradient(0, -20, 0, -6);
        bg.addColorStop(0, TOP); bg.addColorStop(0.55, MID); bg.addColorStop(1, DRK);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.roundRect(2, -20, 28, 14, 7); ctx.fill();
        ctx.strokeStyle = DRK; ctx.lineWidth = 1; ctx.stroke();
        // belly stripe
        ctx.fillStyle = 'rgba(214,240,212,0.55)';
        ctx.beginPath(); ctx.ellipse(16, -11, 10, 5, 0, 0, Math.PI*2); ctx.fill();

        // neck → head connection
        ctx.fillStyle = MID;
        ctx.beginPath(); ctx.roundRect(26, -25, 9, 13, 4); ctx.fill();

        // head (big, forward-extended)
        var hg = ctx.createLinearGradient(25, -30, 25, -14);
        hg.addColorStop(0, TOP); hg.addColorStop(0.6, MID); hg.addColorStop(1, DRK);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.roundRect(24, -30, 24, 16, 6); ctx.fill();
        ctx.strokeStyle = DRK; ctx.lineWidth = 0.8; ctx.stroke();
        // snout
        ctx.fillStyle = DRK;
        ctx.beginPath(); ctx.roundRect(44, -24, 8, 7, [0,3,3,0]); ctx.fill();
        // nostril
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(50, -22, 1.3, 0, Math.PI*2); ctx.fill();

        // eye
        var ex = 33, ey = -24;
        ctx.fillStyle = '#fff';
        if (isBlink) { ctx.beginPath(); ctx.ellipse(ex, ey, 4.5, 1.2, 0, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI*2); ctx.fill(); }
        if (!isBlink) {
            ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.arc(ex+0.8, ey+0.5, 2.6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex+1.8, ey-0.8, 1.1, 0, Math.PI*2); ctx.fill();
        }

        // legs bent
        ctx.fillStyle = LEG;
        ctx.beginPath(); ctx.roundRect(6, -7, 9, 7, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(17, -7, 9, 7, 3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10, 0, 8, 3, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(21, 0, 8, 3, 0, 0, Math.PI*2); ctx.fill();

        ctx.restore();
        return;
    }

    /* ── NORMAL / JUMP / DEAD ──────────────────────────────── */
    ctx.save();
    var pivotX = x + 18, pivotY = y + PLAYER_SIZE;
    if (dead) {
        ctx.translate(pivotX, pivotY); ctx.rotate(deathAng); ctx.translate(-18, -PLAYER_SIZE);
    } else {
        ctx.translate(pivotX, pivotY); ctx.scale(sx, sy); ctx.translate(-18, -PLAYER_SIZE);
    }

    var hl = (running && player.onGround && !dead) ? 1.5 : 0;
    var tw = running && !dead ? Math.sin(animTick * 0.22) * 3.5 : 0;

    /* TAIL */
    ctx.fillStyle = DRK;
    ctx.beginPath();
    ctx.moveTo(6, 21);
    ctx.bezierCurveTo(0, 25, -7, 28 + tw, -13, 32 + tw);
    ctx.lineTo(-9, 35 + tw);
    ctx.bezierCurveTo(-4, 30 + tw * 0.6, 4, 25, 9, 23);
    ctx.closePath(); ctx.fill();

    /* BODY */
    var bg = ctx.createLinearGradient(3, 12, 3, 30);
    bg.addColorStop(0, TOP); bg.addColorStop(0.5, MID); bg.addColorStop(1, DRK);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(3, 13, 21, 17, 8); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 1; ctx.stroke();
    // belly
    ctx.fillStyle = 'rgba(214,240,212,0.6)';
    ctx.beginPath(); ctx.ellipse(13, 24, 8, 6, 0, 0, Math.PI*2); ctx.fill();
    // dorsal bumps
    ctx.fillStyle = DRK;
    for (var di = 0; di < 3; di++) {
        ctx.beginPath();
        ctx.moveTo(14 + di*3.5 - 2.5, 13);
        ctx.lineTo(14 + di*3.5, 8 - di);
        ctx.lineTo(14 + di*3.5 + 2.5, 13);
        ctx.closePath(); ctx.fill();
    }

    /* NECK */
    var ng = ctx.createLinearGradient(18, 8, 26, 18);
    ng.addColorStop(0, TOP); ng.addColorStop(1, MID);
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.roundRect(18, 9, 9, 12, 4); ctx.fill();

    /* HEAD — grande y expresiva */
    var hg = ctx.createLinearGradient(12 + hl, 0, 12 + hl, 14);
    hg.addColorStop(0, TOP); hg.addColorStop(0.55, MID); hg.addColorStop(1, DRK);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.roundRect(12 + hl, 0, 24, 15, 7); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.9; ctx.stroke();
    // top crest
    ctx.fillStyle = DRK;
    ctx.beginPath(); ctx.roundRect(21 + hl, -4, 13, 5, 2); ctx.fill();
    // snout
    var sg = ctx.createLinearGradient(32 + hl, 6, 32 + hl, 14);
    sg.addColorStop(0, MID); sg.addColorStop(1, DRK);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.roundRect(32 + hl, 6, 9, 8, [0,3,3,0]); ctx.fill();
    // jaw line
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(32 + hl, 11); ctx.lineTo(40 + hl, 11); ctx.stroke();
    // nostril
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(38 + hl, 4, 1.4, 0, Math.PI*2); ctx.fill();

    /* EYE — grande y expresivo */
    var ex = 22 + hl, ey = 6;
    // socket highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI*2); ctx.fill();
    // sclera
    ctx.fillStyle = '#fff';
    if (isBlink) {
        ctx.beginPath(); ctx.ellipse(ex, ey, 5, 1.3, 0, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI*2); ctx.fill();
    }
    if (!isBlink) {
        // iris
        ctx.fillStyle = '#2a7a28';
        ctx.beginPath(); ctx.arc(ex + 0.8, ey + 0.5, 3.2, 0, Math.PI*2); ctx.fill();
        // pupil
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath(); ctx.arc(ex + 0.8, ey + 0.5, 1.9, 0, Math.PI*2); ctx.fill();
        // highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + 2, ey - 1, 1.2, 0, Math.PI*2); ctx.fill();
    }
    // eye outline
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI*2); ctx.stroke();

    /* ARM (tiny T-Rex) */
    ctx.fillStyle = LEG;
    ctx.beginPath(); ctx.roundRect(22, 20, 5, 4, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(25, 22, 5, 3, 1); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(29, 24); ctx.lineTo(32, 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(29, 25); ctx.lineTo(31, 28); ctx.stroke();

    /* LEGS — 4-frame con muslo + espinilla + pie */
    // leg positions per frame: [frontThighY, frontShinH, rearThighY, rearShinH]
    var lfs = [
        [25, 11, 27, 7],
        [26, 9,  26, 9],
        [27, 7,  25, 11],
        [26, 9,  26, 9]
    ];
    var lf = isJump  ? [25, 6, 25, 6]  :
             dead     ? [26, 9, 26, 9]  :
             lfs[lp];

    ctx.fillStyle = LEG;
    // rear leg (behind body)
    ctx.beginPath(); ctx.roundRect(5, lf[2], 8, lf[3] + 2, 3); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.7; ctx.stroke();
    // rear foot
    ctx.fillStyle = LEG;
    ctx.beginPath(); ctx.ellipse(9, lf[2] + lf[3] + 3, 7, 3, isJump ? -0.25 : 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.5; ctx.stroke();
    // front leg
    ctx.fillStyle = LEG;
    ctx.beginPath(); ctx.roundRect(15, lf[0], 8, lf[1] + 2, 3); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.7; ctx.stroke();
    // front foot
    ctx.fillStyle = LEG;
    ctx.beginPath(); ctx.ellipse(19, lf[0] + lf[1] + 3, 7, 3, isJump ? -0.25 : 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.restore();
}

function drawPlayer() {
    drawDino(player.x, player.y, isPlaying, false, 0);
}

// ─── SCORE / HUD ───────────────────────────────────────────
function drawScore() {
    var level = Math.floor((SPEED - 4) / 0.5) + 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 15px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText('Puntaje: ' + score, WIDTH - 12, 10);
    ctx.fillText('Record: ' + highScore, WIDTH - 12, 28);
    ctx.fillText('Vel x' + SPEED.toFixed(1), WIDTH - 12, 46);
    ctx.textAlign = 'left';

    // Milestone message
    if (milestoneMsg) {
        ctx.save();
        ctx.globalAlpha = milestoneMsg.alpha;
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#ff9800';
        ctx.textAlign = 'center';
        ctx.fillText(milestoneMsg.text, WIDTH / 2, milestoneMsg.y);
        ctx.restore();
    }


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
    }
}

// ─── GAME LOOP ─────────────────────────────────────────────
function drawIdle() {
    drawBackground();
    drawPlayer();
    drawScore();
}

var lastFrameTs = 0;
function gameLoop(ts) {
    if (!isPlaying) return;
    // Throttle to ~60fps on high-refresh screens
    if (ts - lastFrameTs < 15) { animFrameId = requestAnimationFrame(gameLoop); return; }
    lastFrameTs = ts;

    frame++;
    animTick++;
    bgX += SPEED;
    SPEED += 0.0014;
    score = Math.floor(frame / 6);

    checkMilestone();

    if (frame >= nextObstacle) {
        spawnObstacle();
        // Gap shrinks slightly with speed but never below 60
        var gap = Math.max(60, 78 - (SPEED - 4) * 6);
        nextObstacle = frame + gap + Math.floor(Math.random() * 40);
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
    GameAudio.start();
    player = { x: 80, y: GROUND_Y, vy: 0, vx: 0, onGround: true };
    obstacles = [];
    dustParticles = [];
    milestoneMsg = null;
    lastMilestone = 0;
    SPEED = 4;
    frame = 0;
    animTick = 0;
    bgX = 0;
    score = 0;
    initBgStars();
    nextObstacle = 90;
    isPlaying = true;
    isDying   = false;
    isCrouching = false;
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
    GameAudio.gameOver();
    cancelAnimationFrame(animFrameId);

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

// ─── CANVAS TOUCH CONTROLS ──────────────────────────────────
// Tap = jump | Swipe/hold down = crouch | Hold left zone = move left
(function() {
    var swipeStartX, swipeStartY, swipeStartTime;
    var MIN_SWIPE = 40;
    var isCrouchTouch = false;
    var leftZoneTimer = null;

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeStartTime = Date.now();

        // Left 38% of canvas = move left after brief hold (distinguishes from tap)
        var rect = canvas.getBoundingClientRect();
        var relX = e.touches[0].clientX - rect.left;
        if (relX < rect.width * 0.38) {
            leftZoneTimer = setTimeout(function() {
                keys['ArrowLeft'] = true;
            }, 130);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!isPlaying) return;
        var dy = e.touches[0].clientY - swipeStartY;
        if (dy > MIN_SWIPE && !isCrouchTouch) {
            isCrouchTouch = true;
            keys['ArrowDown'] = true;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        clearTimeout(leftZoneTimer);
        keys['ArrowLeft'] = false;

        var dx = e.changedTouches[0].clientX - swipeStartX;
        var dy = e.changedTouches[0].clientY - swipeStartY;
        var dt = Date.now() - swipeStartTime;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);

        if (isCrouchTouch) {
            isCrouchTouch = false;
            keys['ArrowDown'] = false;
        }

        // Quick tap (no significant movement) = jump or start
        if (absDx < MIN_SWIPE && absDy < MIN_SWIPE && dt < 280) {
            if (!isPlaying) {
                document.getElementById('startBtn').click();
            } else {
                jump();
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', function() {
        clearTimeout(leftZoneTimer);
        keys['ArrowLeft'] = false;
        isCrouchTouch = false;
        keys['ArrowDown'] = false;
    }, { passive: false });
})();

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
// Reasignar btnRight a agacharse en móvil
addHold('btnRight', 'ArrowDown');

var btnJump = document.getElementById('btnJump');
if (btnJump) {
    btnJump.addEventListener('mousedown',  function()  { jump(); });
    btnJump.addEventListener('touchstart', function(e) { e.preventDefault(); jump(); }, { passive: false });
}

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
document.getElementById('score').textContent = '0';
document.getElementById('highScore').textContent = highScore;
initBgStars();
drawIdle();

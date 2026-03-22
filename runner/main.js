// Endless Runner — animaciones completas + variedad de obstáculos + crouch + progresión
var canvas = document.getElementById('runnerCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;   // 600
var HEIGHT = canvas.height;  // 200

var GRAVITY     = 0.6;
var JUMP_FORCE  = -12;
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

// Clouds (parallax)
var clouds = [
    { x: 100, y: 28, w: 64, h: 22, speed: 0.22 },
    { x: 310, y: 46, w: 80, h: 26, speed: 0.18 },
    { x: 520, y: 22, w: 52, h: 18, speed: 0.28 },
];

// ─── OBSTACLE TYPES ─────────────────────────────────────────
// type 0: cactus alto  (normal, saltar)
// type 1: cactus bajo  (pequeño, saltar O agacharse)
// type 2: pájaro volador (media altura, SOLO agacharse)

function spawnObstacle() {
    var type = Math.floor(Math.random() * 3);
    var o;
    if (type === 0) {
        // Cactus alto clásico
        var w = 18 + Math.random() * 14;
        var h = 32 + Math.random() * 30;
        o = { x: WIDTH, width: w, height: h, type: 0 };
    } else if (type === 1) {
        // Cactus bajo — se puede esquivar saltando O agachándose
        var w = 14 + Math.random() * 10;
        var h = 16 + Math.random() * 12;
        o = { x: WIDTH, width: w, height: h, type: 1 };
    } else {
        // Pájaro volador — vuela a media altura (SOLO agacharse)
        o = {
            x: WIDTH,
            width: 36,
            height: 20,
            type: 2,
            flapTick: 0,
            // Y fijo a media altura del jugador
            flyY: GROUND_Y - 26 + Math.random() * 10   // ala media
        };
    }
    obstacles.push(o);
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
    if (keys['ArrowLeft']  || keys['a'] || keys['A'])
        player.x = Math.max(PLAYER_MIN_X, player.x - PLAYER_SPEED);
    if (keys['ArrowRight'] || keys['d'] || keys['D'])
        player.x = Math.min(PLAYER_MAX_X, player.x + PLAYER_SPEED);

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
    var grad = ctx.createLinearGradient(o.x, oy, o.x + o.width, oy);
    grad.addColorStop(0, '#2e7d32');
    grad.addColorStop(1, '#1b5e20');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(o.x, oy, o.width, o.height, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(o.x + 2, oy + 2, o.width / 3, o.height - 4);

    if (o.type === 0) {
        // Arms on tall cactus
        var midY = oy + o.height * 0.4;
        ctx.fillStyle = '#2e7d32';
        // Left arm
        ctx.beginPath(); ctx.roundRect(o.x - 8, midY, 9, 5, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(o.x - 9, midY - 8, 5, 10, 2); ctx.fill();
        // Right arm
        ctx.beginPath(); ctx.roundRect(o.x + o.width - 1, midY + 4, 9, 5, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(o.x + o.width + 4, midY - 4, 5, 10, 2); ctx.fill();
    }
}

function drawBird(o) {
    var bx = o.x + o.width / 2;
    var by = o.flyY;
    var flap = Math.sin(o.flapTick * 0.3) > 0;

    ctx.save();
    ctx.translate(bx, by);

    // Body
    ctx.fillStyle = '#5c3317';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#7a4520';
    if (flap) {
        // Wing up
        ctx.beginPath();
        ctx.ellipse(-2, -7, 13, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Wing down
        ctx.beginPath();
        ctx.ellipse(-2, 5, 13, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Head
    ctx.fillStyle = '#5c3317';
    ctx.beginPath();
    ctx.arc(13, -4, 7, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(16, -6.5, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.moveTo(19, -4);
    ctx.lineTo(26, -3);
    ctx.lineTo(19, -1);
    ctx.closePath();
    ctx.fill();

    // Tail
    ctx.fillStyle = '#3e2206';
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(-24, -6);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-24, 5);
    ctx.lineTo(-14, 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function updateClouds() {
    for (var i = 0; i < clouds.length; i++) {
        clouds[i].x -= SPEED * clouds[i].speed;
        if (clouds[i].x + clouds[i].w < 0) {
            clouds[i].x = WIDTH + 20;
            clouds[i].y = 12 + Math.random() * 50;
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
    }
    if (milestoneMsg) {
        milestoneMsg.alpha -= 0.018;
        milestoneMsg.y -= 0.4;
        if (milestoneMsg.alpha <= 0) milestoneMsg = null;
    }
}

// ─── DRAW BACKGROUND ───────────────────────────────────────
function drawBackground() {
    var gY = GROUND_Y + PLAYER_SIZE;

    // Sky gradient
    var sky = ctx.createLinearGradient(0, 0, 0, gY);
    sky.addColorStop(0,    '#4a8fc8');
    sky.addColorStop(0.55, '#87CEEB');
    sky.addColorStop(1,    '#b5ddf5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Distant rolling hills (slow parallax)
    var hillOff = (frame * SPEED * 0.07) % 120;
    ctx.fillStyle = 'rgba(115,180,128,0.28)';
    for (var hi = 0; hi < 6; hi++) {
        ctx.beginPath();
        ctx.ellipse(-hillOff + hi * 120 + 60, gY + 2, 68, 30, 0, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    // Clouds — puffier multi-ellipse shape
    for (var ci = 0; ci < clouds.length; ci++) {
        var c = clouds[ci];
        var hw = c.w / 2, hh = c.h / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.ellipse(c.x + hw,         c.y + hh * 0.8,  hw,        hh * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 0.35,  c.y + hh * 0.85, hw * 0.5,  hh * 0.65, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + hw * 1.65,  c.y + hh * 0.85, hw * 0.44, hh * 0.6,  0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.ellipse(c.x + hw,         c.y + hh * 0.3,  hw * 0.35, hh * 0.5,  0, 0, Math.PI * 2); ctx.fill();
    }

    // Ground — soil + grass layers
    ctx.fillStyle = '#5c3d10';
    ctx.fillRect(0, gY + 18, WIDTH, HEIGHT - gY - 18);
    ctx.fillStyle = '#7a5218';
    ctx.fillRect(0, gY + 6,  WIDTH, 12);
    ctx.fillStyle = '#52a854';
    ctx.fillRect(0, gY,      WIDTH, 8);
    ctx.fillStyle = '#68c46a';
    ctx.fillRect(0, gY,      WIDTH, 2);

    // Ground detail stripes (moving)
    ctx.strokeStyle = 'rgba(38,100,40,0.38)';
    ctx.lineWidth = 1;
    var gOff = (frame * SPEED * 0.5) % 40;
    for (var gx = -gOff; gx < WIDTH; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx,      gY + 11);
        ctx.lineTo(gx + 16, gY + 11);
        ctx.stroke();
    }

    // Player ground shadow
    if ((isPlaying || isDying) && player.x !== undefined) {
        var airRatio    = Math.max(0, (GROUND_Y - player.y) / GROUND_Y);
        var shadowAlpha = Math.max(0.04, 0.22 - airRatio * 0.18);
        var shadowRX    = player.onGround ? 16 * squishX : 11;
        ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha + ')';
        ctx.beginPath();
        ctx.ellipse(player.x + 18, gY + 3, shadowRX, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── DRAW DINO ─────────────────────────────────────────────
function drawDino(x, y, running, dead, deathAng) {
    var lp      = (running && player.onGround && !isCrouching) ? Math.floor(animTick / 7) % 2 : 0;
    var isJump  = !player.onGround && !dead;
    var isBlink = blinkTimer < 3;
    var crouch  = isCrouching && !dead;

    var G1 = '#43a047';   // body green
    var G2 = '#2e7d32';   // dark green (detail)
    var G3 = '#c8e6c9';   // belly highlight
    var G4 = '#66bb6a';   // lighter highlight

    // ── CROUCHING: pose separado sin scale para evitar distorsión ──
    if (crouch) {
        ctx.save();
        // Origen: esquina izquierda inferior del hitbox (nivel del suelo)
        ctx.translate(x, y + PLAYER_SIZE);

        // Cola (curvada hacia atrás-arriba)
        ctx.fillStyle = G1;
        ctx.beginPath();
        ctx.moveTo(2, -14);
        ctx.quadraticCurveTo(-8, -9, -13, -3);
        ctx.lineTo(-7,  0);
        ctx.lineTo( 3, -8);
        ctx.closePath();
        ctx.fill();

        // Cuerpo horizontal
        ctx.fillStyle = G1;
        ctx.beginPath(); ctx.roundRect(0, -18, 28, 13, 6); ctx.fill();
        // Highlight superior del cuerpo
        ctx.fillStyle = G4;
        ctx.beginPath(); ctx.roundRect(2, -17, 11, 5, 3); ctx.fill();
        // Panza
        ctx.fillStyle = G3;
        ctx.beginPath(); ctx.ellipse(14, -11, 8, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Cuello (conecta cuerpo con cabeza)
        ctx.fillStyle = G1;
        ctx.beginPath(); ctx.roundRect(24, -21, 8, 11, 4); ctx.fill();

        // Cabeza extendida hacia adelante
        ctx.fillStyle = G1;
        ctx.beginPath(); ctx.roundRect(28, -24, 19, 14, 5); ctx.fill();
        // Cresta superior de la cabeza
        ctx.fillStyle = G2;
        ctx.beginPath(); ctx.roundRect(34, -27, 11, 5, 2); ctx.fill();

        // Hocico
        ctx.fillStyle = G2;
        ctx.beginPath(); ctx.roundRect(45, -19, 9, 6, [0,2,2,0]); ctx.fill();
        // Fosa nasal
        ctx.fillStyle = G1;
        ctx.beginPath(); ctx.arc(51, -22, 1.2, 0, Math.PI * 2); ctx.fill();

        // Ojo
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        if (isBlink) { ctx.ellipse(37, -18, 3.5, 0.9, 0, 0, Math.PI * 2); }
        else          { ctx.arc(37, -18, 3.5, 0, Math.PI * 2); }
        ctx.fill();
        if (!isBlink) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(38.5, -18, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(39.5, -19, 0.8, 0, Math.PI * 2); ctx.fill();
        }

        // Patas dobladas
        ctx.fillStyle = G2;
        ctx.beginPath(); ctx.roundRect( 4, -7, 10, 7, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(16, -7, 10, 7, 2); ctx.fill();
        // Pies
        ctx.beginPath(); ctx.roundRect( 2, -3, 14, 4, [0,0,2,2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, -3, 14, 4, [0,0,2,2]); ctx.fill();

        ctx.restore();
        return;
    }

    // ── POSE NORMAL / SALTO / MUERTE (con squish desde pivot) ──
    var sx = dead ? 1 : squishX;
    var sy = dead ? 1 : squishY;

    ctx.save();
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

    var headLean = (running && player.onGround && !dead) ? 2 : 0;

    // Cola — bezier más gruesa y con onda
    var tailWave = (running && !dead) ? Math.sin(animTick * 0.22) * 4 : 0;
    ctx.fillStyle = G1;
    ctx.beginPath();
    ctx.moveTo(6, 16);
    ctx.bezierCurveTo(1, 19, -4, 21 + tailWave * 0.4, -10, 27 + tailWave);
    ctx.lineTo(-6, 31 + tailWave);
    ctx.bezierCurveTo(-2, 26 + tailWave * 0.6, 5, 21, 9, 18);
    ctx.closePath();
    ctx.fill();

    // Cuerpo principal
    ctx.fillStyle = G1;
    ctx.beginPath(); ctx.roundRect(2, 12, 22, 18, 6); ctx.fill();
    // Highlight del cuerpo
    ctx.fillStyle = G4;
    ctx.beginPath(); ctx.roundRect(4, 13, 10, 7, 3); ctx.fill();
    // Panza
    ctx.fillStyle = G3;
    ctx.beginPath(); ctx.ellipse(13, 22, 7, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Espinas dorsales (3 picos en la espalda/cuello)
    ctx.fillStyle = G2;
    for (var si = 0; si < 3; si++) {
        ctx.beginPath();
        ctx.moveTo(18 + si * 3 - 2, 13 - si * 2);
        ctx.lineTo(18 + si * 3,      8 - si * 2);
        ctx.lineTo(18 + si * 3 + 2, 13 - si * 2);
        ctx.closePath();
        ctx.fill();
    }

    // Cuello
    ctx.fillStyle = G1;
    ctx.beginPath(); ctx.roundRect(19, 6, 9, 13, 4); ctx.fill();

    // Cabeza
    ctx.fillStyle = G1;
    ctx.beginPath(); ctx.roundRect(15 + headLean, 0, 22, 13, 5); ctx.fill();
    // Cresta/reborde superior cabeza
    ctx.fillStyle = G2;
    ctx.beginPath(); ctx.roundRect(22 + headLean, -3, 13, 5, 2); ctx.fill();

    // Hocico
    ctx.fillStyle = G2;
    ctx.beginPath(); ctx.roundRect(30 + headLean, 6, 10, 6, [0,2,2,0]); ctx.fill();
    // Fosa nasal
    ctx.fillStyle = G1;
    ctx.beginPath(); ctx.arc(37 + headLean, 3, 1.2, 0, Math.PI * 2); ctx.fill();

    // Ojo
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (isBlink) { ctx.ellipse(24 + headLean, 5, 3.5, 0.9, 0, 0, Math.PI * 2); }
    else          { ctx.arc(24 + headLean, 5, 3.5, 0, Math.PI * 2); }
    ctx.fill();
    if (!isBlink) {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(25.5 + headLean, 5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(26.5 + headLean, 4, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // Brazo T-Rex (codo doblado)
    ctx.fillStyle = G2;
    ctx.beginPath(); ctx.roundRect(21, 19, 5, 5, 2); ctx.fill();  // brazo superior
    ctx.beginPath(); ctx.roundRect(24, 22, 6, 3, 1); ctx.fill();  // antebrazo
    // Garras
    ctx.beginPath(); ctx.arc(29, 23, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 25, 1.3, 0, Math.PI * 2); ctx.fill();

    // Patas
    ctx.fillStyle = G2;
    if (dead) {
        ctx.beginPath(); ctx.roundRect( 4, 28, 7, 4, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, 28, 7, 4, 2); ctx.fill();
    } else if (isJump) {
        // Patas recogidas al saltar
        ctx.beginPath(); ctx.roundRect( 3, 26, 6, 7, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, 26, 6, 7, 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo( 3,32); ctx.lineTo(11,30); ctx.lineTo(11,33); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14,32); ctx.lineTo(22,30); ctx.lineTo(22,33); ctx.closePath(); ctx.fill();
    } else if (lp === 0) {
        // Pierna izquierda adelante
        ctx.beginPath(); ctx.roundRect( 5, 26, 6, 11, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(15, 26, 6,  8, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect( 3, 34, 11, 4, [0,0,2,2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(13, 31, 10, 4, [0,0,2,2]); ctx.fill();
    } else {
        // Pierna derecha adelante
        ctx.beginPath(); ctx.roundRect( 3, 26, 6,  8, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(16, 26, 6, 11, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect( 1, 31, 10, 4, [0,0,2,2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(14, 34, 11, 4, [0,0,2,2]); ctx.fill();
    }

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

    // Crouch hint when bird approaching
    for (var i = 0; i < obstacles.length; i++) {
        if (obstacles[i].type === 2 && obstacles[i].x < WIDTH && obstacles[i].x > player.x - 30) {
            ctx.save();
            ctx.globalAlpha = 0.75;
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('AGACHATE!', player.x + 20, player.y - 12);
            ctx.restore();
            break;
        }
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

function gameLoop() {
    if (!isPlaying) return;

    frame++;
    animTick++;
    SPEED += 0.001;
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
    player = { x: 80, y: GROUND_Y, vy: 0, onGround: true };
    obstacles = [];
    dustParticles = [];
    milestoneMsg = null;
    lastMilestone = 0;
    SPEED = 4;
    frame = 0;
    animTick = 0;
    score = 0;
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

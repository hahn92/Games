// Frogger
var canvas = document.getElementById('froggerCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 480

var COLS = 10, ROWS = 12;
var CELL = W / COLS; // 40

var score, highScore, lives, isPlaying, animFrameId;
highScore = parseInt(localStorage.getItem('froggerHigh') || '0', 10);

// Frog
var frog = { col: 5, row: 11 };

// Death animation state
var deathAnim = null; // { x, y, particles[], timer, done }

// Lane definitions (row 0 = top = goal)
var LANE_TYPES = [
    'goal',   // 0
    'river',  // 1
    'river',  // 2
    'river',  // 3
    'river',  // 4
    'safe',   // 5 - median
    'road',   // 6
    'road',   // 7
    'road',   // 8
    'road',   // 9
    'road',   // 10
    'safe',   // 11 - start
];

var GOAL_SLOTS = [1, 3, 5, 7, 9];
var filledGoals = [];

var lanes;

function initLanes() {
    lanes = [
        null, // row 0 goal
        { dir: 1,  speed: 1.2, objects: makeObjects(1, 3, 90, 28) },
        { dir: -1, speed: 1.5, objects: makeObjects(2, 3, 100, 28) },
        { dir: 1,  speed: 1.0, objects: makeObjects(3, 2, 120, 36) },
        { dir: -1, speed: 1.8, objects: makeObjects(4, 3, 80, 28) },
        null, // row 5 median
        { dir: -1, speed: 2.2, objects: makeCars(6, 3, '#ef5350') },
        { dir: 1,  speed: 1.8, objects: makeCars(7, 4, '#ff9800') },
        { dir: -1, speed: 2.5, objects: makeCars(8, 3, '#ce93d8') },
        { dir: 1,  speed: 1.5, objects: makeCars(9, 3, '#80cbc4') },
        { dir: -1, speed: 3.0, objects: makeCars(10, 4, '#fff176') },
        null, // row 11 start
    ];
}

function makeObjects(row, count, gap, w) {
    var objs = [];
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * (W / count + gap), w: w, h: CELL - 4 });
    }
    return objs;
}

function makeCars(row, count, color) {
    var objs = [];
    var spacing = W / count;
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * spacing, w: CELL * 1.4, h: CELL - 8, color: color });
    }
    return objs;
}

function updateLanes() {
    for (var r = 1; r <= 10; r++) {
        if (!lanes[r]) continue;
        var lane = lanes[r];
        var objs = lane.objects;
        for (var i = 0; i < objs.length; i++) {
            objs[i].x += lane.speed * lane.dir;
            if (lane.dir > 0 && objs[i].x > W) objs[i].x = -objs[i].w;
            if (lane.dir < 0 && objs[i].x + objs[i].w < 0) objs[i].x = W;
        }
    }
}

var frogPx = { x: 0, y: 0 };
var frogRidingOffset = 0;

function getFrogPixel() {
    return {
        x: (frog.col - 0.5) * CELL,
        y: frog.row * CELL + 4
    };
}

function drawBackground() {
    // Goal row
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(0, 0, W, CELL);

    // Lily pad slots (with bounce animation)
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gs = GOAL_SLOTS[i];
        var gx = (gs - 1) * CELL;
        // Bounce offset: sinusoidal up/down 2px
        var bounceY = Math.sin(frame * 0.05 + i * 1.2) * 2;
        var isFilled = filledGoals.indexOf(gs) >= 0;

        // Lily pad shadow
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(gx + CELL/2 + 2, CELL/2 + bounceY + 3, CELL/2 - 5, CELL/2 - 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Lily pad body
        ctx.save();
        ctx.translate(0, bounceY);
        var padGrad = ctx.createRadialGradient(gx + CELL/2 - 3, CELL/2 - 4, 1, gx + CELL/2, CELL/2, CELL/2 - 3);
        padGrad.addColorStop(0, isFilled ? '#66bb6a' : '#1a5276');
        padGrad.addColorStop(1, isFilled ? '#2e7d32' : '#0d3b6e');

        ctx.fillStyle = padGrad;
        ctx.beginPath();
        ctx.ellipse(gx + CELL/2, CELL/2, CELL/2 - 4, CELL/2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pad outline
        ctx.strokeStyle = isFilled ? '#a5d6a7' : '#1565c0';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Notch on lily pad
        ctx.strokeStyle = isFilled ? '#388e3c' : '#0d47a1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx + CELL/2, CELL/2);
        ctx.lineTo(gx + CELL/2, CELL/2 - (CELL/2 - 4));
        ctx.stroke();

        if (isFilled) {
            // Draw a small frog in the goal
            drawFrogShape(gx + CELL/2, CELL/2, CELL * 0.35, false);
        }
        ctx.restore();
    }

    // River rows 1-4 with animated water ripples
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(0, CELL, W, CELL * 4);

    // Water ripples — sinusoidal lines at low opacity
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.18)';
    ctx.lineWidth = 1.5;
    for (var r = 1; r <= 4; r++) {
        var baseY = r * CELL + CELL * 0.4;
        var waveOffset = (frame * 0.8) % (W / 2);
        for (var wave = 0; wave < 3; wave++) {
            ctx.beginPath();
            var yOff = wave * (CELL * 0.25);
            for (var wx = 0; wx <= W; wx += 4) {
                var wy = baseY + yOff + Math.sin((wx + waveOffset * (wave + 1)) * 0.06) * 2.5;
                if (wx === 0) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
        }
    }
    ctx.restore();

    // Median row 5
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, CELL * 5, W, CELL);
    // Grass texture lines
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (var gLine = 0; gLine < W; gLine += 8) {
        ctx.beginPath();
        ctx.moveTo(gLine, CELL * 5);
        ctx.lineTo(gLine, CELL * 6);
        ctx.stroke();
    }
    ctx.restore();

    // Road rows 6-10
    ctx.fillStyle = '#424242';
    ctx.fillRect(0, CELL * 6, W, CELL * 5);
    // Lane lines
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 12]);
    for (var r = 7; r <= 10; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Start row 11
    ctx.fillStyle = '#33691e';
    ctx.fillRect(0, CELL * 11, W, CELL);
}

function drawLogs() {
    for (var r = 1; r <= 4; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 2;
            var oh = o.h;
            var ow = o.w;

            // Main log body with gradient
            var logGrad = ctx.createLinearGradient(o.x, oy, o.x, oy + oh);
            logGrad.addColorStop(0, '#a1887f');
            logGrad.addColorStop(0.3, '#795548');
            logGrad.addColorStop(1, '#4e342e');
            ctx.fillStyle = logGrad;

            // Rounded log body
            ctx.beginPath();
            // Left cap (semicircle)
            ctx.arc(o.x + oh/2, oy + oh/2, oh/2, Math.PI/2, -Math.PI/2, true);
            // Right cap (semicircle)
            ctx.arc(o.x + ow - oh/2, oy + oh/2, oh/2, -Math.PI/2, Math.PI/2, false);
            ctx.closePath();
            ctx.fill();

            // Log end caps (darker rings)
            ctx.fillStyle = '#4e342e';
            ctx.beginPath();
            ctx.ellipse(o.x + oh/2, oy + oh/2, oh/2, oh/2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6d4c41';
            ctx.beginPath();
            ctx.ellipse(o.x + oh/2, oy + oh/2, oh/2 - 3, oh/2 - 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4e342e';
            ctx.beginPath();
            ctx.ellipse(o.x + ow - oh/2, oy + oh/2, oh/2, oh/2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6d4c41';
            ctx.beginPath();
            ctx.ellipse(o.x + ow - oh/2, oy + oh/2, oh/2 - 3, oh/2 - 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Wood grain lines
            ctx.save();
            ctx.strokeStyle = 'rgba(60,30,10,0.4)';
            ctx.lineWidth = 1;
            var grainSpacing = 7;
            for (var g = oh/2 + grainSpacing; g < ow - oh/2; g += grainSpacing) {
                ctx.beginPath();
                ctx.moveTo(o.x + g, oy + 3);
                ctx.lineTo(o.x + g, oy + oh - 3);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}

// Helper: parse hex color to rgb
function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    return { r: r, g: g, b: b };
}

function drawCars() {
    for (var r = 6; r <= 10; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 4;
            var ow = o.w, oh = o.h;

            // Car body gradient (lighter on top)
            var rgb = hexToRgb(o.color);
            var carGrad = ctx.createLinearGradient(o.x, oy, o.x, oy + oh);
            carGrad.addColorStop(0, 'rgba(' + Math.min(rgb.r+50,255) + ',' + Math.min(rgb.g+50,255) + ',' + Math.min(rgb.b+50,255) + ',1)');
            carGrad.addColorStop(0.5, o.color);
            carGrad.addColorStop(1, 'rgba(' + Math.max(rgb.r-40,0) + ',' + Math.max(rgb.g-40,0) + ',' + Math.max(rgb.b-40,0) + ',1)');

            ctx.fillStyle = carGrad;
            ctx.beginPath();
            ctx.roundRect(o.x, oy, ow, oh, 4);
            ctx.fill();

            // Car roof / windshield
            var roofX = o.x + ow * 0.2;
            var roofW = ow * 0.6;
            var roofY = oy + oh * 0.15;
            var roofH = oh * 0.45;
            ctx.fillStyle = 'rgba(180,220,255,0.55)';
            ctx.beginPath();
            ctx.roundRect(roofX, roofY, roofW, roofH, 3);
            ctx.fill();

            // Wheels
            ctx.fillStyle = '#222';
            var wheelR = oh * 0.25;
            var wheelPositions = [
                { x: o.x + ow * 0.22, y: oy + oh },
                { x: o.x + ow * 0.78, y: oy + oh }
            ];
            for (var w = 0; w < wheelPositions.length; w++) {
                ctx.beginPath();
                ctx.ellipse(wheelPositions[w].x, wheelPositions[w].y - wheelR * 0.2, wheelR * 1.1, wheelR * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
                // Hubcap
                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.ellipse(wheelPositions[w].x, wheelPositions[w].y - wheelR * 0.2, wheelR * 0.45, wheelR * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#222';
            }

            // Headlights / tail lights
            var lightColor = lane.dir > 0 ? '#fff9c4' : '#ef9a9a';
            ctx.fillStyle = lightColor;
            if (lane.dir > 0) {
                // Moving right: lights on right
                ctx.fillRect(o.x + ow - 4, oy + 3, 4, 5);
                ctx.fillRect(o.x + ow - 4, oy + oh - 8, 4, 5);
                // Tail light on left (red)
                ctx.fillStyle = '#ef5350';
                ctx.fillRect(o.x, oy + 3, 4, 5);
                ctx.fillRect(o.x, oy + oh - 8, 4, 5);
            } else {
                // Moving left: lights on left
                ctx.fillRect(o.x, oy + 3, 4, 5);
                ctx.fillRect(o.x, oy + oh - 8, 4, 5);
                ctx.fillStyle = '#ef5350';
                ctx.fillRect(o.x + ow - 4, oy + 3, 4, 5);
                ctx.fillRect(o.x + ow - 4, oy + oh - 8, 4, 5);
            }
        }
    }
}

var frogRidingX = null;

// Draw the frog shape at (cx, cy) with given radius
function drawFrogShape(cx, cy, r, moving) {
    var brightness = (moving && frogMoveFlash > 0) ? frogMoveFlash / 8 : 0;
    var g1 = Math.min(255, 150 + Math.floor(brightness * 80));
    var bodyColor = 'rgb(56,' + g1 + ',56)';
    var darkGreen = '#2d5a27';
    var lightGreen = 'rgb(100,' + Math.min(255, 200 + Math.floor(brightness*30)) + ',80)';

    // Back legs (drawn behind body)
    ctx.fillStyle = darkGreen;
    // Left back leg
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.75, cy + r * 0.35, r * 0.35, r * 0.18, Math.PI * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.9, cy + r * 0.55, r * 0.18, r * 0.3, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Right back leg
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.75, cy + r * 0.35, r * 0.35, r * 0.18, -Math.PI * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.9, cy + r * 0.55, r * 0.18, r * 0.3, -Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Body (ovalado)
    var bodyGrad = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, r*0.05, cx, cy, r * 0.75);
    bodyGrad.addColorStop(0, lightGreen);
    bodyGrad.addColorStop(0.6, bodyColor);
    bodyGrad.addColorStop(1, darkGreen);

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly (lighter underside)
    ctx.fillStyle = 'rgba(180,230,160,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 0.38, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front legs
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.55, cy + r * 0.1, r * 0.22, r * 0.12, Math.PI * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.55, cy + r * 0.1, r * 0.22, r * 0.12, -Math.PI * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (protuberant)
    var eyeY = cy - r * 0.35;
    var eyeOffX = r * 0.32;
    // Eye socket
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, eyeY, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX, eyeY, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // White sclera
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, eyeY, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX, eyeY, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - eyeOffX + r*0.03, eyeY + r*0.03, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX + r*0.03, eyeY + r*0.03, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (curved line)
    ctx.strokeStyle = darkGreen;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.05, r * 0.22, 0.3, Math.PI - 0.3, false);
    ctx.stroke();
}

// Flash on movement
var frogMoveFlash = 0;

function drawFrog() {
    if (deathAnim && !deathAnim.done) return; // hide frog during death

    var fy = frog.row * CELL;
    var fx;
    if (frog.row >= 1 && frog.row <= 4 && frogRidingX !== null) {
        fx = frogRidingX - CELL / 2;
    } else {
        fx = (frog.col - 1) * CELL;
    }

    var frogCx = fx + CELL / 2;
    var frogCy = fy + CELL / 2;
    var frogR = CELL * 0.48;

    if (frogMoveFlash > 0) frogMoveFlash--;

    drawFrogShape(frogCx, frogCy, frogR, true);
}

function drawDeathAnim() {
    if (!deathAnim) return;
    deathAnim.timer++;

    var progress = deathAnim.timer / 30;

    if (deathAnim.timer <= 8) {
        // White flash
        var flashAlpha = 1 - (deathAnim.timer / 8);
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(deathAnim.x, deathAnim.y, CELL * 0.6 * (1 + deathAnim.timer * 0.15), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Update and draw particles
    for (var i = deathAnim.particles.length - 1; i >= 0; i--) {
        var p = deathAnim.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;
        if (p.life <= 0) { deathAnim.particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (deathAnim.timer > 30 && deathAnim.particles.length === 0) {
        deathAnim.done = true;
        deathAnim = null;
    }
}

function getFrogOnLog() {
    if (frog.row < 1 || frog.row > 4) return null;
    var lane = lanes[frog.row];
    if (!lane) return null;
    var fx, fy = frog.row * CELL + 4;
    if (frogRidingX !== null) fx = frogRidingX - 2;
    else fx = (frog.col - 1) * CELL + 2;
    for (var i = 0; i < lane.objects.length; i++) {
        var o = lane.objects[i];
        if (fx < o.x + o.w && fx + CELL - 4 > o.x) return { log: o, lane: lane };
    }
    return null;
}

function checkDeath() {
    if (frog.row >= 1 && frog.row <= 4) {
        var riding = getFrogOnLog();
        if (!riding) return 'river';
        if (frogRidingX < 0 || frogRidingX > W) return 'river';
    }
    if (frog.row >= 6 && frog.row <= 10) {
        var lane = lanes[frog.row];
        if (!lane) return null;
        var fx = (frog.col - 1) * CELL + 4;
        var fy = frog.row * CELL + 4;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            if (fx < o.x + o.w - 2 && fx + CELL - 8 > o.x + 2) return 'car';
        }
    }
    return null;
}

function triggerDeathAnim(callback) {
    var fx, fy;
    if (frog.row >= 1 && frog.row <= 4 && frogRidingX !== null) {
        fx = frogRidingX;
    } else {
        fx = (frog.col - 0.5) * CELL;
    }
    fy = frog.row * CELL + CELL / 2;

    var parts = [];
    var colors = ['#56ab2f', '#a8e063', '#2d5a27', '#8bc34a', '#cddc39'];
    for (var i = 0; i < 6; i++) {
        var angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
        var speed = 2.5 + Math.random() * 3;
        parts.push({
            x: fx, y: fy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            color: colors[i % colors.length],
            size: 3 + Math.random() * 4,
            life: 20 + Math.random() * 12,
            maxLife: 32
        });
    }

    deathAnim = { x: fx, y: fy, particles: parts, timer: 0, done: false };

    setTimeout(function() {
        if (callback) callback();
    }, 500);
}

function die() {
    lives--;
    updateHUD();
    if (lives <= 0) {
        // Still show anim then game over
        triggerDeathAnim(function() { gameOver(); });
        frog.col = 5; frog.row = 11; frogRidingX = null;
        return;
    }
    triggerDeathAnim(function() {
        frog.col = 5; frog.row = 11; frogRidingX = null;
    });
}

function checkGoal() {
    if (frog.row !== 0) return false;
    var fx = frogRidingX !== null ? frogRidingX : (frog.col - 0.5) * CELL;
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gs = GOAL_SLOTS[i];
        var gx = (gs - 1) * CELL + CELL / 2;
        if (Math.abs(fx - gx) < CELL * 0.7 && filledGoals.indexOf(gs) < 0) {
            filledGoals.push(gs);
            score += 50;
            updateHUD();
            frog.col = 5; frog.row = 11; frogRidingX = null;
            if (filledGoals.length >= GOAL_SLOTS.length) {
                score += 200;
                updateHUD();
                filledGoals = [];
                speedUpLanes();
            }
            return true;
        }
    }
    return false;
}

function speedUpLanes() {
    for (var r = 1; r <= 10; r++) {
        if (lanes[r]) lanes[r].speed *= 1.15;
    }
}

var frame = 0;
var dying = false;

function gameLoop() {
    if (!isPlaying) return;
    frame++;

    updateLanes();

    // Move frog with log
    if (frog.row >= 1 && frog.row <= 4) {
        var lane = lanes[frog.row];
        if (lane) {
            if (frogRidingX === null) frogRidingX = (frog.col - 0.5) * CELL;
            frogRidingX += lane.speed * lane.dir;
        }
    }

    // Check death (only if not already in death anim)
    if (!deathAnim) {
        var cause = checkDeath();
        if (cause) { die(); }
    }

    // Check goal
    if (!deathAnim && frog.row === 0) checkGoal();

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawLogs();
    drawCars();
    drawFrog();
    drawDeathAnim();

    animFrameId = requestAnimationFrame(gameLoop);
}

function moveFrog(dr, dc) {
    if (!isPlaying) return;
    if (deathAnim) return; // can't move during death
    var nr = frog.row + dr;
    var nc = frog.col + dc;
    if (nr < 0 || nr > 11 || nc < 1 || nc > COLS) return;
    frog.row = nr;
    frog.col = nc;
    frogMoveFlash = 8;
    if (nr >= 1 && nr <= 4) {
        frogRidingX = (nc - 0.5) * CELL;
    } else {
        frogRidingX = null;
    }
    if (nr > 0) score += 1;
    updateHUD();
}

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('froggerHigh', highScore); }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' V:' + lives;
}

function startGame() {
    frog.col = 5; frog.row = 11; frogRidingX = null;
    score = 0; lives = 3; frame = 0;
    filledGoals = [];
    deathAnim = null;
    frogMoveFlash = 0;
    isPlaying = true;
    initLanes();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animFrameId);
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// Keyboard
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); moveFrog(-1, 0); }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); moveFrog(1, 0); }
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); moveFrog(0, -1); }
    if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); moveFrog(0, 1); }
});

// Touch controls
function addTap(id, dr, dc) {
    var btn = document.getElementById(id);
    btn.addEventListener('click', function() { moveFrog(dr, dc); });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(dr, dc); }, { passive: false });
}
addTap('btnUp', -1, 0);
addTap('btnDown', 1, 0);
addTap('btnLeft', 0, -1);
addTap('btnRight', 0, 1);

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
initLanes();
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

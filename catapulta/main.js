// Catapulta — Physics/Trajectory game
// Arrastra desde la catapulta para apuntar. Soltar lanza el proyectil.
// Afectado por gravedad y viento. Destruye todos los castillos por nivel.

var canvas = document.getElementById('catapultaCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;    // 360
var HEIGHT = canvas.height;   // 560

/* ───────── Physics constants (delta-time based, px/s) ───────── */
var GRAVITY        = 900;     // px/s²
var LAUNCH_SCALE   = 7;       // drag pixel -> px/s of velocity
var MAX_DRAG       = 110;     // max drag distance in pixels
var GROUND_Y       = 510;     // y-coord of ground line
var SLING_X        = 70;      // catapult pivot x
var SLING_Y        = GROUND_Y - 60; // catapult pivot y (top of arm)
var PROJ_RADIUS    = 10;
var SHOTS_PER_LVL  = 4;

/* ───────── State ───────── */
var state      = 'idle';  // 'idle' | 'aiming' | 'flying' | 'paused' | 'gameover' | 'levelwin'
var projectile = null;    // {x,y,vx,vy,trail:[]}
var dragStart  = null;    // {x,y}
var dragCur    = null;    // {x,y}
var targets    = [];      // [{x,y,w,h,alive,hue,shake}]
var particles  = [];      // [{x,y,vx,vy,life,col,size}]
var trails     = [];      // ghost-trails of previous shots
var floatTexts = [];      // floating "+10" / "Combo x2"
var score      = 0;
var shotsLeft  = SHOTS_PER_LVL;
var level      = 1;
var combo      = 0;
var wind       = 0;       // px/s² horizontal
var bestScore  = parseInt(localStorage.getItem('catapultaBest') || '0', 10);
var shake      = 0;       // camera shake magnitude
var animFrameId = null;
var lastT       = 0;

/* ───────── DOM refs ───────── */
var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');
var overTitleEl  = document.getElementById('overTitle');

highScoreEl.textContent = bestScore;

/* ───────── Utilities ───────── */
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function updateMobileScore() {
    if (!mobileScoreEl) return;
    mobileScoreEl.textContent =
        'Nivel: ' + level + '   Pts: ' + score + '   Tiros: ' + shotsLeft + '   Récord: ' + bestScore;
}

function updateHUD() {
    scoreEl.textContent = score;
    highScoreEl.textContent = bestScore;
    updateMobileScore();
}

/* ───────── Level / targets ───────── */
function buildLevel() {
    targets = [];
    var count = Math.min(3 + level, 8);
    var minX  = 160;
    var maxX  = WIDTH - 40;
    var minY  = 60;
    var maxY  = 420;
    for (var i = 0; i < count; i++) {
        var w = rand(32, 48);
        var h = rand(32, 52);
        var x, y, ok, tries = 0;
        do {
            x = rand(minX, maxX - w);
            y = rand(minY, maxY - h);
            ok = true;
            for (var j = 0; j < targets.length; j++) {
                var t = targets[j];
                if (Math.abs(x - t.x) < 50 && Math.abs(y - t.y) < 54) { ok = false; break; }
            }
            tries++;
        } while (!ok && tries < 30);
        targets.push({
            x: x, y: y, w: w, h: h,
            alive: true,
            hue: Math.floor(rand(0, 360)),
            shake: 0,
            windowHue: Math.floor(rand(30, 60))
        });
    }
    // Wind increases with level; direction random
    wind = rand(-40, 40) * (1 + level * 0.1);
    shotsLeft = SHOTS_PER_LVL;
}

/* ───────── Reset / start ───────── */
function resetGame() {
    score = 0;
    level = 1;
    combo = 0;
    trails = [];
    particles = [];
    floatTexts = [];
    projectile = null;
    dragStart = null;
    dragCur = null;
    shake = 0;
    buildLevel();
    state = 'idle';
    updateHUD();
    hidePopup();
}

function startGame() {
    resetGame();
    state = 'aiming';
    GameAudio.start();
    startBtn.disabled = true;
    restartBtn.disabled = false;
    if (!animFrameId) { lastT = 0; animFrameId = requestAnimationFrame(loop); }
}

function endGame(won) {
    state = 'gameover';
    if (score > bestScore) {
        bestScore = score;
        try { localStorage.setItem('catapultaBest', bestScore.toString()); } catch (e) {}
    }
    updateHUD();
    overTitleEl.textContent = won ? '¡Victoria!' : '¡Sin munición!';
    finalScoreEl.textContent = 'Puntos: ' + score + '   (Nivel ' + level + ')';
    finalBestEl.textContent  = 'Récord: ' + bestScore;
    popup.style.display = 'flex';
    if (won) GameAudio.win(); else GameAudio.gameOver();
    startBtn.disabled = false;
}

function hidePopup() { popup.style.display = 'none'; }

/* ───────── Input ───────── */
function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    var x, y;
    if (e.touches && e.touches.length) {
        x = e.touches[0].clientX - r.left;
        y = e.touches[0].clientY - r.top;
    } else if (e.changedTouches && e.changedTouches.length) {
        x = e.changedTouches[0].clientX - r.left;
        y = e.changedTouches[0].clientY - r.top;
    } else {
        x = e.clientX - r.left;
        y = e.clientY - r.top;
    }
    return { x: x * (WIDTH / r.width), y: y * (HEIGHT / r.height) };
}

function onPointerDown(e) {
    if (state !== 'aiming') return;
    e.preventDefault();
    var p = canvasPoint(e);
    dragStart = { x: SLING_X, y: SLING_Y };
    dragCur   = p;
}

function onPointerMove(e) {
    if (state !== 'aiming' || !dragStart) return;
    e.preventDefault();
    dragCur = canvasPoint(e);
}

function onPointerUp(e) {
    if (state !== 'aiming' || !dragStart || !dragCur) { dragStart = dragCur = null; return; }
    e.preventDefault();
    var dx = dragCur.x - dragStart.x;
    var dy = dragCur.y - dragStart.y;
    var dist = Math.hypot(dx, dy);
    dragStart = null;
    dragCur   = null;
    if (dist < 10) return;                        // too small, ignore
    var capped = Math.min(dist, MAX_DRAG);
    var nx = dx / (dist || 1);
    var ny = dy / (dist || 1);
    // Launch opposite direction (slingshot feel)
    var vx = -nx * capped * LAUNCH_SCALE;
    var vy = -ny * capped * LAUNCH_SCALE;
    // Only allow upward-ish launches (vy negative means up)
    if (vy > -60) return;
    projectile = { x: SLING_X, y: SLING_Y, vx: vx, vy: vy, trail: [], age: 0 };
    shotsLeft--;
    state = 'flying';
    shake = 5;
    GameAudio.shoot();
    updateHUD();
}

canvas.addEventListener('mousedown',  onPointerDown);
canvas.addEventListener('mousemove',  onPointerMove);
canvas.addEventListener('mouseup',    onPointerUp);
canvas.addEventListener('mouseleave', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove',  onPointerMove, { passive: false });
canvas.addEventListener('touchend',   onPointerUp,   { passive: false });
canvas.addEventListener('touchcancel',onPointerUp,   { passive: false });

startBtn.addEventListener('click', function () { startGame(); });
restartBtn.addEventListener('click', function () { startGame(); });
playAgainBtn.addEventListener('click', function () { startGame(); });

/* ───────── Collision & hits ───────── */
function hitTarget(p) {
    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (!t.alive) continue;
        var cx = clamp(p.x, t.x, t.x + t.w);
        var cy = clamp(p.y, t.y, t.y + t.h);
        var dx = p.x - cx, dy = p.y - cy;
        if (dx * dx + dy * dy <= PROJ_RADIUS * PROJ_RADIUS) return t;
    }
    return null;
}

function explodeTarget(t) {
    t.alive = false;
    // particles
    for (var i = 0; i < 22; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(80, 260);
        particles.push({
            x: t.x + t.w / 2,
            y: t.y + t.h / 2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            life: rand(0.5, 1.1),
            maxLife: 1.1,
            col: 'hsl(' + t.hue + ',80%,60%)',
            size: rand(2, 5)
        });
    }
    // flying-text
    combo++;
    var pts = 10 + (combo - 1) * 5;
    score += pts;
    floatTexts.push({
        x: t.x + t.w / 2,
        y: t.y,
        vy: -40,
        life: 1.0,
        maxLife: 1.0,
        text: '+' + pts + (combo > 1 ? ' x' + combo : '')
    });
    shake = Math.min(shake + 9, 14);
    if (combo >= 2) GameAudio.scoreHigh(); else GameAudio.score();
}

function endShot(hit) {
    // Save trail as ghost
    if (projectile && projectile.trail.length > 3) {
        trails.push({ pts: projectile.trail.slice(), life: 1.2 });
        if (trails.length > 4) trails.shift();
    }
    projectile = null;
    if (!hit) combo = 0;
    // All targets dead → next level
    var remaining = 0;
    for (var i = 0; i < targets.length; i++) if (targets[i].alive) remaining++;
    if (remaining === 0) {
        // level complete
        var bonus = shotsLeft * 20;
        if (bonus > 0) {
            score += bonus;
            floatTexts.push({
                x: WIDTH / 2, y: 180, vy: -20, life: 1.6, maxLife: 1.6,
                text: 'Bonus +' + bonus
            });
        }
        level++;
        updateHUD();
        state = 'levelwin';
        setTimeout(function () {
            if (state !== 'levelwin') return;
            buildLevel();
            state = 'aiming';
            updateHUD();
        }, 1200);
        GameAudio.goal();
        return;
    }
    if (shotsLeft <= 0) {
        setTimeout(function () { endGame(false); }, 600);
        return;
    }
    state = 'aiming';
    updateHUD();
}

/* ───────── Update ───────── */
function update(dt) {
    // shake decay
    if (shake > 0) shake = Math.max(0, shake - dt * 40);

    // particles
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.vy += GRAVITY * 0.55 * dt;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0 || p.y > HEIGHT + 20) particles.splice(i, 1);
    }

    // float text
    for (var k = floatTexts.length - 1; k >= 0; k--) {
        var ft = floatTexts[k];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatTexts.splice(k, 1);
    }

    // ghost trails fade
    for (var g = trails.length - 1; g >= 0; g--) {
        trails[g].life -= dt;
        if (trails[g].life <= 0) trails.splice(g, 1);
    }

    // projectile
    if (state === 'flying' && projectile) {
        var pj = projectile;
        pj.vy += GRAVITY * dt;
        pj.vx += wind * dt;
        pj.x  += pj.vx * dt;
        pj.y  += pj.vy * dt;
        pj.age += dt;
        if (pj.trail.length === 0 || pj.age % 0.02 < dt) {
            pj.trail.push({ x: pj.x, y: pj.y });
            if (pj.trail.length > 60) pj.trail.shift();
        }
        // target hit?
        var hit = hitTarget(pj);
        if (hit) {
            explodeTarget(hit);
            endShot(true);
            return;
        }
        // out of bounds
        if (pj.x < -20 || pj.x > WIDTH + 20 || pj.y > HEIGHT + 20) {
            // ground splash particles if near bottom
            if (pj.y >= GROUND_Y - 5 && pj.x > -20 && pj.x < WIDTH + 20) {
                for (var m = 0; m < 8; m++) {
                    particles.push({
                        x: pj.x, y: GROUND_Y,
                        vx: rand(-100, 100), vy: rand(-180, -40),
                        life: rand(0.3, 0.7), maxLife: 0.7,
                        col: '#a89068', size: rand(2, 3)
                    });
                }
                GameAudio.hit();
            } else {
                GameAudio.miss();
            }
            endShot(false);
            return;
        }
        // hit ground
        if (pj.y + PROJ_RADIUS >= GROUND_Y) {
            for (var mm = 0; mm < 10; mm++) {
                particles.push({
                    x: pj.x, y: GROUND_Y,
                    vx: rand(-120, 120), vy: rand(-200, -40),
                    life: rand(0.4, 0.8), maxLife: 0.8,
                    col: '#a89068', size: rand(2, 4)
                });
            }
            GameAudio.hit();
            endShot(false);
            return;
        }
    }
}

/* ───────── Rendering ───────── */
function drawBackground() {
    // sky gradient
    var g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#182b55');
    g.addColorStop(0.5, '#2b3d7a');
    g.addColorStop(1, '#654b83');
    ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 0; i < 30; i++) {
        var sx = (i * 73) % WIDTH;
        var sy = (i * 41) % 360;
        ctx.fillRect(sx, sy, (i % 4 === 0) ? 2 : 1, (i % 4 === 0) ? 2 : 1);
    }

    // distant mountains
    ctx.fillStyle = '#1e2b4f';
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.lineTo(40, 370);
    ctx.lineTo(80, 395);
    ctx.lineTo(140, 340);
    ctx.lineTo(210, 380);
    ctx.lineTo(270, 350);
    ctx.lineTo(330, 395);
    ctx.lineTo(WIDTH, 380);
    ctx.lineTo(WIDTH, 440);
    ctx.lineTo(0, 440);
    ctx.closePath();
    ctx.fill();

    // ground
    var gg = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    gg.addColorStop(0, '#3d2d1a');
    gg.addColorStop(0.3, '#7a5a34');
    gg.addColorStop(1, '#4a351f');
    ctx.fillStyle = gg; ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // grass line
    ctx.fillStyle = '#3fa250';
    ctx.fillRect(0, GROUND_Y - 3, WIDTH, 4);

    // tiny grass tufts
    ctx.fillStyle = '#65d36e';
    for (var gi = 0; gi < WIDTH; gi += 12) {
        var th = (gi % 7 === 0) ? 3 : 2;
        ctx.fillRect(gi, GROUND_Y - 3 - th, 1, th);
    }
}

function drawWindIndicator() {
    // top bar showing wind direction & magnitude
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, WIDTH, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Nivel ' + level + '   Tiros:' + shotsLeft + '   Pts:' + score, 8, 13);

    // wind arrow to the right
    var cx = WIDTH - 70, cy = 13;
    ctx.fillStyle = '#d9e4ff'; ctx.textAlign = 'left';
    ctx.fillText('Viento', cx - 2, cy);
    var len = clamp(Math.abs(wind) * 0.45, 4, 34);
    var dir = wind >= 0 ? 1 : -1;
    var ax = cx + 42;
    ctx.strokeStyle = dir > 0 ? '#8fd3f4' : '#ff8f6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, cy);
    ctx.lineTo(ax + dir * len, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + dir * len, cy);
    ctx.lineTo(ax + dir * (len - 5), cy - 4);
    ctx.lineTo(ax + dir * (len - 5), cy + 4);
    ctx.closePath();
    ctx.fillStyle = dir > 0 ? '#8fd3f4' : '#ff8f6e';
    ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawCatapult() {
    // base platform
    ctx.fillStyle = '#4e3218';
    ctx.fillRect(SLING_X - 28, GROUND_Y - 8, 56, 10);
    ctx.fillStyle = '#714922';
    ctx.fillRect(SLING_X - 28, GROUND_Y - 10, 56, 3);

    // wheel
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(SLING_X - 16, GROUND_Y + 4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(SLING_X + 16, GROUND_Y + 4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(SLING_X - 16, GROUND_Y + 4, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(SLING_X + 16, GROUND_Y + 4, 5, 0, Math.PI * 2); ctx.stroke();

    // left arm
    ctx.strokeStyle = '#7a4e22';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(SLING_X - 10, GROUND_Y - 8);
    ctx.lineTo(SLING_X, SLING_Y - 6);
    ctx.stroke();

    // right arm
    ctx.beginPath();
    ctx.moveTo(SLING_X + 10, GROUND_Y - 8);
    ctx.lineTo(SLING_X, SLING_Y - 6);
    ctx.stroke();

    // cup
    ctx.fillStyle = '#9c6a30';
    ctx.beginPath();
    ctx.ellipse(SLING_X, SLING_Y, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b441c';
    ctx.fillRect(SLING_X - 12, SLING_Y - 2, 24, 3);
}

function drawProjectileAtRest() {
    // idle boulder waiting in cup
    if (state !== 'aiming') return;
    var cx = SLING_X;
    var cy = SLING_Y - 8;
    if (dragStart && dragCur) {
        // show pulled-back position on direction of drag
        var dx = dragCur.x - dragStart.x;
        var dy = dragCur.y - dragStart.y;
        var d = Math.hypot(dx, dy);
        var capped = Math.min(d, MAX_DRAG);
        cx = dragStart.x + (dx / (d || 1)) * capped;
        cy = dragStart.y + (dy / (d || 1)) * capped;
    }
    var g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, PROJ_RADIUS);
    g.addColorStop(0, '#e0d4b5');
    g.addColorStop(0.5, '#867563');
    g.addColorStop(1, '#3b322a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, PROJ_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1;
    ctx.stroke();

    if (dragStart && dragCur) {
        // slingshot rubber bands
        ctx.strokeStyle = '#c96c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SLING_X - 10, SLING_Y - 5);
        ctx.lineTo(cx - 3, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(SLING_X + 10, SLING_Y - 5);
        ctx.lineTo(cx + 3, cy);
        ctx.stroke();
        drawTrajectoryPreview();
    }
}

function drawTrajectoryPreview() {
    if (!dragStart || !dragCur) return;
    var dx = dragCur.x - dragStart.x;
    var dy = dragCur.y - dragStart.y;
    var d  = Math.hypot(dx, dy);
    if (d < 10) return;
    var capped = Math.min(d, MAX_DRAG);
    var vx = -(dx / d) * capped * LAUNCH_SCALE;
    var vy = -(dy / d) * capped * LAUNCH_SCALE;
    if (vy > -60) return; // skip if aim is downwards
    var px = SLING_X, py = SLING_Y;
    var dt = 1 / 60;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (var i = 0; i < 40; i++) {
        vy += GRAVITY * dt;
        vx += wind * dt;
        px += vx * dt;
        py += vy * dt;
        if (py >= GROUND_Y || px < 0 || px > WIDTH) break;
        if (i % 3 === 0) {
            ctx.globalAlpha = 0.8 - i * 0.018;
            ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
    }
    ctx.globalAlpha = 1;

    // Power meter along sling
    var pct = capped / MAX_DRAG;
    var barX = 10, barY = HEIGHT - 22, barW = 120, barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    var hue = 120 - pct * 120;   // green → red
    ctx.fillStyle = 'hsl(' + hue + ',80%,55%)';
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
}

function drawTargets() {
    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (!t.alive) continue;
        // castle body
        var g = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
        g.addColorStop(0, 'hsl(' + t.hue + ',55%,72%)');
        g.addColorStop(1, 'hsl(' + t.hue + ',60%,40%)');
        ctx.fillStyle = g;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        // darker bottom line
        ctx.fillStyle = 'hsl(' + t.hue + ',60%,30%)';
        ctx.fillRect(t.x, t.y + t.h - 3, t.w, 3);
        // merlons (battlements) on top
        var merlonW = 6, merlonH = 5, gap = 3;
        var step = merlonW + gap;
        for (var m = 0; m < Math.floor(t.w / step); m++) {
            var mx = t.x + 1 + m * step;
            ctx.fillStyle = 'hsl(' + t.hue + ',55%,55%)';
            ctx.fillRect(mx, t.y - merlonH, merlonW, merlonH);
        }
        // window
        var ww = Math.min(10, t.w * 0.3);
        var wh = Math.min(14, t.h * 0.35);
        var wx = t.x + (t.w - ww) / 2;
        var wy = t.y + 8;
        ctx.fillStyle = '#231a14';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'hsl(' + t.windowHue + ',90%,65%)';
        ctx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2 - 4);
        // flag pole + flag on tallest
        if (t.h > 40) {
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(t.x + t.w / 2, t.y - merlonH);
            ctx.lineTo(t.x + t.w / 2, t.y - merlonH - 12);
            ctx.stroke();
            ctx.fillStyle = 'hsl(' + ((t.hue + 180) % 360) + ',80%,55%)';
            ctx.beginPath();
            ctx.moveTo(t.x + t.w / 2, t.y - merlonH - 12);
            ctx.lineTo(t.x + t.w / 2 + 8, t.y - merlonH - 9);
            ctx.lineTo(t.x + t.w / 2, t.y - merlonH - 6);
            ctx.closePath();
            ctx.fill();
        }
    }
}

function drawTrails() {
    for (var i = 0; i < trails.length; i++) {
        var tr = trails[i];
        var a = tr.life / 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.35) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var k = 0; k < tr.pts.length; k++) {
            var pt = tr.pts[k];
            if (k === 0) ctx.moveTo(pt.x, pt.y);
            else         ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
}

function drawProjectile() {
    if (!projectile) return;
    var pj = projectile;
    // trail
    if (pj.trail.length > 1) {
        ctx.strokeStyle = 'rgba(255,210,90,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pj.trail[0].x, pj.trail[0].y);
        for (var k = 1; k < pj.trail.length; k++) ctx.lineTo(pj.trail[k].x, pj.trail[k].y);
        ctx.stroke();
    }
    // boulder
    var gr = ctx.createRadialGradient(pj.x - 3, pj.y - 3, 1, pj.x, pj.y, PROJ_RADIUS);
    gr.addColorStop(0, '#e0d4b5');
    gr.addColorStop(0.5, '#867563');
    gr.addColorStop(1, '#3b322a');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(pj.x, pj.y, PROJ_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1;
    ctx.stroke();
}

function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawFloatTexts() {
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < floatTexts.length; i++) {
        var f = floatTexts[i];
        var a = Math.max(0, f.life / f.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#000';
        ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = '#ffd866';
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawLevelWin() {
    if (state !== 'levelwin') return;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HEIGHT / 2 - 40, WIDTH, 80);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('¡Nivel Superado!', WIDTH / 2, HEIGHT / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawIdle() {
    if (state !== 'idle') return;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, HEIGHT / 2 - 50, WIDTH, 100);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Pulsa Iniciar para jugar', WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = '13px monospace';
    ctx.fillText('Arrastra desde la catapulta', WIDTH / 2, HEIGHT / 2 + 14);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

/* ───────── Main loop ───────── */
function render() {
    ctx.save();
    if (shake > 0) {
        var sx = (Math.random() - 0.5) * shake;
        var sy = (Math.random() - 0.5) * shake;
        ctx.translate(sx, sy);
    }
    drawBackground();
    drawTrails();
    drawTargets();
    drawCatapult();
    drawProjectileAtRest();
    drawProjectile();
    drawParticles();
    drawFloatTexts();
    drawLevelWin();
    drawIdle();
    ctx.restore();
    // wind + HUD is drawn last (no shake)
    drawWindIndicator();
}

function loop(ts) {
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    animFrameId = requestAnimationFrame(loop);
}

/* ───────── First frame / idle render ───────── */
resetGame();
render();

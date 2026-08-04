// Catapulta — Physics demolition game
// Arrastra hacia abajo-atrás para tensar el brazo. Suelta para lanzar la roca.
// La roca rebota, atraviesa varios bloques (combo) y derriba torres. El TNT explota.

var canvas = document.getElementById('catapultaCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;    // 360
var HEIGHT = canvas.height;   // 560

/* ───────── Physics constants (delta-time based, px/s) ───────── */
var GRAVITY        = 900;     // px/s²
var LAUNCH_SCALE   = 7.2;     // drag pixel -> px/s of velocity
var MAX_DRAG       = 115;     // max drag distance in pixels
var GROUND_Y       = 510;     // y-coord of ground line
var PIVOT_X        = 66;      // catapult arm pivot x
var PIVOT_Y        = GROUND_Y - 58; // catapult arm pivot y
var PROJ_RADIUS    = 11;
var SHOTS_PER_LVL  = 4;
var BLOCK_H        = 27;      // stacked block unit height
var GROUND_REST    = 0.46;    // ground bounce restitution
var BLOCK_DAMP     = 0.72;    // momentum kept after punching a block
var TNT_RADIUS     = 72;      // explosion blast radius
var WIND_MIN       = 14;      // |wind| floor  — below this the arrow means nothing
var WIND_MAX       = 105;     // |wind| ceiling — above this the shot is unaimable
var PHYS_SUB       = 4;       // projectile sub-steps per frame (anti-tunneling)

/* ───────── State ───────── */
var state      = 'idle';  // 'idle' | 'aiming' | 'flying' | 'paused' | 'gameover' | 'levelwin'
var projectile = null;
var dragStart  = null;
var dragCur    = null;
var blocks     = [];      // [{x,y,w,h,alive,type,hue,shake,vy,resting,flash}]
/* Pool compartido (game-utils.js). Semi-implícito: aplicaba la gravedad
   antes de mover. Velocidades px/s -> px/frame (/60), gravedad px/s² (/3600). */
var particles  = new Particles(260, { semiImplicit: true });
var trails     = [];
var floatTexts = [];
var score      = 0;
var shotsLeft  = SHOTS_PER_LVL;
var level      = 1;
var combo      = 0;
var wind       = 0;
var bestScore  = GameStore.getNum('catapultaBest', 0);
var shake      = 0;
var levelIntro = 0;       // seconds remaining to show the level banner
var animFrameId = null;
var lastT       = 0;
var bgT         = 0;      // background animation clock

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

function updateMobileScore() {
    if (!mobileScoreEl) return;
    mobileScoreEl.textContent =
        'Nivel: ' + level + '   Pts: ' + score + '   Tiros: ' + shotsLeft + '   Récord: ' + bestScore;
}

function updateHUD() {
    // saveBest() antes de pintar: el récord mostrado sigue al marcador en vivo y
    // queda persistido en cuanto se supera. Sólo escribe cuando hay récord nuevo,
    // así que no genera escrituras por cada actualización del HUD.
    saveBest();
    scoreEl.textContent = score;
    highScoreEl.textContent = bestScore;
    updateMobileScore();
}

// Persistir el récord en cuanto se supera, no sólo al terminar la partida:
// si el jugador cierra la pestaña a mitad de nivel el récord ya está guardado.
function saveBest() {
    if (score <= bestScore) return;
    bestScore = score;
    GameStore.set('catapultaBest', bestScore);
}

// Origen del disparo = la cazoleta del brazo, no el eje del pivote.
// La previsualización y el proyectil real DEBEN partir del mismo punto.
function launchOrigin() {
    return { x: PIVOT_X, y: PIVOT_Y - PROJ_RADIUS - 6 };
}

/* ───────── Level / structures ───────── */
function makeBlock(x, y, w, h, type) {
    return {
        x: x, y: y, w: w, h: h,
        alive: true,
        type: type || 'stone',         // 'stone' | 'wood' | 'tnt'
        hue: type === 'tnt' ? 2 : (type === 'wood' ? 28 : 210),
        shade: rand(-6, 6),
        shake: 0, flash: 0,
        vy: 0, resting: true,
        fuse: type === 'tnt' ? rand(0, Math.PI * 2) : 0
    };
}

function buildLevel() {
    blocks = [];
    // More & taller towers as the level rises
    var nTowers = Math.min(2 + Math.floor((level + 1) / 2), 5);
    var zoneStart = 150, zoneEnd = WIDTH - 34;
    var span = (zoneEnd - zoneStart) / nTowers;

    for (var ti = 0; ti < nTowers; ti++) {
        var tw    = Math.round(rand(26, 32));
        var slack = span - tw - 6;
        var baseX = Math.round(zoneStart + ti * span + (slack > 0 ? rand(2, slack) : 0));
        var floors = 1 + Math.floor(rand(0, Math.min(level + 1, 4) + 0.99)); // 1..(level+1, max 4)
        floors = Math.min(floors, 4);

        for (var f = 0; f < floors; f++) {
            var by = GROUND_Y - (f + 1) * BLOCK_H;
            var type = 'stone';
            // Wood on the lower floors, stone higher; occasional TNT from level 2
            if (f === 0 && level >= 2 && Math.random() < 0.18) type = 'tnt';
            else if (f < 2 && Math.random() < 0.4) type = 'wood';
            blocks.push(makeBlock(baseX, by, tw, BLOCK_H, type));
        }
        // Decorative roof + flag on the top of taller towers (also a target).
        // Debe apoyarse EXACTAMENTE sobre el bloque superior: si se solapa,
        // isSupported() lo declara en el aire y salta 8 px al empezar el nivel.
        if (floors >= 2 && Math.random() < 0.7) {
            var roofH = BLOCK_H - 6;
            var roofY = GROUND_Y - floors * BLOCK_H - roofH;
            blocks.push(makeBlock(baseX + 3, roofY, tw - 6, roofH, 'wood'));
        }
    }

    // El viento crece con el nivel, pero acotado: por debajo de WIND_MIN la
    // flecha no informa de nada y por encima de WIND_MAX el tiro es inapuntable.
    var wDir = Math.random() < 0.5 ? -1 : 1;
    wind = wDir * clamp(rand(16, 45) * (1 + level * 0.12), WIND_MIN, WIND_MAX);
    shotsLeft = SHOTS_PER_LVL;
    levelIntro = 1.4;
}

/* ───────── Reset / start ───────── */
function resetGame() {
    score = 0;
    level = 1;
    combo = 0;
    trails = [];
    particles.clear();
    floatTexts = [];
    projectile = null;
    dragStart = null;
    dragCur = null;
    shake = 0;
    buildLevel();
    levelIntro = 0;
    state = 'idle';
    updateHUD();
    hidePopup();
}

function startGame() {
    resetGame();
    state = 'aiming';
    levelIntro = 1.4;
    GameAudio.start();
    startBtn.disabled = true;
    restartBtn.disabled = false;
    if (!animFrameId) { lastT = 0; animFrameId = requestAnimationFrame(loop); }
}

function endGame(won) {
    state = 'gameover';
    saveBest();
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
function canvasPoint(e) { return GU.pointerPos(canvas, e); }

function onPointerDown(e) {
    if (state !== 'aiming') return;
    e.preventDefault();
    var p = canvasPoint(e);
    dragStart = { x: PIVOT_X, y: PIVOT_Y };
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
    if (dist < 10) return;
    var capped = Math.min(dist, MAX_DRAG);
    var nx = dx / (dist || 1);
    var ny = dy / (dist || 1);
    // Launch opposite to the pull (slingshot/onager feel)
    var vx = -nx * capped * LAUNCH_SCALE;
    var vy = -ny * capped * LAUNCH_SCALE;
    if (vy > -60) return;   // must aim upward
    combo = 0;
    var org = launchOrigin();
    projectile = { x: org.x, y: org.y, vx: vx, vy: vy, trail: [], age: 0, hits: 0, bounces: 0, spin: 0 };
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

startBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });

/* ───────── Particle helpers ───────── */
function spawnBlockParticles(b) {
    var base = b.type === 'wood' ? '32,18%' : (b.type === 'tnt' ? '0,75%' : '210,12%');
    for (var i = 0; i < 16; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(70, 230);
        var lf = rand(0.4, 1.0);
        particles.add(b.x + b.w / 2, b.y + b.h / 2,
            Math.cos(a) * sp / 60, (Math.sin(a) * sp - 50) / 60, {
            life: lf, alpha: lf / 1.0, size: rand(2, 5),
            color: 'hsl(' + base + ',' + Math.floor(rand(38, 64)) + '%)',
            gravity: GRAVITY * 0.55 / 3600, shape: 'square'
        });
    }
}

function spawnExplosion(cx, cy) {
    for (var i = 0; i < 34; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(120, 380);
        var lf = rand(0.4, 1.0);
        particles.add(cx, cy, Math.cos(a) * sp / 60, (Math.sin(a) * sp - 40) / 60, {
            life: lf, alpha: lf / 1.0, size: rand(3, 7),
            color: ['#ffd24a', '#ff8a2a', '#ff4520', '#fff1b0'][i % 4],
            gravity: GRAVITY * 0.55 / 3600, shape: 'square'
        });
    }
}

function spawnDust(x, y) {
    var dy = (y == null) ? GROUND_Y : y;
    for (var m = 0; m < 7; m++) {
        var lf = rand(0.3, 0.7);
        particles.add(x, dy, rand(-110, 110) / 60, rand(-170, -30) / 60, {
            life: lf, alpha: lf / 0.7, size: rand(2, 4),
            color: '#b39b72', gravity: GRAVITY * 0.55 / 3600, shape: 'square'
        });
    }
}

/* ───────── Destruction ───────── */
function destroyBlock(b) {
    if (!b.alive) return;
    b.alive = false;
    spawnBlockParticles(b);
    combo++;
    var pts = 10 + (combo - 1) * 5;
    score += pts;
    floatTexts.push({
        x: b.x + b.w / 2, y: b.y, vy: -40, life: 1.0, maxLife: 1.0,
        text: '+' + pts + (combo > 1 ? ' x' + combo : '')
    });
    if (combo >= 3) GameAudio.scoreHigh(); else GameAudio.score();
}

function explodeTNT(b) {
    if (!b.alive) return;
    b.alive = false;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    spawnExplosion(cx, cy);
    shake = Math.min(shake + 14, 22);
    GameAudio.explode();
    // Score the TNT crate itself
    combo++;
    var pts = 25 + (combo - 1) * 5;
    score += pts;
    floatTexts.push({ x: cx, y: b.y, vy: -42, life: 1.1, maxLife: 1.1, text: '¡BOOM! +' + pts });
    // Blast neighbours
    for (var i = 0; i < blocks.length; i++) {
        var o = blocks[i];
        if (!o.alive) continue;
        var ox = o.x + o.w / 2 - cx, oy = o.y + o.h / 2 - cy;
        if (ox * ox + oy * oy < TNT_RADIUS * TNT_RADIUS) {
            if (o.type === 'tnt') explodeTNT(o);   // chain reaction
            else destroyBlock(o);
        }
    }
}

function smashBlock(b) {
    b.flash = 0.25;
    if (b.type === 'tnt') explodeTNT(b);
    else destroyBlock(b);
    shake = Math.min(shake + 7, 18);
    // Nudge the block above so the tower jolts before collapsing
    for (var i = 0; i < blocks.length; i++) {
        var a = blocks[i];
        if (a.alive && a !== b && a.x < b.x + b.w && a.x + a.w > b.x && Math.abs(a.y + a.h - b.y) < 4) {
            a.shake = 6;
        }
    }
}

/* ───────── Block physics (collapse) ───────── */
function isSupported(b) {
    if (b.y + b.h >= GROUND_Y - 0.5) return true;
    for (var j = 0; j < blocks.length; j++) {
        var o = blocks[j];
        if (o === b || !o.alive || !o.resting) continue;
        if (o.x < b.x + b.w && o.x + o.w > b.x && Math.abs(o.y - (b.y + b.h)) < 3) return true;
    }
    return false;
}

function updateBlocks(dt) {
    var landedHard = 0;         // un solo sonido por frame, no uno por bloque
    var landX = 0, landY = GROUND_Y;
    for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (!b.alive) continue;
        if (b.shake > 0) b.shake = Math.max(0, b.shake - dt * 60);
        if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
        if (b.type === 'tnt') b.fuse += dt * 6;

        if (isSupported(b)) {
            b.vy = 0; b.resting = true;
        } else {
            b.resting = false;
            b.vy += GRAVITY * 0.65 * dt;
            var prevBottom = b.y + b.h;
            b.y += b.vy * dt;
            var newBottom = b.y + b.h;
            var impact = b.vy;
            var landed = false;
            if (newBottom >= GROUND_Y) {
                b.y = GROUND_Y - b.h; b.vy = 0; b.resting = true; landed = true;
            } else if (b.vy > 0) {
                // Barrido prevBottom→newBottom. Una ventana fija (o.y + 14) se
                // atravesaba con caídas de 3 pisos (≈15 px/frame a dt=0.05).
                for (var k = 0; k < blocks.length; k++) {
                    var o = blocks[k];
                    if (o === b || !o.alive || !o.resting) continue;
                    if (o.x < b.x + b.w && o.x + o.w > b.x &&
                        prevBottom <= o.y + 2 && newBottom >= o.y) {
                        b.y = o.y - b.h; b.vy = 0; b.resting = true; landed = true; break;
                    }
                }
            }
            if (landed && impact > 140 && impact > landedHard) {
                landedHard = impact;
                landX = b.x + b.w / 2;
                landY = b.y + b.h;
            }
        }
    }
    if (landedHard > 0) {
        GameAudio.hit();
        spawnDust(landX, landY);
        shake = Math.min(shake + 3, 18);
    }
}

/* ───────── End of shot ───────── */
function endShot(hit) {
    if (projectile && projectile.trail.length > 3) {
        trails.push({ pts: projectile.trail.slice(), life: 1.2 });
        if (trails.length > 4) trails.shift();
    }
    projectile = null;

    var remaining = 0;
    for (var i = 0; i < blocks.length; i++) if (blocks[i].alive) remaining++;

    if (remaining === 0) {
        var bonus = shotsLeft * 25;
        if (bonus > 0) {
            score += bonus;
            floatTexts.push({ x: WIDTH / 2, y: 200, vy: -20, life: 1.8, maxLife: 1.8, text: 'Munición +' + bonus });
        }
        level++;
        updateHUD();
        state = 'levelwin';
        GameAudio.goal();
        setTimeout(function () {
            if (state !== 'levelwin') return;
            buildLevel();
            state = 'aiming';
            updateHUD();
        }, 1300);
        return;
    }
    if (shotsLeft <= 0) {
        // No ammo and targets remain — let blocks settle, then game over
        state = 'paused';
        updateHUD();
        setTimeout(function () { if (state === 'paused') endGame(false); }, 900);
        return;
    }
    state = 'aiming';
    updateHUD();
}

/* ───────── Update ───────── */
function update(dt) {
    bgT += dt;
    if (levelIntro > 0) levelIntro = Math.max(0, levelIntro - dt);
    if (shake > 0) shake = Math.max(0, shake - dt * 40);

    updateBlocks(dt);

    // particles
    particles.update(dt);
    /* el bucle original también mataba las que caían fuera de pantalla */
    particles.each(function (p) { if (p.y > HEIGHT + 20) p.life = 0; });
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

    // projectile — substepped to avoid tunneling, bounces + punch-through
    if (state === 'flying' && projectile) {
        var pj = projectile;
        var sub = PHYS_SUB, sdt = dt / sub;
        for (var s = 0; s < sub; s++) {
            pj.vy += GRAVITY * sdt;
            pj.vx += wind * sdt;
            pj.x  += pj.vx * sdt;
            pj.y  += pj.vy * sdt;
            pj.spin += pj.vx * sdt * 0.06;

            // block collision (destroy + keep going with damped momentum)
            for (var b = 0; b < blocks.length; b++) {
                var t = blocks[b];
                if (!t.alive) continue;
                var cx = clamp(pj.x, t.x, t.x + t.w);
                var cy = clamp(pj.y, t.y, t.y + t.h);
                var ddx = pj.x - cx, ddy = pj.y - cy;
                if (ddx * ddx + ddy * ddy <= PROJ_RADIUS * PROJ_RADIUS) {
                    smashBlock(t);
                    pj.hits++;
                    pj.vx *= BLOCK_DAMP;
                    pj.vy *= BLOCK_DAMP;
                    break;
                }
            }

            // ground bounce / roll
            if (pj.y + PROJ_RADIUS >= GROUND_Y) {
                pj.y = GROUND_Y - PROJ_RADIUS;
                if (pj.vy > 40) {
                    pj.vy = -pj.vy * GROUND_REST;
                    pj.vx *= 0.74;
                    pj.bounces++;
                    spawnDust(pj.x);
                    GameAudio.hit();
                } else {
                    pj.vy = 0;
                    pj.vx *= 0.94;   // rolling friction
                }
            }
        }

        // trail
        if (pj.trail.length === 0 || pj.age % 0.02 < dt) {
            pj.trail.push({ x: pj.x, y: pj.y });
            if (pj.trail.length > 60) pj.trail.shift();
        }
        pj.age += dt;

        // end conditions
        var speed = Math.hypot(pj.vx, pj.vy);
        var rolledToStop = (pj.y + PROJ_RADIUS >= GROUND_Y - 1) && speed < 28;
        if (pj.x < -30 || pj.x > WIDTH + 30 || pj.age > 6 || rolledToStop) {
            if (pj.hits === 0) GameAudio.miss();
            endShot(pj.hits > 0);
        }
    }
}

/* ───────── Rendering ───────── */
var skyGrad = null;
function drawBackground() {
    if (!skyGrad) {
        skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        skyGrad.addColorStop(0, '#101d40');
        skyGrad.addColorStop(0.45, '#243463');
        skyGrad.addColorStop(0.8, '#3e3f78');
        skyGrad.addColorStop(1, '#6a5a86');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // stars (deterministic positions, gentle twinkle)
    for (var i = 0; i < 34; i++) {
        var sx = (i * 73) % WIDTH;
        var sy = (i * 41) % 340;
        var tw = 0.4 + 0.4 * Math.sin(bgT * 1.5 + i * 0.9);
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#ffffff';
        var ss = (i % 5 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, ss, ss);
    }
    ctx.globalAlpha = 1;

    // moon with craters
    ctx.fillStyle = '#f3eecf';
    ctx.beginPath(); ctx.arc(WIDTH - 54, 56, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,184,150,0.5)';
    ctx.beginPath(); ctx.arc(WIDTH - 62, 50, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(WIDTH - 47, 64, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(WIDTH - 52, 44, 2.4, 0, Math.PI * 2); ctx.fill();

    // far mountains (two ranges)
    ctx.fillStyle = '#1b274a';
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.lineTo(50, 360); ctx.lineTo(95, 400); ctx.lineTo(160, 340);
    ctx.lineTo(225, 392); ctx.lineTo(285, 352); ctx.lineTo(WIDTH, 398);
    ctx.lineTo(WIDTH, 460); ctx.lineTo(0, 460); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#26315c';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.lineTo(70, 410); ctx.lineTo(140, 450); ctx.lineTo(210, 405);
    ctx.lineTo(290, 448); ctx.lineTo(WIDTH, 415);
    ctx.lineTo(WIDTH, 480); ctx.lineTo(0, 480); ctx.closePath(); ctx.fill();

    // ground
    var gg = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    gg.addColorStop(0, '#5d7a3a');
    gg.addColorStop(0.18, '#3d5a24');
    gg.addColorStop(0.5, '#5a4226');
    gg.addColorStop(1, '#3a2a18');
    ctx.fillStyle = gg; ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // grass cap
    ctx.fillStyle = '#6bbf52';
    ctx.fillRect(0, GROUND_Y - 4, WIDTH, 6);
    ctx.fillStyle = '#8fe06a';
    ctx.fillRect(0, GROUND_Y - 4, WIDTH, 2);
    // grass tufts
    ctx.strokeStyle = '#7ad15f';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (var gi = 4; gi < WIDTH; gi += 11) {
        ctx.moveTo(gi, GROUND_Y - 4);
        ctx.lineTo(gi + ((gi % 3) - 1), GROUND_Y - 4 - (gi % 7 === 0 ? 5 : 3));
    }
    ctx.stroke();
}

function drawTopBar() {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, WIDTH, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Nv ' + level + '  Pts ' + score, 8, 13);

    // ammo dots
    var ax = 132;
    for (var i = 0; i < SHOTS_PER_LVL; i++) {
        ctx.beginPath();
        ctx.arc(ax + i * 13, 13, 4, 0, Math.PI * 2);
        if (i < shotsLeft) {
            var rg = ctx.createRadialGradient(ax + i * 13 - 1, 12, 0.5, ax + i * 13, 13, 4);
            rg.addColorStop(0, '#e0d4b5'); rg.addColorStop(1, '#7a6450');
            ctx.fillStyle = rg;
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
        }
        ctx.fill();
    }

    // wind arrow
    var cx = WIDTH - 78, cy = 13;
    ctx.fillStyle = '#cfd9ff'; ctx.textAlign = 'left';
    ctx.fillText('Viento', cx, cy);
    var len = clamp(Math.abs(wind) * 0.42, 4, 32);
    var dir = wind >= 0 ? 1 : -1;
    var ax2 = cx + 44;
    var col = dir > 0 ? '#8fd3f4' : '#ff8f6e';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax2, cy); ctx.lineTo(ax2 + dir * len, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax2 + dir * len, cy);
    ctx.lineTo(ax2 + dir * (len - 5), cy - 4);
    ctx.lineTo(ax2 + dir * (len - 5), cy + 4);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Boulder rest position (also the throwing-arm tip) given current drag
function boulderRest() {
    var cx = PIVOT_X, cy = PIVOT_Y - PROJ_RADIUS - 6;
    if (dragStart && dragCur) {
        var dx = dragCur.x - dragStart.x;
        var dy = dragCur.y - dragStart.y;
        var d = Math.hypot(dx, dy);
        var capped = Math.min(d, MAX_DRAG);
        cx = dragStart.x + (dx / (d || 1)) * capped;
        cy = dragStart.y + (dy / (d || 1)) * capped;
    }
    return { x: cx, y: cy };
}

function drawCatapult() {
    var baseY = GROUND_Y;
    // wheels
    ctx.fillStyle = '#2a2018';
    ctx.beginPath(); ctx.arc(PIVOT_X - 18, baseY + 2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(PIVOT_X + 18, baseY + 2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a4326';
    ctx.beginPath(); ctx.arc(PIVOT_X - 18, baseY + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(PIVOT_X + 18, baseY + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a130c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(PIVOT_X - 18, baseY + 2, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(PIVOT_X + 18, baseY + 2, 9, 0, Math.PI * 2); ctx.stroke();

    // base beam
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(PIVOT_X - 30, baseY - 8, 60, 9);
    ctx.fillStyle = '#855e30';
    ctx.fillRect(PIVOT_X - 30, baseY - 8, 60, 3);

    // A-frame support legs to the pivot
    ctx.strokeStyle = '#7a4e22';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PIVOT_X - 14, baseY - 6); ctx.lineTo(PIVOT_X, PIVOT_Y);
    ctx.moveTo(PIVOT_X + 14, baseY - 6); ctx.lineTo(PIVOT_X, PIVOT_Y);
    ctx.stroke();
    // crossbrace
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5e3c1a';
    ctx.beginPath();
    ctx.moveTo(PIVOT_X - 8, baseY - 26); ctx.lineTo(PIVOT_X + 8, baseY - 26);
    ctx.stroke();

    // pivot bolt
    ctx.fillStyle = '#3a2a18';
    ctx.beginPath(); ctx.arc(PIVOT_X, PIVOT_Y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';
}

function drawArmAndBoulder() {
    if (state !== 'aiming' && state !== 'idle' && state !== 'levelwin') return;
    var rest = boulderRest();

    // throwing arm: from pivot to the boulder cup
    ctx.strokeStyle = '#8a5a28';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(rest.x, rest.y);
    ctx.stroke();
    // arm highlight
    ctx.strokeStyle = '#a8743a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(rest.x, rest.y);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // tension ropes when pulling
    if (dragStart && dragCur) {
        ctx.strokeStyle = 'rgba(60,40,24,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PIVOT_X - 12, PIVOT_Y + 2); ctx.lineTo(rest.x, rest.y);
        ctx.moveTo(PIVOT_X + 12, PIVOT_Y + 2); ctx.lineTo(rest.x, rest.y);
        ctx.stroke();
        drawTrajectoryPreview(rest);
    }

    // boulder in cup
    drawBoulder(rest.x, rest.y, 0);
}

function drawBoulder(x, y, spin) {
    var g = ctx.createRadialGradient(x - 3.5, y - 3.5, 1, x, y, PROJ_RADIUS);
    g.addColorStop(0, '#cfc3a4');
    g.addColorStop(0.55, '#8a7a66');
    g.addColorStop(1, '#41382e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, PROJ_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1; ctx.stroke();
    // surface cracks rotate with spin
    ctx.save();
    ctx.translate(x, y); ctx.rotate(spin);
    ctx.strokeStyle = 'rgba(40,30,22,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-PROJ_RADIUS * 0.5, -2); ctx.lineTo(1, 1); ctx.lineTo(PROJ_RADIUS * 0.5, -3);
    ctx.moveTo(-2, PROJ_RADIUS * 0.5); ctx.lineTo(2, 0);
    ctx.stroke();
    ctx.restore();
}

function drawTrajectoryPreview(rest) {
    var dx = dragCur.x - dragStart.x;
    var dy = dragCur.y - dragStart.y;
    var d  = Math.hypot(dx, dy);
    if (d < 10) return;
    var capped = Math.min(d, MAX_DRAG);
    var vx = -(dx / d) * capped * LAUNCH_SCALE;
    var vy = -(dy / d) * capped * LAUNCH_SCALE;
    if (vy > -60) return;
    var org = launchOrigin();
    var px = org.x, py = org.y;
    // Mismo paso de integración que update() (dt/PHYS_SUB): con Euler
    // semi-implícito un dt distinto dibuja una parábola que no es la real.
    var sdt = (1 / 60) / PHYS_SUB;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 60 * PHYS_SUB; i++) {
        vy += GRAVITY * sdt;
        vx += wind * sdt;
        px += vx * sdt;
        py += vy * sdt;
        if (px < 0 || px > WIDTH) break;
        // stop preview at ground or a block
        if (py + PROJ_RADIUS >= GROUND_Y) break;
        if (i % PHYS_SUB === 0) {
            var blocked = false;
            for (var b = 0; b < blocks.length; b++) {
                var t = blocks[b];
                if (!t.alive) continue;
                if (px > t.x - PROJ_RADIUS && px < t.x + t.w + PROJ_RADIUS &&
                    py > t.y - PROJ_RADIUS && py < t.y + t.h + PROJ_RADIUS) { blocked = true; break; }
            }
            if (blocked) break;
        }
        if (i % (PHYS_SUB * 3) === 0) {
            ctx.globalAlpha = Math.max(0.15, 0.85 - (i / PHYS_SUB) * 0.013);
            ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    // power meter
    var pct = capped / MAX_DRAG;
    var barX = 10, barY = HEIGHT - 20, barW = 120, barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = 'hsl(' + (120 - pct * 120) + ',80%,55%)';
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
}

function drawBlocks() {
    for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (!b.alive) continue;
        var ox = 0, oy = 0;
        if (b.shake > 0) {
            ox = Math.sin(b.shake * 23.1 + i) * b.shake * 0.18;
        }
        var x = b.x + ox, y = b.y + oy;

        if (b.type === 'tnt') {
            // red crate
            ctx.fillStyle = '#b8342a';
            ctx.fillRect(x, y, b.w, b.h);
            ctx.fillStyle = '#8e231c';
            ctx.fillRect(x, y + b.h - 4, b.w, 4);
            // plank cross
            ctx.strokeStyle = '#5e1812'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x + b.w, y + b.h);
            ctx.moveTo(x + b.w, y); ctx.lineTo(x, y + b.h);
            ctx.stroke();
            // TNT label
            ctx.fillStyle = '#ffe08a';
            ctx.fillRect(x + 3, y + b.h / 2 - 4, b.w - 6, 8);
            ctx.fillStyle = '#7a1f17';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('TNT', x + b.w / 2, y + b.h / 2 + 0.5);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            // blinking fuse light
            var fl = 0.5 + 0.5 * Math.sin(b.fuse);
            ctx.fillStyle = 'rgba(255,' + Math.floor(120 + fl * 120) + ',40,' + (0.6 + fl * 0.4) + ')';
            ctx.beginPath(); ctx.arc(x + b.w - 4, y + 4, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (b.type === 'wood') {
            var wg = ctx.createLinearGradient(x, y, x, y + b.h);
            wg.addColorStop(0, 'hsl(30,42%,' + (54 + b.shade) + '%)');
            wg.addColorStop(1, 'hsl(28,46%,' + (34 + b.shade) + '%)');
            ctx.fillStyle = wg;
            ctx.fillRect(x, y, b.w, b.h);
            // plank lines
            ctx.strokeStyle = 'rgba(60,38,18,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + b.h * 0.5); ctx.lineTo(x + b.w, y + b.h * 0.5);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x, y, b.w, 2);
            // bolts
            ctx.fillStyle = '#3a2614';
            ctx.beginPath(); ctx.arc(x + 4, y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + b.w - 4, y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
        } else {
            // stone block with brick seams
            var sg = ctx.createLinearGradient(x, y, x, y + b.h);
            sg.addColorStop(0, 'hsl(210,12%,' + (66 + b.shade) + '%)');
            sg.addColorStop(1, 'hsl(212,14%,' + (40 + b.shade) + '%)');
            ctx.fillStyle = sg;
            ctx.fillRect(x, y, b.w, b.h);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fillRect(x, y, b.w, 2);
            ctx.fillStyle = 'rgba(30,40,48,0.6)';
            ctx.fillRect(x, y + b.h - 3, b.w, 3);
            ctx.strokeStyle = 'rgba(40,52,60,0.55)'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + b.h * 0.5); ctx.lineTo(x + b.w, y + b.h * 0.5);
            ctx.moveTo(x + b.w * 0.5, y); ctx.lineTo(x + b.w * 0.5, y + b.h * 0.5);
            ctx.moveTo(x + b.w * 0.3, y + b.h * 0.5); ctx.lineTo(x + b.w * 0.3, y + b.h);
            ctx.moveTo(x + b.w * 0.7, y + b.h * 0.5); ctx.lineTo(x + b.w * 0.7, y + b.h);
            ctx.stroke();
        }

        // outline
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1);

        // hit flash
        if (b.flash > 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + (b.flash * 2.5) + ')';
            ctx.fillRect(x, y, b.w, b.h);
        }
    }
}

function drawTrails() {
    for (var i = 0; i < trails.length; i++) {
        var tr = trails[i];
        var a = tr.life / 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var k = 0; k < tr.pts.length; k++) {
            var pt = tr.pts[k];
            if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
}

function drawProjectile() {
    if (!projectile) return;
    var pj = projectile;
    if (pj.trail.length > 1) {
        ctx.strokeStyle = 'rgba(255,200,90,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pj.trail[0].x, pj.trail[0].y);
        for (var k = 1; k < pj.trail.length; k++) ctx.lineTo(pj.trail[k].x, pj.trail[k].y);
        ctx.stroke();
    }
    drawBoulder(pj.x, pj.y, pj.spin);
}

function drawParticles() {
    particles.draw(ctx);
}

function drawFloatTexts() {
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < floatTexts.length; i++) {
        var f = floatTexts[i];
        ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
        ctx.fillStyle = '#000';
        ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = '#ffd866';
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawBanner(text, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HEIGHT / 2 - 44, WIDTH, sub ? 86 : 60);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 - (sub ? 12 : 0));
    if (sub) {
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText(sub, WIDTH / 2, HEIGHT / 2 + 18);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawOverlays() {
    if (state === 'levelwin') drawBanner('¡Nivel Superado!', null);
    else if (state === 'idle') drawBanner('Pulsa Iniciar', 'Arrastra hacia atrás para lanzar');
    else if (levelIntro > 0 && state === 'aiming') {
        ctx.globalAlpha = Math.min(1, levelIntro / 0.5);
        drawBanner('Nivel ' + level, 'Tiros: ' + shotsLeft + '   Viento: ' + (wind >= 0 ? '→' : '←'));
        ctx.globalAlpha = 1;
    }
}

/* ───────── Main loop ───────── */
function render() {
    ctx.save();
    if (shake > 0) {
        var sx = Math.sin(shake * 12.9898) * shake * 0.5;
        var sy = Math.cos(shake * 78.233) * shake * 0.5;
        ctx.translate(sx, sy);
    }
    drawBackground();
    drawTrails();
    drawBlocks();
    drawCatapult();
    drawArmAndBoulder();
    drawProjectile();
    drawParticles();
    drawFloatTexts();
    drawOverlays();
    ctx.restore();
    drawTopBar();
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

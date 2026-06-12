// Minero de Oro — classic pendulum-hook gold-grabber.
// Un toque lanza el gancho que oscila como péndulo.
// Engancha pepitas, diamantes, bolsas o rocas. El peso define la velocidad de retracción.
// Alcanza la cuota antes de que se acabe el tiempo para subir de nivel.

var canvas = document.getElementById('mineroCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;   // 360
var HEIGHT = canvas.height;  // 560

var GROUND_Y = 135;
var MINER_X  = WIDTH / 2;
var MINER_Y  = 60;
var HOOK_ORIGIN_X = MINER_X;
var HOOK_ORIGIN_Y = MINER_Y + 30;   // sale de la polea
var HOOK_MIN_LEN  = 28;
var MAX_ANGLE     = 1.10;           // ~63°
var EXTEND_SPEED  = 5.0;
var RETRACT_BASE  = 6.0;

var OBJECT_TYPES = {
    gold_small: { r: 11, value: 50,  weight: 1.4, color: '#f5c542', kind: 'gold' },
    gold_med:   { r: 16, value: 100, weight: 2.2, color: '#f5c542', kind: 'gold' },
    gold_big:   { r: 22, value: 250, weight: 3.2, color: '#f5c542', kind: 'gold' },
    diamond_sm: { r: 9,  value: 300, weight: 0.7, color: '#7fe0ff', kind: 'diamond' },
    diamond_lg: { r: 12, value: 500, weight: 1.0, color: '#7fe0ff', kind: 'diamond' },
    rock_sm:    { r: 14, value: 15,  weight: 3.0, color: '#8a847c', kind: 'rock' },
    rock_lg:    { r: 22, value: 25,  weight: 4.5, color: '#726c66', kind: 'rock' },
    bag:        { r: 16, value: 0,   weight: 1.8, color: '#a0632b', kind: 'bag' }
};

// estado
var hook = { angle: 0, angleT: 0, angleSpeed: 0.03, len: HOOK_MIN_LEN, state: 'swing', grabbed: null };
var objects = [];
var particles = [];
var popups = [];
var score = 0;
var level = 1;
var quota = 700;
var timeLeft = 60;
var timeTotal = 60;
var lastTickWarn = -1;
var bestScore = parseInt(localStorage.getItem('mineroBest') || '0', 10);
var isPlaying = false;
var isGameOver = false;
var isLevelTransition = false;
var levelTransitionT = 0;
var animFrameId = null;
var lastT = 0;
var shake = 0;
var flashAlpha = 0;
var shakeOffX = 0;
var shakeOffY = 0;
var wheelRot = 0;

var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var levelEl      = document.getElementById('level');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var popupTitle   = document.getElementById('popupTitle');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');

highScoreEl.textContent = bestScore;

/* ──────────────────────── Generación de objetos ─────────────────── */
function seedObjects() {
    objects = [];
    var distribution;
    if (level === 1)      distribution = ['gold_small','gold_small','gold_med','gold_med','gold_big','rock_sm','diamond_sm'];
    else if (level === 2) distribution = ['gold_small','gold_med','gold_med','gold_big','rock_sm','rock_lg','diamond_sm','bag'];
    else if (level === 3) distribution = ['gold_med','gold_big','gold_big','rock_sm','rock_sm','rock_lg','diamond_sm','diamond_lg','bag'];
    else                  distribution = ['gold_med','gold_big','gold_big','rock_sm','rock_lg','rock_lg','diamond_sm','diamond_lg','bag','bag'];

    var needs = 7 + Math.min(level, 5);
    for (var i = 0; i < needs; i++) {
        var typeKey = distribution[Math.floor(Math.random() * distribution.length)];
        var t = OBJECT_TYPES[typeKey];
        for (var a = 0; a < 80; a++) {
            var px = t.r + 10 + Math.random() * (WIDTH - 2 * (t.r + 10));
            var py = GROUND_Y + 40 + t.r + Math.random() * (HEIGHT - GROUND_Y - 70 - 2 * t.r);
            var ok = true;
            for (var j = 0; j < objects.length; j++) {
                var o = objects[j];
                var dx = o.x - px, dy = o.y - py;
                if (dx * dx + dy * dy < (o.r + t.r + 6) * (o.r + t.r + 6)) { ok = false; break; }
            }
            if (ok) {
                var val = (t.kind === 'bag') ? (80 + Math.floor(Math.random() * 180)) : t.value;
                objects.push({
                    x: px, y: py, r: t.r,
                    value: val, weight: t.weight,
                    color: t.color, kind: t.kind, type: typeKey,
                    rot: Math.random() * Math.PI * 2,
                    grabbed: false
                });
                break;
            }
        }
    }
}

/* ──────────────────────── Nivel / reset ─────────────────────────── */
function startLevel() {
    seedObjects();
    hook.angle = 0;
    hook.angleT = 0;
    hook.angleSpeed = 0.025 + 0.004 * (level - 1);
    hook.len = HOOK_MIN_LEN;
    hook.state = 'swing';
    hook.grabbed = null;
    timeTotal = Math.max(30, 60 - (level - 1) * 5);
    timeLeft = timeTotal;
    lastTickWarn = -1;
    levelEl.textContent = level;
    updateMobileScore();
}

function resetGame() {
    score = 0;
    level = 1;
    quota = 700;
    particles = [];
    popups = [];
    shake = 0;
    flashAlpha = 0;
    isGameOver = false;
    isLevelTransition = false;
    levelTransitionT = 0;
    startLevel();
    scoreEl.textContent = '0';
    updateMobileScore();
}

function updateMobileScore() {
    if (mobileScoreEl) mobileScoreEl.textContent =
        'Oro ' + score + '/' + quota + '  ·  Nv ' + level + '  ·  ' + Math.ceil(timeLeft) + 's';
}

/* ──────────────────────── Acción: lanzar gancho ─────────────────── */
function launchHook() {
    if (!isPlaying || isLevelTransition) return;
    if (hook.state !== 'swing') return;
    hook.state = 'extend';
    GameAudio.shoot();
}

function hookTipPos(len) {
    var l = (len === undefined) ? hook.len : len;
    return {
        x: HOOK_ORIGIN_X + Math.sin(hook.angle) * l,
        y: HOOK_ORIGIN_Y + Math.cos(hook.angle) * l
    };
}

/* ──────────────────────── Update ────────────────────────────────── */
function update(dt) {
    if (shake > 0) {
        shake -= dt * 0.8;
        shakeOffX = (Math.random() - 0.5) * shake;
        shakeOffY = (Math.random() - 0.5) * shake;
    } else {
        shakeOffX = 0; shakeOffY = 0;
    }
    if (flashAlpha > 0) flashAlpha -= dt * 0.025;

    if (!isPlaying) return;

    if (isLevelTransition) {
        levelTransitionT += dt;
        wheelRot += 0.08 * dt;
        if (levelTransitionT > 90) {
            isLevelTransition = false;
            level++;
            quota += 500;
            startLevel();
        }
        return;
    }

    // temporizador
    timeLeft -= dt / 60;
    var secs = Math.ceil(timeLeft);
    if (secs <= 5 && secs > 0 && secs !== lastTickWarn) {
        lastTickWarn = secs;
        GameAudio.tick();
    }
    if (timeLeft <= 0) {
        timeLeft = 0;
        endGame();
        return;
    }

    // hook
    if (hook.state === 'swing') {
        hook.angleT += hook.angleSpeed * dt;
        hook.angle = MAX_ANGLE * Math.sin(hook.angleT);
    } else if (hook.state === 'extend') {
        var stepDt = Math.min(dt, 1.5);
        var prev = hookTipPos();
        hook.len += EXTEND_SPEED * stepDt;
        wheelRot += 0.18 * stepDt;
        var tip = hookTipPos();

        // muros y fondo
        if (tip.x < 6 || tip.x > WIDTH - 6 || tip.y > HEIGHT - 6) {
            hook.state = 'retract';
            hook.grabbed = null;
            GameAudio.hit();
        } else if (tip.y > GROUND_Y - 2) {
            // colisión barrida (segmento prev→tip contra cada objeto)
            for (var i = 0; i < objects.length; i++) {
                var o = objects[i];
                if (o.grabbed) continue;
                var d = segPointDist(prev.x, prev.y, tip.x, tip.y, o.x, o.y);
                if (d < o.r + 3) {
                    hook.state = 'retract';
                    hook.grabbed = o;
                    o.grabbed = true;
                    if (o.kind === 'diamond')       GameAudio.scoreHigh();
                    else if (o.kind === 'rock')     GameAudio.place();
                    else if (o.kind === 'bag')      GameAudio.powerUp();
                    else                            GameAudio.score();
                    break;
                }
            }
        }
    } else if (hook.state === 'retract') {
        var rs = RETRACT_BASE;
        if (hook.grabbed) rs = RETRACT_BASE / hook.grabbed.weight;
        hook.len -= rs * dt;
        wheelRot -= 0.14 * dt;
        if (hook.grabbed) {
            var tt = hookTipPos();
            hook.grabbed.x = tt.x;
            hook.grabbed.y = tt.y;
        }
        if (hook.len <= HOOK_MIN_LEN) {
            hook.len = HOOK_MIN_LEN;
            if (hook.grabbed) {
                var v = hook.grabbed.value;
                score += v;
                var idx = objects.indexOf(hook.grabbed);
                if (idx >= 0) objects.splice(idx, 1);
                popups.push({
                    x: HOOK_ORIGIN_X, y: MINER_Y + 50, val: v,
                    age: 0, life: 56,
                    color: hook.grabbed.kind === 'diamond' ? '#7fe0ff'
                         : hook.grabbed.kind === 'rock'    ? '#c9c4bf'
                         : hook.grabbed.kind === 'bag'     ? '#f3a95a'
                         : '#ffd93d'
                });
                spawnParticles(HOOK_ORIGIN_X, MINER_Y + 36, hook.grabbed.color, 10);
                scoreEl.textContent = score;
                updateMobileScore();

                if (score >= quota) {
                    isLevelTransition = true;
                    levelTransitionT = 0;
                    flashAlpha = 0.45;
                    bestCheck();
                    GameAudio.win();
                }
            }
            hook.grabbed = null;
            hook.state = 'swing';
        }
    }

    // partículas
    for (var p = particles.length - 1; p >= 0; p--) {
        var pt = particles[p];
        pt.age += dt;
        pt.vy += 0.12 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.age >= pt.life) particles.splice(p, 1);
    }
    // popups
    for (var q = popups.length - 1; q >= 0; q--) {
        popups[q].age += dt;
        popups[q].y -= 0.6 * dt;
        if (popups[q].age >= popups[q].life) popups.splice(q, 1);
    }
}

/* distancia punto-segmento cuadrada → raíz al final */
function segPointDist(ax, ay, bx, by, px, py) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    if (l2 === 0) {
        var ddx = px - ax, ddy = py - ay;
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    var t = ((px - ax) * dx + (py - ay) * dy) / l2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var cx = ax + t * dx, cy = ay + t * dy;
    var ex = px - cx, ey = py - cy;
    return Math.sqrt(ex * ex + ey * ey);
}

function spawnParticles(cx, cy, color, n) {
    for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = 1.2 + Math.random() * 2.4;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 0.8,
            life: 26 + Math.random() * 14,
            age: 0,
            color: color,
            size: 1.6 + Math.random() * 2
        });
    }
}

function bestCheck() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('mineroBest', String(bestScore));
        highScoreEl.textContent = bestScore;
    }
}

function endGame() {
    isPlaying = false;
    isGameOver = true;
    bestCheck();
    shake = 14;
    flashAlpha = 0.5;
    GameAudio.gameOver();
    setTimeout(function () {
        popup.style.display = 'flex';
        popupTitle.textContent = '¡Se acabó el tiempo!';
        finalScoreEl.textContent = 'Oro: ' + score + ' · Nivel ' + level;
        finalBestEl.textContent  = (score > 0 && score >= bestScore) ? '¡Nuevo récord!' : 'Récord: ' + bestScore;
        restartBtn.disabled = false;
    }, 700);
}

/* ──────────────────────── Render ────────────────────────────────── */
function drawBackground() {
    // cielo
    var gSky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gSky.addColorStop(0, '#0f1f44');
    gSky.addColorStop(1, '#3d5d99');
    ctx.fillStyle = gSky;
    ctx.fillRect(0, 0, WIDTH, GROUND_Y);
    // estrellas (deterministas)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 0; i < 22; i++) {
        var sx = (i * 47) % WIDTH;
        var sy = (i * 29) % (GROUND_Y - 20) + 4;
        var ss = (i % 4 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, ss, ss);
    }
    // luna
    ctx.fillStyle = '#fbe89d';
    ctx.beginPath();
    ctx.arc(WIDTH - 42, 32, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f1f44';
    ctx.beginPath();
    ctx.arc(WIDTH - 36, 28, 12, 0, Math.PI * 2);
    ctx.fill();

    // tierra
    var gDirt = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    gDirt.addColorStop(0, '#6a3d1e');
    gDirt.addColorStop(0.15, '#4a2a12');
    gDirt.addColorStop(1, '#1a0f08');
    ctx.fillStyle = gDirt;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // hierba
    ctx.fillStyle = '#3d7a2e';
    ctx.fillRect(0, GROUND_Y - 4, WIDTH, 5);
    ctx.fillStyle = '#2d5a1f';
    for (var g2 = 0; g2 < WIDTH; g2 += 6) {
        ctx.fillRect(g2, GROUND_Y - 6, 2, 3);
    }
    // granitos de tierra (deterministas)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (var di = 0; di < 55; di++) {
        var dx = (di * 71 + 13) % WIDTH;
        var dy = GROUND_Y + 14 + (di * 83 + 7) % (HEIGHT - GROUND_Y - 28);
        ctx.fillRect(dx, dy, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,200,140,0.07)';
    for (var si = 0; si < 30; si++) {
        var sxr = (si * 53 + 11) % WIDTH;
        var syr = GROUND_Y + 24 + (si * 37 + 17) % (HEIGHT - GROUND_Y - 40);
        ctx.fillRect(sxr, syr, 2, 2);
    }
}

function drawMiner() {
    // plataforma
    ctx.fillStyle = '#8a6138';
    ctx.fillRect(MINER_X - 44, GROUND_Y - 4, 88, 4);
    ctx.fillStyle = '#5a3e22';
    ctx.fillRect(MINER_X - 44, GROUND_Y, 88, 2);

    // brazo polea (mástil)
    ctx.fillStyle = '#b59264';
    ctx.fillRect(MINER_X - 3, MINER_Y - 8, 6, 40);
    ctx.fillStyle = '#7a5432';
    ctx.fillRect(MINER_X - 3, MINER_Y - 8, 6, 2);

    // polea
    var wx = MINER_X, wy = HOOK_ORIGIN_Y;
    ctx.fillStyle = '#2a1c0a';
    ctx.beginPath();
    ctx.arc(wx, wy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6138';
    ctx.beginPath();
    ctx.arc(wx, wy, 7, 0, Math.PI * 2);
    ctx.fill();
    // radios (giran con wheelRot)
    ctx.strokeStyle = '#2a1c0a';
    ctx.lineWidth = 1.5;
    for (var sp = 0; sp < 4; sp++) {
        var a = wheelRot + sp * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * 6, wy + Math.sin(a) * 6);
        ctx.stroke();
    }
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.arc(wx, wy, 2, 0, Math.PI * 2);
    ctx.fill();

    // minero (derecha)
    var mx = MINER_X + 30;
    var my = MINER_Y + 6;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(mx, GROUND_Y - 2, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // torso
    ctx.fillStyle = '#c94b3a';
    ctx.fillRect(mx - 8, my + 12, 16, 16);
    // cinturón
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(mx - 8, my + 26, 16, 3);
    // brazos
    ctx.fillStyle = '#c94b3a';
    ctx.fillRect(mx - 14, my + 14, 6, 5);
    ctx.fillRect(mx + 8, my + 14, 6, 5);
    // cuerda de brazo izquierdo a polea
    ctx.strokeStyle = '#d8b070';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx - 14, my + 17);
    ctx.quadraticCurveTo((MINER_X + mx - 14) / 2, my + 6, MINER_X, HOOK_ORIGIN_Y - 2);
    ctx.stroke();
    // cabeza
    ctx.fillStyle = '#f5c29a';
    ctx.beginPath();
    ctx.arc(mx, my + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    // bigote
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(mx - 4, my + 8, 8, 1.5);
    // casco
    ctx.fillStyle = '#e6b800';
    ctx.beginPath();
    ctx.arc(mx, my + 3, 7.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(mx - 9, my + 2, 18, 3);
    // franja del casco
    ctx.fillStyle = '#b38c00';
    ctx.fillRect(mx - 9, my + 4, 18, 1);
    // lámpara
    ctx.fillStyle = '#fff7a0';
    ctx.fillRect(mx - 2, my + 0, 4, 2.5);
    // piernas
    ctx.fillStyle = '#2a3748';
    ctx.fillRect(mx - 7, my + 29, 6, 9);
    ctx.fillRect(mx + 1, my + 29, 6, 9);
    // botas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(mx - 8, my + 35, 7, 3);
    ctx.fillRect(mx + 1, my + 35, 7, 3);
}

function drawRopeAndHook() {
    var tip = hookTipPos();
    // cuerda
    ctx.strokeStyle = '#d8b070';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(HOOK_ORIGIN_X, HOOK_ORIGIN_Y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // gancho
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(hook.angle);
    // base
    ctx.fillStyle = '#b0b0b0';
    ctx.fillRect(-2, -6, 4, 6);
    // anilla
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8, 3, 0, Math.PI * 2);
    ctx.stroke();
    // V del gancho
    ctx.strokeStyle = '#e4e4e4';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.quadraticCurveTo(-6, 8, 0, 8);
    ctx.moveTo(5, -1);
    ctx.quadraticCurveTo(6, 8, 0, 8);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
}

/* ── Dibujo de objetos ── */
function drawObject(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    if (o.kind === 'gold')         drawGold(o.r);
    else if (o.kind === 'diamond') drawDiamond(o.r);
    else if (o.kind === 'rock')    drawRock(o.r);
    else if (o.kind === 'bag')     drawBag(o.r);
    ctx.restore();
}

function drawGold(r) {
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(2, r + 2, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // cuerpo de la pepita (polígono)
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 1.1);
    g.addColorStop(0, '#fff3a8');
    g.addColorStop(0.5, '#f5c542');
    g.addColorStop(1, '#9e7518');
    ctx.fillStyle = g;
    ctx.beginPath();
    var sides = 8;
    for (var i = 0; i < sides; i++) {
        var a  = i / sides * Math.PI * 2;
        var rr = r * (0.85 + 0.18 * Math.sin(i * 3.1 + 1.1));
        var px = Math.cos(a) * rr;
        var py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // contorno
    ctx.strokeStyle = '#6b4a12';
    ctx.lineWidth = 1;
    ctx.stroke();
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawDiamond(r) {
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, r + 2, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // cuerpo rombo
    var g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#e4faff');
    g.addColorStop(0.5, '#58c7ff');
    g.addColorStop(1, '#1f6fa0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, -r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    // facetas
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();
    // chispa
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -r + 2, 2, 4);
    ctx.fillRect(-r + 2, -1, 4, 2);
}

function drawRock(r) {
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, r + 2, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // cuerpo
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#bdb6ae');
    g.addColorStop(1, '#3f3a34');
    ctx.fillStyle = g;
    ctx.beginPath();
    var sides = 10;
    for (var i = 0; i < sides; i++) {
        var a  = i / sides * Math.PI * 2;
        var rr = r * (0.85 + 0.2 * Math.sin(i * 2.3 + 0.7));
        var px = Math.cos(a) * rr;
        var py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a2622';
    ctx.lineWidth = 1;
    ctx.stroke();
    // manchas
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(r * 0.2, -r * 0.1, 3, 2);
    ctx.fillRect(-r * 0.3, r * 0.25, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-r * 0.4, -r * 0.4, 3, 2);
}

function drawBag(r) {
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, r + 2, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // cuerpo bolsa
    var g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#c27a3b');
    g.addColorStop(1, '#6e3e15');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.15, 0, -r * 0.5, -r * 0.6);
    ctx.lineTo(r * 0.5, -r * 0.6);
    ctx.quadraticCurveTo(r * 1.15, 0, r * 0.95, r * 0.9);
    ctx.quadraticCurveTo(0, r * 1.15, -r * 0.95, r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // cuello
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.6);
    ctx.lineTo(r * 0.5, -r * 0.6);
    ctx.stroke();
    // símbolo dinero — trazos geométricos, no emoji
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    // S
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.25, 0.4, Math.PI * 1.2, false);
    ctx.arc(0, r * 0.2,  r * 0.25, Math.PI + 0.4, Math.PI * 2.2, false);
    ctx.stroke();
    // línea vertical
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(0, r * 0.55);
    ctx.stroke();
    ctx.lineCap = 'butt';
}

/* ── Línea de mira tenue durante swing para guía visual ── */
function drawAimGuide() {
    if (hook.state !== 'swing') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 235, 160, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    var far = 80;
    ctx.beginPath();
    ctx.moveTo(HOOK_ORIGIN_X + Math.sin(hook.angle) * HOOK_MIN_LEN,
               HOOK_ORIGIN_Y + Math.cos(hook.angle) * HOOK_MIN_LEN);
    ctx.lineTo(HOOK_ORIGIN_X + Math.sin(hook.angle) * (HOOK_MIN_LEN + far),
               HOOK_ORIGIN_Y + Math.cos(hook.angle) * (HOOK_MIN_LEN + far));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

/* ── HUD ── */
function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, WIDTH, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Oro ' + score + ' / ' + quota, 8, 14);
    ctx.textAlign = 'center';
    ctx.fillStyle = (timeLeft <= 5) ? '#ff6b6b' : '#fff';
    ctx.fillText(Math.ceil(timeLeft) + 's', WIDTH / 2, 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText('Nivel ' + level, WIDTH - 8, 14);
    ctx.textBaseline = 'alphabetic';

    // barra de progreso de cuota
    var pct = Math.min(1, score / quota);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(8, 30, WIDTH - 16, 4);
    var gg = ctx.createLinearGradient(8, 0, WIDTH - 8, 0);
    gg.addColorStop(0, '#8fd3f4');
    gg.addColorStop(1, '#ffd93d');
    ctx.fillStyle = gg;
    ctx.fillRect(8, 30, (WIDTH - 16) * pct, 4);
}

function drawParticles() {
    for (var k = 0; k < particles.length; k++) {
        var pt = particles[k];
        var a = 1 - pt.age / pt.life;
        if (a < 0) a = 0;
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
}

function drawPopups() {
    for (var m = 0; m < popups.length; m++) {
        var pp = popups[m];
        var a = 1 - pp.age / pp.life;
        if (a < 0) a = 0;
        ctx.globalAlpha = a;
        ctx.fillStyle = pp.color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+' + pp.val, pp.x, pp.y);
    }
    ctx.globalAlpha = 1;
}

function drawWelcome() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, HEIGHT / 2 - 72, WIDTH, 150);
    ctx.fillStyle = '#ffd93d';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MINERO DE ORO', WIDTH / 2, HEIGHT / 2 - 30);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '14px monospace';
    ctx.fillText('Un toque lanza el gancho.', WIDTH / 2, HEIGHT / 2 - 4);
    ctx.fillText('Atrapa oro y diamantes.', WIDTH / 2, HEIGHT / 2 + 16);
    ctx.fillStyle = '#fff';
    ctx.fillText('Toca o pulsa para empezar', WIDTH / 2, HEIGHT / 2 + 50);
}

function drawTransition() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HEIGHT / 2 - 60, WIDTH, 120);
    ctx.fillStyle = '#ffd93d';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('¡CUOTA ALCANZADA!', WIDTH / 2, HEIGHT / 2 - 14);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Nivel ' + (level + 1) + ' — cuota ' + (quota + 500), WIDTH / 2, HEIGHT / 2 + 14);
    ctx.fillText(Math.max(30, 60 - level * 5) + 's · ¡Prepárate!', WIDTH / 2, HEIGHT / 2 + 34);
}

function render() {
    ctx.save();
    if (shake > 0) ctx.translate(shakeOffX, shakeOffY);

    drawBackground();
    drawMiner();
    drawAimGuide();

    // objetos
    for (var i = 0; i < objects.length; i++) drawObject(objects[i]);

    drawRopeAndHook();
    drawParticles();
    drawPopups();

    ctx.restore();

    drawHUD();

    if (flashAlpha > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha.toFixed(3) + ')';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (isLevelTransition) drawTransition();
    if (!isPlaying && !isGameOver) drawWelcome();
}

/* ──────────────────────── Loop ──────────────────────────────────── */
function loop(ts) {
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 16.67;
    if (dt > 3) dt = 3;
    lastT = ts;
    update(dt);
    render();
    animFrameId = requestAnimationFrame(loop);
}

/* ──────────────────────── Controles ─────────────────────────────── */
function handleInput(e) {
    if (e && e.type === 'keydown') {
        if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowDown') return;
        e.preventDefault();
    }
    if (!isPlaying) {
        if (isGameOver) return;
        startGame();
        return;
    }
    launchHook();
}

canvas.addEventListener('mousedown', function (e) { handleInput(e); });
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); handleInput(e); }, { passive: false });
document.addEventListener('keydown', handleInput);

startBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click', function () {
    GameAudio.click();
    popup.style.display = 'none';
    startGame();
});
playAgainBtn.addEventListener('click', function () {
    GameAudio.click();
    popup.style.display = 'none';
    startGame();
});

function startGame() {
    popup.style.display = 'none';
    isGameOver = false;
    isPlaying = true;
    restartBtn.disabled = false;
    resetGame();
    GameAudio.start();
    if (!animFrameId) {
        lastT = 0;
        animFrameId = requestAnimationFrame(loop);
    }
}

/* pantalla inicial */
resetGame();
isPlaying = false;
if (!animFrameId) {
    lastT = 0;
    animFrameId = requestAnimationFrame(loop);
}

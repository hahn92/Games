// Apilador de Bloques — Stack Tower
// Pulsa/click/espacio para soltar el bloque. Solo queda la parte que coincide con la pila.
var canvas = document.getElementById('stackCanvas');
var ctx = canvas.getContext('2d');

var WIDTH  = canvas.width;   // 360
var HEIGHT = canvas.height;  // 560

var BLOCK_H        = 24;
var INITIAL_WIDTH  = 180;
var BASE_SPEED     = 2.2;
var SPEED_MAX      = 5.5;
var GRAVITY        = 0.45;
var VIEW_TOP       = 120;     // bloque activo oscila alrededor de esta Y (en screen-space)
var TARGET_TOP     = 90;      // cuando la torre crece, la parte superior se desplaza a esta línea

// Estado
var stack = [];                // bloques ya colocados: {x, w, y, hue, bounceAmp, bounceTime}
var activeBlock = null;        // bloque en movimiento horizontal
var fallingPieces = [];        // fragmentos que caen al fallar
var particles = [];            // chispas de éxito
var perfectPops = [];          // texto flotante "¡Perfecto!"
var cameraY = 0;               // desplazamiento de la cámara (world y → screen y = world_y + cameraY)
var targetCameraY = 0;
var score = 0;
var bestScore = parseInt(localStorage.getItem('stackTowerBest') || '0', 10);
var isPlaying = false;
var isGameOver = false;
var shake = 0;
var flashAlpha = 0;
var animFrameId = null;
var lastT = 0;
var hueBase = 200;             // hue de arranque; cambia a medida que sube
var comboPerfect = 0;

var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');

highScoreEl.textContent = bestScore;

/* ──────────────────────── Inicio / reset ───────────────────────── */
function resetGame() {
    stack = [];
    fallingPieces = [];
    particles = [];
    perfectPops = [];
    cameraY = 0;
    targetCameraY = 0;
    score = 0;
    shake = 0;
    flashAlpha = 0;
    comboPerfect = 0;
    hueBase = 200;
    // base inicial (centrada)
    var baseX = (WIDTH - INITIAL_WIDTH) / 2;
    var baseY = HEIGHT - BLOCK_H - 30;      // pegada al suelo
    stack.push({ x: baseX, w: INITIAL_WIDTH, y: baseY, hue: hueBase, bounceAmp: 0, bounceTime: 0 });
    spawnActiveBlock();
    scoreEl.textContent = '0';
    updateMobileScore();
}

function spawnActiveBlock() {
    var top = stack[stack.length - 1];
    var speed = Math.min(BASE_SPEED + score * 0.08, SPEED_MAX);
    var dir = Math.random() < 0.5 ? 1 : -1;
    activeBlock = {
        x: dir > 0 ? -top.w : WIDTH,
        w: top.w,
        y: top.y - BLOCK_H,
        vx: speed * dir,
        hue: (hueBase + score * 9) % 360
    };
}

/* ──────────────────────── Drop action ──────────────────────────── */
function dropBlock() {
    if (!isPlaying || !activeBlock) return;
    var top  = stack[stack.length - 1];
    var a    = activeBlock;
    var newX = Math.max(a.x, top.x);
    var newR = Math.min(a.x + a.w, top.x + top.w);
    var newW = newR - newX;

    if (newW <= 0) {
        // Falla total → game over
        // Todo el bloque cae
        fallingPieces.push({ x: a.x, y: a.y, w: a.w, h: BLOCK_H, vy: -2, vx: a.vx * 0.3, rot: 0, vr: (Math.random() - 0.5) * 0.1, hue: a.hue });
        activeBlock = null;
        GameAudio.gameOver();
        endGame();
        return;
    }

    // ¿Perfecto? tolerancia 3 px
    var perfect = Math.abs(a.x - top.x) < 3 && Math.abs(a.w - top.w) < 3;
    if (perfect) {
        comboPerfect++;
        newX = top.x;
        newW = top.w;
        spawnPerfectPop(newX + newW / 2, a.y);
        spawnParticles(newX + newW / 2, a.y + BLOCK_H / 2, a.hue, 14);
        GameAudio.scoreHigh();
    } else {
        comboPerfect = 0;
        // parte sobrante cae
        if (a.x < newX) {
            var lw = newX - a.x;
            fallingPieces.push({ x: a.x, y: a.y, w: lw, h: BLOCK_H, vy: 0, vx: -1.2, rot: 0, vr: -0.06, hue: a.hue });
        }
        if (a.x + a.w > newR) {
            var rw = (a.x + a.w) - newR;
            fallingPieces.push({ x: newR, y: a.y, w: rw, h: BLOCK_H, vy: 0, vx: 1.2, rot: 0, vr: 0.06, hue: a.hue });
        }
        GameAudio.place();
    }

    // Colocar el bloque con rebote visual
    stack.push({ x: newX, w: newW, y: a.y, hue: a.hue, bounceAmp: perfect ? 3 : 1.5, bounceTime: 14 });

    score++;
    scoreEl.textContent = score;
    updateMobileScore();
    if (score % 5 === 0) GameAudio.win();

    // Cámara: si la pila supera TARGET_TOP, deslizarla hacia abajo para que siga visible
    var newTopY = a.y;
    var screenTopY = newTopY + cameraY;
    if (screenTopY < TARGET_TOP) {
        targetCameraY += (TARGET_TOP - screenTopY);
    }

    // Siguiente bloque
    spawnActiveBlock();
}

/* ──────────────────────── Partículas y popups ──────────────────── */
function spawnParticles(cx, cy, hue, n) {
    for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = 1 + Math.random() * 3;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 0.8,
            life: 28 + Math.random() * 14,
            age: 0,
            hue: hue,
            size: 2 + Math.random() * 2
        });
    }
}

function spawnPerfectPop(x, y) {
    perfectPops.push({ x: x, y: y, age: 0, life: 44 });
}

/* ──────────────────────── Game over ────────────────────────────── */
function endGame() {
    isPlaying = false;
    isGameOver = true;
    shake = 16;
    flashAlpha = 0.6;
    if (score > bestScore) {
        bestScore = score;
        try { localStorage.setItem('stackTowerBest', String(bestScore)); } catch (e) {}
        highScoreEl.textContent = bestScore;
    }
    // popup diferido para mostrar el colapso
    setTimeout(function () {
        popup.style.display = 'flex';
        finalScoreEl.textContent = 'Altura: ' + score;
        finalBestEl.textContent = score > 0 && score >= bestScore ? '¡Nuevo récord!' : 'Récord: ' + bestScore;
        restartBtn.disabled = false;
    }, 900);
}

function updateMobileScore() {
    if (mobileScoreEl) mobileScoreEl.textContent = 'Altura: ' + score + '  ·  Récord: ' + bestScore;
}

/* ──────────────────────── Update ───────────────────────────────── */
function update(dt) {
    // cámara suavizada
    cameraY += (targetCameraY - cameraY) * Math.min(1, dt * 0.1);

    // bloque activo
    if (activeBlock && isPlaying) {
        activeBlock.x += activeBlock.vx * dt;
        if (activeBlock.vx > 0 && activeBlock.x + activeBlock.w > WIDTH - 8) {
            activeBlock.x = WIDTH - 8 - activeBlock.w;
            activeBlock.vx *= -1;
        } else if (activeBlock.vx < 0 && activeBlock.x < 8) {
            activeBlock.x = 8;
            activeBlock.vx *= -1;
        }
    }

    // rebote de bloques colocados
    for (var i = 0; i < stack.length; i++) {
        if (stack[i].bounceTime > 0) stack[i].bounceTime -= dt;
    }

    // fragmentos que caen
    for (var j = fallingPieces.length - 1; j >= 0; j--) {
        var p = fallingPieces[j];
        p.vy += GRAVITY * dt;
        p.y  += p.vy * dt;
        p.x  += p.vx * dt;
        p.rot += p.vr * dt;
        if (p.y + cameraY > HEIGHT + 60) fallingPieces.splice(j, 1);
    }

    // partículas
    for (var k = particles.length - 1; k >= 0; k--) {
        var pt = particles[k];
        pt.age += dt;
        pt.vy += 0.12 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.age >= pt.life) particles.splice(k, 1);
    }

    // pop "¡Perfecto!"
    for (var m = perfectPops.length - 1; m >= 0; m--) {
        perfectPops[m].age += dt;
        perfectPops[m].y -= 0.6 * dt;
        if (perfectPops[m].age >= perfectPops[m].life) perfectPops.splice(m, 1);
    }

    if (shake > 0) shake -= dt * 0.8;
    if (flashAlpha > 0) flashAlpha -= dt * 0.03;
}

/* ──────────────────────── Render ───────────────────────────────── */
function drawBackground() {
    // gradiente de cielo que va cambiando con la altura (score)
    var prog = Math.min(1, score / 60);
    var topCol  = lerpCol([10, 24, 48],  [40, 10, 70],  prog);
    var midCol  = lerpCol([20, 40, 90],  [90, 30, 120], prog);
    var botCol  = lerpCol([40, 80, 140], [180, 80, 140], prog);
    var g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, rgb(topCol));
    g.addColorStop(0.55, rgb(midCol));
    g.addColorStop(1, rgb(botCol));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // estrellas (fijas, usando patrón pseudo-aleatorio determinista)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 0; i < 40; i++) {
        var sx = (i * 53) % WIDTH;
        var sy = ((i * 97) % (HEIGHT - 120)) + 10;
        var sz = (i % 3 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
    }
}

function lerpCol(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}
function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

function drawBlock(x, y, w, h, hue, bounce) {
    // bounce: altura añadida al rebotar
    var by = y - (bounce || 0);
    // sombra suave
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 3, by + h - 4, w, 6);

    var g = ctx.createLinearGradient(x, by, x, by + h);
    g.addColorStop(0, 'hsl(' + hue + ', 75%, 68%)');
    g.addColorStop(1, 'hsl(' + hue + ', 70%, 38%)');
    ctx.fillStyle = g;
    ctx.fillRect(x, by, w, h);

    // highlight superior
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 2, by + 2, Math.max(0, w - 4), 3);
    // borde
    ctx.strokeStyle = 'hsl(' + hue + ', 80%, 25%)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, by + 0.5, w - 1, h - 1);
}

function drawFalling(p) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2 + cameraY);
    ctx.rotate(p.rot);
    var g = ctx.createLinearGradient(-p.w / 2, -p.h / 2, -p.w / 2, p.h / 2);
    g.addColorStop(0, 'hsl(' + p.hue + ', 75%, 68%)');
    g.addColorStop(1, 'hsl(' + p.hue + ', 70%, 38%)');
    ctx.fillStyle = g;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.strokeStyle = 'hsl(' + p.hue + ', 80%, 25%)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-p.w / 2 + 0.5, -p.h / 2 + 0.5, p.w - 1, p.h - 1);
    ctx.restore();
}

function render() {
    ctx.save();
    // shake
    if (shake > 0) {
        // Deterministic jitter from the shake counter (no Math.random in render)
        ctx.translate(Math.sin(shake * 12.9898) * shake * 0.5, Math.cos(shake * 78.233) * shake * 0.5);
    }

    drawBackground();

    // pila (en orden: base abajo → top arriba)
    for (var i = 0; i < stack.length; i++) {
        var b = stack[i];
        var bounce = 0;
        if (b.bounceTime > 0) {
            bounce = b.bounceAmp * Math.sin((b.bounceTime / 14) * Math.PI);
        }
        drawBlock(b.x, b.y + cameraY, b.w, BLOCK_H, b.hue, bounce);
    }

    // fragmentos que caen
    for (var j = 0; j < fallingPieces.length; j++) drawFalling(fallingPieces[j]);

    // bloque activo
    if (activeBlock) {
        drawBlock(activeBlock.x, activeBlock.y + cameraY, activeBlock.w, BLOCK_H, activeBlock.hue, 0);
    }

    // partículas
    for (var k = 0; k < particles.length; k++) {
        var pt = particles[k];
        var a = 1 - pt.age / pt.life;
        ctx.fillStyle = 'hsla(' + pt.hue + ', 90%, 65%, ' + a.toFixed(3) + ')';
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2 + cameraY, pt.size, pt.size);
    }

    // "¡Perfecto!" popups
    for (var m = 0; m < perfectPops.length; m++) {
        var pp = perfectPops[m];
        var a2 = 1 - pp.age / pp.life;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a2);
        ctx.fillStyle = '#ffe066';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¡PERFECTO!', pp.x, pp.y + cameraY);
        ctx.restore();
    }

    ctx.restore();

    // marcador superior (HUD, no se mueve con la cámara)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, WIDTH, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Altura: ' + score, 10, 16);
    ctx.textAlign = 'right';
    ctx.fillText('Récord: ' + bestScore, WIDTH - 10, 16);
    if (comboPerfect >= 2) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd44d';
        ctx.fillText('Combo x' + comboPerfect, WIDTH / 2, 16);
    }
    ctx.textBaseline = 'alphabetic';

    // flash blanco al morir
    if (flashAlpha > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha.toFixed(3) + ')';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // overlay inicio
    if (!isPlaying && !isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, HEIGHT / 2 - 60, WIDTH, 120);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('APILADOR DE BLOQUES', WIDTH / 2, HEIGHT / 2 - 16);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText('Pulsa "Iniciar" o toca la pantalla', WIDTH / 2, HEIGHT / 2 + 12);
        ctx.fillText('para soltar los bloques', WIDTH / 2, HEIGHT / 2 + 32);
    }
}

/* ──────────────────────── Loop ─────────────────────────────────── */
function loop(ts) {
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 16.67;  // normalizado a 60fps
    if (dt > 3) dt = 3;
    lastT = ts;
    update(dt);
    render();
    animFrameId = requestAnimationFrame(loop);
}

/* ──────────────────────── Controles ────────────────────────────── */
function handleInput(e) {
    if (e && e.type === 'keydown') {
        if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowDown') return;
        e.preventDefault();
    }
    if (!isPlaying) {
        if (isGameOver) return;   // esperar popup / restart
        startGame();
        return;
    }
    dropBlock();
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

/* Render inicial (pantalla de bienvenida) */
resetGame();
isPlaying = false;
if (!animFrameId) {
    lastT = 0;
    animFrameId = requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════════════════════════════
 * PLINKO — catálogo de juegos JS
 * Mecánica: drop & bounce. Toca en la franja superior para soltar
 * una bola. Rebota en los pinchos y cae en una ranura con multiplicador.
 * 10 bolas por ronda. Récord persistente en localStorage.
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── canvas & DOM ───────────────────────────────────────────── */
    var canvas = document.getElementById('plinkoCanvas');
    var ctx    = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;

    var scoreEl     = document.getElementById('score');
    var ballsEl     = document.getElementById('ballsLeft');
    var highEl      = document.getElementById('highScore');
    var mobileScore = document.getElementById('mobileScore');
    var startBtn    = document.getElementById('startBtn');
    var restartBtn  = document.getElementById('restartBtn');
    var gameOverPop = document.getElementById('gameOverPopup');
    var finalScore  = document.getElementById('finalScore');
    var finalBest   = document.getElementById('finalBest');
    var playAgain   = document.getElementById('playAgainBtn');

    /* ── constantes ─────────────────────────────────────────────── */
    var BALLS_PER_ROUND = 10;
    var DROP_ZONE_H   = 80;    // franja superior (visual guía, ya no restringe)
    var SLOTS_Y       = 440;   // y donde empiezan las ranuras
    var SLOTS         = 7;
    var SLOT_W        = W / SLOTS;
    var MULTIPLIERS   = [0, 1, 3, 10, 3, 1, 0];  // centro alto, esquinas bajo
    var BASE_POINTS   = 100;

    // Gravedad y restitución de rebote
    var GRAVITY     = 0.22;
    var AIR_DRAG    = 0.999;
    var RESTITUTION = 0.58;
    var TANG_FRIC   = 0.85;
    var BALL_R      = 8;
    var PEG_R       = 4;
    var MAX_BALLS   = 20;        // hard-limit simultáneas en vuelo
    var DELTA_THR   = 15;        // ~60fps throttle

    /* ── pegs: layout triangular alterno ───────────────────────── */
    // 9 filas: alterno 6 y 7 pegs
    var PEG_ROWS = 9;
    var PEG_Y0   = 130;
    var PEG_DY   = 32;
    var PEG_DX   = 45;
    var pegs = [];
    (function buildPegs() {
        for (var r = 0; r < PEG_ROWS; r++) {
            var even = r % 2 === 0; // fila par = 6 pegs, impar = 7 pegs
            var count = even ? 6 : 7;
            var xStart = even ? 67.5 : 45;
            var y = PEG_Y0 + r * PEG_DY;
            for (var c = 0; c < count; c++) {
                pegs.push({ x: xStart + c * PEG_DX, y: y });
            }
        }
    })();

    /* ── estado del juego ──────────────────────────────────────── */
    var balls = [];        // bolas en vuelo
    var particles = [];    // partículas de impacto en slot
    var score = 0;
    var ballsLeft = BALLS_PER_ROUND;
    var highScore = 0;
    var running = false;
    var lastTs = 0;
    var lastDropTs = 0;
    var previewX = W / 2;   // x de la bola fantasma en el top
    var previewActive = false;
    var screenShake = 0;
    var shakeOx = 0, shakeOy = 0; // pre-computado en update, leído en render
    var slotFlash = new Array(SLOTS).fill(0); // glow timing por slot

    // Audio de colisión: throttle para no saturar
    var lastHitSoundTs = 0;

    /* ── localStorage ──────────────────────────────────────────── */
    function loadHigh() {
        highScore = GameStore.getNum('plinkoHighScore', 0);
    }
    function saveHigh() {
        GameStore.set('plinkoHighScore', highScore);
    }

    /* ── utilidades UI ─────────────────────────────────────────── */
    function updateHUD() {
        if (scoreEl) scoreEl.textContent = score;
        if (ballsEl) ballsEl.textContent = ballsLeft;
        if (highEl)  highEl.textContent  = highScore;
        if (mobileScore) mobileScore.textContent =
            'Puntos: ' + score + '  •  Bolas: ' + ballsLeft + '  •  Récord: ' + highScore;
    }

    /* ── gradientes cacheados ──────────────────────────────────── */
    var bgGrad = null, ballGrad = null;
    function buildGradients() {
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#101c3a');
        bgGrad.addColorStop(1, '#070a1a');
        ballGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, BALL_R);
        ballGrad.addColorStop(0, '#ffe29a');
        ballGrad.addColorStop(0.5, '#ff8a3d');
        ballGrad.addColorStop(1, '#c43211');
    }

    /* ── color por multiplicador ───────────────────────────────── */
    function slotColor(mult) {
        if (mult >= 10) return '#ff4081';   // centro: rosa fuerte
        if (mult >= 3)  return '#ffb347';   // medio: naranja
        if (mult >= 1)  return '#8fd3f4';   // moderado: azul claro
        return '#4a4a52';                   // esquinas: gris
    }

    /* ── física: colisión bola-peg ─────────────────────────────── */
    function resolvePegCollision(ball, peg) {
        var dx = ball.x - peg.x;
        var dy = ball.y - peg.y;
        var rSum = BALL_R + PEG_R;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rSum * rSum) return false;
        var d = Math.sqrt(d2) || 0.0001;
        var nx = dx / d, ny = dy / d;
        // separa superposición
        var overlap = rSum - d;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        // reflejar velocidad
        var vn = ball.vx * nx + ball.vy * ny;       // componente normal
        if (vn < 0) {
            var tx = -ny, ty = nx;                  // tangente
            var vt = ball.vx * tx + ball.vy * ty;
            vn = -vn * RESTITUTION;
            vt *= TANG_FRIC;
            // kick tangencial aleatorio (sabor Plinko, no cada hit)
            if (Math.random() < 0.4) vt += (Math.random() - 0.5) * 1.3;
            ball.vx = vn * nx + vt * tx;
            ball.vy = vn * ny + vt * ty;
        }
        ball.hits++;
        return true;
    }

    /* ── lógica de ranura al fondo ─────────────────────────────── */
    function ballReachedSlot(ball) {
        var idx = Math.max(0, Math.min(SLOTS - 1, Math.floor(ball.x / SLOT_W)));
        var mult = MULTIPLIERS[idx];
        var gained = BASE_POINTS * mult;
        score += gained;
        slotFlash[idx] = 1.0;

        // sonidos (fuera del render loop)
        if (mult >= 10) {
            GameAudio.scoreHigh();
            screenShake = 8;
        } else if (mult >= 1) {
            GameAudio.score();
        } else {
            GameAudio.miss();
        }

        // partículas de celebración
        var color = slotColor(mult);
        var cx = idx * SLOT_W + SLOT_W / 2;
        var n = mult >= 10 ? 18 : (mult >= 3 ? 10 : (mult >= 1 ? 6 : 3));
        for (var i = 0; i < n; i++) {
            var ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
            var sp  = 2 + Math.random() * 3;
            particles.push({
                x: cx, y: SLOTS_Y + 10,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 1, color: color, size: 2 + Math.random() * 2
            });
        }
    }

    /* ── crear nueva bola ──────────────────────────────────────── */
    function spawnBall(x) {
        if (!running) return;
        if (ballsLeft <= 0) return;
        if (balls.length >= MAX_BALLS) return;
        // limitar x para que no nazca fuera de pegs
        x = Math.max(12, Math.min(W - 12, x));
        balls.push({
            x: x, y: 40,
            vx: (Math.random() - 0.5) * 0.6, // ruido inicial casi cero
            vy: 0,
            hits: 0, done: false,
            trail: []
        });
        ballsLeft--;
        lastDropTs = performance.now();
        GameAudio.click();
        updateHUD();
    }

    /* ── input ─────────────────────────────────────────────────── */
    function canvasCoord(clientX, clientY) {
        return GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
    }
    function onPointerDown(e) {
        if (!running) return;
        e.preventDefault();
        var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
        var p = canvasCoord(t.clientX, t.clientY);
        // permite soltar desde cualquier parte del canvas (usa la X del toque)
        if (p.y < SLOTS_Y) {
            spawnBall(p.x);
        }
    }
    function onPointerMove(e) {
        if (!running) return;
        var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
        var p = canvasCoord(t.clientX, t.clientY);
        if (p.y < SLOTS_Y) {
            previewX = Math.max(12, Math.min(W - 12, p.x));
            previewActive = true;
        } else {
            previewActive = false;
        }
    }
    function onPointerLeave() { previewActive = false; }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    canvas.addEventListener('mouseleave', onPointerLeave);

    /* ── actualización ─────────────────────────────────────────── */
    function update(dt) {
        // dt en "steps" ~1 a 60fps; escalamos física con dt/16.67
        var step = dt / 16.67;

        // bolas
        for (var i = balls.length - 1; i >= 0; i--) {
            var b = balls[i];
            if (b.done) { balls.splice(i, 1); continue; }
            b.vy += GRAVITY * step;
            b.vx *= Math.pow(AIR_DRAG, step);
            b.vy *= Math.pow(AIR_DRAG, step);
            // Clamp vertical máximo para estabilidad
            if (b.vy > 12) b.vy = 12;
            b.x += b.vx * step;
            b.y += b.vy * step;
            // trail (histórico corto)
            b.trail.push(b.x);
            b.trail.push(b.y);
            if (b.trail.length > 10) { b.trail.shift(); b.trail.shift(); }
            // paredes
            if (b.x < BALL_R)       { b.x = BALL_R;       b.vx = -b.vx * RESTITUTION; }
            if (b.x > W - BALL_R)   { b.x = W - BALL_R;   b.vx = -b.vx * RESTITUTION; }
            // pegs: probamos contra cada peg cercano
            var didHit = false;
            for (var p = 0; p < pegs.length; p++) {
                var pg = pegs[p];
                var ady = b.y - pg.y;
                if (ady > 20 || ady < -20) continue;
                if (resolvePegCollision(b, pg)) {
                    didHit = true;
                }
            }
            if (didHit) {
                // sonido de impacto con throttle (no saturar)
                var now = performance.now();
                if (now - lastHitSoundTs > 40) {
                    GameAudio.hit();
                    lastHitSoundTs = now;
                }
            }
            // ¿llegó a las ranuras?
            if (b.y >= SLOTS_Y && !b.done) {
                ballReachedSlot(b);
                b.done = true;
            }
            // safety: salió por abajo
            if (b.y > H + 40) b.done = true;
        }

        // partículas
        for (var j = particles.length - 1; j >= 0; j--) {
            var pa = particles[j];
            pa.vy += 0.18 * step;
            pa.x += pa.vx * step;
            pa.y += pa.vy * step;
            pa.life -= 0.022 * step;
            if (pa.life <= 0) particles.splice(j, 1);
        }

        // slot flash decay
        for (var k = 0; k < SLOTS; k++) {
            if (slotFlash[k] > 0) slotFlash[k] = Math.max(0, slotFlash[k] - 0.025 * step);
        }

        // screen shake decay + offsets pre-computados (para no llamar a Math.random en render)
        if (screenShake > 0) {
            screenShake = Math.max(0, screenShake - 0.6 * step);
            shakeOx = (Math.random() - 0.5) * screenShake;
            shakeOy = (Math.random() - 0.5) * screenShake;
        } else {
            shakeOx = 0; shakeOy = 0;
        }

        // ¿ronda terminada?
        if (ballsLeft <= 0 && balls.length === 0 && running) {
            endRound();
        }
    }

    /* ── render ────────────────────────────────────────────────── */
    function render() {
        // shake: usamos offsets pre-computados en update (no Math.random en render)
        ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);

        // fondo
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // franja superior (drop zone)
        ctx.fillStyle = 'rgba(143,211,244,0.07)';
        ctx.fillRect(0, 0, W, DROP_ZONE_H);
        ctx.strokeStyle = 'rgba(143,211,244,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, DROP_ZONE_H);
        ctx.lineTo(W, DROP_ZONE_H);
        ctx.stroke();

        // texto guía superior
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 13px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(running
            ? 'Toca en cualquier lugar para soltar la bola'
            : 'Pulsa Iniciar', W / 2, 18);

        // preview bola fantasma + línea guía vertical
        if (running && previewActive && ballsLeft > 0) {
            // línea guía desde el top hasta la posición del cursor
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.moveTo(previewX, 40);
            ctx.lineTo(previewX, SLOTS_Y);
            ctx.stroke();
            ctx.setLineDash([]);

            // bola fantasma en la cima (siempre se suelta desde arriba)
            ctx.setTransform(1, 0, 0, 1, shakeOx + previewX, shakeOy + 40);
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = ballGrad;
            ctx.beginPath();
            ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);
        }

        // pegs (batch fillStyle único)
        ctx.fillStyle = '#cfe8ff';
        for (var p = 0; p < pegs.length; p++) {
            var pg = pegs[p];
            ctx.beginPath();
            ctx.arc(pg.x, pg.y, PEG_R, 0, Math.PI * 2);
            ctx.fill();
        }
        // borde tenue (batch)
        ctx.strokeStyle = 'rgba(143,211,244,0.45)';
        ctx.lineWidth = 1;
        for (var p2 = 0; p2 < pegs.length; p2++) {
            var pg2 = pegs[p2];
            ctx.beginPath();
            ctx.arc(pg2.x, pg2.y, PEG_R + 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // bolas (trail + bola) — sin save/restore dentro del loop
        for (var i = 0; i < balls.length; i++) {
            var b = balls[i];
            // trail como puntos pequeños
            var t = b.trail;
            for (var k = 0; k < t.length; k += 2) {
                var a = (k / t.length) * 0.4;
                ctx.fillStyle = 'rgba(255,180,90,' + a.toFixed(3) + ')';
                ctx.fillRect(t[k] - 1.5, t[k+1] - 1.5, 3, 3);
            }
            // bola con gradient trasladado, sin ctx.save/restore
            ctx.setTransform(1, 0, 0, 1, shakeOx + b.x, shakeOy + b.y);
            ctx.fillStyle = ballGrad;
            ctx.beginPath();
            ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            // brillo superior
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(-2.5, -3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // restaurar transform base (solo shake)
        ctx.setTransform(1, 0, 0, 1, shakeOx, shakeOy);

        // ranuras inferiores
        for (var s = 0; s < SLOTS; s++) {
            var mult = MULTIPLIERS[s];
            var color = slotColor(mult);
            var x = s * SLOT_W;
            var flash = slotFlash[s];
            // fondo ranura
            ctx.fillStyle = '#1a2550';
            ctx.fillRect(x, SLOTS_Y, SLOT_W, H - SLOTS_Y);
            // barra superior con color
            var barH = 24;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85 + flash * 0.15;
            ctx.fillRect(x + 2, SLOTS_Y, SLOT_W - 4, barH);
            ctx.globalAlpha = 1;
            // brillo flash
            if (flash > 0) {
                ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.5).toFixed(3) + ')';
                ctx.fillRect(x + 2, SLOTS_Y, SLOT_W - 4, H - SLOTS_Y);
            }
            // texto multiplicador
            ctx.fillStyle = mult === 0 ? '#999' : '#111';
            ctx.font = 'bold 14px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mult + 'x', x + SLOT_W / 2, SLOTS_Y + barH / 2);
            // puntos
            ctx.fillStyle = '#cfd8ff';
            ctx.font = 'bold 12px Segoe UI, Arial, sans-serif';
            ctx.fillText('+' + (mult * BASE_POINTS), x + SLOT_W / 2, SLOTS_Y + 50);
            // divisor
            if (s > 0) {
                ctx.strokeStyle = 'rgba(143,211,244,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, SLOTS_Y);
                ctx.lineTo(x, H);
                ctx.stroke();
            }
        }

        // partículas
        for (var q = 0; q < particles.length; q++) {
            var pa = particles[q];
            if (pa.life <= 0) continue;
            ctx.globalAlpha = Math.max(0, pa.life);
            ctx.fillStyle = pa.color;
            ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
        }
        ctx.globalAlpha = 1;

        // HUD interno: puntuación arriba-izquierda, bolas arriba-derecha
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(score), 12, 50);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffb347';
        ctx.fillText('Bolas: ' + ballsLeft, W - 12, 50);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    /* ── loop principal (requestAnimationFrame + delta) ────────── */
    function loop(ts) {
        if (!lastTs) lastTs = ts;
        var dt = ts - lastTs;
        if (dt < DELTA_THR) { requestAnimationFrame(loop); return; }
        lastTs = ts;
        if (running) update(dt);
        render();
        requestAnimationFrame(loop);
    }

    /* ── flujo de partida ──────────────────────────────────────── */
    function startGame() {
        if (running) return;
        running = true;
        score = 0;
        ballsLeft = BALLS_PER_ROUND;
        balls.length = 0;
        particles.length = 0;
        for (var k = 0; k < SLOTS; k++) slotFlash[k] = 0;
        screenShake = 0;
        gameOverPop.style.display = 'none';
        if (startBtn)   startBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = false;
        updateHUD();
        GameAudio.start();
    }
    function endRound() {
        running = false;
        if (score > highScore) {
            highScore = score;
            saveHigh();
            GameAudio.win();
        } else {
            GameAudio.gameOver();
        }
        if (finalScore) finalScore.textContent = 'Puntos: ' + score;
        if (finalBest)  finalBest.textContent  = 'Récord: ' + highScore;
        if (gameOverPop) gameOverPop.style.display = 'flex';
        if (startBtn)   startBtn.disabled = false;
        if (restartBtn) restartBtn.disabled = true;
        updateHUD();
    }

    /* ── listeners de botones ──────────────────────────────────── */
    if (startBtn)   startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', function () {
        running = false;
        startGame();
    });
    if (playAgain)  playAgain.addEventListener('click', function () {
        gameOverPop.style.display = 'none';
        startGame();
    });

    // teclado: espacio/enter = soltar bola en el centro o en previewX
    document.addEventListener('keydown', function (e) {
        if (!running) {
            if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
            return;
        }
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
            spawnBall(previewActive ? previewX : W / 2);
            e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            previewX = Math.max(12, previewX - 12);
            previewActive = true;
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            previewX = Math.min(W - 12, previewX + 12);
            previewActive = true;
        }
    });

    /* ── init ──────────────────────────────────────────────────── */
    loadHigh();
    buildGradients();
    updateHUD();
    requestAnimationFrame(loop);
})();

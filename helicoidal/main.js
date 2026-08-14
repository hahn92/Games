// Helicoidal — Torre giratoria con descenso físico
// Arrastra para rotar la torre. Alinea los huecos para que la bola descienda.
// ¡Evita las zonas rojas! Mecánica única: rotación 360° + rebote con gravedad.

var canvas = document.getElementById('helixCanvas');
var ctx = canvas.getContext('2d');

var W = canvas.width;   // 360
var H = canvas.height;  // 560

/* ─────────────────────── Constantes de juego ─────────────────────── */
var POLE_X            = W / 2;
var DISC_SPACING      = 90;    // distancia vertical entre discos (mundo)
var DISC_RX           = 120;   // radio horizontal del disco (elipse)
var DISC_RY           = 17;    // radio vertical del disco (perspectiva)
var BALL_R            = 14;
var NUM_SEGMENTS      = 8;
var SEG_ANGLE         = Math.PI * 2 / NUM_SEGMENTS;
var GRAVITY           = 0.55;
var MAX_FALL_VEL      = 9.5;
var BOUNCE_VEL        = -7.8;         // impulso al rebotar en segmento seguro
var PASS_VEL          = 2.0;          // velocidad mínima al atravesar un hueco
var CAMERA_TARGET_Y   = 170;          // pantalla: donde queremos ver la bola
var CAMERA_LERP       = 0.10;
var ROTATION_FRICTION = 0.88;
var DRAG_SENSITIVITY  = 0.012;        // radianes por pixel arrastrado
var KEYBOARD_ROT_SPD  = 0.065;

/* ─────────────────────── Paleta ─────────────────────── */
var COL = {
    bgTop:    '#120635',
    bgMid:    '#2a1260',
    bgBot:    '#601e8c',
    safeA:    '#6fd3ff',
    safeB:    '#2a74a8',
    safeA2:   '#7be0b3',
    safeB2:   '#2e8a5d',
    dangerA:  '#ff7566',
    dangerB:  '#a81e14',
    poleA:    '#2a1644',
    poleB:    '#100423',
    ballA:    '#ffd866',
    ballB:    '#ff5a1f',
    ballC:    '#8f1a06',
    star:     'rgba(255,255,255,0.7)',
};

/* ─────────────────────── Estado ─────────────────────── */
var theta           = 0;
var thetaVel        = 0;
var ballY           = 60;        // posición mundo (y crece hacia abajo)
var ballVY          = 0;
var cameraY         = 0;         // desplazamiento cámara (screenY = worldY - cameraY)
var targetCameraY   = 0;
var discs           = [];        // {id, y, segments: [8 strings], passed: bool, breakT: num}
var nextDiscId      = 0;
var score           = 0;
/* El récord va por GU.highScore: comparar, guardar y el valor por defecto
 * en un solo sitio. `best` se mantiene porque el resto del fichero la lee. */
var gameBest = GU.highScore('helicoidalHighScore');

var best            = gameBest.display(0);
var combo           = 0;
var bestCombo       = 0;
var isPlaying       = false;
var isOver          = false;
var shake           = 0;
var flashAlpha      = 0;
var particles       = new Particles(200);   // pooled, see game-utils.js

/* Cache de gradientes: el fondo y el poste ocupan la pantalla entera y son
   constantes. Los discos ya usaban gradientes preconstruidos. */
var gMemo = GU.gradientMemo();
var pops            = [];
var lastT           = 0;
var animId          = null;
var popupTimer      = null;      // temporizador del popup de fin (se cancela al reiniciar)
var difficulty      = 0;         // 0..1 (crece con profundidad)
var starField       = [];        // estrellas de fondo cacheadas
var comboFlashT     = 0;

/* ─────────────────────── DOM refs ─────────────────────── */
var startBtn     = document.getElementById('startBtn');
var restartBtn   = document.getElementById('restartBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var scoreEl      = document.getElementById('score');
var highScoreEl  = document.getElementById('highScore');
var mobileScoreEl= document.getElementById('mobileScore');
var popup        = document.getElementById('gameOverPopup');
var finalScoreEl = document.getElementById('finalScore');
var finalBestEl  = document.getElementById('finalBest');

highScoreEl.textContent = best;

/* ─────────────────────── Utilidades ─────────────────────── */
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b)); }

/* Pre-cachear estrellas (evita Math.random en el render) */
function buildStarField() {
    starField = [];
    for (var i = 0; i < 70; i++) {
        starField.push({
            x: Math.random() * W,
            yWorld: Math.random() * 4000,
            size: Math.random() < 0.22 ? 2 : 1,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.7
        });
    }
}
buildStarField();

/* Gradientes de wedge cacheados una sola vez: los discos se dibujan
   trasladados a su centro, así el gradiente vertical (-ry..+ry) sirve para
   todos. Antes se creaba uno por segmento y por frame (≈80 por frame). */
var gradSafeA = null, gradSafeB = null, gradDanger = null;
function buildDiscGradients() {
    gradSafeA = ctx.createLinearGradient(0, -DISC_RY, 0, DISC_RY);
    gradSafeA.addColorStop(0, COL.safeA);
    gradSafeA.addColorStop(1, COL.safeB);
    gradSafeB = ctx.createLinearGradient(0, -DISC_RY, 0, DISC_RY);
    gradSafeB.addColorStop(0, COL.safeA2);
    gradSafeB.addColorStop(1, COL.safeB2);
    gradDanger = ctx.createLinearGradient(0, -DISC_RY, 0, DISC_RY);
    gradDanger.addColorStop(0, COL.dangerA);
    gradDanger.addColorStop(1, COL.dangerB);
}
buildDiscGradients();

/* Genera la configuración de segmentos de un disco
   Más discos abajo = más difícil (más rojos, menos huecos) */
function generateSegments(depth) {
    var segs = new Array(NUM_SEGMENTS);
    // cantidad de huecos (1-3) y rojos (0-3), dependiendo de dificultad
    var gaps = depth < 3 ? 3 : (Math.random() < 0.5 ? 2 : 1);
    if (depth >= 25 && Math.random() < 0.3) gaps = 1;
    var reds = depth < 4 ? 0 :
               depth < 10 ? (Math.random() < 0.4 ? 1 : 0) :
               depth < 20 ? randi(1, 3) :
                            randi(1, 4);
    // asegurar que queden segmentos seguros
    if (gaps + reds > NUM_SEGMENTS - 1) reds = NUM_SEGMENTS - 1 - gaps;
    // inicialmente todos seguros
    for (var i = 0; i < NUM_SEGMENTS; i++) segs[i] = 'safe';
    // colocar huecos en posiciones aleatorias
    var placed = 0;
    while (placed < gaps) {
        var idx = randi(0, NUM_SEGMENTS);
        if (segs[idx] === 'safe') { segs[idx] = 'gap'; placed++; }
    }
    // colocar rojos (no adyacentes a huecos si es posible, para dar margen)
    placed = 0;
    var tries = 0;
    while (placed < reds && tries < 40) {
        var idx2 = randi(0, NUM_SEGMENTS);
        if (segs[idx2] === 'safe') {
            var left  = segs[(idx2 + NUM_SEGMENTS - 1) % NUM_SEGMENTS];
            var right = segs[(idx2 + 1) % NUM_SEGMENTS];
            // permitir contiguos si la dificultad es alta
            if (depth < 14 && (left === 'gap' || right === 'gap')) { tries++; continue; }
            segs[idx2] = 'danger'; placed++;
        }
        tries++;
    }
    return segs;
}

/* Asegura que haya suficientes discos generados por debajo de la bola */
function ensureDiscs() {
    var lastY = discs.length ? discs[discs.length - 1].y : 60;
    while (lastY - ballY < H + DISC_SPACING * 3) {
        lastY += DISC_SPACING;
        /* La profundidad tiene que venir de nextDiscId, no de discs.length:
           pruneDiscs recorta el array por arriba, así que su longitud se queda
           clavada en ~10 y la dificultad nunca subía del primer tramo. */
        var depth = nextDiscId;
        discs.push({
            id: nextDiscId++,
            y: lastY,
            segments: generateSegments(depth),
            passed: false,
            breakT: 0,      // animación de ruptura al pasar
            hueShift: (depth * 17) % 360
        });
    }
    difficulty = Math.min(1, nextDiscId / 60);
}

/* Quita discos que quedaron muy arriba */
function pruneDiscs() {
    while (discs.length && discs[0].y < cameraY - H) {
        discs.shift();
    }
}

/* Estado del segmento bajo la bola.
   La bola está visualmente "al frente" del disco, ángulo = π/2 en screen coords
   (bottom-most point en la elipse). El segmento i cubre
   [theta + i*SEG_ANGLE, theta + (i+1)*SEG_ANGLE]. */
function segmentUnderBall(segs) {
    var ballAngle = Math.PI / 2;
    // Normalizar: queremos i tal que ((ballAngle - theta) mod 2π) esté en [i*SEG_ANGLE, (i+1)*SEG_ANGLE)
    var rel = ballAngle - theta;
    rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var i = Math.floor(rel / SEG_ANGLE) % NUM_SEGMENTS;
    return { index: i, type: segs[i] };
}

/* ─────────────────────── Inicio / reset ─────────────────────── */
function resetGame() {
    theta = 0;
    thetaVel = 0;
    ballY = 60;
    ballVY = 0;
    ballRestingDisc = null;
    cameraY = 0;
    targetCameraY = 0;
    discs = [];
    nextDiscId = 0;
    score = 0;
    combo = 0;
    bestCombo = 0;
    difficulty = 0;
    shake = 0;
    flashAlpha = 0;
    particles.clear();
    pops = [];
    comboFlashT = 0;
    ensureDiscs();
    scoreEl.textContent = '0';
    updateMobileScore();
}

function startGame() {
    /* Sin early-return por isPlaying: "Reiniciar" está habilitado durante la
       partida y antes no hacía nada. Cancelar el popup pendiente evita que el
       fin de la partida anterior aparezca encima de la nueva. */
    if (popupTimer !== null) { clearTimeout(popupTimer); popupTimer = null; }
    resetGame();
    isPlaying = true;
    isOver = false;
    popup.style.display = 'none';
    gameControls.running();
    if (typeof GameAudio !== 'undefined') GameAudio.start();
    lastT = performance.now();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
}

function endGame() {
    if (isOver) return;
    isOver = true;
    isPlaying = false;
    shake = 18;
    flashAlpha = 0.55;
    spawnExplosion(POLE_X, ballY - cameraY, 38);
    if (typeof GameAudio !== 'undefined') GameAudio.gameOver();
    if (gameBest.submit(score)) {
        best = gameBest.value;
        highScoreEl.textContent = best;
    }
    // popup con breve delay para mostrar shake y explosión
    popupTimer = setTimeout(function () {
        popupTimer = null;
        finalScoreEl.textContent = 'Puntos: ' + score;
        finalBestEl.textContent = (score === best && score > 0)
            ? '¡Nuevo récord!'
            : 'Récord: ' + best + '  ·  Mejor combo: ' + bestCombo;
        popup.style.display = 'flex';
        startBtn.disabled = false;
    }, 720);
}

/* ─────────────────────── Eventos: teclado ─────────────────────── */
var keys = { left: false, right: false };
document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if ((e.key === ' ' || e.key === 'Enter') && !isPlaying) { e.preventDefault(); startGame(); }
});
document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

/* ─────────────────────── Eventos: puntero (drag horizontal) ─────────────────────── */
var pointerId = null;
var lastPointerX = 0;
var pointerStartT = 0;

function getPointerX(e) { return GU.pointerPos(canvas, e).x; }

function pointerDown(e) {
    e.preventDefault();
    pointerId = e.pointerId || 1;
    lastPointerX = getPointerX(e);
    pointerStartT = performance.now();
    thetaVel = 0;
}
function pointerMove(e) {
    if (pointerId === null) return;
    e.preventDefault();
    var x = getPointerX(e);
    var dx = x - lastPointerX;
    lastPointerX = x;
    // El contenido al frente sigue al dedo: drag right → theta decrece (rotación horaria).
    theta -= dx * DRAG_SENSITIVITY;
    thetaVel = -dx * DRAG_SENSITIVITY * 1.5;
}
function pointerUp(e) {
    pointerId = null;
}
canvas.addEventListener('mousedown', pointerDown);
window.addEventListener('mousemove', pointerMove);
window.addEventListener('mouseup', pointerUp);
canvas.addEventListener('touchstart', pointerDown, { passive: false });
canvas.addEventListener('touchmove', pointerMove, { passive: false });
canvas.addEventListener('touchend', pointerUp);
canvas.addEventListener('touchcancel', pointerUp);
/* tap corto inicia si no está jugando (nunca durante la animación de muerte,
   o un toque justo al morir se comía la explosión y reiniciaba al instante) */
canvas.addEventListener('click', function () {
    if (!isPlaying && popupTimer === null) startGame();
});

var gameControls = GU.controls({ start: startGame });

/* ─────────────────────── Partículas ─────────────────────── */
function spawnBounce(x, y) {
    for (var i = 0; i < 6; i++) {
        var a = rand(-Math.PI, 0);
        var sp = rand(1.5, 3.5);
        /* 18 frames at 60fps; vx damped, vy left alone, as before */
        particles.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
            life: 18 / 60, size: rand(1.5, 3), color: '#ffd866',
            gravity: 0.18, drag: [0.97, 1], shape: 'square'
        });
    }
}
function spawnPass(x, y) {
    for (var i = 0; i < 10; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(1.2, 3.2);
        particles.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, {
            life: 22 / 60, size: rand(1.5, 3),
            color: i % 2 ? '#8fd3f4' : '#ffffff',
            gravity: 0.18, drag: [0.97, 1], shape: 'square'
        });
    }
}
function spawnExplosion(x, y, n) {
    for (var i = 0; i < n; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(2.5, 6);
        /* these spawn with life < maxLife, i.e. below full opacity —
           `alpha` reproduces that starting point exactly */
        var lf = rand(26, 40);
        particles.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
            life: lf / 60, alpha: lf / 40, size: rand(2, 4.5),
            color: i % 3 === 0 ? '#ffd866' : (i % 3 === 1 ? '#ff512f' : '#ff9f45'),
            gravity: 0.18, drag: [0.97, 1], shape: 'square'
        });
    }
}
function updateParticles() {
    particles.update();
    for (var j = pops.length - 1; j >= 0; j--) {
        pops[j].t--;
        pops[j].y -= 0.7;
        if (pops[j].t <= 0) pops.splice(j, 1);
    }
}

/* ─────────────────────── Lógica ─────────────────────── */
function updatePhysics(dt) {
    // Rotación (inercia + teclado)
    if (keys.left) thetaVel = -KEYBOARD_ROT_SPD;
    else if (keys.right) thetaVel = KEYBOARD_ROT_SPD;
    theta += thetaVel;
    if (pointerId === null) thetaVel *= ROTATION_FRICTION;

    // Gravedad
    ballVY += GRAVITY;
    if (ballVY > MAX_FALL_VEL) ballVY = MAX_FALL_VEL;
    ballY += ballVY;

    // Buscar el disco más cercano por debajo de la bola (que aún no haya sido pasado)
    var hitDisc = null;
    for (var i = 0; i < discs.length; i++) {
        var d = discs[i];
        if (d.passed) continue;
        // La bola está "encima" del disco cuando cruza d.y desde arriba
        // Consideramos colisión si ballY pasó el nivel del disco esta frame y la dirección es descendente
        if (ballVY > 0 && ballY + BALL_R * 0.2 >= d.y && ballY - ballVY + BALL_R * 0.2 < d.y) {
            hitDisc = d; break;
        }
    }

    if (hitDisc) {
        var seg = segmentUnderBall(hitDisc.segments);
        if (seg.type === 'danger') {
            // Muerte
            endGame();
            return;
        } else if (seg.type === 'gap') {
            // Atraviesa
            hitDisc.passed = true;
            hitDisc.breakT = 14;
            score++;
            combo++;
            if (combo > bestCombo) bestCombo = combo;
            scoreEl.textContent = score;
            updateMobileScore();
            spawnPass(POLE_X, hitDisc.y - cameraY);
            // sonido (fuera del render): combo alto → scoreHigh
            if (combo > 0 && combo % 5 === 0) {
                if (typeof GameAudio !== 'undefined') GameAudio.scoreHigh();
                pops.push({ x: POLE_X, y: hitDisc.y - cameraY - 12, t: 50, text: 'Combo x' + combo });
                comboFlashT = 18;
            } else {
                if (typeof GameAudio !== 'undefined') GameAudio.score();
            }
            // velocidad mínima hacia abajo tras pasar
            if (ballVY < PASS_VEL) ballVY = PASS_VEL;
        } else {
            // safe: rebota
            ballY = hitDisc.y - BALL_R * 0.2;
            ballVY = BOUNCE_VEL;
            combo = 0;
            spawnBounce(POLE_X, hitDisc.y - cameraY);
            if (typeof GameAudio !== 'undefined') GameAudio.paddle();
        }
    }

    // Cámara: sigue la bola para que aparezca cerca de CAMERA_TARGET_Y en pantalla
    targetCameraY = ballY - CAMERA_TARGET_Y;
    if (targetCameraY < 0) targetCameraY = 0;
    cameraY += (targetCameraY - cameraY) * CAMERA_LERP;

    ensureDiscs();
    pruneDiscs();

    // Decaimientos
    if (shake > 0) shake *= 0.85;
    if (flashAlpha > 0) flashAlpha *= 0.90;
    if (comboFlashT > 0) comboFlashT--;

    // Animación "romper" disco (breakT) — lo mantenemos en el array mientras se anima
    for (var k = 0; k < discs.length; k++) {
        if (discs[k].passed && discs[k].breakT > 0) discs[k].breakT--;
    }
}

var gameHud = GU.hud({
    score: null,
    best:  null,
    combo: null,
    mobile: { el: mobileScoreEl, format: function () {
        return 'Puntos: ' + score + '   ·   Récord: ' + best +
            (combo > 1 ? '   ·   Combo x' + combo : '');
    } }
});

function updateMobileScore() {
    gameHud.set({ score: score, best: best, combo: combo });
}

/* ─────────────────────── Render ─────────────────────── */
function drawBackground() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, COL.bgTop);
        g.addColorStop(0.55, COL.bgMid);
        g.addColorStop(1, COL.bgBot);
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    // estrellas (parallax suave con cámara)
    ctx.fillStyle = COL.star;
    for (var i = 0; i < starField.length; i++) {
        var s = starField[i];
        // parallax: estrellas se mueven más lento que la cámara
        var sy = ((s.yWorld - cameraY * 0.3) % (H + 40));
        if (sy < -5) sy += H + 40;
        ctx.globalAlpha = 0.35 + 0.5 * ((i % 7) / 7);
        ctx.fillRect(s.x, sy, s.size, s.size);
    }
    ctx.globalAlpha = 1;
}

function drawPole() {
    // poste central: rectángulo con gradiente, pintado antes que los discos superiores
    var px = POLE_X - 11;
    ctx.fillStyle = gMemo('pole', function () {
        var g = ctx.createLinearGradient(px, 0, px + 22, 0);
        g.addColorStop(0, COL.poleB);
        g.addColorStop(0.5, COL.poleA);
        g.addColorStop(1, COL.poleB);
        return g;
    });
    ctx.fillRect(px, 0, 22, H);
    // luz lateral
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(px + 8, 0, 3, H);
}

/* Dibuja un único segmento (wedge elíptica).
   Si inFront=true se usa la mitad inferior (ángulos 0..π) como "visible al jugador". */
function drawSegment(cx, cy, rx, ry, a0, a1, type, inFront, hueShift, passedT) {
    if (type === 'gap') return;

    var alpha = 1;
    if (passedT > 0) alpha = clamp(passedT / 14, 0, 1);
    if (!inFront) alpha *= 0.7;

    var colorA, colorB;
    if (type === 'danger') {
        colorA = COL.dangerA; colorB = COL.dangerB;
    } else {
        // alternar tono entre hue 180 y 160 para variedad por profundidad
        if ((hueShift % 60) < 30) { colorA = COL.safeA; colorB = COL.safeB; }
        else                       { colorA = COL.safeA2; colorB = COL.safeB2; }
    }

    ctx.globalAlpha = alpha;
    var grad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.closePath();
    ctx.fill();

    // borde oscuro
    ctx.strokeStyle = 'rgba(10,4,30,0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
}

function drawDisc(d) {
    var cy = d.y - cameraY;
    if (cy < -40 || cy > H + 40) return;

    // si está "pasado" y la animación terminó, no dibujar
    if (d.passed && d.breakT <= 0) return;

    var rx = DISC_RX;
    var ry = DISC_RY;

    // animación de ruptura: encoger y dispersar
    if (d.passed && d.breakT > 0) {
        var t = 1 - (d.breakT / 14);
        rx *= (1 + t * 0.4);
        ry *= (1 - t * 0.35);
    }

    // Primero los segmentos "traseros" (ángulos en el semiplano superior: sin(mid+theta) < 0)
    // Un segmento abarca [a0,a1]; su "punto medio" es a_mid = (a0+a1)/2.
    // Si sin(a_mid) > 0 → parte inferior de la elipse (frente). Si < 0 → trasero.
    // Dibujamos primero los traseros, luego los frontales.
    var passes = ['back', 'front'];
    for (var p = 0; p < passes.length; p++) {
        var wantFront = passes[p] === 'front';
        for (var i = 0; i < NUM_SEGMENTS; i++) {
            var a0 = theta + i * SEG_ANGLE;
            var a1 = a0 + SEG_ANGLE;
            var aMid = (a0 + a1) / 2;
            var mid = Math.sin(aMid);
            var inFront = mid > 0;
            if (inFront !== wantFront) continue;
            drawSegment(POLE_X, cy, rx, ry, a0, a1, d.segments[i], inFront, d.hueShift, d.breakT || 14);
        }
        // entre back y front dibujamos el fragmento del poste a esta altura
        // (para que el poste pase por detrás del "frente" pero delante del "back")
        if (p === 0) {
            // pequeño trozo de poste (ya está dibujado globalmente)
            // no hace falta aquí: el poste completo se pintó antes. Nos basta.
        }
    }

    // anillo exterior decorativo (opcional) — muy sutil
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(POLE_X, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawAllDiscs() {
    // pole se dibuja ANTES: así los segmentos frontales lo tapan en su mitad.
    // pero queremos que los segmentos TRASEROS de un disco queden detrás del poste.
    // Solución simple: para cada disco dibujamos traseros, luego el tramo del poste a esa altura,
    // y luego los frontales. En lugar de re-dibujar el poste en tramos, dibujamos un poste
    // global ANTES de los discos, y para cada disco dibujamos primero traseros con alpha bajo
    // y luego frontales con alpha completo. La ilusión 3D se mantiene porque los traseros ya son
    // semitransparentes (ver drawSegment).
    // Orden de discos: de más lejos (menor y en mundo) a más cerca (mayor y).
    // Como y crece hacia abajo y la cámara escala con ballY, dibujamos simplemente en orden natural.
    for (var i = 0; i < discs.length; i++) {
        drawDisc(discs[i]);
    }
}

function drawBall() {
    var bx = POLE_X;
    var by = ballY - cameraY;
    // sombra en el disco inmediatamente inferior
    var below = null;
    for (var i = 0; i < discs.length; i++) {
        if (!discs[i].passed && discs[i].y > ballY) { below = discs[i]; break; }
    }
    if (below) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(bx, below.y - cameraY - DISC_RY * 0.1, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // bola con gradiente radial + highlight
    var g = ctx.createRadialGradient(bx - 4, by - 4, 1, bx, by, BALL_R + 1);
    g.addColorStop(0, COL.ballA);
    g.addColorStop(0.55, COL.ballB);
    g.addColorStop(1, COL.ballC);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(bx - 4, by - 5, 4, 0, Math.PI * 2); ctx.fill();
    // ojo circular (personalidad)
    ctx.fillStyle = '#2a0e04';
    ctx.fillRect(bx + 3, by - 1, 2, 2);
}

function drawParticles() {
    particles.draw(ctx);
    for (var j = 0; j < pops.length; j++) {
        var po = pops[j];
        ctx.globalAlpha = clamp(po.t / 50, 0, 1);
        ctx.fillStyle = '#ffd866';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(po.text, po.x, po.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

function drawHUD() {
    // barra superior
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Puntos: ' + score, 10, 16);
    ctx.textAlign = 'right';
    ctx.fillText('Récord: ' + best, W - 10, 16);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // combo flash
    if (combo > 1) {
        var alpha = 0.45 + (comboFlashT > 0 ? 0.35 : 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd866';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('x' + combo, W / 2, 56);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    // Indicación inicial
    if (!isPlaying && !isOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(40, H / 2 - 42, W - 80, 84);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Arrastra para rotar', W / 2, H / 2 - 10);
        ctx.fillText('o usa A / D', W / 2, H / 2 + 18);
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
}

function drawFlash() {
    if (flashAlpha > 0.01) {
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = '#ff512f';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }
}

/* ─────────────────────── Loop principal ─────────────────────── */
function loop(t) {
    var dt = t - lastT;
    if (dt < 15) { animId = requestAnimationFrame(loop); return; }
    lastT = t;

    if (isPlaying) updatePhysics(dt);
    updateParticles();

    // shake (transform del canvas al dibujar)
    ctx.save();
    if (shake > 0.3) {
        var dx = (Math.random() - 0.5) * shake;
        var dy = (Math.random() - 0.5) * shake;
        ctx.translate(dx, dy);
    }

    drawBackground();
    drawPole();
    drawAllDiscs();
    drawBall();
    drawParticles();
    drawHUD();
    drawFlash();

    ctx.restore();

    if (isPlaying || shake > 0.5 || particles.count > 0 || pops.length > 0 || flashAlpha > 0.02) {
        animId = requestAnimationFrame(loop);
    } else {
        animId = null;
    }
}

/* ─────────────────────── Pantalla inicial ─────────────────────── */
// Pre-render estático para que la pantalla no se vea en negro antes de pulsar "Iniciar".
(function idleRender() {
    ensureDiscs();
    drawBackground();
    drawPole();
    drawAllDiscs();
    drawBall();
    drawHUD();
})();

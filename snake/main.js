// Mostrar controles táctiles y puntaje flotante solo en móvil
function setupMobileUI() {
    const touchControls = document.getElementById('touchControls');
    const mobileScore = document.getElementById('mobileScore');
    if (isMobile()) {
        touchControls.style.display = 'flex';
        mobileScore.style.display = 'block';
        // Eventos de botones táctiles (ocultos globalmente por CSS; se
        // mantienen por compatibilidad, el control real es el swipe en canvas)
        document.getElementById('btnUp').addEventListener('touchstart', function(e) {
            e.preventDefault(); queueDirection('UP');
        });
        document.getElementById('btnDown').addEventListener('touchstart', function(e) {
            e.preventDefault(); queueDirection('DOWN');
        });
        document.getElementById('btnLeft').addEventListener('touchstart', function(e) {
            e.preventDefault(); queueDirection('LEFT');
        });
        document.getElementById('btnRight').addEventListener('touchstart', function(e) {
            e.preventDefault(); queueDirection('RIGHT');
        });
    } else {
        touchControls.style.display = 'none';
        mobileScore.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', setupMobileUI);

// Actualizar puntaje flotante en móvil
/* La guarda `isMobile()` se conserva dentro del callback: en escritorio esta
 * superposición está oculta y su contenido no se lee, así que no hace falta
 * mantenerlo al día. */
const gameHud = GU.hud({
    score: null,
    best:  null,
    mobile: { el: 'mobileScore', html: function () {
        if (!isMobile()) return '';
        return `Puntaje: <b>${score}</b><br>Mejor: <b>${highScore}</b>`;
    } }
});

function updateMobileScore() {
    gameHud.set({ score: score, best: highScore });
}
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let box = 15;
let canvasSize = 600;

// Reescala una coordenada de píxeles del grid antiguo al nuevo (cambio de tamaño
// de canvas por rotación de pantalla). Sin esto la serpiente queda fuera de
// grid y no puede volver a comer nunca.
function rescaleCoord(v, oldBox) {
    const cells = Math.floor(canvasSize / box);
    const idx = Math.min(cells - 1, Math.max(0, Math.round(v / oldBox)));
    return idx * box;
}

function syncCanvasLogicSize() {
    const oldBox = box;
    canvasSize = canvas.width;
    box = Math.max(4, Math.floor(canvasSize / 40));
    if (oldBox !== box) {
        snake.forEach(s => { s.x = rescaleCoord(s.x, oldBox); s.y = rescaleCoord(s.y, oldBox); });
        if (fruit) { fruit.x = rescaleCoord(fruit.x, oldBox); fruit.y = rescaleCoord(fruit.y, oldBox); }
        if (specialFruit) {
            specialFruit.x = rescaleCoord(specialFruit.x, oldBox);
            specialFruit.y = rescaleCoord(specialFruit.y, oldBox);
        }
        bgGradSize = -1;
        fruitGradKey = '';
    }
}
window.addEventListener('resize', syncCanvasLogicSize);
document.addEventListener('DOMContentLoaded', syncCanvasLogicSize);

let snake = [{ x: 9 * box, y: 10 * box }];
let direction = 'RIGHT';
// Cola de giros pendientes: se consume UNO por tick de movimiento. Evita las
// dos patologías clásicas del snake: (a) pulsar ↑ y luego ← dentro del mismo
// tick invertía la dirección y provocaba muerte instantánea, (b) el segundo
// giro de una pulsación rápida se perdía.
let pendingDirs = [];
const OPPOSITE = { LEFT: 'RIGHT', RIGHT: 'LEFT', UP: 'DOWN', DOWN: 'UP' };
let fruit = randomPosition();
let score = 0;
/* El récord va por GU.highScore: comparar, guardar y el valor por defecto
 * en un solo sitio. `highScore` se mantiene porque el resto del fichero la lee. */
var gameBest = GU.highScore('snakeHighScore');

let highScore = gameBest.display(0) || 0;
let gameInterval = null;
let speed = 250;

function queueDirection(dir) {
    if (!isPlaying) return;
    const last = pendingDirs.length ? pendingDirs[pendingDirs.length - 1] : direction;
    if (dir === last || dir === OPPOSITE[last]) return;
    if (pendingDirs.length >= 2) return;
    pendingDirs.push(dir);
    GameAudio.slide();
}


// --- Progresión ---
let level = 1;
let fruitsEaten = 0;
const INITIAL_SPEED = 250;
const MIN_SPEED = 100; // 2.5× más rápido que 250

// --- Multiplicador de puntos ---
function getMultiplier() {
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
}

// --- Fruta especial ---
let specialFruit = null;
let specialFruitTimer = 0;
let specialFruitBlink = 0;
// Ticks de movimiento (a 250ms eran 75 s: la estrella no caducaba nunca en
// la práctica). 45 ticks ≈ 11 s a nivel 1 y ≈ 4,5 s a nivel 10.
const SPECIAL_FRUIT_DURATION = 45;

// --- Flash de muerte (en frames de render, no en ticks) ---
let deathFlash = false;
let deathFlashTimer = 0;
const DEATH_FLASH_FRAMES = 26;

// --- Caché de gradientes ---
let bgGradCache = null, bgGradSize = -1;
let fruitGradCache = null, fruitGradKey = '';
let starGradCache = null, starGradKey = '';

/* La cabeza se dibuja tras un translate, así que su degradado vive en
   coordenadas locales: sólo cambia con el radio y el parpadeo de muerte. */
const headGrads = GU.gradientMemo();
function headGradFor(hr, flash) {
    return headGrads('head:' + hr + ':' + flash, function () {
        const g = ctx.createRadialGradient(-hr * 0.2, -hr * 0.2, hr * 0.05, 0, 0, hr);
        g.addColorStop(0,    flash ? '#ff6060' : '#b2ff59');
        g.addColorStop(0.45, flash ? '#ff1744' : '#76c442');
        g.addColorStop(1,    flash ? '#7f0000' : '#1b5e20');
        return g;
    });
}

// --- Partículas al comer ---
let eatParticles = [];

// --- Mensaje de combo/multiplicador en canvas ---
let hudMessages = []; // { text, x, y, life, color }

// Sonidos: se usa el sistema compartido GameAudio (audio.js), sin archivos.

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    updateMobileScore();
}

function randomPosition() {
    return {
        x: Math.floor(Math.random() * (canvasSize / box)) * box,
        y: Math.floor(Math.random() * (canvasSize / box)) * box
    };
}

// Posición que no coincida con la serpiente
function randomPositionFree() {
    let pos;
    let attempts = 0;
    do {
        pos = randomPosition();
        attempts++;
    } while (attempts < 100 && snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
}

// Spawnea partículas doradas al comer
function spawnEatParticles(x, y, color1, color2) {
    color1 = color1 || '#ffd700';
    color2 = color2 || '#ff8c00';
    const count = 12;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const spd = 1.5 + Math.random() * 2.5;
        eatParticles.push({
            x: x + box / 2,
            y: y + box / 2,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1.0,
            // Decay pensado para 60fps de render (antes se actualizaban a 4fps)
            decay: 0.018 + Math.random() * 0.012,
            size: 2 + Math.random() * 3,
            color: Math.random() > 0.5 ? color1 : color2
        });
    }
}

// Solo mueve/expira. El dibujado va en drawParticles().
function updateParticles() {
    for (let i = eatParticles.length - 1; i >= 0; i--) {
        const p = eatParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= p.decay;
        if (p.life <= 0) eatParticles.splice(i, 1);
    }
}

function drawParticles() {
    if (!eatParticles.length) return;
    // Estado de dibujo fuera del bucle; fillRect en vez de arc para partículas
    // pequeñas (reglas 2, 4 y 6 de rendimiento canvas).
    for (let i = 0; i < eatParticles.length; i++) {
        const p = eatParticles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

// Dibuja la fruta (manzana). El gradiente se cachea: la fruta solo cambia de
// sitio al comerla, así que no hay que reconstruirlo en cada frame.
function getFruitGrad(fx, fy, r) {
    const key = fx + ',' + fy + ',' + r;
    if (fruitGradKey !== key) {
        fruitGradCache = ctx.createRadialGradient(fx - r * 0.25, fy - r * 0.25, r * 0.05, fx, fy, r);
        fruitGradCache.addColorStop(0, '#ff6b6b');
        fruitGradCache.addColorStop(0.5, '#e53935');
        fruitGradCache.addColorStop(1, '#8b0000');
        fruitGradKey = key;
    }
    return fruitGradCache;
}

function drawFruit() {
    const fx = fruit.x + box / 2;
    const fy = fruit.y + box / 2 + 1;
    const r = box / 2 - 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fillStyle = getFruitGrad(fx, fy, r);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(fx - r * 0.3, fy - r * 0.35, r * 0.22, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(fx + 1, fy - r);
    ctx.quadraticCurveTo(fx + r * 0.4, fy - r - r * 0.6, fx + r * 0.3, fy - r - r * 0.9);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(fx + r * 0.25, fy - r - r * 0.5);
    ctx.quadraticCurveTo(fx + r * 0.7, fy - r - r * 0.85, fx + r * 0.5, fy - r - r * 0.3);
    ctx.quadraticCurveTo(fx + r * 0.1, fy - r - r * 0.4, fx + r * 0.25, fy - r - r * 0.5);
    ctx.fillStyle = '#4caf50';
    ctx.fill();

    ctx.restore();
}

function getStarGrad(fx, fy, r) {
    const key = fx + ',' + fy + ',' + r;
    if (starGradKey !== key) {
        starGradCache = ctx.createRadialGradient(fx, fy - r * 0.2, 0, fx, fy, r);
        starGradCache.addColorStop(0, '#fff9c4');
        starGradCache.addColorStop(0.5, '#ffd700');
        starGradCache.addColorStop(1, '#ff6f00');
        starGradKey = key;
    }
    return starGradCache;
}

// Dibuja la fruta especial (estrella dorada parpadeante).
// El contador de parpadeo lo avanza updateEffects(), no esta función.
function drawSpecialFruit() {
    if (!specialFruit) return;
    // Parpadea (cada vez más rápido) en el último tercio de vida.
    if (specialFruitTimer < SPECIAL_FRUIT_DURATION * 0.35) {
        const blinkRate = specialFruitTimer < SPECIAL_FRUIT_DURATION * 0.15 ? 5 : 10;
        if (Math.floor(specialFruitBlink / blinkRate) % 2 !== 0) return;
    }

    const fx = specialFruit.x + box / 2;
    const fy = specialFruit.y + box / 2;
    const r = box / 2 - 1;
    const spikes = 5;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffd700';

    // Estrella
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        const px = fx + Math.cos(ang) * rad;
        const py = fy + Math.sin(ang) * rad;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = getStarGrad(fx, fy, r);
    ctx.fill();
    ctx.strokeStyle = '#fff8e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function drawHUD() {
    // HUD de nivel, multiplicador y puntos en esquinas del canvas
    const margin = 8;
    const fontSize = Math.max(12, Math.floor(box * 0.9));
    ctx.save();

    // Fondo semitransparente para el HUD superior
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvasSize, fontSize + margin * 2);

    // Nivel
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(`NIV ${level}`, margin, margin);

    // Multiplicador
    const mult = getMultiplier();
    const multText = `×${mult}`;
    const multColor = mult === 3 ? '#ff512f' : mult === 2 ? '#ffe082' : '#aaaaaa';
    ctx.fillStyle = multColor;
    const multW = ctx.measureText(multText).width;
    ctx.fillText(multText, canvasSize / 2 - multW / 2, margin);

    // Barra de progreso de nivel
    const barW = Math.floor(canvasSize * 0.28);
    const barH = 5;
    const barX = canvasSize - barW - margin;
    const barY = margin + fontSize - barH;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    const prog = (fruitsEaten % 5) / 5;
    ctx.fillStyle = '#76ff03';
    ctx.fillRect(barX, barY, Math.floor(barW * prog), barH);

    // Texto "Nivel N" en la derecha arriba
    ctx.fillStyle = '#cccccc';
    ctx.font = `${Math.max(10, fontSize - 2)}px monospace`;
    const lvlW = ctx.measureText(`Niv ${level}`).width;
    ctx.fillText(`Niv ${level}`, canvasSize - lvlW - margin, margin);

    ctx.restore();

    // Mensajes flotantes en canvas (multiplicador obtenido, etc.)
    if (hudMessages.length) {
        ctx.save();
        ctx.font = `bold ${Math.max(14, fontSize + 4)}px monospace`;
        ctx.textAlign = 'center';
        for (let i = 0; i < hudMessages.length; i++) {
            const msg = hudMessages[i];
            ctx.globalAlpha = Math.min(1, msg.life / 25);
            ctx.fillStyle = msg.color;
            ctx.fillText(msg.text, msg.x, msg.y);
        }
        ctx.restore();
    }
}

function getBgGrad() {
    if (bgGradSize !== canvasSize) {
        bgGradCache = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
        bgGradCache.addColorStop(0, '#0a0a0a');
        bgGradCache.addColorStop(1, '#111111');
        bgGradSize = canvasSize;
    }
    return bgGradCache;
}

function draw() {
    // Fondo (gradiente cacheado — regla 7)
    ctx.fillStyle = getBgGrad();
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Flash rojo de muerte
    if (deathFlash) {
        ctx.globalAlpha = 0.45 * (deathFlashTimer / DEATH_FLASH_FRAMES);
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.globalAlpha = 1;
    }

    // Grid sutil — un único path para las ~80 líneas en vez de 80 strokes
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let gx = 0; gx <= canvasSize; gx += box) {
        ctx.moveTo(gx, 0); ctx.lineTo(gx, canvasSize);
    }
    for (let gy = 0; gy <= canvasSize; gy += box) {
        ctx.moveTo(0, gy); ctx.lineTo(canvasSize, gy);
    }
    ctx.stroke();

    // ── Cuerpo (de la cola hacia la cabeza) ──
    // Sin gradiente ni save/restore por segmento: dos arcos planos leen igual
    // y evitan crear N gradientes radiales por frame (reglas 2, 4 y 7).
    const bodyR = box / 2 - 1;
    const hiR = bodyR * 0.58;
    for (let i = snake.length - 1; i >= 1; i--) {
        const seg = snake[i];
        const cx = seg.x + box / 2;
        const cy = seg.y + box / 2;
        const fromTail = snake.length - 1 - i;
        ctx.globalAlpha = fromTail === 0 ? 0.4 : fromTail === 1 ? 0.6 : fromTail === 2 ? 0.8 : 1;
        ctx.fillStyle = '#37913c';
        ctx.beginPath();
        ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#68bd6d';
        ctx.beginPath();
        ctx.arc(cx - bodyR * 0.2, cy - bodyR * 0.2, hiR, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Cabeza (único elemento con shadowBlur — regla 1) ──
    const head = snake[0];
    const hx = head.x + box / 2;
    const hy = head.y + box / 2;
    const hr = box / 2;

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = deathFlash ? '#ff1744' : '#76ff03';
    /* La cabeza se mueve, así que el degradado se construye en el origen y
       se traslada; sólo depende del radio y del parpadeo de muerte. */
    ctx.translate(hx, hy);
    ctx.fillStyle = headGradFor(hr, deathFlash);
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.stroke();

    // Ojos
    let eyeOffsetX = 0, eyeOffsetY = 0, pupilOffsetX = 0, pupilOffsetY = 0;
    if (direction === 'LEFT') { eyeOffsetX = -box / 4; pupilOffsetX = -1.5; }
    if (direction === 'RIGHT') { eyeOffsetX = box / 4; pupilOffsetX = 1.5; }
    if (direction === 'UP') { eyeOffsetY = -box / 4; pupilOffsetY = -1.5; }
    if (direction === 'DOWN') { eyeOffsetY = box / 4; pupilOffsetY = 1.5; }
    const eyeLX = hx - box / 6 + eyeOffsetX / 2;
    const eyeRX = hx + box / 6 + eyeOffsetX / 2;
    const eyeY = hy - box / 6 + eyeOffsetY / 2;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eyeLX, eyeY, box / 8, 0, Math.PI * 2);
    ctx.arc(eyeRX, eyeY, box / 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(eyeLX + pupilOffsetX, eyeY + pupilOffsetY, box / 18, 0, Math.PI * 2);
    ctx.arc(eyeRX + pupilOffsetX, eyeY + pupilOffsetY, box / 18, 0, Math.PI * 2);
    ctx.fill();

    drawFruit();
    drawSpecialFruit();
    drawParticles();
    drawHUD();
}

// Avanza todo lo puramente visual. Corre a 60fps, desacoplado del tick de
// movimiento (antes las partículas y los mensajes solo avanzaban 4 veces por
// segundo, en el propio draw()).
function updateEffects() {
    updateParticles();

    for (let i = hudMessages.length - 1; i >= 0; i--) {
        const msg = hudMessages[i];
        msg.y -= 0.8;
        msg.life -= 1;
        if (msg.life <= 0) hudMessages.splice(i, 1);
    }

    if (specialFruit) specialFruitBlink++;

    if (deathFlash) {
        deathFlashTimer--;
        if (deathFlashTimer <= 0) {
            deathFlash = false;
            gameOver();
        }
    }
}

let lastRenderTs = 0;
function renderLoop(ts) {
    requestAnimationFrame(renderLoop);
    if (ts - lastRenderTs < 15) return;
    lastRenderTs = ts;
    updateEffects();
    draw();
}

function addHudMessage(text, x, y, color) {
    hudMessages.push({ text, x, y, life: 60, color: color || '#ffd700' });
}

function updateLevel() {
    const newLevel = Math.floor(fruitsEaten / 5) + 1;
    if (newLevel !== level) {
        const prevMult = getMultiplier();
        level = newLevel;
        addHudMessage(`NIVEL ${level}`, canvasSize / 2, canvasSize / 2, '#8fd3f4');
        const mult = getMultiplier();
        if (mult > 1) {
            addHudMessage(`×${mult} PTS`, canvasSize / 2, canvasSize / 2 + 30, '#ffe082');
        }
        // Solo el salto de multiplicador merece el sonido de hito
        if (mult > prevMult) GameAudio.scoreHigh();
    }
}

function computeSpeed() {
    // Velocidad va de INITIAL_SPEED a MIN_SPEED a medida que sube el nivel
    // Nivel 1 → 250ms, nivel máximo (~10) → 100ms
    const maxLevel = 10;
    const t = Math.min(1, (level - 1) / (maxLevel - 1));
    return Math.round(INITIAL_SPEED - t * (INITIAL_SPEED - MIN_SPEED));
}

function moveSnake() {
    // Consume UN giro pendiente por tick (ver queueDirection)
    if (pendingDirs.length) direction = pendingDirs.shift();

    let head = { ...snake[0] };
    if (direction === 'LEFT') head.x -= box;
    if (direction === 'RIGHT') head.x += box;
    if (direction === 'UP') head.y -= box;
    if (direction === 'DOWN') head.y += box;

    // Colisión con paredes
    if (head.x < 0 || head.x >= canvasSize || head.y < 0 || head.y >= canvasSize) {
        triggerDeathFlash();
        return;
    }

    // Colisión con sí mismo. El último segmento se libera en este mismo tick,
    // así que entrar en su celda es legal (la fruta nunca aparece sobre la
    // serpiente, así que no hay caso en que la cola se quede quieta ahí).
    const bodyEnd = snake.length - 1;
    for (let i = 0; i < bodyEnd; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            triggerDeathFlash();
            return;
        }
    }

    snake.unshift(head);

    let ate = false;

    // Comer fruta normal
    if (head.x === fruit.x && head.y === fruit.y) {
        ate = true;
        fruitsEaten++;
        const mult = getMultiplier();
        const pts = mult;
        score += pts;
        spawnEatParticles(fruit.x, fruit.y, '#ffd700', '#ff8c00');
        if (mult > 1) addHudMessage(`+${pts}`, fruit.x + box / 2, fruit.y, '#ffe082');
        updateLevel();
        fruit = randomPositionFree();
        GameAudio.score();

        // Cada 10 frutas, spawn de fruta especial
        if (fruitsEaten % 10 === 0 && !specialFruit) {
            specialFruit = randomPositionFree();
            specialFruitTimer = SPECIAL_FRUIT_DURATION;
            specialFruitBlink = 0;
        }
    }

    // Comer fruta especial
    if (specialFruit && head.x === specialFruit.x && head.y === specialFruit.y) {
        ate = true;
        const mult = getMultiplier();
        const pts = mult * 5;
        score += pts;
        spawnEatParticles(specialFruit.x, specialFruit.y, '#ffd700', '#fff176');
        addHudMessage(`¡+${pts}!`, specialFruit.x + box / 2, specialFruit.y, '#ffd700');
        specialFruit = null;
        specialFruitTimer = 0;
        GameAudio.powerUp();
    }

    if (!ate) {
        snake.pop();
    }

    // Temporizador fruta especial
    if (specialFruit) {
        specialFruitTimer--;
        if (specialFruitTimer <= 0) {
            specialFruit = null;
        }
    }

    // Ajustar velocidad según nivel
    const targetSpeed = computeSpeed();
    if (targetSpeed !== speed) {
        speed = targetSpeed;
        rafClear(gameInterval);
        gameInterval = rafInterval(moveSnake, speed);
    }

    updateScore();
}

// El flash y la transición a game over los avanza updateEffects() en el bucle
// de render, para que duren siempre lo mismo independientemente del nivel.
function triggerDeathFlash() {
    rafClear(gameInterval);
    gameInterval = null;
    pendingDirs.length = 0;
    deathFlash = true;
    deathFlashTimer = DEATH_FLASH_FRAMES;
    GameAudio.hit();
}

// Control de teclado
const KEY_DIRS = {
    ArrowLeft: 'LEFT', ArrowUp: 'UP', ArrowRight: 'RIGHT', ArrowDown: 'DOWN',
    a: 'LEFT', w: 'UP', d: 'RIGHT', s: 'DOWN',
    A: 'LEFT', W: 'UP', D: 'RIGHT', S: 'DOWN',
};
window.addEventListener('keydown', e => {
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    queueDirection(dir);
});

// Swipe gestures en el canvas
(function() {
    var swipeStartX, swipeStartY;
    var MIN_SWIPE = 30;

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        // Ocultar botones táctiles al usar swipe en canvas
        var tc = document.getElementById('touchControls');
        if (tc) tc.style.display = 'none';
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        var dx = e.changedTouches[0].clientX - swipeStartX;
        var dy = e.changedTouches[0].clientY - swipeStartY;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < MIN_SWIPE) {
            // TAP: iniciar si no ha empezado, reiniciar si hay game over
            if (!isPlaying && !deathFlash) { startGame(); }
        } else if (absDx > absDy) {
            queueDirection(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
            queueDirection(dy > 0 ? 'DOWN' : 'UP');
        }
    }, { passive: false });
})();

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

let isPlaying = false;

// Estado inicial común a iniciar y reiniciar (una sola definición: antes
// estaban duplicados y era fácil que se desincronizaran).
function resetRoundState() {
    rafClear(gameInterval);
    gameInterval = null;
    syncCanvasLogicSize();
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    pendingDirs.length = 0;
    fruit = randomPositionFree();
    score = 0;
    level = 1;
    fruitsEaten = 0;
    speed = INITIAL_SPEED;
    specialFruit = null;
    specialFruitTimer = 0;
    specialFruitBlink = 0;
    eatParticles = [];
    hudMessages = [];
    deathFlash = false;
    deathFlashTimer = 0;
    updateScore();
    gameInterval = rafInterval(moveSnake, speed);
}

function startGame() {
    if (isPlaying) return;
    isPlaying = true;
    GameAudio.start();
    gameControls.running();
    // En móvil se inicia tocando el canvas: el popup podía quedarse encima
    document.getElementById('gameOverPopup').style.display = 'none';
    resetRoundState();
}

function restartGame() {
    if (!isPlaying) return;
    resetRoundState();
}

function gameOver() {
    rafClear(gameInterval);
    if (gameBest.submit(score)) {
        highScore = gameBest.value;
        GameAudio.scoreHigh();
    }
    GameAudio.gameOver();
    const popup = document.getElementById('gameOverPopup');
    const finalScore = document.getElementById('finalScore');
    popup.style.display = 'flex';
    finalScore.textContent = `Puntaje: ${score}  |  Nivel: ${level}`;
    isPlaying = false;
    gameControls.idle();
    updateMobileScore();
}

/* `isPlaying = false` antes de arrancar: startGame() reengancha el bucle de
 * lógica y sin bajar la bandera antes quedarían dos corriendo sobre la misma
 * serpiente. */
var gameControls = GU.controls({
    start:     startGame,
    restart:   restartGame,
    playAgain: function () { isPlaying = false; startGame(); },
    popup:     'gameOverPopup'
});

// Inicializa
syncCanvasLogicSize();
updateScore();
draw();
/* renderLoop sólo se referenciaba a sí mismo: nadie lo arrancaba, así que el
   canvas se quedaba en el primer frame — y ni eso, porque el `reset` de
   MobileLayout reasigna canvas.width justo después y eso lo borra. La lógica
   seguía corriendo sobre rafInterval, de ahí que el marcador sí avanzara. */
requestAnimationFrame(renderLoop);

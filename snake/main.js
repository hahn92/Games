// Mostrar controles táctiles y puntaje flotante solo en móvil
function setupMobileUI() {
    const touchControls = document.getElementById('touchControls');
    const mobileScore = document.getElementById('mobileScore');
    if (isMobile()) {
        touchControls.style.display = 'flex';
        mobileScore.style.display = 'block';
        // Eventos de botones táctiles
        document.getElementById('btnUp').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'DOWN') direction = 'UP';
        });
        document.getElementById('btnDown').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'UP') direction = 'DOWN';
        });
        document.getElementById('btnLeft').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'RIGHT') direction = 'LEFT';
        });
        document.getElementById('btnRight').addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (direction !== 'LEFT') direction = 'RIGHT';
        });
    } else {
        touchControls.style.display = 'none';
        mobileScore.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', setupMobileUI);

// Actualizar puntaje flotante en móvil
function updateMobileScore() {
    const mobileScore = document.getElementById('mobileScore');
    if (isMobile() && mobileScore) {
        mobileScore.innerHTML = `Puntaje: <b>${score}</b><br>Mejor: <b>${highScore}</b>`;
    }
}
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let box = 15;
let canvasSize = 600;

function syncCanvasLogicSize() {
    canvasSize = canvas.width;
    box = Math.floor(canvasSize / 40);
}
window.addEventListener('resize', syncCanvasLogicSize);
document.addEventListener('DOMContentLoaded', syncCanvasLogicSize);

let snake = [{ x: 9 * box, y: 10 * box }];
let direction = 'RIGHT';
let fruit = randomPosition();
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameInterval;
let speed = 250;

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
const SPECIAL_FRUIT_DURATION = 300; // ticks (a velocidad base)

// --- Flash de muerte ---
let deathFlash = false;
let deathFlashTimer = 0;

// --- Partículas al comer ---
let eatParticles = [];

// --- Mensaje de combo/multiplicador en canvas ---
let hudMessages = []; // { text, x, y, life, color }

// Sonidos
const eatSound = new Audio('eat.mp3');
const gameOverSound = new Audio('gameover.mp3');
const moveSound = new Audio('move.mp3');

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
            decay: 0.04 + Math.random() * 0.03,
            size: 2 + Math.random() * 3,
            color: Math.random() > 0.5 ? color1 : color2
        });
    }
}

function updateParticles() {
    for (let i = eatParticles.length - 1; i >= 0; i--) {
        const p = eatParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= p.decay;
        if (p.life <= 0) {
            eatParticles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// Dibuja la fruta (manzana)
function drawFruit() {
    const fx = fruit.x + box / 2;
    const fy = fruit.y + box / 2 + 1;
    const r = box / 2 - 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(fx - r * 0.25, fy - r * 0.25, r * 0.05, fx, fy, r);
    bodyGrad.addColorStop(0, '#ff6b6b');
    bodyGrad.addColorStop(0.5, '#e53935');
    bodyGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = bodyGrad;
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

// Dibuja la fruta especial (estrella dorada parpadeante)
function drawSpecialFruit() {
    if (!specialFruit) return;
    specialFruitBlink++;
    // Parpadeo: ocultar cada 6 ticks en los últimos 100 ticks
    const blinkRate = specialFruitTimer < 100 ? 4 : 8;
    if (Math.floor(specialFruitBlink / blinkRate) % 2 === 0 && specialFruitTimer < 150) {
        // visible
    } else if (specialFruitTimer >= 150) {
        // siempre visible al inicio
    } else {
        return;
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
    const starGrad = ctx.createRadialGradient(fx, fy - r * 0.2, 0, fx, fy, r);
    starGrad.addColorStop(0, '#fff9c4');
    starGrad.addColorStop(0.5, '#ffd700');
    starGrad.addColorStop(1, '#ff6f00');
    ctx.fillStyle = starGrad;
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

    // Frutas hasta siguiente nivel
    const fruitsToNext = 5 - (fruitsEaten % 5);
    const nextText = `+${fruitsToNext}🍎`;
    ctx.fillStyle = '#81c784';
    const nw = ctx.measureText(nextText).width;
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
    for (let i = hudMessages.length - 1; i >= 0; i--) {
        const msg = hudMessages[i];
        msg.y -= 0.8;
        msg.life -= 1;
        if (msg.life <= 0) {
            hudMessages.splice(i, 1);
            continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, msg.life / 20);
        ctx.font = `bold ${Math.max(14, fontSize + 4)}px monospace`;
        ctx.fillStyle = msg.color;
        ctx.textAlign = 'center';
        ctx.fillText(msg.text, msg.x, msg.y);
        ctx.restore();
    }
}

function draw() {
    // Fondo
    const bgGrad = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    bgGrad.addColorStop(0, '#0a0a0a');
    bgGrad.addColorStop(1, '#111111');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Flash rojo de muerte
    if (deathFlash) {
        ctx.save();
        ctx.globalAlpha = 0.45 * (deathFlashTimer / 8);
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.restore();
    }

    // Grid sutil
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= canvasSize; gx += box) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvasSize); ctx.stroke();
    }
    for (let gy = 0; gy <= canvasSize; gy += box) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvasSize, gy); ctx.stroke();
    }
    ctx.restore();

    // Serpiente
    for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const cx = seg.x + box / 2;
        const cy = seg.y + box / 2;
        const isHead = i === 0;
        const tailLen = snake.length;

        let alpha = 1.0;
        if (!isHead) {
            const fromTail = tailLen - 1 - i;
            if (fromTail === 0) alpha = 0.4;
            else if (fromTail === 1) alpha = 0.6;
            else if (fromTail === 2) alpha = 0.8;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        // Flash rojo en la cabeza al morir
        const headColor0 = (deathFlash && isHead) ? '#ff6060' : '#b2ff59';
        const headColor1 = (deathFlash && isHead) ? '#ff1744' : '#76c442';
        const headColor2 = (deathFlash && isHead) ? '#7f0000' : '#1b5e20';

        if (isHead) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = deathFlash ? '#ff1744' : '#76ff03';
        }

        const radius = isHead ? box / 2 : box / 2 - 1;
        const grad = ctx.createRadialGradient(
            cx - radius * 0.2, cy - radius * 0.2, radius * 0.05,
            cx, cy, radius
        );
        if (isHead) {
            grad.addColorStop(0, headColor0);
            grad.addColorStop(0.45, headColor1);
            grad.addColorStop(1, headColor2);
        } else {
            grad.addColorStop(0, '#81c784');
            grad.addColorStop(0.45, '#4caf50');
            grad.addColorStop(1, '#1b5e20');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();

        if (!isHead && box > 8) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.55, Math.PI * 0.2, Math.PI * 0.8);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        if (isHead) {
            ctx.save();
            let eyeOffsetX = 0, eyeOffsetY = 0, pupilOffsetX = 0, pupilOffsetY = 0;
            if (direction === 'LEFT') { eyeOffsetX = -box / 4; pupilOffsetX = -1.5; }
            if (direction === 'RIGHT') { eyeOffsetX = box / 4; pupilOffsetX = 1.5; }
            if (direction === 'UP') { eyeOffsetY = -box / 4; pupilOffsetY = -1.5; }
            if (direction === 'DOWN') { eyeOffsetY = box / 4; pupilOffsetY = 1.5; }

            ctx.beginPath();
            ctx.arc(cx - box / 6 + eyeOffsetX / 2, cy - box / 6 + eyeOffsetY / 2, box / 8, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + box / 6 + eyeOffsetX / 2, cy - box / 6 + eyeOffsetY / 2, box / 8, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(cx - box / 6 + eyeOffsetX / 2 + pupilOffsetX, cy - box / 6 + eyeOffsetY / 2 + pupilOffsetY, box / 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + box / 6 + eyeOffsetX / 2 + pupilOffsetX, cy - box / 6 + eyeOffsetY / 2 + pupilOffsetY, box / 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    drawFruit();
    drawSpecialFruit();
    updateParticles();
    drawHUD();
}

function addHudMessage(text, x, y, color) {
    hudMessages.push({ text, x, y, life: 60, color: color || '#ffd700' });
}

function updateLevel() {
    const newLevel = Math.floor(fruitsEaten / 5) + 1;
    if (newLevel !== level) {
        level = newLevel;
        addHudMessage(`NIVEL ${level}`, canvasSize / 2, canvasSize / 2, '#8fd3f4');
        const mult = getMultiplier();
        if (mult > 1) {
            addHudMessage(`×${mult} PTS`, canvasSize / 2, canvasSize / 2 + 30, '#ffe082');
        }
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

    // Colisión con sí mismo
    for (let i = 0; i < snake.length; i++) {
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
        eatSound.currentTime = 0; eatSound.play();

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
        eatSound.currentTime = 0; eatSound.play();
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
        clearInterval(gameInterval);
        gameInterval = setInterval(moveSnake, speed);
    }

    draw();
    updateScore();
    updateMobileScore();
}

function triggerDeathFlash() {
    clearInterval(gameInterval);
    deathFlash = true;
    deathFlashTimer = 8;
    // Dibujar el flash y luego mostrar game over
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        deathFlashTimer--;
        flashCount++;
        draw();
        if (flashCount >= 8) {
            clearInterval(flashInterval);
            deathFlash = false;
            gameOver();
        }
    }, 60);
}

// Control de teclado
window.addEventListener('keydown', e => {
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && direction !== 'RIGHT') { direction = 'LEFT'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowUp' && direction !== 'DOWN') { direction = 'UP'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowRight' && direction !== 'LEFT') { direction = 'RIGHT'; moveSound.currentTime = 0; moveSound.play(); }
    if (e.key === 'ArrowDown' && direction !== 'UP') { direction = 'DOWN'; moveSound.currentTime = 0; moveSound.play(); }
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
            if (!isPlaying) { startGame(); }
        } else if (absDx > absDy) {
            if (dx > 0) { if (direction !== 'LEFT') { direction = 'RIGHT'; moveSound.currentTime = 0; moveSound.play(); } }
            else        { if (direction !== 'RIGHT') { direction = 'LEFT';  moveSound.currentTime = 0; moveSound.play(); } }
        } else {
            if (dy > 0) { if (direction !== 'UP')   { direction = 'DOWN';  moveSound.currentTime = 0; moveSound.play(); } }
            else        { if (direction !== 'DOWN')  { direction = 'UP';    moveSound.currentTime = 0; moveSound.play(); } }
        }
    }, { passive: false });
})();

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

let isPlaying = false;

function startGame() {
    if (isPlaying) return;
    isPlaying = true;
    restartBtn.disabled = false;
    startBtn.disabled = true;
    syncCanvasLogicSize();
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPositionFree();
    score = 0;
    level = 1;
    fruitsEaten = 0;
    speed = INITIAL_SPEED;
    specialFruit = null;
    specialFruitTimer = 0;
    eatParticles = [];
    hudMessages = [];
    deathFlash = false;
    updateScore();
    updateMobileScore();
    draw();
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}

function restartGame() {
    if (!isPlaying) return;
    clearInterval(gameInterval);
    syncCanvasLogicSize();
    snake = [{ x: 9 * box, y: 10 * box }];
    direction = 'RIGHT';
    fruit = randomPositionFree();
    score = 0;
    level = 1;
    fruitsEaten = 0;
    speed = INITIAL_SPEED;
    specialFruit = null;
    specialFruitTimer = 0;
    eatParticles = [];
    hudMessages = [];
    deathFlash = false;
    updateScore();
    updateMobileScore();
    draw();
    gameInterval = setInterval(moveSnake, speed);
}

function gameOver() {
    clearInterval(gameInterval);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
    }
    gameOverSound.currentTime = 0; gameOverSound.play();
    const popup = document.getElementById('gameOverPopup');
    const finalScore = document.getElementById('finalScore');
    popup.style.display = 'flex';
    finalScore.textContent = `Puntaje: ${score}  |  Nivel: ${level}`;
    isPlaying = false;
    startBtn.disabled = false;
    restartBtn.disabled = true;
    updateMobileScore();
}

document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverPopup').style.display = 'none';
    isPlaying = false;
    startGame();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

// Inicializa
syncCanvasLogicSize();
updateScore();
draw();

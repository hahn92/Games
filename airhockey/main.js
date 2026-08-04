// ===== Air Hockey =====
const canvas = document.getElementById('hockeyCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 360
const H = canvas.height;  // 600

// ---- Constantes ----
const WIN_SCORE = 7;
const PUCK_RADIUS = 13;
const MALLET_RADIUS = 26;
const PUCK_FRICTION = 0.995;     // fricción baja
const PUCK_MAX_SPEED = 14;
const PUCK_MIN_SPEED = 0.04;
const GOAL_WIDTH = 140;          // ancho de la portería
const WALL = 8;                  // grosor visual de borde interior
const RESTITUTION = 0.92;        // rebote en paredes
const MALLET_MAX_V = 26;         // tope de velocidad efectiva del mazo (un puntero que
                                 // teletransporta no debe lanzar el disco al infinito)
const SUB_STEP_MAX = 7;          // px máximos que avanza el disco por sub-paso
const MAX_SUB_STEPS = 4;
const STALL_LIMIT = 160;         // frames con el disco parado antes de reponerlo al centro
const WALL_SOUND_MIN = 1.1;      // velocidad mínima de impacto para sonar el rebote
const AI_BASE_SPEED = 4.2;
const AI_BASE_REACT = 0.10;

const COLOR_PLAYER = '#8fd3f4';
const COLOR_CPU = '#ff512f';
const COLOR_PUCK = '#ffe066';

// ---- Estado ----
let state = {
    running: false,
    over: false,
    scoreP: 0,
    scoreCpu: 0,
    wins: 0,
    aiSpeed: AI_BASE_SPEED,  // velocidad de la IA, se ajusta con la diferencia de goles
    aiReact: AI_BASE_REACT,  // suavizado del seguimiento
    serveTimer: 0,       // cuenta atrás tras un gol
    serveToCpu: false,
    flash: 0,            // flash de gol
    flashColor: '#fff',
    shake: 0,
    stall: 0,            // frames con el disco practicamente parado
};

const puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
const player = { x: W / 2, y: H * 0.78, px: W / 2, py: H * 0.78 };
const cpu = { x: W / 2, y: H * 0.18, vx: 0, vy: 0 };

// Pool de partículas precomputado
const particles = [];
const MAX_PARTICLES = 60;
for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2 });
}
function spawnParticles(x, y, n, color) {
    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < n; i++) {
        const p = particles[i];
        if (p.life > 0) continue;
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 3.5;
        p.x = x; p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.maxLife = 18 + Math.random() * 16;
        p.life = p.maxLife;
        p.color = color;
        p.size = 1.5 + Math.random() * 2.5;
        spawned++;
    }
}

// Caché de gradientes
let goalGradTop = null, goalGradBot = null, centerGrad = null;
function buildGradients() {
    goalGradTop = ctx.createLinearGradient(0, 0, 0, 40);
    goalGradTop.addColorStop(0, 'rgba(255,81,47,0.55)');
    goalGradTop.addColorStop(1, 'rgba(255,81,47,0)');
    goalGradBot = ctx.createLinearGradient(0, H - 40, 0, H);
    goalGradBot.addColorStop(0, 'rgba(143,211,244,0)');
    goalGradBot.addColorStop(1, 'rgba(143,211,244,0.55)');
    centerGrad = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, 60);
    centerGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
    centerGrad.addColorStop(1, 'rgba(255,255,255,0)');
}
buildGradients();

// ---- DOM ----
const scorePlayerEl = document.getElementById('scorePlayer');
const scoreCpuEl = document.getElementById('scoreCpu');
const winsEl = document.getElementById('wins');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const popup = document.getElementById('gameOverPopup');
const popupTitle = document.getElementById('popupTitle');
const finalScore = document.getElementById('finalScore');
const finalBest = document.getElementById('finalBest');
const mobileScore = document.getElementById('mobileScore');

// localStorage
function loadStats() {
    const s = GameStore.getJSON('airhockeyStats', null);
    if (s) state.wins = s.wins || 0;
    winsEl.textContent = state.wins;
}
function saveStats() {
    GameStore.setJSON('airhockeyStats', { wins: state.wins });
}
loadStats();

function updateHUD() {
    scorePlayerEl.textContent = state.scoreP;
    scoreCpuEl.textContent = state.scoreCpu;
    winsEl.textContent = state.wins;
    mobileScore.textContent = 'Tú ' + state.scoreP + '  -  ' + state.scoreCpu + ' CPU';
}

// ---- Reset ----
function resetPuck(toCpu) {
    puck.x = W / 2;
    puck.y = toCpu ? H * 0.35 : H * 0.65;
    puck.vx = 0;
    puck.vy = 0;
    state.serveTimer = 45;
    state.serveToCpu = toCpu;
    state.stall = 0;
    // El mazo de la CPU vuelve a su base: si se quedaba encima del punto de saque
    // golpeaba el disco en el instante del pitido.
    cpu.x = W / 2; cpu.y = H * 0.18; cpu.vx = 0; cpu.vy = 0;
    // El mazo del jugador no se mueve (lo controla el dedo), pero sí se anula su
    // velocidad histórica para que no arrastre un impulso fantasma al saque.
    player.px = player.x;
    player.py = player.y;
}

// Dificultad adaptativa: la IA aprieta cuando el jugador va por delante y se relaja
// cuando va por detrás. Nunca imbatible (tope 8) ni trivial (suelo 3.4).
function tuneAI() {
    const diff = state.scoreP - state.scoreCpu;
    let sp = AI_BASE_SPEED + diff * 0.55;
    let re = AI_BASE_REACT + diff * 0.015;
    state.aiSpeed = sp < 3.4 ? 3.4 : (sp > 8 ? 8 : sp);
    state.aiReact = re < 0.075 ? 0.075 : (re > 0.2 ? 0.2 : re);
}

function startGame() {
    state.running = true;
    state.over = false;
    state.scoreP = 0;
    state.scoreCpu = 0;
    state.aiSpeed = AI_BASE_SPEED;
    state.aiReact = AI_BASE_REACT;
    state.flash = 0;
    state.shake = 0;
    state.stall = 0;
    player.x = W / 2; player.y = H * 0.78;
    player.px = player.x; player.py = player.y;
    cpu.x = W / 2; cpu.y = H * 0.18; cpu.vx = 0; cpu.vy = 0;
    for (const p of particles) p.life = 0;
    resetPuck(Math.random() < 0.5);
    state.serveTimer = 60;
    popup.style.display = 'none';
    restartBtn.disabled = false;
    updateHUD();
    GameAudio.start();
}

// ---- Input ----
function pointerToCanvas(clientX, clientY) {
    return GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
}

let dragging = false;
function setPlayerTarget(cx, cy) {
    let x = cx, y = cy;
    // Mazo confinado a la mitad inferior
    const minY = H / 2 + MALLET_RADIUS;
    if (y < minY) y = minY;
    if (y > H - MALLET_RADIUS) y = H - MALLET_RADIUS;
    if (x < MALLET_RADIUS) x = MALLET_RADIUS;
    if (x > W - MALLET_RADIUS) x = W - MALLET_RADIUS;
    player.x = x;
    player.y = y;
}

canvas.addEventListener('mousedown', (e) => {
    if (!state.running) return;
    dragging = true;
    const p = pointerToCanvas(e.clientX, e.clientY);
    setPlayerTarget(p.x, p.y);
});
window.addEventListener('mousemove', (e) => {
    if (!dragging || !state.running) return;
    const p = pointerToCanvas(e.clientX, e.clientY);
    setPlayerTarget(p.x, p.y);
});
window.addEventListener('mouseup', () => { dragging = false; });

canvas.addEventListener('touchstart', (e) => {
    if (!state.running) return;
    e.preventDefault();
    dragging = true;
    const t = e.touches[0];
    const p = pointerToCanvas(t.clientX, t.clientY);
    setPlayerTarget(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    if (!dragging || !state.running) return;
    e.preventDefault();
    const t = e.touches[0];
    const p = pointerToCanvas(t.clientX, t.clientY);
    setPlayerTarget(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchend', () => { dragging = false; }, { passive: false });

startBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });
restartBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });
playAgainBtn.addEventListener('click', () => { GameAudio.click(); startGame(); });

// ---- Física ----
function clampPuckSpeed() {
    const sp = Math.hypot(puck.vx, puck.vy);
    if (sp > PUCK_MAX_SPEED) {
        const k = PUCK_MAX_SPEED / sp;
        puck.vx *= k;
        puck.vy *= k;
    }
}

// allowPush: solo el primer contacto del frame añade el empuje del mazo y suena,
// los sub-pasos siguientes se limitan a separar (si no, un mismo golpe se cobraba
// varias veces y el sonido se disparaba en ráfaga).
function malletPuckCollision(mx, my, mvx, mvy, allowPush) {
    const dx = puck.x - mx;
    const dy = puck.y - my;
    let dist = Math.hypot(dx, dy);
    const minDist = PUCK_RADIUS + MALLET_RADIUS;
    if (dist < minDist) {
        let nx, ny;
        if (dist > 0.0001) {
            nx = dx / dist; ny = dy / dist;
        } else {
            // Mazo exactamente encima del disco: expulsa hacia la portería contraria
            nx = 0; ny = my > H / 2 ? -1 : 1; dist = 0.0001;
        }
        // separa
        const overlap = minDist - dist;
        puck.x += nx * overlap;
        puck.y += ny * overlap;
        // velocidad relativa
        const relVx = puck.vx - mvx;
        const relVy = puck.vy - mvy;
        const relN = relVx * nx + relVy * ny;
        if (relN < 0) {
            const impulse = -(1 + RESTITUTION) * relN;
            puck.vx += impulse * nx;
            puck.vy += impulse * ny;
        }
        // empuje del mazo — solo en el primer sub-paso del frame
        if (allowPush) {
            puck.vx += mvx * 0.45;
            puck.vy += mvy * 0.45;
            const sp = Math.hypot(mvx, mvy);
            if (sp > 3) { GameAudio.paddle(); } else { GameAudio.hit(); }
            spawnParticles(puck.x, puck.y, 6, COLOR_PUCK);
        }
        clampPuckSpeed();
        return true;
    }
    return false;
}

function goalScored(byPlayer) {
    if (byPlayer) {
        state.scoreP++;
        state.flashColor = COLOR_PLAYER;
        spawnParticles(W / 2, 18, 22, COLOR_PLAYER);
    } else {
        state.scoreCpu++;
        state.flashColor = COLOR_CPU;
        spawnParticles(W / 2, H - 18, 22, COLOR_CPU);
    }
    // Reajusta la IA en ambas direcciones. El ajuste anterior solo subía cuando
    // marcaba la CPU, así que una racha suya la dejaba clavada en su tope y la
    // remontada era imposible.
    tuneAI();
    state.flash = 14;
    state.shake = 10;
    updateHUD();
    GameAudio.goal();

    if (state.scoreP >= WIN_SCORE || state.scoreCpu >= WIN_SCORE) {
        endGame();
    } else {
        // el que recibe saca
        resetPuck(byPlayer);
    }
}

function endGame() {
    state.running = false;
    state.over = true;
    restartBtn.disabled = true;
    const playerWon = state.scoreP >= WIN_SCORE;
    if (playerWon) {
        state.wins++;
        saveStats();
        popupTitle.textContent = '¡Has ganado!';
        GameAudio.win();
    } else {
        popupTitle.textContent = '¡Has perdido!';
        GameAudio.gameOver();
    }
    finalScore.textContent = state.scoreP + ' - ' + state.scoreCpu;
    finalBest.textContent = 'Victorias totales: ' + state.wins;
    popup.style.display = 'flex';
    updateHUD();
}

function updateAI() {
    // IA persigue el disco cuando está en su mitad; si no, vuelve a defender
    let targetX, targetY;
    const defendY = H * 0.16;
    if (puck.y < H * 0.5) {
        // ataca: situarse detrás del disco para empujarlo hacia abajo
        targetX = puck.x;
        targetY = puck.y - PUCK_RADIUS - MALLET_RADIUS * 0.7;
        if (targetY < MALLET_RADIUS) targetY = MALLET_RADIUS;
    } else {
        // defiende: seguir X del disco cerca de su portería
        targetX = W / 2 + (puck.x - W / 2) * 0.7;
        targetY = defendY;
    }
    // limita al área de la CPU (mitad superior)
    if (targetX < MALLET_RADIUS) targetX = MALLET_RADIUS;
    if (targetX > W - MALLET_RADIUS) targetX = W - MALLET_RADIUS;
    const maxY = H / 2 - MALLET_RADIUS;
    if (targetY > maxY) targetY = maxY;
    if (targetY < MALLET_RADIUS) targetY = MALLET_RADIUS;

    const dx = targetX - cpu.x;
    const dy = targetY - cpu.y;
    let mvx = dx * state.aiReact;
    let mvy = dy * state.aiReact;
    const sp = Math.hypot(mvx, mvy);
    if (sp > state.aiSpeed) {
        const k = state.aiSpeed / sp;
        mvx *= k; mvy *= k;
    }
    const prevX = cpu.x, prevY = cpu.y;
    cpu.x += mvx;
    cpu.y += mvy;
    cpu.vx = cpu.x - prevX;
    cpu.vy = cpu.y - prevY;
}

// Rebotes en las bandas y detección de gol. Devuelve true si hubo gol, en cuyo
// caso el que llama debe cortar el frame: goalScored() ya reposiciona el disco.
// El sonido se filtra por WALL_SOUND_MIN porque un disco casi parado apoyado en
// la banda entraba aquí en cada sub-paso y disparaba el rebote en ráfaga.
function resolveWallsAndGoals() {
    if (puck.x - PUCK_RADIUS < WALL) {
        puck.x = WALL + PUCK_RADIUS;
        if (Math.abs(puck.vx) > WALL_SOUND_MIN) GameAudio.hit();
        puck.vx = Math.abs(puck.vx) * RESTITUTION;
    } else if (puck.x + PUCK_RADIUS > W - WALL) {
        puck.x = W - WALL - PUCK_RADIUS;
        if (Math.abs(puck.vx) > WALL_SOUND_MIN) GameAudio.hit();
        puck.vx = -Math.abs(puck.vx) * RESTITUTION;
    }

    const goalL = (W - GOAL_WIDTH) / 2;
    const goalR = (W + GOAL_WIDTH) / 2;

    // pared/portería superior (CPU)
    if (puck.y - PUCK_RADIUS < WALL) {
        if (puck.x > goalL && puck.x < goalR) {
            goalScored(true);   // jugador marca arriba
            return true;
        }
        puck.y = WALL + PUCK_RADIUS;
        if (Math.abs(puck.vy) > WALL_SOUND_MIN) GameAudio.hit();
        puck.vy = Math.abs(puck.vy) * RESTITUTION;
    }
    // pared/portería inferior (jugador)
    if (puck.y + PUCK_RADIUS > H - WALL) {
        if (puck.x > goalL && puck.x < goalR) {
            goalScored(false);  // CPU marca abajo
            return true;
        }
        puck.y = H - WALL - PUCK_RADIUS;
        if (Math.abs(puck.vy) > WALL_SOUND_MIN) GameAudio.hit();
        puck.vy = -Math.abs(puck.vy) * RESTITUTION;
    }
    return false;
}

function update() {
    if (!state.running) return;

    if (state.serveTimer > 0) {
        state.serveTimer--;
        // durante el saque el disco está quieto; permite mover mazos
    }

    // mover IA
    updateAI();

    // Velocidad del mazo del jugador, deducida de su movimiento y acotada:
    // el puntero puede saltar cientos de píxeles en un frame (teletransporte del
    // ratón o un touch nuevo lejos del anterior) y eso lanzaba el disco a una
    // velocidad absurda de un solo golpe.
    let pvx = player.x - player.px;
    let pvy = player.y - player.py;
    const pv = Math.hypot(pvx, pvy);
    if (pv > MALLET_MAX_V) {
        const k = MALLET_MAX_V / pv;
        pvx *= k; pvy *= k;
    }
    player.px = player.x;
    player.py = player.y;

    // física del disco (solo si ya se sacó)
    if (state.serveTimer <= 0) {
        puck.vx *= PUCK_FRICTION;
        puck.vy *= PUCK_FRICTION;
        if (Math.abs(puck.vx) < PUCK_MIN_SPEED) puck.vx = 0;
        if (Math.abs(puck.vy) < PUCK_MIN_SPEED) puck.vy = 0;

        // Sub-pasos: a máxima velocidad el disco recorre más que su propio radio
        // en un frame y podía atravesar un mazo o la línea de gol sin tocarlos.
        const dist = Math.hypot(puck.vx, puck.vy);
        let steps = Math.ceil(dist / SUB_STEP_MAX);
        if (steps < 1) steps = 1;
        if (steps > MAX_SUB_STEPS) steps = MAX_SUB_STEPS;

        for (let s = 0; s < steps; s++) {
            puck.x += puck.vx / steps;
            puck.y += puck.vy / steps;
            // solo el primer sub-paso cobra el empuje y el sonido del mazo
            malletPuckCollision(player.x, player.y, pvx, pvy, s === 0);
            malletPuckCollision(cpu.x, cpu.y, cpu.vx, cpu.vy, s === 0);
            if (resolveWallsAndGoals()) return;
        }

        // Disco parado lejos de las bandas: sin esto la partida puede quedarse
        // muerta en el centro, fuera del alcance de ambos mazos.
        if (dist < PUCK_MIN_SPEED * 2) {
            if (++state.stall > STALL_LIMIT) resetPuck(Math.random() < 0.5);
        } else {
            state.stall = 0;
        }
    } else {
        // Durante el saque el disco está quieto, pero los mazos siguen pudiendo
        // tocarlo y hay que mantenerlo dentro de la pista.
        malletPuckCollision(player.x, player.y, pvx, pvy, true);
        malletPuckCollision(cpu.x, cpu.y, cpu.vx, cpu.vy, true);
        if (resolveWallsAndGoals()) return;
    }

    // partículas
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (p.life <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.life--;
    }

    if (state.flash > 0) state.flash--;
    if (state.shake > 0) state.shake--;
}

// ---- Dibujo ----
function drawTable() {
    // fondo
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, W, H);

    // línea central
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WALL, H / 2);
    ctx.lineTo(W - WALL, H / 2);
    ctx.stroke();

    // círculo central
    ctx.fillStyle = centerGrad;
    ctx.fillRect(W / 2 - 60, H / 2 - 60, 120, 120);
    ctx.strokeStyle = 'rgba(143,211,244,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // bordes neón
    ctx.strokeStyle = COLOR_PLAYER;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLOR_PLAYER;
    ctx.strokeRect(WALL / 2, WALL / 2, W - WALL, H - WALL);
    ctx.shadowBlur = 0;

    // porterías
    const goalL = (W - GOAL_WIDTH) / 2;
    ctx.fillStyle = goalGradTop;
    ctx.fillRect(goalL, 0, GOAL_WIDTH, 40);
    ctx.fillStyle = goalGradBot;
    ctx.fillRect(goalL, H - 40, GOAL_WIDTH, 40);

    ctx.strokeStyle = COLOR_CPU;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(goalL, WALL / 2);
    ctx.lineTo(goalL + GOAL_WIDTH, WALL / 2);
    ctx.stroke();

    ctx.strokeStyle = COLOR_PLAYER;
    ctx.beginPath();
    ctx.moveTo(goalL, H - WALL / 2);
    ctx.lineTo(goalL + GOAL_WIDTH, H - WALL / 2);
    ctx.stroke();
}

function drawMallet(m, color) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    // base
    ctx.beginPath();
    ctx.arc(m.x, m.y, MALLET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    // anillo interior
    ctx.beginPath();
    ctx.arc(m.x, m.y, MALLET_RADIUS * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,16,32,0.85)';
    ctx.fill();
    // pomo
    ctx.beginPath();
    ctx.arc(m.x, m.y, MALLET_RADIUS * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // brillo
    ctx.beginPath();
    ctx.arc(m.x - MALLET_RADIUS * 0.25, m.y - MALLET_RADIUS * 0.25, MALLET_RADIUS * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
}

function drawPuck() {
    ctx.shadowBlur = 16;
    ctx.shadowColor = COLOR_PUCK;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_PUCK;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
}

function drawParticles() {
    // batch: una sola pasada, alpha por partícula
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawScoreOnTable() {
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,81,47,0.10)';
    ctx.fillText(String(state.scoreCpu), W / 2, H * 0.28);
    ctx.fillStyle = 'rgba(143,211,244,0.10)';
    ctx.fillText(String(state.scoreP), W / 2, H * 0.72);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

function draw() {
    let ox = 0, oy = 0;
    if (state.shake > 0) {
        // Deterministic jitter from the shake counter (no Math.random in render)
        ox = Math.sin(state.shake * 12.9898) * state.shake * 0.5;
        oy = Math.cos(state.shake * 78.233) * state.shake * 0.5;
    }
    ctx.save();
    ctx.translate(ox, oy);

    drawTable();
    drawScoreOnTable();
    drawParticles();
    drawMallet(cpu, COLOR_CPU);
    drawMallet(player, COLOR_PLAYER);
    drawPuck();

    // indicador de saque
    if (state.running && state.serveTimer > 0) {
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('¡Saque!', W / 2, H / 2 - 70);
        ctx.textAlign = 'left';
    }

    ctx.restore();

    // flash de gol (encima de todo, sin shake)
    if (state.flash > 0) {
        ctx.globalAlpha = (state.flash / 14) * 0.4;
        ctx.fillStyle = state.flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    if (!state.running && !state.over) {
        ctx.fillStyle = 'rgba(10,16,32,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText('Pulsa Iniciar', W / 2, H / 2);
        ctx.textAlign = 'left';
    }
}

// ---- Loop ----
let lastFrameTs = 0;
function loop(ts) {
    if (ts - lastFrameTs < 15) {
        requestAnimationFrame(loop);
        return;
    }
    lastFrameTs = ts;
    update();
    draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
updateHUD();

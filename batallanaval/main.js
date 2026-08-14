// ===== Batalla Naval =====
// Battleship 10x10 vs hunt/target AI. Canvas-rendered, no emoji.

const canvas = document.getElementById('navalCanvas');
const ctx = canvas.getContext('2d');
const CW = canvas.width;   // 380
const CH = canvas.height;  // 640

const GRID = 10;
const FLEET = [5, 4, 3, 3, 2];           // longitudes de la flota estándar
const SHIP_NAMES = ['Portaaviones', 'Acorazado', 'Crucero', 'Submarino', 'Destructor'];

// Layout: tablero enemigo arriba (grande), tablero propio abajo (pequeño)
const ENEMY_BOARD = { x: 20, y: 70, cell: 34 };       // 34*10 = 340
const OWN_BOARD = { x: 90, y: 470, cell: 20 };        // 20*10 = 200

// Estado del juego
let state = 'idle';   // idle | placing | playing | playerWin | aiWin
let playerShips = [];  // {len, cells:[{r,c}], hits:Set, horizontal, name}
let aiShips = [];
let playerShots = [];  // 10x10: 0 desconocido, 1 agua, 2 tocado
let aiShots = [];      // disparos de la IA sobre el tablero del jugador
let turn = 'player';   // player | ai
let busy = false;      // bloquea input durante animaciones

// IA hunt/target
let aiMode = 'hunt';
let aiTargetQueue = [];     // celdas candidatas a probar
let aiHitStack = [];        // celdas tocadas del barco actual

// Efectos
const particles = new Particles(160);   // pooled, see game-utils.js
let splashes = [];
/* Sacudida compartida: las compensaciones se eligen en update(), no en draw().
 * Antes draw() llamaba a Math.random() en cada frame, lo que la regla de
 * rendimiento prohíbe — un mismo frame repintado dos veces temblaba. */
/* decay 0.76 reproduce la duración del decremento lineal anterior
 * (10 → 0 restando 0.6 por frame, unos 17 frames). */
const shake = new GU.Shake({ decay: 0.76 });
let stats = { wins: 0, losses: 0 };

// ---- Utilidades de stats ----
function loadStats() {
    const s = GameStore.getJSON('navalStats', null);
    if (s && typeof s.wins === 'number') stats = s;
    updateStatsUI();
}
function saveStats() {
    GameStore.setJSON('navalStats', stats);
}
function updateStatsUI() {
    const w = document.getElementById('wins');
    const l = document.getElementById('losses');
    if (w) w.textContent = stats.wins;
    if (l) l.textContent = stats.losses;
}

// ---- Construcción de tableros ----
function emptyBoard() {
    const b = [];
    for (let r = 0; r < GRID; r++) b.push(new Array(GRID).fill(0));
    return b;
}

function randomFleet() {
    const ships = [];
    const occ = emptyBoard();
    for (let i = 0; i < FLEET.length; i++) {
        const len = FLEET[i];
        let placed = false, attempts = 0;
        while (!placed && attempts < 1000) {
            attempts++;
            const horizontal = Math.random() < 0.5;
            const r = Math.floor(Math.random() * GRID);
            const c = Math.floor(Math.random() * GRID);
            if (horizontal && c + len > GRID) continue;
            if (!horizontal && r + len > GRID) continue;
            // comprobar espacio libre
            let ok = true;
            for (let k = 0; k < len; k++) {
                const rr = horizontal ? r : r + k;
                const cc = horizontal ? c + k : c;
                if (occ[rr][cc]) { ok = false; break; }
            }
            if (!ok) continue;
            const cells = [];
            for (let k = 0; k < len; k++) {
                const rr = horizontal ? r : r + k;
                const cc = horizontal ? c + k : c;
                occ[rr][cc] = 1;
                cells.push({ r: rr, c: cc });
            }
            ships.push({ len, cells, hits: new Set(), horizontal, name: SHIP_NAMES[i] });
            placed = true;
        }
    }
    return ships;
}

function shipAt(ships, r, c) {
    for (const s of ships) {
        for (const cell of s.cells) {
            if (cell.r === r && cell.c === c) return s;
        }
    }
    return null;
}

function isSunk(ship) {
    return ship.hits.size >= ship.len;
}

function allSunk(ships) {
    return ships.every(isSunk);
}

// ---- Inicio / reinicio ----
function startGame() {
    GameAudio.start();
    aiShips = randomFleet();
    playerShips = randomFleet();
    playerShots = emptyBoard();
    aiShots = emptyBoard();
    aiMode = 'hunt';
    aiTargetQueue = [];
    aiHitStack = [];
    turn = 'player';
    busy = false;
    particles.clear();
    splashes = [];
    shake.stop();
    state = 'placing';
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('gameOverPopup').style.display = 'none';
    updateMobileScore();
}

function beginCombat() {
    GameAudio.click();
    state = 'playing';
    turn = 'player';
    updateMobileScore();
}

function fullReset() {
    state = 'idle';
    playerShips = [];
    aiShips = [];
    playerShots = emptyBoard();
    aiShots = emptyBoard();
    particles.clear();
    splashes = [];
    document.getElementById('restartBtn').disabled = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    updateMobileScore();
}

// ---- Efectos: partículas precomputadas ----
function spawnExplosion(x, y) {
    GameAudio.explode();
    shake.hit(10);
    const n = 16;
    for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const sp = 1.5 + Math.random() * 2.5;
        /* the old per-frame `decay` becomes a lifetime in seconds */
        const decay = 0.02 + Math.random() * 0.02;
        particles.add(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, {
            life: 1 / (decay * 60),
            size: 2 + Math.random() * 3,
            color: Math.random() < 0.6 ? '#ffd24a' : '#ff512f',
            gravity: 0.05, shape: 'square'
        });
    }
}

function spawnSplash(x, y) {
    GameAudio.splash();
    const n = 10;
    for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const sp = 1 + Math.random() * 2;
        splashes.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp - 1,
            life: 1,
            decay: 0.03 + Math.random() * 0.02,
            r: 1.5 + Math.random() * 2
        });
    }
}

// ---- Disparo del jugador ----
function playerFire(r, c) {
    if (state !== 'playing' || turn !== 'player' || busy) return;
    if (playerShots[r][c] !== 0) return;   // ya disparado
    const px = ENEMY_BOARD.x + c * ENEMY_BOARD.cell + ENEMY_BOARD.cell / 2;
    const py = ENEMY_BOARD.y + r * ENEMY_BOARD.cell + ENEMY_BOARD.cell / 2;
    const ship = shipAt(aiShips, r, c);
    if (ship) {
        playerShots[r][c] = 2;
        ship.hits.add(r + ',' + c);
        spawnExplosion(px, py);
        if (allSunk(aiShips)) {
            endGame(true);
            return;
        }
        // tocado: el jugador repite turno
    } else {
        playerShots[r][c] = 1;
        spawnSplash(px, py);
        GameAudio.hit();
        turn = 'ai';
        busy = true;
        setTimeout(aiTurn, 650);
    }
    updateMobileScore();
}

// ---- IA hunt/target ----
function aiInBounds(r, c) {
    return r >= 0 && r < GRID && c >= 0 && c < GRID;
}

function aiPickHunt() {
    // estrategia de paridad: solo celdas (r+c) par no disparadas
    const cands = [];
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            if (aiShots[r][c] === 0 && (r + c) % 2 === 0) cands.push({ r, c });
        }
    }
    if (cands.length === 0) {
        // respaldo: cualquier celda libre
        for (let r = 0; r < GRID; r++)
            for (let c = 0; c < GRID; c++)
                if (aiShots[r][c] === 0) cands.push({ r, c });
    }
    return cands[Math.floor(Math.random() * cands.length)];
}

function aiEnqueueAround(r, c) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (aiInBounds(nr, nc) && aiShots[nr][nc] === 0) {
            aiTargetQueue.push({ r: nr, c: nc });
        }
    }
}

function aiEnqueueLine() {
    // si hay 2+ aciertos alineados, prioriza extender la línea
    if (aiHitStack.length < 2) return;
    const sameRow = aiHitStack.every(h => h.r === aiHitStack[0].r);
    const sameCol = aiHitStack.every(h => h.c === aiHitStack[0].c);
    if (sameRow) {
        const r = aiHitStack[0].r;
        const cols = aiHitStack.map(h => h.c);
        const minC = Math.min(...cols), maxC = Math.max(...cols);
        const ends = [{ r, c: minC - 1 }, { r, c: maxC + 1 }];
        aiTargetQueue = ends.filter(e => aiInBounds(e.r, e.c) && aiShots[e.r][e.c] === 0);
    } else if (sameCol) {
        const c = aiHitStack[0].c;
        const rows = aiHitStack.map(h => h.r);
        const minR = Math.min(...rows), maxR = Math.max(...rows);
        const ends = [{ r: minR - 1, c }, { r: maxR + 1, c }];
        aiTargetQueue = ends.filter(e => aiInBounds(e.r, e.c) && aiShots[e.r][e.c] === 0);
    }
}

function aiTurn() {
    if (state !== 'playing') { busy = false; return; }
    let pick = null;
    if (aiMode === 'target') {
        while (aiTargetQueue.length > 0) {
            const cand = aiTargetQueue.shift();
            if (aiShots[cand.r][cand.c] === 0) { pick = cand; break; }
        }
        if (!pick) { aiMode = 'hunt'; aiHitStack = []; }
    }
    if (!pick) pick = aiPickHunt();
    if (!pick) { busy = false; return; }

    const { r, c } = pick;
    const px = OWN_BOARD.x + c * OWN_BOARD.cell + OWN_BOARD.cell / 2;
    const py = OWN_BOARD.y + r * OWN_BOARD.cell + OWN_BOARD.cell / 2;
    const ship = shipAt(playerShips, r, c);

    if (ship) {
        aiShots[r][c] = 2;
        ship.hits.add(r + ',' + c);
        spawnExplosion(px, py);
        aiMode = 'target';
        aiHitStack.push({ r, c });
        if (isSunk(ship)) {
            // barco hundido: limpiar persecución
            aiMode = 'hunt';
            aiHitStack = [];
            aiTargetQueue = [];
        } else {
            aiEnqueueAround(r, c);
            aiEnqueueLine();
        }
        if (allSunk(playerShips)) {
            endGame(false);
            return;
        }
        // tocado: la IA repite turno
        setTimeout(aiTurn, 650);
    } else {
        aiShots[r][c] = 1;
        spawnSplash(px, py);
        GameAudio.hit();
        turn = 'player';
        busy = false;
    }
    updateMobileScore();
}

// ---- Fin de partida ----
function endGame(playerWon) {
    state = playerWon ? 'playerWin' : 'aiWin';
    busy = false;
    if (playerWon) {
        stats.wins++;
        GameAudio.win();
    } else {
        stats.losses++;
        GameAudio.gameOver();
    }
    saveStats();
    updateStatsUI();
    setTimeout(() => {
        const popup = document.getElementById('gameOverPopup');
        document.getElementById('popupTitle').textContent = playerWon ? '¡Victoria!' : 'Derrota';
        document.getElementById('finalScore').textContent = playerWon
            ? 'Has hundido toda la flota enemiga.'
            : 'La IA hundió tu flota.';
        document.getElementById('finalBest').textContent =
            'Victorias: ' + stats.wins + '  Derrotas: ' + stats.losses;
        popup.style.display = 'flex';
    }, 1100);
    updateMobileScore();
}

// ---- Mobile score overlay ----
const gameHud = GU.hud({
    record: null,
    state:  null,
    turn:   null,
    mobile: { el: 'mobileScore', format: function () {
        let txt = 'V:' + stats.wins + ' D:' + stats.losses;
        if (state === 'placing') txt += '  Coloca tu flota';
        else if (state === 'playing') txt += (turn === 'player' ? '  Tu turno' : '  Turno IA');
        return txt;
    } }
});

function updateMobileScore() {
    gameHud.set({ record: stats.wins + '-' + stats.losses, state: state, turn: turn });
}

// ===== Render =====
let lastFrameTs = 0;

function draw(ts) {
    requestAnimationFrame(draw);
    if (ts - lastFrameTs < 15) return;
    lastFrameTs = ts;

    // actualizar efectos
    updateEffects();

    ctx.clearRect(0, 0, CW, CH);

    ctx.save();
    shake.translate(ctx);

    drawBackground();

    if (state === 'idle') {
        drawTitle();
    } else {
        drawEnemyBoard();
        drawOwnBoard();
        drawEffects();
        drawHeader();
        if (state === 'placing') drawPlacingControls();
        drawCursor();
    }

    ctx.restore();
}

function updateEffects() {
    shake.update();
    particles.update();
    for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.x += s.vx; s.y += s.vy;
        s.vy += 0.12;
        s.life -= s.decay;
        if (s.life <= 0) splashes.splice(i, 1);
    }
}

function drawBackground() {
    // mar con bandas
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, '#08203a');
    g.addColorStop(1, '#03101f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
}

function drawTitle() {
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BATALLA NAVAL', CW / 2, CH / 2 - 30);
    ctx.fillStyle = '#b7c6d6';
    ctx.font = '16px sans-serif';
    ctx.fillText('Pulsa Iniciar para colocar tu flota', CW / 2, CH / 2 + 10);
    ctx.textAlign = 'left';
}

function drawHeader() {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff512f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('FLOTA ENEMIGA', ENEMY_BOARD.x, ENEMY_BOARD.y - 12);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('TU FLOTA', OWN_BOARD.x, OWN_BOARD.y - 10);

    // estado de turno
    let msg = '';
    if (state === 'playing') msg = (turn === 'player') ? 'Tu turno: dispara' : 'La IA dispara...';
    else if (state === 'placing') msg = 'Coloca tu flota y pulsa Listo';
    ctx.fillStyle = '#dfe9f5';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg, CW / 2, OWN_BOARD.y - 28);
    ctx.textAlign = 'left';
}

function drawGridLines(bx, by, cell) {
    ctx.strokeStyle = 'rgba(143,211,244,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
        ctx.moveTo(bx + i * cell, by);
        ctx.lineTo(bx + i * cell, by + GRID * cell);
        ctx.moveTo(bx, by + i * cell);
        ctx.lineTo(bx + GRID * cell, by + i * cell);
    }
    ctx.stroke();
}

function drawEnemyBoard() {
    const { x, y, cell } = ENEMY_BOARD;
    // fondo del tablero
    ctx.fillStyle = 'rgba(8,40,72,0.6)';
    ctx.fillRect(x, y, GRID * cell, GRID * cell);
    drawGridLines(x, y, cell);

    // marcadores de disparos
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const v = playerShots[r][c];
            if (v === 0) continue;
            const cx = x + c * cell + cell / 2;
            const cy = y + r * cell + cell / 2;
            if (v === 1) {
                // agua: punto azul
                ctx.fillStyle = 'rgba(143,211,244,0.5)';
                ctx.beginPath();
                ctx.arc(cx, cy, cell * 0.13, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // tocado: marca naranja
                ctx.strokeStyle = '#ff512f';
                ctx.lineWidth = 2.5;
                const o = cell * 0.28;
                ctx.beginPath();
                ctx.moveTo(cx - o, cy - o); ctx.lineTo(cx + o, cy + o);
                ctx.moveTo(cx + o, cy - o); ctx.lineTo(cx - o, cy + o);
                ctx.stroke();
            }
        }
    }
    // barcos enemigos hundidos: revelarlos
    for (const s of aiShips) {
        if (isSunk(s)) drawSunkShip(s, x, y, cell, false);
    }
}

function drawOwnBoard() {
    const { x, y, cell } = OWN_BOARD;
    ctx.fillStyle = 'rgba(8,40,72,0.6)';
    ctx.fillRect(x, y, GRID * cell, GRID * cell);

    // dibujar barcos propios siempre
    for (const s of playerShips) {
        drawOwnShip(s, x, y, cell);
    }
    drawGridLines(x, y, cell);

    // disparos de la IA encima
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const v = aiShots[r][c];
            if (v === 0) continue;
            const cx = x + c * cell + cell / 2;
            const cy = y + r * cell + cell / 2;
            if (v === 1) {
                ctx.fillStyle = 'rgba(143,211,244,0.6)';
                ctx.beginPath();
                ctx.arc(cx, cy, cell * 0.13, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.strokeStyle = '#ff512f';
                ctx.lineWidth = 2;
                const o = cell * 0.3;
                ctx.beginPath();
                ctx.moveTo(cx - o, cy - o); ctx.lineTo(cx + o, cy + o);
                ctx.moveTo(cx + o, cy - o); ctx.lineTo(cx - o, cy + o);
                ctx.stroke();
            }
        }
    }
}

function shipBounds(ship) {
    const rows = ship.cells.map(c => c.r);
    const cols = ship.cells.map(c => c.c);
    return {
        minR: Math.min(...rows), maxR: Math.max(...rows),
        minC: Math.min(...cols), maxC: Math.max(...cols)
    };
}

function drawOwnShip(ship, bx, by, cell) {
    const b = shipBounds(ship);
    const x = bx + b.minC * cell + cell * 0.15;
    const y = by + b.minR * cell + cell * 0.15;
    const w = (b.maxC - b.minC + 1) * cell - cell * 0.3;
    const h = (b.maxR - b.minR + 1) * cell - cell * 0.3;
    const sunk = isSunk(ship);
    ctx.fillStyle = sunk ? '#5a3a2a' : '#3a5a72';
    roundRectPath(x, y, w, h, cell * 0.25);
    ctx.fill();
    ctx.strokeStyle = sunk ? '#ff512f' : '#8fd3f4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawSunkShip(ship, bx, by, cell, own) {
    const b = shipBounds(ship);
    const x = bx + b.minC * cell + cell * 0.12;
    const y = by + b.minR * cell + cell * 0.12;
    const w = (b.maxC - b.minC + 1) * cell - cell * 0.24;
    const h = (b.maxR - b.minR + 1) * cell - cell * 0.24;
    ctx.fillStyle = 'rgba(120,60,40,0.85)';
    roundRectPath(x, y, w, h, cell * 0.25);
    ctx.fill();
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function roundRectPath(x, y, w, h, r) { GU.roundRectPath(ctx, x, y, w, h, r); }

function drawEffects() {
    // partículas de explosión
    particles.draw(ctx);
    // gotas de agua
    for (let i = 0; i < splashes.length; i++) {
        const s = splashes[i];
        ctx.globalAlpha = Math.max(0, s.life) * 0.8;
        ctx.fillStyle = '#8fd3f4';
        ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
    }
    ctx.globalAlpha = 1;
}

// ---- Controles de colocación (botones dibujados en canvas) ----
const placeBtns = {
    shuffle: { x: 40, y: 600, w: 140, h: 32, label: 'Recolocar' },
    ready: { x: 200, y: 600, w: 140, h: 32, label: 'Listo' }
};

function drawPlacingControls() {
    ctx.textAlign = 'center';
    drawCanvasButton(placeBtns.shuffle, '#3a5a72');
    drawCanvasButton(placeBtns.ready, '#1f7a3a');
    ctx.textAlign = 'left';
}

function drawCanvasButton(btn, color) {
    roundRectPath(btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 5);
}

function pointInBtn(x, y, btn) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

// ===== Input =====
function canvasPos(e) { return GU.pointerPos(canvas, e); }

function handlePointer(e) {
    if (state === 'idle') return;
    e.preventDefault();
    const { x, y } = canvasPos(e);
    handleAt(x, y);
}

/* Separado del evento para que el cursor de teclado entre por aquí con el
 * centro de su objetivo, en vez de fabricar un evento de ratón falso. */
function handleAt(x, y) {
    if (state === 'idle') return;

    if (state === 'placing') {
        if (pointInBtn(x, y, placeBtns.shuffle)) {
            GameAudio.click();
            playerShips = randomFleet();
            return;
        }
        if (pointInBtn(x, y, placeBtns.ready)) {
            beginCombat();
            return;
        }
        return;
    }

    if (state === 'playing' && turn === 'player' && !busy) {
        const b = ENEMY_BOARD;
        if (x >= b.x && x < b.x + GRID * b.cell && y >= b.y && y < b.y + GRID * b.cell) {
            const c = Math.floor((x - b.x) / b.cell);
            const r = Math.floor((y - b.y) / b.cell);
            playerFire(r, c);
        }
    }
}

/* ── Cursor de teclado ──
 * Los objetivos cambian con la fase: colocando son los dos botones, en combate
 * son las 100 casillas del tablero enemigo. targets() se consulta en cada
 * pulsación, así que basta con devolver lo que toque en ese momento. */
const cursor = GU.canvasCursor(canvas, {
    label: 'Batalla Naval. Flechas para moverte, Enter para disparar.',
    targets: function () {
        if (state === 'placing') {
            return [placeBtns.shuffle, placeBtns.ready].map(function (b) {
                return { x: b.x, y: b.y, w: b.w, h: b.h, id: b.label, btn: b };
            });
        }
        if (state !== 'playing' || turn !== 'player' || busy) return [];
        const b = ENEMY_BOARD, out = [];
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
            out.push({ x: b.x + c * b.cell, y: b.y + r * b.cell, w: b.cell, h: b.cell,
                       id: r + ',' + c, r: r, c: c });
        }
        return out;
    },
    activate: function (t) { handleAt(t.x + t.w / 2, t.y + t.h / 2); }
});

function drawCursor() {
    const t = cursor && cursor.target(); if (!t) return;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.strokeRect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3);
    ctx.strokeStyle = '#181818'; ctx.lineWidth = 1;
    ctx.strokeRect(t.x + 3.5, t.y + 3.5, t.w - 7, t.h - 7);
}

canvas.addEventListener('mousedown', handlePointer);
canvas.addEventListener('touchstart', handlePointer, { passive: false });

// ===== Botones DOM =====
/* Iniciar sólo arranca desde parado: pulsarlo con la partida en curso no debe
 * rehacer el tablero a media batalla. */
var gameControls = GU.controls({
    start:   function () { if (state === 'idle') startGame(); },
    restart: startGame,
    popup:   'gameOverPopup'
});

// ===== Init =====
playerShots = emptyBoard();
aiShots = emptyBoard();
loadStats();
updateMobileScore();
requestAnimationFrame(draw);

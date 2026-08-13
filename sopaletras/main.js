// ===== Sopa de Letras =====
const canvas = document.getElementById('sopaCanvas');
const ctx = canvas.getContext('2d');

const GRID = 12;
const CANVAS_W = 380;
const CANVAS_H = 560;
const GRID_PAD = 14;          // padding around grid
const GRID_TOP = 70;          // space reserved on top for word list on mobile
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 8 direcciones: (dx, dy)
const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1]
];

// Colores distintos para palabras halladas
const WORD_COLORS = [
    '#8fd3f4', '#ff512f', '#7CFC8A', '#ffd166',
    '#c792ea', '#ff8fab', '#4dd0e1', '#ffa94d'
];

// Banco temático de palabras (~60) en español, sin acentos ni Ñ para simplicidad de grilla
const WORD_BANK = [
    // Animales
    'GATO', 'PERRO', 'LEON', 'TIGRE', 'CABALLO', 'DELFIN', 'AGUILA', 'ZORRO',
    'CONEJO', 'BALLENA', 'CEBRA', 'PANDA', 'LOBO', 'TORTUGA', 'CANGURO',
    // Frutas
    'MANZANA', 'PERA', 'PLATANO', 'NARANJA', 'UVA', 'FRESA', 'MELON', 'KIWI',
    'MANGO', 'CEREZA', 'LIMON', 'PINA', 'SANDIA', 'CIRUELA',
    // Colores
    'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'MORADO', 'ROSA', 'NEGRO', 'BLANCO',
    'NARANJA', 'DORADO', 'PLATA',
    // Paises
    'ESPANA', 'MEXICO', 'CHILE', 'PERU', 'BRASIL', 'FRANCIA', 'ITALIA',
    'JAPON', 'CANADA', 'EGIPTO', 'GRECIA', 'CUBA', 'BOLIVIA',
    // Naturaleza
    'SOL', 'LUNA', 'ESTRELLA', 'NUBE', 'LLUVIA', 'MONTANA', 'RIO', 'MAR',
    'BOSQUE', 'FLOR', 'ARBOL', 'VIENTO'
];

let grid = [];                // letras
let solutions = [];           // {word, cells:[{r,c}], dir, found, colorIdx}
let cellSize = 0;
let gridOffX = 0, gridOffY = 0;

let state = {
    running: false,
    foundCount: 0,
    score: 0,
    startTime: 0,
    elapsed: 0,
    highScore: 0
};

// Selección por arrastre
let dragging = false;
let dragStart = null;   // {r,c}
let dragEnd = null;     // {r,c}

// Animaciones — pooled shared particle system (see game-utils.js)
const particles = new Particles(200);
let lastFrameTs = 0;

const HS_KEY = 'sopaletrasHighScore';

// ===== Generación de la grilla =====
function pickWords(n) {
    // mezcla y selecciona n palabras únicas que quepan (<= GRID)
    const pool = WORD_BANK.filter(w => w.length <= GRID);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = [];
    const seen = new Set();
    for (const w of pool) {
        if (seen.has(w)) continue;
        seen.add(w);
        chosen.push(w);
        if (chosen.length >= n) break;
    }
    return chosen;
}

function emptyGrid() {
    const g = [];
    for (let r = 0; r < GRID; r++) {
        g.push(new Array(GRID).fill(null));
    }
    return g;
}

function canPlace(g, word, r, c, dx, dy) {
    for (let i = 0; i < word.length; i++) {
        const rr = r + dy * i;
        const cc = c + dx * i;
        if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return false;
        const cur = g[rr][cc];
        if (cur !== null && cur !== word[i]) return false;
    }
    return true;
}

function placeWord(g, word) {
    const tries = 200;
    for (let t = 0; t < tries; t++) {
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        const dx = dir[0], dy = dir[1];
        const r = Math.floor(Math.random() * GRID);
        const c = Math.floor(Math.random() * GRID);
        if (canPlace(g, word, r, c, dx, dy)) {
            const cells = [];
            for (let i = 0; i < word.length; i++) {
                const rr = r + dy * i;
                const cc = c + dx * i;
                g[rr][cc] = word[i];
                cells.push({ r: rr, c: cc });
            }
            return { word, cells, dir, found: false };
        }
    }
    return null;
}

function generateBoard() {
    let attempt = 0;
    while (attempt < 30) {
        attempt++;
        const g = emptyGrid();
        const words = pickWords(8);
        const sols = [];
        let ok = true;
        // colocar las más largas primero
        words.sort((a, b) => b.length - a.length);
        for (const w of words) {
            const sol = placeWord(g, w);
            if (!sol) { ok = false; break; }
            sols.push(sol);
        }
        if (!ok) continue;
        // rellenar huecos
        for (let r = 0; r < GRID; r++) {
            for (let c = 0; c < GRID; c++) {
                if (g[r][c] === null) {
                    g[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
                }
            }
        }
        // asignar colores
        sols.forEach((s, i) => { s.colorIdx = i; });
        grid = g;
        solutions = sols;
        return;
    }
    // fallback improbable: vuelve a intentar con cualquier resultado
    generateBoard();
}

// ===== Layout =====
function computeLayout() {
    const usableW = CANVAS_W - GRID_PAD * 2;
    const usableH = CANVAS_H - GRID_TOP - GRID_PAD;
    cellSize = Math.floor(Math.min(usableW, usableH) / GRID);
    const gridW = cellSize * GRID;
    gridOffX = Math.floor((CANVAS_W - gridW) / 2);
    gridOffY = GRID_TOP;
}

// ===== Coordenadas =====
function getCanvasPos(evt) { return GU.pointerPos(canvas, evt); }

function cellAt(x, y) {
    const c = Math.floor((x - gridOffX) / cellSize);
    const r = Math.floor((y - gridOffY) / cellSize);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
    return { r, c };
}

// línea recta válida entre start y end (horizontal, vertical o diagonal exacta)
function lineCells(start, end) {
    if (!start || !end) return null;
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    if (dr === 0 && dc === 0) return [start];
    const adr = Math.abs(dr), adc = Math.abs(dc);
    let len;
    if (dr === 0) len = adc;
    else if (dc === 0) len = adr;
    else if (adr === adc) len = adr;
    else return null; // no es línea recta válida
    const sr = Math.sign(dr), sc = Math.sign(dc);
    const cells = [];
    for (let i = 0; i <= len; i++) {
        cells.push({ r: start.r + sr * i, c: start.c + sc * i });
    }
    return cells;
}

// ===== Validación de selección =====
function cellsToString(cells) {
    return cells.map(p => grid[p.r][p.c]).join('');
}

function checkSelection() {
    const cells = lineCells(dragStart, dragEnd);
    if (!cells || cells.length < 2) return;
    const str = cellsToString(cells);
    const rev = str.split('').reverse().join('');
    for (const sol of solutions) {
        if (sol.found) continue;
        if (sol.word === str || sol.word === rev) {
            sol.found = true;
            state.foundCount++;
            // puntos: base + bonus longitud
            state.score += 100 + sol.word.length * 10;
            spawnFound(sol);
            if (typeof GameAudio !== 'undefined') GameAudio.correct();
            updateWordList();
            updateHUD();
            if (state.foundCount >= solutions.length) {
                finishGame();
            }
            return;
        }
    }
    // no coincide: sonido leve
    if (typeof GameAudio !== 'undefined') GameAudio.type();
}

function spawnFound(sol) {
    for (const cell of sol.cells) {
        const cx = gridOffX + cell.c * cellSize + cellSize / 2;
        const cy = gridOffY + cell.r * cellSize + cellSize / 2;
        for (let i = 0; i < 4; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 2.5;
            /* life 0.5556s == the old `life: 1, decay: 0.03` at 60fps */
            particles.add(cx, cy, Math.cos(ang) * spd, Math.sin(ang) * spd, {
                life: 1 / (0.03 * 60),
                color: WORD_COLORS[sol.colorIdx % WORD_COLORS.length],
                size: 2 + Math.random() * 2,
                gravity: 0.05, shape: 'square'
            });
        }
    }
}

// ===== HUD / listas =====
function updateWordList() {
    const list = document.getElementById('wordList');
    if (!list) return;
    list.innerHTML = '';
    for (const sol of solutions) {
        const chip = document.createElement('span');
        chip.className = 'word-chip' + (sol.found ? ' found' : '');
        chip.textContent = sol.word;
        if (sol.found) chip.style.color = WORD_COLORS[sol.colorIdx % WORD_COLORS.length];
        list.appendChild(chip);
    }
}

function updateHUD() {
    const sc = document.getElementById('score');
    const fd = document.getElementById('found');
    const tm = document.getElementById('time');
    const hs = document.getElementById('highScore');
    if (sc) sc.textContent = state.score;
    if (fd) fd.textContent = state.foundCount + '/' + solutions.length;
    if (tm) tm.textContent = Math.floor(state.elapsed);
    if (hs) hs.textContent = state.highScore;
    const ms = document.getElementById('mobileScore');
    if (ms) ms.textContent = 'Puntos: ' + state.score + '  ·  ' + state.foundCount + '/' + solutions.length + '  ·  ' + Math.floor(state.elapsed) + 's';
}

// ===== Ciclo de juego =====
function startGame() {
    generateBoard();
    computeLayout();
    state.running = true;
    state.foundCount = 0;
    state.score = 0;
    state.startTime = performance.now();
    state.elapsed = 0;
    particles.clear();
    dragging = false; dragStart = null; dragEnd = null;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('gameOverPopup').style.display = 'none';
    updateWordList();
    updateHUD();
    if (typeof GameAudio !== 'undefined') GameAudio.start();
}

function finishGame() {
    state.running = false;
    // bonus por velocidad: cuanto menos tiempo, más bonus
    const t = state.elapsed;
    const timeBonus = Math.max(0, Math.floor(800 - t * 4));
    state.score += timeBonus;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        GameStore.set(HS_KEY, state.highScore);
    }
    updateHUD();
    if (typeof GameAudio !== 'undefined') GameAudio.win();
    const popup = document.getElementById('gameOverPopup');
    document.getElementById('popupTitle').textContent = '¡Completado!';
    document.getElementById('finalScore').textContent =
        'Puntos: ' + state.score + ' (bonus +' + timeBonus + ')';
    document.getElementById('finalBest').textContent =
        'Tiempo: ' + Math.floor(t) + 's  ·  Récord: ' + state.highScore;
    setTimeout(() => { popup.style.display = 'flex'; }, 700);
}

// ===== Render =====
function update(ts) {
    if (state.running) {
        state.elapsed = (ts - state.startTime) / 1000;
    }
    particles.update();
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();

    // fondo grilla
    const gw = cellSize * GRID;
    ctx.fillStyle = '#11203c';
    roundRectPath(ctx, gridOffX - 6, gridOffY - 6, gw + 12, gw + 12, 12);
    ctx.fill();

    // celdas halladas: pintar fondo de color
    for (const sol of solutions) {
        if (!sol.found) continue;
        const col = WORD_COLORS[sol.colorIdx % WORD_COLORS.length];
        ctx.fillStyle = hexAlpha(col, 0.22);
        for (const cell of sol.cells) {
            const x = gridOffX + cell.c * cellSize;
            const y = gridOffY + cell.r * cellSize;
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
    }

    // selección en vivo
    if (dragging) {
        const cells = lineCells(dragStart, dragEnd);
        if (cells) {
            ctx.fillStyle = 'rgba(143,211,244,0.35)';
            for (const cell of cells) {
                const x = gridOffX + cell.c * cellSize;
                const y = gridOffY + cell.r * cellSize;
                ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
            }
        } else if (dragStart) {
            // resalta solo el inicio si la línea no es válida
            const x = gridOffX + dragStart.c * cellSize;
            const y = gridOffY + dragStart.r * cellSize;
            ctx.fillStyle = 'rgba(255,81,47,0.3)';
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
    }

    // líneas de la cuadrícula
    ctx.strokeStyle = 'rgba(143,211,244,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
        const p = i * cellSize;
        ctx.moveTo(gridOffX + p, gridOffY);
        ctx.lineTo(gridOffX + p, gridOffY + gw);
        ctx.moveTo(gridOffX, gridOffY + p);
        ctx.lineTo(gridOffX + gw, gridOffY + p);
    }
    ctx.stroke();

    // letras
    ctx.font = 'bold ' + Math.floor(cellSize * 0.55) + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8f3fb';
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const x = gridOffX + c * cellSize + cellSize / 2;
            const y = gridOffY + r * cellSize + cellSize / 2;
            ctx.fillText(grid[r][c], x, y);
        }
    }

    // líneas trazadas sobre palabras halladas (estilo "círculo")
    ctx.lineWidth = Math.max(3, cellSize * 0.28);
    ctx.lineCap = 'round';
    for (const sol of solutions) {
        if (!sol.found) continue;
        const col = WORD_COLORS[sol.colorIdx % WORD_COLORS.length];
        const a = sol.cells[0];
        const b = sol.cells[sol.cells.length - 1];
        const ax = gridOffX + a.c * cellSize + cellSize / 2;
        const ay = gridOffY + a.r * cellSize + cellSize / 2;
        const bx = gridOffX + b.c * cellSize + cellSize / 2;
        const by = gridOffY + b.r * cellSize + cellSize / 2;
        ctx.strokeStyle = hexAlpha(col, 0.5);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }

    // título / contador superior dentro del canvas
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Sopa de Letras', GRID_PAD, 24);
    ctx.font = '15px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cfe6f5';
    ctx.fillText(state.foundCount + '/' + solutions.length + '  ·  ' + Math.floor(state.elapsed) + 's', CANVAS_W - GRID_PAD, 24);

    // mini-lista de palabras pendientes (dos filas) en la franja superior
    ctx.textAlign = 'left';
    ctx.font = '12px Arial, sans-serif';
    let lx = GRID_PAD, ly = 44;
    let col = 0;
    for (const sol of solutions) {
        const txt = sol.word;
        const w = ctx.measureText(txt).width;
        if (lx + w > CANVAS_W - GRID_PAD) {
            lx = GRID_PAD; ly += 18; col = 0;
        }
        if (sol.found) {
            ctx.fillStyle = hexAlpha(WORD_COLORS[sol.colorIdx % WORD_COLORS.length], 0.9);
            ctx.fillText(txt, lx, ly);
            // tachado
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + w, ly);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#9fb6c9';
            ctx.fillText(txt, lx, ly);
        }
        lx += w + 12;
        col++;
    }

    particles.draw(ctx);

    ctx.restore();
}

function roundRectPath(c, x, y, w, h, r) { GU.roundRectPath(c, x, y, w, h, r); }

function hexAlpha(hex, a) { return GU.rgba(hex, a); }

function loop(ts) {
    if (ts - lastFrameTs < 15) { requestAnimationFrame(loop); return; }
    lastFrameTs = ts;
    update(ts);
    draw();
    requestAnimationFrame(loop);
}

// ===== Input =====
function onDown(evt) {
    if (!state.running) return;
    evt.preventDefault();
    const pos = getCanvasPos(evt);
    const cell = cellAt(pos.x, pos.y);
    if (!cell) return;
    dragging = true;
    dragStart = cell;
    dragEnd = cell;
}

function onMove(evt) {
    if (!dragging) return;
    evt.preventDefault();
    const pos = getCanvasPos(evt);
    const cell = cellAt(pos.x, pos.y);
    if (cell) dragEnd = cell;
}

function onUp(evt) {
    if (!dragging) return;
    evt.preventDefault();
    checkSelection();
    dragging = false;
    dragStart = null;
    dragEnd = null;
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', onDown, { passive: false });
canvas.addEventListener('touchmove', onMove, { passive: false });
canvas.addEventListener('touchend', onUp, { passive: false });

// ===== Botones =====
var gameControls = GU.controls({ start: startGame });

// ===== Init =====
function init() {
    state.highScore = GameStore.getNum(HS_KEY, 0) || 0;
    generateBoard();
    computeLayout();
    updateWordList();
    updateHUD();
    requestAnimationFrame(loop);
}
init();

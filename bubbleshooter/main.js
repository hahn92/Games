'use strict';

// ─── Canvas & context ────────────────────────────────────────────────────────
const canvas = document.getElementById('bubbleCanvas');
const ctx    = canvas.getContext('2d');

const W = 400;
const H = 550;

// ─── Constants ───────────────────────────────────────────────────────────────
const R          = 20;        // bubble radius
const DIAM       = R * 2;
const COLS       = 10;
const GRID_TOP   = 30;        // y where first row starts (center of row 0)
const ROW_H      = R * Math.sqrt(3); // vertical spacing between row centers (~34.6)
const SHOOTER_Y  = H - 55;   // cannon center y
const SHOOTER_X  = W / 2;
const BUBBLE_SPD = 14;      // px per ~16ms frame
const POP_DURATION  = 220;   // ms for pop animation
const DROP_DURATION = 300;   // ms for drop animation

// Color palette  [dark, light]
const COLORS = [
    ['#e53935', '#ff5252'],   // 0 red
    ['#1e88e5', '#42a5f5'],   // 1 blue
    ['#43a047', '#66bb6a'],   // 2 green
    ['#fdd835', '#ffee58'],   // 3 yellow
    ['#8e24aa', '#ab47bc'],   // 4 purple
    ['#fb8c00', '#ffa726'],   // 5 orange
];

// ─── State ───────────────────────────────────────────────────────────────────
let grid        = [];       // grid[row][col] = colorIndex | null
let gridRows    = 0;
let parityBase  = 0;        // flips on addNewRow so existing rows keep their hex offset

let currentBubble = null;   // { x, y, vx, vy, color }
let currentColor  = 0;      // color loaded in the cannon
let nextColor     = 0;      // color shown in the NEXT preview

let shootAngle = -Math.PI / 2;  // radians, -π/2 = straight up
let canShoot   = true;

let score     = 0;
let highScore = GameStore.getNum('bubbleHighScore', 0);
let level     = 1;
let shots     = 0;          // shots fired this level cycle
let gameState = 'idle';     // 'idle' | 'playing' | 'over' | 'win'

let popParticles  = [];     // { x, y, color, r, alpha, vx, vy }
let dropBubbles   = [];     // { x, y, color, vy, alpha }

let lastTime = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Effective parity: addNewRow flips parityBase so visual offsets stay stable
function effParity(row) {
    return (row + parityBase) % 2;
}

function rowOffset(row) {
    // even-parity rows: leftmost bubble center at x = R
    // odd-parity rows: offset right by R (half DIAM), last col unused
    return (effParity(row) === 0) ? R : R + R;
}

function bubbleCenterX(row, col) {
    return rowOffset(row) + col * DIAM;
}

function bubbleCenterY(row) {
    return GRID_TOP + row * ROW_H;
}

// Return grid [row, col] nearest to canvas point (px, py), snapped to hex grid
function nearestCell(px, py) {
    let bestRow = Math.round((py - GRID_TOP) / ROW_H);
    bestRow = clamp(bestRow, 0, gridRows - 1);

    let offset = rowOffset(bestRow);
    let bestCol = Math.round((px - offset) / DIAM);
    bestCol = clamp(bestCol, 0, COLS - 1);
    return [bestRow, bestCol];
}

// Euclidean distance²
function dist2(ax, ay, bx, by) {
    let dx = ax - bx, dy = ay - by;
    return dx*dx + dy*dy;
}

function shadeColor(hex, f) { return GU.scaleColor(hex, f); }

function rgbaFromHex(hex, a) { return GU.rgba(hex, a); }

// Pre-rendered glossy bubble sprites (one offscreen canvas per color) —
// avoids creating a radial gradient per bubble per frame
const SPRITE_PAD = 3;
const bubbleSprites = [];
function buildBubbleSprites() {
    for (let i = 0; i < COLORS.length; i++) {
        const size = DIAM + SPRITE_PAD * 2;
        const oc = document.createElement('canvas');
        oc.width = size; oc.height = size;
        const o = oc.getContext('2d');
        const c = size / 2;
        const [dark, light] = COLORS[i];

        // Spherical body
        const g = o.createRadialGradient(c - R * 0.38, c - R * 0.42, R * 0.08, c, c, R);
        g.addColorStop(0, light);
        g.addColorStop(0.55, dark);
        g.addColorStop(1, shadeColor(dark, 0.55));
        o.fillStyle = g;
        o.beginPath(); o.arc(c, c, R - 1, 0, Math.PI * 2); o.fill();
        o.strokeStyle = 'rgba(255,255,255,0.25)';
        o.lineWidth = 1.2;
        o.stroke();

        // Bottom rim light (bounce light)
        o.strokeStyle = 'rgba(255,255,255,0.16)';
        o.lineWidth = 2;
        o.beginPath(); o.arc(c, c, R - 3.5, Math.PI * 0.18, Math.PI * 0.82); o.stroke();

        // Specular highlight + small glint
        o.fillStyle = 'rgba(255,255,255,0.8)';
        o.beginPath();
        o.ellipse(c - R * 0.36, c - R * 0.44, R * 0.28, R * 0.16, -Math.PI / 4, 0, Math.PI * 2);
        o.fill();
        o.fillStyle = 'rgba(255,255,255,0.5)';
        o.beginPath(); o.arc(c + R * 0.28, c - R * 0.5, R * 0.08, 0, Math.PI * 2); o.fill();

        bubbleSprites[i] = oc;
    }
}
buildBubbleSprites();

// Random integer [lo, hi]
function rndInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

// Pick a random color from those currently in the grid (or first `count` colors)
function randomColorFromGrid() {
    const present = new Set();
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== null) present.add(grid[r][c]);
        }
    }
    if (present.size === 0) {
        const maxColor = Math.min(level + 1, COLORS.length - 1);
        return rndInt(0, maxColor);
    }
    const arr = [...present];
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Grid management ─────────────────────────────────────────────────────────
function initGrid() {
    grid    = [];
    gridRows = 8;
    parityBase = 0;
    const maxColor = Math.min(level + 1, COLORS.length - 1);
    for (let r = 0; r < gridRows; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) {
            // Odd-parity rows have one fewer bubble for the hex offset; leave last col null
            if (effParity(r) === 1 && c === COLS - 1) {
                grid[r][c] = null;
            } else {
                grid[r][c] = rndInt(0, maxColor);
            }
        }
    }
}

function addNewRow() {
    // Shift all rows down by inserting a new row at top.
    // Flipping parityBase keeps every existing row at its same visual offset
    // (otherwise all bubbles would jump sideways and even rows would overflow the canvas).
    const maxColor = Math.min(level + 1, COLORS.length - 1);
    parityBase = 1 - parityBase;
    const newRow = [];
    for (let c = 0; c < COLS; c++) {
        newRow[c] = (effParity(0) === 1 && c === COLS - 1) ? null : rndInt(0, maxColor);
    }
    grid.unshift(newRow);
    gridRows++;
}

function ensureGridRow(r) {
    while (grid.length <= r) {
        grid.push(new Array(COLS).fill(null));
        gridRows = grid.length;
    }
}

// BFS: find all connected same-color cells starting from [row,col]
function floodFind(startR, startC, color) {
    const visited = new Set();
    const queue   = [[startR, startC]];
    const result  = [];
    visited.add(startR + ',' + startC);

    while (queue.length) {
        const [r, c] = queue.shift();
        if (r < 0 || r >= gridRows || c < 0 || c >= COLS) continue;
        if (grid[r][c] !== color) continue;
        result.push([r, c]);
        for (const [nr, nc] of getNeighbors(r, c)) {
            const key = nr + ',' + nc;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push([nr, nc]);
            }
        }
    }
    return result;
}

// BFS: find all bubbles connected (directly or indirectly) to the top row
function findConnectedToTop() {
    const connected = new Set();
    const queue = [];

    // Seed from all filled cells in row 0
    for (let c = 0; c < COLS; c++) {
        if (grid[0] && grid[0][c] !== null) {
            const key = '0,' + c;
            if (!connected.has(key)) {
                connected.add(key);
                queue.push([0, c]);
            }
        }
    }

    while (queue.length) {
        const [r, c] = queue.shift();
        for (const [nr, nc] of getNeighbors(r, c)) {
            const key = nr + ',' + nc;
            if (!connected.has(key) && nr >= 0 && nr < gridRows && nc >= 0 && nc < COLS && grid[nr] && grid[nr][nc] !== null) {
                connected.add(key);
                queue.push([nr, nc]);
            }
        }
    }
    return connected;
}

// Hex grid neighbors (6 directions, accounting for row offset)
function getNeighbors(r, c) {
    const isEven = (effParity(r) === 0);
    // Horizontal neighbors
    const neighbors = [
        [r,   c - 1],
        [r,   c + 1],
        // Upper row
        [r - 1, isEven ? c - 1 : c],
        [r - 1, isEven ? c     : c + 1],
        // Lower row
        [r + 1, isEven ? c - 1 : c],
        [r + 1, isEven ? c     : c + 1],
    ];
    return neighbors;
}

// ─── Shooting ────────────────────────────────────────────────────────────────
function fireCurrentBubble() {
    if (!canShoot || gameState !== 'playing') return;

    // Don't allow shooting straight down
    if (shootAngle > -0.15 && shootAngle < Math.PI + 0.15) {
        if (shootAngle >= 0 && shootAngle <= Math.PI) return;
    }
    // Clamp angle so shooter can't fire downward
    const clampedAngle = clamp(shootAngle, -Math.PI + 0.1, -0.1);

    const vx = Math.cos(clampedAngle) * BUBBLE_SPD;
    const vy = Math.sin(clampedAngle) * BUBBLE_SPD;

    currentBubble = {
        x: SHOOTER_X,
        y: SHOOTER_Y,
        vx,
        vy,
        color: currentColor,
        bounced: false,
    };

    // The preview bubble moves into the cannon; a new one is drawn for the preview
    currentColor = nextColor;
    nextColor    = randomColorFromGrid();
    canShoot  = false;
    shots++;

    GameAudio.shoot();

    updateUI();
}

// ─── Bubble movement & collision ─────────────────────────────────────────────
function moveBubble(dt) {
    if (!currentBubble) return;

    const b = currentBubble;
    // Distance this frame (BUBBLE_SPD px per ~16ms), split into short substeps
    // so the bubble can't tunnel through grid bubbles
    let remaining = (BUBBLE_SPD * Math.min(dt, 50)) / 16;

    while (remaining > 0) {
        const step = Math.min(6, remaining);
        remaining -= step;
        b.x += (b.vx / BUBBLE_SPD) * step;
        b.y += (b.vy / BUBBLE_SPD) * step;

        // Wall bounces (left / right)
        if (b.x - R < 0) {
            b.x  = R;
            b.vx = Math.abs(b.vx);
            b.bounced = true;
        } else if (b.x + R > W) {
            b.x  = W - R;
            b.vx = -Math.abs(b.vx);
            b.bounced = true;
        }

        // Ceiling: snap to top row
        if (b.y - R <= GRID_TOP) {
            landBubble(b, 0);
            return;
        }

        // Check collision with grid bubbles
        const hitRow = checkGridCollision(b);
        if (hitRow !== null) {
            landBubble(b, hitRow);
            return;
        }

        // Bubble fell below canvas (safety)
        if (b.y > H + R * 2) {
            currentBubble = null;
            canShoot      = true;
            return;
        }
    }
}

function checkGridCollision(b) {
    // Check a band of rows the bubble could possibly be near
    const approxRow = Math.round((b.y - GRID_TOP) / ROW_H);
    const rowStart  = Math.max(0, approxRow - 2);
    const rowEnd    = Math.min(gridRows - 1, approxRow + 2);

    for (let r = rowStart; r <= rowEnd; r++) {
        if (!grid[r]) continue;
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === null) continue;
            const cx = bubbleCenterX(r, c);
            const cy = bubbleCenterY(r);
            if (dist2(b.x, b.y, cx, cy) < (DIAM - 2) * (DIAM - 2)) {
                return r;
            }
        }
    }
    return null;
}

function landBubble(b, nearRow) {
    // Find the best empty cell near the landing position
    const [row, col] = findBestCell(b.x, b.y, nearRow);

    ensureGridRow(row);

    // Place bubble in grid
    grid[row][col] = b.color;
    currentBubble  = null;

    GameAudio.hit();

    // Check for 3+ match
    const matched = floodFind(row, col, b.color);
    if (matched.length >= 3) {
        popBubbles(matched);
    } else {
        // No pop – check if rows reached danger zone
        checkGameOver();
        canShoot = true;
        checkNewRow();
    }
}

function findBestCell(px, py, nearRow) {
    // Search nearby rows and columns for the closest empty slot
    const candidates = [];
    const rowStart = Math.max(0, nearRow - 1);
    const rowEnd   = Math.min(nearRow + 1, gridRows);

    for (let r = rowStart; r <= rowEnd; r++) {
        ensureGridRow(r);
        for (let c = 0; c < COLS; c++) {
            // Skip last col for odd-parity rows (hex offset layout)
            if (effParity(r) === 1 && c === COLS - 1) continue;
            if (grid[r] && grid[r][c] !== null) continue;
            const cx = bubbleCenterX(r, c);
            const cy = bubbleCenterY(r);
            candidates.push({ r, c, d: dist2(px, py, cx, cy) });
        }
    }

    if (candidates.length === 0) {
        // Fallback: try the exact row
        const r = Math.max(0, nearRow);
        ensureGridRow(r);
        const offset = rowOffset(r);
        let bestC = Math.round((px - offset) / DIAM);
        bestC = clamp(bestC, 0, COLS - 1);
        return [r, bestC];
    }

    candidates.sort((a, b2) => a.d - b2.d);
    return [candidates[0].r, candidates[0].c];
}

// ─── Pop & drop ──────────────────────────────────────────────────────────────
function popBubbles(cells) {
    const now = performance.now();

    let combo = cells.length > 3 ? Math.floor(cells.length / 3) : 1;

    // Spawn pop particles
    for (const [r, c] of cells) {
        const cx = bubbleCenterX(r, c);
        const cy = bubbleCenterY(r);
        spawnPopParticles(cx, cy, grid[r][c]);
        grid[r][c] = null;
    }

    score += cells.length * 10 * combo;

    GameAudio.score();
    if (cells.length >= 6) GameAudio.scoreHigh();

    // Find and drop orphaned bubbles
    const connected = findConnectedToTop();
    const dropping  = [];

    for (let r = 0; r < gridRows; r++) {
        if (!grid[r]) continue;
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== null && !connected.has(r + ',' + c)) {
                dropping.push([r, c, grid[r][c]]);
                grid[r][c] = null;
            }
        }
    }

    if (dropping.length > 0) {
        for (const [r, c, color] of dropping) {
            dropBubbles.push({
                x: bubbleCenterX(r, c),
                y: bubbleCenterY(r),
                color,
                vy: 1 + Math.random() * 2,
                alpha: 1,
            });
        }
        score += dropping.length * 20 * combo;
        GameAudio.scoreHigh();
    }

    // Trim fully empty trailing rows
    trimEmptyRows();
    updateUI();

    // Check win (grid cleared)
    if (isGridEmpty()) {
        setTimeout(() => triggerWin(), 300);
        return;
    }

    // Re-enable shooting after brief delay
    setTimeout(() => {
        checkGameOver();
        canShoot = true;
        checkNewRow();
    }, 250);
}

function trimEmptyRows() {
    while (gridRows > 0) {
        const lastRow = grid[gridRows - 1];
        if (!lastRow || lastRow.every(v => v === null)) {
            grid.pop();
            gridRows--;
        } else {
            break;
        }
    }
}

function isGridEmpty() {
    for (let r = 0; r < gridRows; r++) {
        if (grid[r] && grid[r].some(v => v !== null)) return false;
    }
    return true;
}

function spawnPopParticles(cx, cy, color) {
    const [dark] = COLORS[color];
    // Pre-compute random values on spawn, never in render
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2;
        popParticles.push({
            x: cx, y: cy,
            color: dark,
            r: R * 0.4,
            alpha: 1,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            spawnTime: performance.now(),
        });
    }
}

// ─── Row progression ─────────────────────────────────────────────────────────
function checkNewRow() {
    if (shots > 0 && shots % 8 === 0) {
        addNewRow();
        checkGameOver();
    }
}

function checkGameOver() {
    // If any bubble in the last row is below the danger line
    for (let r = 0; r < gridRows; r++) {
        if (!grid[r]) continue;
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== null) {
                const cy = bubbleCenterY(r);
                if (cy + R >= SHOOTER_Y - R * 2) {
                    triggerGameOver();
                    return;
                }
            }
        }
    }

    // Also check level up
    if (score >= level * 350) {
        level++;
        updateUI();
        // Optionally add a dense row on level up
        addNewRow();
    }
}

function triggerGameOver() {
    if (gameState === 'over') return;
    gameState = 'over';
    canShoot  = false;
    GameAudio.gameOver();
    if (score > highScore) {
        highScore = score;
        GameStore.set('bubbleHighScore', highScore);
    }

    setTimeout(() => {
        document.getElementById('popupTitle').textContent  = '¡Juego terminado!';
        document.getElementById('finalScore').textContent  = 'Puntaje: ' + score;
        document.getElementById('finalLevel').textContent  = 'Nivel: ' + level;
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 400);
}

function triggerWin() {
    if (gameState === 'win' || gameState === 'over') return;
    gameState = 'win';
    canShoot  = false;
    GameAudio.win();
    if (score > highScore) {
        highScore = score;
        GameStore.set('bubbleHighScore', highScore);
    }

    setTimeout(() => {
        document.getElementById('popupTitle').textContent  = '¡Tablero despejado!';
        document.getElementById('finalScore').textContent  = 'Puntaje: ' + score;
        document.getElementById('finalLevel').textContent  = 'Nivel: ' + level;
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 400);
}

// ─── Aiming ──────────────────────────────────────────────────────────────────
function getCanvasPoint(e) { return GU.pointerPos(canvas, e); }

function updateAngle(px, py) {
    const dx = px - SHOOTER_X;
    const dy = py - SHOOTER_Y;
    let angle = Math.atan2(dy, dx);
    // Clamp to upper half (can't shoot downward)
    angle = clamp(angle, -Math.PI + 0.1, -0.1);
    shootAngle = angle;
}

// ─── Aim trajectory ──────────────────────────────────────────────────────────
function computeAimPath() {
    const points = [{ x: SHOOTER_X, y: SHOOTER_Y }];
    let x  = SHOOTER_X;
    let y  = SHOOTER_Y;
    let vx = Math.cos(shootAngle) * 8;
    let vy = Math.sin(shootAngle) * 8;
    let ghost = null;

    // Simulate up to 200 steps
    for (let i = 0; i < 200; i++) {
        x += vx;
        y += vy;

        if (x - R < 0) {
            x  = R;
            vx = Math.abs(vx);
        } else if (x + R > W) {
            x  = W - R;
            vx = -Math.abs(vx);
        }

        if ((i % 5) === 0) points.push({ x, y });

        // Stop at ceiling
        if (y - R <= GRID_TOP) {
            points.push({ x, y: GRID_TOP + R });
            ghost = findBestCell(x, GRID_TOP + R, 0);
            break;
        }

        // Stop when colliding with grid
        let hit = false;
        const approxRow = Math.round((y - GRID_TOP) / ROW_H);
        const rStart    = Math.max(0, approxRow - 1);
        const rEnd      = Math.min(gridRows - 1, approxRow + 1);
        for (let r = rStart; r <= rEnd; r++) {
            if (!grid[r]) continue;
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === null) continue;
                const cx = bubbleCenterX(r, c);
                const cy = bubbleCenterY(r);
                if (dist2(x, y, cx, cy) < (DIAM - 2) * (DIAM - 2)) {
                    hit = true;
                    break;
                }
            }
            if (hit) break;
        }
        if (hit) {
            points.push({ x, y });
            ghost = findBestCell(x, y, Math.max(0, approxRow));
            break;
        }
    }
    return { points, ghost };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawBubble(cx, cy, colorIdx, alpha) {
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(bubbleSprites[colorIdx], cx - R - SPRITE_PAD, cy - R - SPRITE_PAD);
    if (alpha !== undefined) ctx.globalAlpha = 1;
}

function drawGrid() {
    for (let r = 0; r < gridRows; r++) {
        if (!grid[r]) continue;
        for (let c = 0; c < COLS; c++) {
            const color = grid[r][c];
            if (color === null) continue;
            drawBubble(bubbleCenterX(r, c), bubbleCenterY(r), color);
        }
    }
}

// Cannon gradients are in local (translated) coords, so they can be cached
let barrelGrad = null;
let baseGrad   = null;

function drawShooter() {
    const cx = SHOOTER_X;
    const cy = SHOOTER_Y;

    // Barrel / cannon body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shootAngle + Math.PI / 2); // rotate so 0 = up

    const barrelLen = 36;
    const barrelW   = 14;

    if (!barrelGrad) {
        barrelGrad = ctx.createLinearGradient(-barrelW / 2, 0, barrelW / 2, 0);
        barrelGrad.addColorStop(0,   '#888');
        barrelGrad.addColorStop(0.4, '#ddd');
        barrelGrad.addColorStop(1,   '#666');
        baseGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
        baseGrad.addColorStop(0, '#ccc');
        baseGrad.addColorStop(1, '#555');
    }

    ctx.fillStyle   = barrelGrad;
    ctx.strokeStyle = '#444';
    ctx.lineWidth   = 1.5;

    // Rounded rect for barrel
    ctx.beginPath();
    ctx.roundRect(-barrelW / 2, -barrelLen, barrelW, barrelLen, 4);
    ctx.fill();
    ctx.stroke();

    // Muzzle band
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.roundRect(-barrelW / 2 - 2, -barrelLen, barrelW + 4, 6, 2);
    ctx.fill();

    // Base circle
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.restore();

    // Loaded bubble ON TOP of the cannon so its color is always visible
    if (gameState === 'playing' && canShoot) {
        ctx.strokeStyle = rgbaFromHex(COLORS[currentColor][1], 0.45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
        ctx.stroke();
        drawBubble(cx, cy, currentColor);
    }
}

function drawNextPreview() {
    if (gameState !== 'playing') return;
    const px = 35;
    const py = SHOOTER_Y;
    ctx.fillStyle   = 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(px, py, R + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawBubble(px, py, nextColor);
    ctx.font        = '10px Arial';
    ctx.fillStyle   = 'rgba(255,255,255,0.6)';
    ctx.textAlign   = 'center';
    ctx.fillText('SIGUIENTE', px, py + R + 13);
}

function drawAimLine() {
    if (!canShoot || gameState !== 'playing') return;
    const { points: pts, ghost } = computeAimPath();
    if (pts.length < 2) return;

    const [dark, light] = COLORS[currentColor];

    ctx.setLineDash([6, 8]);
    ctx.lineWidth   = 2;
    ctx.strokeStyle = rgbaFromHex(light, 0.45);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost: where the bubble will snap into the grid
    if (ghost) {
        const gx = bubbleCenterX(ghost[0], ghost[1]);
        const gy = bubbleCenterY(ghost[0]);
        ctx.fillStyle = rgbaFromHex(dark, 0.22);
        ctx.beginPath();
        ctx.arc(gx, gy, R - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = rgbaFromHex(light, 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawDangerLine(now) {
    const dangerY = SHOOTER_Y - R * 2;
    const pulse = 0.35 + 0.18 * Math.sin((now || 0) * 0.004);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,80,80,' + pulse.toFixed(2) + ')';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(W, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawPopParticles(now) {
    for (const p of popParticles) {
        const age = now - p.spawnTime;
        p.alpha = Math.max(0, 1 - age / POP_DURATION);
        if (p.alpha <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Clean up dead particles
    popParticles = popParticles.filter(p => p.alpha > 0);
}

function drawDropBubbles() {
    for (const db of dropBubbles) {
        db.y     += db.vy;
        db.vy    += 0.25;        // gravity
        db.alpha -= 0.025;
        if (db.alpha <= 0 || db.y > H + R) continue;
        drawBubble(db.x, db.y, db.color, db.alpha);
    }
    dropBubbles = dropBubbles.filter(db => db.alpha > 0 && db.y <= H + R);
}

function drawCurrentBubble() {
    if (!currentBubble) return;
    drawBubble(currentBubble.x, currentBubble.y, currentBubble.color);
}

// Background: cached gradient + precomputed twinkling stars + ceiling bar
let bgGrad = null;
let ceilGrad = null;
let stars = null;

function buildStars() {
    stars = [];
    for (let i = 0; i < 55; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            s: Math.random() < 0.25 ? 2 : 1,
            a: 0.2 + Math.random() * 0.45,
            ph: Math.random() * Math.PI * 2,
        });
    }
}
buildStars();

function drawBackground(now) {
    if (!bgGrad) {
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0d1b3e');
        bgGrad.addColorStop(1, '#1a2c5a');
        ceilGrad = ctx.createLinearGradient(0, 0, 0, 12);
        ceilGrad.addColorStop(0, '#3a4d7a');
        ceilGrad.addColorStop(1, '#22335c');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars (precomputed positions; fillRect is cheap)
    const t = (now || 0) * 0.0015;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        ctx.globalAlpha = st.a * (0.6 + 0.4 * Math.sin(t + st.ph));
        ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // Ceiling bar the bubbles hang from
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 10; x < W; x += 25) ctx.fillRect(x, 4, 4, 4);
}

function drawIdleScreen(now) {
    drawBackground(now);
    ctx.font      = 'bold 32px Arial';
    ctx.fillStyle = '#8fd3f4';
    ctx.textAlign = 'center';
    ctx.fillText('BUBBLE SHOOTER', W / 2, H / 2 - 30);
    ctx.font      = '18px Arial';
    ctx.fillStyle = '#ffe082';
    ctx.fillText('Haz clic en Iniciar', W / 2, H / 2 + 20);
}

function drawHUD() {
    if (gameState !== 'playing') return;
    ctx.font        = 'bold 14px Arial';
    ctx.fillStyle   = 'rgba(255,255,255,0.7)';
    ctx.textAlign   = 'left';
    ctx.fillText('Nivel ' + level, 8, H - 10);
    ctx.textAlign   = 'right';
    ctx.fillText('Puntos: ' + score, W - 8, H - 10);
}

// ─── Main loop ───────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const dt = timestamp - lastTime;
    if (dt < 14) return;
    lastTime = timestamp;

    if (gameState === 'idle') {
        drawIdleScreen(timestamp);
        return;
    }

    if (gameState === 'over' || gameState === 'win') {
        // Keep drawing frozen state
        draw(timestamp);
        return;
    }

    if (gameState === 'playing') {
        moveBubble(dt);
        draw(timestamp);
    }
}

function draw(now) {
    drawBackground(now);
    drawDangerLine(now);
    drawGrid();
    drawAimLine();
    drawCurrentBubble();
    drawDropBubbles();
    drawPopParticles(now);
    drawShooter();
    drawNextPreview();
    drawHUD();
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function updateUI() {
    document.getElementById('score').textContent     = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('level').textContent     = level;
    document.getElementById('shots').textContent     = shots;

    const mobileScore = document.getElementById('mobileScore');
    if (mobileScore) {
        mobileScore.textContent = 'Puntos: ' + score + '  |  Nivel: ' + level;
    }
}

// ─── Game init ───────────────────────────────────────────────────────────────
function startGame() {
    score     = 0;
    level     = 1;
    shots     = 0;
    canShoot  = true;
    popParticles = [];
    dropBubbles  = [];
    currentBubble = null;

    initGrid();
    currentColor = randomColorFromGrid();
    nextColor    = randomColorFromGrid();
    gameState = 'playing';

    gameControls.running();
    document.getElementById('gameOverPopup').style.display = 'none';

    GameAudio.start();
    updateUI();
}

function restartGame() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
}

// ─── Input handlers ──────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'playing') return;
    const pt = getCanvasPoint(e);
    updateAngle(pt.x, pt.y);
});

canvas.addEventListener('click', (e) => {
    if (gameState !== 'playing') return;
    const pt = getCanvasPoint(e);
    updateAngle(pt.x, pt.y);
    fireCurrentBubble();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    // Aim at the tap point so a quick tap (without moving) shoots there
    const pt = getCanvasPoint(e);
    updateAngle(pt.x, pt.y);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const pt = getCanvasPoint(e);
    updateAngle(pt.x, pt.y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    fireCurrentBubble();
}, { passive: false });

var gameControls = GU.controls({ start: startGame, restart: restartGame });

// ─── Boot ────────────────────────────────────────────────────────────────────
updateUI();
requestAnimationFrame(gameLoop);

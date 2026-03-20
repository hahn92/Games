// Frogger
var canvas = document.getElementById('froggerCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 480

var COLS = 10, ROWS = 12;
var CELL = W / COLS; // 40

var score, highScore, lives, isPlaying, animFrameId;
highScore = parseInt(localStorage.getItem('froggerHigh') || '0', 10);

// Frog
var frog = { col: 5, row: 11 };

// Lane definitions (row 0 = top = goal)
// Rows 1-4: river (logs)
// Row 5: safe median
// Rows 6-10: road (cars)
// Row 11: safe start

var LANE_TYPES = [
    'goal',   // 0
    'river',  // 1
    'river',  // 2
    'river',  // 3
    'river',  // 4
    'safe',   // 5 - median
    'road',   // 6
    'road',   // 7
    'road',   // 8
    'road',   // 9
    'road',   // 10
    'safe',   // 11 - start
];

var GOAL_SLOTS = [1, 3, 5, 7, 9]; // columns where lilypads are
var filledGoals = [];

var lanes; // array of lane objects with obstacles

function initLanes() {
    lanes = [
        null, // row 0 goal
        // River lanes
        { dir: 1,  speed: 1.2, objects: makeObjects(1, 3, 90, 28) },
        { dir: -1, speed: 1.5, objects: makeObjects(2, 3, 100, 28) },
        { dir: 1,  speed: 1.0, objects: makeObjects(3, 2, 120, 36) },
        { dir: -1, speed: 1.8, objects: makeObjects(4, 3, 80, 28) },
        null, // row 5 median
        // Road lanes
        { dir: -1, speed: 2.2, objects: makeCars(6, 3, '#ef5350') },
        { dir: 1,  speed: 1.8, objects: makeCars(7, 4, '#ff9800') },
        { dir: -1, speed: 2.5, objects: makeCars(8, 3, '#ce93d8') },
        { dir: 1,  speed: 1.5, objects: makeCars(9, 3, '#80cbc4') },
        { dir: -1, speed: 3.0, objects: makeCars(10, 4, '#fff176') },
        null, // row 11 start
    ];
}

function makeObjects(row, count, gap, w) {
    var objs = [];
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * (W / count + gap), w: w, h: CELL - 4 });
    }
    return objs;
}

function makeCars(row, count, color) {
    var objs = [];
    var spacing = W / count;
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * spacing, w: CELL * 1.4, h: CELL - 8, color: color });
    }
    return objs;
}

function updateLanes() {
    for (var r = 1; r <= 10; r++) {
        if (!lanes[r]) continue;
        var lane = lanes[r];
        var objs = lane.objects;
        for (var i = 0; i < objs.length; i++) {
            objs[i].x += lane.speed * lane.dir;
            if (lane.dir > 0 && objs[i].x > W) objs[i].x = -objs[i].w;
            if (lane.dir < 0 && objs[i].x + objs[i].w < 0) objs[i].x = W;
        }
        // If frog is on this row and it's river, move frog with log
        if (r >= 1 && r <= 4 && frog.row === r) {
            // continuous movement below
        }
    }
}

// Pixel position of frog (smoothly moves between cells)
var frogPx = { x: 0, y: 0 };
var frogRidingOffset = 0; // horizontal offset when riding a log

function getFrogPixel() {
    return {
        x: (frog.col - 0.5) * CELL,
        y: frog.row * CELL + 4
    };
}

function drawBackground() {
    // Goal row
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(0, 0, W, CELL);
    // Lily pad slots
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gx = (GOAL_SLOTS[i] - 1) * CELL;
        ctx.fillStyle = filledGoals.indexOf(GOAL_SLOTS[i]) >= 0 ? '#2e7d32' : '#0d47a1';
        ctx.beginPath();
        ctx.ellipse(gx + CELL/2, CELL/2, CELL/2 - 4, CELL/2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        if (filledGoals.indexOf(GOAL_SLOTS[i]) >= 0) {
            ctx.font = (CELL * 0.6) + 'px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐸', gx + CELL/2, CELL/2);
        }
    }

    // River rows 1-4
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(0, CELL, W, CELL * 4);

    // Median row 5
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, CELL * 5, W, CELL);

    // Road rows 6-10
    ctx.fillStyle = '#424242';
    ctx.fillRect(0, CELL * 6, W, CELL * 5);
    // Lane lines
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 12]);
    for (var r = 7; r <= 10; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Start row 11
    ctx.fillStyle = '#33691e';
    ctx.fillRect(0, CELL * 11, W, CELL);
}

function drawLogs() {
    for (var r = 1; r <= 4; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 2;
            ctx.fillStyle = '#795548';
            ctx.beginPath();
            ctx.roundRect(o.x, oy, o.w, o.h, 4);
            ctx.fill();
            ctx.fillStyle = '#a1887f';
            ctx.fillRect(o.x + 4, oy + 4, 8, o.h - 8);
            ctx.fillRect(o.x + o.w - 12, oy + 4, 8, o.h - 8);
        }
    }
}

function drawCars() {
    for (var r = 6; r <= 10; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 4;
            ctx.fillStyle = o.color;
            ctx.beginPath();
            ctx.roundRect(o.x, oy, o.w, o.h, 4);
            ctx.fill();
            // Headlights
            ctx.fillStyle = '#fff9c4';
            if (lane.dir > 0) {
                ctx.fillRect(o.x + o.w - 4, oy + 3, 4, 5);
                ctx.fillRect(o.x + o.w - 4, oy + o.h - 8, 4, 5);
            } else {
                ctx.fillRect(o.x, oy + 3, 4, 5);
                ctx.fillRect(o.x, oy + o.h - 8, 4, 5);
            }
        }
    }
}

var frogRidingX = null; // world x position while on log

function drawFrog() {
    var fy = frog.row * CELL;
    var fx;
    if (frog.row >= 1 && frog.row <= 4 && frogRidingX !== null) {
        fx = frogRidingX - CELL / 2;
    } else {
        fx = (frog.col - 1) * CELL;
    }
    ctx.font = (CELL * 0.75) + 'px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('🐸', fx + 2, fy + 2);
}

function getFrogOnLog() {
    if (frog.row < 1 || frog.row > 4) return null;
    var lane = lanes[frog.row];
    if (!lane) return null;
    var fx, fy = frog.row * CELL + 4;
    if (frogRidingX !== null) fx = frogRidingX - 2;
    else fx = (frog.col - 1) * CELL + 2;
    for (var i = 0; i < lane.objects.length; i++) {
        var o = lane.objects[i];
        if (fx < o.x + o.w && fx + CELL - 4 > o.x) return { log: o, lane: lane };
    }
    return null;
}

function checkDeath() {
    if (frog.row >= 1 && frog.row <= 4) {
        var riding = getFrogOnLog();
        if (!riding) return 'river';
        // Check frog didn't drift off-screen
        if (frogRidingX < 0 || frogRidingX > W) return 'river';
    }
    if (frog.row >= 6 && frog.row <= 10) {
        var lane = lanes[frog.row];
        if (!lane) return null;
        var fx = (frog.col - 1) * CELL + 4;
        var fy = frog.row * CELL + 4;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            if (fx < o.x + o.w - 2 && fx + CELL - 8 > o.x + 2) return 'car';
        }
    }
    return null;
}

function die() {
    lives--;
    updateHUD();
    if (lives <= 0) { gameOver(); return; }
    frog.col = 5; frog.row = 11; frogRidingX = null;
}

function checkGoal() {
    if (frog.row !== 0) return false;
    // Find nearest goal slot
    var fx = frogRidingX !== null ? frogRidingX : (frog.col - 0.5) * CELL;
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gs = GOAL_SLOTS[i];
        var gx = (gs - 1) * CELL + CELL / 2;
        if (Math.abs(fx - gx) < CELL * 0.7 && filledGoals.indexOf(gs) < 0) {
            filledGoals.push(gs);
            score += 50;
            updateHUD();
            frog.col = 5; frog.row = 11; frogRidingX = null;
            if (filledGoals.length >= GOAL_SLOTS.length) {
                score += 200;
                updateHUD();
                // Next wave
                filledGoals = [];
                speedUpLanes();
            }
            return true;
        }
    }
    return false;
}

function speedUpLanes() {
    for (var r = 1; r <= 10; r++) {
        if (lanes[r]) lanes[r].speed *= 1.15;
    }
}

var frame = 0;

function gameLoop() {
    if (!isPlaying) return;
    frame++;

    updateLanes();

    // Move frog with log
    if (frog.row >= 1 && frog.row <= 4) {
        var lane = lanes[frog.row];
        if (lane) {
            if (frogRidingX === null) frogRidingX = (frog.col - 0.5) * CELL;
            frogRidingX += lane.speed * lane.dir;
        }
    }

    // Check death
    var cause = checkDeath();
    if (cause) { die(); }

    // Check goal
    if (frog.row === 0) checkGoal();

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawLogs();
    drawCars();
    drawFrog();

    animFrameId = requestAnimationFrame(gameLoop);
}

function moveFrog(dr, dc) {
    if (!isPlaying) return;
    var nr = frog.row + dr;
    var nc = frog.col + dc;
    if (nr < 0 || nr > 11 || nc < 1 || nc > COLS) return;
    frog.row = nr;
    frog.col = nc;
    if (nr >= 1 && nr <= 4) {
        // Update ridingX to center of new col
        frogRidingX = (nc - 0.5) * CELL;
    } else {
        frogRidingX = null;
    }
    if (nr > 0) score += 1;
    updateHUD();
}

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('froggerHigh', highScore); }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' V:' + lives;
}

function startGame() {
    frog.col = 5; frog.row = 11; frogRidingX = null;
    score = 0; lives = 3; frame = 0;
    filledGoals = [];
    isPlaying = true;
    initLanes();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animFrameId);
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// Keyboard
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); moveFrog(-1, 0); }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); moveFrog(1, 0); }
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); moveFrog(0, -1); }
    if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); moveFrog(0, 1); }
});

// Touch controls
function addTap(id, dr, dc) {
    var btn = document.getElementById(id);
    btn.addEventListener('click', function() { moveFrog(dr, dc); });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(dr, dc); }, { passive: false });
}
addTap('btnUp', -1, 0);
addTap('btnDown', 1, 0);
addTap('btnLeft', 0, -1);
addTap('btnRight', 0, 1);

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
initLanes();
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

// Atrapa Frutas
var canvas = document.getElementById('catcherCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 500

var BASKET_W = 80, BASKET_H = 30;
var BASKET_SPEED = 7;
var keys = {};

// Fruit kinds: 0-9 fruits, 10 bomb
var FRUIT_COUNT = 10;
var basket, items, score, highScore, lives, isPlaying, animFrameId, frame, spawnRate;
highScore = parseInt(localStorage.getItem('catcherHigh') || '0', 10);

// ─── DRAW INDIVIDUAL FRUIT ─────────────────────────────────
function drawFruit(kind, cx, cy, r, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);

    switch (kind) {

    case 0: // Apple
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(0, 2, r, 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.ellipse(-r*0.3, -r*0.2, r*0.35, r*0.25, -0.5, 0, Math.PI*2); ctx.fill();
        // Stem
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(2, -r-7); ctx.stroke();
        // Leaf
        ctx.fillStyle = '#43a047';
        ctx.beginPath(); ctx.ellipse(5, -r-5, 5, 3, 0.5, 0, Math.PI*2); ctx.fill();
        break;

    case 1: // Orange
        ctx.fillStyle = '#fb8c00';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-r*0.3, -r*0.25, r*0.3, r*0.22, -0.4, 0, Math.PI*2); ctx.fill();
        // Navel
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, r*0.5, r*0.15, 0, Math.PI*2); ctx.stroke();
        // Leaf stub
        ctx.fillStyle = '#388e3c';
        ctx.beginPath(); ctx.ellipse(0, -r-2, 3, 5, 0, 0, Math.PI*2); ctx.fill();
        break;

    case 2: // Lemon
        ctx.fillStyle = '#fdd835';
        ctx.beginPath(); ctx.ellipse(0, 0, r*1.2, r*0.85, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-r*0.25, -r*0.2, r*0.35, r*0.2, -0.3, 0, Math.PI*2); ctx.fill();
        // Tips
        ctx.fillStyle = '#f9a825';
        ctx.beginPath(); ctx.ellipse(-r*1.1, 0, r*0.15, r*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( r*1.1, 0, r*0.15, r*0.18, 0, 0, Math.PI*2); ctx.fill();
        break;

    case 3: // Grapes
        var gR = r * 0.38;
        var pos = [[-gR,-gR*0.6],[gR,-gR*0.6],[0,gR*0.4],[-gR*1.1,gR*0.7],[gR*1.1,gR*0.7],[0,gR*1.6]];
        for (var p = 0; p < pos.length; p++) {
            ctx.fillStyle = '#7b1fa2';
            ctx.beginPath(); ctx.arc(pos[p][0], pos[p][1], gR, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.beginPath(); ctx.arc(pos[p][0]-gR*0.2, pos[p][1]-gR*0.2, gR*0.3, 0, Math.PI*2); ctx.fill();
        }
        // Stem
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r*1.05); ctx.lineTo(0, -r*0.6); ctx.stroke();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath(); ctx.ellipse(5, -r, 6, 3, 0.6, 0, Math.PI*2); ctx.fill();
        break;

    case 4: // Strawberry
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.moveTo(0, r*1.1);
        ctx.bezierCurveTo( r,  r*0.5,  r,  -r*0.3, 0, -r*0.5);
        ctx.bezierCurveTo(-r, -r*0.3, -r,  r*0.5,  0,  r*1.1);
        ctx.fill();
        // Seeds
        ctx.fillStyle = '#ffeb3b';
        var seeds = [[-r*0.28,0],[r*0.28,0],[0,r*0.4],[-r*0.18,-r*0.22],[r*0.18,-r*0.22],[0,-r*0.42]];
        for (var s = 0; s < seeds.length; s++) {
            ctx.beginPath(); ctx.ellipse(seeds[s][0], seeds[s][1], 1.5, 2, 0, 0, Math.PI*2); ctx.fill();
        }
        // Green cap
        ctx.fillStyle = '#43a047';
        for (var a = 0; a < 5; a++) {
            var angle = (a / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(0, -r*0.5);
            ctx.lineTo(Math.cos(angle)*r*0.6, Math.sin(angle)*r*0.6 - r*0.5);
            ctx.lineTo(Math.cos(angle+0.4)*r*0.3, Math.sin(angle+0.4)*r*0.3 - r*0.5);
            ctx.closePath(); ctx.fill();
        }
        break;

    case 5: // Peach
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        // Blush
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.ellipse(r*0.25, r*0.2, r*0.35, r*0.3, 0.3, 0, Math.PI*2); ctx.fill();
        // Crease
        ctx.strokeStyle = 'rgba(180,80,30,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -r*0.9); ctx.quadraticCurveTo(r*0.1, 0, 0, r*0.9); ctx.stroke();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.ellipse(-r*0.25, -r*0.25, r*0.28, r*0.2, -0.5, 0, Math.PI*2); ctx.fill();
        // Stem
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(1, -r-6); ctx.stroke();
        ctx.fillStyle = '#43a047';
        ctx.beginPath(); ctx.ellipse(4, -r-4, 5, 3, 0.5, 0, Math.PI*2); ctx.fill();
        break;

    case 6: // Kiwi (slice view)
        ctx.fillStyle = '#5d4037';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#558b2f';
        ctx.beginPath(); ctx.arc(0, 0, r*0.85, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#aed581';
        ctx.beginPath(); ctx.arc(0, 0, r*0.65, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f9fbe7';
        ctx.beginPath(); ctx.arc(0, 0, r*0.2, 0, Math.PI*2); ctx.fill();
        // Seeds
        ctx.fillStyle = '#1b5e20';
        for (var a = 0; a < 8; a++) {
            var ang = (a / 8) * Math.PI * 2;
            ctx.save();
            ctx.translate(Math.cos(ang)*r*0.45, Math.sin(ang)*r*0.45);
            ctx.rotate(ang + Math.PI/2);
            ctx.beginPath(); ctx.ellipse(0, 0, 1.5, 3, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        break;

    case 7: // Cherries
        var cr = r * 0.55;
        // Left cherry
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.arc(-cr*0.7, cr*0.4, cr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-cr*0.7-cr*0.2, cr*0.4-cr*0.2, cr*0.3, cr*0.2, -0.5, 0, Math.PI*2); ctx.fill();
        // Right cherry
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.arc(cr*0.7, cr*0.4, cr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(cr*0.7-cr*0.2, cr*0.4-cr*0.2, cr*0.3, cr*0.2, -0.5, 0, Math.PI*2); ctx.fill();
        // Stems
        ctx.strokeStyle = '#388e3c'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-cr*0.7, -cr*0.5); ctx.quadraticCurveTo(-cr*0.2, -r*0.9, 0, -r*0.9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( cr*0.7, -cr*0.5); ctx.quadraticCurveTo( cr*0.2, -r*0.9, 0, -r*0.9); ctx.stroke();
        break;

    case 8: // Banana
        ctx.fillStyle = '#fdd835';
        ctx.beginPath();
        ctx.moveTo(-r*0.6, r*0.5);
        ctx.quadraticCurveTo(-r*1.1, -r*0.2, -r*0.2, -r*0.9);
        ctx.quadraticCurveTo(r*0.4, -r*1.1, r*0.9, -r*0.5);
        ctx.quadraticCurveTo(r*0.7, r*0.1, r*0.1, r*0.5);
        ctx.quadraticCurveTo(-r*0.15, r*0.65, -r*0.6, r*0.5);
        ctx.closePath(); ctx.fill();
        // Stripe
        ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r*0.3, r*0.2);
        ctx.quadraticCurveTo(-r*0.6, -r*0.3, 0, -r*0.8);
        ctx.stroke();
        // Tips
        ctx.fillStyle = '#795548';
        ctx.beginPath(); ctx.ellipse(-r*0.6, r*0.5, 3, 4, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r*0.9, -r*0.5, 3, 4, 1.2, 0, Math.PI*2); ctx.fill();
        break;

    case 9: // Watermelon slice
        // Green rind
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.closePath(); ctx.fill();
        // White layer
        ctx.fillStyle = '#f1f8e9';
        ctx.beginPath();
        ctx.moveTo(-r*0.88, 0);
        ctx.arc(0, 0, r*0.88, Math.PI, 0);
        ctx.closePath(); ctx.fill();
        // Red flesh
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.moveTo(-r*0.78, 0);
        ctx.arc(0, 0, r*0.78, Math.PI, 0);
        ctx.closePath(); ctx.fill();
        // Seeds
        ctx.fillStyle = '#1a1a1a';
        var seedPos = [[-r*0.35,-r*0.3],[r*0.35,-r*0.3],[0,-r*0.5],[r*0.18,-r*0.15],[-r*0.18,-r*0.15]];
        for (var sp = 0; sp < seedPos.length; sp++) {
            ctx.save();
            ctx.translate(seedPos[sp][0], seedPos[sp][1]);
            ctx.rotate(0.3);
            ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        break;

    case 10: // Bomb
        // Body
        var grad = ctx.createRadialGradient(-r*0.2, -r*0.25, r*0.1, 0, 0, r);
        grad.addColorStop(0, '#616161');
        grad.addColorStop(1, '#212121');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.ellipse(-r*0.28, -r*0.28, r*0.3, r*0.22, -0.5, 0, Math.PI*2); ctx.fill();
        // Fuse base
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.ellipse(0, -r, 4, 5, 0, 0, Math.PI*2); ctx.fill();
        // Fuse cord
        ctx.strokeStyle = '#bcaaa4'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -r-3);
        ctx.quadraticCurveTo(6, -r-9, 3, -r-15);
        ctx.quadraticCurveTo(8, -r-20, 4, -r-26);
        ctx.stroke();
        // Spark at tip
        ctx.fillStyle = '#ff6f00';
        ctx.beginPath(); ctx.arc(4, -r-26, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath(); ctx.arc(4, -r-26, 1.5, 0, Math.PI*2); ctx.fill();
        // Spark rays
        ctx.strokeStyle = '#ffcc02'; ctx.lineWidth = 1.5;
        for (var ray = 0; ray < 5; ray++) {
            var ra = (ray / 5) * Math.PI * 2 + (Date.now() * 0.01 % (Math.PI * 2));
            ctx.beginPath();
            ctx.moveTo(4 + Math.cos(ra)*3, -r-26 + Math.sin(ra)*3);
            ctx.lineTo(4 + Math.cos(ra)*6, -r-26 + Math.sin(ra)*6);
            ctx.stroke();
        }
        break;
    }

    ctx.restore();
}

// ─── DRAW HEART (for lives) ────────────────────────────────
function drawHeart(cx, cy, size) {
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.3);
    ctx.bezierCurveTo(cx, cy - size * 0.1, cx - size * 0.6, cy - size * 0.4, cx - size * 0.5, cy);
    ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.35, cx, cy + size * 0.6, cx, cy + size * 0.3);
    ctx.bezierCurveTo(cx, cy + size * 0.6, cx + size * 0.5, cy + size * 0.35, cx + size * 0.5, cy);
    ctx.bezierCurveTo(cx + size * 0.6, cy - size * 0.4, cx, cy - size * 0.1, cx, cy + size * 0.3);
    ctx.fill();
}

// ─── GAME LOGIC ────────────────────────────────────────────
function initGame() {
    basket = { x: W / 2 - BASKET_W / 2, y: H - 50 };
    items = [];
    score = 0; lives = 3; frame = 0; spawnRate = 90;
    isPlaying = true;
}

function spawnItem() {
    var isBomb = Math.random() < 0.18;
    var kind = isBomb ? 10 : Math.floor(Math.random() * FRUIT_COUNT);
    items.push({
        x: 24 + Math.random() * (W - 48),
        y: -30,
        vy: 2.5 + Math.random() * 2,
        rot: Math.random() * Math.PI * 2,          // initial rotation
        rotSpeed: (Math.random() - 0.5) * 0.08,    // spin per frame
        type: isBomb ? 'bomb' : 'fruit',
        kind: kind,
        r: 18 + Math.random() * 7
    });
}

function update() {
    frame++;
    if (frame % spawnRate === 0) {
        spawnItem();
        if (spawnRate > 40) spawnRate -= 1;
    }

    if (keys['ArrowLeft'] || keys['a'] || keys['left'])
        basket.x = Math.max(0, basket.x - BASKET_SPEED);
    if (keys['ArrowRight'] || keys['d'] || keys['right'])
        basket.x = Math.min(W - BASKET_W, basket.x + BASKET_SPEED);

    for (var i = items.length - 1; i >= 0; i--) {
        var item = items[i];
        item.y += item.vy;
        item.rot += item.rotSpeed;

        // Check catch
        if (item.y + item.r > basket.y &&
            item.y - item.r < basket.y + BASKET_H &&
            item.x > basket.x - item.r * 0.4 &&
            item.x < basket.x + BASKET_W + item.r * 0.4) {
            items.splice(i, 1);
            if (item.type === 'bomb') {
                lives--;
                updateHUD();
                if (lives <= 0) { gameOver(); return; }
            } else {
                score += 10;
                updateHUD();
            }
            continue;
        }

        // Fell off bottom
        if (item.y - item.r > H + 10) {
            items.splice(i, 1);
            if (item.type === 'fruit') {
                lives--;
                updateHUD();
                if (lives <= 0) { gameOver(); return; }
            }
        }
    }
}

function draw() {
    // Background
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a237e');
    bg.addColorStop(1, '#283593');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (var i = 0; i < stars.length; i++)
        ctx.fillRect(stars[i].x, stars[i].y, stars[i].s, stars[i].s);

    // Items
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawFruit(item.kind, item.x, item.y, item.r, item.rot);
    }

    // Basket
    var bx = basket.x, by = basket.y;
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath(); ctx.roundRect(bx, by, BASKET_W, BASKET_H, [0, 0, 8, 8]); ctx.fill();
    // Rim
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath(); ctx.roundRect(bx - 4, by - 7, BASKET_W + 8, 11, 4); ctx.fill();
    // Rim highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(bx - 3, by - 6, BASKET_W + 6, 5, 3); ctx.fill();
    // Weave
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1;
    for (var x = bx + 10; x < bx + BASKET_W; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x, by + BASKET_H - 2); ctx.stroke();
    }
    // Horizontal weave
    ctx.beginPath(); ctx.moveTo(bx + 1, by + BASKET_H * 0.45); ctx.lineTo(bx + BASKET_W - 1, by + BASKET_H * 0.45); ctx.stroke();

    // Lives (hearts)
    for (var i = 0; i < lives; i++) {
        drawHeart(16 + i * 28, 16, 10);
    }
}

// Star field
var stars = [];
for (var i = 0; i < 70; i++)
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.3 ? 2 : 1 });

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('catcherHigh', highScore); }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' V:' + lives;
}

function gameLoop() {
    if (!isPlaying) return;
    update();
    draw();
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animFrameId);
    draw();
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function startGame() {
    initGame();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

// ─── CONTROLS ──────────────────────────────────────────────
document.addEventListener('keydown', function(e) { keys[e.key] = true; });
document.addEventListener('keyup',   function(e) { keys[e.key] = false; });

canvas.addEventListener('mousemove', function(e) {
    if (!isPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    basket.x = Math.max(0, Math.min(W - BASKET_W, mx - BASKET_W / 2));
});
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var mx = (e.touches[0].clientX - rect.left) * (W / rect.width);
    basket.x = Math.max(0, Math.min(W - BASKET_W, mx - BASKET_W / 2));
}, { passive: false });

var btnLeft  = document.getElementById('btnLeft');
var btnRight = document.getElementById('btnRight');
function addHold(btn, key) {
    btn.addEventListener('mousedown',   function()  { keys[key] = true; });
    btn.addEventListener('touchstart',  function(e) { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('mouseup',     function()  { keys[key] = false; });
    btn.addEventListener('touchend',    function()  { keys[key] = false; });
    btn.addEventListener('touchcancel', function()  { keys[key] = false; });
    btn.addEventListener('mouseleave',  function()  { keys[key] = false; });
}
addHold(btnLeft,  'left');
addHold(btnRight, 'right');

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

// Atrapa Frutas
var canvas = document.getElementById('catcherCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 500

var FRUITS = ['🍎','🍊','🍋','🍇','🍓','🍑','🥝','🍒','🍌','🍉'];
var BASKET_W = 80, BASKET_H = 30;
var BASKET_SPEED = 7;
var keys = {};

var basket, items, score, highScore, lives, isPlaying, animFrameId, frame, spawnRate;
highScore = parseInt(localStorage.getItem('catcherHigh') || '0', 10);

function initGame() {
    basket = { x: W / 2 - BASKET_W / 2, y: H - 50 };
    items = [];
    score = 0; lives = 3; frame = 0; spawnRate = 90;
    isPlaying = true;
}

function spawnItem() {
    var isBomb = Math.random() < 0.18;
    items.push({
        x: 20 + Math.random() * (W - 40),
        y: -30,
        vy: 2.5 + Math.random() * 2,
        type: isBomb ? 'bomb' : 'fruit',
        emoji: isBomb ? '💣' : FRUITS[Math.floor(Math.random() * FRUITS.length)],
        size: 28 + Math.random() * 10
    });
}

function update() {
    frame++;
    if (frame % spawnRate === 0) {
        spawnItem();
        if (spawnRate > 40) spawnRate -= 1;
    }

    // Move basket
    if (keys['ArrowLeft'] || keys['a'] || keys['left']) {
        basket.x = Math.max(0, basket.x - BASKET_SPEED);
    }
    if (keys['ArrowRight'] || keys['d'] || keys['right']) {
        basket.x = Math.min(W - BASKET_W, basket.x + BASKET_SPEED);
    }

    // Update items
    for (var i = items.length - 1; i >= 0; i--) {
        var item = items[i];
        item.y += item.vy;

        // Check catch
        if (item.y + item.size > basket.y &&
            item.y < basket.y + BASKET_H &&
            item.x > basket.x - item.size / 2 &&
            item.x < basket.x + BASKET_W + item.size / 2) {
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
        if (item.y > H + 10) {
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
    // Background gradient
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a237e');
    bg.addColorStop(1, '#283593');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (var i = 0; i < stars.length; i++) {
        ctx.fillRect(stars[i].x, stars[i].y, 2, 2);
    }

    // Items
    ctx.textBaseline = 'top';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        ctx.font = item.size + 'px serif';
        ctx.fillText(item.emoji, item.x - item.size / 2, item.y - item.size / 2);
    }

    // Basket
    var bx = basket.x, by = basket.y;
    // Basket body
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.roundRect(bx, by, BASKET_W, BASKET_H, [0, 0, 8, 8]);
    ctx.fill();
    // Basket rim
    ctx.fillStyle = '#a1887f';
    ctx.beginPath();
    ctx.roundRect(bx - 4, by - 6, BASKET_W + 8, 10, 4);
    ctx.fill();
    // Weave lines
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 1;
    for (var x = bx + 10; x < bx + BASKET_W; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, by + 2);
        ctx.lineTo(x, by + BASKET_H - 2);
        ctx.stroke();
    }

    // Lives hearts
    ctx.font = '20px serif';
    ctx.textBaseline = 'top';
    for (var i = 0; i < lives; i++) {
        ctx.fillText('❤️', 8 + i * 26, 8);
    }
}

// Star field
var stars = [];
for (var i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H });

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('catcherHigh', highScore); }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' ❤️:' + lives;
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

// Keyboard
document.addEventListener('keydown', function(e) { keys[e.key] = true; });
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

// Mouse drag
canvas.addEventListener('mousemove', function(e) {
    if (!isPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    var mx = (e.clientX - rect.left) * scaleX;
    basket.x = Math.max(0, Math.min(W - BASKET_W, mx - BASKET_W / 2));
});
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    var mx = (e.touches[0].clientX - rect.left) * scaleX;
    basket.x = Math.max(0, Math.min(W - BASKET_W, mx - BASKET_W / 2));
}, { passive: false });

// Touch buttons
var btnLeft = document.getElementById('btnLeft');
var btnRight = document.getElementById('btnRight');
function addHold(btn, key) {
    btn.addEventListener('mousedown', function() { keys[key] = true; });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('mouseup', function() { keys[key] = false; });
    btn.addEventListener('touchend', function() { keys[key] = false; });
    btn.addEventListener('touchcancel', function() { keys[key] = false; });
    btn.addEventListener('mouseleave', function() { keys[key] = false; });
}
addHold(btnLeft, 'left');
addHold(btnRight, 'right');

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init draw
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

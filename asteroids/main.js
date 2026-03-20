// Asteroids
var canvas = document.getElementById('asteroidsCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var keys = {};
var ship, bullets, asteroids, particles;
var score, highScore, lives, level;
var isPlaying = false;
var animFrameId = null;
var invincible = 0; // frames of invincibility after respawn

highScore = parseInt(localStorage.getItem('asteroidsHigh') || '0', 10);

function Ship(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = 14;
    this.shootCooldown = 0;
}
Ship.prototype.update = function() {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) this.angle -= 0.06;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) this.angle += 0.06;
    if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys['thrust']) {
        this.vx += Math.cos(this.angle) * 0.25;
        this.vy += Math.sin(this.angle) * 0.25;
    }
    this.vx *= 0.98; this.vy *= 0.98;
    this.x = (this.x + this.vx + W) % W;
    this.y = (this.y + this.vy + H) % H;
    if (this.shootCooldown > 0) this.shootCooldown--;
};
Ship.prototype.draw = function() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) {
        ctx.restore();
        return;
    }
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.stroke();
    if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys['thrust']) {
        ctx.fillStyle = '#ff512f';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-14, 5);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-14, -5);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
};
Ship.prototype.shoot = function() {
    if (this.shootCooldown > 0) return;
    bullets.push({ x: this.x + Math.cos(this.angle)*18, y: this.y + Math.sin(this.angle)*18,
        vx: Math.cos(this.angle)*9 + this.vx, vy: Math.sin(this.angle)*9 + this.vy, life: 55 });
    this.shootCooldown = 12;
};

function createAsteroid(x, y, size) {
    var angle = Math.random() * Math.PI * 2;
    var speed = (0.8 + Math.random() * 0.8) * (4 - size) * 0.5 + 0.5 * level;
    var pts = [];
    var n = 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var r = (size === 3 ? 38 : size === 2 ? 22 : 12) * (0.75 + Math.random() * 0.5);
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return { x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: size, pts: pts, radius: size === 3 ? 38 : size === 2 ? 22 : 12, angle: 0, spin: (Math.random()-0.5)*0.04 };
}

function spawnLevel() {
    asteroids = [];
    var count = 3 + level;
    for (var i = 0; i < count; i++) {
        var x, y;
        do { x = Math.random() * W; y = Math.random() * H; }
        while (Math.hypot(x - ship.x, y - ship.y) < 120);
        asteroids.push(createAsteroid(x, y, 3));
    }
}

function spawnParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = 1 + Math.random() * 3;
        particles.push({ x: x, y: y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 30 + Math.random()*20, color: color });
    }
}

function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.pts[0].x, a.pts[0].y);
    for (var i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

function circle(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

function wrap(obj) {
    obj.x = (obj.x + W) % W;
    obj.y = (obj.y + H) % H;
}

function update() {
    ship.update();
    if (keys[' '] || keys['fire']) ship.shoot();

    // Bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        wrap(b);
        if (b.life <= 0) { bullets.splice(i, 1); continue; }
        // Hit asteroid
        for (var j = asteroids.length - 1; j >= 0; j--) {
            var a = asteroids[j];
            if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius) {
                bullets.splice(i, 1);
                spawnParticles(a.x, a.y, '#fff', 8);
                var pts = a.size === 3 ? 20 : a.size === 2 ? 10 : 5;
                score += pts;
                if (a.size > 1) {
                    asteroids.push(createAsteroid(a.x, a.y, a.size - 1));
                    asteroids.push(createAsteroid(a.x, a.y, a.size - 1));
                }
                asteroids.splice(j, 1);
                updateHUD();
                break;
            }
        }
    }

    // Asteroids
    for (var i = 0; i < asteroids.length; i++) {
        var a = asteroids[i];
        a.x += a.vx; a.y += a.vy;
        a.angle += a.spin;
        wrap(a);
        // Hit ship
        if (invincible <= 0 && Math.hypot(ship.x - a.x, ship.y - a.y) < a.radius + ship.radius) {
            spawnParticles(ship.x, ship.y, '#8fd3f4', 15);
            lives--;
            updateHUD();
            if (lives <= 0) { gameOver(); return; }
            ship.x = W/2; ship.y = H/2; ship.vx = 0; ship.vy = 0;
            invincible = 120;
        }
    }

    // Particles
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (invincible > 0) invincible--;

    if (asteroids.length === 0) {
        level++;
        spawnLevel();
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (var i = 0; i < starField.length; i++) {
        ctx.fillRect(starField[i].x, starField[i].y, starField[i].s, starField[i].s);
    }

    for (var i = 0; i < asteroids.length; i++) drawAsteroid(asteroids[i]);

    for (var i = 0; i < bullets.length; i++) {
        ctx.fillStyle = '#ff512f';
        ctx.beginPath();
        ctx.arc(bullets[i].x, bullets[i].y, 3, 0, Math.PI*2);
        ctx.fill();
    }

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = p.life / 50;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;

    ship.draw();
}

// Random star field
var starField = [];
for (var i = 0; i < 80; i++) {
    starField.push({ x: Math.random()*480, y: Math.random()*480, s: Math.random() < 0.3 ? 2 : 1 });
}

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('asteroidsHigh', highScore); }
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

function startGame() {
    ship = new Ship(W/2, H/2);
    bullets = []; asteroids = []; particles = [];
    score = 0; lives = 3; level = 1; invincible = 0;
    isPlaying = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    spawnLevel();
    updateHUD();
    cancelAnimationFrame(animFrameId);
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

// Keyboard
document.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
});
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

// Touch controls
var btnRotLeft = document.getElementById('btnRotLeft');
var btnRotRight = document.getElementById('btnRotRight');
var btnThrust = document.getElementById('btnThrust');
var btnFire = document.getElementById('btnFire');

function addHold(btn, key) {
    btn.addEventListener('mousedown', function() { keys[key] = true; });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('mouseup', function() { keys[key] = false; });
    btn.addEventListener('touchend', function() { keys[key] = false; });
    btn.addEventListener('touchcancel', function() { keys[key] = false; });
    btn.addEventListener('mouseleave', function() { keys[key] = false; });
}
addHold(btnRotLeft, 'ArrowLeft');
addHold(btnRotRight, 'ArrowRight');
addHold(btnThrust, 'thrust');
addHold(btnFire, 'fire');

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init draw
ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
updateHUD();

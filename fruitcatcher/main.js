// Atrapa Frutas — oleadas, combo, estrella, efectos, pausa, record
var canvas = document.getElementById('catcherCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 500

var BASKET_W = 80, BASKET_H = 30;
var BASKET_SPEED = 7;
var keys = {};

// Fruit kinds: 0-9 fruits, 10 bomb, 11 star
var FRUIT_COUNT = 10;
var basket, items, score, highScore, lives, isPlaying, animFrameId, frame, spawnRate;
var isPaused = false;

// Waves
var wave = 1;
var waveTimer = 0;         // frames in current wave
var WAVE_DURATION = 1800;  // 30 seconds at 60fps
var waveMsg = null;        // { text, alpha, scale }
var maxWave = 1;

// Combo
var combo = 0;
var comboMultiplier = 1;
var comboDisplay = { alpha: 0, scale: 1, text: '' };

// Basket squish
var basketScaleY = 1;

// Floating score popups
var scorePopups = [];

// Bomb explosion particles
var explosionParticles = [];

// Screen shake / flash
var shakeFrames = 0;
var flashColor  = null;
var flashAlpha  = 0;

highScore = parseInt(localStorage.getItem('catcherHigh') || '0', 10);
maxWave   = parseInt(localStorage.getItem('catcherMaxWave') || '1', 10);

// ─── DRAW INDIVIDUAL FRUIT ─────────────────────────────────
function drawFruit(kind, cx, cy, r, rot, isStarItem) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);

    if (isStarItem) {
        drawStar(r);
        ctx.restore();
        return;
    }

    switch (kind) {

    case 0: // Apple
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(0, 2, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.ellipse(-r*0.3, -r*0.2, r*0.35, r*0.25, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(2, -r-7); ctx.stroke();
        ctx.fillStyle = '#43a047';
        ctx.beginPath(); ctx.ellipse(5, -r-5, 5, 3, 0.5, 0, Math.PI*2); ctx.fill();
        break;

    case 1: // Orange
        ctx.fillStyle = '#fb8c00';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-r*0.3, -r*0.25, r*0.3, r*0.22, -0.4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, r*0.5, r*0.15, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath(); ctx.ellipse(0, -r-2, 3, 5, 0, 0, Math.PI*2); ctx.fill();
        break;

    case 2: // Lemon
        ctx.fillStyle = '#fdd835';
        ctx.beginPath(); ctx.ellipse(0, 0, r*1.2, r*0.85, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-r*0.25, -r*0.2, r*0.35, r*0.2, -0.3, 0, Math.PI*2); ctx.fill();
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
        ctx.fillStyle = '#ffeb3b';
        var seeds = [[-r*0.28,0],[r*0.28,0],[0,r*0.4],[-r*0.18,-r*0.22],[r*0.18,-r*0.22],[0,-r*0.42]];
        for (var s = 0; s < seeds.length; s++) {
            ctx.beginPath(); ctx.ellipse(seeds[s][0], seeds[s][1], 1.5, 2, 0, 0, Math.PI*2); ctx.fill();
        }
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
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.ellipse(r*0.25, r*0.2, r*0.35, r*0.3, 0.3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(180,80,30,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -r*0.9); ctx.quadraticCurveTo(r*0.1, 0, 0, r*0.9); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.ellipse(-r*0.25, -r*0.25, r*0.28, r*0.2, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(1, -r-6); ctx.stroke();
        ctx.fillStyle = '#43a047';
        ctx.beginPath(); ctx.ellipse(4, -r-4, 5, 3, 0.5, 0, Math.PI*2); ctx.fill();
        break;

    case 6: // Kiwi
        ctx.fillStyle = '#5d4037';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#558b2f';
        ctx.beginPath(); ctx.arc(0, 0, r*0.85, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#aed581';
        ctx.beginPath(); ctx.arc(0, 0, r*0.65, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f9fbe7';
        ctx.beginPath(); ctx.arc(0, 0, r*0.2, 0, Math.PI*2); ctx.fill();
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
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.arc(-cr*0.7, cr*0.4, cr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(-cr*0.7-cr*0.2, cr*0.4-cr*0.2, cr*0.3, cr*0.2, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.arc(cr*0.7, cr*0.4, cr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(cr*0.7-cr*0.2, cr*0.4-cr*0.2, cr*0.3, cr*0.2, -0.5, 0, Math.PI*2); ctx.fill();
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
        ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r*0.3, r*0.2);
        ctx.quadraticCurveTo(-r*0.6, -r*0.3, 0, -r*0.8);
        ctx.stroke();
        ctx.fillStyle = '#795548';
        ctx.beginPath(); ctx.ellipse(-r*0.6, r*0.5, 3, 4, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r*0.9, -r*0.5, 3, 4, 1.2, 0, Math.PI*2); ctx.fill();
        break;

    case 9: // Watermelon slice
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f1f8e9';
        ctx.beginPath();
        ctx.moveTo(-r*0.88, 0);
        ctx.arc(0, 0, r*0.88, Math.PI, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.moveTo(-r*0.78, 0);
        ctx.arc(0, 0, r*0.78, Math.PI, 0);
        ctx.closePath(); ctx.fill();
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
        var grad = ctx.createRadialGradient(-r*0.2, -r*0.25, r*0.1, 0, 0, r);
        grad.addColorStop(0, '#616161');
        grad.addColorStop(1, '#212121');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.ellipse(-r*0.28, -r*0.28, r*0.3, r*0.22, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.ellipse(0, -r, 4, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#bcaaa4'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -r-3);
        ctx.quadraticCurveTo(6, -r-9, 3, -r-15);
        ctx.quadraticCurveTo(8, -r-20, 4, -r-26);
        ctx.stroke();
        ctx.fillStyle = '#ff6f00';
        ctx.beginPath(); ctx.arc(4, -r-26, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath(); ctx.arc(4, -r-26, 1.5, 0, Math.PI*2); ctx.fill();
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

// ─── STAR SHAPE ────────────────────────────────────────────
function drawStar(r) {
    var spikes = 5;
    var outerR = r;
    var innerR = r * 0.45;
    var pulse  = 0.85 + 0.15 * Math.sin(Date.now() * 0.005);

    // Glow ring (no shadowBlur — use concentric circles)
    ctx.save();
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(0, 0, outerR * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.45 * pulse;
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.arc(0, 0, outerR * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Star body
    ctx.beginPath();
    for (var i = 0; i < spikes * 2; i++) {
        var rad = (i % 2 === 0) ? outerR : innerR;
        var ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else         ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd600';
    ctx.fill();
    ctx.strokeStyle = '#ff8f00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-outerR * 0.15, -outerR * 0.2, outerR * 0.2, 0, Math.PI * 2);
    ctx.fill();
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

// ─── WAVE SYSTEM ───────────────────────────────────────────
function getWaveParams() {
    // Each wave increases speed and frequency
    return {
        baseSpeed: 2.5 + (wave - 1) * 0.4,
        speedVar:  2.0 + (wave - 1) * 0.2,
        spawnRate: Math.max(35, 90 - (wave - 1) * 12)
    };
}

function triggerWaveMessage() {
    waveMsg = { text: 'OLEADA ' + wave, alpha: 1.0, scale: 1.8 };
}

// ─── COMBO SYSTEM ──────────────────────────────────────────
function getComboMultiplier(c) {
    if (c >= 20) return 4;
    if (c >= 10) return 3;
    if (c >= 5)  return 2;
    return 1;
}

function resetCombo() {
    combo = 0;
    comboMultiplier = 1;
}

// ─── SCORE POPUP ───────────────────────────────────────────
function spawnScorePopup(x, y, pts) {
    scorePopups.push({ x: x, y: y, text: '+' + pts, alpha: 1.0, vy: -1.2 });
}

// ─── EXPLOSION PARTICLES ───────────────────────────────────
function spawnExplosion(x, y) {
    for (var i = 0; i < 14; i++) {
        var ang  = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
        var spd  = 2 + Math.random() * 4;
        explosionParticles.push({
            x: x, y: y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 1,
            life: 1,
            color: Math.random() < 0.5 ? '#ff6f00' : '#212121',
            r: 4 + Math.random() * 5
        });
    }
}

function updateExplosion() {
    for (var i = explosionParticles.length - 1; i >= 0; i--) {
        var p = explosionParticles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.15;
        p.life -= 0.035;
        if (p.life <= 0) explosionParticles.splice(i, 1);
    }
}

function drawExplosion() {
    for (var i = 0; i < explosionParticles.length; i++) {
        var p = explosionParticles[i];
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─── GAME LOGIC ────────────────────────────────────────────
function initGame() {
    basket = { x: W / 2 - BASKET_W / 2, y: H - 50 };
    items = [];
    scorePopups = [];
    explosionParticles = [];
    score = 0; lives = 3; frame = 0;
    wave = 1; waveTimer = 0;
    combo = 0; comboMultiplier = 1;
    basketScaleY = 1;
    shakeFrames = 0;
    flashColor = null; flashAlpha = 0;
    waveMsg = null;
    isPaused = false;
    isPlaying = true;
    var wp = getWaveParams();
    spawnRate = wp.spawnRate;
    triggerWaveMessage();
}

function spawnItem() {
    var isBomb = Math.random() < 0.18;
    var isStar = !isBomb && Math.random() < 0.08;
    var kind = isBomb ? 10 : (isStar ? 11 : Math.floor(Math.random() * FRUIT_COUNT));
    var wp = getWaveParams();
    items.push({
        x: 24 + Math.random() * (W - 48),
        y: -30,
        vy: wp.baseSpeed + Math.random() * wp.speedVar,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        type: isBomb ? 'bomb' : (isStar ? 'star' : 'fruit'),
        kind: kind,
        r: 18 + Math.random() * 7
    });
}

function update() {
    frame++;
    waveTimer++;

    // Wave progression
    var wp = getWaveParams();
    spawnRate = wp.spawnRate;

    if (waveTimer >= WAVE_DURATION) {
        wave++;
        waveTimer = 0;
        if (wave > maxWave) {
            maxWave = wave;
            localStorage.setItem('catcherMaxWave', maxWave);
        }
        triggerWaveMessage();
    }

    if (frame % spawnRate === 0) spawnItem();

    // Basket movement
    if (keys['ArrowLeft'] || keys['a'] || keys['left'])
        basket.x = Math.max(0, basket.x - BASKET_SPEED);
    if (keys['ArrowRight'] || keys['d'] || keys['right'])
        basket.x = Math.min(W - BASKET_W, basket.x + BASKET_SPEED);

    // Basket squish recovery
    basketScaleY += (1 - basketScaleY) * 0.18;

    // Wave message fade
    if (waveMsg) {
        waveMsg.alpha -= 0.008;
        waveMsg.scale += (1.0 - waveMsg.scale) * 0.12;
        if (waveMsg.alpha <= 0) waveMsg = null;
    }

    // Score popups
    for (var j = scorePopups.length - 1; j >= 0; j--) {
        scorePopups[j].y  += scorePopups[j].vy;
        scorePopups[j].alpha -= 0.022;
        if (scorePopups[j].alpha <= 0) scorePopups.splice(j, 1);
    }

    // Combo display fade
    if (comboDisplay.alpha > 0) {
        comboDisplay.alpha -= 0.012;
        comboDisplay.scale += (1.0 - comboDisplay.scale) * 0.15;
    }

    // Screen shake decay
    if (shakeFrames > 0) shakeFrames--;
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.06);

    updateExplosion();

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
                // Bomb caught: dramatic effect
                lives--;
                resetCombo();
                spawnExplosion(item.x, basket.y);
                shakeFrames = 18;
                flashColor  = '#ff1744';
                flashAlpha  = 0.6;
                GameAudio.bomb();
                updateHUD();
                if (lives <= 0) { gameOver(); return; }
            } else {
                // Fruit/star caught
                combo++;
                comboMultiplier = getComboMultiplier(combo);

                var basePoints = item.type === 'star' ? 50 : 10;
                var pts = basePoints * comboMultiplier;
                score += pts;
                GameAudio.powerUp();

                // Squish basket
                basketScaleY = 0.75;

                // Score popup
                var popText = comboMultiplier > 1
                    ? '+' + pts + ' x' + comboMultiplier
                    : '+' + pts;
                spawnScorePopup(item.x, basket.y - 10, popText);

                // Show combo
                if (comboMultiplier > 1) {
                    comboDisplay = { alpha: 1.0, scale: 1.5, text: 'x' + comboMultiplier + ' COMBO!' };
                }

                updateHUD();
            }
            continue;
        }

        // Fell off bottom
        if (item.y - item.r > H + 10) {
            items.splice(i, 1);
            if (item.type === 'fruit' || item.type === 'star') {
                lives--;
                resetCombo();
                updateHUD();
                if (lives <= 0) { gameOver(); return; }
            }
            // Bomb missed: no penalty, just disappear
        }
    }
}

function draw() {
    ctx.save();

    // Screen shake
    if (shakeFrames > 0) {
        ctx.translate(
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.5) * 5
        );
    }

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
        drawFruit(item.kind, item.x, item.y, item.r, item.rot, item.type === 'star');
    }

    // Explosion particles
    drawExplosion();

    // Basket (with squish)
    var bx = basket.x;
    var by = basket.y;
    var bh = BASKET_H;
    ctx.save();
    ctx.translate(bx + BASKET_W / 2, by + bh);
    ctx.scale(1, basketScaleY);
    ctx.translate(-(bx + BASKET_W / 2), -(by + bh));

    ctx.fillStyle = '#6d4c41';
    ctx.beginPath(); ctx.roundRect(bx, by, BASKET_W, bh, [0, 0, 8, 8]); ctx.fill();
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath(); ctx.roundRect(bx - 4, by - 7, BASKET_W + 8, 11, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(bx - 3, by - 6, BASKET_W + 6, 5, 3); ctx.fill();
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1;
    for (var x = bx + 10; x < bx + BASKET_W; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x, by + bh - 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(bx + 1, by + bh * 0.45); ctx.lineTo(bx + BASKET_W - 1, by + bh * 0.45); ctx.stroke();
    ctx.restore();

    // Lives (hearts)
    for (var i = 0; i < lives; i++) {
        drawHeart(16 + i * 28, 16, 10);
    }

    // Score popups
    for (var j = 0; j < scorePopups.length; j++) {
        var sp = scorePopups[j];
        ctx.save();
        ctx.globalAlpha = sp.alpha;
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = '#ffe082';
        ctx.textAlign = 'center';
        ctx.fillText(sp.text, sp.x, sp.y);
        ctx.restore();
    }

    // Combo display
    if (comboDisplay.alpha > 0 && comboMultiplier > 1) {
        ctx.save();
        ctx.globalAlpha = comboDisplay.alpha;
        ctx.font = 'bold ' + Math.round(22 * comboDisplay.scale) + 'px Arial';
        ctx.fillStyle = '#ffeb3b';
        ctx.textAlign = 'center';
        ctx.fillText(comboDisplay.text, W / 2, H / 2 + 20);
        ctx.restore();
    }

    // Wave message
    if (waveMsg) {
        ctx.save();
        ctx.globalAlpha = waveMsg.alpha;
        ctx.font = 'bold ' + Math.round(32 * waveMsg.scale) + 'px Arial';
        ctx.fillStyle = '#8fd3f4';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#1a237e';
        ctx.lineWidth = 4;
        ctx.strokeText(waveMsg.text, W / 2, H / 2 - 30);
        ctx.fillText(waveMsg.text, W / 2, H / 2 - 30);
        ctx.restore();
    }

    // HUD: score, wave, multiplier on canvas
    ctx.save();
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText('Puntaje: ' + score, W - 8, 16);
    ctx.fillText('Record: ' + highScore, W - 8, 32);
    ctx.fillText('Oleada: ' + wave, W - 8, 48);
    if (comboMultiplier > 1) {
        ctx.fillStyle = '#ffeb3b';
        ctx.fillText('x' + comboMultiplier, W - 8, 64);
    }
    ctx.restore();

    // Flash overlay
    if (flashAlpha > 0 && flashColor) {
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // Pause overlay
    if (isPaused) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSA', W / 2, H / 2);
        ctx.font = '18px Arial';
        ctx.fillText('Presiona P para continuar', W / 2, H / 2 + 40);
        ctx.restore();
    }

    ctx.restore();
}

// Star field
var stars = [];
for (var i = 0; i < 70; i++)
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.3 ? 2 : 1 });

function updateHUD() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('catcherHigh', highScore);
    }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' V:' + lives;
}

function gameLoop() {
    if (!isPlaying) return;
    if (!isPaused) update();
    draw();
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    cancelAnimationFrame(animFrameId);
    draw();
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score + ' | Oleada: ' + wave;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function startGame() {
    GameAudio.start();
    initGame();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

// ─── CONTROLS ──────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') {
        if (isPlaying) isPaused = !isPaused;
    }
});
document.addEventListener('keyup',   function(e) { keys[e.key] = false; });

canvas.addEventListener('mousemove', function(e) {
    if (!isPlaying || isPaused) return;
    var rect = canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    basket.x = Math.max(0, Math.min(W - BASKET_W, mx - BASKET_W / 2));
});
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isPlaying || isPaused) return;
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

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

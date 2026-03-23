// ============================================================
//  PLATFORMER — main.js
//  5 hand-crafted levels, side-scrolling, enemies, collectibles
// ============================================================

(function () {
    'use strict';

    // ── DOM refs ──────────────────────────────────────────────
    const canvas = document.getElementById('platformerCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const livesEl = document.getElementById('lives');
    const levelEl = document.getElementById('levelDisplay');
    const starsEl = document.getElementById('starsDisplay');
    const mobileScoreEl = document.getElementById('mobileScore');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const gameOverPopup = document.getElementById('gameOverPopup');
    const finalScoreEl = document.getElementById('finalScore');
    const finalHighEl = document.getElementById('finalHigh');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const levelPopup = document.getElementById('levelPopup');
    const levelTitle = document.getElementById('levelTitle');
    const levelMsg = document.getElementById('levelMsg');

    // ── Constants ────────────────────────────────────────────
    const W = 600, H = 400;
    const GRAVITY = 0.55;
    const JUMP_POWER = -12.5;
    const DOUBLE_JUMP_POWER = -11.5;
    const MOVE_ACCEL = 1.1;
    const MOVE_DECEL = 0.82;
    const MAX_SPEED = 5.2;
    const WORLD_W = 2400;
    const GROUND_Y = 370;
    const PLAYER_W = 20, PLAYER_H = 28;
    const STAR_SIZE = 14;
    const DOOR_W = 36, DOOR_H = 54;

    // ── State ────────────────────────────────────────────────
    let gameRunning = false;
    let score = 0;
    let highScore = parseInt(localStorage.getItem('platformerHigh') || '0');
    let lives = 3;
    let currentLevel = 0;
    let speedMultiplier = 1;
    let lastTime = 0;
    let rafId = null;
    let levelTransition = false;
    let levelTransitionTimer = 0;
    let deathCooldown = 0;

    // ── Input ────────────────────────────────────────────────
    const keys = {};
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    // Touch state for on-canvas D-pad
    const touch = { left: false, right: false, jump: false };

    // ── Camera ────────────────────────────────────────────────
    let camX = 0;

    // ── Particles ────────────────────────────────────────────
    let particles = [];

    function spawnDeathParticles(x, y) {
        const colors = ['#26c6da','#80deea','#ff8a65','#ffcc02','#ef5350'];
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 / 24) * i + (Math.random() - 0.5) * 0.4;
            const speed = 2 + Math.random() * 5;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 4 + Math.random() * 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.03 + Math.random() * 0.025
            });
        }
    }

    function spawnStarParticles(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                size: 3 + Math.random() * 4,
                color: '#ffd700',
                life: 1.0,
                decay: 0.04 + Math.random() * 0.03
            });
        }
    }

    function spawnEnemyParticles(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3.5;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 4 + Math.random() * 5,
                color,
                life: 1.0,
                decay: 0.035 + Math.random() * 0.03
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camX - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    // ── Score floaters ────────────────────────────────────────
    let floaters = [];

    function addFloater(x, y, text, color) {
        floaters.push({ x, y, text, color, life: 1.0, vy: -1.2 });
    }

    function updateFloaters() {
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.y += f.vy;
            f.life -= 0.022;
            if (f.life <= 0) floaters.splice(i, 1);
        }
    }

    function drawFloaters() {
        for (const f of floaters) {
            ctx.globalAlpha = Math.max(0, f.life);
            ctx.fillStyle = f.color;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(f.text, f.x - camX, f.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    // ── Level definitions ────────────────────────────────────
    // Platform: { x, y, w, h, type:'grass'|'stone'|'dirt', moving?, moveRange?, moveSpeed? }
    // Types: 'grass' = green top/brown body, 'stone' = gray, 'dirt' = earthy brown

    function makeLevels(speedMult) {
        const SM = speedMult;

        // ── LEVEL 1: Intro — gentle, flat, low platforms ──────
        const lv1 = {
            platforms: [
                // Ground segments
                { x: 0,    y: GROUND_Y, w: 600,  h: 30, type: 'grass' },
                { x: 700,  y: GROUND_Y, w: 500,  h: 30, type: 'grass' },
                { x: 1300, y: GROUND_Y, w: 600,  h: 30, type: 'grass' },
                { x: 2000, y: GROUND_Y, w: 450,  h: 30, type: 'grass' },
                // Platforms
                { x: 160,  y: 300, w: 100, h: 16, type: 'dirt' },
                { x: 330,  y: 260, w: 90,  h: 16, type: 'dirt' },
                { x: 500,  y: 220, w: 100, h: 16, type: 'stone' },
                { x: 750,  y: 270, w: 110, h: 16, type: 'grass' },
                { x: 950,  y: 230, w: 90,  h: 16, type: 'stone' },
                { x: 1100, y: 290, w: 100, h: 16, type: 'dirt' },
                { x: 1350, y: 260, w: 100, h: 16, type: 'grass' },
                { x: 1550, y: 220, w: 90,  h: 16, type: 'stone' },
                { x: 1700, y: 270, w: 110, h: 16, type: 'dirt' },
                { x: 1900, y: 230, w: 100, h: 16, type: 'grass' },
                { x: 2100, y: 280, w: 90,  h: 16, type: 'stone' },
                { x: 2250, y: 310, w: 100, h: 16, type: 'grass' },
            ],
            stars: [
                { x: 200,  y: 280 }, { x: 380,  y: 240 }, { x: 545,  y: 200 },
                { x: 800,  y: 250 }, { x: 990,  y: 210 }, { x: 1140, y: 270 },
                { x: 1400, y: 240 }, { x: 1595, y: 200 }, { x: 1945, y: 210 },
                { x: 2140, y: 260 }
            ],
            enemies: [
                { type: 'walker', x: 800,  y: GROUND_Y - 26, dir: 1, platform: { x: 700,  y: GROUND_Y, w: 500 }, speed: 1.2 * SM },
                { type: 'walker', x: 1400, y: GROUND_Y - 26, dir: -1, platform: { x: 1300, y: GROUND_Y, w: 600 }, speed: 1.4 * SM },
            ],
            exit: { x: 2310, y: GROUND_Y - DOOR_H }
        };

        // ── LEVEL 2: Vertical + moving platforms ─────────────
        const lv2 = {
            platforms: [
                { x: 0,    y: GROUND_Y, w: 400,  h: 30, type: 'grass' },
                { x: 600,  y: GROUND_Y, w: 300,  h: 30, type: 'grass' },
                { x: 1000, y: GROUND_Y, w: 400,  h: 30, type: 'stone' },
                { x: 1600, y: GROUND_Y, w: 300,  h: 30, type: 'stone' },
                { x: 2050, y: GROUND_Y, w: 400,  h: 30, type: 'grass' },
                // Platforms — various heights
                { x: 100,  y: 300, w: 90,  h: 16, type: 'dirt' },
                { x: 260,  y: 250, w: 80,  h: 16, type: 'stone' },
                { x: 620,  y: 280, w: 100, h: 16, type: 'grass' },
                { x: 780,  y: 230, w: 80,  h: 16, type: 'stone' },
                { x: 1010, y: 270, w: 100, h: 16, type: 'dirt' },
                { x: 1170, y: 210, w: 80,  h: 16, type: 'stone' },
                { x: 1340, y: 270, w: 90,  h: 16, type: 'grass' },
                { x: 1620, y: 300, w: 80,  h: 16, type: 'dirt' },
                { x: 1780, y: 240, w: 90,  h: 16, type: 'stone' },
                { x: 1940, y: 300, w: 80,  h: 16, type: 'grass' },
                { x: 2100, y: 250, w: 90,  h: 16, type: 'dirt' },
                { x: 2250, y: 310, w: 100, h: 16, type: 'grass' },
                // Moving platforms
                { x: 460,  y: 270, w: 90,  h: 16, type: 'stone', moving: true, moveRange: 100, moveSpeed: 1.0 * SM, _t: 0 },
                { x: 900,  y: 190, w: 90,  h: 16, type: 'dirt',  moving: true, moveRange: 80,  moveSpeed: 1.3 * SM, _t: 1.5 },
                { x: 1480, y: 240, w: 80,  h: 16, type: 'stone', moving: true, moveRange: 110, moveSpeed: 1.1 * SM, _t: 0.8 },
            ],
            stars: [
                { x: 140,  y: 280 }, { x: 300,  y: 230 }, { x: 500,  y: 250 },
                { x: 660,  y: 260 }, { x: 825,  y: 210 }, { x: 1050, y: 250 },
                { x: 1215, y: 190 }, { x: 1380, y: 250 }, { x: 1820, y: 220 },
                { x: 2140, y: 230 }
            ],
            enemies: [
                { type: 'walker', x: 640,  y: GROUND_Y - 26, dir: 1,  platform: { x: 600,  y: GROUND_Y, w: 300 }, speed: 1.3 * SM },
                { type: 'walker', x: 1040, y: GROUND_Y - 26, dir: -1, platform: { x: 1000, y: GROUND_Y, w: 400 }, speed: 1.5 * SM },
                { type: 'walker', x: 2100, y: GROUND_Y - 26, dir: 1,  platform: { x: 2050, y: GROUND_Y, w: 400 }, speed: 1.2 * SM },
                { type: 'jumper', x: 1170, y: 194, jumpTimer: 0, jumpInterval: 120, vy: 0, onGround: true, baseY: 194, platform: { x: 1170, y: 210, w: 80 } },
            ],
            exit: { x: 2310, y: GROUND_Y - DOOR_H }
        };

        // ── LEVEL 3: Gaps over pits ───────────────────────────
        const lv3 = {
            platforms: [
                { x: 0,    y: GROUND_Y, w: 250,  h: 30, type: 'grass' },
                { x: 370,  y: GROUND_Y, w: 180,  h: 30, type: 'stone' },
                { x: 660,  y: GROUND_Y, w: 150,  h: 30, type: 'grass' },
                { x: 910,  y: GROUND_Y, w: 200,  h: 30, type: 'stone' },
                { x: 1220, y: GROUND_Y, w: 150,  h: 30, type: 'dirt' },
                { x: 1480, y: GROUND_Y, w: 180,  h: 30, type: 'grass' },
                { x: 1760, y: GROUND_Y, w: 150,  h: 30, type: 'stone' },
                { x: 2010, y: GROUND_Y, w: 160,  h: 30, type: 'grass' },
                { x: 2270, y: GROUND_Y, w: 200,  h: 30, type: 'grass' },
                // Platforms
                { x: 100,  y: 310, w: 80,  h: 16, type: 'dirt' },
                { x: 300,  y: 270, w: 80,  h: 16, type: 'stone' },
                { x: 430,  y: 300, w: 80,  h: 16, type: 'grass' },
                { x: 580,  y: 250, w: 90,  h: 16, type: 'dirt' },
                { x: 720,  y: 300, w: 70,  h: 16, type: 'stone' },
                { x: 870,  y: 250, w: 80,  h: 16, type: 'grass' },
                { x: 980,  y: 210, w: 80,  h: 16, type: 'dirt' },
                { x: 1130, y: 270, w: 80,  h: 16, type: 'stone' },
                { x: 1280, y: 220, w: 70,  h: 16, type: 'grass' },
                { x: 1420, y: 280, w: 70,  h: 16, type: 'dirt' },
                { x: 1560, y: 230, w: 80,  h: 16, type: 'stone' },
                { x: 1700, y: 290, w: 70,  h: 16, type: 'grass' },
                { x: 1820, y: 240, w: 80,  h: 16, type: 'dirt' },
                { x: 1970, y: 200, w: 80,  h: 16, type: 'stone' },
                { x: 2120, y: 270, w: 80,  h: 16, type: 'grass' },
                { x: 2260, y: 310, w: 90,  h: 16, type: 'dirt' },
                // Moving platform over a pit
                { x: 800,  y: 200, w: 80,  h: 16, type: 'stone', moving: true, moveRange: 90,  moveSpeed: 1.4 * SM, _t: 0 },
                { x: 1340, y: 250, w: 75,  h: 16, type: 'dirt',  moving: true, moveRange: 70,  moveSpeed: 1.6 * SM, _t: 1 },
            ],
            stars: [
                { x: 140,  y: 290 }, { x: 410,  y: 280 }, { x: 470,  y: 280 },
                { x: 615,  y: 230 }, { x: 760,  y: 280 }, { x: 1020, y: 190 },
                { x: 1315, y: 200 }, { x: 1600, y: 210 }, { x: 2010, y: 180 },
                { x: 2300, y: 290 }
            ],
            enemies: [
                { type: 'walker', x: 400,  y: GROUND_Y - 26, dir: 1,  platform: { x: 370, y: GROUND_Y, w: 180 }, speed: 1.4 * SM },
                { type: 'walker', x: 680,  y: GROUND_Y - 26, dir: 1,  platform: { x: 660, y: GROUND_Y, w: 150 }, speed: 1.6 * SM },
                { type: 'walker', x: 950,  y: GROUND_Y - 26, dir: -1, platform: { x: 910, y: GROUND_Y, w: 200 }, speed: 1.5 * SM },
                { type: 'jumper', x: 585,  y: 234, jumpTimer: 0, jumpInterval: 100, vy: 0, onGround: true, baseY: 234, platform: { x: 580, y: 250, w: 90 } },
                { type: 'jumper', x: 985,  y: 194, jumpTimer: 0, jumpInterval: 90,  vy: 0, onGround: true, baseY: 194, platform: { x: 980, y: 210, w: 80 } },
            ],
            exit: { x: 2310, y: GROUND_Y - DOOR_H }
        };

        // ── LEVEL 4: Tight jumps, enemy gauntlet ──────────────
        const lv4 = {
            platforms: [
                { x: 0,    y: GROUND_Y, w: 200,  h: 30, type: 'stone' },
                { x: 340,  y: GROUND_Y, w: 120,  h: 30, type: 'stone' },
                { x: 580,  y: GROUND_Y, w: 120,  h: 30, type: 'stone' },
                { x: 820,  y: GROUND_Y, w: 120,  h: 30, type: 'stone' },
                { x: 1060, y: GROUND_Y, w: 140,  h: 30, type: 'stone' },
                { x: 1340, y: GROUND_Y, w: 120,  h: 30, type: 'grass' },
                { x: 1580, y: GROUND_Y, w: 120,  h: 30, type: 'grass' },
                { x: 1820, y: GROUND_Y, w: 120,  h: 30, type: 'grass' },
                { x: 2100, y: GROUND_Y, w: 360,  h: 30, type: 'stone' },
                // High platforms
                { x: 60,   y: 300, w: 75,  h: 16, type: 'dirt'  },
                { x: 220,  y: 260, w: 75,  h: 16, type: 'stone' },
                { x: 350,  y: 300, w: 65,  h: 16, type: 'grass' },
                { x: 480,  y: 240, w: 65,  h: 16, type: 'stone' },
                { x: 600,  y: 300, w: 65,  h: 16, type: 'dirt'  },
                { x: 720,  y: 250, w: 65,  h: 16, type: 'grass' },
                { x: 840,  y: 200, w: 65,  h: 16, type: 'stone' },
                { x: 970,  y: 260, w: 65,  h: 16, type: 'dirt'  },
                { x: 1090, y: 220, w: 65,  h: 16, type: 'grass' },
                { x: 1220, y: 280, w: 65,  h: 16, type: 'stone' },
                { x: 1360, y: 230, w: 65,  h: 16, type: 'dirt'  },
                { x: 1490, y: 190, w: 65,  h: 16, type: 'stone' },
                { x: 1610, y: 240, w: 65,  h: 16, type: 'grass' },
                { x: 1730, y: 300, w: 65,  h: 16, type: 'dirt'  },
                { x: 1860, y: 240, w: 65,  h: 16, type: 'stone' },
                { x: 1990, y: 300, w: 65,  h: 16, type: 'grass' },
                { x: 2140, y: 250, w: 80,  h: 16, type: 'dirt'  },
                { x: 2280, y: 310, w: 80,  h: 16, type: 'stone' },
                // Moving
                { x: 170,  y: 190, w: 70,  h: 16, type: 'stone', moving: true, moveRange: 80,  moveSpeed: 1.8 * SM, _t: 0 },
                { x: 750,  y: 160, w: 70,  h: 16, type: 'dirt',  moving: true, moveRange: 100, moveSpeed: 2.0 * SM, _t: 1.2 },
                { x: 1450, y: 150, w: 70,  h: 16, type: 'stone', moving: true, moveRange: 90,  moveSpeed: 1.9 * SM, _t: 0.5 },
            ],
            stars: [
                { x: 95,   y: 280 }, { x: 260,  y: 240 }, { x: 485,  y: 220 },
                { x: 725,  y: 230 }, { x: 875,  y: 180 }, { x: 1095, y: 200 },
                { x: 1395, y: 210 }, { x: 1530, y: 170 }, { x: 1865, y: 220 },
                { x: 2180, y: 230 }
            ],
            enemies: [
                { type: 'walker', x: 360,  y: GROUND_Y - 26, dir: 1,  platform: { x: 340,  y: GROUND_Y, w: 120 }, speed: 1.7 * SM },
                { type: 'walker', x: 600,  y: GROUND_Y - 26, dir: -1, platform: { x: 580,  y: GROUND_Y, w: 120 }, speed: 1.7 * SM },
                { type: 'walker', x: 840,  y: GROUND_Y - 26, dir: 1,  platform: { x: 820,  y: GROUND_Y, w: 120 }, speed: 1.8 * SM },
                { type: 'walker', x: 1360, y: GROUND_Y - 26, dir: -1, platform: { x: 1340, y: GROUND_Y, w: 120 }, speed: 1.9 * SM },
                { type: 'jumper', x: 845,  y: 184, jumpTimer: 30, jumpInterval: 90, vy: 0, onGround: true, baseY: 184, platform: { x: 840, y: 200, w: 65 } },
                { type: 'jumper', x: 1495, y: 174, jumpTimer: 60, jumpInterval: 85, vy: 0, onGround: true, baseY: 174, platform: { x: 1490, y: 190, w: 65 } },
            ],
            exit: { x: 2310, y: GROUND_Y - DOOR_H }
        };

        // ── LEVEL 5: Long level, all enemies, precision needed ─
        const lv5 = {
            platforms: [
                { x: 0,    y: GROUND_Y, w: 200,  h: 30, type: 'grass' },
                { x: 320,  y: GROUND_Y, w: 100,  h: 30, type: 'stone' },
                { x: 540,  y: GROUND_Y, w: 100,  h: 30, type: 'grass' },
                { x: 760,  y: GROUND_Y, w: 100,  h: 30, type: 'stone' },
                { x: 980,  y: GROUND_Y, w: 100,  h: 30, type: 'grass' },
                { x: 1200, y: GROUND_Y, w: 100,  h: 30, type: 'dirt'  },
                { x: 1440, y: GROUND_Y, w: 100,  h: 30, type: 'stone' },
                { x: 1680, y: GROUND_Y, w: 100,  h: 30, type: 'grass' },
                { x: 1920, y: GROUND_Y, w: 100,  h: 30, type: 'stone' },
                { x: 2160, y: GROUND_Y, w: 300,  h: 30, type: 'grass' },
                // Upper tier platforms
                { x: 80,   y: 310, w: 70,  h: 16, type: 'dirt'  },
                { x: 210,  y: 260, w: 70,  h: 16, type: 'stone' },
                { x: 330,  y: 300, w: 65,  h: 16, type: 'grass' },
                { x: 440,  y: 240, w: 65,  h: 16, type: 'stone' },
                { x: 560,  y: 300, w: 65,  h: 16, type: 'dirt'  },
                { x: 670,  y: 250, w: 65,  h: 16, type: 'grass' },
                { x: 780,  y: 200, w: 65,  h: 16, type: 'stone' },
                { x: 890,  y: 270, w: 60,  h: 16, type: 'dirt'  },
                { x: 1000, y: 220, w: 60,  h: 16, type: 'grass' },
                { x: 1110, y: 280, w: 60,  h: 16, type: 'stone' },
                { x: 1220, y: 220, w: 60,  h: 16, type: 'dirt'  },
                { x: 1330, y: 280, w: 60,  h: 16, type: 'grass' },
                { x: 1460, y: 230, w: 60,  h: 16, type: 'stone' },
                { x: 1570, y: 190, w: 60,  h: 16, type: 'dirt'  },
                { x: 1700, y: 250, w: 60,  h: 16, type: 'grass' },
                { x: 1810, y: 200, w: 60,  h: 16, type: 'stone' },
                { x: 1940, y: 260, w: 60,  h: 16, type: 'dirt'  },
                { x: 2050, y: 210, w: 60,  h: 16, type: 'grass' },
                { x: 2170, y: 270, w: 70,  h: 16, type: 'stone' },
                { x: 2290, y: 310, w: 80,  h: 16, type: 'grass' },
                // Moving
                { x: 260,  y: 230, w: 65,  h: 16, type: 'stone', moving: true, moveRange: 70,  moveSpeed: 1.8 * SM, _t: 0 },
                { x: 700,  y: 170, w: 65,  h: 16, type: 'dirt',  moving: true, moveRange: 80,  moveSpeed: 2.2 * SM, _t: 0.7 },
                { x: 1140, y: 170, w: 60,  h: 16, type: 'stone', moving: true, moveRange: 75,  moveSpeed: 2.0 * SM, _t: 1.4 },
                { x: 1620, y: 160, w: 60,  h: 16, type: 'dirt',  moving: true, moveRange: 85,  moveSpeed: 2.3 * SM, _t: 0.3 },
            ],
            stars: [
                { x: 115,  y: 290 }, { x: 250,  y: 240 }, { x: 475,  y: 220 },
                { x: 705,  y: 230 }, { x: 820,  y: 180 }, { x: 1045, y: 200 },
                { x: 1505, y: 210 }, { x: 1610, y: 170 }, { x: 2090, y: 190 },
                { x: 2320, y: 290 }
            ],
            enemies: [
                { type: 'walker', x: 340,  y: GROUND_Y - 26, dir: 1,  platform: { x: 320,  y: GROUND_Y, w: 100 }, speed: 1.6 * SM },
                { type: 'walker', x: 560,  y: GROUND_Y - 26, dir: -1, platform: { x: 540,  y: GROUND_Y, w: 100 }, speed: 1.8 * SM },
                { type: 'walker', x: 1000, y: GROUND_Y - 26, dir: 1,  platform: { x: 980,  y: GROUND_Y, w: 100 }, speed: 2.0 * SM },
                { type: 'walker', x: 1460, y: GROUND_Y - 26, dir: -1, platform: { x: 1440, y: GROUND_Y, w: 100 }, speed: 2.2 * SM },
                { type: 'walker', x: 1700, y: GROUND_Y - 26, dir: 1,  platform: { x: 1680, y: GROUND_Y, w: 100 }, speed: 2.0 * SM },
                { type: 'jumper', x: 785,  y: 184, jumpTimer: 20, jumpInterval: 90, vy: 0, onGround: true, baseY: 184, platform: { x: 780, y: 200, w: 65 } },
                { type: 'jumper', x: 1005, y: 204, jumpTimer: 45, jumpInterval: 95, vy: 0, onGround: true, baseY: 204, platform: { x: 1000, y: 220, w: 60 } },
                { type: 'jumper', x: 1575, y: 174, jumpTimer: 10, jumpInterval: 85, vy: 0, onGround: true, baseY: 174, platform: { x: 1570, y: 190, w: 60 } },
            ],
            exit: { x: 2310, y: GROUND_Y - DOOR_H }
        };

        return [lv1, lv2, lv3, lv4, lv5];
    }

    // ── Player ────────────────────────────────────────────────
    let player;
    function createPlayer() {
        return {
            x: 80, y: 310,
            vx: 0, vy: 0,
            w: PLAYER_W, h: PLAYER_H,
            onGround: false,
            jumpsLeft: 2,
            facingRight: true,
            legAnim: 0,
            isDead: false,
            invincible: 0,    // frames of invincibility after hit
        };
    }

    // ── Active level data ─────────────────────────────────────
    let platforms = [], stars = [], enemies = [], exit = null;
    let starsCollected = 0;

    function loadLevel(idx) {
        const allLevels = makeLevels(speedMultiplier);
        const lvData = allLevels[idx % 5];

        // Deep-copy so mutation doesn't break level restarts
        platforms = lvData.platforms.map(p => ({ ...p, _origX: p.x }));
        stars = lvData.stars.map(s => ({ ...s, collected: false }));
        enemies = lvData.enemies.map(e => ({ ...e }));
        exit = { ...lvData.exit };
        starsCollected = 0;
        camX = 0;

        // Position player
        player = createPlayer();
        deathCooldown = 0;
        particles = [];
        floaters = [];
    }

    // ── AABB collision ────────────────────────────────────────
    function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // ── Player physics & collision ────────────────────────────
    function updatePlayer() {
        if (deathCooldown > 0) { deathCooldown--; return; }
        if (player.isDead) return;

        // Horizontal input
        const leftPressed  = keys['ArrowLeft']  || keys['KeyA'] || touch.left;
        const rightPressed = keys['ArrowRight'] || keys['KeyD'] || touch.right;

        if (leftPressed)  { player.vx -= MOVE_ACCEL; player.facingRight = false; }
        if (rightPressed) { player.vx += MOVE_ACCEL; player.facingRight = true; }
        if (!leftPressed && !rightPressed) { player.vx *= MOVE_DECEL; }
        player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

        // Jump
        const jumpPressed = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touch.jump;
        if (jumpPressed && !player._prevJump) {
            if (player.onGround || player.jumpsLeft > 0) {
                if (!player.onGround && player.jumpsLeft === 2) {
                    player.jumpsLeft = 1; // first jump pressed from ground skipped
                }
                if (player.jumpsLeft === 2) {
                    player.vy = JUMP_POWER;
                    player.jumpsLeft = 1;
                } else if (player.jumpsLeft === 1 && !player.onGround) {
                    player.vy = DOUBLE_JUMP_POWER;
                    player.jumpsLeft = 0;
                } else if (player.onGround) {
                    player.vy = JUMP_POWER;
                    player.jumpsLeft = 1;
                }
                if (typeof GameAudio !== 'undefined') GameAudio.jump();
            }
        }
        player._prevJump = jumpPressed;

        // Gravity
        player.vy += GRAVITY;
        player.vy = Math.min(player.vy, 18);

        // Move X
        player.x += player.vx;

        // Clamp to world
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.w > WORLD_W) { player.x = WORLD_W - player.w; player.vx = 0; }

        // Resolve platform collisions X
        for (const p of platforms) {
            const px = p.moving ? p._curX : p.x;
            if (rectOverlap(player.x, player.y, player.w, player.h, px, p.y, p.w, p.h)) {
                if (player.vx > 0) { player.x = px - player.w; player.vx = 0; }
                else if (player.vx < 0) { player.x = px + p.w; player.vx = 0; }
            }
        }

        // Move Y
        player.onGround = false;
        player.y += player.vy;

        // Resolve platform collisions Y
        for (const p of platforms) {
            const px = p.moving ? p._curX : p.x;
            if (rectOverlap(player.x, player.y, player.w, player.h, px, p.y, p.w, p.h)) {
                if (player.vy > 0) {
                    // Landing on top
                    player.y = p.y - player.h;
                    player.vy = 0;
                    player.onGround = true;
                    player.jumpsLeft = 2;
                    // Carry player on moving platform
                    if (p.moving) player.x += p._vel || 0;
                } else if (player.vy < 0) {
                    // Hit from below
                    player.y = p.y + p.h;
                    player.vy = 0;
                }
            }
        }

        // Fell into a pit
        if (player.y > H + 60) {
            killPlayer();
            return;
        }

        // Invincibility countdown
        if (player.invincible > 0) player.invincible--;

        // Leg animation
        if (Math.abs(player.vx) > 0.5) {
            player.legAnim += Math.abs(player.vx) * 0.18;
        }
    }

    function killPlayer() {
        if (player.isDead) return;
        player.isDead = true;
        spawnDeathParticles(player.x + player.w / 2, player.y + player.h / 2);
        if (typeof GameAudio !== 'undefined') GameAudio.gameOver();
        lives--;
        updateHUD();
        deathCooldown = 90;

        if (lives <= 0) {
            // Game over after cooldown
            setTimeout(() => {
                endGame();
            }, 1500);
        } else {
            setTimeout(() => {
                // Respawn
                player = createPlayer();
                deathCooldown = 0;
            }, 1500);
        }
    }

    // ── Moving platforms ──────────────────────────────────────
    function updatePlatforms() {
        for (const p of platforms) {
            if (!p.moving) continue;
            p._t = (p._t || 0) + (p.moveSpeed / 60);
            const offset = Math.sin(p._t) * p.moveRange;
            const newX = p._origX + offset;
            p._vel = newX - (p._curX !== undefined ? p._curX : p._origX);
            p._curX = newX;
        }
    }

    // ── Enemies ───────────────────────────────────────────────
    function updateEnemies() {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (e.dead) continue;

            if (e.type === 'walker') {
                e.x += e.speed * e.dir;
                e.legAnim = (e.legAnim || 0) + e.speed * 0.15;
                // Bounce at platform edges
                if (e.x <= e.platform.x) { e.x = e.platform.x; e.dir = 1; }
                if (e.x + 26 >= e.platform.x + e.platform.w) {
                    e.x = e.platform.x + e.platform.w - 26;
                    e.dir = -1;
                }
                e.y = e.platform.y - 26;

            } else if (e.type === 'jumper') {
                e.jumpTimer = (e.jumpTimer || 0) + 1;
                if (e.onGround && e.jumpTimer >= e.jumpInterval) {
                    e.vy = -9;
                    e.onGround = false;
                    e.jumpTimer = 0;
                }
                e.vy = (e.vy || 0) + GRAVITY * 0.8;
                e.y += e.vy;
                if (e.y >= e.baseY) {
                    e.y = e.baseY;
                    e.vy = 0;
                    e.onGround = true;
                }
            }

            // Check player collision
            if (!player.isDead && player.invincible === 0) {
                const eW = e.type === 'walker' ? 26 : 22;
                const eH = e.type === 'walker' ? 26 : 28;
                if (rectOverlap(player.x, player.y, player.w, player.h, e.x, e.y, eW, eH)) {
                    // Stomp? Player falling onto top of enemy
                    const playerBottom = player.y + player.h;
                    const enemyTop = e.y;
                    if (player.vy > 0 && playerBottom <= enemyTop + 10) {
                        // Kill enemy
                        spawnEnemyParticles(e.x + eW / 2, e.y + eH / 2, e.type === 'walker' ? '#ef5350' : '#ce93d8');
                        if (typeof GameAudio !== 'undefined') GameAudio.score();
                        score += 50;
                        addFloater(e.x + eW / 2, e.y - 10, '+50', '#ffd700');
                        enemies.splice(i, 1);
                        player.vy = -8; // Bounce
                        player.jumpsLeft = 2;
                        updateHUD();
                    } else {
                        // Take damage
                        player.invincible = 80;
                        lives--;
                        updateHUD();
                        if (typeof GameAudio !== 'undefined') GameAudio.gameOver();
                        if (lives <= 0) {
                            player.isDead = true;
                            spawnDeathParticles(player.x + player.w / 2, player.y + player.h / 2);
                            setTimeout(endGame, 1500);
                        } else {
                            // Knock back
                            player.vx = player.facingRight ? -6 : 6;
                            player.vy = -7;
                        }
                    }
                }
            }
        }
    }

    // ── Stars ─────────────────────────────────────────────────
    function updateStars() {
        for (const s of stars) {
            if (s.collected) continue;
            if (rectOverlap(player.x, player.y, player.w, player.h,
                            s.x - STAR_SIZE / 2, s.y - STAR_SIZE / 2, STAR_SIZE, STAR_SIZE)) {
                s.collected = true;
                starsCollected++;
                score += 10;
                spawnStarParticles(s.x, s.y);
                if (typeof GameAudio !== 'undefined') GameAudio.score();
                addFloater(s.x, s.y - 10, '+10', '#ffd700');
                if (starsCollected === 10) {
                    score += 200;
                    if (typeof GameAudio !== 'undefined') GameAudio.scoreHigh();
                    addFloater(s.x, s.y - 30, 'BONUS +200!', '#ffd700');
                }
                updateHUD();
            }
        }
    }

    // ── Exit door ─────────────────────────────────────────────
    function updateExit() {
        if (!exit) return;
        if (rectOverlap(player.x, player.y, player.w, player.h,
                        exit.x, exit.y, DOOR_W, DOOR_H)) {
            if (typeof GameAudio !== 'undefined') GameAudio.win();
            completedLevel();
        }
    }

    function completedLevel() {
        levelTransition = true;
        gameRunning = false;

        const isLoop = currentLevel >= 4;
        const nextLvl = isLoop ? 0 : currentLevel + 1;
        if (isLoop) speedMultiplier = Math.min(speedMultiplier + 0.3, 2.5);

        levelTitle.textContent = isLoop ? 'Loop completado!' : `Nivel ${currentLevel + 1} completado!`;
        levelMsg.textContent = `Puntos: ${score}  |  Vidas: ${lives}`;
        levelPopup.style.display = 'block';

        setTimeout(() => {
            levelPopup.style.display = 'none';
            currentLevel = nextLvl;
            loadLevel(currentLevel);
            updateHUD();
            gameRunning = true;
            levelTransition = false;
            lastTime = performance.now();
            requestAnimationFrame(loop);
        }, 2500);
    }

    // ── Camera ────────────────────────────────────────────────
    function updateCamera() {
        const targetX = player.x - W * 0.35;
        camX += (targetX - camX) * 0.1;
        camX = Math.max(0, Math.min(WORLD_W - W, camX));
    }

    // ── Background parallax ───────────────────────────────────
    // Pre-generated mountain & tree data (deterministic so no Math.random in render)
    const bgMountains = (function () {
        const arr = [];
        // Far layer — large triangles
        const seeds = [80,250,420,590,760,930,1100,1270,1440,1610,1780,1950,2120,2300];
        for (let i = 0; i < seeds.length; i++) {
            arr.push({ x: seeds[i], h: 60 + (i * 23) % 80, w: 90 + (i * 37) % 60 });
        }
        return arr;
    })();

    const bgTrees = (function () {
        const arr = [];
        const seeds = [50,130,200,310,380,460,540,630,700,800,880,960,1040,1120,1200,1300,1400,1480,1560,1640,1720,1800,1900,1980,2060,2140,2220];
        for (let i = 0; i < seeds.length; i++) {
            arr.push({ x: seeds[i], h: 30 + (i * 17) % 30 });
        }
        return arr;
    })();

    function drawBackground() {
        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1a1a3e');
        grad.addColorStop(0.6, '#2d2b70');
        grad.addColorStop(1, '#4a3080');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Far mountains (parallax 0.3)
        const mOff = camX * 0.3;
        ctx.fillStyle = '#2e2b60';
        for (const m of bgMountains) {
            const sx = m.x - mOff;
            const drawX = ((sx % (WORLD_W * 0.3 + W)) + W) % (WORLD_W * 0.3 + W) - W;
            ctx.beginPath();
            ctx.moveTo(drawX, GROUND_Y);
            ctx.lineTo(drawX + m.w / 2, GROUND_Y - m.h);
            ctx.lineTo(drawX + m.w, GROUND_Y);
            ctx.closePath();
            ctx.fill();
        }

        // Near trees (parallax 0.6)
        const tOff = camX * 0.6;
        ctx.fillStyle = '#1b3a2b';
        for (const t of bgTrees) {
            const sx = t.x - tOff;
            const drawX = ((sx % (WORLD_W * 0.6 + W)) + W) % (WORLD_W * 0.6 + W) - W;
            // trunk
            ctx.fillRect(drawX + 5, GROUND_Y - 12, 6, 12);
            // foliage triangle
            ctx.beginPath();
            ctx.moveTo(drawX, GROUND_Y - 12);
            ctx.lineTo(drawX + 8, GROUND_Y - 12 - t.h);
            ctx.lineTo(drawX + 16, GROUND_Y - 12);
            ctx.closePath();
            ctx.fill();
        }
    }

    // ── Platform rendering ────────────────────────────────────
    function drawPlatform(p) {
        const px = p.moving ? p._curX : p.x;
        const sx = px - camX;
        if (sx + p.w < 0 || sx > W) return;

        if (p.type === 'grass') {
            ctx.fillStyle = '#5c3d1e';
            ctx.fillRect(sx, p.y + 4, p.w, p.h - 4);
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(sx, p.y, p.w, 5);
        } else if (p.type === 'stone') {
            ctx.fillStyle = '#546e7a';
            ctx.fillRect(sx, p.y, p.w, p.h);
            ctx.fillStyle = '#607d8b';
            ctx.fillRect(sx, p.y, p.w, 4);
            // stone line detail
            ctx.fillStyle = '#455a64';
            const segW = 20;
            for (let i = 0; i < p.w / segW; i++) {
                ctx.fillRect(sx + i * segW, p.y + p.h / 2, segW - 1, 1);
            }
        } else { // dirt
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(sx, p.y, p.w, p.h);
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(sx, p.y, p.w, 3);
        }
    }

    // ── Star rendering ────────────────────────────────────────
    function drawStar5(cx, cy, outerR, innerR, t) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const sx2 = cx + Math.cos(angle) * r;
            const sy2 = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(sx2, sy2);
            else ctx.lineTo(sx2, sy2);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Precompute star bob offsets using index
    const starBobPhases = Array.from({length:10}, (_, i) => i * 0.63);

    function drawStars(t) {
        ctx.fillStyle = '#ffd700';
        let si = 0;
        for (const s of stars) {
            if (s.collected) { si++; continue; }
            const sx = s.x - camX;
            if (sx < -20 || sx > W + 20) { si++; continue; }
            const bob = Math.sin(t * 0.003 + starBobPhases[si % 10]) * 3;
            drawStar5(sx, s.y + bob, STAR_SIZE / 2, STAR_SIZE / 4, t);
            si++;
        }
    }

    // ── Enemy rendering ───────────────────────────────────────
    function drawWalker(e, t) {
        const sx = e.x - camX;
        if (sx < -30 || sx > W + 30) return;
        const legSwing = Math.sin(e.legAnim) * 4;

        // Body
        ctx.fillStyle = '#ef5350';
        ctx.beginPath();
        ctx.roundRect(sx, e.y, 26, 22, 5);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sx, e.y, 26, 22, 5);
        ctx.stroke();

        // Eyes — angry slant
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 4,  e.y + 5, 7, 6);
        ctx.fillRect(sx + 15, e.y + 5, 7, 6);
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 6,  e.y + 7, 3, 3);
        ctx.fillRect(sx + 17, e.y + 7, 3, 3);
        // Angry brow
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + 3,  e.y + 4);
        ctx.lineTo(sx + 11, e.y + 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + 14, e.y + 7);
        ctx.lineTo(sx + 22, e.y + 4);
        ctx.stroke();

        // Legs
        ctx.fillStyle = '#c62828';
        ctx.fillRect(sx + 4,  e.y + 22, 7, 4 + legSwing);
        ctx.fillRect(sx + 15, e.y + 22, 7, 4 - legSwing);
    }

    function drawJumper(e, t) {
        const sx = e.x - camX;
        if (sx < -30 || sx > W + 30) return;
        const squish = e.onGround ? 1.15 : 0.9;
        const squishY = e.onGround ? 0.87 : 1.1;

        ctx.save();
        ctx.translate(sx + 11, e.y + 14);
        ctx.scale(squish, squishY);

        // Body blob
        ctx.fillStyle = '#ab47bc';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6a1b9a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(-7, -4, 5, 5);
        ctx.fillRect(2,  -4, 5, 5);
        ctx.fillStyle = '#333';
        ctx.fillRect(-6, -3, 3, 3);
        ctx.fillRect(3,  -3, 3, 3);

        ctx.restore();

        // Spring coil at bottom
        ctx.strokeStyle = '#7b1fa2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const springY = e.y + 22;
        for (let i = 0; i < 3; i++) {
            ctx.moveTo(sx + 2  + i * 8, springY);
            ctx.lineTo(sx + 8  + i * 8, springY + 5);
        }
        ctx.stroke();
    }

    // ── Exit door rendering ───────────────────────────────────
    function drawExitDoor(t) {
        if (!exit) return;
        const sx = exit.x - camX;
        if (sx < -40 || sx > W + 40) return;
        const allStars = starsCollected >= 10;
        const glow = allStars ? (0.5 + 0.5 * Math.sin(t * 0.005)) : 0;

        // Door frame
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(sx, exit.y, DOOR_W, DOOR_H);

        // Arch top
        ctx.fillStyle = allStars ? `rgba(255,215,0,${0.6 + glow * 0.4})` : '#4e342e';
        ctx.beginPath();
        ctx.arc(sx + DOOR_W / 2, exit.y + 2, DOOR_W / 2, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();

        // Door face
        ctx.fillStyle = allStars ? `rgba(100,220,100,${0.85})` : '#388e3c';
        ctx.fillRect(sx + 3, exit.y + DOOR_W / 2, DOOR_W - 6, DOOR_H - DOOR_W / 2);

        // Door knob
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(sx + DOOR_W - 8, exit.y + DOOR_H * 0.62, 3, 0, Math.PI * 2);
        ctx.fill();

        // Glow aura
        if (allStars) {
            ctx.globalAlpha = 0.25 + glow * 0.2;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(sx + DOOR_W / 2, exit.y + DOOR_H / 2, DOOR_W, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ── Player rendering ──────────────────────────────────────
    function drawPlayer(t) {
        if (player.isDead) return;

        // Blink when invincible
        if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) return;

        const sx = player.x - camX;
        const legSwing = Math.sin(player.legAnim) * 5;
        const isMoving = Math.abs(player.vx) > 0.5;
        const flip = player.facingRight ? 1 : -1;

        ctx.save();
        ctx.translate(sx + player.w / 2, player.y + player.h / 2);
        ctx.scale(flip, 1);

        // Legs
        ctx.fillStyle = '#006064';
        if (isMoving) {
            ctx.fillRect(-8, 10, 6, 8 + legSwing);
            ctx.fillRect(2,  10, 6, 8 - legSwing);
        } else {
            ctx.fillRect(-8, 10, 6, 8);
            ctx.fillRect(2,  10, 6, 8);
        }

        // Body
        ctx.fillStyle = '#26c6da';
        ctx.beginPath();
        ctx.roundRect(-player.w / 2, -player.h / 2, player.w, player.h - 8, 5);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#00838f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-player.w / 2, -player.h / 2, player.w, player.h - 8, 5);
        ctx.stroke();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(2, -6, 6, 5);
        ctx.fillStyle = '#1a237e';
        ctx.fillRect(5, -5, 3, 3);

        ctx.restore();
    }

    // ── HUD ───────────────────────────────────────────────────
    function drawHUD() {
        // Score
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(4, 4, 180, 28);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${score}  Best: ${highScore}`, 10, 22);

        // Lives + level + stars
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(4, 36, 220, 28);
        ctx.fillStyle = '#fff';
        ctx.fillText(`Lives: ${lives}  Lvl: ${currentLevel + 1}  Stars: ${starsCollected}/10`, 10, 54);
    }

    // ── On-canvas touch D-pad ────────────────────────────────
    const DPAD = {
        left:  { cx: 50,  cy: H - 50, r: 28 },
        right: { cx: 115, cy: H - 50, r: 28 },
        jump:  { cx: W - 55, cy: H - 55, r: 34 }
    };

    function drawDpad() {
        // Only shown when no pointer (we detect touch via events)
        // Always draw on mobile-ish screens
        if (window.innerWidth >= 900 && !('ontouchstart' in window)) return;

        const btns = [
            { ...DPAD.left,  label: '<', active: touch.left,  color: '#26c6da' },
            { ...DPAD.right, label: '>', active: touch.right, color: '#26c6da' },
            { ...DPAD.jump,  label: 'A', active: touch.jump,  color: '#ff512f' },
        ];
        for (const b of btns) {
            ctx.globalAlpha = b.active ? 0.75 : 0.4;
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${b.label === 'A' ? 20 : 22}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.label, b.cx, b.cy);
            ctx.textBaseline = 'alphabetic';
        }
        ctx.textAlign = 'left';
    }

    function getCanvasPoint(e, idx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const t = e.touches[idx];
        return {
            x: (t.clientX - rect.left) * scaleX,
            y: (t.clientY - rect.top)  * scaleY
        };
    }

    function inCircle(px, py, cx, cy, r) {
        return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
    }

    function processTouches(e) {
        touch.left = false; touch.right = false; touch.jump = false;
        for (let i = 0; i < e.touches.length; i++) {
            const p = getCanvasPoint(e, i);
            if (inCircle(p.x, p.y, DPAD.left.cx, DPAD.left.cy, DPAD.left.r))   touch.left  = true;
            if (inCircle(p.x, p.y, DPAD.right.cx, DPAD.right.cy, DPAD.right.r)) touch.right = true;
            if (inCircle(p.x, p.y, DPAD.jump.cx, DPAD.jump.cy, DPAD.jump.r))    touch.jump  = true;
        }
    }

    canvas.addEventListener('touchstart',  e => { e.preventDefault(); processTouches(e); }, { passive: false });
    canvas.addEventListener('touchmove',   e => { e.preventDefault(); processTouches(e); }, { passive: false });
    canvas.addEventListener('touchend',    e => { e.preventDefault(); processTouches(e); }, { passive: false });
    canvas.addEventListener('touchcancel', e => { e.preventDefault(); touch.left = false; touch.right = false; touch.jump = false; }, { passive: false });

    // ── Main loop ─────────────────────────────────────────────
    function loop(ts) {
        if (!gameRunning) return;
        const dt = ts - lastTime;
        lastTime = ts;
        if (dt > 100) { rafId = requestAnimationFrame(loop); return; } // skip big gaps

        updatePlatforms();
        updatePlayer();
        if (!player.isDead) {
            updateEnemies();
            updateStars();
            updateExit();
        }
        updateCamera();
        updateParticles();
        updateFloaters();

        // Draw
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        for (const p of platforms) drawPlatform(p);
        drawStars(ts);
        for (const e of enemies) {
            if (e.dead) continue;
            if (e.type === 'walker') drawWalker(e, ts);
            else drawJumper(e, ts);
        }
        drawExitDoor(ts);
        drawPlayer(ts);
        drawParticles();
        drawFloaters();
        drawHUD();
        drawDpad();

        rafId = requestAnimationFrame(loop);
    }

    // ── HUD updates ───────────────────────────────────────────
    function updateHUD() {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('platformerHigh', highScore);
        }
        if (scoreEl) scoreEl.textContent = score;
        if (highScoreEl) highScoreEl.textContent = highScore;
        if (livesEl) livesEl.textContent = lives;
        if (levelEl) levelEl.textContent = currentLevel + 1;
        if (starsEl) starsEl.textContent = `${starsCollected}/10`;
        if (mobileScoreEl) mobileScoreEl.textContent = `Pts: ${score} | Vidas: ${lives} | Lvl: ${currentLevel + 1}`;
    }

    // ── Start / End / Restart ─────────────────────────────────
    function startGame() {
        score = 0;
        lives = 3;
        currentLevel = 0;
        speedMultiplier = 1;
        particles = [];
        floaters = [];
        levelTransition = false;

        loadLevel(currentLevel);
        updateHUD();

        gameOverPopup.style.display = 'none';
        levelPopup.style.display = 'none';
        gameRunning = true;

        if (typeof GameAudio !== 'undefined') GameAudio.start();

        lastTime = performance.now();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);

        startBtn.disabled = true;
        restartBtn.disabled = false;
    }

    function endGame() {
        gameRunning = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('platformerHigh', highScore);
        }
        updateHUD();

        finalScoreEl.textContent = `Puntos: ${score}`;
        finalHighEl.textContent  = score >= highScore ? 'Nuevo record!' : `Mejor: ${highScore}`;
        gameOverPopup.style.display = 'flex';

        startBtn.disabled = false;
        restartBtn.disabled = true;
    }

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', () => {
        gameOverPopup.style.display = 'none';
        startGame();
    });

    // Show high score on load
    if (highScoreEl) highScoreEl.textContent = highScore;

    // Draw a still welcome screen
    (function drawWelcome() {
        ctx.clearRect(0, 0, W, H);
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1a1a3e');
        grad.addColorStop(1, '#4a3080');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#26c6da';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PLATFORMER', W / 2, H / 2 - 30);

        ctx.fillStyle = '#ffd700';
        ctx.font = '18px Arial';
        ctx.fillText('Presiona Iniciar para jugar', W / 2, H / 2 + 20);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '13px Arial';
        ctx.fillText('A/D o Flechas — mover   |   Espacio/W — saltar (doble salto)', W / 2, H / 2 + 55);
        ctx.textAlign = 'left';
    })();

})();

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
    const AIR_CONTROL = 0.65;     // fraction of accel while airborne
    const COYOTE_FRAMES = 7;      // grace frames to jump after leaving a ledge
    const BUFFER_FRAMES = 7;      // grace frames for jump pressed just before landing
    const SPIN_FRAMES = 18;       // double-jump flip animation length
    const WORLD_W = 2400;
    const GROUND_Y = 370;
    const PLAYER_W = 20, PLAYER_H = 28;
    const STAR_SIZE = 14;
    const DOOR_W = 36, DOOR_H = 54;

    // ── State ────────────────────────────────────────────────
    let gameRunning = false;
    let score = 0;
    let highScore = GameStore.getNum('platformerHigh', 0);
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
    const particles = new Particles(260);   // pooled, see game-utils.js

    function spawnDeathParticles(x, y) {
        const colors = ['#26c6da','#80deea','#ff8a65','#ffcc02','#ef5350'];
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 / 24) * i + (Math.random() - 0.5) * 0.4;
            const speed = 2 + Math.random() * 5;
            const decay = 0.03 + Math.random() * 0.025;
            particles.add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2, {
                life: 1 / (decay * 60), size: 4 + Math.random() * 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity: 0.18, shape: 'square'
            });
        }
    }

    function spawnStarParticles(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            const decay = 0.04 + Math.random() * 0.03;
            particles.add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 1.5, {
                life: 1 / (decay * 60), size: 3 + Math.random() * 4,
                color: '#ffd700', gravity: 0.18, shape: 'square'
            });
        }
    }

    function spawnEnemyParticles(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3.5;
            const decay = 0.035 + Math.random() * 0.03;
            particles.add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2, {
                life: 1 / (decay * 60), size: 4 + Math.random() * 5,
                color: color, gravity: 0.18, shape: 'square'
            });
        }
    }

    function updateParticles() { particles.update(); }

    function drawParticles() {
        /* Particles live in world space; the camera offset that used to be
           subtracted per particle is now one translate. */
        ctx.translate(-camX, 0);
        particles.draw(ctx);
        ctx.translate(camX, 0);
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
                { type: 'flyer', x: 430, x1: 420, x2: 580, baseY: 160, amp: 26, dir: 1, t: 0, speed: 1.1 * SM },
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
                { type: 'flyer', x: 1390, x1: 1380, x2: 1560, baseY: 170, amp: 32, dir: 1, t: 0.8, speed: 1.3 * SM },
                { type: 'flyer', x: 1790, x1: 1780, x2: 1960, baseY: 190, amp: 26, dir: -1, t: 2.1, speed: 1.2 * SM },
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
                { type: 'flyer', x: 1210, x1: 1200, x2: 1330, baseY: 160, amp: 34, dir: 1, t: 0, speed: 1.5 * SM },
                { type: 'flyer', x: 1950, x1: 1940, x2: 2090, baseY: 180, amp: 30, dir: -1, t: 1.4, speed: 1.6 * SM },
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
                { type: 'flyer', x: 220, x1: 210, x2: 400, baseY: 170, amp: 30, dir: 1, t: 0, speed: 1.4 * SM },
                { type: 'flyer', x: 1130, x1: 1120, x2: 1310, baseY: 150, amp: 36, dir: 1, t: 1, speed: 1.7 * SM },
                { type: 'flyer', x: 1830, x1: 1820, x2: 2030, baseY: 160, amp: 32, dir: -1, t: 2, speed: 1.8 * SM },
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
            jumpsLeft: 1,      // extra air jumps available
            facingRight: true,
            legAnim: 0,
            isDead: false,
            invincible: 0,     // frames of invincibility after hit
            coyote: 0,         // coyote-time frames left
            jumpBuffer: 0,     // buffered jump frames left
            squashX: 1, squashY: 1,  // squash & stretch scales
            spin: 0,           // double-jump flip frames left
            dustTimer: 0,
        };
    }

    function spawnDust(x, y, n) {
        for (let i = 0; i < n; i++) {
            /* alpha 0.8 reproduces the old `life: 0.8` peak opacity */
            const decay = 0.05 + Math.random() * 0.04;
            particles.add(x + (Math.random() - 0.5) * 10, y,
                (Math.random() - 0.5) * 2.2, -Math.random() * 1.6, {
                life: 0.8 / (decay * 60), alpha: 0.8, size: 2 + Math.random() * 3,
                color: Math.random() < 0.5 ? '#9e8c70' : '#bcaa88',
                gravity: 0.18, shape: 'square'
            });
        }
    }

    // ── Active level data ─────────────────────────────────────
    let platforms = [], stars = [], enemies = [], exit = null;
    let starsCollected = 0;

    function loadLevel(idx) {
        const allLevels = makeLevels(speedMultiplier);
        const lvData = allLevels[idx % 5];

        // Deep-copy so mutation doesn't break level restarts
        platforms = lvData.platforms.map(p => {
            const copy = { ...p, _origX: p.x };
            // Precompute decorative details (never Math.random in render)
            if (p.type === 'grass') {
                copy._tufts = [];
                for (let tx = 8; tx < p.w - 6; tx += 13 + Math.floor(Math.random() * 9)) {
                    copy._tufts.push({ dx: tx, h: 3 + Math.random() * 3, lean: Math.random() * 2 - 1 });
                }
            } else if (p.type === 'dirt' || p.type === 'stone') {
                copy._specks = [];
                const n = Math.floor(p.w / 18);
                for (let si = 0; si < n; si++) {
                    copy._specks.push({
                        dx: 4 + Math.random() * (p.w - 8),
                        dy: 6 + Math.random() * (p.h - 9),
                        s: 1.5 + Math.random() * 1.8
                    });
                }
            }
            return copy;
        });
        stars = lvData.stars.map(s => ({ ...s, collected: false }));
        enemies = lvData.enemies.map(e => ({ ...e }));
        exit = { ...lvData.exit };
        starsCollected = 0;
        camX = 0;

        // Position player
        player = createPlayer();
        deathCooldown = 0;
        particles.clear();
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

        // Horizontal input (reduced control while airborne)
        const leftPressed  = keys['ArrowLeft']  || keys['KeyA'] || touch.left;
        const rightPressed = keys['ArrowRight'] || keys['KeyD'] || touch.right;
        const accel = MOVE_ACCEL * (player.onGround ? 1 : AIR_CONTROL);

        if (leftPressed)  { player.vx -= accel; player.facingRight = false; }
        if (rightPressed) { player.vx += accel; player.facingRight = true; }
        if (!leftPressed && !rightPressed) { player.vx *= MOVE_DECEL; }
        player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

        // Jump with buffer + coyote time
        const jumpPressed = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touch.jump;
        if (jumpPressed && !player._prevJump) player.jumpBuffer = BUFFER_FRAMES;
        else if (player.jumpBuffer > 0) player.jumpBuffer--;
        player._prevJump = jumpPressed;

        if (player.onGround) player.coyote = COYOTE_FRAMES;
        else if (player.coyote > 0) player.coyote--;

        if (player.jumpBuffer > 0) {
            if (player.coyote > 0) {
                // Ground (or coyote) jump
                player.vy = JUMP_POWER;
                player.coyote = 0;
                player.jumpBuffer = 0;
                player.jumpsLeft = 1;
                player.squashX = 0.78; player.squashY = 1.28;   // stretch up
                spawnDust(player.x + player.w / 2, player.y + player.h, 5);
                if (typeof GameAudio !== 'undefined') GameAudio.jump();
            } else if (player.jumpsLeft > 0) {
                // Double jump with flip animation
                player.vy = DOUBLE_JUMP_POWER;
                player.jumpsLeft--;
                player.jumpBuffer = 0;
                player.spin = SPIN_FRAMES;
                player.squashX = 0.82; player.squashY = 1.22;
                if (typeof GameAudio !== 'undefined') GameAudio.jump();
            }
        }

        // Variable jump height: releasing the key early cuts the jump
        if (!jumpPressed && player.vy < -4) player.vy *= 0.84;

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
                    // Landing on top — squash proportional to fall speed
                    if (player.vy > 6) {
                        player.squashX = Math.min(1.45, 1 + player.vy * 0.045);
                        player.squashY = Math.max(0.6, 1 - player.vy * 0.035);
                        spawnDust(player.x + player.w / 2, p.y, Math.min(8, Math.floor(player.vy)));
                    }
                    player.y = p.y - player.h;
                    player.vy = 0;
                    player.onGround = true;
                    player.jumpsLeft = 1;
                    // Carry player on moving platform
                    if (p.moving) player.x += p._vel || 0;
                } else if (player.vy < 0) {
                    // Hit from below
                    player.y = p.y + p.h;
                    player.vy = 0;
                }
            }
        }

        // Squash & stretch ease back to 1
        player.squashX += (1 - player.squashX) * 0.18;
        player.squashY += (1 - player.squashY) * 0.18;
        if (player.spin > 0) player.spin--;

        // Running dust puffs
        player.dustTimer++;
        if (player.onGround && Math.abs(player.vx) > 3.4 && player.dustTimer >= 9) {
            player.dustTimer = 0;
            spawnDust(player.x + player.w / 2 - Math.sign(player.vx) * 8, player.y + player.h, 2);
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
                // Charge at the player when on the same platform and close
                const pBottom = player.y + player.h;
                const onSamePlatform = !player.isDead && player.onGround &&
                    Math.abs(pBottom - e.platform.y) < 6 &&
                    player.x > e.platform.x - 10 &&
                    player.x < e.platform.x + e.platform.w + 10;
                e.charging = onSamePlatform && Math.abs(player.x - e.x) < 170;

                if (e.pause > 0) {
                    // Idle at the edge before turning around (telegraph)
                    e.pause--;
                    if (e.pause === 0) e.dir *= -1;
                } else {
                    let sp = e.speed;
                    if (e.charging) {
                        e.dir = player.x > e.x ? 1 : -1;
                        sp = e.speed * 1.9;
                    }
                    e.x += sp * e.dir;
                    e.legAnim = (e.legAnim || 0) + sp * 0.18;
                    // Pause-and-turn at platform edges (charging stops dead at the edge)
                    if (e.x <= e.platform.x) {
                        e.x = e.platform.x;
                        if (!e.charging) e.pause = 26;
                    } else if (e.x + 26 >= e.platform.x + e.platform.w) {
                        e.x = e.platform.x + e.platform.w - 26;
                        if (!e.charging) e.pause = 26;
                    }
                }
                e.y = e.platform.y - 26;

            } else if (e.type === 'jumper') {
                e.jumpTimer = (e.jumpTimer || 0) + 1;
                if (e.onGround) {
                    // Anticipation squash builds during the last 22 frames (telegraph)
                    e.charge = Math.max(0, e.jumpTimer - (e.jumpInterval - 22)) / 22;
                    if (e.jumpTimer >= e.jumpInterval) {
                        e.vy = -8.8;
                        // Hop toward the player when near; otherwise ping-pong
                        const dx = player.x - e.x;
                        e.hopDir = (!player.isDead && Math.abs(dx) < 230) ? Math.sign(dx) || 1 : -(e.hopDir || 1);
                        e.vx = e.hopDir * 1.5;
                        e.onGround = false;
                        e.jumpTimer = 0;
                        e.charge = 0;
                    }
                } else {
                    e.vy = (e.vy || 0) + GRAVITY * 0.8;
                    e.y += e.vy;
                    e.x += e.vx || 0;
                    // Stay within its platform
                    const minX = e.platform.x;
                    const maxX = e.platform.x + e.platform.w - 22;
                    if (e.x < minX) { e.x = minX; e.vx = Math.abs(e.vx || 0); }
                    if (e.x > maxX) { e.x = maxX; e.vx = -Math.abs(e.vx || 0); }
                    if (e.y >= e.baseY) {
                        e.y = e.baseY;
                        e.vy = 0;
                        e.vx = 0;
                        e.onGround = true;
                    }
                }

            } else if (e.type === 'flyer') {
                // Sine-wave patrol between x1 and x2
                e.t = (e.t || 0) + 0.07;
                e.x += e.speed * e.dir;
                if (e.x <= e.x1) { e.x = e.x1; e.dir = 1; }
                if (e.x >= e.x2) { e.x = e.x2; e.dir = -1; }
                e.y = e.baseY + Math.sin(e.t) * e.amp;
            }

            // Check player collision
            if (!player.isDead && player.invincible === 0) {
                const eW = e.type === 'walker' ? 26 : (e.type === 'flyer' ? 24 : 22);
                const eH = e.type === 'walker' ? 26 : (e.type === 'flyer' ? 18 : 28);
                if (rectOverlap(player.x, player.y, player.w, player.h, e.x, e.y, eW, eH)) {
                    // Stomp? Player falling onto top of enemy
                    const playerBottom = player.y + player.h;
                    const enemyTop = e.y;
                    if (player.vy > 0 && playerBottom <= enemyTop + 14) {
                        // Kill enemy
                        const col = e.type === 'walker' ? '#ef5350' : (e.type === 'flyer' ? '#7986cb' : '#ce93d8');
                        spawnEnemyParticles(e.x + eW / 2, e.y + eH / 2, col);
                        if (typeof GameAudio !== 'undefined') GameAudio.score();
                        score += 50;
                        addFloater(e.x + eW / 2, e.y - 10, '+50', '#ffd700');
                        enemies.splice(i, 1);
                        player.vy = -8; // Bounce
                        player.jumpsLeft = 1;
                        player.squashX = 0.8; player.squashY = 1.25;
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

    // Sky stars (fixed screen positions, deterministic twinkle)
    const skyStars = (function () {
        const arr = [];
        for (let i = 0; i < 46; i++) {
            arr.push({
                x: (i * 137.5) % W,
                y: ((i * 89.3) % (GROUND_Y * 0.6)) + 8,
                s: i % 5 === 0 ? 2 : 1,
                ph: i * 0.85
            });
        }
        return arr;
    })();

    // Drifting clouds (precomputed shapes)
    const bgClouds = (function () {
        const arr = [];
        const seeds = [60, 280, 520, 760, 1000];
        for (let i = 0; i < seeds.length; i++) {
            arr.push({ x: seeds[i], y: 40 + (i * 31) % 70, sc: 0.8 + (i % 3) * 0.25, spd: 0.4 + (i % 2) * 0.3 });
        }
        return arr;
    })();

    let skyGrad = null;

    function drawBackground(t) {
        if (!skyGrad) {
            skyGrad = ctx.createLinearGradient(0, 0, 0, H);
            skyGrad.addColorStop(0, '#10103a');
            skyGrad.addColorStop(0.55, '#2d2b70');
            skyGrad.addColorStop(1, '#4a3080');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Twinkling stars
        ctx.fillStyle = '#fff';
        for (const s of skyStars) {
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.0015 + s.ph);
            ctx.fillRect(s.x, s.y, s.s, s.s);
        }
        ctx.globalAlpha = 1;

        // Moon with craters
        ctx.fillStyle = '#f4f1d8';
        ctx.beginPath(); ctx.arc(W - 90, 62, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(190,185,150,0.55)';
        ctx.beginPath(); ctx.arc(W - 98, 56, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(W - 82, 70, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(W - 88, 46, 2.5, 0, Math.PI * 2); ctx.fill();

        // Clouds (slow drift + light parallax)
        ctx.fillStyle = 'rgba(150,150,210,0.22)';
        const span = W + 140;
        for (const c of bgClouds) {
            const drift = c.x - camX * 0.15 + t * 0.006 * c.spd;
            const dx = ((drift % span) + span) % span - 70;
            ctx.beginPath();
            ctx.ellipse(dx, c.y, 34 * c.sc, 11 * c.sc, 0, 0, Math.PI * 2);
            ctx.ellipse(dx + 24 * c.sc, c.y - 6 * c.sc, 24 * c.sc, 10 * c.sc, 0, 0, Math.PI * 2);
            ctx.ellipse(dx - 22 * c.sc, c.y - 3 * c.sc, 20 * c.sc, 8 * c.sc, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Far mountains with snow caps (parallax 0.25)
        const mOff = camX * 0.25;
        const mSpan = WORLD_W * 0.25 + W;
        for (const m of bgMountains) {
            const sx = m.x - mOff;
            const drawX = ((sx % mSpan) + mSpan) % mSpan - W;
            ctx.fillStyle = '#232050';
            ctx.beginPath();
            ctx.moveTo(drawX, GROUND_Y);
            ctx.lineTo(drawX + m.w / 2, GROUND_Y - m.h);
            ctx.lineTo(drawX + m.w, GROUND_Y);
            ctx.closePath();
            ctx.fill();
            // Snow cap
            ctx.fillStyle = 'rgba(235,240,255,0.75)';
            ctx.beginPath();
            ctx.moveTo(drawX + m.w * 0.38, GROUND_Y - m.h * 0.76);
            ctx.lineTo(drawX + m.w / 2, GROUND_Y - m.h);
            ctx.lineTo(drawX + m.w * 0.62, GROUND_Y - m.h * 0.76);
            ctx.lineTo(drawX + m.w * 0.56, GROUND_Y - m.h * 0.7);
            ctx.lineTo(drawX + m.w * 0.5,  GROUND_Y - m.h * 0.78);
            ctx.lineTo(drawX + m.w * 0.44, GROUND_Y - m.h * 0.7);
            ctx.closePath();
            ctx.fill();
        }

        // Mid hills (parallax 0.45)
        const hOff = camX * 0.45;
        const hSpan = WORLD_W * 0.45 + W;
        ctx.fillStyle = '#2e2b60';
        for (const m of bgMountains) {
            const sx = m.x * 1.3 - hOff;
            const drawX = ((sx % hSpan) + hSpan) % hSpan - W;
            ctx.beginPath();
            ctx.moveTo(drawX, GROUND_Y);
            ctx.quadraticCurveTo(drawX + m.w * 0.65, GROUND_Y - m.h * 0.55, drawX + m.w * 1.3, GROUND_Y);
            ctx.closePath();
            ctx.fill();
        }

        // Near trees (parallax 0.6)
        const tOff = camX * 0.6;
        const tSpan = WORLD_W * 0.6 + W;
        for (const tr of bgTrees) {
            const sx = tr.x - tOff;
            const drawX = ((sx % tSpan) + tSpan) % tSpan - W;
            ctx.fillStyle = '#14281e';
            ctx.fillRect(drawX + 5, GROUND_Y - 12, 6, 12);
            ctx.fillStyle = '#1b3a2b';
            ctx.beginPath();
            ctx.moveTo(drawX, GROUND_Y - 12);
            ctx.lineTo(drawX + 8, GROUND_Y - 12 - tr.h);
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
            // Soil body with darker bottom edge
            ctx.fillStyle = '#5c3d1e';
            ctx.fillRect(sx, p.y + 4, p.w, p.h - 4);
            ctx.fillStyle = '#46300f';
            ctx.fillRect(sx, p.y + p.h - 3, p.w, 3);
            // Grass cap with light top line
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(sx, p.y, p.w, 6);
            ctx.fillStyle = '#7ccd5a';
            ctx.fillRect(sx, p.y, p.w, 2);
            // Grass tufts
            if (p._tufts) {
                ctx.strokeStyle = '#66bb6a';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (const tf of p._tufts) {
                    ctx.moveTo(sx + tf.dx, p.y);
                    ctx.lineTo(sx + tf.dx + tf.lean, p.y - tf.h);
                }
                ctx.stroke();
            }
        } else if (p.type === 'stone') {
            ctx.fillStyle = '#546e7a';
            ctx.fillRect(sx, p.y, p.w, p.h);
            ctx.fillStyle = '#78909c';
            ctx.fillRect(sx, p.y, p.w, 3);
            ctx.fillStyle = '#3c5059';
            ctx.fillRect(sx, p.y + p.h - 2, p.w, 2);
            // Brick pattern (offset rows)
            ctx.strokeStyle = 'rgba(40,55,64,0.7)';
            ctx.lineWidth = 1;
            const rowH = Math.max(7, Math.floor(p.h / 2));
            for (let ry = p.y + rowH; ry < p.y + p.h - 2; ry += rowH) {
                ctx.beginPath(); ctx.moveTo(sx, ry); ctx.lineTo(sx + p.w, ry); ctx.stroke();
            }
            const segW = 22;
            for (let i = 0; i * segW < p.w; i++) {
                const bx = sx + i * segW + (Math.floor(p.h / rowH) % 2 ? segW / 2 : 0);
                if (bx > sx && bx < sx + p.w) {
                    ctx.beginPath(); ctx.moveTo(bx, p.y + 3); ctx.lineTo(bx, p.y + rowH); ctx.stroke();
                }
                const bx2 = sx + i * segW + segW / 2;
                if (bx2 < sx + p.w && p.h > rowH + 4) {
                    ctx.beginPath(); ctx.moveTo(bx2, p.y + rowH); ctx.lineTo(bx2, Math.min(p.y + rowH * 2, p.y + p.h - 2)); ctx.stroke();
                }
            }
        } else { // dirt
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(sx, p.y, p.w, p.h);
            ctx.fillStyle = '#9c7a64';
            ctx.fillRect(sx, p.y, p.w, 3);
            ctx.fillStyle = '#523329';
            ctx.fillRect(sx, p.y + p.h - 2, p.w, 2);
        }

        // Speckles (precomputed)
        if (p._specks) {
            ctx.fillStyle = p.type === 'stone' ? 'rgba(120,144,156,0.5)' : 'rgba(60,38,28,0.6)';
            for (const sp of p._specks) {
                ctx.fillRect(sx + sp.dx, p.y + Math.min(sp.dy, p.h - 3), sp.s, sp.s);
            }
        }

        // Moving platforms: corner bolts + subtle underline
        if (p.moving) {
            ctx.fillStyle = '#37474f';
            ctx.beginPath(); ctx.arc(sx + 5, p.y + 5, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx + p.w - 5, p.y + 5, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(sx + 2, p.y + p.h, p.w - 4, 2);
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

    // Pre-rendered star sprite with soft glow (avoids shadowBlur per star)
    const starSprite = (function () {
        const size = 34;
        const oc = document.createElement('canvas');
        oc.width = oc.height = size;
        const o = oc.getContext('2d');
        const c = size / 2;
        const halo = o.createRadialGradient(c, c, 2, c, c, c);
        halo.addColorStop(0, 'rgba(255,225,90,0.55)');
        halo.addColorStop(1, 'rgba(255,225,90,0)');
        o.fillStyle = halo;
        o.fillRect(0, 0, size, size);
        o.fillStyle = '#ffd700';
        o.strokeStyle = '#b8860b';
        o.lineWidth = 1.2;
        o.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const r = i % 2 === 0 ? STAR_SIZE / 2 : STAR_SIZE / 4;
            const px = c + Math.cos(angle) * r;
            const py = c + Math.sin(angle) * r;
            if (i === 0) o.moveTo(px, py); else o.lineTo(px, py);
        }
        o.closePath();
        o.fill();
        o.stroke();
        // center sparkle
        o.fillStyle = 'rgba(255,255,255,0.85)';
        o.fillRect(c - 1, c - 4, 2, 5);
        return oc;
    })();

    function drawStars(t) {
        let si = 0;
        for (const s of stars) {
            if (s.collected) { si++; continue; }
            const sx = s.x - camX;
            if (sx < -20 || sx > W + 20) { si++; continue; }
            const bob = Math.sin(t * 0.003 + starBobPhases[si % 10]) * 3;
            const pulse = 1 + 0.12 * Math.sin(t * 0.004 + starBobPhases[si % 10]);
            const sz = 34 * pulse;
            ctx.drawImage(starSprite, sx - sz / 2, s.y + bob - sz / 2, sz, sz);
            si++;
        }
    }

    // ── Enemy rendering ───────────────────────────────────────
    function drawWalker(e, t) {
        const sx = e.x - camX;
        if (sx < -30 || sx > W + 30) return;
        const moving = e.pause === undefined || e.pause <= 0;
        const legSwing = moving ? Math.sin(e.legAnim || 0) * 4 : 0;
        const wobble = moving ? Math.sin((e.legAnim || 0) * 0.5) * 0.06 : 0;
        const bodyCol = e.charging ? '#ff3b2e' : '#ef5350';
        const darkCol = '#b71c1c';

        ctx.save();
        ctx.translate(sx + 13, e.y + 11);
        ctx.rotate(wobble + (e.charging ? e.dir * 0.08 : 0)); // lean forward when charging

        // Body
        ctx.fillStyle = bodyCol;
        ctx.beginPath(); ctx.roundRect(-13, -11, 26, 22, 6); ctx.fill();
        ctx.strokeStyle = darkCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Belly
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.roundRect(-9, 1, 18, 8, 4); ctx.fill();

        // Eyes — pupils track walking direction
        const pup = e.dir * 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9, -6, 7, 6);
        ctx.fillRect(2,  -6, 7, 6);
        ctx.fillStyle = e.charging ? '#c62828' : '#333';
        ctx.fillRect(-7 + pup, -4, 3, 3);
        ctx.fillRect(4 + pup,  -4, 3, 3);
        // Angry brows (steeper when charging)
        const browDrop = e.charging ? 3 : 2;
        ctx.strokeStyle = darkCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -8); ctx.lineTo(-2, -8 + browDrop);
        ctx.moveTo(1, -8 + browDrop); ctx.lineTo(9, -8);
        ctx.stroke();

        // Little horns
        ctx.fillStyle = darkCol;
        ctx.beginPath();
        ctx.moveTo(-8, -11); ctx.lineTo(-5, -16); ctx.lineTo(-2, -11); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -11); ctx.lineTo(5, -16); ctx.lineTo(8, -11); ctx.closePath(); ctx.fill();

        ctx.restore();

        // Feet (animated, drawn unrotated under the body)
        ctx.fillStyle = '#8e1410';
        ctx.beginPath(); ctx.roundRect(sx + 3,  e.y + 22, 8, 4 + legSwing, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(sx + 15, e.y + 22, 8, 4 - legSwing, 2); ctx.fill();
    }

    function drawJumper(e, t) {
        const sx = e.x - camX;
        if (sx < -30 || sx > W + 30) return;
        // Anticipation: squash grows with charge; in air: stretch with velocity
        let squishX, squishY;
        if (e.onGround) {
            const c = e.charge || 0;
            squishX = 1 + c * 0.3;
            squishY = 1 - c * 0.3;
        } else {
            const v = Math.min(Math.abs(e.vy || 0) / 9, 1);
            squishX = 1 - v * 0.25;
            squishY = 1 + v * 0.3;
        }

        ctx.save();
        ctx.translate(sx + 11, e.y + 14 + (e.onGround ? (e.charge || 0) * 4 : 0));
        ctx.scale(squishX, squishY);

        // Body blob
        ctx.fillStyle = '#ab47bc';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6a1b9a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(-4, -5, 4, 2.5, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (look toward hop direction; wide when charging)
        const look = (e.hopDir || 1) * 1.5;
        const eyeH = e.onGround && (e.charge || 0) > 0.5 ? 6 : 5;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-7, -4, 5, eyeH);
        ctx.fillRect(2,  -4, 5, eyeH);
        ctx.fillStyle = '#333';
        ctx.fillRect(-6 + look, -3, 3, 3);
        ctx.fillRect(3 + look,  -3, 3, 3);

        ctx.restore();

        // Spring coil — compresses with charge
        const coil = e.onGround ? 5 - (e.charge || 0) * 3 : 5;
        ctx.strokeStyle = '#7b1fa2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const springY = e.y + 23;
        for (let i = 0; i < 3; i++) {
            ctx.moveTo(sx + 2 + i * 8, springY);
            ctx.lineTo(sx + 8 + i * 8, springY + coil);
        }
        ctx.stroke();
    }

    function drawFlyer(e, t) {
        const sx = e.x - camX;
        if (sx < -36 || sx > W + 36) return;
        const flap = Math.sin((e.t || 0) * 5) * 0.7; // wing angle from patrol clock

        ctx.save();
        ctx.translate(sx + 12, e.y + 9);

        // Wings (two triangles flapping)
        ctx.fillStyle = '#5c6bc0';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-20, -4 - flap * 9);
        ctx.lineTo(-9, 4);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(20, -4 - flap * 9);
        ctx.lineTo(9, 4);
        ctx.closePath(); ctx.fill();

        // Body
        ctx.fillStyle = '#7986cb';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3f51b5';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ears
        ctx.fillStyle = '#5c6bc0';
        ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-4, -11); ctx.lineTo(-1, -6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(4, -11); ctx.lineTo(6, -5); ctx.closePath(); ctx.fill();

        // Eyes follow flight direction
        const look = e.dir * 1.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-3.5, -1, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.5, -1, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a237e';
        ctx.beginPath(); ctx.arc(-3.5 + look, -1, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.5 + look, -1, 1.3, 0, Math.PI * 2); ctx.fill();

        // Tiny fangs
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-2.5, 4); ctx.lineTo(-1.5, 6.5); ctx.lineTo(-0.5, 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.5, 4); ctx.lineTo(1.5, 6.5); ctx.lineTo(2.5, 4); ctx.closePath(); ctx.fill();

        ctx.restore();
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
        const lean = player.onGround ? player.vx * 0.03 : 0;

        ctx.save();
        ctx.translate(sx + player.w / 2, player.y + player.h / 2);
        // Double-jump somersault
        if (player.spin > 0) {
            ctx.rotate(flip * (1 - player.spin / SPIN_FRAMES) * Math.PI * 2);
        } else {
            ctx.rotate(lean);
        }
        ctx.scale(flip * player.squashX, player.squashY);

        // Legs
        ctx.fillStyle = '#006064';
        if (isMoving && player.onGround) {
            ctx.fillRect(-8, 10, 6, 8 + legSwing);
            ctx.fillRect(2,  10, 6, 8 - legSwing);
        } else if (!player.onGround) {
            // Tucked legs in the air
            ctx.fillRect(-8, 10, 6, 6);
            ctx.fillRect(2,  10, 6, 6);
        } else {
            ctx.fillRect(-8, 10, 6, 8);
            ctx.fillRect(2,  10, 6, 8);
        }

        // Body
        ctx.fillStyle = '#26c6da';
        ctx.beginPath();
        ctx.roundRect(-player.w / 2, -player.h / 2, player.w, player.h - 8, 6);
        ctx.fill();
        ctx.strokeStyle = '#00838f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Chest panel
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.roundRect(-6, 0, 12, 8, 3);
        ctx.fill();

        // Antenna with bobbing tip (lags against motion)
        const antTilt = Math.max(-4, Math.min(4, -player.vx * 0.6 * flip));
        ctx.strokeStyle = '#00838f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -player.h / 2);
        ctx.quadraticCurveTo(antTilt * 0.5, -player.h / 2 - 5, antTilt, -player.h / 2 - 9);
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(antTilt, -player.h / 2 - 10, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Two eyes facing forward
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -7, 5, 6);
        ctx.fillRect(5, -7, 5, 6);
        ctx.fillStyle = '#1a237e';
        ctx.fillRect(1, -5, 2.5, 3);
        ctx.fillRect(7, -5, 2.5, 3);

        // Smile
        ctx.strokeStyle = '#00606a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(4, -1, 3, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        ctx.restore();
    }

    // ── HUD ───────────────────────────────────────────────────
    function drawHeart(cx, cy, r) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.9);
        ctx.bezierCurveTo(cx - r * 1.3, cy, cx - r * 0.9, cy - r, cx, cy - r * 0.35);
        ctx.bezierCurveTo(cx + r * 0.9, cy - r, cx + r * 1.3, cy, cx, cy + r * 0.9);
        ctx.closePath();
        ctx.fill();
    }

    function drawHUD() {
        // Single rounded translucent bar
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(4, 4, 300, 30, 8);
        ctx.fill();

        // Hearts for lives
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i < lives ? '#ef5350' : 'rgba(255,255,255,0.18)';
            drawHeart(20 + i * 20, 19, 7);
        }

        // Star icon + count
        ctx.drawImage(starSprite, 76, 4, 28, 28);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${starsCollected}/10`, 104, 23);

        // Score + level
        ctx.fillText(`Pts: ${score}`, 152, 23);
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText(`Nivel ${currentLevel + 1}`, 240, 23);
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
        return GU.pointerPos(canvas, e.touches[idx]);
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
        // Throttle to ~60fps on high-refresh screens
        if (dt < 15) { rafId = requestAnimationFrame(loop); return; }
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
        drawBackground(ts);
        for (const p of platforms) drawPlatform(p);
        drawStars(ts);
        for (const e of enemies) {
            if (e.dead) continue;
            if (e.type === 'walker') drawWalker(e, ts);
            else if (e.type === 'flyer') drawFlyer(e, ts);
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
            GameStore.set('platformerHigh', highScore);
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
        particles.clear();
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

        gameControls.running();
    }

    function endGame() {
        gameRunning = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        if (score > highScore) {
            highScore = score;
            GameStore.set('platformerHigh', highScore);
        }
        updateHUD();

        finalScoreEl.textContent = `Puntos: ${score}`;
        finalHighEl.textContent  = score >= highScore ? 'Nuevo record!' : `Mejor: ${highScore}`;
        gameOverPopup.style.display = 'flex';

        gameControls.idle();
    }

    var gameControls = GU.controls({ start: startGame, popup: 'gameOverPopup' });

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

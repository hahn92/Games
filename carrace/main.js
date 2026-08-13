// ─── Car Racing — main.js ───────────────────────────────────────────────────
// Top-down car racing game.
// Conventions followed:
//   • requestAnimationFrame game loop, throttled to ~60fps via dt check
//   • No emoji on canvas — everything drawn with 2D API shapes
//   • No shadowBlur inside render loops
//   • GameAudio.* called only on event triggers, never in draw functions
// ────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    // ── Canvas & context ──────────────────────────────────────────────────────
    const canvas = document.getElementById('carCanvas');
    const ctx    = canvas.getContext('2d');

    const CW = canvas.width;   // 400
    const CH = canvas.height;  // 600

    // ── Road geometry ─────────────────────────────────────────────────────────
    const ROAD_W      = 300;
    const ROAD_X      = (CW - ROAD_W) / 2;   // 50
    const ROAD_X_END  = ROAD_X + ROAD_W;      // 350
    const NUM_LANES   = 3;
    const LANE_W      = ROAD_W / NUM_LANES;   // 100

    // Lane center X positions (0-indexed)
    function laneCenter(lane) {
        return ROAD_X + lane * LANE_W + LANE_W / 2;
    }

    // ── Game constants ────────────────────────────────────────────────────────
    const MIN_ROAD_SPEED  = 3;
    const MAX_ROAD_SPEED  = 8;
    const SCORE_PER_LEVEL = 500;
    const MAX_LEVEL       = 6;
    const ENEMY_W         = 38;
    const ENEMY_H         = 68;
    const PLAYER_W        = 40;
    const PLAYER_H        = 70;
    const COIN_R          = 10;
    const SHIELD_W        = 24;
    const SHIELD_H        = 30;
    const INVINCIBLE_TIME = 5000;   // ms after shield pickup
    const HIT_INVINCIBLE  = 2000;   // ms after collision
    const LANE_ANIM_TIME  = 150;    // ms for lane-switch animation
    // Vehicle type configs — w/h are hitbox AND visual dimensions
    const VEHICLE_DEFS = [
        { w: 38, h: 68  },   // 0: Blue sedan
        { w: 42, h: 60  },   // 1: Yellow sports
        { w: 46, h: 72  },   // 2: Gray SUV
        { w: 38, h: 68  },   // 3: Police
        { w: 16, h: 52  },   // 4: Motorcycle
        { w: 46, h: 104 },   // 5: Truck / Semi
        { w: 34, h: 52  },   // 6: Compact / Hatchback
        { w: 44, h: 86  },   // 7: Van / Minivan
    ];
    const NUM_VEHICLE_TYPES = VEHICLE_DEFS.length;
    // Per-type speed offset over roadSpeed [min, max] — trucks crawl, bikes fly
    const SPEED_RANGE = [
        [0.9, 1.3],   // sedan
        [1.4, 1.9],   // sports
        [0.7, 1.1],   // SUV
        [1.2, 1.7],   // police
        [1.7, 2.3],   // motorcycle
        [0.35, 0.6],  // truck
        [0.9, 1.4],   // compact
        [0.6, 1.0],   // van
    ];
    const HITBOX_PAD = 5;   // shrink hitboxes for fair collisions (rounded corners)

    // Dash line state
    const DASH_H     = 40;
    const DASH_GAP   = 30;
    const DASH_CYCLE = DASH_H + DASH_GAP;

    // ── Game state ────────────────────────────────────────────────────────────
    let gameRunning   = false;
    let gameOver      = false;
    let score         = 0;
    let scoreFloat    = 0;   // fractional distance-score accumulator
    let highScore     = GameStore.getNum('carrace_hs', 0);
    let level         = 1;
    let lives         = 3;
    let roadOffset    = 0;
    let roadSpeed     = MIN_ROAD_SPEED;

    // Player
    let playerLane    = 1;           // current target lane
    let playerX       = laneCenter(1);
    let playerAnimX   = laneCenter(1); // animated X
    let laneAnimStart = 0;           // timestamp when lane anim started
    let laneAnimFrom  = playerX;     // X at animation start
    let laneAnimTo    = playerX;

    // Invincibility
    let invincible       = false;
    let invincibleTimer  = 0;
    let hitInvincible    = false;
    let hitInvincibleTimer = 0;
    let blinkOn          = true;

    // Screen shake
    let shakeFrames  = 0;
    let shakeX       = 0;
    let shakeY       = 0;

    // Collections
    let enemies  = [];
    let coins    = [];
    let shields  = [];

    // Tire tracks (drawn behind player)
    let tireTracks = [];

    // Speed lines (visual effect at high speed)
    let speedLines = [];

    // Floating score texts (+20, +15 near miss...)
    let floatTexts = [];

    // Exhaust smoke behind player
    let exhaust = [];
    let exhaustTimer = 0;

    // Plants (trees and bushes on grass sides)
    let plants = [];

    // Spawn timers
    let enemyTimer   = 0;
    let coinTimer    = 0;
    let shieldTimer  = 0;
    let plantTimer   = 0;

    let lastTs       = 0;
    let rafId        = null;

    // ── DOM references ────────────────────────────────────────────────────────
    const scoreEl     = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const levelEl     = document.getElementById('level');
    const startBtn    = document.getElementById('startBtn');
    const restartBtn  = document.getElementById('restartBtn');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const popup       = document.getElementById('gameOverPopup');
    const finalScore  = document.getElementById('finalScore');
    const finalLevel  = document.getElementById('finalLevel');
    const mobileScore = document.getElementById('mobileScore');

    // ── Utility ───────────────────────────────────────────────────────────────
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    // ── Road speed & level ────────────────────────────────────────────────────
    function computeRoadSpeed() {
        const t = Math.min((level - 1) / (MAX_LEVEL - 1), 1);
        return lerp(MIN_ROAD_SPEED, MAX_ROAD_SPEED, t);
    }

    function checkLevelUp(oldScore, newScore) {
        const oldLevel = Math.floor(oldScore / SCORE_PER_LEVEL) + 1;
        const newLevel = Math.floor(newScore / SCORE_PER_LEVEL) + 1;
        if (newLevel > oldLevel && oldLevel < MAX_LEVEL) {
            level = clamp(newLevel, 1, MAX_LEVEL);
            roadSpeed = computeRoadSpeed();
            // Re-base existing enemies on the new road speed, keeping their per-type offset
            for (const e of enemies) e.speed = roadSpeed + e.spdOff;
            levelEl.textContent = level;
            GameAudio.scoreHigh();
        }
    }

    // ── Enemy spawn helpers ───────────────────────────────────────────────────
    function enemyInterval() {
        // Spawn faster as level rises
        return Math.max(60, 120 - (level - 1) * 12);
    }

    function spawnEnemy() {
        // Pick a lane. Avoid placing on same lane as player if player is close to top
        const laneOptions = [0, 1, 2];
        // Try to avoid lane player is in (soft constraint)
        let lane;
        if (Math.random() < 0.35) {
            lane = randInt(0, 2);
        } else {
            const filtered = laneOptions.filter(l => l !== playerLane);
            lane = filtered[randInt(0, filtered.length - 1)];
        }
        const vtype = randInt(0, NUM_VEHICLE_TYPES - 1);
        const def   = VEHICLE_DEFS[vtype];
        // Avoid stacking on an existing enemy near the top
        const tooClose = enemies.some(e => e.lane === lane && e.y < 150);
        if (tooClose) return;

        // Guaranteed escape lane: never let the top band block all 3 lanes
        const blocked = new Set();
        for (const e of enemies) {
            if (e.y < 220) blocked.add(e.lane);
        }
        blocked.add(lane);
        if (blocked.size >= 3) return;

        const range  = SPEED_RANGE[vtype];
        const spdOff = rand(range[0], range[1]);
        enemies.push({
            lane,
            x: laneCenter(lane),
            y: -def.h - 10,
            type: vtype,
            w: def.w, h: def.h,
            spdOff,
            speed: roadSpeed + spdOff,
            passed: false
        });
    }

    // Lanes without an enemy near the top, so pickups never spawn under a car
    function freeLane() {
        const free = [0, 1, 2].filter(l => !enemies.some(e => e.lane === l && e.y < 160));
        return free.length ? free[randInt(0, free.length - 1)] : randInt(0, 2);
    }

    function spawnCoin() {
        const lane = freeLane();
        // Column of 3 coins — rewarding to chase
        for (let i = 0; i < 3; i++) {
            coins.push({
                lane,
                x: laneCenter(lane),
                y: -COIN_R - 5 - i * 32,
                collected: false,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    function spawnShield() {
        const lane = freeLane();
        shields.push({
            lane,
            x: laneCenter(lane),
            y: -SHIELD_H - 5,
            collected: false,
            pulse: 0
        });
    }

    function spawnPlant() {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const type = Math.random() < 0.55 ? 'tree' : 'bush';
        const r = type === 'tree' ? rand(12, 20) : rand(7, 12);
        const margin = r + 3;
        const x = side === 'left'
            ? rand(margin, ROAD_X - margin - 2)
            : rand(ROAD_X_END + margin + 2, CW - margin);
        plants.push({ x, y: -r * 2 - 5, r, type, speed: roadSpeed * 0.7 });
    }

    function preSeedPlants() {
        for (let i = 0; i < 10; i++) {
            const side = i % 2 === 0 ? 'left' : 'right';
            const type = Math.random() < 0.55 ? 'tree' : 'bush';
            const r = type === 'tree' ? rand(12, 20) : rand(7, 12);
            const margin = r + 3;
            const x = side === 'left'
                ? rand(margin, ROAD_X - margin - 2)
                : rand(ROAD_X_END + margin + 2, CW - margin);
            plants.push({ x, y: rand(20, CH - 20), r, type, speed: roadSpeed * 0.7 });
        }
    }

    // ── Collision detection ───────────────────────────────────────────────────
    function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx &&
               ay < by + bh && ay + ah > by;
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────

    // Draw player car (red) or enemy car at center x, center y
    function drawCar(cx, cy, color, roofColor, isPlayer, alpha) {
        ctx.globalAlpha = alpha;
        const w = isPlayer ? PLAYER_W : ENEMY_W;
        const h = isPlayer ? PLAYER_H : ENEMY_H;
        const x = cx - w / 2;
        const y = cy - h / 2;

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 7);
        ctx.fill();

        if (isPlayer) {
            // Racing stripes down the hood and trunk (the roof covers the middle)
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(cx - 6, y + 3, 4, h - 6);
            ctx.fillRect(cx + 2, y + 3, 4, h - 6);
            // Front splitter & rear spoiler
            ctx.fillStyle = '#3a0808';
            ctx.beginPath(); ctx.roundRect(x + 2, y - 2, w - 4, 4, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x - 2, y + h - 3, w + 4, 5, 2); ctx.fill();
        }

        // Roof / cabin
        const roofW = w * 0.7;
        const roofH = h * 0.42;
        const roofX = cx - roofW / 2;
        const roofY = cy - roofH / 2 - h * 0.04;
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.roundRect(roofX, roofY, roofW, roofH, 5);
        ctx.fill();

        // Windshield (front — top for player going down, but visually top)
        const wsW = roofW * 0.78;
        const wsH = roofH * 0.38;
        ctx.fillStyle = 'rgba(180,230,255,0.55)';
        ctx.beginPath();
        ctx.roundRect(cx - wsW / 2, roofY + roofH * 0.08, wsW, wsH, 3);
        ctx.fill();

        // Rear window
        ctx.fillStyle = 'rgba(180,230,255,0.45)';
        ctx.beginPath();
        ctx.roundRect(cx - wsW / 2, roofY + roofH * 0.56, wsW, wsH * 0.85, 3);
        ctx.fill();

        // Headlights (top of car — front)
        const hlY = y + 6;
        ctx.fillStyle = '#fffde0';
        // Left headlight
        ctx.beginPath();
        ctx.arc(x + w * 0.22, hlY, isPlayer ? 4 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Right headlight
        ctx.beginPath();
        ctx.arc(x + w * 0.78, hlY, isPlayer ? 4 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Taillights (bottom of car)
        const tlY = y + h - 6;
        ctx.fillStyle = '#ff3030';
        ctx.beginPath();
        ctx.arc(x + w * 0.22, tlY, isPlayer ? 4 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w * 0.78, tlY, isPlayer ? 4 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Wheels — 4 black rounded rects at corners
        const ww = isPlayer ? 10 : 9;
        const wh = isPlayer ? 18 : 16;
        ctx.fillStyle = '#111';
        // Front-left
        ctx.beginPath();
        ctx.roundRect(x - ww + 2, y + 8, ww, wh, 3);
        ctx.fill();
        // Front-right
        ctx.beginPath();
        ctx.roundRect(x + w - 2, y + 8, ww, wh, 3);
        ctx.fill();
        // Rear-left
        ctx.beginPath();
        ctx.roundRect(x - ww + 2, y + h - 8 - wh, ww, wh, 3);
        ctx.fill();
        // Rear-right
        ctx.beginPath();
        ctx.roundRect(x + w - 2, y + h - 8 - wh, ww, wh, 3);
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    // Draw enemy vehicle — 8 distinct types
    function drawEnemyVehicle(cx, cy, type, alpha) {
        ctx.globalAlpha = alpha;
        const def = VEHICLE_DEFS[type];
        const w = def.w, h = def.h;
        const x = cx - w / 2, y = cy - h / 2;

        if (type === 0) {
            // ── Blue Sedan ──
            ctx.fillStyle = '#4a9ede';
            ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
            ctx.fillStyle = '#1a5a8a';
            ctx.beginPath(); ctx.roundRect(cx - w*0.36, cy - h*0.25, w*0.72, h*0.42, 5); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.55)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.28, cy - h*0.22, w*0.56, h*0.16, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.28, cy + h*0.01, w*0.56, h*0.14, 3); ctx.fill();

        } else if (type === 1) {
            // ── Yellow Sports Car ──
            ctx.fillStyle = '#f0c040';
            ctx.beginPath(); ctx.roundRect(x - 3, y + 5, w + 6, h - 8, 9); ctx.fill();
            ctx.fillStyle = '#c8a000';
            ctx.beginPath(); ctx.roundRect(cx - 3, y + 5, 6, h - 8, 2); ctx.fill(); // racing stripe
            ctx.fillStyle = '#8a6500';
            ctx.beginPath(); ctx.roundRect(cx - w*0.3, cy - h*0.2, w*0.6, h*0.34, 5); ctx.fill();
            ctx.fillStyle = 'rgba(255,240,120,0.4)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.24, cy - h*0.18, w*0.48, h*0.14, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.24, cy - h*0.02, w*0.48, h*0.11, 3); ctx.fill();
            ctx.fillStyle = '#c8a000';
            ctx.beginPath(); ctx.roundRect(x - 4, y + h - 9, w + 8, 6, 2); ctx.fill(); // spoiler

        } else if (type === 2) {
            // ── Gray SUV ──
            ctx.fillStyle = '#c8c8c8';
            ctx.beginPath(); ctx.roundRect(x - 2, y, w + 4, h, 5); ctx.fill();
            ctx.fillStyle = '#888888';
            ctx.beginPath(); ctx.roundRect(x - 5, y + 3, w + 10, 9, 3); ctx.fill(); // bull bar
            ctx.fillStyle = '#707070';
            ctx.beginPath(); ctx.roundRect(cx - w*0.4, cy - h*0.28, w*0.8, h*0.48, 3); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.5)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.33, cy - h*0.25, w*0.66, h*0.14, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.33, cy - h*0.08, w*0.3, h*0.13, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx + w*0.03, cy - h*0.08, w*0.3, h*0.13, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.33, cy + h*0.07, w*0.66, h*0.1, 2); ctx.fill();
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; // roof rack
            ctx.beginPath(); ctx.moveTo(cx - w*0.3, cy - h*0.28); ctx.lineTo(cx - w*0.3, cy + h*0.2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + w*0.3, cy - h*0.28); ctx.lineTo(cx + w*0.3, cy + h*0.2); ctx.stroke();
            ctx.lineWidth = 1;

        } else if (type === 3) {
            // ── Police Car ──
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.roundRect(x, y, w, h/2 + 5, [7,7,0,0]); ctx.fill();
            ctx.fillStyle = '#111111';
            ctx.beginPath(); ctx.roundRect(x, cy - 3, w, h/2 + 3, [0,0,7,7]); ctx.fill();
            ctx.fillStyle = '#404040';
            ctx.beginPath(); ctx.roundRect(cx - w*0.36, cy - h*0.25, w*0.72, h*0.42, 5); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.55)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.28, cy - h*0.22, w*0.56, h*0.16, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.28, cy + h*0.01, w*0.56, h*0.14, 3); ctx.fill();
            ctx.fillStyle = '#ff2020'; // lightbar red
            ctx.beginPath(); ctx.roundRect(cx - w*0.29, cy - h*0.27, w*0.26, 5, 2); ctx.fill();
            ctx.fillStyle = '#2060ff'; // lightbar blue
            ctx.beginPath(); ctx.roundRect(cx + w*0.03, cy - h*0.27, w*0.26, 5, 2); ctx.fill();

        } else if (type === 4) {
            // ── Motorcycle ──
            // Wheels
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.ellipse(cx, y + 9,  7, 9, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, y + h - 9, 7, 9, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#777';
            ctx.beginPath(); ctx.ellipse(cx, y + 9,  3, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, y + h - 9, 3, 4, 0, 0, Math.PI*2); ctx.fill();
            // Bike frame/body
            ctx.fillStyle = '#cc2828';
            ctx.beginPath(); ctx.roundRect(cx - 5, y + 9, 10, h - 18, 3); ctx.fill();
            // Engine block
            ctx.fillStyle = '#888';
            ctx.beginPath(); ctx.roundRect(cx - 5, cy - 4, 10, 10, 2); ctx.fill();
            // Exhaust pipe
            ctx.fillStyle = '#aaa';
            ctx.beginPath(); ctx.roundRect(cx + 4, cy, 4, h*0.28, 2); ctx.fill();
            // Rider torso
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.roundRect(cx - 7, cy - h*0.22, 14, h*0.28, 5); ctx.fill();
            // Rider helmet
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(cx, cy - h*0.22, 7, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.45)';
            ctx.beginPath(); ctx.arc(cx + 1, cy - h*0.23, 3.5, Math.PI*1.1, Math.PI*1.85); ctx.fill(); // visor

        } else if (type === 5) {
            // ── Truck / Semi ──
            const cabH = Math.round(h * 0.35);
            // Cargo box
            ctx.fillStyle = '#b8b8b8';
            ctx.beginPath(); ctx.roundRect(x, y + cabH - 4, w, h - cabH + 4, [0,0,6,6]); ctx.fill();
            // Cargo door lines
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(cx, y + cabH + 4); ctx.lineTo(cx, y + h - 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + 4, y + cabH + (h - cabH) * 0.5); ctx.lineTo(x + w - 4, y + cabH + (h - cabH) * 0.5); ctx.stroke();
            // Cab
            ctx.fillStyle = '#3a78cc';
            ctx.beginPath(); ctx.roundRect(x + 2, y, w - 4, cabH, [8,8,0,0]); ctx.fill();
            // Windshield
            ctx.fillStyle = 'rgba(180,230,255,0.6)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.32, y + 4, w*0.64, cabH*0.46, 4); ctx.fill();
            // Grille bar
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.roundRect(x + 3, y + cabH*0.66, w - 6, cabH*0.28, 3); ctx.fill();
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
            for (let gx = x + 7; gx < x + w - 6; gx += 5) {
                ctx.beginPath(); ctx.moveTo(gx, y + cabH*0.68); ctx.lineTo(gx, y + cabH*0.91); ctx.stroke();
            }
            // Front bumper
            ctx.fillStyle = '#666';
            ctx.beginPath(); ctx.roundRect(x - 2, y + cabH*0.88, w + 4, 6, 2); ctx.fill();
            // Side exhaust stacks
            ctx.fillStyle = '#999';
            ctx.beginPath(); ctx.roundRect(x - 3, y + cabH*0.1, 4, cabH*0.7, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x + w - 1, y + cabH*0.1, 4, cabH*0.7, 2); ctx.fill();

        } else if (type === 6) {
            // ── Compact / Hatchback ──
            ctx.fillStyle = '#e84090';
            ctx.beginPath(); ctx.roundRect(x, y + 4, w, h - 4, 10); ctx.fill();
            // Cabin with sloped hatchback roof
            ctx.fillStyle = '#c02870';
            ctx.beginPath();
            ctx.moveTo(cx - w*0.38, cy - h*0.2);
            ctx.lineTo(cx + w*0.38, cy - h*0.2);
            ctx.lineTo(cx + w*0.3,  cy + h*0.2);
            ctx.lineTo(cx - w*0.38, cy + h*0.2);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.55)';
            ctx.beginPath(); ctx.roundRect(cx - w*0.3, cy - h*0.17, w*0.6, h*0.14, 4); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx - w*0.3, cy + h*0.0, w*0.58, h*0.12, 4); ctx.fill();
            // Hatch rear window
            ctx.beginPath(); ctx.roundRect(cx - w*0.24, cy + h*0.14, w*0.5, h*0.08, 3); ctx.fill();

        } else {
            // ── Van / Minivan ──
            ctx.fillStyle = '#44aacc';
            ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
            // Boxy cabin
            ctx.fillStyle = '#2a7a9a';
            ctx.beginPath(); ctx.roundRect(cx - w*0.44, cy - h*0.3, w*0.88, h*0.52, 4); ctx.fill();
            ctx.fillStyle = 'rgba(180,230,255,0.55)';
            // Front windshield
            ctx.beginPath(); ctx.roundRect(cx - w*0.36, cy - h*0.28, w*0.72, h*0.15, 3); ctx.fill();
            // Row of 3 side windows
            for (let wi = 0; wi < 3; wi++) {
                const wy = cy - h*0.1 + wi * (h * 0.12);
                ctx.beginPath(); ctx.roundRect(cx - w*0.35, wy, w*0.7, h*0.09, 2); ctx.fill();
            }
            // Rear window
            ctx.beginPath(); ctx.roundRect(cx - w*0.36, cy + h*0.2, w*0.72, h*0.08, 3); ctx.fill();
            // Sliding door line
            ctx.strokeStyle = '#1a5a7a'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(cx + w*0.15, cy - h*0.1); ctx.lineTo(cx + w*0.15, cy + h*0.22); ctx.stroke();
            ctx.lineWidth = 1;
        }

        // ── Common: headlights, taillights, wheels (skip for motorcycle — drawn above) ──
        if (type !== 4) {
            ctx.fillStyle = '#fffde0';
            ctx.beginPath(); ctx.arc(x + w*0.22, y + 6, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + w*0.78, y + 6, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff3030';
            ctx.beginPath(); ctx.arc(x + w*0.22, y + h - 6, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + w*0.78, y + h - 6, 3.5, 0, Math.PI*2); ctx.fill();
            // Wheels — bigger for truck (type 5)
            const ww = type === 5 ? 10 : 9;
            const wh = type === 5 ? 18 : 16;
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.roundRect(x - ww + 2, y + 8, ww, wh, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x + w - 2, y + 8, ww, wh, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x - ww + 2, y + h - 8 - wh, ww, wh, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x + w - 2, y + h - 8 - wh, ww, wh, 3); ctx.fill();
            // Trucks get extra rear dual wheels
            if (type === 5) {
                ctx.beginPath(); ctx.roundRect(x - ww + 2,   y + h - 8 - wh - 14, ww, wh, 3); ctx.fill();
                ctx.beginPath(); ctx.roundRect(x + w - 2,    y + h - 8 - wh - 14, ww, wh, 3); ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
    }

    // Draw a life icon (small car silhouette) at x,y
    function drawLifeIcon(x, y) {
        const w = 16, h = 26;
        ctx.fillStyle = '#e03020';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = '#7a1010';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 6, w - 4, h * 0.4, 3);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(x - 2, y + 4, 4, 8, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x + w - 2, y + 4, 4, 8, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x - 2, y + h - 12, 4, 8, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x + w - 2, y + h - 12, 4, 8, 2);
        ctx.fill();
    }

    // Draw a spinning coin at cx, cy (phase precomputed at spawn)
    function drawCoin(cx, cy, ts, phase) {
        const spin   = Math.sin(ts * 0.004 + phase);
        const scaleX = Math.max(Math.abs(spin), 0.22);
        // Edge (visible when the coin is sideways)
        ctx.fillStyle = '#a07800';
        ctx.beginPath();
        ctx.ellipse(cx, cy, COIN_R * scaleX + 1.5, COIN_R + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        // Face
        ctx.fillStyle = '#f5c518';
        ctx.beginPath();
        ctx.ellipse(cx, cy, COIN_R * scaleX, COIN_R, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner ring
        ctx.fillStyle = '#c9a000';
        ctx.beginPath();
        ctx.ellipse(cx, cy, COIN_R * 0.55 * scaleX, COIN_R * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight arc
        ctx.strokeStyle = 'rgba(255,255,180,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx - 1.5 * scaleX, cy - 2, COIN_R * 0.38 * scaleX, COIN_R * 0.38, 0, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    // Draw a shield power-up at cx, cy with pulse animation
    function drawShield(cx, cy, pulse) {
        const pw = SHIELD_W + Math.sin(pulse) * 3;
        const ph = SHIELD_H + Math.sin(pulse) * 3;
        // Shield body — pentagon-like shape
        ctx.fillStyle = `rgba(80,180,255,${0.75 + 0.25 * Math.sin(pulse)})`;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ph / 2);
        ctx.lineTo(cx + pw / 2, cy - ph * 0.15);
        ctx.lineTo(cx + pw / 2, cy + ph * 0.22);
        ctx.lineTo(cx, cy + ph / 2);
        ctx.lineTo(cx - pw / 2, cy + ph * 0.22);
        ctx.lineTo(cx - pw / 2, cy - ph * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Center cross highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ph * 0.25);
        ctx.lineTo(cx, cy + ph * 0.1);
        ctx.moveTo(cx - pw * 0.22, cy - ph * 0.07);
        ctx.lineTo(cx + pw * 0.22, cy - ph * 0.07);
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    // ── Draw scene ────────────────────────────────────────────────────────────
    function drawGrass() {
        // Base grass
        ctx.fillStyle = '#2d5a1b';
        ctx.fillRect(0, 0, ROAD_X, CH);
        ctx.fillRect(ROAD_X_END, 0, CW - ROAD_X_END, CH);

        // Scrolling lighter mowing bands — strong motion cue on the sides
        const bandStep = 96;
        const bo = (roadOffset * 0.7) % bandStep;
        ctx.fillStyle = 'rgba(140,210,90,0.10)';
        for (let by = -bandStep + bo; by < CH; by += bandStep) {
            ctx.fillRect(0, by, ROAD_X - 6, 48);
            ctx.fillRect(ROAD_X_END + 6, by, CW - ROAD_X_END - 6, 48);
        }

        // Race kerbs: red base with scrolling white segments
        ctx.fillStyle = '#c03030';
        ctx.fillRect(ROAD_X - 6, 0, 6, CH);
        ctx.fillRect(ROAD_X_END, 0, 6, CH);
        const kerbStep = 26;
        const ko = roadOffset % (kerbStep * 2);
        ctx.fillStyle = '#e8e8e8';
        for (let ky = -kerbStep * 2 + ko; ky < CH; ky += kerbStep * 2) {
            ctx.fillRect(ROAD_X - 6, ky, 6, kerbStep);
            ctx.fillRect(ROAD_X_END, ky, 6, kerbStep);
        }
        // Scrolling dashed reference lines on grass edges — gives peripheral vision a
        // motion anchor that matches road speed, greatly reducing optical dizziness
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.setLineDash([22, 28]);
        ctx.lineDashOffset = -(roadOffset % 50);
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, CH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(CW - 10, 0); ctx.lineTo(CW - 10, CH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }

    function drawTree(x, y, r) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(x + 3, y + 4, r * 0.85, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
        // Dark base ring
        ctx.fillStyle = '#1a4a10';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        // Mid green
        ctx.fillStyle = '#2d7a1f';
        ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.72, 0, Math.PI * 2); ctx.fill();
        // Bright highlight
        ctx.fillStyle = '#3da82a';
        ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }

    function drawBush(x, y, r) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(x + 2, y + 3, r * 0.9, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e6b14';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a8c1e';
        ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.15, r * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#38a828';
        ctx.beginPath(); ctx.arc(x - r * 0.1, y - r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    function drawPlants() {
        for (const p of plants) {
            if (p.type === 'tree') drawTree(p.x, p.y, p.r);
            else drawBush(p.x, p.y, p.r);
        }
    }

    function drawRoad() {
        // Asphalt base
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(ROAD_X, 0, ROAD_W, CH);

        // Scrolling horizontal texture — subtle bands that scroll with road speed,
        // giving the asphalt visual depth and anchoring eye motion to reduce dizziness
        const texStep = 28;
        const texOff  = roadOffset % texStep;
        ctx.strokeStyle = 'rgba(0,0,0,0.09)';
        ctx.lineWidth = 2;
        for (let ty = -texOff; ty < CH; ty += texStep) {
            ctx.beginPath();
            ctx.moveTo(ROAD_X + 4, ty);
            ctx.lineTo(ROAD_X_END - 4, ty);
            ctx.stroke();
        }
        ctx.lineWidth = 1;

        // Yellow edge lines
        ctx.strokeStyle = '#f0c040';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ROAD_X + 2, 0);
        ctx.lineTo(ROAD_X + 2, CH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ROAD_X_END - 2, 0);
        ctx.lineTo(ROAD_X_END - 2, CH);
        ctx.stroke();

        // Dashed white lane dividers
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([DASH_H, DASH_GAP]);
        const offset = roadOffset % DASH_CYCLE;
        ctx.lineDashOffset = -offset;

        // Left divider (between lane 0 and 1)
        const div1X = ROAD_X + LANE_W;
        ctx.beginPath();
        ctx.moveTo(div1X, 0);
        ctx.lineTo(div1X, CH);
        ctx.stroke();

        // Right divider (between lane 1 and 2)
        const div2X = ROAD_X + LANE_W * 2;
        ctx.beginPath();
        ctx.moveTo(div2X, 0);
        ctx.lineTo(div2X, CH);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }

    function drawSpeedLines() {
        if (level < 4) return;
        const alpha = Math.min((level - 3) / 3, 1) * 0.35;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (const sl of speedLines) {
            ctx.beginPath();
            ctx.moveTo(sl.x, sl.y);
            ctx.lineTo(sl.x, sl.y + sl.len);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }

    function drawTireTracks() {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#111';
        for (const t of tireTracks) {
            ctx.fillRect(t.x - 3, t.y, 3, 5);
            ctx.fillRect(t.x + 3, t.y, 3, 5);
        }
        ctx.globalAlpha = 1;
    }

    function drawCoins(ts) {
        for (const c of coins) {
            if (!c.collected) drawCoin(c.x, c.y, ts, c.phase || 0);
        }
    }

    function drawExhaust() {
        ctx.fillStyle = '#999';
        for (const p of exhaust) {
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloatTexts() {
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        for (const f of floatTexts) {
            ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
            ctx.fillStyle = f.color;
            ctx.fillText(f.txt, f.x, f.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawShields() {
        for (const s of shields) {
            if (!s.collected) drawShield(s.x, s.y, s.pulse);
        }
    }

    function drawEnemies() {
        // Drop shadows first (batched: one fillStyle/alpha change for all)
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (const e of enemies) {
            ctx.beginPath();
            ctx.ellipse(e.x + 3, e.y + 4, e.w / 2 + 2, e.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const e of enemies) {
            drawEnemyVehicle(e.x, e.y, e.type, 1);
        }
    }

    function drawPlayer(ts) {
        const isShielded = invincible;
        const isHit      = hitInvincible;

        // Blink when hit-invincible
        if (isHit) {
            blinkOn = Math.floor(ts / 100) % 2 === 0;
            if (!blinkOn) return;
        } else {
            blinkOn = true;
        }

        const alpha = isShielded ? (0.75 + 0.25 * Math.sin(ts / 120)) : 1;

        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(playerAnimX + 3, CH - 80 + 4, PLAYER_W / 2 + 2, PLAYER_H / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield glow (drawn before car, outside loop constraint — one shadow call)
        if (isShielded) {
            ctx.shadowColor = '#50b4ff';
            ctx.shadowBlur = 18;
        }

        drawCar(playerAnimX, CH - 80, '#e03020', '#7a1010', true, alpha);

        if (isShielded) {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }
    }

    function drawHUD(ts) {
        // Lives — small car icons
        for (let i = 0; i < lives; i++) {
            drawLifeIcon(10 + i * 24, 8);
        }

        // Score text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Puntaje: ' + score, CW - 8, 24);

        // Level
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText('Nivel ' + level, CW - 8, 44);
        ctx.textAlign = 'left';

        // Shield indicator
        if (invincible) {
            const remaining = Math.ceil(invincibleTimer / 1000);
            ctx.fillStyle = '#50b4ff';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ESCUDO ' + remaining + 's', CW / 2, 20);
            ctx.textAlign = 'left';
        }

        // Speed lines overlay (top strip)
        drawSpeedLines();
    }

    function drawStartScreen() {
        // Translucent overlay
        ctx.fillStyle = 'rgba(24,24,24,0.72)';
        ctx.fillRect(0, 0, CW, CH);

        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAR RACING', CW / 2, CH / 2 - 40);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText('Presiona Iniciar para jugar', CW / 2, CH / 2 + 10);
        ctx.fillText('Flechas ← → para cambiar carril', CW / 2, CH / 2 + 36);
        ctx.fillText('Móvil: toca o desliza a los lados', CW / 2, CH / 2 + 60);

        ctx.textAlign = 'left';
    }

    // ── Update logic ──────────────────────────────────────────────────────────

    function updateRoad(dt) {
        roadOffset += roadSpeed * (dt / 16.67);
    }

    function updatePlayerLaneAnim(ts) {
        const elapsed = ts - laneAnimStart;
        if (elapsed >= LANE_ANIM_TIME) {
            playerAnimX = laneAnimTo;
        } else {
            const t = elapsed / LANE_ANIM_TIME;
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            playerAnimX = lerp(laneAnimFrom, laneAnimTo, ease);
        }
    }

    function updateEnemies(dt) {
        const playerBottom = CH - 80 + PLAYER_H / 2;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.y += e.speed * (dt / 16.67);

            // Near-miss bonus: enemy passed very close without hitting (weaving reward)
            if (!e.passed && e.y - e.h / 2 > playerBottom) {
                e.passed = true;
                if (!hitInvincible && Math.abs(e.x - playerAnimX) < 62) {
                    const oldScore = score;
                    score += 15;
                    floatTexts.push({ x: e.x, y: CH - 120, txt: '+15', color: '#7fe0ff', life: 700, maxLife: 700 });
                    checkLevelUp(oldScore, score);
                    updateUI();
                    GameAudio.score();
                }
            }

            if (e.y > CH + e.h + 10) {
                enemies.splice(i, 1);
            }
        }
    }

    function updateFloatTexts(dt) {
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const f = floatTexts[i];
            f.y    -= 0.7 * (dt / 16.67);
            f.life -= dt;
            if (f.life <= 0) floatTexts.splice(i, 1);
        }
    }

    function updateExhaust(dt) {
        exhaustTimer += dt;
        if (exhaustTimer >= 90) {
            exhaustTimer = 0;
            exhaust.push({
                x: playerAnimX + rand(-4, 4),
                y: CH - 80 + PLAYER_H / 2 + 4,
                r: rand(2, 4),
                alpha: 0.4,
                vx: rand(-0.25, 0.25),
            });
        }
        for (let i = exhaust.length - 1; i >= 0; i--) {
            const p = exhaust[i];
            p.y     += roadSpeed * 0.9 * (dt / 16.67);
            p.x     += p.vx * (dt / 16.67);
            p.r     += 0.06 * (dt / 16.67);
            p.alpha -= 0.012 * (dt / 16.67);
            if (p.alpha <= 0 || p.y > CH + 10) exhaust.splice(i, 1);
        }
    }

    function updateCoins(dt) {
        for (let i = coins.length - 1; i >= 0; i--) {
            const c = coins[i];
            c.y += roadSpeed * (dt / 16.67);
            if (c.y > CH + COIN_R + 10) {
                coins.splice(i, 1);
            }
        }
    }

    function updateShields(dt) {
        for (let i = shields.length - 1; i >= 0; i--) {
            const s = shields[i];
            s.y += roadSpeed * (dt / 16.67);
            s.pulse += 0.08;
            if (s.y > CH + SHIELD_H + 10) {
                shields.splice(i, 1);
            }
        }
    }

    function updatePlants(dt) {
        for (let i = plants.length - 1; i >= 0; i--) {
            const p = plants[i];
            p.y += p.speed * (dt / 16.67);
            if (p.y > CH + p.r * 2 + 10) plants.splice(i, 1);
        }
    }

    function updateTireTracks(dt) {
        for (let i = tireTracks.length - 1; i >= 0; i--) {
            tireTracks[i].y += roadSpeed * (dt / 16.67);
            tireTracks[i].life -= dt;
            if (tireTracks[i].y > CH + 10 || tireTracks[i].life <= 0) {
                tireTracks.splice(i, 1);
            }
        }
    }

    function updateSpeedLines(dt) {
        for (let i = speedLines.length - 1; i >= 0; i--) {
            const sl = speedLines[i];
            sl.y += roadSpeed * 2 * (dt / 16.67);
            if (sl.y > 80) {
                speedLines.splice(i, 1);
            }
        }
        // Spawn new speed lines proportional to level
        if (level >= 4 && Math.random() < 0.4) {
            speedLines.push({
                x: rand(ROAD_X, ROAD_X_END),
                y: 0,
                len: rand(20, 60)
            });
        }
    }

    function updateSpawnTimers(dt) {
        enemyTimer += dt;
        coinTimer  += dt;
        shieldTimer += dt;
        plantTimer += dt;

        if (enemyTimer >= enemyInterval() * 16.67) {
            spawnEnemy();
            enemyTimer = 0;
        }
        if (coinTimer >= 1800) {
            spawnCoin();
            coinTimer = 0;
        }
        if (shieldTimer >= 12000) {
            spawnShield();
            shieldTimer = 0;
        }
        if (plantTimer >= 700) {
            spawnPlant();
            plantTimer = 0;
        }
    }

    function updateScore(dt) {
        // Accumulate fractionally — flooring per frame gave ZERO score at low speeds
        const oldScore = score;
        scoreFloat += roadSpeed * dt / 80;
        if (scoreFloat >= 1) {
            const whole = Math.floor(scoreFloat);
            score += whole;
            scoreFloat -= whole;
            checkLevelUp(oldScore, score);
            updateUI();
        }
    }

    function updateCollisions() {
        // Shrunken hitboxes: fair collisions on rounded car corners
        const px = playerAnimX - PLAYER_W / 2 + HITBOX_PAD;
        const py = CH - 80 - PLAYER_H / 2 + HITBOX_PAD;
        const pw = PLAYER_W - HITBOX_PAD * 2;
        const ph = PLAYER_H - HITBOX_PAD * 2;

        // Enemy collisions
        if (!hitInvincible && !invincible) {
            for (const e of enemies) {
                const ex = e.x - e.w / 2 + 4;
                const ey = e.y - e.h / 2 + 4;
                if (rectOverlap(px, py, pw, ph, ex, ey, e.w - 8, e.h - 8)) {
                    handleCollision();
                    break;
                }
            }
        }

        // Coin collisions
        for (let i = coins.length - 1; i >= 0; i--) {
            const c = coins[i];
            if (!c.collected) {
                const dist = Math.hypot(playerAnimX - c.x, (CH - 80) - c.y);
                if (dist < PLAYER_W / 2 + COIN_R) {
                    c.collected = true;
                    const oldScore = score;
                    score += 20;
                    floatTexts.push({ x: c.x, y: c.y - 14, txt: '+20', color: '#ffd95e', life: 600, maxLife: 600 });
                    checkLevelUp(oldScore, score);
                    updateUI();
                    GameAudio.score();
                }
            }
        }

        // Shield collisions
        for (let i = shields.length - 1; i >= 0; i--) {
            const s = shields[i];
            if (!s.collected) {
                const dist = Math.hypot(playerAnimX - s.x, (CH - 80) - s.y);
                if (dist < PLAYER_W / 2 + SHIELD_W / 2) {
                    s.collected = true;
                    invincible = true;
                    invincibleTimer = INVINCIBLE_TIME;
                    GameAudio.powerUp ? GameAudio.powerUp() : GameAudio.scoreHigh();
                }
            }
        }
    }

    function updateInvincible(dt) {
        if (invincible) {
            invincibleTimer -= dt;
            if (invincibleTimer <= 0) {
                invincible = false;
                invincibleTimer = 0;
            }
        }
        if (hitInvincible) {
            hitInvincibleTimer -= dt;
            if (hitInvincibleTimer <= 0) {
                hitInvincible = false;
                hitInvincibleTimer = 0;
            }
        }
    }

    function updateShake() {
        if (shakeFrames > 0) {
            shakeX = rand(-6, 6);
            shakeY = rand(-6, 6);
            shakeFrames--;
        } else {
            shakeX = 0;
            shakeY = 0;
        }
    }

    function handleCollision() {
        lives--;
        updateUI();
        shakeFrames = 14;
        hitInvincible = true;
        hitInvincibleTimer = HIT_INVINCIBLE;
        GameAudio.explode();
        if (lives <= 0) {
            triggerGameOver();
        }
    }

    function triggerGameOver() {
        gameRunning = false;
        gameOver = true;
        if (score > highScore) {
            highScore = score;
            GameStore.set('carrace_hs', highScore);
        }
        highScoreEl.textContent = highScore;
        finalScore.textContent = 'Puntaje: ' + score;
        finalLevel.textContent = 'Nivel alcanzado: ' + level;
        popup.style.display = 'flex';
        startBtn.disabled = false;
        restartBtn.disabled = false;
        GameAudio.gameOver();
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    function loop(ts) {
        if (!gameRunning) return;

        const dt = ts - lastTs;
        lastTs = ts;

        // Throttle to ~60fps; skip if tab was in background
        if (dt < 5 || dt > 200) {
            rafId = requestAnimationFrame(loop);
            return;
        }

        // Update
        updateRoad(dt);
        updatePlayerLaneAnim(ts);
        updateEnemies(dt);
        updateCoins(dt);
        updateShields(dt);
        updatePlants(dt);
        updateTireTracks(dt);
        updateSpeedLines(dt);
        updateSpawnTimers(dt);
        updateScore(dt);
        updateCollisions();
        updateInvincible(dt);
        updateFloatTexts(dt);
        updateExhaust(dt);
        updateShake();

        // Draw
        ctx.save();
        ctx.translate(shakeX, shakeY);

        drawGrass();
        drawPlants();
        drawRoad();
        drawTireTracks();
        drawExhaust();
        drawCoins(ts);
        drawShields();
        drawEnemies();
        drawPlayer(ts);
        drawFloatTexts();
        drawHUD(ts);

        ctx.restore();

        // Mobile HUD
        if (mobileScore) {
            mobileScore.textContent = 'Puntaje: ' + score + '  |  Nivel: ' + level + '  |  Vidas: ' + lives;
        }

        rafId = requestAnimationFrame(loop);
    }

    // ── Game init ─────────────────────────────────────────────────────────────
    function resetGame() {
        score          = 0;
        level          = 1;
        lives          = 3;
        roadOffset     = 0;
        roadSpeed      = MIN_ROAD_SPEED;
        playerLane     = 1;
        playerX        = laneCenter(1);
        playerAnimX    = laneCenter(1);
        laneAnimFrom   = laneCenter(1);
        laneAnimTo     = laneCenter(1);
        invincible     = false;
        invincibleTimer = 0;
        hitInvincible  = false;
        hitInvincibleTimer = 0;
        shakeFrames    = 0;
        shakeX         = 0;
        shakeY         = 0;
        enemies.length  = 0;
        coins.length    = 0;
        shields.length  = 0;
        tireTracks.length = 0;
        speedLines.length = 0;
        plants.length = 0;
        floatTexts.length = 0;
        exhaust.length = 0;
        exhaustTimer   = 0;
        scoreFloat     = 0;
        enemyTimer     = 0;
        coinTimer      = 0;
        shieldTimer    = 0;
        plantTimer     = 0;
        gameOver       = false;
        updateUI();
    }

    function startGame() {
        if (rafId) cancelAnimationFrame(rafId);
        resetGame();
        popup.style.display = 'none';
        gameRunning = true;
        lastTs = performance.now();
        preSeedPlants();
        GameAudio.start();
        rafId = requestAnimationFrame(loop);
        gameControls.running();
    }

    function updateUI() {
        scoreEl.textContent     = score;
        highScoreEl.textContent = highScore;
        levelEl.textContent     = level;
    }

    // ── Static draw (before game starts) ─────────────────────────────────────
    function drawStaticScene() {
        preSeedPlants();
        drawGrass();
        drawPlants();
        drawRoad();
        drawCar(laneCenter(1), CH - 80, '#e03020', '#7a1010', true, 1);
        drawStartScreen();
    }
    drawStaticScene();
    highScoreEl.textContent = highScore;

    // ── Input handling ────────────────────────────────────────────────────────
    function changeLane(dir) {
        // dir: -1 = left, +1 = right
        const newLane = clamp(playerLane + dir, 0, 2);
        if (newLane === playerLane) return;
        laneAnimFrom  = playerAnimX;
        laneAnimTo    = laneCenter(newLane);
        laneAnimStart = performance.now();
        playerLane    = newLane;

        // Spawn tire track mark on turn
        tireTracks.push({
            x: playerAnimX,
            y: CH - 80 + PLAYER_H / 2 - 10,
            life: 800
        });
    }

    // Keyboard
    document.addEventListener('keydown', function (e) {
        if (!gameRunning) return;
        if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            changeLane(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            changeLane(1);
        }
    });

    // Touch — swipe left/right
    let touchStartX = null;
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
        }
    }, { passive: true });

    canvas.addEventListener('touchend', function (e) {
        if (!gameRunning) { touchStartX = null; return; }
        const endX  = e.changedTouches[0].clientX;
        const deltaX = touchStartX !== null ? endX - touchStartX : 0;
        touchStartX = null;
        if (Math.abs(deltaX) > 30) {
            // Swipe: move toward the swipe direction
            changeLane(deltaX < 0 ? -1 : 1);
        } else {
            // Tap: left half = lane left, right half = lane right
            const rect = canvas.getBoundingClientRect();
            changeLane(endX - rect.left < rect.width / 2 ? -1 : 1);
        }
    }, { passive: true });

    // Buttons
    var gameControls = GU.controls({ start: startGame, popup: 'gameOverPopup' });

})();

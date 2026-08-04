(function () {
    'use strict';

    const canvas = document.getElementById('dardosCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const scoreEl    = document.getElementById('score');
    const levelEl    = document.getElementById('level');
    const highScoreEl = document.getElementById('highScore');
    const startBtn   = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const gameOverPopup = document.getElementById('gameOverPopup');
    const finalScoreEl  = document.getElementById('finalScore');
    const finalBestEl   = document.getElementById('finalBest');
    const mobileScoreEl = document.getElementById('mobileScore');

    const BOARD_X  = W / 2;
    const BOARD_Y  = 210;
    const BOARD_R  = 90;
    const DART_SPEED = 7;
    const COLLISION_ANGLE = 0.19; // ~11°

    const LEVEL_CONFIGS = [
        { quota: 6,  speed: 0.018 },
        { quota: 8,  speed: 0.026 },
        { quota: 10, speed: 0.034 },
        { quota: 12, speed: 0.043 },
        { quota: 15, speed: 0.053 },
    ];

    // pre-computed star positions so render path has no Math.random
    const STARS = [
        [22,28],[55,82],[105,14],[188,52],[285,22],[325,74],
        [62,132],[145,88],[235,112],[305,148],[32,202],[175,172],
        [255,192],[348,98],[82,252],[205,228],[318,264],[152,304],
        [42,352],[262,318],[312,382],[92,402],[202,422],[348,442],
        [130,20],[290,60],[18,160],[340,200],[75,300],[220,360],
    ];

    let gameActive = false;
    let score = 0;
    let highScore = GameStore.getNum('dardos_hs', 0);
    let level = 1;
    let quota = 6;
    let landed = 0;
    let boardAngle = 0;
    let boardSpeed = 0.018;
    let stuckDarts = [];
    let flyingDart = null;
    const particles = new Particles(160);   // pooled, see game-utils.js
    let raf = null;
    let lastTime = 0;

    const DART_COLORS = ['#8fd3f4', '#ff512f', '#ffd700', '#7fff7f', '#ff80ab', '#c084fc'];

    function cfgFor(lvl) {
        let idx = Math.min(lvl - 1, LEVEL_CONFIGS.length - 1);
        let base = LEVEL_CONFIGS[idx];
        if (lvl > LEVEL_CONFIGS.length) {
            let extra = lvl - LEVEL_CONFIGS.length;
            return { quota: 15 + extra * 2, speed: 0.053 + extra * 0.009 };
        }
        return base;
    }

    function initGame() {
        score = 0;
        level = 1;
        boardAngle = 0;
        let cfg = cfgFor(1);
        quota = cfg.quota;
        landed = 0;
        boardSpeed = cfg.speed;
        stuckDarts = [];
        flyingDart = null;
        particles.clear();
        updateHUD();
    }

    function updateHUD() {
        scoreEl.textContent = score;
        levelEl.textContent = level;
        highScoreEl.textContent = highScore;
        if (mobileScoreEl) {
            mobileScoreEl.textContent = `Puntos: ${score}  Niv: ${level}  Récord: ${highScore}`;
        }
    }

    function launchDart() {
        if (!gameActive || flyingDart) return;
        flyingDart = { x: BOARD_X, y: H - 45 };
        GameAudio.shoot();
    }

    function spawnParticles(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            let angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            let spd = 1.8 + Math.random() * 2.5;
            particles.add(
                x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, {
                life: 1 / ((0.038 + Math.random() * 0.035) * 60),
                size: 2 + Math.random() * 2.5,
                color: color, gravity: 0.1
            });
        }
    }

    function checkLand() {
        if (!flyingDart) return;
        let dx = flyingDart.x - BOARD_X;
        let dy = flyingDart.y - BOARD_Y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > BOARD_R + 4) return;

        let globalAngle = Math.atan2(dy, dx);
        let relAngle = globalAngle - boardAngle;
        while (relAngle >  Math.PI) relAngle -= Math.PI * 2;
        while (relAngle < -Math.PI) relAngle += Math.PI * 2;

        // collision check
        for (let d of stuckDarts) {
            let diff = Math.abs(relAngle - d.rel);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < COLLISION_ANGLE) {
                spawnParticles(flyingDart.x, flyingDart.y, '#ff512f', 20);
                flyingDart = null;
                GameAudio.explode();
                triggerGameOver();
                return;
            }
        }

        // stick
        let color = DART_COLORS[stuckDarts.length % DART_COLORS.length];
        stuckDarts.push({ rel: relAngle, color });
        flyingDart = null;
        landed++;
        score++;

        let hitX = BOARD_X + Math.cos(globalAngle) * BOARD_R;
        let hitY = BOARD_Y + Math.sin(globalAngle) * BOARD_R;
        spawnParticles(hitX, hitY, color, 8);
        GameAudio.score();

        if (landed >= quota) {
            levelUp();
        }
        updateHUD();
    }

    function levelUp() {
        level++;
        landed = 0;
        stuckDarts = [];
        let cfg = cfgFor(level);
        quota = cfg.quota;
        boardSpeed = cfg.speed;
        score += 5;
        GameAudio.win();
        spawnParticles(BOARD_X, BOARD_Y, '#ffd700', 30);
    }

    function triggerGameOver() {
        gameActive = false;
        cancelAnimationFrame(raf);
        if (score > highScore) {
            highScore = score;
            GameStore.set('dardos_hs', highScore);
        }
        finalScoreEl.textContent = `Puntos: ${score}`;
        finalBestEl.textContent = score >= highScore && score > 0 ? '¡Nuevo récord!' : `Récord: ${highScore}`;
        gameOverPopup.style.display = 'flex';
        startBtn.disabled = false;
        restartBtn.disabled = false;
        GameAudio.gameOver();
        updateHUD();
    }

    // ── draw helpers ──────────────────────────────────────────────

    function drawBg() {
        ctx.fillStyle = '#120a24';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let [sx, sy] of STARS) ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    function drawBoard() {
        ctx.save();
        ctx.translate(BOARD_X, BOARD_Y);
        ctx.rotate(boardAngle);

        // rings (outermost to innermost)
        const rings = [
            { r: BOARD_R,        fill: '#1a0a2e' },
            { r: BOARD_R * 0.82, fill: '#2d1b4e' },
            { r: BOARD_R * 0.62, fill: '#1a0a2e' },
            { r: BOARD_R * 0.42, fill: '#3d2b5e' },
            { r: BOARD_R * 0.24, fill: '#ff512f' },
            { r: BOARD_R * 0.10, fill: '#fff'    },
        ];
        for (let ring of rings) {
            ctx.beginPath();
            ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
            ctx.fillStyle = ring.fill;
            ctx.fill();
            ctx.strokeStyle = 'rgba(143,211,244,0.3)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // sector lines
        ctx.strokeStyle = 'rgba(143,211,244,0.18)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            let a = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * BOARD_R, Math.sin(a) * BOARD_R);
            ctx.stroke();
        }

        // outer glow (set once, not per element)
        ctx.shadowColor = '#8fd3f4';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, BOARD_R, 0, Math.PI * 2);
        ctx.strokeStyle = '#8fd3f4';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // stuck darts (batch by similar state)
        ctx.lineCap = 'round';
        for (let d of stuckDarts) {
            let cos = Math.cos(d.rel);
            let sin = Math.sin(d.rel);
            let tx = cos * (BOARD_R - 2);
            let ty = sin * (BOARD_R - 2);

            ctx.strokeStyle = d.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + cos * 26, ty + sin * 26);
            ctx.stroke();

            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(tx, ty, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawFlyingDart() {
        if (!flyingDart) return;
        let x = flyingDart.x;
        let y = flyingDart.y;

        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 9;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x, y - 14);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y - 14, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawParticles() { particles.draw(ctx); }

    function drawGuide() {
        ctx.strokeStyle = 'rgba(143,211,244,0.3)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(BOARD_X, BOARD_Y + BOARD_R + 12);
        ctx.lineTo(BOARD_X, H - 58);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!flyingDart) {
            let pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(BOARD_X, H - 45, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.3 + 0.4 * pulse;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(BOARD_X, H - 45, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawProgress() {
        let bW = 200, bH = 10;
        let bX = (W - bW) / 2;
        let bY = BOARD_Y + BOARD_R + 22;
        let pct = landed / quota;

        ctx.fillStyle = 'rgba(36,36,36,0.7)';
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 5);
        ctx.fill();

        if (pct > 0) {
            let grad = ctx.createLinearGradient(bX, 0, bX + bW, 0);
            grad.addColorStop(0, '#8fd3f4');
            grad.addColorStop(1, '#ff512f');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(bX, bY, bW * pct, bH, 5);
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${landed} / ${quota} dardos`, W / 2, bY + bH + 4);
    }

    // ── update ────────────────────────────────────────────────────

    function update() {
        boardAngle += boardSpeed;
        if (boardAngle >= Math.PI * 2) boardAngle -= Math.PI * 2;

        if (flyingDart) {
            flyingDart.y -= DART_SPEED;
            checkLand();
        }

        particles.update();
    }

    function frame(ts) {
        if (!gameActive) return;
        let dt = ts - lastTime;
        if (dt >= 15) {
            lastTime = ts;
            update();
            drawBg();
            drawBoard();
            drawGuide();
            drawFlyingDart();
            drawParticles();
            drawProgress();
        }
        raf = requestAnimationFrame(frame);
    }

    function startGame() {
        gameOverPopup.style.display = 'none';
        initGame();
        gameActive = true;
        startBtn.disabled = true;
        restartBtn.disabled = false;
        GameAudio.start();
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
    }

    // ── idle screen ───────────────────────────────────────────────

    function drawIdle() {
        drawBg();
        ctx.save();
        ctx.translate(BOARD_X, BOARD_Y);
        const idleRings = [
            { r: BOARD_R,        fill: '#1a0a2e' },
            { r: BOARD_R * 0.82, fill: '#2d1b4e' },
            { r: BOARD_R * 0.62, fill: '#1a0a2e' },
            { r: BOARD_R * 0.42, fill: '#3d2b5e' },
            { r: BOARD_R * 0.24, fill: '#ff512f' },
            { r: BOARD_R * 0.10, fill: '#fff'    },
        ];
        for (let ring of idleRings) {
            ctx.beginPath();
            ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
            ctx.fillStyle = ring.fill;
            ctx.fill();
            ctx.strokeStyle = 'rgba(143,211,244,0.3)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        ctx.shadowColor = '#8fd3f4';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, BOARD_R, 0, Math.PI * 2);
        ctx.strokeStyle = '#8fd3f4';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.fillStyle = 'rgba(143,211,244,0.85)';
        ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Presiona Iniciar', W / 2, BOARD_Y + BOARD_R + 60);
    }

    // ── events ────────────────────────────────────────────────────

    startBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });
    restartBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });
    playAgainBtn.addEventListener('click', function () { GameAudio.click(); startGame(); });

    canvas.addEventListener('click', launchDart);
    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        launchDart();
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            launchDart();
        }
    });

    highScoreEl.textContent = highScore;
    drawIdle();
}());

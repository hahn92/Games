/* Comando Misil — Missile Command
 * Vanilla JS + Canvas. Defiende 6 ciudades de misiles enemigos.
 */
(function () {
    'use strict';

    var W = 480, H = 560;
    var GROUND_Y = H - 40;          // línea de suelo
    var BASE_X = W / 2;
    var BASE_Y = GROUND_Y;

    // Constantes de juego
    var ANTI_SPEED = 7.2;           // velocidad del antimisil del jugador
    var BLAST_MAX = 38;             // radio máximo de explosión
    var BLAST_GROW = 0.9;           // velocidad de crecimiento del radio
    var BLAST_HOLD = 14;            // frames que mantiene el radio máximo
    var ENEMY_BASE_SPEED = 0.55;    // velocidad base de misiles enemigos
    var CITY_COUNT = 6;
    var START_AMMO = 30;

    var canvas = document.getElementById('misilesCanvas');
    var ctx = canvas.getContext('2d');

    // Estado del juego
    var state = {
        running: false,
        over: false,
        between: false,      // pausa entre oleadas (mostrando bonus)
        score: 0,
        wave: 1,
        ammo: START_AMMO,
        cities: [],
        enemies: [],
        antis: [],
        blasts: [],
        particles: [],
        toSpawn: 0,          // misiles enemigos restantes por lanzar en esta oleada
        spawnTimer: 0,
        spawnInterval: 60,
        betweenTimer: 0,
        bonusText: '',
        shake: 0,
        flash: 0
    };

    var highScore = GameStore.getNum('misilesHighScore', 0);

    // Posiciones de las ciudades (3 a cada lado de la base)
    var cityXs = [];
    (function computeCityXs() {
        var slots = [0.10, 0.22, 0.34, 0.66, 0.78, 0.90];
        for (var i = 0; i < slots.length; i++) cityXs.push(slots[i] * W);
    }());

    // Cache de gradientes (cielo y suelo)
    var skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#060914');
    skyGrad.addColorStop(0.6, '#0a1530');
    skyGrad.addColorStop(1, '#11204a');
    var groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrad.addColorStop(0, '#1d3a2a');
    groundGrad.addColorStop(1, '#0c1a12');

    // Estrellas precomputadas (sin Math.random en render)
    var stars = [];
    (function makeStars() {
        for (var i = 0; i < 60; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * (GROUND_Y - 60),
                s: Math.random() < 0.8 ? 1 : 2,
                tw: Math.random() * Math.PI * 2
            });
        }
    }());

    /* ---------- Inicialización de oleada / partida ---------- */
    function makeCities() {
        state.cities = [];
        for (var i = 0; i < CITY_COUNT; i++) {
            state.cities.push({ x: cityXs[i], alive: true });
        }
    }

    function startWave() {
        state.between = false;
        state.enemies = [];
        state.antis = [];
        state.blasts = [];
        state.ammo = START_AMMO;
        var aliveCities = state.cities.filter(function (c) { return c.alive; }).length;
        // Más misiles y más rápidos cada oleada
        state.toSpawn = 8 + state.wave * 2;
        state.spawnInterval = Math.max(22, 60 - state.wave * 3);
        state.spawnTimer = 40;
    }

    function startGame() {
        state.running = true;
        state.over = false;
        state.between = false;
        state.score = 0;
        state.wave = 1;
        state.ammo = START_AMMO;
        state.enemies = [];
        state.antis = [];
        state.blasts = [];
        state.particles = [];
        state.shake = 0;
        state.flash = 0;
        makeCities();
        startWave();
        hidePopup();
        document.getElementById('restartBtn').disabled = false;
        GameAudio.start();
        updateHud();
    }

    /* ---------- Spawning enemigos ---------- */
    function spawnEnemy() {
        var sx = Math.random() * W;
        // objetivo: ciudad viva o base
        var targets = [];
        for (var i = 0; i < state.cities.length; i++) {
            if (state.cities[i].alive) targets.push(state.cities[i].x);
        }
        targets.push(BASE_X);
        var tx = targets[(Math.random() * targets.length) | 0];
        var ty = GROUND_Y;
        var dx = tx - sx, dy = ty - 0;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var speed = ENEMY_BASE_SPEED + state.wave * 0.07;
        // misiles que se dividen aparecen desde la oleada 3
        var canSplit = state.wave >= 3 && Math.random() < 0.25;
        state.enemies.push({
            x: sx, y: 0,
            sx: sx, sy: 0,         // origen (para dibujar estela larga)
            vx: dx / dist * speed,
            vy: dy / dist * speed,
            tx: tx, ty: ty,
            split: canSplit,
            splitY: 120 + Math.random() * 120,
            hue: canSplit ? 320 : 8,   // morado para los que se dividen
            trail: []
        });
    }

    function splitEnemy(e) {
        for (var k = 0; k < 2; k++) {
            var aliveCities = [];
            for (var i = 0; i < state.cities.length; i++) {
                if (state.cities[i].alive) aliveCities.push(state.cities[i].x);
            }
            aliveCities.push(BASE_X);
            var tx = aliveCities[(Math.random() * aliveCities.length) | 0] + (k === 0 ? -40 : 40);
            var dx = tx - e.x, dy = GROUND_Y - e.y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var speed = ENEMY_BASE_SPEED + state.wave * 0.07;
            state.enemies.push({
                x: e.x, y: e.y,
                sx: e.x, sy: e.y,
                vx: dx / dist * speed,
                vy: dy / dist * speed,
                tx: tx, ty: GROUND_Y,
                split: false, splitY: 0,
                hue: 8, trail: []
            });
        }
    }

    /* ---------- Disparo del jugador ---------- */
    function fireAnti(targetX, targetY) {
        if (!state.running || state.over || state.between) return;
        if (state.ammo <= 0) { GameAudio.miss(); return; }
        if (targetY > GROUND_Y - 6) targetY = GROUND_Y - 6;
        state.ammo--;
        var dx = targetX - BASE_X, dy = targetY - BASE_Y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        state.antis.push({
            x: BASE_X, y: BASE_Y,
            vx: dx / dist * ANTI_SPEED,
            vy: dy / dist * ANTI_SPEED,
            tx: targetX, ty: targetY,
            trail: []
        });
        GameAudio.shoot();
        updateHud();
    }

    function makeBlast(x, y, chain) {
        state.blasts.push({ x: x, y: y, r: 4, max: BLAST_MAX, growing: true, hold: BLAST_HOLD, chain: !!chain });
        // partículas con offsets precomputados
        var n = 10;
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            var sp = 1 + Math.random() * 2.5;
            state.particles.push({
                x: x, y: y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 1, decay: 0.02 + Math.random() * 0.02,
                r: 1.5 + Math.random() * 2,
                col: i % 2 === 0 ? '#ffd166' : '#ff7b3d'
            });
        }
    }

    function cityDebris(x) {
        for (var i = 0; i < 14; i++) {
            var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            var sp = 1.5 + Math.random() * 3;
            state.particles.push({
                x: x + (Math.random() - 0.5) * 24, y: GROUND_Y - 6,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 1, decay: 0.015 + Math.random() * 0.015,
                r: 1.5 + Math.random() * 2.5,
                col: i % 2 === 0 ? '#8fd3f4' : '#ff512f', grav: 0.08
            });
        }
    }

    /* ---------- Update ---------- */
    function update() {
        if (state.shake > 0) state.shake *= 0.9;
        if (state.flash > 0) state.flash -= 0.05;

        // Pausa entre oleadas: cuenta bonus
        if (state.between) {
            state.betweenTimer--;
            updateParticles();
            if (state.betweenTimer <= 0) {
                state.wave++;
                startWave();
                GameAudio.start();
            }
            return;
        }

        // Spawn de enemigos
        if (state.toSpawn > 0) {
            state.spawnTimer--;
            if (state.spawnTimer <= 0) {
                spawnEnemy();
                state.toSpawn--;
                state.spawnTimer = state.spawnInterval + (Math.random() * 20 - 10);
            }
        }

        // Antimisiles
        for (var i = state.antis.length - 1; i >= 0; i--) {
            var a = state.antis[i];
            a.trail.push({ x: a.x, y: a.y });
            if (a.trail.length > 12) a.trail.shift();
            a.x += a.vx; a.y += a.vy;
            var ddx = a.tx - a.x, ddy = a.ty - a.y;
            if (ddx * a.vx + ddy * a.vy <= 0) {
                makeBlast(a.tx, a.ty, false);
                GameAudio.explode();
                state.antis.splice(i, 1);
            }
        }

        // Enemigos
        for (var e = state.enemies.length - 1; e >= 0; e--) {
            var en = state.enemies[e];
            en.trail.push({ x: en.x, y: en.y });
            if (en.trail.length > 6) en.trail.shift();
            en.x += en.vx; en.y += en.vy;
            // división
            if (en.split && en.y >= en.splitY) {
                splitEnemy(en);
                state.enemies.splice(e, 1);
                continue;
            }
            // ¿llegó al suelo?
            if (en.y >= GROUND_Y) {
                impactGround(en.x);
                makeBlast(en.x, GROUND_Y, false);
                GameAudio.explode();
                state.enemies.splice(e, 1);
            }
        }

        // Explosiones expansivas
        for (var b = state.blasts.length - 1; b >= 0; b--) {
            var bl = state.blasts[b];
            if (bl.growing) {
                bl.r += BLAST_GROW;
                if (bl.r >= bl.max) { bl.r = bl.max; bl.growing = false; }
            } else {
                bl.hold--;
                if (bl.hold <= 0) bl.r -= 1.6;
            }
            // intercepta enemigos (reacción en cadena)
            for (var ei = state.enemies.length - 1; ei >= 0; ei--) {
                var ene = state.enemies[ei];
                var dx = ene.x - bl.x, dy = ene.y - bl.y;
                if (dx * dx + dy * dy <= bl.r * bl.r) {
                    state.score += 25;
                    makeBlast(ene.x, ene.y, true);   // cadena
                    state.enemies.splice(ei, 1);
                    GameAudio.hit();
                    updateHud();
                }
            }
            if (bl.r <= 0) state.blasts.splice(b, 1);
        }

        updateParticles();

        // ¿Oleada terminada?
        if (!state.between && state.toSpawn <= 0 && state.enemies.length === 0 && state.blasts.length === 0) {
            endWave();
        }

        // ¿Game over?
        var alive = state.cities.filter(function (c) { return c.alive; }).length;
        if (alive === 0 && !state.over) gameOver();
    }

    function updateParticles() {
        for (var p = state.particles.length - 1; p >= 0; p--) {
            var pt = state.particles[p];
            pt.x += pt.vx; pt.y += pt.vy;
            if (pt.grav) pt.vy += pt.grav;
            pt.vx *= 0.96; pt.vy *= 0.96;
            pt.life -= pt.decay;
            if (pt.life <= 0) state.particles.splice(p, 1);
        }
    }

    function impactGround(x) {
        // destruye ciudad más cercana si está en rango
        var hit = false;
        for (var i = 0; i < state.cities.length; i++) {
            var c = state.cities[i];
            if (c.alive && Math.abs(c.x - x) < 26) {
                c.alive = false;
                cityDebris(c.x);
                hit = true;
                break;
            }
        }
        state.shake = 12;
        state.flash = 0.4;
        updateHud();
    }

    function endWave() {
        state.between = true;
        state.betweenTimer = 150;
        var aliveCities = state.cities.filter(function (c) { return c.alive; }).length;
        var cityBonus = aliveCities * 100;
        var ammoBonus = state.ammo * 10;
        state.score += cityBonus + ammoBonus;
        state.bonusText = 'Ciudades x' + aliveCities + ' +' + cityBonus + '   Munición +' + ammoBonus;
        // recupera una ciudad cada 2 oleadas si hay sitio
        if (state.wave % 2 === 0) {
            var dead = state.cities.filter(function (c) { return !c.alive; });
            if (dead.length > 0) dead[0].alive = true;
        }
        GameAudio.win();
        updateHud();
    }

    function gameOver() {
        state.over = true;
        state.running = false;
        if (state.score > highScore) {
            highScore = state.score;
            GameStore.set('misilesHighScore', highScore);
        }
        GameAudio.gameOver();
        showPopup();
        updateHud();
    }

    /* ---------- Render ---------- */
    function draw() {
        var sx = 0, sy = 0;
        if (state.shake > 0.5) {
            sx = (Math.random() - 0.5) * state.shake;
            sy = (Math.random() - 0.5) * state.shake;
        }
        ctx.save();
        ctx.translate(sx, sy);

        // cielo
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-20, -20, W + 40, GROUND_Y + 20);

        // estrellas (fillRect, batch)
        ctx.fillStyle = '#cfe3ff';
        for (var i = 0; i < stars.length; i++) {
            var st = stars[i];
            ctx.globalAlpha = 0.4 + 0.4 * Math.sin(st.tw + performance.now() * 0.001);
            ctx.fillRect(st.x, st.y, st.s, st.s);
        }
        ctx.globalAlpha = 1;

        // suelo
        ctx.fillStyle = groundGrad;
        ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);

        drawCities();
        drawBase();
        drawEnemies();
        drawAntis();
        drawBlasts();
        drawParticles();

        // flash de impacto
        if (state.flash > 0) {
            ctx.fillStyle = 'rgba(255,80,40,' + (state.flash * 0.4) + ')';
            ctx.fillRect(-20, -20, W + 40, H + 40);
        }

        ctx.restore();

        drawHud();
        if (state.between) drawWaveBanner();
    }

    function drawCities() {
        for (var i = 0; i < state.cities.length; i++) {
            var c = state.cities[i];
            var x = c.x;
            if (c.alive) {
                ctx.fillStyle = '#1a4a6e';
                // edificios: tres torres
                ctx.fillRect(x - 18, GROUND_Y - 14, 8, 14);
                ctx.fillRect(x - 6, GROUND_Y - 22, 11, 22);
                ctx.fillRect(x + 8, GROUND_Y - 16, 8, 16);
                // ventanas (puntos cian)
                ctx.fillStyle = '#8fd3f4';
                ctx.fillRect(x - 3, GROUND_Y - 18, 2, 2);
                ctx.fillRect(x + 1, GROUND_Y - 14, 2, 2);
                ctx.fillRect(x - 15, GROUND_Y - 10, 2, 2);
                ctx.fillRect(x + 11, GROUND_Y - 12, 2, 2);
            } else {
                // ruinas
                ctx.fillStyle = '#33251f';
                ctx.fillRect(x - 16, GROUND_Y - 5, 32, 5);
                ctx.fillRect(x - 8, GROUND_Y - 8, 6, 8);
            }
        }
    }

    function drawBase() {
        var x = BASE_X, y = BASE_Y;
        // plataforma
        ctx.fillStyle = '#2a3a55';
        ctx.beginPath();
        ctx.moveTo(x - 22, y);
        ctx.lineTo(x + 22, y);
        ctx.lineTo(x + 14, y - 16);
        ctx.lineTo(x - 14, y - 16);
        ctx.closePath();
        ctx.fill();
        // cañón (un elemento clave: glow permitido)
        ctx.shadowBlur = state.ammo > 0 ? 10 : 0;
        ctx.shadowColor = '#8fd3f4';
        ctx.fillStyle = state.ammo > 0 ? '#8fd3f4' : '#555';
        ctx.fillRect(x - 4, y - 26, 8, 12);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0d1a30';
        ctx.fillRect(x - 2, y - 28, 4, 5);
    }

    function drawEnemies() {
        for (var i = 0; i < state.enemies.length; i++) {
            var en = state.enemies[i];
            // estela larga desde el origen
            ctx.strokeStyle = 'hsla(' + en.hue + ',90%,60%,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(en.sx, en.sy);
            ctx.lineTo(en.x, en.y);
            ctx.stroke();
            // cabeza brillante (fillRect pequeño, sin shadow por loop)
            ctx.fillStyle = 'hsl(' + en.hue + ',100%,70%)';
            ctx.fillRect(en.x - 2, en.y - 2, 4, 4);
        }
    }

    function drawAntis() {
        for (var i = 0; i < state.antis.length; i++) {
            var a = state.antis[i];
            ctx.strokeStyle = 'rgba(143,211,244,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var t = 0; t < a.trail.length; t++) {
                if (t === 0) ctx.moveTo(a.trail[t].x, a.trail[t].y);
                else ctx.lineTo(a.trail[t].x, a.trail[t].y);
            }
            ctx.lineTo(a.x, a.y);
            ctx.stroke();
            // marcador de objetivo
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.tx - 4, a.ty); ctx.lineTo(a.tx + 4, a.ty);
            ctx.moveTo(a.tx, a.ty - 4); ctx.lineTo(a.tx, a.ty + 4);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
        }
    }

    function drawBlasts() {
        for (var i = 0; i < state.blasts.length; i++) {
            var b = state.blasts[i];
            var grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, b.r));
            grad.addColorStop(0, b.chain ? 'rgba(255,220,140,0.95)' : 'rgba(255,255,255,0.95)');
            grad.addColorStop(0.5, b.chain ? 'rgba(255,140,60,0.8)' : 'rgba(143,211,244,0.7)');
            grad.addColorStop(1, 'rgba(255,80,40,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawParticles() {
        for (var i = 0; i < state.particles.length; i++) {
            var p = state.particles[i];
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.col;
            ctx.fillRect(p.x - p.r * 0.5, p.y - p.r * 0.5, p.r, p.r);
        }
        ctx.globalAlpha = 1;
    }

    function drawHud() {
        ctx.fillStyle = 'rgba(143,211,244,0.95)';
        ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Pts ' + state.score, 12, 24);
        ctx.textAlign = 'center';
        ctx.fillText('Oleada ' + state.wave, W / 2, 24);
        ctx.textAlign = 'right';
        // munición como puntos
        ctx.fillText('Munición ' + state.ammo, W - 12, 24);
    }

    function drawWaveBanner() {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, H / 2 - 56, W, 112);
        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡Oleada ' + state.wave + ' superada!', W / 2, H / 2 - 14);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 15px Segoe UI, Arial, sans-serif';
        ctx.fillText(state.bonusText, W / 2, H / 2 + 16);
        ctx.fillStyle = '#fff';
        ctx.font = '14px Segoe UI, Arial, sans-serif';
        ctx.fillText('Siguiente oleada en ' + Math.ceil(state.betweenTimer / 30) + 's', W / 2, H / 2 + 40);
    }

    /* ---------- HUD DOM / popup ---------- */
    function updateHud() {
        document.getElementById('score').textContent = state.score;
        document.getElementById('level').textContent = state.wave;
        document.getElementById('highScore').textContent = highScore;
        var ms = document.getElementById('mobileScore');
        if (ms) ms.textContent = 'Pts ' + state.score + '  ·  Oleada ' + state.wave + '  ·  Mun ' + state.ammo;
    }

    function showPopup() {
        document.getElementById('finalScore').textContent = 'Puntos: ' + state.score;
        var best = document.getElementById('finalBest');
        best.textContent = state.score >= highScore ? '¡Nuevo récord!' : 'Récord: ' + highScore;
        document.getElementById('gameOverPopup').style.display = 'flex';
    }

    function hidePopup() {
        document.getElementById('gameOverPopup').style.display = 'none';
    }

    /* ---------- Game loop ---------- */
    var lastFrameTs = 0;
    function loop(ts) {
        if (ts - lastFrameTs < 15) { requestAnimationFrame(loop); return; }
        lastFrameTs = ts;
        if (state.running && !state.over) update();
        draw();
        requestAnimationFrame(loop);
    }

    /* ---------- Input ---------- */
    function canvasPoint(clientX, clientY) {
        return GU.pointerPos(canvas, { clientX: clientX, clientY: clientY });
    }

    canvas.addEventListener('mousedown', function (ev) {
        if (!state.running) return;
        var p = canvasPoint(ev.clientX, ev.clientY);
        fireAnti(p.x, p.y);
    });
    canvas.addEventListener('touchstart', function (ev) {
        ev.preventDefault();
        if (!state.running) return;
        var t = ev.changedTouches[0];
        var p = canvasPoint(t.clientX, t.clientY);
        fireAnti(p.x, p.y);
    }, { passive: false });

    document.getElementById('startBtn').addEventListener('click', function () {
        GameAudio.click();
        startGame();
    });
    document.getElementById('restartBtn').addEventListener('click', function () {
        GameAudio.click();
        startGame();
    });
    document.getElementById('playAgainBtn').addEventListener('click', function () {
        GameAudio.click();
        startGame();
    });

    // Estado inicial de pantalla
    makeCities();
    updateHud();
    requestAnimationFrame(loop);
}());

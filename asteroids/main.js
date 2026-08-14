// Asteroids
var canvas = document.getElementById('asteroidsCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

// Constantes de juego
var EXTRA_LIFE_STEP = 5000;   // puntos entre vidas extra
var LEVEL_SPEED_STEP = 0.3;   // velocidad extra por nivel
var LEVEL_SPEED_CAP = 8;      // niveles a partir de los que ya no acelera

/* GU.keys ata por ACCIÓN y suelta todo al perder el foco: antes, alt-tab con el
 * empuje pulsado devolvía una nave acelerando sola contra un asteroide. Los
 * controles táctiles inyectan las mismas acciones con keys.set(), así que la
 * lógica consulta un solo sitio. */
var keys = GU.keys({
    left:   ['ArrowLeft', 'a'],
    right:  ['ArrowRight', 'd'],
    thrust: ['ArrowUp', 'w'],
    fire:   [' ']
}, { preventDefault: true });
var ship, bullets, asteroids, particles;
var thrustParticles = [];
// Valores iniciales reales: updateHUD() corre al cargar la página y sin esto
// el panel mostraba "undefined" hasta la primera partida.
var score = 0, highScore = 0, lives = 3, level = 1;
var isPlaying = false;
var animFrameId = null;
var invincible = 0;
var shipGlowPhase = 0;
var nextExtraLife = EXTRA_LIFE_STEP;
// Screen shake / flash al perder una vida (offsets precomputados en update)
/* La sacudida y el destello al morir estaban a medio hacer: `screenShake`,
 * `shakeOffX`, `shakeOffY` y `deathFlash` se asignaban al chocar contra un
 * asteroide y no los leía nadie, así que el efecto que describe la documentación
 * no llegaba a verse. Ahora van de verdad, sobre el Shake del toolkit — con
 * decaimiento independiente del framerate y desplazamientos elegidos en update(),
 * no en el dibujado. */
var shake = new Shake({ max: 14 });
var deathFlash = 0;

/* El récord va por GU.highScore: la comparación, la escritura y el valor
 * por defecto en un solo sitio. `highScore` se mantiene porque el resto
 * del fichero la usa. */
var gameBest = GU.highScore('asteroidsHigh');

highScore = gameBest.display(0);

// Star field — pequeños cuadrados blancos (estilo fruitcatcher)
var starField = [];
(function() {
    for (var i = 0; i < 160; i++) {
        starField.push({
            x: Math.random() * W,
            y: Math.random() * H,
            s: Math.random() < 0.28 ? 2 : 1,
            blink: Math.random() < 0.22,
            blinkPhase: Math.random() * Math.PI * 2,
            blinkSpeed: 0.018 + Math.random() * 0.03
        });
    }
})();

// Gradiente de fondo cacheado — azul espacio oscuro (igual que fruitcatcher)
var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
bgGrad.addColorStop(0, '#0d1b4b');
bgGrad.addColorStop(1, '#111e55');

// Gradientes cacheados. Los del casco/cabina viven en coordenadas locales de la
// nave (se dibujan tras translate/rotate) y los de asteroide sólo dependen del
// radio, así que se crean una vez en lugar de una vez por frame y por objeto.
var hullGrad = ctx.createLinearGradient(-14, 0, 18, 0);
hullGrad.addColorStop(0, '#4a8fa8');
hullGrad.addColorStop(0.5, '#8fd3f4');
hullGrad.addColorStop(1, '#c8eaf8');

var cockpitGrad = ctx.createRadialGradient(6, -2, 1, 6, -2, 7);
cockpitGrad.addColorStop(0, 'rgba(200,240,255,0.95)');
cockpitGrad.addColorStop(0.5, 'rgba(100,200,240,0.7)');
cockpitGrad.addColorStop(1, 'rgba(30,100,160,0.4)');

var astGrads = {};
function asteroidGrad(radius) {
    var g = astGrads[radius];
    if (!g) {
        g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        g.addColorStop(0, 'rgba(155,148,135,0.92)');
        g.addColorStop(1, 'rgba(72,68,60,0.88)');
        astGrads[radius] = g;
    }
    return g;
}

function Ship(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = 14;
    this.shootCooldown = 0;
}

Ship.prototype.update = function() {
    if (keys.down('left')) this.angle -= 0.06;
    if (keys.down('right')) this.angle += 0.06;
    var thrusting = keys.down('thrust');
    if (thrusting) {
        this.vx += Math.cos(this.angle) * 0.25;
        this.vy += Math.sin(this.angle) * 0.25;
        // Spawn thrust fire particles
        for (var i = 0; i < 3; i++) {
            var spread = (Math.random() - 0.5) * 0.5;
            var rearAngle = this.angle + Math.PI + spread;
            var speed = 2 + Math.random() * 3;
            thrustParticles.push({
                x: this.x + Math.cos(this.angle + Math.PI) * 10,
                y: this.y + Math.sin(this.angle + Math.PI) * 10,
                vx: Math.cos(rearAngle) * speed,
                vy: Math.sin(rearAngle) * speed,
                life: 10 + Math.random() * 8,
                maxLife: 18,
                size: 2 + Math.random() * 2
            });
        }
    }
    this.vx *= 0.98; this.vy *= 0.98;
    this.x = (this.x + this.vx + W) % W;
    this.y = (this.y + this.vy + H) % H;
    if (this.shootCooldown > 0) this.shootCooldown--;
    shipGlowPhase += 0.05;
};

Ship.prototype.draw = function() {
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    var glowIntensity = 4 + 3 * Math.sin(shipGlowPhase);

    // Ship body glow
    ctx.shadowColor = '#8fd3f4';
    ctx.shadowBlur = glowIntensity;

    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side fins
    ctx.fillStyle = 'rgba(143, 211, 244, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-12, 14);
    ctx.lineTo(-16, 10);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-12, -14);
    ctx.lineTo(-16, -10);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();

    // Cockpit dome
    ctx.shadowBlur = 0;
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.ellipse(6, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
};

Ship.prototype.shoot = function() {
    if (this.shootCooldown > 0) return;
    bullets.push({
        x: this.x + Math.cos(this.angle) * 18,
        y: this.y + Math.sin(this.angle) * 18,
        vx: Math.cos(this.angle) * 9 + this.vx,
        vy: Math.sin(this.angle) * 9 + this.vy,
        life: 55,
        trail: []
    });
    this.shootCooldown = 12;
    GameAudio.shoot();
};

function createAsteroid(x, y, size) {
    var angle = Math.random() * Math.PI * 2;
    // La progresión se aplana a partir de LEVEL_SPEED_CAP: con el +0.5*level
    // original los asteroides pequeños del nivel 10 iban a 7 px/frame y el nivel
    // era imposible de leer.
    var speed = (0.8 + Math.random() * 0.8) * (4 - size) * 0.5
              + LEVEL_SPEED_STEP * Math.min(level - 1, LEVEL_SPEED_CAP);
    var pts = [];
    var n = 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var r = (size === 3 ? 38 : size === 2 ? 22 : 12) * (0.75 + Math.random() * 0.5);
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return {
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size, pts: pts,
        radius: size === 3 ? 38 : size === 2 ? 22 : 12,
        angle: 0, spin: (Math.random()-0.5)*0.04,
        trail: [] // last 5 positions for trail
    };
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
        particles.push({ x: x, y: y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 30 + Math.random()*20, color: color, square: true });
    }
}

// Triangular explosion fragments
function spawnFragments(x, y, size) {
    var count = size === 3 ? 8 : size === 2 ? 6 : 4;
    for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        var speed = 1.5 + Math.random() * 2.5;
        var fragSize = (size === 3 ? 12 : size === 2 ? 8 : 5) * (0.6 + Math.random() * 0.6);
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 25 + Math.random() * 20,
            maxLife: 45,
            color: '#aaa',
            square: false,
            fragSize: fragSize,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.2
        });
    }
}

function drawAsteroid(a) {
    // Estela (últimas 5 posiciones). Sin save()/restore() por iteración: se
    // deshace la transformación a mano, que es mucho más barato.
    ctx.strokeStyle = '#9090a8';
    ctx.lineWidth = 1;
    for (var t = 0; t < a.trail.length; t++) {
        var trailPos = a.trail[t];
        ctx.globalAlpha = (t + 1) / (a.trail.length + 1) * 0.35;
        ctx.translate(trailPos.x, trailPos.y);
        ctx.rotate(trailPos.angle);
        ctx.beginPath();
        ctx.moveTo(a.pts[0].x, a.pts[0].y);
        for (var i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.rotate(-trailPos.angle);
        ctx.translate(-trailPos.x, -trailPos.y);
    }

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.globalAlpha = 1;

    // Fill — gris rocoso opaco, visible sobre fondo oscuro (gradiente cacheado)
    var astGrad = asteroidGrad(a.radius);

    ctx.beginPath();
    ctx.moveTo(a.pts[0].x, a.pts[0].y);
    for (var i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
    ctx.closePath();
    ctx.fillStyle = astGrad;
    ctx.fill();

    ctx.strokeStyle = '#c8bfaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function circle(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

// Envuelve la posición y avisa si cruzó el borde: al teletransportarse hay que
// vaciar la estela, o queda dibujada una línea de fantasmas cruzando la pantalla.
function wrap(obj) {
    var wrapped = false;
    if (obj.x < 0 || obj.x >= W) { obj.x = (obj.x + W) % W; wrapped = true; }
    if (obj.y < 0 || obj.y >= H) { obj.y = (obj.y + H) % H; wrapped = true; }
    if (wrapped && obj.trail) obj.trail.length = 0;
    return wrapped;
}

function update() {
    /* Los offsets se eligen aquí, no en draw(): un frame repintado dos veces
     * tiene que salir igual las dos veces. */
    shake.update();
    if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - 0.05);

    ship.update();
    if (keys.down('fire')) ship.shoot();

    // Update thrust particles
    for (var i = thrustParticles.length - 1; i >= 0; i--) {
        var tp = thrustParticles[i];
        tp.x += tp.vx; tp.y += tp.vy;
        tp.life--;
        if (tp.life <= 0) thrustParticles.splice(i, 1);
    }

    // Bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        // Store trail positions
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 4) b.trail.pop();

        b.x += b.vx; b.y += b.vy; b.life--;
        wrap(b);
        if (b.life <= 0) { bullets.splice(i, 1); continue; }
        // Hit asteroid
        for (var j = asteroids.length - 1; j >= 0; j--) {
            var a = asteroids[j];
            if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius) {
                bullets.splice(i, 1);
                spawnFragments(a.x, a.y, a.size);
                var pts = a.size === 3 ? 20 : a.size === 2 ? 10 : 5;
                score += pts;
                grantExtraLives();
                if (a.size > 1) {
                    asteroids.push(createAsteroid(a.x, a.y, a.size - 1));
                    asteroids.push(createAsteroid(a.x, a.y, a.size - 1));
                }
                asteroids.splice(j, 1);
                updateHUD();
                GameAudio.explode();
                GameAudio.score();
                break;
            }
        }
    }

    // Asteroids
    for (var i = 0; i < asteroids.length; i++) {
        var a = asteroids[i];
        // Store trail
        a.trail.unshift({ x: a.x, y: a.y, angle: a.angle });
        if (a.trail.length > 5) a.trail.pop();

        a.x += a.vx; a.y += a.vy;
        a.angle += a.spin;
        wrap(a);
        // Hit ship
        if (invincible <= 0 && Math.hypot(ship.x - a.x, ship.y - a.y) < a.radius + ship.radius) {
            spawnParticles(ship.x, ship.y, '#8fd3f4', 15);
            spawnFragments(ship.x, ship.y, 2);
            shake.hit(14);
            deathFlash = 1;
            lives--;
            updateHUD();
            GameAudio.explode();
            if (lives <= 0) { gameOver(); return; }
            ship.x = W/2; ship.y = H/2; ship.vx = 0; ship.vy = 0;
            ship.angle = -Math.PI / 2;
            invincible = 120;
        }
    }

    // Particles
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        if (!p.square && p.rotSpeed) p.rotation += p.rotSpeed;
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (invincible > 0) invincible--;

    if (asteroids.length === 0) {
        level++;
        spawnLevel();
    }
}

function draw() {
    // Fondo azul espacio oscuro. Se pinta ANTES de aplicar la sacudida: si se
    // desplazara con el resto, por el borde contrario asomaría una franja sin
    // pintar del frame anterior.
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }

    // Estrellas — cuadraditos blancos con parpadeo opcional
    for (var i = 0; i < starField.length; i++) {
        var st = starField[i];
        var alpha = 0.45;
        if (st.blink) {
            st.blinkPhase += st.blinkSpeed;
            alpha = 0.12 + 0.45 * (0.5 + 0.5 * Math.sin(st.blinkPhase));
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // Asteroids with trails
    for (var i = 0; i < asteroids.length; i++) drawAsteroid(asteroids[i]);

    // Bullets: trails first without glow, then every head in one glowing
    // batch. shadowBlur is the most expensive canvas state there is, so it is
    // set once for the batch instead of toggled on and off per bullet.
    // (This puts all heads above all trails; with 3px dots under a <=0.4 alpha
    // trail the z-order is not perceptible.)
    ctx.fillStyle = '#ff8060';
    for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        for (var t = 0; t < b.trail.length; t++) {
            var tAlpha = (b.trail.length - t) / b.trail.length * 0.4;
            var tRadius = 2 * (1 - t / b.trail.length);
            ctx.globalAlpha = tAlpha;
            ctx.beginPath();
            ctx.arc(b.trail[t].x, b.trail[t].y, tRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff512f';
    ctx.fillStyle = '#ff9060';
    for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Thrust fire particles
    for (var i = 0; i < thrustParticles.length; i++) {
        var tp = thrustParticles[i];
        var t = tp.life / tp.maxLife;
        // Color: white-hot -> orange -> red -> transparent
        var r = 255, g = Math.floor(180 * t), bl = Math.floor(80 * t);
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, tp.size * t, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Particles (square debris + triangle fragments)
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var maxL = p.maxLife || 50;
        ctx.globalAlpha = p.life / maxL;
        if (p.square) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        } else {
            // Triangular fragment
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation || 0);
            var fs = p.fragSize || 6;
            ctx.fillStyle = p.color;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -fs);
            ctx.lineTo(fs * 0.7, fs * 0.5);
            ctx.lineTo(-fs * 0.7, fs * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.globalAlpha = 1;

    ship.draw();

    if (shaking) ctx.restore();

    // Destello rojo al perder una vida. Va fuera de la sacudida y cubre el
    // canvas entero, así que tiene que ir después del restore o quedaría
    // desplazado y dejaría una banda sin cubrir.
    if (deathFlash > 0) {
        ctx.globalAlpha = deathFlash * 0.35;
        ctx.fillStyle = '#ff512f';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    /* Zonas táctiles, muy tenues.
     *
     * Aquí había un `var W = canvas.width, H = canvas.height;` y costaba el
     * juego entero: `var` se iza al principio de draw(), así que W y H quedaban
     * SOMBREADAS y valían undefined en la primera línea de la función — la que
     * pinta el fondo. Ese fillRect(0,0,undefined,undefined) no pintaba nada, el
     * canvas no se limpiaba nunca, y estas franjas blancas al 8% se acumulaban
     * frame tras frame hasta dejar el espacio en blanco. Se usan las globales. */
    if (isPlaying) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#fff';
        // Zona izquierda
        ctx.fillRect(0, 0, W * 0.30, H);
        // Zona derecha
        ctx.fillRect(W * 0.70, 0, W * 0.30, H);
        // Zona central
        ctx.fillRect(W * 0.30, 0, W * 0.40, H);
        ctx.globalAlpha = 1;

        // Iconos de zona (muy sutiles)
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#8fd3f4';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('◄', W * 0.15, H * 0.92);
        ctx.fillText('▲', W * 0.50, H * 0.92);
        ctx.fillText('►', W * 0.85, H * 0.92);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}

var gameHud = GU.hud({
    score: document.getElementById('score'),
    highScore: document.getElementById('highScore'),
    lives: document.getElementById('lives'),
    mobile: { el: document.getElementById('mobileScore'), format: function () {
        return 'P:' + score + ' V:' + lives;
    } }
});

function updateHUD() {
    gameBest.submit(score);
    highScore = gameBest.display(0);
    gameHud.set({ score: score, highScore: highScore, lives: lives });
}

var lastFrameTs = 0;
function gameLoop(ts) {
    if (!isPlaying) return;
    // Throttle to ~60fps on high-refresh screens
    if (ts - lastFrameTs < 15) { animFrameId = requestAnimationFrame(gameLoop); return; }
    lastFrameTs = ts;
    update();
    draw();
    animFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    GameAudio.start();
    ship = new Ship(W/2, H/2);
    bullets = []; asteroids = []; particles = []; thrustParticles = [];
    score = 0; lives = 3; level = 1; invincible = 0; shipGlowPhase = 0;
    shake.stop(); deathFlash = 0;   // una partida nueva no hereda la muerte anterior
    isPlaying = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    gameControls.running();
    spawnLevel();
    updateHUD();
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    cancelAnimationFrame(animFrameId);
    draw();
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    gameControls.idle();
}

// Keyboard


// Touch controls
var btnRotLeft = document.getElementById('btnRotLeft');
var btnRotRight = document.getElementById('btnRotRight');
var btnThrust = document.getElementById('btnThrust');
var btnFire = document.getElementById('btnFire');

function addHold(btn, action) {
    if (!btn) return;
    var down = function (e) { if (e && e.cancelable) e.preventDefault(); keys.set(action, true); };
    var up   = function () { keys.set(action, false); };
    btn.addEventListener('mousedown', down);
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('mouseup', up);
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);
    btn.addEventListener('mouseleave', up);
}
addHold(btnRotLeft, 'left');
addHold(btnRotRight, 'right');
addHold(btnThrust, 'thrust');
addHold(btnFire, 'fire');

var gameControls = GU.controls({ start: startGame, popup: 'gameOverPopup' });

// Canvas touch zone controls (virtual joystick by zones)
(function() {
    var W = canvas.width, H = canvas.height;
    var touchZones = {};
    var touchStartTime = {};
    var touchStartPos = {};

    function getZone(x, y) {
        var leftBound = W * 0.30;
        var rightBound = W * 0.70;
        if (x < leftBound) return 'left';
        if (x > rightBound) return 'right';
        return 'center';
    }

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var rect = canvas.getBoundingClientRect();
            var cx = (t.clientX - rect.left) * (W / rect.width);
            var cy = (t.clientY - rect.top) * (H / rect.height);
            var zone = getZone(cx, cy);
            touchZones[t.identifier] = zone;
            touchStartTime[t.identifier] = Date.now();
            touchStartPos[t.identifier] = { x: cx, y: cy };
            if (zone === 'left')   keys.set('left', true);
            if (zone === 'right')  keys.set('right', true);
            if (zone === 'center') keys.set('thrust', true);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var zone = touchZones[t.identifier];
            var dt = Date.now() - (touchStartTime[t.identifier] || 0);
            var startPos = touchStartPos[t.identifier] || {};
            var rect = canvas.getBoundingClientRect();
            var cx = (t.clientX - rect.left) * (W / rect.width);
            var cy = (t.clientY - rect.top) * (H / rect.height);
            var moved = Math.hypot(cx - (startPos.x || 0), cy - (startPos.y || 0));

            // Tap rápido (< 250ms, sin mucho movimiento) = disparar
            if (dt < 250 && moved < 30) {
                keys.set('fire', true);
                setTimeout(function() { keys.set('fire', false); }, 80);
            }

            if (zone === 'left')   keys.set('left', false);
            if (zone === 'right')  keys.set('right', false);
            if (zone === 'center') keys.set('thrust', false);

            delete touchZones[t.identifier];
            delete touchStartTime[t.identifier];
            delete touchStartPos[t.identifier];
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var zone = touchZones[t.identifier];
            if (zone === 'left')   keys.set('left', false);
            if (zone === 'right')  keys.set('right', false);
            if (zone === 'center') keys.set('thrust', false);
            delete touchZones[t.identifier];
        }
    }, { passive: false });

    // Ocultar botones de touchControls al usar controles de canvas
    var tc = document.getElementById('touchControls');
    if (tc) tc.style.display = 'none';
})();

// Init draw
ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);  // fondo inicial
updateHUD();

/* Ciempiés — el bicho baja serpenteando por un campo de setas y tú disparas
 * desde abajo.
 *
 * Lo que hace que esto sea Ciempiés y no un marciano cualquiera: al reventar un
 * segmento del medio, el bicho se PARTE EN DOS y cada mitad sigue por su cuenta.
 * Cuantos más tiros aciertas, más bichos independientes tienes encima. Y cada
 * segmento destruido deja una seta, que a su vez desvía a los que vengan — así
 * que el propio jugador va construyendo el laberinto que le complica el nivel.
 *
 * El cuerpo se guarda como una LISTA DE SEGMENTOS con posición propia, no como
 * una cadena que sigue a la cabeza: partirla es entonces cortar el array en dos,
 * y no hay que rehacer ningún encadenamiento. */
(function () {
'use strict';

var canvas = document.getElementById('cpCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 560

var CELL = 20;
var COLS = W / CELL;              // 20
var ROWS = H / CELL;              // 28
var PLAYER_ROWS = 5;              // filas de abajo donde el jugador se mueve

var SEG_R = 8;
var BULLET_SPEED = 460;           // px/s
var FIRE_COOLDOWN = 0.16;         // s

var mushrooms = [];               // [col][row] = vida 0..4
var centipedes = [];              // [{segs:[{c,r,x,y}], dir, down, speed, timer}]
var bullets = [];
var player = { x: W / 2, y: H - CELL * 1.5, w: 18, h: 16 };
var fireTimer = 0;

var score = 0, lives = 3, level = 1;
var status = 'idle';              // idle | playing | dead | over

var shake = new Shake({ decay: 0.86, max: 14 });
var fx    = new Particles(300);
var gMemo = GU.gradientMemo();
var best  = GU.highScore('ciempiesBest');

var hud = GU.hud({
    score: 'score',
    lives: 'livesLabel',
    level: 'levelLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return score + ' pts  ·  Vidas ' + lives + '  ·  Nivel ' + level;
    } }
});

/* ── Campo ────────────────────────────────────────────────────────── */

function seedMushrooms() {
    mushrooms = [];
    for (var c = 0; c < COLS; c++) {
        mushrooms[c] = [];
        for (var r = 0; r < ROWS; r++) mushrooms[c][r] = 0;
    }
    var n = 22 + level * 3;
    for (var i = 0; i < n; i++) {
        var cc = GU.randInt(0, COLS - 1);
        /* Ni en la fila 0 (donde entra el bicho) ni en las dos últimas del
         * jugador: una seta ahí lo dejaría encerrado nada más empezar. */
        var rr = GU.randInt(1, ROWS - 3);
        mushrooms[cc][rr] = 4;
    }
}

function spawnCentipede() {
    var len = Math.min(12, 8 + level);
    var segs = [];
    for (var i = 0; i < len; i++) {
        segs.push({ c: -i, r: 0, x: (-i + 0.5) * CELL, y: 0.5 * CELL });
    }
    centipedes = [{ segs: segs, dir: 1, down: false, speed: 3.2 + level * 0.45, timer: 0 }];
}

function startLevel() {
    seedMushrooms();
    spawnCentipede();
    bullets = [];
    fx.clear();
    player.x = W / 2;
    player.y = H - CELL * 1.5;
    status = 'playing';
    syncHud();
}

function startGame() {
    score = 0; lives = 3; level = 1;
    startLevel();
    gameControls.running();
    over.hide();
    GameAudio.start();
}

/* ── Movimiento del bicho ─────────────────────────────────────────── */

/* Se mueve por celdas a `speed` pasos por segundo. Al chocar contra una seta,
 * contra un borde o contra otro segmento, baja una fila e invierte el sentido:
 * eso es lo que lo hace serpentear y lo que convierte las setas en un laberinto. */
function stepCentipede(cp, dt) {
    cp.timer += dt * cp.speed;
    while (cp.timer >= 1) {
        cp.timer -= 1;
        var head = cp.segs[0];
        var nc = head.c + cp.dir;
        var nr = head.r;

        var blocked = nc < 0 || nc >= COLS ||
                      (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && mushrooms[nc][nr] > 0);

        if (blocked) {
            nc = head.c;
            nr = head.r + 1;
            cp.dir *= -1;
            if (nr >= ROWS) {
                /* Llegó abajo: vuelve arriba de la zona del jugador en vez de
                 * salirse. Si no, el nivel se quedaría sin bicho y sin final. */
                nr = ROWS - PLAYER_ROWS;
            }
        }

        /* El cuerpo sigue a la cabeza por la vía clásica: cada segmento hereda
         * la celda del que va delante. */
        for (var i = cp.segs.length - 1; i > 0; i--) {
            cp.segs[i].c = cp.segs[i - 1].c;
            cp.segs[i].r = cp.segs[i - 1].r;
        }
        head.c = nc; head.r = nr;

        for (var j = 0; j < cp.segs.length; j++) {
            cp.segs[j].x = (cp.segs[j].c + 0.5) * CELL;
            cp.segs[j].y = (cp.segs[j].r + 0.5) * CELL;
        }
    }
}

/* ── Disparo y colisiones ─────────────────────────────────────────── */

function fire() {
    if (status !== 'playing' || fireTimer > 0) return;
    bullets.push({ x: player.x, y: player.y - 10 });
    fireTimer = FIRE_COOLDOWN;
    GameAudio.shoot();
}

function hitSegment(cpIdx, segIdx, x, y) {
    var cp = centipedes[cpIdx];
    var seg = cp.segs[segIdx];

    /* Cada segmento muerto planta una seta donde cayó: el campo se va cerrando
     * a medida que juegas, que es el motor de dificultad del original. */
    if (seg.c >= 0 && seg.c < COLS && seg.r >= 0 && seg.r < ROWS) {
        mushrooms[seg.c][seg.r] = 4;
    }

    fx.burst(x, y, 12, { color: '#8fff6a', speed: 120, life: 0.5, size: 2.5 });
    score += 10 + level;
    GameAudio.explode();

    /* Aquí está el corazón del juego: partir el cuerpo en dos trozos
     * independientes. La parte de delante conserva el sentido; la de atrás
     * arranca con la cabeza nueva en el segmento siguiente. */
    var front = cp.segs.slice(0, segIdx);
    var back  = cp.segs.slice(segIdx + 1);
    centipedes.splice(cpIdx, 1);
    if (front.length) centipedes.push({ segs: front, dir: cp.dir, speed: cp.speed, timer: cp.timer });
    if (back.length)  centipedes.push({ segs: back,  dir: cp.dir, speed: cp.speed, timer: cp.timer });

    if (!centipedes.length) {
        level++;
        score += 100;
        GameAudio.win();
        setTimeout(function () { if (status === 'playing') startLevel(); }, 900);
    }
    syncHud();
}

function updateBullets(dt) {
    for (var b = bullets.length - 1; b >= 0; b--) {
        var bl = bullets[b];
        bl.y -= BULLET_SPEED * dt;
        if (bl.y < -8) { bullets.splice(b, 1); continue; }

        var c = Math.floor(bl.x / CELL), r = Math.floor(bl.y / CELL);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS && mushrooms[c][r] > 0) {
            mushrooms[c][r]--;
            /* Una seta aguanta cuatro tiros. Que cueste es lo que impide abrir
             * un pasillo cómodo a base de disparar al suelo. */
            if (mushrooms[c][r] === 0) score += 1;
            bullets.splice(b, 1);
            GameAudio.hit();
            syncHud();
            continue;
        }

        var done = false;
        for (var i = 0; i < centipedes.length && !done; i++) {
            var segs = centipedes[i].segs;
            for (var j = 0; j < segs.length; j++) {
                if (GU.dist2(bl.x, bl.y, segs[j].x, segs[j].y) < SEG_R * SEG_R * 1.6) {
                    bullets.splice(b, 1);
                    hitSegment(i, j, segs[j].x, segs[j].y);
                    done = true;
                    break;
                }
            }
        }
    }
}

function checkPlayerHit() {
    for (var i = 0; i < centipedes.length; i++) {
        var segs = centipedes[i].segs;
        for (var j = 0; j < segs.length; j++) {
            if (GU.dist2(player.x, player.y, segs[j].x, segs[j].y) < (SEG_R + 9) * (SEG_R + 9)) {
                loseLife();
                return;
            }
        }
    }
}

function loseLife() {
    lives--;
    shake.hit(14);
    fx.burst(player.x, player.y, 26, { color: '#ff512f', speed: 150, life: 0.8, size: 3 });
    GameAudio.explode();
    syncHud();
    if (lives <= 0) { endGame(); return; }
    status = 'dead';
    setTimeout(function () {
        if (status !== 'dead') return;
        /* Reaparecer con el bicho encima sería una muerte gratis, así que se
         * limpia la zona baja de segmentos antes de devolver el control. */
        spawnCentipede();
        player.x = W / 2;
        bullets = [];
        status = 'playing';
    }, 900);
}

function endGame() {
    status = 'over';
    var record = best.submit(score);
    syncHud();
    gameControls.idle();
    over.show({
        overScore: 'Puntuación: ' + score,
        overLevel: 'Nivel alcanzado: ' + level
    });
    GameAudio.gameOver();
}

function syncHud() {
    hud.set({ score: score, lives: Math.max(0, lives), level: level, best: best.display(0) });
}

/* ── Bucle ────────────────────────────────────────────────────────── */

function update(dt) {
    if (fireTimer > 0) fireTimer -= dt;
    if (status !== 'playing') return;

    var speed = 210 * dt;
    if (keys.down('left'))  player.x -= speed;
    if (keys.down('right')) player.x += speed;
    if (keys.down('up'))    player.y -= speed;
    if (keys.down('down'))  player.y += speed;
    if (keys.down('fire'))  fire();

    player.x = clamp(player.x, 10, W - 10);
    player.y = clamp(player.y, H - CELL * PLAYER_ROWS, H - 12);

    for (var i = 0; i < centipedes.length; i++) stepCentipede(centipedes[i], dt);
    updateBullets(dt);
    checkPlayerHit();
}

rafLoop(function (dt) {
    update(dt);
    shake.update(dt);
    fx.update(dt);
    draw();
});

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#050a12');
        g.addColorStop(1, '#0a1424');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }

    drawMushrooms();
    drawCentipedes();
    drawBullets();
    fx.draw(ctx);
    if (status === 'playing') drawPlayer();

    if (shaking) ctx.restore();

    if (status === 'idle') drawIdle();
}

function drawMushrooms() {
    /* Agrupadas por vida: cuatro fillStyle por frame en vez de uno por seta. */
    for (var life = 4; life >= 1; life--) {
        ctx.fillStyle = ['#3a2a1a', '#6b4a22', '#9c6a2c', '#d98f3c'][life - 1];
        for (var c = 0; c < COLS; c++) {
            for (var r = 0; r < ROWS; r++) {
                if (mushrooms[c][r] !== life) continue;
                var x = c * CELL, y = r * CELL;
                /* Sombrerito + pie, con formas. Nunca un emoji sobre canvas. */
                ctx.beginPath();
                ctx.arc(x + CELL / 2, y + CELL * 0.45, CELL * 0.36, Math.PI, 0);
                ctx.closePath();
                ctx.fill();
                ctx.fillRect(x + CELL * 0.4, y + CELL * 0.45, CELL * 0.2, CELL * 0.32);
            }
        }
    }
}

function drawCentipedes() {
    for (var i = 0; i < centipedes.length; i++) {
        var segs = centipedes[i].segs;
        for (var j = segs.length - 1; j >= 0; j--) {
            var s = segs[j];
            var head = j === 0;
            ctx.fillStyle = head ? '#ff512f' : (j % 2 ? '#8fff6a' : '#6cd94f');
            ctx.beginPath();
            ctx.arc(s.x, s.y, SEG_R, 0, Math.PI * 2);
            ctx.fill();
            if (head) {
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(s.x - 3, s.y - 2, 1.8, 0, Math.PI * 2);
                ctx.arc(s.x + 3, s.y - 2, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function drawBullets() {
    ctx.fillStyle = '#ffe98a';
    for (var i = 0; i < bullets.length; i++) {
        ctx.fillRect(bullets[i].x - 1.5, bullets[i].y - 7, 3, 10);
    }
}

function drawPlayer() {
    var x = player.x, y = player.y;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 10, y + 7);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 10, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cdf6ff';
    ctx.fillRect(x - 2, y - 6, 4, 8);
}

function drawIdle() {
    ctx.fillStyle = 'rgba(5,10,18,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fff6a';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CIEMPIÉS', W / 2, H / 2 - 14);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Dispárale al medio y se parte en dos', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Entrada ──────────────────────────────────────────────────────── */

var keys = GU.keys({
    left:  ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
    up:    ['ArrowUp', 'w'],
    down:  ['ArrowDown', 's'],
    fire:  [' ']
}, { preventDefault: true });

/* En móvil la nave sigue al dedo y dispara sola mientras esté apoyado: pedir
 * apuntar y disparar por separado en una pantalla pequeña no funciona. */
var touching = false;
function trackTouch(e) {
    var p = pointerPos(canvas, e);
    player.x = p.x;
    player.y = clamp(p.y, H - CELL * PLAYER_ROWS, H - 12);
    fire();
}
canvas.addEventListener('touchstart', function (e) { touching = true; trackTouch(e); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove',  function (e) { if (touching) { trackTouch(e); e.preventDefault(); } }, { passive: false });
canvas.addEventListener('touchend',   function () { touching = false; });

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

seedMushrooms();
syncHud();
draw();

}());

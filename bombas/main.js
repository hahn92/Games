/* Bombas — laberinto de bloques, bombas que explotan en cruz y enemigos que
 * patrullan. Revienta todos los enemigos para pasar de nivel.
 *
 * Dos tipos de bloque y la diferencia importa: los MUROS son fijos y forman la
 * rejilla clásica (cada celda par en fila y columna), y las CAJAS son
 * destructibles y se colocan al azar en lo que queda. La rejilla fija es lo que
 * impide que un nivel degenere en una sala abierta donde no hay nada que
 * planear.
 *
 * La explosión se calcula celda a celda desde el centro y PARA en el primer
 * bloque que encuentra, sin atravesarlo. Sin esa parada, una bomba en una
 * esquina limpiaría medio mapa y el juego dejaría de tener geometría. */
(function () {
'use strict';

var canvas = document.getElementById('bombasCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 420
var H = canvas.height;   // 480

var CELL = 30;
var COLS = W / CELL;     // 14
var ROWS = H / CELL;     // 16

var EMPTY = 0, WALL = 1, CRATE = 2;

var FUSE = 2.2;          // s hasta explotar
var FLAME_TIME = 0.42;   // s que dura la llama
var MOVE_SPEED = 3.4;    // celdas/s

var grid = [];
var bombs = [];          // [{c, r, t, range}]
var flames = [];         // [{c, r, t}]
var enemies = [];
var player = null;
var range = 2;

var score = 0, lives = 3, level = 1;
/* `gamePhase`, no `status`: `window.status` existe y es escribible, pero
 * CONVIERTE A CADENA todo lo que se le asigne — `status = null` se queda en
 * la cadena 'null', que es truthy. Ver docs/trampas.md. */
var gamePhase = 'idle';     // idle | playing | dead | over

var shake = new Shake({ decay: 0.85, max: 12 });
var fx    = new Particles(280);
var gMemo = GU.gradientMemo();
var best  = GU.highScore('bombasBest');

var hud = GU.hud({
    score: 'score',
    lives: 'livesLabel',
    level: 'levelLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return score + ' pts  ·  Vidas ' + lives + '  ·  Nivel ' + level +
               '  ·  ' + enemies.length + ' enemigos';
    } }
});

function at(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return WALL;
    return grid[r][c];
}
function walkable(c, r) { return at(c, r) === EMPTY; }

/* ── Nivel ────────────────────────────────────────────────────────── */

function buildLevel() {
    grid = [];
    for (var r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (var c = 0; c < COLS; c++) {
            var border = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
            /* La rejilla fija: muro en cada celda con fila y columna pares. */
            var pillar = c % 2 === 0 && r % 2 === 0;
            grid[r][c] = (border || pillar) ? WALL : EMPTY;
        }
    }

    /* Cajas al azar, dejando libre la esquina de salida y sus dos vecinas: sin
     * ese hueco el jugador puede aparecer sin ninguna salida. */
    var safe = { '1,1': 1, '2,1': 1, '1,2': 1 };
    for (var rr = 1; rr < ROWS - 1; rr++) {
        for (var cc = 1; cc < COLS - 1; cc++) {
            if (grid[rr][cc] !== EMPTY) continue;
            if (safe[cc + ',' + rr]) continue;
            if (Math.random() < 0.36) grid[rr][cc] = CRATE;
        }
    }

    player = { c: 1, r: 1, x: 1, y: 1, tc: 1, tr: 1, moving: false, invuln: 0 };
    bombs = [];
    flames = [];
    fx.clear();
    spawnEnemies();
    gamePhase = 'playing';
    syncHud();
}

function spawnEnemies() {
    enemies = [];
    var want = Math.min(6, 2 + level);
    var tries = 0;
    while (enemies.length < want && tries++ < 400) {
        var c = GU.randInt(1, COLS - 2), r = GU.randInt(1, ROWS - 2);
        if (!walkable(c, r)) continue;
        /* Lejos de la salida del jugador, o el nivel empieza con una muerte. */
        if (Math.abs(c - 1) + Math.abs(r - 1) < 6) continue;
        enemies.push({
            c: c, r: r, x: c, y: r, tc: c, tr: r,
            dir: GU.randInt(0, 3), speed: 1.5 + level * 0.12, moving: false
        });
    }
}

function startGame() {
    score = 0; lives = 3; level = 1; range = 2;
    buildLevel();
    gameControls.running();
    over.hide();
    GameAudio.start();
}

/* ── Bombas y llamas ──────────────────────────────────────────────── */

function dropBomb() {
    if (gamePhase !== 'playing') return;
    /* Una bomba por celda; y un tope, o se puede alfombrar el mapa entero. */
    for (var i = 0; i < bombs.length; i++) {
        if (bombs[i].c === player.c && bombs[i].r === player.r) return;
    }
    if (bombs.length >= 2 + Math.floor(level / 3)) return;
    bombs.push({ c: player.c, r: player.r, t: FUSE, range: range });
    GameAudio.place();
}

function explode(bomb) {
    addFlame(bomb.c, bomb.r);
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < 4; d++) {
        for (var k = 1; k <= bomb.range; k++) {
            var c = bomb.c + dirs[d][0] * k, r = bomb.r + dirs[d][1] * k;
            var cell = at(c, r);
            if (cell === WALL) break;              // el muro corta la llama
            addFlame(c, r);
            if (cell === CRATE) {
                grid[r][c] = EMPTY;
                score += 5;
                fx.burst((c + 0.5) * CELL, (r + 0.5) * CELL, 10,
                         { color: '#c98a4b', speed: 100, life: 0.5, size: 2.5 });
                break;                             // la caja también la corta
            }
        }
    }
    shake.hit(10);
    GameAudio.explode();
    syncHud();
}

function addFlame(c, r) { flames.push({ c: c, r: r, t: FLAME_TIME }); }

function flameAt(c, r) {
    for (var i = 0; i < flames.length; i++) {
        if (flames[i].c === c && flames[i].r === r) return true;
    }
    return false;
}

/* ── Movimiento por celdas ────────────────────────────────────────── */

/* Igual que pacman: se elige una celda destino y se interpola hasta su centro.
 * Moverse en píxeles libres dejaría al jugador a medio pasillo cuando explota
 * una bomba, y "¿estaba dentro de la llama?" se volvería una pregunta con
 * respuesta ambigua. */
function stepMover(m, dt, speed) {
    if (!m.moving) return;
    var dx = m.tc - m.x, dy = m.tr - m.y;
    var step = speed * dt;
    var d = Math.hypot(dx, dy);
    if (d <= step) {
        m.x = m.tc; m.y = m.tr;
        m.c = m.tc; m.r = m.tr;
        m.moving = false;
    } else {
        m.x += dx / d * step;
        m.y += dy / d * step;
    }
}

function tryMove(m, dc, dr) {
    if (m.moving) return false;
    var nc = m.c + dc, nr = m.r + dr;
    if (!walkable(nc, nr)) return false;
    m.tc = nc; m.tr = nr; m.moving = true;
    return true;
}

/* ── Actualización ────────────────────────────────────────────────── */

function update(dt) {
    if (gamePhase !== 'playing') return;

    if (player.invuln > 0) player.invuln -= dt;

    if (!player.moving) {
        if (keys.down('left'))       tryMove(player, -1, 0);
        else if (keys.down('right')) tryMove(player, 1, 0);
        else if (keys.down('up'))    tryMove(player, 0, -1);
        else if (keys.down('down'))  tryMove(player, 0, 1);
    }
    stepMover(player, dt, MOVE_SPEED);

    var i;
    for (i = bombs.length - 1; i >= 0; i--) {
        bombs[i].t -= dt;
        if (bombs[i].t <= 0) { explode(bombs[i]); bombs.splice(i, 1); }
    }
    for (i = flames.length - 1; i >= 0; i--) {
        flames[i].t -= dt;
        if (flames[i].t <= 0) flames.splice(i, 1);
    }

    updateEnemies(dt);

    /* Las llamas matan a todo lo que pise su celda, jugador incluido. */
    for (i = enemies.length - 1; i >= 0; i--) {
        if (flameAt(enemies[i].c, enemies[i].r)) {
            fx.burst((enemies[i].c + 0.5) * CELL, (enemies[i].r + 0.5) * CELL, 16,
                     { color: '#ff8fc4', speed: 120, life: 0.6, size: 3 });
            enemies.splice(i, 1);
            score += 50 + level * 10;
            GameAudio.score();
            syncHud();
        }
    }
    if (player.invuln <= 0 && flameAt(player.c, player.r)) { loseLife(); return; }
    for (i = 0; i < enemies.length; i++) {
        if (player.invuln <= 0 && enemies[i].c === player.c && enemies[i].r === player.r) {
            loseLife(); return;
        }
    }

    if (!enemies.length) nextLevel();
}

function updateEnemies(dt) {
    var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.moving) {
            var d = DIRS[e.dir];
            /* Sigue recto mientras pueda; al toparse elige otra dirección al
             * azar entre las que sí funcionan. Suficiente para que resulten
             * impredecibles sin volverse injustos. */
            if (!tryMove(e, d[0], d[1])) {
                var opts = [];
                for (var k = 0; k < 4; k++) {
                    if (walkable(e.c + DIRS[k][0], e.r + DIRS[k][1])) opts.push(k);
                }
                if (opts.length) {
                    e.dir = GU.pick(opts);
                    tryMove(e, DIRS[e.dir][0], DIRS[e.dir][1]);
                }
            }
        }
        stepMover(e, dt, e.speed);
    }
}

function nextLevel() {
    gamePhase = 'dead';           // congela el bucle mientras se monta el siguiente
    level++;
    score += 100;
    if (level % 3 === 0) range++;
    GameAudio.win();
    syncHud();
    setTimeout(function () { if (gamePhase !== 'over') buildLevel(); }, 900);
}

function loseLife() {
    lives--;
    shake.hit(12);
    fx.burst((player.c + 0.5) * CELL, (player.r + 0.5) * CELL, 24,
             { color: '#00e5ff', speed: 140, life: 0.8, size: 3 });
    GameAudio.explode();
    syncHud();
    if (lives <= 0) { endGame(); return; }
    gamePhase = 'dead';
    setTimeout(function () {
        if (gamePhase === 'over') return;
        player.c = player.tc = 1; player.r = player.tr = 1;
        player.x = 1; player.y = 1; player.moving = false;
        player.invuln = 1.6;
        bombs = []; flames = [];
        gamePhase = 'playing';
    }, 900);
}

function endGame() {
    gamePhase = 'over';
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

/* ── Dibujo ───────────────────────────────────────────────────────── */

rafLoop(function (dt) {
    update(dt);
    shake.update(dt);
    fx.update(dt);
    draw();
});

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#141d31');
        g.addColorStop(1, '#0a1020');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }

    drawGrid();
    drawBombs();
    drawFlames();
    fx.draw(ctx);
    drawEnemies();
    if (gamePhase === 'playing' || gamePhase === 'dead') drawPlayer();

    if (shaking) ctx.restore();

    if (gamePhase === 'idle') drawIdle();
}

function drawGrid() {
    /* Dos pasadas, una por tipo: fillStyle se toca dos veces y no 224. */
    ctx.fillStyle = '#39415c';
    var c, r;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (grid[r][c] !== WALL) continue;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    ctx.fillStyle = '#22293d';
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (grid[r][c] !== WALL) continue;
        ctx.fillRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6);
    }
    ctx.fillStyle = '#a2703c';
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (grid[r][c] !== CRATE) continue;
        GU.roundRectPath(ctx, c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4, 4);
        ctx.fill();
    }
    ctx.strokeStyle = '#7a5228';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (grid[r][c] !== CRATE) continue;
        ctx.moveTo(c * CELL + 5, r * CELL + CELL / 2);
        ctx.lineTo(c * CELL + CELL - 5, r * CELL + CELL / 2);
    }
    ctx.stroke();
}

function drawBombs() {
    for (var i = 0; i < bombs.length; i++) {
        var b = bombs[i];
        var cx = (b.c + 0.5) * CELL, cy = (b.r + 0.5) * CELL;
        /* Late más rápido cuanto menos queda: el aviso va en el ritmo, no en un
         * número. El pulso sale de la mecha, no de Math.random. */
        var pulse = 1 + Math.sin(b.t * 22) * 0.12 * (1 - b.t / FUSE);
        ctx.fillStyle = '#1b1b22';
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.34 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd54a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - CELL * 0.32);
        ctx.lineTo(cx + 7, cy - CELL * 0.46);
        ctx.stroke();
    }
}

function drawFlames() {
    for (var i = 0; i < flames.length; i++) {
        var f = flames[i];
        var a = f.t / FLAME_TIME;
        ctx.fillStyle = 'rgba(255,175,60,' + (0.35 + a * 0.5) + ')';
        ctx.fillRect(f.c * CELL + 2, f.r * CELL + 2, CELL - 4, CELL - 4);
        ctx.fillStyle = 'rgba(255,240,180,' + (a * 0.7) + ')';
        ctx.fillRect(f.c * CELL + 7, f.r * CELL + 7, CELL - 14, CELL - 14);
    }
}

function drawPlayer() {
    /* Parpadea mientras es invulnerable, para que se note que aún no cuenta. */
    if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) return;
    var cx = (player.x + 0.5) * CELL, cy = (player.y + 0.5) * CELL;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath(); ctx.arc(cx, cy - 2, CELL * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c3b47';
    ctx.fillRect(cx - CELL * 0.22, cy + 2, CELL * 0.44, CELL * 0.24);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 3.5, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 3.5, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var cx = (e.x + 0.5) * CELL, cy = (e.y + 0.5) * CELL;
        ctx.fillStyle = '#ff8fc4';
        ctx.beginPath();
        ctx.arc(cx, cy - 1, CELL * 0.28, Math.PI, 0);
        ctx.lineTo(cx + CELL * 0.28, cy + CELL * 0.24);
        ctx.lineTo(cx - CELL * 0.28, cy + CELL * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3a1226';
        ctx.beginPath();
        ctx.arc(cx - 3.5, cy - 3, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3.5, cy - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'BOMBAS',
        lines: ['Revienta a todos y no te pilles tú'],
        bg: 'rgba(10,16,32,0.78)',
        color: '#ffd54a',
        lineColor: '#8fd3f4'
    });
}

/* ── Entrada ──────────────────────────────────────────────────────── */

var keys = GU.keys({
    left:  ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
    up:    ['ArrowUp', 'w'],
    down:  ['ArrowDown', 's'],
    bomb:  [' ', 'Enter']
}, {
    preventDefault: true,
    onPress: function (a) { if (a === 'bomb') dropBomb(); }
});

/* En móvil: deslizar mueve, tocar suelta la bomba. Un solo gesto para cada
 * cosa, sin cruceta que ocupe media pantalla. */
GU.swipe(canvas, {
    live: true,
    minDist: 20,
    preventDefault: true,
    onSwipe: function (d) {
        if (d === 'left')       tryMove(player, -1, 0);
        else if (d === 'right') tryMove(player, 1, 0);
        else if (d === 'up')    tryMove(player, 0, -1);
        else                    tryMove(player, 0, 1);
    },
    onTap: function () { dropBomb(); }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

buildLevel();
gamePhase = 'idle';
syncHud();
draw();

}());

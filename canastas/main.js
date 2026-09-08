/* Canastas — tiros a canasta con parábola, tablero y aro con dos postes.
 *
 * El aro no es una zona: son DOS POSTES sólidos con un hueco entre ellos, y la
 * canasta se cuenta cuando el balón cruza el plano del aro hacia abajo y por
 * dentro. Tratarlo como un rectángulo "si entras, canasta" quita justo lo que
 * hace bueno a este juego — que un tiro corto rebote en el hierro delantero y
 * uno pasado se vaya contra el tablero.
 *
 * El tiro se define arrastrando: dirección y fuerza salen del vector desde el
 * balón hasta donde sueltas, como en un tirachinas. */
(function () {
'use strict';

var canvas = document.getElementById('cstCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 600

var GRAVITY = 900;       // px/s²
var BALL_R  = 15;
var RIM_Y   = 210;
var RIM_X   = W - 96;    // centro del aro
var RIM_HALF = 32;       // media anchura entre postes
var POST_R  = 5;
var BOARD_X = W - 44;

var ROUND_TIME = 70;

var ball = null;
var aiming = false;
var aimFrom = { x: 0, y: 0 }, aimTo = { x: 0, y: 0 };
var shotsLeft = 0;
var score = 0, streak = 0, bestStreak = 0, made = 0, taken = 0;
var timeLeft = ROUND_TIME;
var status = 'idle';     // idle | ready | flying | over
var msg = '', msgT = 0;
var scoredThisShot = false;
var wasAboveRim = false;

var shake = new Shake({ decay: 0.86, max: 10 });
var fx    = new Particles(240);
var gMemo = GU.gradientMemo();
var best  = GU.highScore('canastasBest');

var hud = GU.hud({
    score: 'score',
    acc:   'accLabel',
    time:  { el: 'timeLabel', format: function (v) { return v + 's'; } },
    streak: 'streakLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return score + ' pts  ·  ' + Math.ceil(timeLeft) + 's  ·  ' + made + '/' + taken;
    } }
});

/* ── Balón ────────────────────────────────────────────────────────── */

function resetBall() {
    /* Sale desde un punto al azar de la franja baja izquierda: cada tiro es un
     * ángulo distinto, que es lo que impide memorizar una única parábola. */
    ball = {
        x: GU.rand(50, W * 0.5),
        y: H - 70,
        vx: 0, vy: 0,
        spin: 0,
        live: false
    };
    scoredThisShot = false;
    wasAboveRim = false;
    status = 'ready';
}

function launch(dx, dy) {
    /* Arrastre invertido, como un tirachinas: tiras hacia atrás y sale hacia
     * delante. El tope evita que un arrastre gigante mande el balón a la luna. */
    var power = clamp(Math.hypot(dx, dy) * 3.1, 120, 980);
    var ang = Math.atan2(dy, dx);
    ball.vx = -Math.cos(ang) * power;
    ball.vy = -Math.sin(ang) * power;
    ball.spin = -ball.vx * 0.012;
    ball.live = true;
    status = 'flying';
    taken++;
    GameAudio.shoot();
    syncHud();
}

/* ── Física ───────────────────────────────────────────────────────── */

function update(dt) {
    if (status === 'over' || status === 'idle') return;

    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }

    if (msgT > 0) msgT -= dt;

    if (status !== 'flying' || !ball.live) { syncHud(); return; }

    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += ball.vx * dt * 0.02;

    /* Paredes laterales y techo: rebote con pérdida. */
    if (ball.x < BALL_R)      { ball.x = BALL_R; ball.vx = -ball.vx * 0.6; GameAudio.hit(); }
    if (ball.x > W - BALL_R)  { ball.x = W - BALL_R; ball.vx = -ball.vx * 0.6; GameAudio.hit(); }
    if (ball.y < BALL_R)      { ball.y = BALL_R; ball.vy = -ball.vy * 0.5; }

    collideBoard();
    collidePosts();
    checkBasket();

    if (ball.y > H + 60) endShot();
    syncHud();
}

/* El tablero es una pared vertical: sólo devuelve la componente horizontal. */
function collideBoard() {
    if (ball.x + BALL_R < BOARD_X) return;
    if (ball.y < RIM_Y - 96 || ball.y > RIM_Y + 8) return;
    if (ball.vx <= 0) return;
    ball.x = BOARD_X - BALL_R;
    ball.vx = -ball.vx * 0.62;
    shake.hit(4);
    GameAudio.paddle();
}

/* Cada poste es un círculo sólido. Se resuelve por normal, que es lo que
 * produce los rebotes creíbles del hierro. */
function collidePosts() {
    var posts = [
        { x: RIM_X - RIM_HALF, y: RIM_Y },
        { x: RIM_X + RIM_HALF, y: RIM_Y }
    ];
    for (var i = 0; i < posts.length; i++) {
        var dx = ball.x - posts[i].x, dy = ball.y - posts[i].y;
        var d = Math.hypot(dx, dy);
        var minD = BALL_R + POST_R;
        if (d >= minD || d === 0) continue;
        var nx = dx / d, ny = dy / d;
        ball.x = posts[i].x + nx * minD;
        ball.y = posts[i].y + ny * minD;
        var dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
        shake.hit(5);
        GameAudio.hit();
    }
}

/* Canasta = cruzar el plano del aro hacia ABAJO y entre los postes. Se exige
 * haber estado antes por encima, o un balón que sube desde debajo del aro
 * contaría como canasta al atravesarlo. */
function checkBasket() {
    if (ball.y < RIM_Y - BALL_R) wasAboveRim = true;
    if (scoredThisShot || !wasAboveRim) return;
    if (ball.vy <= 0) return;
    if (ball.y < RIM_Y || ball.y > RIM_Y + 14) return;
    if (Math.abs(ball.x - RIM_X) > RIM_HALF - 4) return;

    scoredThisShot = true;
    made++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;

    /* Canasta limpia = sin haber tocado nada. Se aproxima con "sigue con casi
     * toda la velocidad horizontal que llevaba", que es barato y se lee igual. */
    var pts = 100 + (streak >= 3 ? 50 : 0) + (streak >= 6 ? 100 : 0);
    score += pts;
    msg = streak >= 3 ? '¡' + streak + ' seguidas!  +' + pts : 'Canasta  +' + pts;
    msgT = 1.2;
    fx.burst(RIM_X, RIM_Y + 10, 22, { color: '#ffd54a', speed: 130, life: 0.7, size: 3, gravity: 120 });
    GameAudio.goal();
    syncHud();
}

function endShot() {
    if (!scoredThisShot) {
        streak = 0;
        msg = 'Fallo';
        msgT = 0.8;
        GameAudio.miss();
    }
    resetBall();
    syncHud();
}

/* ── Ronda ────────────────────────────────────────────────────────── */

function startGame() {
    score = 0; streak = 0; bestStreak = 0; made = 0; taken = 0;
    timeLeft = ROUND_TIME;
    msg = ''; msgT = 0;
    fx.clear();
    resetBall();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

function endGame() {
    status = 'over';
    var record = best.submit(score);
    syncHud();
    gameControls.idle();
    over.show({
        overScore: 'Puntuación: ' + score,
        overAcc: made + ' de ' + taken + ' (' + accuracy() + '%)  ·  mejor racha ' + bestStreak
    });
    GameAudio.gameOver();
}

function accuracy() { return taken ? Math.round(made / taken * 100) : 0; }

function syncHud() {
    hud.set({
        score:  score,
        acc:    made + '/' + taken,
        time:   Math.ceil(Math.max(0, timeLeft)),
        streak: streak,
        best:   best.display(0)
    });
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
        g.addColorStop(0, '#16233c');
        g.addColorStop(1, '#0a1120');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawCourt();

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }
    drawHoop();
    fx.draw(ctx);
    if (ball) drawBall();
    if (aiming) drawAim();
    if (shaking) ctx.restore();

    if (msgT > 0) drawMessage();
    if (status === 'idle') drawIdle();
}

function drawCourt() {
    ctx.fillStyle = '#1d2a44';
    ctx.fillRect(0, H - 46, W, 46);
    ctx.strokeStyle = 'rgba(143,211,244,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 46); ctx.lineTo(W, H - 46);
    ctx.stroke();
}

function drawHoop() {
    /* Tablero */
    ctx.fillStyle = '#e8eef7';
    ctx.fillRect(BOARD_X, RIM_Y - 96, 8, 104);
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_X - 30, RIM_Y - 58, 30, 46);

    /* Soporte */
    ctx.fillStyle = '#4a5570';
    ctx.fillRect(BOARD_X + 8, RIM_Y - 40, W - BOARD_X - 8, 7);

    /* Aro: los dos postes que de verdad colisionan */
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(RIM_X - RIM_HALF, RIM_Y);
    ctx.lineTo(RIM_X + RIM_HALF, RIM_Y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a52';
    ctx.beginPath(); ctx.arc(RIM_X - RIM_HALF, RIM_Y, POST_R, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(RIM_X + RIM_HALF, RIM_Y, POST_R, 0, Math.PI * 2); ctx.fill();

    /* Red: líneas que se juntan hacia abajo. Decorativa, no colisiona. */
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= 6; i++) {
        var t = i / 6;
        var xTop = RIM_X - RIM_HALF + t * RIM_HALF * 2;
        var xBot = RIM_X - RIM_HALF * 0.55 + t * RIM_HALF * 1.1;
        ctx.moveTo(xTop, RIM_Y);
        ctx.lineTo(xBot, RIM_Y + 34);
    }
    for (var k = 1; k <= 2; k++) {
        var y = RIM_Y + k * 12;
        var half = RIM_HALF * (1 - k * 0.18);
        ctx.moveTo(RIM_X - half, y);
        ctx.lineTo(RIM_X + half, y);
    }
    ctx.stroke();
}

function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.spin);
    ctx.fillStyle = gMemo('ball', function () {
        var g = ctx.createRadialGradient(-BALL_R * 0.3, -BALL_R * 0.35, BALL_R * 0.2, 0, 0, BALL_R);
        g.addColorStop(0, '#ffb066');
        g.addColorStop(1, '#d2691e');
        return g;
    });
    ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill();
    /* Costuras: dos meridianos y el ecuador, con formas. */
    ctx.strokeStyle = '#5c2f0d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-BALL_R, 0); ctx.lineTo(BALL_R, 0);
    ctx.moveTo(0, -BALL_R); ctx.lineTo(0, BALL_R);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, BALL_R * 0.55, BALL_R, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawAim() {
    var dx = aimTo.x - aimFrom.x, dy = aimTo.y - aimFrom.y;
    var power = clamp(Math.hypot(dx, dy) * 3.1, 120, 980);
    var ang = Math.atan2(dy, dx);
    var vx = -Math.cos(ang) * power, vy = -Math.sin(ang) * power;

    /* Trayectoria previsualizada por integración, con la MISMA gravedad que la
     * real: si se dibujara con otra fórmula, la línea mentiría. */
    ctx.strokeStyle = 'rgba(255,213,74,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    var px = ball.x, py = ball.y, pvx = vx, pvy = vy, step = 1 / 60;
    ctx.moveTo(px, py);
    for (var i = 0; i < 42; i++) {
        pvy += GRAVITY * step;
        px += pvx * step;
        py += pvy * step;
        if (py > H) break;
        ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    /* Medidor de fuerza pegado al balón. */
    var f = (power - 120) / (980 - 120);
    ctx.fillStyle = f > 0.8 ? '#ff512f' : f > 0.5 ? '#ffd54a' : '#8fff6a';
    ctx.fillRect(ball.x - 26, ball.y + BALL_R + 8, 52 * f, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ball.x - 26, ball.y + BALL_R + 8, 52, 5);
}

function drawMessage() {
    ctx.fillStyle = msg === 'Fallo' ? '#ff512f' : '#ffd54a';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(msgT, 0, 1);
    ctx.fillText(msg, W / 2, 92);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'CANASTAS',
        lines: ['Arrastra hacia atrás y suelta'],
        bg: 'rgba(10,17,32,0.78)',
        color: '#ffb066',
        lineColor: '#8fd3f4'
    });
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function startAim(p) {
    if (status !== 'ready') return;
    aiming = true;
    aimFrom.x = ball.x; aimFrom.y = ball.y;
    aimTo.x = p.x; aimTo.y = p.y;
}
function moveAim(p) { if (aiming) { aimTo.x = p.x; aimTo.y = p.y; } }
function releaseAim() {
    if (!aiming) return;
    aiming = false;
    var dx = aimTo.x - aimFrom.x, dy = aimTo.y - aimFrom.y;
    if (Math.hypot(dx, dy) < 12) return;   // un toque suelto no lanza
    launch(dx, dy);
}

canvas.addEventListener('mousedown', function (e) { startAim(pointerPos(canvas, e)); });
canvas.addEventListener('mousemove', function (e) { moveAim(pointerPos(canvas, e)); });
window.addEventListener('mouseup', releaseAim);

canvas.addEventListener('touchstart', function (e) { startAim(pointerPos(canvas, e)); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove',  function (e) { moveAim(pointerPos(canvas, e)); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend',   function (e) { releaseAim(); e.preventDefault(); }, { passive: false });

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: startGame, popup: 'overPopup' });

resetBall();
status = 'idle';
syncHud();
draw();

}());

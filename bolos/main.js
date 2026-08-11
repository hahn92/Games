// Bolos — partida de 10 frames con puntuación real (semipleno arrastra 1 tirada,
// pleno arrastra 2) y bolos que se derriban entre ellos.
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('bolosCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 620

/* La pista se dibuja en perspectiva: estrecha al fondo, ancha en la línea de
 * falta. El juego se simula en coordenadas de PISTA (x lateral, y de fondo) y
 * sólo se proyecta al pintar, para que la física no dependa de la cámara. */
var LANE_W    = 220;      // ancho de la pista en unidades de pista
var LANE_LEN  = 900;      // largo, del foul line al pin deck
var GUTTER    = 26;       // canal a cada lado
var PIN_R     = 9;
var BALL_R    = 17;

var VP_Y      = 96;       // horizonte de la proyección
var NEAR_Y    = H - 96;   // línea de falta en pantalla
var NEAR_HALF = 150;      // media anchura de la pista en pantalla, abajo
var FAR_HALF  = 46;       // ídem arriba

var FRAMES = 10;

/* Disposición estándar: 10 bolos en triángulo, fila 1 al frente. */
var PIN_SPACING = 42;
var PIN_LAYOUT = (function () {
    var out = [], id = 0;
    for (var row = 0; row < 4; row++) {
        for (var k = 0; k <= row; k++) {
            out.push({
                id: id++,
                x: (k - row / 2) * PIN_SPACING,
                y: LANE_LEN - 120 + row * PIN_SPACING * 0.87
            });
        }
    }
    return out;
}());

var shake = new GU.Shake({ decay: 0.85 });
var fx    = new Particles(220, { semiImplicit: true });

/* ── Estado ── */
var gs = {
    status: 'idle',        // idle | aim | power | spin | rolling | between | over
    frame: 0,
    ball: 0,               // tirada dentro del frame (0 o 1, o 2 en el décimo)
    rolls: [],             // todas las tiradas de la partida, en orden
    tenthRolls: [],        // las del décimo, que se puntúan aparte
    pins: [],
    ballX: 0, ballY: 0, ballVX: 0, ballVY: 0, ballSpin: 0,
    aim: 0,                // -1..1 posición de salida
    aimDir: 1,
    power: 0, powerDir: 1,
    spin: 0, spinDir: 1,
    msg: '',
    msgT: 0,
    settleT: 0
};

var hud = GU.hud({
    frame: { el: 'frameLabel', format: function (v) { return 'Frame: ' + v + ' / ' + FRAMES; } },
    score: { el: 'scoreLabel', format: function (v) { return 'Puntos: ' + v; } },
    best:  { el: 'bestLabel',  format: function (v) { return 'Récord: ' + v; } },
    mobile: { el: 'mobileScore', html: function (v) {
        return 'Frame <b>' + v.frame + '/' + FRAMES + '</b> &nbsp; Puntos: <b>' + v.score + '</b>';
    } }
});
var best = GU.highScore('bolosHighScore');
var overPopup = GU.popup('overPopup');

/* ═══════════════ Puntuación ═══════════════ */

/* Puntuación de bolos de verdad: un pleno vale 10 más las DOS tiradas
 * siguientes, un semipleno 10 más la siguiente. Por eso se guarda la lista
 * plana de tiradas y se recorre por frames, en vez de ir sumando sobre la
 * marcha: el valor de un frame no se conoce hasta dos tiradas después. */
/* El décimo frame NO sigue la regla de los otros nueve: no arrastra nada, sus
 * tiradas extra ya SON el bonus, así que se suman tal cual. Tratarlo como un
 * frame normal es el error clásico y da 270 en una partida perfecta en vez de
 * 300. */
function scoreGame(rolls) {
    var total = 0, i = 0;
    for (var f = 0; f < FRAMES; f++) {
        if (i >= rolls.length) break;
        if (f === FRAMES - 1) {
            for (var k = i; k < rolls.length; k++) total += rolls[k];
            break;
        }
        if (rolls[i] === 10) {                                       // pleno
            total += 10 + (rolls[i + 1] || 0) + (rolls[i + 2] || 0);
            i += 1;
        } else if ((rolls[i] || 0) + (rolls[i + 1] || 0) === 10) {   // semipleno
            total += 10 + (rolls[i + 2] || 0);
            i += 2;
        } else {
            total += (rolls[i] || 0) + (rolls[i + 1] || 0);
            i += 2;
        }
    }
    return total;
}

/* Marcador por frame para la tabla: [{rolls:[..], cum}].
 *
 * `cum` sólo se rellena cuando el frame ya está DECIDIDO — un pleno sin sus dos
 * tiradas de bonus no tiene número todavía, y eso es lo que se ve en una hoja
 * de bolos de verdad. El contador grande del panel sí muestra un total parcial,
 * que es lo que espera quien juega. */
function frameTable(rolls) {
    var out = [], i = 0, total = 0;
    for (var f = 0; f < FRAMES; f++) {
        var e = { rolls: [], cum: null };

        if (f === FRAMES - 1) {
            e.rolls = rolls.slice(i);
            var t = e.rolls;
            var done = t.length === 3 ||
                       (t.length === 2 && t[0] !== 10 && t[0] + t[1] !== 10);
            if (done) {
                for (var k = 0; k < t.length; k++) total += t[k];
                e.cum = total;
            }
            out.push(e);
            break;
        }
        if (i >= rolls.length) { out.push(e); continue; }

        if (rolls[i] === 10) {
            e.rolls = [10];
            if (rolls.length > i + 2) { total += 10 + rolls[i + 1] + rolls[i + 2]; e.cum = total; }
            i += 1;
        } else {
            e.rolls = [rolls[i]];
            if (rolls.length > i + 1) {
                e.rolls.push(rolls[i + 1]);
                if (rolls[i] + rolls[i + 1] === 10) {
                    if (rolls.length > i + 2) { total += 10 + rolls[i + 2]; e.cum = total; }
                } else {
                    total += rolls[i] + rolls[i + 1]; e.cum = total;
                }
            }
            i += 2;
        }
        out.push(e);
    }
    return out;
}

/* ═══════════════ Partida ═══════════════ */

function newGame() {
    gs.frame = 0;
    gs.ball = 0;
    gs.rolls = [];
    gs.tenthRolls = [];
    gs.status = 'aim';
    gs.aim = 0; gs.power = 0; gs.spin = 0;
    gs.msg = ''; gs.msgT = 0;
    fx.clear();
    shake.stop();
    resetPins(true);
    resetBall();
    overPopup.hide();
    syncHud();
    GameAudio.start();
}

function resetPins(all) {
    if (all) {
        gs.pins = PIN_LAYOUT.map(function (p) {
            return { id: p.id, x: p.x, y: p.y, hx: p.x, hy: p.y, vx: 0, vy: 0, down: false, wob: 0 };
        });
        return;
    }
    /* Segunda tirada: sólo se retiran los caídos, los de pie no se mueven. */
    gs.pins = gs.pins.filter(function (p) { return !p.down; }).map(function (p) {
        return { id: p.id, x: p.hx, y: p.hy, hx: p.hx, hy: p.hy, vx: 0, vy: 0, down: false, wob: 0 };
    });
}

function resetBall() {
    gs.ballX = gs.aim * (LANE_W / 2 - BALL_R - 6);
    gs.ballY = 0;
    gs.ballVX = 0;
    gs.ballVY = 0;
    gs.ballSpin = 0;
}

function standing() {
    var n = 0;
    for (var i = 0; i < gs.pins.length; i++) if (!gs.pins[i].down) n++;
    return n;
}

/* ═══════════════ Lanzamiento ═══════════════ */

/* Tres pasos encadenados con la misma tecla o el mismo toque: puntería,
 * fuerza y efecto. Cada uno es un medidor que va y viene; se para pulsando.
 * Es el esquema clásico de los juegos de bolos y de golf, y hace que todo el
 * juego quepa en un solo botón — que es justo lo que necesita el móvil. */
function advance() {
    if (gs.status === 'idle' || gs.status === 'over') return;
    if (gs.status === 'aim')   { gs.status = 'power'; GameAudio.click(); return; }
    if (gs.status === 'power') { gs.status = 'spin';  GameAudio.click(); return; }
    if (gs.status === 'spin')  { launch(); return; }
}

function launch() {
    gs.status = 'rolling';
    gs.settleT = 0;
    gs.gutter = false;
    gs.ballX = gs.aim * (LANE_W / 2 - BALL_R - 6);
    gs.ballY = 0;
    /* La fuerza da velocidad de avance; el efecto, una aceleración lateral que
     * va curvando la bola — no una velocidad lateral fija, o la trayectoria
     * sería recta y en diagonal en vez de curva. */
    gs.ballVY = 620 + gs.power * 520;
    gs.ballVX = 0;
    gs.ballSpin = gs.spin * 780;
    GameAudio.shoot();
}

/* ═══════════════ Física ═══════════════ */

function update(dt) {
    shake.update(dt);
    fx.update(dt);
    if (gs.msgT > 0) gs.msgT -= dt;

    if (gs.status === 'aim')   { gs.aim   = meter(gs.aim,   'aimDir',   1.15 * dt, -1, 1); }
    if (gs.status === 'power') { gs.power = meter(gs.power, 'powerDir', 1.30 * dt,  0, 1); }
    if (gs.status === 'spin')  { gs.spin  = meter(gs.spin,  'spinDir',  1.45 * dt, -1, 1); }

    if (gs.status === 'rolling') updateRoll(dt);
    updatePins(dt);
}

/* Medidor de ida y vuelta entre lo y hi. */
function meter(v, dirKey, step, lo, hi) {
    v += gs[dirKey] * step * (hi - lo);
    if (v >= hi) { v = hi; gs[dirKey] = -1; }
    if (v <= lo) { v = lo; gs[dirKey] = 1; }
    return v;
}

function updateRoll(dt) {
    /* Subpasos: a 900 px/s y 60fps la bola avanza 15px por frame, más que su
     * radio, y podría atravesar un bolo sin tocarlo. */
    var steps = 4, sdt = dt / steps;
    for (var s = 0; s < steps; s++) {
        gs.ballVX += gs.ballSpin * sdt;
        gs.ballX  += gs.ballVX * sdt;
        gs.ballY  += gs.ballVY * sdt;
        gs.ballVY *= Math.pow(0.86, sdt);        // rozamiento de la pista

        var half = LANE_W / 2;
        if (Math.abs(gs.ballX) > half - BALL_R) {
            /* Canal: la bola cae, deja de girar y ya no derriba nada. */
            gs.ballX = GU.clamp(gs.ballX, -half + BALL_R, half - BALL_R);
            gs.ballSpin = 0;
            gs.ballVX = 0;
            if (gs.status === 'rolling' && !gs.gutter) {
                gs.gutter = true;
                setMsg('¡Canal!');
                GameAudio.miss();
            }
        }
        if (!gs.gutter) collideBallPins(sdt);
        if (gs.ballY > LANE_LEN + 60 || gs.ballVY < 40) { endRoll(); return; }
    }
}

function collideBallPins(dt) {
    for (var i = 0; i < gs.pins.length; i++) {
        var p = gs.pins[i];
        if (p.down) continue;
        var dx = p.x - gs.ballX, dy = p.y - gs.ballY;
        var rr = BALL_R + PIN_R;
        if (dx * dx + dy * dy > rr * rr) continue;

        var d = Math.hypot(dx, dy) || 1;
        var nx = dx / d, ny = dy / d;
        /* El bolo sale con la velocidad de la bola proyectada sobre la normal,
         * amplificada: una bola pesada apenas se frena y el bolo sale
         * disparado. La bola sí pierde algo, que es lo que hace que un pleno
         * necesite entrar con fuerza. */
        var speed = Math.hypot(gs.ballVX, gs.ballVY);
        knockPin(p, nx * speed * 0.75, ny * speed * 0.75);
        gs.ballVX += -nx * speed * 0.05;
        gs.ballVY *= 0.965;
        shake.hit(5);
    }
}

function knockPin(p, vx, vy) {
    if (p.down) return;
    p.down = true;
    p.vx = vx + GU.rand(-40, 40);
    p.vy = vy + GU.rand(-30, 30);
    p.wob = GU.rand(-7, 7);
    GameAudio.hit();
    fx.burst(p.x, p.y, 6, {
        color: '#ffffff', speed: [30, 90], size: [1.2, 2.6],
        life: [0.25, 0.5], drag: [0.92, 0.92]
    });
}

/* Un bolo derribado tira a los que se cruzan: es lo que hace que un buen
 * ángulo valga más que la fuerza bruta. */
function updatePins(dt) {
    for (var i = 0; i < gs.pins.length; i++) {
        var p = gs.pins[i];
        if (!p.down) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.12, dt);
        p.vy *= Math.pow(0.12, dt);

        if (Math.hypot(p.vx, p.vy) < 12) continue;
        for (var j = 0; j < gs.pins.length; j++) {
            var q = gs.pins[j];
            if (q.down || q === p) continue;
            var dx = q.x - p.x, dy = q.y - p.y;
            var rr = PIN_R * 2.1;
            if (dx * dx + dy * dy > rr * rr) continue;
            var d = Math.hypot(dx, dy) || 1;
            knockPin(q, (dx / d) * Math.hypot(p.vx, p.vy) * 0.65,
                        (dy / d) * Math.hypot(p.vx, p.vy) * 0.65);
        }
    }
}

/* ═══════════════ Fin de tirada ═══════════════ */

function endRoll() {
    if (gs.status !== 'rolling') return;
    gs.status = 'between';
    gs.settleT = 0;
}

/* Se espera a que los bolos dejen de moverse antes de contar: contar en el
 * instante del impacto se pierde todos los que caen en cadena. */
function settle(dt) {
    gs.settleT += dt;
    var moving = false;
    for (var i = 0; i < gs.pins.length; i++) {
        if (gs.pins[i].down && Math.hypot(gs.pins[i].vx, gs.pins[i].vy) > 8) moving = true;
    }
    if (moving && gs.settleT < 3) return;
    if (gs.settleT < 0.55) return;
    scoreRoll();
}

function scoreRoll() {
    /* Los bolos no se retiran durante una tirada, sólo se marcan caídos, así
     * que al empezar TODOS los de `gs.pins` estaban en pie. No hace falta
     * recordar un "antes". */
    var rack = gs.pins.length;
    var knocked = rack - standing();
    var cleared = standing() === 0;
    gs.rolls.push(knocked);

    /* Pleno = limpiar los diez de una; semipleno = limpiar lo que quedaba. Así
     * definidos valen también para las tiradas extra del décimo, donde `ball`
     * ya no distingue. */
    var strike = (rack === 10 && knocked === 10);
    var spare  = (rack < 10 && cleared);

    if (strike)      { setMsg('¡PLENO!');     GameAudio.scoreHigh(); shake.hit(14); confetti(); }
    else if (spare)  { setMsg('¡Semipleno!'); GameAudio.score(); confetti(); }
    else if (gs.gutter) { /* el mensaje de canal ya salió al caer */ }
    else if (knocked > 0) GameAudio.brick();

    syncHud();

    if (gs.frame === FRAMES - 1) return tenthFrame(cleared);

    if (strike || gs.ball === 1) { gs.frame++; gs.ball = 0; resetPins(true); }
    else                        { gs.ball = 1; resetPins(false); }
    nextRoll();
}

/* El décimo frame es la excepción de todo el juego: hasta tres tiradas, y sus
 * extras no arrastran nada porque ya son el bonus.
 *
 * `resetPins(cleared)` resuelve los tres casos de una vez: si el pleno o el
 * semipleno vació la plataforma se monta un juego nuevo, y si no, se sigue con
 * los que quedaban en pie. */
function tenthFrame(cleared) {
    gs.tenthRolls.push(gs.rolls[gs.rolls.length - 1]);
    var t = gs.tenthRolls, n = t.length;

    if (n >= 3) return endGame();
    if (n === 2 && t[0] !== 10 && t[0] + t[1] !== 10) return endGame();

    gs.ball = n;
    resetPins(cleared);
    nextRoll();
}

function nextRoll() {
    gs.status = 'aim';
    gs.power = 0; gs.spin = 0;
    gs.gutter = false;
    resetBall();
}

function endGame() {
    gs.status = 'over';
    var total = scoreGame(gs.rolls);
    var record = best.submit(total);
    syncHud();
    GameAudio.win();
    overPopup.show({
        overTitle: total === 300 ? '¡PARTIDA PERFECTA!' : (record ? '¡Nuevo récord!' : 'Fin de la partida'),
        overScore: 'Puntuación: ' + total,
        overBest:  'Récord: ' + best.display(0)
    });
}

function setMsg(t) { gs.msg = t; gs.msgT = 1.6; }

function confetti() {
    for (var i = 0; i < 26; i++) {
        fx.add(GU.rand(-LANE_W / 2, LANE_W / 2), LANE_LEN - 60,
               GU.rand(-90, 90), GU.rand(-40, 40),
               { color: GU.pick(['#8fd3f4', '#ff512f', '#fddb92', '#4ade80']),
                 life: 0.9, size: 2.6, drag: [0.95, 0.95] });
    }
}

function syncHud() {
    hud.set({
        frame: Math.min(gs.frame + 1, FRAMES),
        score: scoreGame(gs.rolls),
        best:  best.display(0)
    });
}

/* ═══════════════ Proyección ═══════════════ */

/* De coordenadas de pista a pantalla. `t` va de 0 (línea de falta, abajo) a 1
 * (fondo de la pista), y la anchura se interpola con él — es una proyección
 * lineal, no una perspectiva real, pero a esta escala se lee igual y no tiene
 * divisiones que puedan explotar. */
function proj(x, y) {
    var t = GU.clamp(y / LANE_LEN, 0, 1.15);
    var half = GU.lerp(NEAR_HALF, FAR_HALF, t);
    var sy = GU.lerp(NEAR_Y, VP_Y, t);
    return { x: W / 2 + (x / (LANE_W / 2)) * half, y: sy, s: half / NEAR_HALF };
}

/* ═══════════════ Dibujo ═══════════════ */

var grads = GU.gradientMemo();

function draw() {
    ctx.save();
    shake.translate(ctx);

    ctx.fillStyle = grads('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1020');
        g.addColorStop(1, '#14203a');
        return g;
    });
    ctx.fillRect(-20, -20, W + 40, H + 40);

    drawLane();
    drawPins();
    if (gs.status !== 'idle') drawBall();
    fx.draw(ctx);
    ctx.restore();

    drawScoreStrip();
    if (gs.status === 'idle') drawIdle();
    else drawMeters();
    drawMsg();
}

function drawLane() {
    var nl = proj(-LANE_W / 2, 0), nr = proj(LANE_W / 2, 0);
    var fl = proj(-LANE_W / 2, LANE_LEN), fr = proj(LANE_W / 2, LANE_LEN);

    // canales
    ctx.fillStyle = '#0b1526';
    ctx.beginPath();
    ctx.moveTo(nl.x - GUTTER, nl.y); ctx.lineTo(fl.x - GUTTER * 0.35, fl.y);
    ctx.lineTo(fr.x + GUTTER * 0.35, fr.y); ctx.lineTo(nr.x + GUTTER, nr.y);
    ctx.closePath(); ctx.fill();

    // madera
    ctx.fillStyle = grads('lane', function () {
        var g = ctx.createLinearGradient(0, VP_Y, 0, NEAR_Y);
        g.addColorStop(0, '#6b4a25');
        g.addColorStop(0.5, '#9c6f38');
        g.addColorStop(1, '#c08c48');
        return g;
    });
    ctx.beginPath();
    ctx.moveTo(nl.x, nl.y); ctx.lineTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y); ctx.lineTo(nr.x, nr.y);
    ctx.closePath(); ctx.fill();

    // duelas: un solo path
    ctx.strokeStyle = 'rgba(60,35,12,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < 10; i++) {
        var x = -LANE_W / 2 + (LANE_W * i) / 10;
        var a = proj(x, 0), b = proj(x, LANE_LEN);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // flechas de puntería
    ctx.fillStyle = 'rgba(40,22,8,0.55)';
    for (var k = -3; k <= 3; k++) {
        if (k === 0) continue;
        var p = proj(k * 26, LANE_LEN * 0.33);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 9 * p.s);
        ctx.lineTo(p.x - 4 * p.s, p.y + 5 * p.s);
        ctx.lineTo(p.x + 4 * p.s, p.y + 5 * p.s);
        ctx.closePath(); ctx.fill();
    }

    // línea de falta
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nl.x, nl.y); ctx.lineTo(nr.x, nr.y);
    ctx.stroke();

    // pared del fondo
    ctx.fillStyle = '#101a2e';
    ctx.fillRect(0, 0, W, VP_Y - 2);
}

/* Los bolos se pintan de lejos a cerca para que los de delante tapen a los de
 * detrás. */
function drawPins() {
    var order = gs.pins.slice().sort(function (a, b) { return b.y - a.y; });
    for (var i = 0; i < order.length; i++) {
        var p = order[i];
        var s = proj(p.x, p.y);
        var h = 38 * s.s, w = 11 * s.s;   // algo mayores que el radio de colisión: a 900px de fondo un bolo a escala real es ilegible
        if (p.down) {
            // tumbado: elipse girada
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(p.wob);
            ctx.fillStyle = '#e8e8ea';
            ctx.beginPath();
            ctx.ellipse(0, 0, h * 0.42, w * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e0453a';
            ctx.fillRect(-h * 0.1, -w * 0.7, h * 0.12, w * 1.4);
            ctx.restore();
            continue;
        }
        // sombra
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2 * s.s, w * 0.95, w * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        // cuerpo: silueta de bolo en un solo path
        ctx.fillStyle = '#f2f2f4';
        ctx.beginPath();
        ctx.moveTo(s.x - w * 0.55, s.y);
        ctx.bezierCurveTo(s.x - w * 0.75, s.y - h * 0.35, s.x - w * 0.30, s.y - h * 0.52, s.x - w * 0.34, s.y - h * 0.72);
        ctx.bezierCurveTo(s.x - w * 0.36, s.y - h * 0.98, s.x + w * 0.36, s.y - h * 0.98, s.x + w * 0.34, s.y - h * 0.72);
        ctx.bezierCurveTo(s.x + w * 0.30, s.y - h * 0.52, s.x + w * 0.75, s.y - h * 0.35, s.x + w * 0.55, s.y);
        ctx.closePath();
        ctx.fill();
        // franjas rojas
        ctx.fillStyle = '#e0453a';
        ctx.fillRect(s.x - w * 0.42, s.y - h * 0.60, w * 0.84, h * 0.07);
        ctx.fillRect(s.x - w * 0.40, s.y - h * 0.46, w * 0.80, h * 0.07);
    }
}

function drawBall() {
    var s = proj(gs.ballX, gs.ballY);
    var r = BALL_R * s.s;   // sólo para la sombra, que se dibuja sin escalar
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.35, r * 1.05, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Degradado construido en el origen y trasladado, no keyeado por posición:
     * la bola se mueve en cada frame y la caché crecería sin límite.
     * Se deshace la traslación a mano en vez de con save/restore, y sobre todo
     * NO se toca setTransform aquí: encima hay ya la traslación de la sacudida
     * y resetearla la anularía a mitad de frame. */
    ctx.translate(s.x, s.y);
    ctx.scale(s.s, s.s);
    ctx.fillStyle = grads('ball', function () {
        var g = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.4, 1, 0, 0, BALL_R);
        g.addColorStop(0, '#7fd4ff');
        g.addColorStop(0.5, '#2b6fb8');
        g.addColorStop(1, '#0d2540');
        return g;
    });
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(1 / s.s, 1 / s.s);
    ctx.translate(-s.x, -s.y);
}

function drawScoreStrip() {
    var y = 0, h = 40;
    ctx.fillStyle = 'rgba(8,14,26,0.92)';
    ctx.fillRect(0, y, W, h);
    var table = frameTable(gs.rolls);
    var cw = W / FRAMES;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var f = 0; f < FRAMES; f++) {
        var cx = cw * f + cw / 2;
        ctx.strokeStyle = 'rgba(143,211,244,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cw * f, y, cw, h);
        if (f === gs.frame && gs.status !== 'over') {
            ctx.fillStyle = 'rgba(255,81,47,0.22)';
            ctx.fillRect(cw * f, y, cw, h);
        }
        var e = table[f] || { rolls: [], cum: null };
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#cfe0f5';
        ctx.fillText(rollText(e.rolls, f), cx, y + 11);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#8fd3f4';
        ctx.fillText(e.cum == null ? '' : String(e.cum), cx, y + 28);
    }
}

function rollText(rolls, f) {
    if (!rolls.length) return '';
    var out = [];
    for (var i = 0; i < rolls.length; i++) {
        var v = rolls[i];
        if (v === 10 && (i === 0 || f === FRAMES - 1)) out.push('X');
        else if (i > 0 && rolls[i - 1] + v === 10) out.push('/');
        else out.push(v === 0 ? '-' : String(v));
    }
    return out.join(' ');
}

function drawIdle() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(10,16,32,0.72)';
    ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('BOLOS', W / 2, H / 2 - 30);
    ctx.fillStyle = '#cfe0f5';
    ctx.font = '15px sans-serif';
    ctx.fillText('Pulsa Iniciar y luego Espacio o toca:', W / 2, H / 2 + 6);
    ctx.fillText('puntería → fuerza → efecto', W / 2, H / 2 + 30);
}

/* Los tres medidores comparten dibujo: sólo cambian etiqueta, rango y color. */
function drawMeters() {
    var y = H - 62, bw = W - 60, bx = 30, bh = 14;

    meterBar(bx, y, bw, bh, (gs.aim + 1) / 2, gs.status === 'aim', 'PUNTERÍA', '#8fd3f4');
    if (gs.status === 'power' || gs.status === 'spin' || gs.status === 'rolling') {
        meterBar(bx, y + 22, bw, bh, gs.power, gs.status === 'power', 'FUERZA', '#ff512f');
    }
    if (gs.status === 'spin' || gs.status === 'rolling') {
        meterBar(bx, y + 44, bw, bh, (gs.spin + 1) / 2, gs.status === 'spin', 'EFECTO', '#fddb92');
    }
}

function meterBar(x, y, w, h, t, active, label, color) {
    ctx.fillStyle = 'rgba(8,14,26,0.85)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
    ctx.fillStyle = active ? color : 'rgba(255,255,255,0.22)';
    var kx = x + 3 + t * (w - 12);
    ctx.beginPath(); ctx.roundRect(kx, y + 2, 8, h - 4, 4); ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = active ? color : '#5c6f8c';
    ctx.fillText(label, x + 2, y - 6);
}

function drawMsg() {
    if (gs.msgT <= 0) return;
    ctx.globalAlpha = Math.min(1, gs.msgT / 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#fddb92';
    ctx.fillText(gs.msg, W / 2, H * 0.34);
    ctx.globalAlpha = 1;
}

/* ═══════════════ Bucle ═══════════════ */

rafLoop(function (dt) {
    update(dt);
    if (gs.status === 'between') settle(dt);
    draw();
});

/* ═══════════════ Entrada ═══════════════ */

GU.keys({ fire: [' ', 'Enter'] }, {
    preventDefault: true,
    onPress: function () { advance(); }
});
canvas.addEventListener('mousedown', function () { advance(); });
GU.swipe(canvas, { preventDefault: true, onTap: function () { advance(); } });

document.getElementById('startBtn').addEventListener('click', function () { GameAudio.click(); newGame(); });
document.getElementById('restartBtn').addEventListener('click', function () { GameAudio.click(); newGame(); });
document.getElementById('throwBtn').addEventListener('click', advance);
document.getElementById('playAgainBtn').addEventListener('click', function () { GameAudio.click(); newGame(); });

syncHud();

}());

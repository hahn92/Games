/* Generala — cinco dados, tres tiradas por turno y trece casillas que rellenar.
 *
 * La regla que decide la partida es que CADA casilla se usa una sola vez, así
 * que la decisión de verdad no es qué sacas sino dónde lo apuntas. Rellenar las
 * trece cierra el juego, y una casilla que no puedas cumplir se puede tachar
 * con cero: eso también es una jugada.
 *
 * El bono de arriba (35 puntos si los seises-a-unos suman 63 o más) es lo que
 * obliga a no malgastar los números bajos; sin él la mitad superior de la tabla
 * no tendría tensión ninguna. */
(function () {
'use strict';

var canvas = document.getElementById('genCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 640

var DICE = 5;
var MAX_ROLLS = 3;

/* Las trece casillas, en el orden en que se pintan. `upper` marca las que
 * cuentan para el bono. */
var BOXES = [
    { id: 'n1', name: 'Unos',      upper: true },
    { id: 'n2', name: 'Doses',     upper: true },
    { id: 'n3', name: 'Treses',    upper: true },
    { id: 'n4', name: 'Cuatros',   upper: true },
    { id: 'n5', name: 'Cincos',    upper: true },
    { id: 'n6', name: 'Seises',    upper: true },
    { id: 'p3', name: 'Trío' },
    { id: 'p4', name: 'Póker' },
    { id: 'full', name: 'Full' },
    { id: 'ss', name: 'Escalera corta' },
    { id: 'ls', name: 'Escalera larga' },
    { id: 'gen', name: 'Generala' },
    { id: 'ch', name: 'Suma total' }
];
var UPPER_BONUS_AT = 63;
var UPPER_BONUS = 35;

var dice = [];           // [{v, held}]
var rollsLeft = MAX_ROLLS;
var filled = {};         // id -> puntos
var status = 'idle';     // idle | rolling | playing | over
var rollAnim = 0;        // segundos que quedan de animación de tirada

var fx = new Particles(180);
var shake = new Shake({ decay: 0.85, max: 8 });
var gMemo = GU.gradientMemo();
var best = GU.highScore('generalaBest');

var hud = GU.hud({
    total: 'totalLabel',
    rolls: 'rollsLabel',
    left:  'leftLabel',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return 'Total ' + total() + '  ·  Tiradas ' + rollsLeft + '  ·  ' + boxesLeft() + ' casillas';
    } }
});

/* ── Puntuación ───────────────────────────────────────────────────── */

function counts(vals) {
    var c = [0, 0, 0, 0, 0, 0, 0];   // índice = cara, 1..6
    for (var i = 0; i < vals.length; i++) c[vals[i]]++;
    return c;
}

/* Devuelve lo que valdría `boxId` con esta tirada. Nunca decide si es legal:
 * en generala SIEMPRE puedes apuntar en cualquier casilla libre, aunque valga
 * cero — tachar es una jugada válida y a veces la única. */
function valueFor(boxId, vals) {
    var c = counts(vals);
    var sum = 0, i;
    for (i = 0; i < vals.length; i++) sum += vals[i];

    switch (boxId) {
        case 'n1': case 'n2': case 'n3': case 'n4': case 'n5': case 'n6':
            var face = parseInt(boxId.slice(1), 10);
            return c[face] * face;
        case 'p3':
            for (i = 1; i <= 6; i++) if (c[i] >= 3) return sum;
            return 0;
        case 'p4':
            for (i = 1; i <= 6; i++) if (c[i] >= 4) return sum;
            return 0;
        case 'full':
            var has3 = false, has2 = false;
            for (i = 1; i <= 6; i++) {
                if (c[i] === 3) has3 = true;
                else if (c[i] === 2) has2 = true;
            }
            /* Cinco iguales también valen como full: contienen un trío y una
             * pareja. Es la lectura estándar y evita que una generala te deje
             * el full sin poder rellenar. */
            for (i = 1; i <= 6; i++) if (c[i] === 5) return 25;
            return (has3 && has2) ? 25 : 0;
        case 'ss':
            return hasRun(c, 4) ? 30 : 0;
        case 'ls':
            return hasRun(c, 5) ? 40 : 0;
        case 'gen':
            for (i = 1; i <= 6; i++) if (c[i] === 5) return 50;
            return 0;
        case 'ch':
            return sum;
    }
    return 0;
}

/* Corrida de `need` caras consecutivas presentes al menos una vez. */
function hasRun(c, need) {
    var run = 0;
    for (var i = 1; i <= 6; i++) {
        if (c[i] > 0) { run++; if (run >= need) return true; }
        else run = 0;
    }
    return false;
}

function upperSum() {
    var s = 0;
    for (var i = 0; i < 6; i++) {
        var id = BOXES[i].id;
        if (filled[id] != null) s += filled[id];
    }
    return s;
}

function total() {
    var s = 0;
    for (var id in filled) if (Object.prototype.hasOwnProperty.call(filled, id)) s += filled[id];
    if (upperSum() >= UPPER_BONUS_AT) s += UPPER_BONUS;
    return s;
}

function boxesLeft() {
    var n = 0;
    for (var i = 0; i < BOXES.length; i++) if (filled[BOXES[i].id] == null) n++;
    return n;
}

/* ── Turno ────────────────────────────────────────────────────────── */

function newGame() {
    dice = [];
    for (var i = 0; i < DICE; i++) dice.push({ v: 1, held: false });
    filled = {};
    rollsLeft = MAX_ROLLS;
    status = 'playing';
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
    roll();
}

function roll() {
    if (status !== 'playing' || rollsLeft <= 0) return;
    rollsLeft--;
    rollAnim = 0.5;
    for (var i = 0; i < DICE; i++) {
        if (dice[i].held) continue;
        dice[i].v = GU.randInt(1, 6);
    }
    shake.hit(5);
    GameAudio.hit();
    syncHud();
}

function toggleHold(i) {
    /* Con la primera tirada sin gastar no hay nada que apartar todavía. */
    if (status !== 'playing' || rollsLeft === MAX_ROLLS) return;
    dice[i].held = !dice[i].held;
    GameAudio.click();
}

function assign(boxId) {
    if (status !== 'playing' || filled[boxId] != null) return;
    if (rollsLeft === MAX_ROLLS) return;   // aún no se ha tirado en este turno

    var vals = dice.map(function (d) { return d.v; });
    var pts = valueFor(boxId, vals);
    filled[boxId] = pts;

    if (pts > 0) {
        GameAudio.score();
        fx.burst(W / 2, boxTop() + boxIndex(boxId) * BOX_H + BOX_H / 2, 12,
                 { color: '#ffd54a', speed: 90, life: 0.6, size: 2.5 });
    } else {
        GameAudio.miss();
    }

    if (boxesLeft() === 0) { endGame(); return; }

    rollsLeft = MAX_ROLLS;
    for (var i = 0; i < DICE; i++) dice[i].held = false;
    syncHud();
    roll();
}

function endGame() {
    status = 'over';
    var t = total();
    var record = best.submit(t);
    syncHud();
    gameControls.idle();
    var bonus = upperSum() >= UPPER_BONUS_AT;
    over.show({
        overTitle: record ? '¡Nuevo récord!' : 'Tabla completa',
        overScore: 'Total: ' + t + ' puntos',
        overBonus: bonus ? 'Con bono superior (+' + UPPER_BONUS + ')'
                         : 'Sin bono: te faltaron ' + (UPPER_BONUS_AT - upperSum()) + ' arriba'
    });
    GameAudio.win();
}

function syncHud() {
    hud.set({
        total: total(),
        rolls: rollsLeft,
        left:  boxesLeft(),
        best:  best.display(0)
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

var DIE_SIZE = 52;
var DIE_Y    = 54;
var BOX_H    = 33;
function dieX(i) { return 26 + i * ((W - 52 - DIE_SIZE) / (DICE - 1)); }
function boxTop() { return 140; }
function boxIndex(id) {
    for (var i = 0; i < BOXES.length; i++) if (BOXES[i].id === id) return i;
    return 0;
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0f2a1c');
        g.addColorStop(1, '#08170f');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    var shaking = shake.active();
    if (shaking) { ctx.save(); shake.translate(ctx); }
    drawDice();
    if (shaking) ctx.restore();

    drawTable();
    fx.draw(ctx);

    if (status === 'idle') drawIdle();
}

function drawDice() {
    for (var i = 0; i < DICE; i++) {
        var d = dice[i];
        if (!d) continue;
        var x = dieX(i), y = DIE_Y;
        /* Un dado apartado baja y se marca: tiene que verse de un vistazo cuál
         * se queda, porque es la única decisión de la fase de tirada. */
        if (d.held) y += 8;

        ctx.fillStyle = d.held ? '#ffd54a' : '#f4f1ea';
        GU.roundRectPath(ctx, x, y, DIE_SIZE, DIE_SIZE, 10);
        ctx.fill();
        ctx.strokeStyle = d.held ? '#a8811f' : '#b9b3a6';
        ctx.lineWidth = 2;
        ctx.stroke();

        drawPips(x, y, DIE_SIZE, d.v);

        if (d.held) {
            ctx.fillStyle = '#0d2016';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('FIJO', x + DIE_SIZE / 2, y + DIE_SIZE + 13);
            ctx.textAlign = 'left';
        }
    }

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 3, t.y - 3, t.w + 6, t.h + 6, 10);
        ctx.stroke();
    }
}

/* Las caras se dibujan con puntos, nunca con texto ni emoji. */
var PIP_LAYOUT = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]]
};
function drawPips(x, y, s, v) {
    var pts = PIP_LAYOUT[v] || PIP_LAYOUT[1];
    ctx.fillStyle = '#26221c';
    for (var i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(x + pts[i][0] * s, y + pts[i][1] * s, s * 0.075, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTable() {
    var vals = dice.map(function (d) { return d.v; });
    var canAssign = status === 'playing' && rollsLeft < MAX_ROLLS;
    var y0 = boxTop();

    for (var i = 0; i < BOXES.length; i++) {
        var b = BOXES[i];
        var y = y0 + i * BOX_H;
        var done = filled[b.id] != null;

        ctx.fillStyle = done ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)';
        GU.roundRectPath(ctx, 18, y + 2, W - 36, BOX_H - 4, 7);
        ctx.fill();

        ctx.fillStyle = done ? '#7d8b83' : '#e8f2ec';
        ctx.font = '14px Arial';
        ctx.fillText(b.name, 30, y + BOX_H / 2 + 5);

        ctx.textAlign = 'right';
        if (done) {
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 15px monospace';
            ctx.fillText(String(filled[b.id]), W - 30, y + BOX_H / 2 + 5);
        } else if (canAssign) {
            /* La previsualización es lo que convierte esto en un juego de
             * decisión y no de adivinar la tabla de memoria. */
            var v = valueFor(b.id, vals);
            ctx.fillStyle = v > 0 ? '#8fff6a' : '#5c6b63';
            ctx.font = 'bold 15px monospace';
            ctx.fillText(v > 0 ? '+' + v : '0', W - 30, y + BOX_H / 2 + 5);
        }
        ctx.textAlign = 'left';
    }

    /* Marcador del bono: cuánto llevas de los 63. */
    var us = upperSum();
    var by = y0 + BOXES.length * BOX_H + 8;
    ctx.fillStyle = '#0d2016';
    GU.roundRectPath(ctx, 18, by, W - 36, 26, 7);
    ctx.fill();
    ctx.fillStyle = us >= UPPER_BONUS_AT ? '#8fff6a' : '#b7c6d6';
    ctx.font = '13px Arial';
    ctx.fillText('Bono arriba: ' + us + ' / ' + UPPER_BONUS_AT +
                 (us >= UPPER_BONUS_AT ? '  ¡conseguido! +' + UPPER_BONUS : ''), 30, by + 17);
}

/* La pantalla de reposo la pinta GU.idleScreen: era el mismo bloque de doce
 * líneas en treinta juegos. */
function drawIdle() {
    GU.idleScreen(ctx, {
        title: 'GENERALA',
        lines: ['Cinco dados, tres tiradas, trece casillas'],
        bg: 'rgba(8,23,15,0.8)',
        color: '#ffd54a'
    });
}

/* ── Bucle ────────────────────────────────────────────────────────── */
/* Dibujo bajo demanda — ver GU.rafDraw. La tirada de dados y la sacudida son
 * las dos animaciones que mantienen el bucle vivo. */
var view = rafDraw(function (dt) {
    if (rollAnim > 0) rollAnim -= dt;
    shake.update(dt);
    fx.update(dt);
    draw();
    return rollAnim > 0 || shake.active() || fx.count > 0;
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (status !== 'playing') return;
    if (y >= DIE_Y - 6 && y <= DIE_Y + DIE_SIZE + 16) {
        for (var i = 0; i < DICE; i++) {
            if (x >= dieX(i) && x <= dieX(i) + DIE_SIZE) { toggleHold(i); return; }
        }
        return;
    }
    var y0 = boxTop();
    var idx = Math.floor((y - y0) / BOX_H);
    if (idx >= 0 && idx < BOXES.length) assign(BOXES[idx].id);
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Sin esto el juego entero sería un clic sobre un dado o una fila: nada
 * alcanzable con el teclado. Los objetivos son los cinco dados más las trece
 * casillas, y la lista se relee en cada pulsación. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Dados y tabla. Flechas para moverte, Enter para fijar un dado o apuntar la jugada.',
    targets: function () {
        var out = [], i;
        for (i = 0; i < DICE; i++) {
            out.push({ x: dieX(i), y: DIE_Y, w: DIE_SIZE, h: DIE_SIZE, id: 'd' + i, kind: 'die', i: i });
        }
        for (i = 0; i < BOXES.length; i++) {
            if (filled[BOXES[i].id] != null) continue;
            out.push({ x: 18, y: boxTop() + i * BOX_H + 2, w: W - 36, h: BOX_H - 4,
                       id: BOXES[i].id, kind: 'box' });
        }
        return out;
    },
    activate: function (t) {
        if (t.kind === 'die') toggleHold(t.i);
        else assign(t.id);
    }
});

GU.keys({ roll: ['r'] }, { onPress: function () { roll(); } });

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('rollBtn').addEventListener('click', function () { GameAudio.click(); roll(); });

syncHud();
draw();

}());

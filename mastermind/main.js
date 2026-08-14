/* Descifra el Código — mastermind clásico.
 *
 * El ordenador esconde una combinación de colores y tú la deduces por intentos.
 * Cada intento devuelve dos números y sólo dos: cuántas fichas están del color
 * correcto EN SU SITIO (negras) y cuántas son de un color que está en el código
 * pero en otra posición (blancas).
 *
 * El recuento es la única parte con trampa. Hay que hacerlo en DOS pasadas —
 * primero las negras, marcando lo consumido, y luego las blancas sobre lo que
 * queda— o los colores repetidos se cuentan de más: un intento con tres rojas
 * contra un código con una sola roja daría tres blancas en vez de una. */
(function () {
'use strict';

var canvas = document.getElementById('mmCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 400
var H = canvas.height;   // 620

var SLOTS = 4;
var ROWS  = 10;

var COLORS = ['#ff512f', '#ffd54a', '#8fff6a', '#00e5ff', '#c78fff', '#ff8fc4'];
var COLOR_NAMES = ['rojo', 'amarillo', 'verde', 'cian', 'violeta', 'rosa'];

/* Geometría del tablero. Las filas se pintan de abajo arriba: el intento en
 * curso queda siempre en la parte baja, cerca de la paleta. */
var PEG_R   = 15;
var ROW_H   = 46;
var BOARD_X = 26;
var BOARD_Y = 40;
var PAL_Y   = H - 58;

var secret = [];
var guesses = [];        // [{pegs:[], black, white}]
var current = [];        // intento en curso
var picked = 0;          // color seleccionado en la paleta
var status = 'idle';     // idle | playing | won | lost
var revealSecret = false;

var fx = new Particles(160);
var gMemo = GU.gradientMemo();

/* Menos intentos es mejor, así que el récord se invierte. Un marcador normal
 * con 0 por defecto nunca daría récord en la primera partida. */
var best = GU.highScore('mastermindBest', { lower: true });

var hud = GU.hud({
    tries: 'triesLabel',
    left:  'leftLabel',
    best:  { el: 'highScore', format: function (v) { return v === null ? '—' : v; } },
    mobile: { el: 'mobileScore', format: function () {
        return 'Intento ' + (guesses.length + 1) + ' de ' + ROWS +
               '  ·  Récord: ' + (best.has() ? best.value + ' intentos' : '—');
    } }
});

/* ── Partida ──────────────────────────────────────────────────────── */

function newGame() {
    secret = [];
    /* Con repeticiones permitidas: son 6^4 = 1296 combinaciones, el mastermind
     * de toda la vida. Prohibirlas lo dejaría en 360 y mucho más fácil. */
    for (var i = 0; i < SLOTS; i++) secret.push(GU.randInt(0, COLORS.length - 1));
    guesses = [];
    current = [];
    picked = 0;
    revealSecret = false;
    status = 'playing';
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

/* Las dos pasadas. `usedS` marca las fichas del código ya consumidas y `usedG`
 * las del intento, de forma que ninguna se cuenta dos veces. */
function score(guess) {
    var black = 0, white = 0;
    var usedS = [false, false, false, false];
    var usedG = [false, false, false, false];
    var i, j;
    for (i = 0; i < SLOTS; i++) {
        if (guess[i] === secret[i]) { black++; usedS[i] = usedG[i] = true; }
    }
    for (i = 0; i < SLOTS; i++) {
        if (usedG[i]) continue;
        for (j = 0; j < SLOTS; j++) {
            if (usedS[j] || guess[i] !== secret[j]) continue;
            white++; usedS[j] = usedG[i] = true;
            break;
        }
    }
    return { black: black, white: white };
}

function submit() {
    if (status !== 'playing' || current.length < SLOTS) return;
    var res = score(current);
    guesses.push({ pegs: current.slice(), black: res.black, white: res.white });
    current = [];

    if (res.black === SLOTS) {
        status = 'won';
        revealSecret = true;
        var tries = guesses.length;
        var record = best.submit(tries);
        for (var i = 0; i < SLOTS; i++) {
            fx.burst(BOARD_X + 30 + i * 52, rowY(guesses.length - 1), 14,
                     { color: COLORS[secret[i]], speed: 110, life: 0.8, size: 3 });
        }
        GameAudio.win();
        syncHud();
        setTimeout(function () {
            gameControls.idle();
            over.show({
                overTitle: record ? '¡Nuevo récord!' : '¡Código descifrado!',
                overScore: 'Lo has sacado en ' + tries + (tries === 1 ? ' intento' : ' intentos'),
                overBest:  best.has() ? 'Tu mejor marca: ' + best.value : ''
            });
        }, 900);
        return;
    }

    if (guesses.length >= ROWS) {
        status = 'lost';
        revealSecret = true;
        GameAudio.gameOver();
        syncHud();
        setTimeout(function () {
            gameControls.idle();
            over.show({
                overTitle: 'Sin intentos',
                overScore: 'El código era: ' + secret.map(function (c) { return COLOR_NAMES[c]; }).join(', '),
                overBest:  best.has() ? 'Tu mejor marca: ' + best.value + ' intentos' : ''
            });
        }, 700);
        return;
    }

    GameAudio.place();
    syncHud();
}

function place(colorIdx) {
    if (status !== 'playing' || current.length >= SLOTS) return;
    current.push(colorIdx);
    GameAudio.flip();
    /* Enviar solo cuando el jugador lo pida: rellenar la fila no debe gastar el
     * intento, porque cambiar de idea en la última ficha es parte del juego. */
}

function undo() {
    if (status !== 'playing' || !current.length) return;
    current.pop();
    GameAudio.click();
}

function syncHud() {
    hud.set({
        tries: guesses.length,
        left:  Math.max(0, ROWS - guesses.length),
        best:  best.has() ? best.value : null
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

/* Fila 0 abajo del todo. La fila `guesses.length` es la que se está montando. */
function rowY(row) { return PAL_Y - 74 - row * ROW_H; }
function slotX(i)  { return BOARD_X + 30 + i * 52; }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#141726');
        g.addColorStop(1, '#0a0c16');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawSecretRow();
    drawRows();
    drawCurrent();
    fx.draw(ctx);
    drawPalette();

    if (status === 'idle') drawIdle();
}

function drawSecretRow() {
    ctx.fillStyle = '#1b1f30';
    GU.roundRectPath(ctx, BOARD_X, BOARD_Y - 22, W - BOARD_X * 2, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#8fd3f4';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CÓDIGO', BOARD_X + 10, BOARD_Y + 4);
    /* Las fichas del código se alinean a la DERECHA del recuadro: alineadas a la
     * izquierda como las de los intentos, la primera quedaba debajo del rótulo. */
    for (var i = 0; i < SLOTS; i++) {
        var x = W - BOARD_X - 22 - (SLOTS - 1 - i) * 40, y = BOARD_Y;
        if (revealSecret) {
            drawPeg(x, y, COLORS[secret[i]], 13);
        } else {
            ctx.fillStyle = '#2b3145';
            ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#586080';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('?', x, y + 5);
            ctx.textAlign = 'left';
        }
    }
}

function drawRows() {
    for (var r = 0; r < guesses.length; r++) {
        var g = guesses[r];
        var y = rowY(r);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        GU.roundRectPath(ctx, BOARD_X, y - 19, W - BOARD_X * 2, 38, 9);
        ctx.fill();
        for (var i = 0; i < SLOTS; i++) drawPeg(slotX(i), y, COLORS[g.pegs[i]], PEG_R - 2);
        drawFeedback(W - BOARD_X - 44, y, g.black, g.white);
    }
}

function drawCurrent() {
    if (status !== 'playing') return;
    var y = rowY(guesses.length);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    GU.roundRectPath(ctx, BOARD_X, y - 19, W - BOARD_X * 2, 38, 9);
    ctx.stroke();
    for (var i = 0; i < SLOTS; i++) {
        if (i < current.length) {
            drawPeg(slotX(i), y, COLORS[current[i]], PEG_R - 2);
        } else {
            ctx.strokeStyle = '#3a4260';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(slotX(i), y, PEG_R - 4, 0, Math.PI * 2); ctx.stroke();
        }
    }
}

/* Las cuatro marcas van en un cuadrado 2x2: negras primero, luego blancas. */
function drawFeedback(cx, cy, black, white) {
    var k = 0;
    for (var i = 0; i < SLOTS; i++) {
        var px = cx + (i % 2) * 13;
        var py = cy - 7 + Math.floor(i / 2) * 14;
        ctx.beginPath();
        ctx.arc(px, py, 4.6, 0, Math.PI * 2);
        if (k < black)              ctx.fillStyle = '#ff512f';
        else if (k < black + white) ctx.fillStyle = '#f0f0f0';
        else                        ctx.fillStyle = '#2b3145';
        ctx.fill();
        k++;
    }
}

function drawPeg(x, y, color, r) {
    /* Degradado por color y radio, no por posición: la clave queda acotada a
     * seis colores por dos radios y no crece frame a frame. */
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = gMemo('peg' + color + r, function () {
        var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
        g.addColorStop(0, GU.mixColor(color, '#ffffff', 0.55));
        g.addColorStop(1, color);
        return g;
    });
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function drawPalette() {
    ctx.fillStyle = '#171b29';
    GU.roundRectPath(ctx, 14, PAL_Y - 30, W - 28, 58, 12);
    ctx.fill();
    for (var i = 0; i < COLORS.length; i++) {
        var x = palX(i);
        drawPeg(x, PAL_Y, COLORS[i], 17);
        if (i === picked) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(x, PAL_Y, 22, 0, Math.PI * 2); ctx.stroke();
        }
    }
    /* Anillo de foco del teclado, después de las fichas: es un indicador, no
     * una decoración del tablero. */
    /* target() ya devuelve null si el foco no viene del teclado: lleva dentro
     * la regla de :focus-visible, así que no hay que consultarla aparte. */
    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 8);
        ctx.stroke();
    }
}

function palX(i) { return 40 + i * ((W - 80) / (COLORS.length - 1)); }

function drawIdle() {
    ctx.fillStyle = 'rgba(10,12,22,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 25px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DESCIFRA EL CÓDIGO', W / 2, H / 2 - 14);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Cuatro colores, diez intentos', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Bucle ────────────────────────────────────────────────────────── */
rafLoop(function (dt) {
    fx.update(dt);
    draw();
});

/* ── Entrada ──────────────────────────────────────────────────────── */

/* Un solo camino para el clic y para el teclado: los dos acaban aquí, así que
 * los dos modos no pueden separarse con el tiempo. */
function handleAt(x, y) {
    if (status !== 'playing') return;
    if (y > PAL_Y - 34) {
        for (var i = 0; i < COLORS.length; i++) {
            if (Math.abs(x - palX(i)) < 24) { picked = i; place(i); return; }
        }
        return;
    }
    var rowTop = rowY(guesses.length);
    if (Math.abs(y - rowTop) < 22) {
        /* Tocar la fila en curso borra la última ficha: es el gesto natural
         * para corregirse sin buscar un botón. */
        undo();
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, {
    preventDefault: true,
    onTap: function (p) { handleAt(p.x, p.y); }
});

/* Este juego sería sólo de ratón sin esto: toda su interacción es un clic sobre
 * un círculo. `targets()` se relee en cada pulsación, así que no hay nada que
 * mantener sincronizado. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Paleta de colores. Flechas para elegir, Enter para poner la ficha.',
    targets: function () {
        var out = [];
        for (var i = 0; i < COLORS.length; i++) {
            out.push({ x: palX(i) - 18, y: PAL_Y - 18, w: 36, h: 36, id: 'c' + i, color: i });
        }
        return out;
    },
    activate: function (t) { picked = t.color; place(t.color); }
});

/* Sin preventDefault a propósito: Enter también activa el botón que tenga el
 * foco, y tragárselo aquí dejaría los botones muertos para el teclado. */
GU.keys({
    submit: ['Enter'],
    undo:   ['Backspace', 'Delete']
}, {
    onPress: function (a) {
        if (a === 'submit') submit();
        else undo();
    }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('submitBtn').addEventListener('click', function () { GameAudio.click(); submit(); });
document.getElementById('undoBtn').addEventListener('click', function () { undo(); });

syncHud();
draw();

}());

/* Apaga las Luces — pulsa una casilla y cambian ella y sus cuatro vecinas.
 *
 * Lo que hace que esto sea un puzzle y no una lotería: el tablero se genera
 * SIEMPRE desde el estado apagado, aplicando pulsaciones al azar. Cualquier
 * tablero construido así se apaga deshaciendo esas mismas pulsaciones, así que
 * tiene solución por construcción. Sembrar luces al azar produce tableros
 * imposibles en cuanto la rejilla es par: en un 5×5 sólo 1 de cada 4
 * configuraciones se puede apagar, y el jugador no tiene forma de distinguir
 * "no lo veo" de "no se puede".
 *
 * Dos propiedades del juego que conviene saber, y que se aprovechan aquí:
 * pulsar dos veces la misma casilla no hace nada, y el orden da igual. Por eso
 * la solución mínima es un SUBCONJUNTO de casillas, y el contador de
 * pulsaciones puede compararse contra ese mínimo. */
(function () {
'use strict';

var canvas = document.getElementById('loCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 420
var H = canvas.height;   // 460

var SIZES = { facil: 4, medio: 5, dificil: 6 };
var N = 5;
var PAD = 18;
var cell = 0;            // recalculado por tamaño

var grid = null;         // Uint8Array, 1 = encendida
var solution = null;     // las pulsaciones que la generaron, para la pista
var moves = 0;
var minMoves = 0;
var status = 'idle';     // idle | playing | won
var hintCell = -1, hintT = 0;

var fx = new Particles(180);
var gMemo = GU.gradientMemo();

/* El récord es el MENOR número de pulsaciones, y por dificultad. Con el 0 por
 * defecto de un marcador normal la primera partida nunca sería récord. */
var bests = {
    facil:   GU.highScore('lightsoutBestFacil',   { lower: true }),
    medio:   GU.highScore('lightsoutBestMedio',   { lower: true }),
    dificil: GU.highScore('lightsoutBestDificil', { lower: true })
};
var diff = 'medio';

var hud = GU.hud({
    moves: 'movesLabel',
    on:    'onLabel',
    best:  { el: 'highScore', format: function (v) { return v == null ? '—' : v; } },
    mobile: { el: 'mobileScore', format: function () {
        return moves + ' pulsaciones  ·  ' + litCount() + ' encendidas';
    } }
});

function idx(r, c) { return r * N + c; }
function litCount() {
    var n = 0;
    for (var i = 0; i < grid.length; i++) n += grid[i];
    return n;
}

/* ── Generación ───────────────────────────────────────────────────── */

/* Aplica una pulsación: la casilla y sus vecinas ortogonales. */
function press(r, c) {
    var d = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var k = 0; k < 5; k++) {
        var rr = r + d[k][0], cc = c + d[k][1];
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        grid[idx(rr, cc)] ^= 1;
    }
}

function newGame() {
    N = SIZES[diff];
    cell = Math.floor((Math.min(W, H - 40) - PAD * 2) / N);
    grid = new Uint8Array(N * N);

    /* Se pulsa un subconjunto al azar de casillas, cada una a lo sumo una vez:
     * pulsarla dos veces se anula, así que un multiconjunto no aportaría nada y
     * sí falsearía la cuenta de pulsaciones mínimas. */
    var all = [];
    for (var i = 0; i < N * N; i++) all.push(i);
    GU.shuffle(all);
    var howMany = Math.max(3, Math.floor(N * N * GU.rand(0.25, 0.5)));
    solution = all.slice(0, howMany).sort(function (a, b) { return a - b; });
    for (var k = 0; k < solution.length; k++) {
        press(Math.floor(solution[k] / N), solution[k] % N);
    }

    /* Un tablero ya apagado no es un puzzle: se vuelve a tirar. */
    if (litCount() === 0) { newGame(); return; }

    /* Ojo: `solution.length` es UNA solución, no necesariamente la mínima —
     * ciertas combinaciones se cancelan entre sí. Sirve como referencia y para
     * la pista, y el récord lo compara contra lo que el jugador consiga de
     * verdad, que es lo que importa. */
    minMoves = solution.length;
    moves = 0;
    hintCell = -1;
    status = 'playing';
    fx.clear();
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
}

/* ── Jugada ───────────────────────────────────────────────────────── */

function play(r, c) {
    if (status !== 'playing') return;
    press(r, c);
    moves++;
    hintCell = -1;
    GameAudio.click();
    syncHud();
    if (litCount() === 0) win();
}

function win() {
    status = 'won';
    var record = bests[diff].submit(moves);
    for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
            fx.burst(cellX(c) + cell / 2, cellY(r) + cell / 2, 4,
                     { color: '#ffd54a', speed: 70, life: 0.7, size: 2 });
        }
    }
    syncHud();
    gameControls.idle();
    GameAudio.win();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Todo apagado!',
            overScore: 'Lo has hecho en ' + moves + (moves === 1 ? ' pulsación' : ' pulsaciones'),
            overBest:  bests[diff].has() ? 'Tu mejor marca aquí: ' + bests[diff].value : ''
        });
    }, 700);
}

/* La pista señala una casilla de la solución generadora que el jugador aún no
 * ha pulsado un número impar de veces. Como el orden da igual y pulsar dos
 * veces se anula, cualquiera de ellas sigue siendo un paso válido. */
function hint() {
    if (status !== 'playing') return;
    hintCell = solution.length ? GU.pick(solution) : -1;
    hintT = 2;
    GameAudio.reveal();
}

function syncHud() {
    hud.set({
        moves: moves,
        on:    litCount(),
        best:  bests[diff].has() ? bests[diff].value : null
    });
}

/* ── Geometría ────────────────────────────────────────────────────── */

function boardX() { return (W - N * cell) / 2; }
function boardY() { return 30; }
function cellX(c) { return boardX() + c * cell; }
function cellY(r) { return boardY() + r * cell; }

/* ── Dibujo ───────────────────────────────────────────────────────── */

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#161326');
        g.addColorStop(1, '#0b0916');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    if (grid) {
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) drawCell(r, c);
        }
    }
    fx.draw(ctx);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 2, t.y - 2, t.w + 4, t.h + 4, 10);
        ctx.stroke();
    }

    if (status === 'idle') drawIdle();
}

function drawCell(r, c) {
    var on = grid[idx(r, c)] === 1;
    var x = cellX(c), y = cellY(r), s = cell - 6;

    /* Degradado cacheado por estado y tamaño, construido en el ORIGEN y
     * trasladado: por posición serían N*N gradientes nuevos cada frame. */
    ctx.save();
    ctx.translate(x + 3, y + 3);
    ctx.fillStyle = gMemo('c' + on + s, function () {
        var g = ctx.createLinearGradient(0, 0, 0, s);
        if (on) { g.addColorStop(0, '#ffe98a'); g.addColorStop(1, '#f5a623'); }
        else    { g.addColorStop(0, '#2a2740'); g.addColorStop(1, '#1b1930'); }
        return g;
    });
    GU.roundRectPath(ctx, 0, 0, s, s, 9);
    ctx.fill();

    if (on) {
        /* El brillo es una segunda pasada más pequeña, no shadowBlur: con 36
         * casillas la sombra era el frame entero. */
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        GU.roundRectPath(ctx, s * 0.16, s * 0.14, s * 0.68, s * 0.3, 6);
        ctx.fill();
    }
    ctx.strokeStyle = on ? '#c07f13' : '#332f4d';
    ctx.lineWidth = 1.5;
    GU.roundRectPath(ctx, 0, 0, s, s, 9);
    ctx.stroke();
    ctx.restore();

    if (hintCell === idx(r, c) && hintT > 0) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, x + 1, y + 1, cell - 2, cell - 2, 11);
        ctx.stroke();
    }
}

function drawIdle() {
    ctx.fillStyle = 'rgba(11,9,22,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 25px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('APAGA LAS LUCES', W / 2, H / 2 - 12);
    ctx.fillStyle = '#b7c6d6';
    ctx.font = '15px Arial';
    ctx.fillText('Cada pulsación cambia la casilla y sus vecinas', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* Arrancado aquí abajo, fuera de sí mismo: un bucle que sólo se referencia
 * dentro nunca corre y el juego se queda quieto sin dar error. */
rafLoop(function (dt) {
    if (hintT > 0) hintT -= dt;
    fx.update(dt);
    draw();
});

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (status !== 'playing') return;
    var c = Math.floor((x - boardX()) / cell);
    var r = Math.floor((y - boardY()) / cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    play(r, c);
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Sin esto el juego entero sería un clic sobre una casilla: nada alcanzable con
 * el teclado. `targets()` se relee en cada pulsación, así que cambiar de tamaño
 * de tablero no deja el cursor apuntando a nada. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de luces. Flechas para moverte, Enter para pulsar.',
    targets: function () {
        var out = [];
        if (!grid) return out;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                out.push({ x: cellX(c) + 3, y: cellY(r) + 3, w: cell - 6, h: cell - 6,
                           id: r + ',' + c, r: r, c: c });
            }
        }
        return out;
    },
    activate: function (t) { play(t.r, t.c); }
});

GU.keys({ hint: ['h'] }, { onPress: hint });

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('hintBtn').addEventListener('click', function () { GameAudio.click(); hint(); });
document.getElementById('diffSel').addEventListener('change', function () {
    diff = this.value;
    syncHud();
});

N = SIZES[diff];
cell = Math.floor((Math.min(W, H - 40) - PAD * 2) / N);
grid = new Uint8Array(N * N);
syncHud();
draw();

}());

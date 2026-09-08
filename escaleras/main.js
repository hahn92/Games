/* Serpientes y Escaleras — carrera a la casilla 100 contra la máquina.
 *
 * No hay decisiones: es un juego de dado puro, y de lo que va es de cuánto
 * puede cambiar una partida en un solo tiro. Las tres reglas que lo sostienen:
 *
 * - **Para entrar en la 100 hay que sacar el número exacto.** Si te pasas,
 *   rebotas hacia atrás tantas casillas como te sobren. Sin eso, el que llega
 *   primero a la zona alta gana casi siempre y el final no tiene tensión.
 * - **El seis repite tirada**, y encadenar seises puede resolver la partida.
 * - Las escaleras y las serpientes están **fijas**, no al azar: son las del
 *   tablero clásico, colocadas donde más duele. Un tablero aleatorio hace que
 *   la partida no se pueda leer de un vistazo.
 *
 * El recorrido es en **bustrofedon** —la fila 1 va de izquierda a derecha, la 2
 * de derecha a izquierda— que es como está numerado el tablero de verdad.
 * `cellPos()` es el único sitio que lo sabe; el resto del juego trabaja con el
 * número de casilla y nada más.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var N = 10;                       // 10×10 = 100 casillas
var BOARD_TOP = 14;
var PANEL_H = 96;

/* Tablero clásico: pie → cabeza en las escaleras, cabeza → cola en las
 * serpientes. Todas las escaleras suben y todas las serpientes bajan; una
 * "escalera" que bajara sería una serpiente con otro dibujo. */
var LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
var SNAKES  = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

var YOU = 0, AI = 1;
var pos = [0, 0];                 // 0 = fuera del tablero, aún sin salir
var turn = YOU;
var status = 'idle';              // idle | playing | rolling | over
var die = 1, dieAnim = 0;
var wins = GameStore.getNum('escalerasWins', 0);
var moveAnim = null;              // {who, from, to, t, kind}

var fx = new Particles(200);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    you:  'youLabel',
    ai:   'aiLabel',
    wins: 'winsLabel',
    mobile: { el: 'mobileScore', format: function (v) {
        return 'Tú ' + v.you + '  ·  Máquina ' + v.ai;
    } }
});

var over = GU.popup('overPopup');

/* ── Geometría ────────────────────────────────────────────────────── */

function cellSize() { return Math.min((W - 24) / N, (H - BOARD_TOP - PANEL_H) / N); }
function boardX() { return (W - cellSize() * N) / 2; }
function boardY() { return BOARD_TOP; }

/* Casilla 1..100 → centro en píxeles. La numeración serpentea: las filas
 * impares van hacia la derecha y las pares hacia la izquierda. */
function cellPos(n) {
    var i = n - 1;
    var row = Math.floor(i / N);              // 0 abajo
    var col = i % N;
    if (row % 2 === 1) col = N - 1 - col;
    var s = cellSize();
    return {
        x: boardX() + col * s + s / 2,
        y: boardY() + (N - 1 - row) * s + s / 2
    };
}

/* ── Partida ──────────────────────────────────────────────────────── */

function newGame() {
    pos = [0, 0];
    turn = YOU;
    status = 'playing';
    die = 1;
    dieAnim = 0;
    moveAnim = null;
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function syncHud() {
    hud.set({ you: pos[YOU], ai: pos[AI], wins: wins });
}

function roll() {
    if (status !== 'playing') return;
    status = 'rolling';
    dieAnim = 0.5;
    GameAudio.click();
    view.invalidate();
    /* El dado gira medio segundo antes de resolver: sin esa pausa el salto de
     * la ficha parece que ocurre sin causa. */
    setTimeout(function () {
        die = GU.rollDie(6);
        resolveRoll();
        view.invalidate();
    }, 520);
}

function resolveRoll() {
    var who = turn;
    var from = pos[who];
    var to = from + die;

    /* Pasarse de 100 rebota: sobran (to - 100) casillas y se anda hacia atrás. */
    if (to > 100) to = 100 - (to - 100);

    pos[who] = to;
    dieAnim = 0;
    startMove(who, from, to, 'walk');
}

function startMove(who, from, to, kind) {
    moveAnim = { who: who, from: from, to: to, t: 0, kind: kind };
    status = 'rolling';
    GameAudio[kind === 'walk' ? 'hop' : (kind === 'ladder' ? 'powerUp' : 'bomb')]();
    view.invalidate();
}

/* Se llama al terminar cada tramo de animación: encadena escalera o serpiente,
 * y sólo entonces decide victoria o cambio de turno. Resolverlo todo de golpe
 * al tirar hace que la ficha aparezca ya al final del tobogán. */
function finishMove() {
    var who = moveAnim.who;
    var at = pos[who];
    moveAnim = null;

    if (LADDERS[at] !== undefined) {
        var top = LADDERS[at];
        pos[who] = top;
        msg.show(who === YOU ? '¡Escalera arriba!' : 'Escalera para la máquina', 1.2);
        celebrate(top, '#66bb6a');
        syncHud();
        startMove(who, at, top, 'ladder');
        return;
    }
    if (SNAKES[at] !== undefined) {
        var tail = SNAKES[at];
        pos[who] = tail;
        msg.show(who === YOU ? 'Serpiente… abajo' : 'La máquina resbala', 1.2);
        celebrate(tail, '#e94f4f');
        syncHud();
        startMove(who, at, tail, 'snake');
        return;
    }

    syncHud();

    if (pos[who] === 100) { finish(who); return; }

    if (die === 6) {
        msg.show(who === YOU ? 'Seis: repites' : 'Seis: repite la máquina', 1.1);
    } else {
        turn = who === YOU ? AI : YOU;
    }
    status = 'playing';

    if (turn === AI && status === 'playing') {
        setTimeout(function () { if (status === 'playing' && turn === AI) roll(); view.invalidate(); }, 620);
    }
}

function celebrate(n, color) {
    var p = cellPos(n);
    fx.burst(p.x, p.y, 14, { color: color, speed: 90, life: 0.8, size: 3, gravity: 140 });
}

function finish(who) {
    status = 'over';
    if (who === YOU) {
        wins++;
        GameStore.setNum('escalerasWins', wins);
        GameAudio.win();
        for (var k = 0; k < 30; k++) {
            fx.burst(GU.rand(20, W - 20), GU.rand(20, H / 2), 2,
                     { color: GU.pick(['#ffd54a', '#8fd3f4', '#66bb6a']), speed: 120, life: 1, size: 3, gravity: 130 });
        }
    } else {
        GameAudio.gameOver();
    }
    gameControls.idle();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: who === YOU ? '¡Llegas a la 100!' : 'Gana la máquina',
            overScore: who === YOU
                ? 'La máquina se quedó en la ' + pos[AI]
                : 'Te quedaste en la ' + pos[YOU],
            overRecord: 'Partidas ganadas: ' + wins
        });
    }, 700);
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

function drawBoard() {
    var s = cellSize();
    for (var n = 1; n <= 100; n++) {
        var p = cellPos(n);
        var i = n - 1;
        var row = Math.floor(i / N), col = i % N;
        ctx.fillStyle = (row + col) % 2 === 0 ? '#1c4433' : '#173626';
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s + 0.5, s + 0.5);
    }

    ctx.fillStyle = 'rgba(220,240,225,0.5)';
    ctx.font = Math.round(cellSize() * 0.26) + 'px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var m = 1; m <= 100; m++) {
        var q = cellPos(m);
        ctx.fillText(m, q.x - s / 2 + 3, q.y - s / 2 + 2);
    }

    // la meta, marcada
    var goal = cellPos(100);
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.strokeRect(goal.x - s / 2 + 1, goal.y - s / 2 + 1, s - 2, s - 2);
}

/* Escaleras y serpientes se dibujan con formas, nunca con texto ni emoji. */
function drawLinks() {
    var s = cellSize();

    for (var from in LADDERS) {
        var a = cellPos(+from), b = cellPos(LADDERS[from]);
        var dx = b.x - a.x, dy = b.y - a.y;
        var len = Math.hypot(dx, dy);
        var nx = -dy / len * (s * 0.14), ny = dx / len * (s * 0.14);
        ctx.strokeStyle = '#c58a3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
        ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(b.x - nx, b.y - ny);
        ctx.stroke();
        // peldaños
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#e0a856';
        var steps = Math.max(2, Math.round(len / (s * 0.42)));
        ctx.beginPath();
        for (var k = 1; k < steps; k++) {
            var t = k / steps;
            var mx = a.x + dx * t, my = a.y + dy * t;
            ctx.moveTo(mx + nx, my + ny); ctx.lineTo(mx - nx, my - ny);
        }
        ctx.stroke();
    }

    for (var head in SNAKES) {
        var h = cellPos(+head), tl = cellPos(SNAKES[head]);
        var hdx = tl.x - h.x, hdy = tl.y - h.y;
        var hlen = Math.hypot(hdx, hdy);
        var px = -hdy / hlen, py = hdx / hlen;
        ctx.strokeStyle = '#7fbf4d';
        ctx.lineWidth = s * 0.17;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        /* Dos ondas laterales: una recta no se lee como serpiente y una curva
         * con más vueltas se confunde con la escalera de al lado. */
        var amp = s * 0.5;
        ctx.bezierCurveTo(h.x + hdx * 0.33 + px * amp, h.y + hdy * 0.33 + py * amp,
                          h.x + hdx * 0.66 - px * amp, h.y + hdy * 0.66 - py * amp,
                          tl.x, tl.y);
        ctx.stroke();

        // cabeza y ojo
        ctx.fillStyle = '#5f9e34';
        ctx.beginPath();
        ctx.arc(h.x, h.y, s * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1a0a';
        ctx.beginPath();
        ctx.arc(h.x - s * 0.05, h.y - s * 0.04, s * 0.035, 0, Math.PI * 2);
        ctx.arc(h.x + s * 0.06, h.y - s * 0.04, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
    }
}

function pawnPos(who) {
    /* Durante la animación la ficha va interpolada entre las dos casillas; el
     * resto del tiempo está en la suya. Una ficha en la 0 espera fuera. */
    if (moveAnim && moveAnim.who === who) {
        var a = moveAnim.from === 0 ? offBoard(who) : cellPos(moveAnim.from);
        var b = cellPos(moveAnim.to);
        var t = GU.easeInOutQuad(Math.min(1, moveAnim.t));
        return { x: GU.lerp(a.x, b.x, t), y: GU.lerp(a.y, b.y, t) };
    }
    return pos[who] === 0 ? offBoard(who) : cellPos(pos[who]);
}

function offBoard(who) {
    return { x: boardX() + (who === YOU ? -0 : cellSize() * N), y: boardY() + cellSize() * N + 16 };
}

function drawPawns() {
    var s = cellSize();
    [AI, YOU].forEach(function (who) {
        var p = pawnPos(who);
        var off = who === YOU ? -s * 0.16 : s * 0.16;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x + off, p.y + s * 0.2, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = who === YOU ? '#8fd3f4' : '#ff8a3d';
        ctx.beginPath();
        ctx.arc(p.x + off, p.y - s * 0.05, s * 0.19, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = who === YOU ? '#2b6ea8' : '#a8481a';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function diePos() {
    var s = 52;
    return { x: W / 2 - s / 2, y: H - PANEL_H + 20, s: s };
}

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#16351f');
        g.addColorStop(1, '#081208');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    drawBoard();
    drawLinks();
    drawPawns();
    fx.draw(ctx);

    // dado y turno
    var d = diePos();
    /* Mientras rueda enseña caras al azar, pero elegidas en update() y no aquí:
     * un frame repintado dos veces —como pasa en un resize— no puede cambiar la
     * cara del dado. */
    GU.drawDie(ctx, d.x, d.y, d.s, die, { face: '#f7f3e8' });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = turn === YOU ? '#8fd3f4' : '#ff8a3d';
    var label = status === 'over' ? 'Fin de la carrera'
              : status === 'rolling' ? '…'
              : (turn === YOU ? 'Tira tú (Espacio)' : 'Tira la máquina');
    ctx.fillText(label, W / 2, H - 18);

    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Tú: ' + pos[YOU], W * 0.18, H - PANEL_H + 42);
    ctx.fillStyle = '#ff8a3d';
    ctx.fillText('Máq: ' + pos[AI], W * 0.82, H - PANEL_H + 42);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, t.x - 5, t.y - 5, t.w + 10, t.h + 10, 12);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, boardY() + cellSize() * N + 8);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'SERPIENTES Y ESCALERAS',
            titleSize: 22,
            lines: ['Sube por las escaleras, esquiva las serpientes',
                    'Pulsa Iniciar'],
            bg: 'rgba(8,18,8,0.86)',
            color: '#66bb6a'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt() {
    if (status === 'playing' && turn === YOU) roll();
}

canvas.addEventListener('click', handleAt);
GU.swipe(canvas, { onTap: handleAt });

document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
        /* Sin preventDefault el espacio activaría además el botón que tenga el
         * foco, que después de Iniciar es justo Iniciar. */
        e.preventDefault();
        handleAt();
    }
});

var cursor = GU.canvasCursor(canvas, {
    label: 'Serpientes y escaleras. Enter para tirar el dado.',
    targets: function () {
        if (status !== 'playing' || turn !== YOU) return [];
        var d = diePos();
        return [{ x: d.x, y: d.y, w: d.s, h: d.s, id: 'die' }];
    },
    activate: handleAt,
    onChange: function () { view.invalidate(); }
});

/* ── Bucle ────────────────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. Aquí lo que mantiene el bucle vivo es
 * la ficha en movimiento, el dado girando y las partículas. */
var view = rafDraw(function (dt) {
    if (dieAnim > 0) {
        dieAnim -= dt;
        die = GU.rollDie(6);          // en update, nunca en draw
    }
    if (moveAnim) {
        moveAnim.t += dt * (moveAnim.kind === 'walk' ? 2.6 : 1.8);
        if (moveAnim.t >= 1) finishMove();
    }
    fx.update(dt);
    msg.update(dt);
    draw();
    return !!moveAnim || dieAnim > 0 || fx.count > 0 || msg.active();
});

var gameControls = GU.controls({
    start:     newGame,
    restart:   newGame,
    playAgain: newGame,
    popup:     'overPopup'
});

syncHud();

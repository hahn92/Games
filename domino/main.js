/* Dominó — doble seis contra la máquina, con robo del pozo.
 *
 * La parte con miga no es encadenar fichas: es que UNA FICHA SE PUEDE GIRAR.
 * Para casar en un extremo hay que mirar los dos números y, si el que casa es
 * el segundo, la ficha entra invertida. Guardar la ficha como un par ordenado
 * {a, b} y decidir la orientación al colocarla es lo que mantiene esto simple;
 * el error clásico es guardar ya "girada" y perder de vista cuál era cuál.
 *
 * La cadena se guarda como una lista de fichas ya orientadas, así que los
 * extremos jugables son siempre `chain[0].a` y `chain[último].b`. */
(function () {
'use strict';

var canvas = document.getElementById('domCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;    // 420
var H = canvas.height;   // 600

var MAX_PIP = 6;
var HAND_SIZE = 7;

var TILE_W = 30, TILE_H = 58;    // ficha vertical en la mano
var CH_W = 44, CH_H = 24;        // ficha tumbada en la cadena

var stock = [];      // pozo
var hand = [];       // [{a, b}]
var aiHand = [];
var chain = [];      // [{a, b}] ya orientadas: a a la izquierda, b a la derecha
var selected = -1;
var turn = 'player';  // player | ai
var status = 'idle';  // idle | playing | over
var msg = '', msgT = 0;
var wins = 0, losses = 0;

var fx = new Particles(150);
var gMemo = GU.gradientMemo();
var best = GU.highScore('dominoWins');

var hud = GU.hud({
    wins:   'winsLabel',
    losses: 'lossesLabel',
    hand:   'handLabel',
    stock:  'stockLabel',
    best:   'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return 'Tú ' + hand.length + '  ·  Máquina ' + aiHand.length + '  ·  Pozo ' + stock.length;
    } }
});

/* ── Reparto ──────────────────────────────────────────────────────── */

function buildStock() {
    stock = [];
    /* Cada combinación una sola vez: b nunca menor que a, o saldrían duplicadas
     * (el 3|5 y el 5|3 son la misma ficha). Son 28 en el doble seis. */
    for (var a = 0; a <= MAX_PIP; a++) {
        for (var b = a; b <= MAX_PIP; b++) stock.push({ a: a, b: b });
    }
    GU.shuffle(stock);
}

function newGame() {
    buildStock();
    hand = stock.splice(0, HAND_SIZE);
    aiHand = stock.splice(0, HAND_SIZE);
    chain = [];
    selected = -1;
    status = 'playing';
    msg = '';
    msgT = 0;
    fx.clear();
    sortHand();

    /* Sale quien tenga el doble más alto; si nadie tiene dobles, la ficha más
     * alta. Es la regla estándar y evita el sorteo. */
    turn = openingBelongsToPlayer() ? 'player' : 'ai';
    gameControls.running();
    over.hide();
    syncHud();
    GameAudio.start();
    if (turn === 'ai') setTimeout(aiTurn, 700);
    else say('Sales tú');
}

function tileRank(t) { return (t.a === t.b ? 100 : 0) + t.a + t.b; }
function openingBelongsToPlayer() {
    var mine = 0, theirs = 0, i;
    for (i = 0; i < hand.length; i++)   mine = Math.max(mine, tileRank(hand[i]));
    for (i = 0; i < aiHand.length; i++) theirs = Math.max(theirs, tileRank(aiHand[i]));
    return mine >= theirs;
}

function sortHand() {
    hand.sort(function (x, y) { return (x.a - y.a) || (x.b - y.b); });
}

/* ── Reglas ───────────────────────────────────────────────────────── */

function leftEnd()  { return chain.length ? chain[0].a : null; }
function rightEnd() { return chain.length ? chain[chain.length - 1].b : null; }

/* ¿Encaja la ficha por ese lado? Con la cadena vacía todo vale. */
function fits(t, side) {
    if (!chain.length) return true;
    var end = side === 'left' ? leftEnd() : rightEnd();
    return t.a === end || t.b === end;
}
function canPlay(t) { return fits(t, 'left') || fits(t, 'right'); }

function handCanPlay(h) {
    for (var i = 0; i < h.length; i++) if (canPlay(h[i])) return true;
    return false;
}

/* Coloca orientando: por la izquierda el número que casa tiene que quedar en
 * `b` (pegado a la cadena); por la derecha, en `a`. */
function placeTile(t, side) {
    if (!chain.length) { chain.push({ a: t.a, b: t.b }); return true; }
    if (side === 'left') {
        var l = leftEnd();
        if (t.b === l)      chain.unshift({ a: t.a, b: t.b });
        else if (t.a === l) chain.unshift({ a: t.b, b: t.a });
        else return false;
    } else {
        var r = rightEnd();
        if (t.a === r)      chain.push({ a: t.a, b: t.b });
        else if (t.b === r) chain.push({ a: t.b, b: t.a });
        else return false;
    }
    return true;
}

function drawFromStock(h) {
    if (!stock.length) return false;
    h.push(stock.pop());
    return true;
}

/* ── Turnos ───────────────────────────────────────────────────────── */

function playerPlay(idx, side) {
    if (status !== 'playing' || turn !== 'player') return;
    var t = hand[idx];
    if (!t || !fits(t, side)) { say('Por ahí no casa'); GameAudio.miss(); return; }
    placeTile(t, side);
    hand.splice(idx, 1);
    selected = -1;
    GameAudio.place();
    fx.burst(W / 2, H - 150, 8, { color: '#8fd3f4', speed: 70, life: 0.4, size: 2 });
    syncHud();
    if (checkEnd()) return;
    turn = 'ai';
    setTimeout(aiTurn, 650);
}

function playerDraw() {
    if (status !== 'playing' || turn !== 'player') return;
    if (handCanPlay(hand)) { say('Aún tienes jugada'); return; }
    if (drawFromStock(hand)) {
        sortHand();
        GameAudio.flip();
        say('Robas del pozo');
        syncHud();
        return;
    }
    /* Sin pozo y sin jugada: se pasa. */
    say('Pasas');
    turn = 'ai';
    if (checkEnd()) return;
    setTimeout(aiTurn, 600);
}

function aiTurn() {
    if (status !== 'playing') return;

    while (!handCanPlay(aiHand) && stock.length) drawFromStock(aiHand);

    if (!handCanPlay(aiHand)) {
        say('La máquina pasa');
        turn = 'player';
        checkEnd();
        return;
    }

    /* Estrategia simple pero no tonta: juega la ficha de más puntos que pueda
     * colocar. En dominó soltar carga pronto es lo que evita quedarte pillado
     * con el doble seis cuando se cierra la partida. */
    var bestIdx = -1, bestSide = 'right', bestVal = -1;
    for (var i = 0; i < aiHand.length; i++) {
        var t = aiHand[i];
        var sides = [];
        if (fits(t, 'left'))  sides.push('left');
        if (fits(t, 'right')) sides.push('right');
        if (!sides.length) continue;
        var val = t.a + t.b + (t.a === t.b ? 3 : 0);
        if (val > bestVal) { bestVal = val; bestIdx = i; bestSide = sides[0]; }
    }

    placeTile(aiHand[bestIdx], bestSide);
    aiHand.splice(bestIdx, 1);
    GameAudio.place();
    syncHud();
    if (checkEnd()) return;
    turn = 'player';
    say('Te toca');
}

/* Fin: alguien se queda sin fichas, o se cierra porque nadie puede jugar. */
function checkEnd() {
    if (!hand.length)   { finish('player'); return true; }
    if (!aiHand.length) { finish('ai'); return true; }
    if (!stock.length && !handCanPlay(hand) && !handCanPlay(aiHand)) {
        /* Partida cerrada: gana quien menos puntos tenga en la mano. */
        var mine = pips(hand), theirs = pips(aiHand);
        finish(mine < theirs ? 'player' : mine > theirs ? 'ai' : 'draw');
        return true;
    }
    return false;
}

function pips(h) {
    var s = 0;
    for (var i = 0; i < h.length; i++) s += h[i].a + h[i].b;
    return s;
}

function finish(who) {
    status = 'over';
    var title, line;
    if (who === 'player') {
        wins++;
        best.submit(wins);
        title = '¡Ganas!';
        line = 'A la máquina le quedaban ' + pips(aiHand) + ' puntos';
        GameAudio.win();
    } else if (who === 'ai') {
        losses++;
        title = 'Gana la máquina';
        line = 'Te quedaban ' + pips(hand) + ' puntos';
        GameAudio.gameOver();
    } else {
        title = 'Empate';
        line = 'Los dos con ' + pips(hand) + ' puntos';
        GameAudio.gameOver();
    }
    syncHud();
    gameControls.idle();
    over.show({ overTitle: title, overScore: line, overRecord: 'Partidas ganadas: ' + wins });
}

function say(text) { msg = text; msgT = 1.6; }

function syncHud() {
    hud.set({
        wins: wins, losses: losses,
        hand: hand.length, stock: stock.length,
        best: best.display(0)
    });
}

/* ── Dibujo ───────────────────────────────────────────────────────── */

rafLoop(function (dt) {
    if (msgT > 0) msgT -= dt;
    fx.update(dt);
    draw();
});

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#17402c');
        g.addColorStop(1, '#0c2418');
        return g;
    });
    ctx.fillRect(0, 0, W, H);

    drawAiHand();
    drawChain();
    drawEndButtons();
    fx.draw(ctx);
    drawHand();
    if (msgT > 0) drawMessage();
    if (status === 'idle') drawIdle();
}

function drawAiHand() {
    ctx.fillStyle = '#b7c6d6';
    ctx.font = '13px Arial';
    ctx.fillText('Máquina: ' + aiHand.length + ' fichas', 16, 24);
    /* Dorsos, sin revelar nada. */
    for (var i = 0; i < aiHand.length; i++) {
        var x = 16 + i * 22, y = 34;
        ctx.fillStyle = '#2b3a52';
        GU.roundRectPath(ctx, x, y, 18, 34, 4);
        ctx.fill();
        ctx.strokeStyle = '#4d6285';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

/* La cadena se pinta centrada y se ESCALA si no cabe, en vez de serpentear:
 * doblarla en L es bonito pero convierte el cálculo de los extremos jugables en
 * un problema de geometría, y aquí lo importante es ver los dos números. */
function chainLayout() {
    var total = chain.length * CH_W;
    var maxW = W - 40;
    var scale = total > maxW ? maxW / total : 1;
    var w = CH_W * scale;
    var startX = W / 2 - (chain.length * w) / 2;
    return { scale: scale, w: w, startX: startX, y: 150 };
}

function drawChain() {
    if (!chain.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Coloca la primera ficha', W / 2, 160);
        ctx.textAlign = 'left';
        return;
    }
    var L = chainLayout();
    var h = CH_H * L.scale;
    for (var i = 0; i < chain.length; i++) {
        var t = chain[i];
        var x = L.startX + i * L.w, y = L.y - h / 2;
        ctx.fillStyle = '#f4f1ea';
        GU.roundRectPath(ctx, x + 1, y, L.w - 2, h, 4 * L.scale);
        ctx.fill();
        ctx.strokeStyle = '#b9b3a6';
        ctx.lineWidth = 1;
        ctx.stroke();
        /* Línea central y las dos mitades. */
        ctx.beginPath();
        ctx.moveTo(x + L.w / 2, y + 3);
        ctx.lineTo(x + L.w / 2, y + h - 3);
        ctx.strokeStyle = '#8d8880';
        ctx.stroke();
        drawPips(x + 1, y, L.w / 2 - 2, h, t.a, L.scale);
        drawPips(x + L.w / 2, y, L.w / 2 - 2, h, t.b, L.scale);
    }
}

/* Botones de extremo: dónde encajar la ficha elegida. Sólo salen cuando hay
 * una ficha seleccionada que de verdad casa por ese lado. */
function endButtonRects() {
    if (!chain.length) return [];
    var L = chainLayout();
    return [
        { side: 'left',  x: L.startX - 40, y: L.y - 18, w: 34, h: 36 },
        { side: 'right', x: L.startX + chain.length * L.w + 6, y: L.y - 18, w: 34, h: 36 }
    ];
}

function drawEndButtons() {
    if (selected < 0 || !chain.length) return;
    var t = hand[selected];
    if (!t) return;
    var rects = endButtonRects();
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var ok = fits(t, r.side);
        ctx.fillStyle = ok ? 'rgba(143,255,106,0.85)' : 'rgba(120,120,120,0.35)';
        GU.roundRectPath(ctx, r.x, r.y, r.w, r.h, 6);
        ctx.fill();
        ctx.fillStyle = ok ? '#0c2418' : '#555';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(r.side === 'left' ? '<' : '>', r.x + r.w / 2, r.y + r.h / 2 + 7);
        ctx.textAlign = 'left';
    }
}

function handY() { return H - TILE_H - 26; }
function handX(i) {
    var total = hand.length * (TILE_W + 6);
    var start = Math.max(10, W / 2 - total / 2);
    return start + i * (TILE_W + 6);
}

function drawHand() {
    for (var i = 0; i < hand.length; i++) {
        var t = hand[i];
        var x = handX(i), y = handY();
        var lifted = i === selected;
        if (lifted) y -= 12;

        var playable = status === 'playing' && turn === 'player' && canPlay(t);
        ctx.fillStyle = playable ? '#f4f1ea' : '#c9c4bb';
        GU.roundRectPath(ctx, x, y, TILE_W, TILE_H, 5);
        ctx.fill();
        ctx.strokeStyle = lifted ? '#8fff6a' : '#b9b3a6';
        ctx.lineWidth = lifted ? 2.5 : 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 3, y + TILE_H / 2);
        ctx.lineTo(x + TILE_W - 3, y + TILE_H / 2);
        ctx.strokeStyle = '#8d8880';
        ctx.lineWidth = 1;
        ctx.stroke();

        drawPips(x, y, TILE_W, TILE_H / 2, t.a, 1);
        drawPips(x, y + TILE_H / 2, TILE_W, TILE_H / 2, t.b, 1);
    }

    var cur = cursor.target();
    if (cur) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        GU.roundRectPath(ctx, cur.x - 3, cur.y - 3, cur.w + 6, cur.h + 6, 7);
        ctx.stroke();
    }
}

/* Puntos de una mitad, con el patrón clásico. Formas, nunca texto. */
var PIP_POS = {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]]
};
function drawPips(x, y, w, h, n, scale) {
    var pts = PIP_POS[n] || [];
    var r = Math.max(1.2, Math.min(w, h) * 0.11);
    ctx.fillStyle = '#26221c';
    for (var i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(x + pts[i][0] * w, y + pts[i][1] * h, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMessage() {
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(msgT, 0, 1);
    ctx.fillText(msg, W / 2, 108);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

function drawIdle() {
    ctx.fillStyle = 'rgba(12,36,24,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DOMINÓ', W / 2, H / 2 - 14);
    ctx.fillStyle = '#8fd3f4';
    ctx.font = '15px Arial';
    ctx.fillText('Doble seis contra la máquina', W / 2, H / 2 + 16);
    ctx.textAlign = 'left';
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function handleAt(x, y) {
    if (status !== 'playing' || turn !== 'player') return;

    /* Primero los botones de extremo, que se dibujan encima. */
    if (selected >= 0) {
        var rects = endButtonRects();
        for (var r = 0; r < rects.length; r++) {
            var b = rects[r];
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                playerPlay(selected, b.side);
                return;
            }
        }
    }

    var hy = handY();
    if (y >= hy - 14 && y <= hy + TILE_H) {
        for (var i = 0; i < hand.length; i++) {
            var hx = handX(i);
            if (x >= hx && x <= hx + TILE_W) {
                if (!canPlay(hand[i])) { say('Esa ficha no casa'); GameAudio.miss(); return; }
                if (!chain.length) { playerPlay(i, 'right'); return; }
                selected = (selected === i) ? -1 : i;
                GameAudio.click();
                return;
            }
        }
    }
}

canvas.addEventListener('mousedown', function (e) {
    var p = pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { preventDefault: true, onTap: function (p) { handleAt(p.x, p.y); } });

/* Sin esto el juego sería sólo de ratón. Los objetivos son las fichas de la
 * mano más los dos extremos cuando hay una elegida. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tus fichas. Flechas para moverte, Enter para elegir y para colocar.',
    targets: function () {
        var out = [], i;
        for (i = 0; i < hand.length; i++) {
            out.push({ x: handX(i), y: handY(), w: TILE_W, h: TILE_H, id: 'h' + i, kind: 'tile', i: i });
        }
        if (selected >= 0 && chain.length) {
            var rects = endButtonRects();
            for (i = 0; i < rects.length; i++) {
                out.push({ x: rects[i].x, y: rects[i].y, w: rects[i].w, h: rects[i].h,
                           id: 'end-' + rects[i].side, kind: 'end', side: rects[i].side });
            }
        }
        return out;
    },
    activate: function (t) {
        if (t.kind === 'end') playerPlay(selected, t.side);
        else handleAt(t.x + 2, t.y + 2);
    }
});

/* ── Botones ──────────────────────────────────────────────────────── */

var over = GU.popup('overPopup');
var gameControls = GU.controls({ start: newGame, popup: 'overPopup' });
document.getElementById('passBtn').addEventListener('click', function () { GameAudio.click(); playerDraw(); });

syncHud();
draw();

}());

/* Puentes (Hashi) — une las islas hasta cumplir sus números y dejarlo todo
 * conectado.
 *
 * Lo que no se ve leyendo el código:
 *
 * - **El tablero se genera desde una solución, nunca al azar.** Se planta una
 *   isla y se van añadiendo vecinas tendiendo puentes hacia ellas; el número de
 *   cada isla es, al final, el de puentes que le han tocado. Así el puzzle es
 *   resoluble por construcción y además nace conectado, que es la condición que
 *   más cuesta garantizar si se siembran islas sueltas.
 * - **Dos puentes no se cruzan jamás**, y esa comprobación es la que se hace
 *   mal: no basta con mirar las islas de los extremos, hay que mirar si el
 *   segmento pasa por encima de OTRO puente perpendicular. Aquí se marcan las
 *   celdas ocupadas por cada puente y el cruce es una consulta directa.
 * - **Cumplir los números no es ganar.** Hay que estar además todo conectado en
 *   una sola red: se puede cerrar cada isla con sus puentes y dejar dos grupos
 *   independientes, y eso no es una solución. La comprobación de conexión es una
 *   inundación desde la primera isla.
 * - El ciclo de un par de islas es **0 → 1 → 2 → 0**, con un solo gesto: es lo
 *   que evita tener que distinguir "poner" de "quitar" en la interfaz.
 */

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width, H = canvas.height;

var SIZES = {
    facil:   { n: 7,  islands: 12, label: 'Fácil (7×7)' },
    medio:   { n: 9,  islands: 20, label: 'Medio (9×9)' },
    dificil: { n: 11, islands: 30, label: 'Difícil (11×11)' }
};

var N = 9;
var diff = 'medio';
var TOP = 40, BOTTOM = 24;

var islands = [];        // {r, c, need, id}
var gridId = [];         // celda -> id de isla, o -1
var bridges = [];        // {a, b, count, horiz}
var sel = -1;
var elapsed = 0, startMs = 0;
var status = 'idle';

var fx = new Particles(120);
var gMemo = GU.gradientMemo();
var msg = GU.toast();

var hud = GU.hud({
    islands: 'islandsLabel',
    done:    'doneLabel',
    time:    { el: 'timeLabel', format: function (v) { return GU.formatTime(v); } },
    best:    { el: 'highScore', format: function (v) { return v == null ? '—' : GU.formatTime(v); } },
    mobile:  { el: 'mobileScore', format: function () {
        return doneCount() + '/' + islands.length + ' islas  ·  ' + GU.formatTime(elapsed);
    } }
});

var bests = {
    facil:   GU.highScore('puentesBestFacil',   { lower: true }),
    medio:   GU.highScore('puentesBestMedio',   { lower: true }),
    dificil: GU.highScore('puentesBestDificil', { lower: true })
};
var over = GU.popup('overPopup');

function idx(r, c) { return r * N + c; }

/* ── Generación ───────────────────────────────────────────────────── */

function newGame(level) {
    diff = level || diff;
    N = SIZES[diff].n;
    var target = SIZES[diff].islands;

    var attempt = 0;
    do {
        buildPuzzle(target);
        attempt++;
    } while (islands.length < Math.min(6, target / 2) && attempt < 30);

    /* El tablero se entrega SIN puentes: los números ya están puestos. */
    bridges = [];
    sel = -1;
    elapsed = 0;
    startMs = performance.now();
    status = 'playing';
    fx.clear();
    msg.clear();
    over.hide();
    gameControls.running();
    syncHud();
    GameAudio.start();
    view.invalidate();
}

function buildPuzzle(target) {
    islands = [];
    gridId = new Array(N * N).fill(-1);
    var plan = [];                 // puentes de la solución

    function addIsland(r, c) {
        var id = islands.length;
        islands.push({ r: r, c: c, need: 0, id: id });
        gridId[idx(r, c)] = id;
        return id;
    }

    addIsland(GU.randInt(0, N - 1), GU.randInt(0, N - 1));

    var guard = 0;
    while (islands.length < target && guard++ < target * 40) {
        var from = GU.pick(islands);
        var dir = GU.pick([[0, 1], [0, -1], [1, 0], [-1, 0]]);
        var dist = GU.randInt(2, 4);   // >= 2: siempre queda hueco para el puente
        var nr = from.r + dir[0] * dist, nc = from.c + dir[1] * dist;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        if (gridId[idx(nr, nc)] >= 0) continue;
        /* Dos islas pegadas no valen: el puente entre ellas no tendría ni una
         * celda de largo, así que no se vería, y el tablero pasa a tener
         * conexiones que el jugador no puede distinguir de "islas juntas". Los
         * hashi publicados tampoco las ponen. */
        if (hasNeighbourIsland(nr, nc)) continue;

        /* El camino tiene que estar limpio: ni islas ni puentes cruzados. */
        var blocked = false;
        for (var k = 1; k < dist; k++) {
            var rr = from.r + dir[0] * k, cc = from.c + dir[1] * k;
            if (gridId[idx(rr, cc)] >= 0) { blocked = true; break; }
            if (crossesPlan(plan, rr, cc)) { blocked = true; break; }
        }
        if (blocked) continue;

        var count = Math.random() < 0.42 ? 2 : 1;
        var id = addIsland(nr, nc);
        plan.push({ a: from.id, b: id, count: count, horiz: dir[0] === 0 });
        islands[from.id].need += count;
        islands[id].need += count;
    }

    /* Una isla sin puentes en el plan no puede existir: su número sería 0. */
    islands = islands.filter(function (isl) { return isl.need > 0; });
    gridId = new Array(N * N).fill(-1);
    for (var i = 0; i < islands.length; i++) {
        islands[i].id = i;
        gridId[idx(islands[i].r, islands[i].c)] = i;
    }
}

function hasNeighbourIsland(r, c) {
    var d = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (var k = 0; k < 4; k++) {
        var rr = r + d[k][0], cc = c + d[k][1];
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        if (gridId[idx(rr, cc)] >= 0) return true;
    }
    return false;
}

/* ¿Pasa algún puente del plan por esta celda? Los puentes del plan se guardan
 * por extremos, así que se recorre el segmento. */
function crossesPlan(plan, r, c) {
    for (var i = 0; i < plan.length; i++) {
        var p = plan[i];
        var A = islands[p.a], B = islands[p.b];
        if (p.horiz) {
            if (A.r !== r) continue;
            if (c > Math.min(A.c, B.c) && c < Math.max(A.c, B.c)) return true;
        } else {
            if (A.c !== c) continue;
            if (r > Math.min(A.r, B.r) && r < Math.max(A.r, B.r)) return true;
        }
    }
    return false;
}

/* ── Reglas ───────────────────────────────────────────────────────── */

function bridgeBetween(a, b) {
    for (var i = 0; i < bridges.length; i++) {
        var br = bridges[i];
        if ((br.a === a && br.b === b) || (br.a === b && br.b === a)) return br;
    }
    return null;
}

function degree(id) {
    var n = 0;
    for (var i = 0; i < bridges.length; i++) {
        if (bridges[i].a === id || bridges[i].b === id) n += bridges[i].count;
    }
    return n;
}

/* Celdas por las que pasa un puente ya colocado. */
function occupied() {
    var occ = {};
    for (var i = 0; i < bridges.length; i++) {
        var A = islands[bridges[i].a], B = islands[bridges[i].b];
        if (A.r === B.r) {
            for (var c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) occ[idx(A.r, c)] = true;
        } else {
            for (var r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) occ[idx(r, A.c)] = true;
        }
    }
    return occ;
}

/* Se pueden unir si están alineadas, sin islas por medio y sin cruzar otro
 * puente. Devuelve null o el motivo, para poder decírselo al jugador. */
function canLink(a, b) {
    if (a === b) return 'misma';
    var A = islands[a], B = islands[b];
    if (A.r !== B.r && A.c !== B.c) return 'no alineadas';
    var occ = occupied();
    var existing = bridgeBetween(a, b);
    if (A.r === B.r) {
        for (var c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) {
            if (gridId[idx(A.r, c)] >= 0) return 'hay una isla en medio';
            if (occ[idx(A.r, c)] && !existing) return 'se cruzaría con otro puente';
        }
    } else {
        for (var r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) {
            if (gridId[idx(r, A.c)] >= 0) return 'hay una isla en medio';
            if (occ[idx(r, A.c)] && !existing) return 'se cruzaría con otro puente';
        }
    }
    return null;
}

/* 0 → 1 → 2 → 0 con un solo gesto. */
function toggleLink(a, b) {
    var why = canLink(a, b);
    if (why) {
        if (why !== 'misma') { msg.show(why, 1.4); GameAudio.hit(); }
        return;
    }
    var br = bridgeBetween(a, b);
    if (!br) {
        bridges.push({ a: a, b: b, count: 1 });
        GameAudio.place();
    } else if (br.count === 1) {
        br.count = 2;
        GameAudio.place();
    } else {
        bridges.splice(bridges.indexOf(br), 1);
        GameAudio.click();
    }
    checkWin();
}

function doneCount() {
    var n = 0;
    for (var i = 0; i < islands.length; i++) if (degree(i) === islands[i].need) n++;
    return n;
}

/* Conexión: inundación por los puentes desde la primera isla. Cumplir todos los
 * números y quedar en dos grupos sueltos NO es una solución. */
function allConnected() {
    if (!islands.length) return false;
    var seen = {}, stack = [0];
    seen[0] = true;
    var n = 1;
    while (stack.length) {
        var cur = stack.pop();
        for (var i = 0; i < bridges.length; i++) {
            var br = bridges[i];
            var other = br.a === cur ? br.b : (br.b === cur ? br.a : -1);
            if (other < 0 || seen[other]) continue;
            seen[other] = true;
            n++;
            stack.push(other);
        }
    }
    return n === islands.length;
}

function checkWin() {
    if (doneCount() !== islands.length) { syncHud(); return; }
    if (!allConnected()) {
        msg.show('Los números cuadran, pero hay islas sueltas', 2);
        syncHud();
        return;
    }
    status = 'won';
    var record = bests[diff].submit(elapsed);
    for (var i = 0; i < islands.length; i++) {
        var p = pos(islands[i]);
        fx.burst(p.x, p.y, 6, { color: '#8fd3f4', speed: 80, life: 0.8, size: 3 });
    }
    gameControls.idle();
    GameAudio.win();
    syncHud();
    setTimeout(function () {
        over.show({
            overTitle: record ? '¡Nuevo récord!' : '¡Todo conectado!',
            overScore: islands.length + ' islas en ' + GU.formatTime(elapsed),
            overRecord: bests[diff].has() ? 'Tu mejor tiempo aquí: ' + GU.formatTime(bests[diff].value) : ''
        });
    }, 650);
}

function syncHud() {
    hud.set({
        islands: islands.length,
        done: doneCount(),
        time: elapsed,
        best: bests[diff].has() ? bests[diff].value : null
    });
}

/* ── Geometría y dibujo ───────────────────────────────────────────── */

function cs() { return Math.min((W - 30) / N, (H - TOP - BOTTOM) / N); }
function bx() { return (W - cs() * N) / 2; }
function pos(isl) {
    return { x: bx() + isl.c * cs() + cs() / 2, y: TOP + isl.r * cs() + cs() / 2 };
}
function radius() { return cs() * 0.36; }

function draw() {
    ctx.fillStyle = gMemo('bg', function () {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#12283f');
        g.addColorStop(1, '#060d16');
        return g;
    }, [W, H]);
    ctx.fillRect(0, 0, W, H);

    var s = cs();

    // rejilla tenue: sin ella no se ve qué islas están alineadas
    ctx.strokeStyle = 'rgba(143,211,244,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var g = 0; g <= N; g++) {
        ctx.moveTo(bx() + g * s, TOP); ctx.lineTo(bx() + g * s, TOP + N * s);
        ctx.moveTo(bx(), TOP + g * s); ctx.lineTo(bx() + N * s, TOP + g * s);
    }
    ctx.stroke();

    // puentes
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 3;
    for (var i = 0; i < bridges.length; i++) {
        var br = bridges[i];
        var A = pos(islands[br.a]), B = pos(islands[br.b]);
        var horiz = islands[br.a].r === islands[br.b].r;
        var off = br.count === 2 ? 4 : 0;
        ctx.beginPath();
        if (horiz) {
            ctx.moveTo(A.x, A.y - off); ctx.lineTo(B.x, B.y - off);
            if (off) { ctx.moveTo(A.x, A.y + off); ctx.lineTo(B.x, B.y + off); }
        } else {
            ctx.moveTo(A.x - off, A.y); ctx.lineTo(B.x - off, B.y);
            if (off) { ctx.moveTo(A.x + off, A.y); ctx.lineTo(B.x + off, B.y); }
        }
        ctx.stroke();
    }

    // islas
    for (var k = 0; k < islands.length; k++) {
        var isl = islands[k];
        var p = pos(isl);
        var deg = degree(k);
        var full = deg === isl.need;
        var over_ = deg > isl.need;

        ctx.fillStyle = over_ ? '#7a2f2f' : (full ? '#1f6b46' : '#1b3350');
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius(), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = k === sel ? '#ffd54a' : (full ? '#48d18a' : '#8fd3f4');
        ctx.lineWidth = k === sel ? 4 : 2;
        ctx.stroke();

        ctx.fillStyle = '#f2f7ff';
        ctx.font = 'bold ' + Math.round(s * 0.36) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isl.need, p.x, p.y + 1);
    }

    fx.draw(ctx);

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText(SIZES[diff].label + '   ·   ' + doneCount() + '/' + islands.length +
                 '   ·   ' + GU.formatTime(elapsed), W / 2, TOP / 2);

    var t = cursor.target();
    if (t) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2, t.y + t.h / 2, radius() + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    msg.draw(ctx, W / 2, H - 14);

    if (status === 'idle') {
        GU.idleScreen(ctx, {
            title: 'PUENTES',
            lines: ['Une las islas hasta cumplir sus números',
                    'Pulsa Iniciar'],
            bg: 'rgba(6,13,22,0.86)'
        });
    }
}

/* ── Entrada ──────────────────────────────────────────────────────── */

function islandAt(x, y) {
    for (var i = 0; i < islands.length; i++) {
        var p = pos(islands[i]);
        if (GU.dist2(x, y, p.x, p.y) <= radius() * radius() * 1.6) return i;
    }
    return -1;
}

function handleAt(x, y) {
    if (status !== 'playing') return;
    var i = islandAt(x, y);
    if (i < 0) { sel = -1; view.invalidate(); return; }
    if (sel < 0) { sel = i; GameAudio.click(); view.invalidate(); return; }
    if (sel === i) { sel = -1; view.invalidate(); return; }
    toggleLink(sel, i);
    sel = -1;
    view.invalidate();
}

canvas.addEventListener('click', function (e) {
    var p = GU.pointerPos(canvas, e);
    handleAt(p.x, p.y);
});
GU.swipe(canvas, { onTap: function (p) { handleAt(p.x, p.y); } });

/* Con una isla elegida sólo se ofrecen las que se pueden unir a ella: navegar
 * por las 30 islas para encontrar las 2 o 3 válidas no lleva a ninguna parte. */
var cursor = GU.canvasCursor(canvas, {
    label: 'Tablero de puentes. Flechas para moverte, Enter para elegir isla.',
    targets: function () {
        if (status !== 'playing') return [];
        var r = radius(), out = [];
        for (var i = 0; i < islands.length; i++) {
            if (sel >= 0 && i !== sel && canLink(sel, i)) continue;
            var p = pos(islands[i]);
            out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, id: 'i' + i });
        }
        return out;
    },
    activate: function (t) {
        var i = parseInt(t.id.slice(1), 10);
        var p = pos(islands[i]);
        handleAt(p.x, p.y);
    },
    onChange: function () { view.invalidate(); }
});

/* ── Bucle y botones ──────────────────────────────────────────────── */

/* Dibujo bajo demanda — ver GU.rafDraw. */
var view = rafDraw(function (dt) {
    fx.update(dt);
    msg.update(dt);
    draw();
    return fx.count > 0 || msg.active();
});

/* El reloj se pinta dentro del canvas, así que hay que repintar — cuatro veces
 * por segundo, no sesenta. */
setInterval(function () {
    if (status !== 'playing') return;
    elapsed = performance.now() - startMs;
    syncHud();
    view.invalidate();
}, 250);

var diffSel = document.createElement('select');
diffSel.id = 'diffSel';
Object.keys(SIZES).forEach(function (d) {
    var o = document.createElement('option');
    o.value = d;
    o.textContent = SIZES[d].label;
    if (d === 'medio') o.selected = true;
    diffSel.appendChild(o);
});
diffSel.setAttribute('aria-label', 'Dificultad');
document.querySelector('.buttons-panel').appendChild(diffSel);

var gameControls = GU.controls({
    start:     function () { newGame(diffSel.value); },
    restart:   function () { newGame(diffSel.value); },
    playAgain: function () { newGame(diffSel.value); },
    popup:     'overPopup'
});

syncHud();

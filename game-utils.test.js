/* Pruebas de las piezas de game-utils.js que tocan el DOM.
 *
 *   node game-utils.test.js
 *
 * Sin dependencias ni runner: el repo no tiene build y no va a tenerlo, así que
 * las pruebas cargan game-utils.js en un `vm` con un doble de DOM escrito a mano
 * — sólo lo que estas funciones usan: getElementById, addEventListener('click'),
 * .disabled, .style.display, .textContent y .innerHTML.
 *
 * Cubre GU.controls (el cableado de los tres botones) y GU.hud (el filtrado de
 * escrituras). Lo que fijan estas pruebas y conviene no romper: el sonido de
 * clic sale ANTES del handler, el popup se esconde ANTES de llamarlo, y un campo
 * declarado `null` es lo único que hace que la línea de móvil se entere de un
 * cambio en una variable que el panel de escritorio no muestra. */
const fs = require('fs');
const vm = require('vm');

function makeEl(id, tag) {
    return {
        id, tagName: (tag || 'button').toUpperCase(), disabled: false,
        style: { display: '' }, textContent: '',
        _listeners: {},
        addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
        click() { (this._listeners.click || []).forEach(fn => fn()); },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        querySelectorAll() { return []; }, focus() {},
        parent: null,
        /* closest/contains de verdad: la delegación del popup depende de ellos. */
        closest(sel) {
            let n = this;
            while (n) { if (sel === '#' + n.id) return n; n = n.parent; }
            return null;
        },
        contains(other) {
            let n = other;
            while (n) { if (n === this) return true; n = n.parent; }
            return false;
        }
    };
}

function makeDom(ids) {
    const els = {};
    for (const id of ids) els[id] = makeEl(id, id.includes('opup') ? 'div' : 'button');
    return {
        els,
        document: {
            readyState: 'complete',
            getElementById: id => els[id] || null,
            querySelectorAll: () => [],
            getElementsByTagName: () => [],
            addEventListener() {},
            createElement: t => makeEl('', t),
            body: makeEl('body', 'body'),
            activeElement: null
        }
    };
}

function loadToolkit(dom) {
    const sandbox = {
        window: null, document: dom.document, console,
        requestAnimationFrame: fn => 0, cancelAnimationFrame() {},
        getComputedStyle: el => ({ display: el.style.display || 'none' }),
        localStorage: undefined, navigator: { userAgent: 'node' },
        devicePixelRatio: 1, setTimeout, clearTimeout, performance: { now: () => 0 }
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(require('path').join(__dirname, 'game-utils.js'), 'utf8'), sandbox);
    return sandbox;
}

let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FALLO ' + name); }
}

/* ── 1. Cableado básico + orden popup/handler ─────────────────────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn', 'gameOverPopup']);
    const sb = loadToolkit(dom);
    const log = [];
    let popupAtCall = null;
    sb.GameAudio = { click: () => log.push('click-sound') };
    dom.els.gameOverPopup.style.display = 'flex';
    dom.els.playAgainBtn.parent = dom.els.gameOverPopup;   // como en el markup real

    const ctl = sb.GU.controls({
        start: () => log.push('start'),
        restart: () => log.push('restart'),
        playAgain: () => { popupAtCall = dom.els.gameOverPopup.style.display; log.push('again'); },
        popup: 'gameOverPopup'
    });

    console.log('\n1. cableado');
    dom.els.startBtn.click();
    check('startBtn suena y llama a start', log.join(',') === 'click-sound,start');
    log.length = 0;
    dom.els.restartBtn.click();
    check('restartBtn llama a restart', log.join(',') === 'click-sound,restart');
    log.length = 0;
    dom.els.gameOverPopup._listeners.click.forEach(fn => fn({ target: dom.els.playAgainBtn }));
    check('playAgain llama a su handler', log.join(',') === 'click-sound,again');
    check('el popup ya estaba oculto CUANDO corre el handler', popupAtCall === 'none');

    console.log('\n2. estados disabled');
    ctl.running();
    check('running(): start apagado, restart encendido',
        dom.els.startBtn.disabled === true && dom.els.restartBtn.disabled === false);
    ctl.idle();
    check('idle(): start encendido, restart apagado',
        dom.els.startBtn.disabled === false && dom.els.restartBtn.disabled === true);
}

/* ── 3. Valores por defecto en cascada ────────────────────────────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn']);
    const sb = loadToolkit(dom);
    const log = [];
    sb.GameAudio = { click: () => {} };
    sb.GU.controls({ start: () => log.push('start') });
    console.log('\n3. valores por defecto');
    dom.els.restartBtn.click();
    check('restart cae en start cuando no se declara', log.join(',') === 'start');
    log.length = 0;
    dom.els.playAgainBtn.click();
    check('playAgain cae en restart -> start', log.join(',') === 'start');

    log.length = 0;
    const dom2 = makeDom(['startBtn', 'restartBtn', 'playAgainBtn']);
    const sb2 = loadToolkit(dom2);
    sb2.GameAudio = { click: () => {} };
    const l2 = [];
    sb2.GU.controls({ start: () => l2.push('start'), restart: () => l2.push('restart') });
    dom2.els.playAgainBtn.click();
    check('playAgain cae en restart cuando restart SÍ se declara', l2.join(',') === 'restart');
}

/* ── 4. Botones que no existen ────────────────────────────────────────── */
{
    const dom = makeDom(['startBtn']);          // ni restart, ni playAgain, ni popup
    const sb = loadToolkit(dom);
    sb.GameAudio = { click: () => {} };
    console.log('\n4. markup incompleto');
    let threw = false, ctl = null;
    try { ctl = sb.GU.controls({ start: () => {}, popup: 'noExiste' }); } catch (e) { threw = true; }
    check('no revienta si faltan botones o popup', !threw);
    let threw2 = false;
    try { ctl.running(); ctl.idle(); } catch (e) { threw2 = true; }
    check('running()/idle() tampoco revientan', !threw2);
}

/* ── 5. Sin GameAudio cargado ─────────────────────────────────────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn']);
    const sb = loadToolkit(dom);
    /* GameAudio deliberadamente ausente */
    const log = [];
    sb.GU.controls({ start: () => log.push('start') });
    console.log('\n5. sin GameAudio');
    let threw = false;
    try { dom.els.startBtn.click(); } catch (e) { threw = true; }
    check('el clic funciona igual sin audio.js', !threw && log.join(',') === 'start');
}

/* ── 6. sound: false ──────────────────────────────────────────────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn']);
    const sb = loadToolkit(dom);
    const log = [];
    sb.GameAudio = { click: () => log.push('sonido') };
    sb.GU.controls({ start: () => log.push('start'), sound: false });
    console.log('\n6. sound: false');
    dom.els.startBtn.click();
    check('no emite el clic cuando se apaga', log.join(',') === 'start');
}


/* ── 7. GU.hud: campos sin elemento y filtrado de escrituras ──────────── */
{
    const dom = makeDom(['score', 'highScore', 'mobileScore']);
    const sb = loadToolkit(dom);
    console.log('\n7. GU.hud');

    // Contar escrituras reales al DOM.
    let writes = 0;
    /* GU.hud escribe innerHTML en la línea de móvil cuando lleva `html`, y
     * textContent en el resto: hay que contar las dos. */
    function spy(el) {
        for (const prop of ['textContent', 'innerHTML']) {
            let v = '';
            Object.defineProperty(el, prop, {
                get: () => v, set(nv) { if (nv !== v) writes++; v = nv; }
            });
        }
    }
    for (const id of ['score', 'highScore', 'mobileScore']) spy(dom.els[id]);

    let lives = 3, level = 1, score = 0;
    const hud = sb.GU.hud({
        score: 'score',
        best: 'highScore',
        level: null,
        lives: null,
        mobile: { el: 'mobileScore', html: () => 'P:' + score + ' N:' + level + ' V:' + lives }
    });

    const set = () => hud.set({ score, best: 10, level, lives });
    set();
    const afterFirst = writes;
    check('la primera pasada escribe los tres nodos', afterFirst === 3);

    writes = 0;
    for (let i = 0; i < 60; i++) set();
    check('60 pasadas sin cambios no tocan el DOM', writes === 0);

    writes = 0; score = 5; set();
    check('cambiar la puntuación escribe panel + móvil', writes === 2);

    // Una variable que SOLO sale en la linea de movil.
    writes = 0; lives = 2; set();
    check('cambiar sólo las vidas repinta la línea de móvil', writes === 1);
    check('la línea de móvil trae el valor nuevo',
        dom.els.mobileScore.innerHTML === 'P:5 N:1 V:2');

    /* Y lo mismo SIN declararla como campo: la linea se recalcula en cada set()
     * y se filtra por el texto que produce, asi que no depende de que el juego
     * se acuerde de enumerar cada variable que use. Olvidarse de una es el error
     * facil, y antes dejaba la linea congelada sin sintoma en consola. */
    const dom2 = makeDom(['score', 'mobileScore']);
    const sb2 = loadToolkit(dom2);
    let lives2 = 3;
    const hud2 = sb2.GU.hud({
        score: 'score',
        mobile: { el: 'mobileScore', html: () => 'V:' + lives2 }
    });
    hud2.set({ score: 1 });
    lives2 = 1;
    hud2.set({ score: 1 });          // ni un solo campo cambia
    check('la línea de móvil sigue una variable no declarada',
        dom2.els.mobileScore.innerHTML === 'V:1');

    // Pero sigue sin tocar el DOM cuando el texto no cambia.
    let domWrites = 0, val = '';
    Object.defineProperty(dom2.els.mobileScore, 'innerHTML', {
        get: () => val, set(nv) { if (nv !== val) domWrites++; val = nv; }
    });
    for (let i = 0; i < 60; i++) hud2.set({ score: 1 });
    check('60 set() sin cambios reales no escriben en el DOM', domWrites === 0);
}


/* ── 8. El boton del popup sobrevive a que reescriban el popup ────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn', 'gameOverPopup']);
    const sb = loadToolkit(dom);
    sb.GameAudio = { click: () => {} };
    const log = [];

    // El boton vive DENTRO del popup, como en el markup real.
    const popupEl = dom.els.gameOverPopup;
    dom.els.playAgainBtn.parent = popupEl;
    popupEl._listeners = {};

    sb.GU.controls({ start: () => log.push('start'), popup: 'gameOverPopup' });

    console.log('\n8. el popup se reescribe entre partidas');

    // Un clic normal: el evento nace en el boton y sube al popup.
    popupEl._listeners.click.forEach(fn => fn({ target: dom.els.playAgainBtn }));
    check('el boton original funciona', log.join(',') === 'start');

    /* Ahora el juego rehace el contenido del popup, como hace typingspeed en
     * endGame(): el boton de antes deja de estar en el documento y hay uno
     * nuevo con el mismo id. Un listener atado al nodo viejo estaria muerto. */
    log.length = 0;
    const nuevoBoton = makeEl('playAgainBtn');
    nuevoBoton.parent = popupEl;
    dom.els.playAgainBtn = nuevoBoton;

    popupEl._listeners.click.forEach(fn => fn({ target: nuevoBoton }));
    check('y el boton NUEVO tambien, que es lo que rompia antes',
        log.join(',') === 'start');

    // Y no reacciona a cualquier clic dentro del popup.
    log.length = 0;
    const otro = makeEl('otroBoton');
    otro.parent = popupEl;
    popupEl._listeners.click.forEach(fn => fn({ target: otro }));
    check('otro boton del popup no lo dispara', log.length === 0);
}


/* ── 9. Boton de reinicio fuera del popup (caso hangman) ──────────────── */
{
    const dom = makeDom(['startBtn', 'restartBtn', 'playAgainBtn', 'gameOverPopup']);
    const sb = loadToolkit(dom);
    sb.GameAudio = { click: () => {} };
    const log = [];
    /* No se le pone parent: el boton NO cuelga del popup, como en hangman,
     * donde vive en un panel de resultado de la propia pagina. */
    sb.GU.controls({ start: () => log.push('start'), popup: 'gameOverPopup' });
    console.log('\n9. boton fuera del popup');
    dom.els.playAgainBtn.click();
    check('se cablea directo en vez de quedarse mudo', log.join(',') === 'start');
}


/* ── 10. GU.rafDraw: pintar sólo cuando hace falta ────────────────────── */
{
    /* Este necesita un rAF y un reloj que se puedan pisar a mano, así que monta
     * su propio sandbox en vez de usar loadToolkit(). */
    function makeClockDom() {
        const listeners = {};
        const target = {
            addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
            removeEventListener(type, fn) {
                const l = listeners[type] || [];
                const i = l.indexOf(fn);
                if (i >= 0) l.splice(i, 1);
            },
            fire(type) { (listeners[type] || []).slice().forEach(fn => fn({})); },
            count(type) { return (listeners[type] || []).length; }
        };
        const doc = {
            readyState: 'complete', documentElement: target,
            getElementById: () => null, querySelectorAll: () => [],
            getElementsByTagName: () => [], createElement: () => ({ style: {} }),
            addEventListener() {}, removeEventListener() {},
            body: { appendChild() {} }, activeElement: null
        };
        let now = 0;
        const queue = [];
        const sandbox = {
            window: null, document: doc, console,
            requestAnimationFrame(fn) { queue.push(fn); return queue.length; },
            cancelAnimationFrame() {},
            getComputedStyle: () => ({ display: 'none' }),
            localStorage: undefined, navigator: { userAgent: 'node' },
            devicePixelRatio: 1, setTimeout, clearTimeout,
            performance: { now: () => now }
        };
        sandbox.window = sandbox; sandbox.self = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(fs.readFileSync(require('path').join(__dirname, 'game-utils.js'), 'utf8'), sandbox);
        /* Corre los frames pendientes avanzando el reloj `ms` en cada uno. */
        sandbox.tick = function (frames, ms) {
            for (let i = 0; i < frames; i++) {
                const pending = queue.splice(0, queue.length);
                if (!pending.length) return;
                now += (ms == null ? 16 : ms);
                pending.forEach(fn => fn(now));
            }
        };
        sandbox.pending = () => queue.length;
        sandbox.target = target;
        return sandbox;
    }

    console.log('\n10. GU.rafDraw');

    /* Pinta una vez al arrancar y luego se calla. */
    {
        const sb = makeClockDom();
        let draws = 0;
        sb.GU.rafDraw(function () { draws++; });
        sb.tick(1);
        check('pinta el primer frame sin que nadie lo pida', draws === 1);
        sb.tick(20);
        check('y no vuelve a pintar mientras nada cambie', draws === 1);
        check('deja de pedir frames del todo', sb.pending() === 0);
    }

    /* Devolver algo veraz mantiene el bucle vivo: la animación en curso. */
    {
        const sb = makeClockDom();
        let draws = 0, animando = true;
        sb.GU.rafDraw(function () { draws++; return animando; });
        sb.tick(5);
        check('sigue pintando mientras fn devuelve true', draws === 5);
        animando = false;
        sb.tick(5);
        check('y se para en cuanto devuelve false', draws === 6);
    }

    /* invalidate() despierta el bucle dormido. */
    {
        const sb = makeClockDom();
        let draws = 0;
        const h = sb.GU.rafDraw(function () { draws++; });
        sb.tick(3);
        check('dormido tras el primer frame', draws === 1 && sb.pending() === 0);
        h.invalidate();
        sb.tick(3);
        check('invalidate() pinta exactamente un frame mas', draws === 2);
    }

    /* La entrada del usuario invalida sola: es lo que evita la pantalla
     * congelada cuando un juego olvida pedir el repintado. */
    {
        const sb = makeClockDom();
        let draws = 0;
        sb.GU.rafDraw(function () { draws++; });
        sb.tick(2);
        check('parado antes del clic', draws === 1);
        sb.target.fire('pointerdown');
        sb.tick(2);
        check('un pointerdown repinta sin que el juego haga nada', draws === 2);
        sb.target.fire('keydown');
        sb.tick(2);
        check('y un keydown tambien', draws === 3);
    }

    /* Dormir mucho no puede producir un dt gigante. */
    {
        const sb = makeClockDom();
        let dts = [];
        const h = sb.GU.rafDraw(function (dt) { dts.push(dt); });
        sb.tick(1);
        sb.tick(1, 60000);          /* un minuto quieto (no pinta, esta dormido) */
        h.invalidate();
        sb.tick(1, 16);
        check('el dt al despertar es un paso normal, no el hueco entero',
            dts.length === 2 && dts[1] <= 0.1);
    }

    /* rafClear desata los listeners: un juego que reinicia su bucle no puede ir
     * acumulando invalidaciones de bucles muertos. */
    {
        const sb = makeClockDom();
        const h = sb.GU.rafDraw(function () {});
        const antes = sb.target.count('pointerdown');
        sb.rafClear(h);
        check('rafClear desata los eventos que habia atado',
            antes === 1 && sb.target.count('pointerdown') === 0);
        let draws = 0;
        const h2 = sb.GU.rafDraw(function () { draws++; });
        sb.rafClear(h2);
        sb.tick(3);
        check('y un bucle parado no vuelve a pintar', draws === 0);
    }

    /* El ahorro real, que es de lo que va la pieza. */
    {
        const sb = makeClockDom();
        let conBucle = 0, conDemanda = 0;
        sb.GU.rafLoop(function () { conBucle++; });
        sb.GU.rafDraw(function () { conDemanda++; });
        sb.tick(60);
        check('60 frames de tablero quieto: rafLoop pinta 60, rafDraw pinta 1',
            conBucle === 60 && conDemanda === 1);
    }
}


/* ── 11. Piezas de mesa: minimax, toast, cards, canvasButtons, idleScreen ─ */
{
    const dom = makeDom([]);
    const sb = loadToolkit(dom);
    const GU = sb.GU;

    console.log('\n11. GU.minimax');

    /* Tres en raya completo como banco de pruebas: es pequeño, tiene resultado
     * conocido (el juego perfecto es tablas) y ejercita las tres cosas que una
     * IA de tablero tiene que acertar. */
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function winnerOf(b) {
        for (const [a,c,d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
        return null;
    }
    const ttt = GU.minimax({
        moves: (b) => b.map((v, i) => v ? -1 : i).filter(i => i >= 0),
        apply: (b, m, side) => {
            const nb = b.slice(); nb[m] = side;
            return { state: nb, side: side === 'X' ? 'O' : 'X' };
        },
        isOver: (b) => !!winnerOf(b) || b.every(v => v),
        /* Siempre desde el maximizador, que aquí es X. La profundidad entra en
         * el signo para que prefiera ganar pronto y perder tarde. */
        /* La profundidad restante entra en el signo: asi prefiere ganar cuanto
         * antes y perder cuanto mas tarde. Sin ella, rematar y no rematar
         * puntuan igual. */
        evaluate: (b, maxSide, depth) => {
            const w = winnerOf(b);
            if (!w) return 0;
            return w === maxSide ? 1000 + depth : -1000 - depth;
        }
    });

    // Remata cuando puede: X en 0 y 1, la 2 gana.
    let b = ['X','X','',  '','O','',  '','O',''];
    check('remata su propia linea', ttt.best(b, 'X', 6).move === 2);

    // Bloquea: O amenaza en 6,7 y la 8 lo para (X no tiene remate propio).
    b = ['X','','',  'X','',' '.trim(),  'O','O',''];
    check('bloquea la amenaza del rival', ttt.best(b, 'X', 6).move === 8);

    // Partida perfecta contra sí mismo: tablas, nunca una victoria.
    b = ['','','','','','','','',''];
    let side = 'X';
    while (!winnerOf(b) && b.some(v => !v)) {
        const m = ttt.best(b, side, 9).move;
        b[m] = side; side = side === 'X' ? 'O' : 'X';
    }
    check('minimax contra minimax acaba en tablas', winnerOf(b) === null);

    /* La poda no puede cambiar el resultado, sólo lo que cuesta. Se compara el
     * valor de la raiz con y sin orden de jugadas: si difieren, la poda esta
     * mal puesta. */
    const sinOrden = GU.minimax({
        moves: (x) => x.map((v, i) => v ? -1 : i).filter(i => i >= 0),
        apply: (x, m, sd) => { const nb = x.slice(); nb[m] = sd; return { state: nb, side: sd === 'X' ? 'O' : 'X' }; },
        isOver: (x) => !!winnerOf(x) || x.every(v => v),
        evaluate: (x, ms, d) => { const w = winnerOf(x); return !w ? 0 : (w === ms ? 1000 + d : -1000 - d); }
    });
    const conOrden = GU.minimax({
        moves: (x) => x.map((v, i) => v ? -1 : i).filter(i => i >= 0),
        apply: (x, m, sd) => { const nb = x.slice(); nb[m] = sd; return { state: nb, side: sd === 'X' ? 'O' : 'X' }; },
        isOver: (x) => !!winnerOf(x) || x.every(v => v),
        evaluate: (x, ms, d) => { const w = winnerOf(x); return !w ? 0 : (w === ms ? 1000 + d : -1000 - d); },
        order: (ms) => ms.slice().reverse()
    });
    const pos = ['X','','O','','X','','','','O'];
    check('ordenar las jugadas no cambia el valor de la busqueda',
        sinOrden.score(pos, 'X', 7) === conOrden.score(pos, 'X', 7));

    /* Que `apply` devuelva el turno es lo que permite una jugada que REPITE.
     * Sin eso (alternando a ciegas) una IA de mancala no ve las cadenas. */
    const repite = GU.minimax({
        moves: () => [0, 1],
        apply: (st, m, sd) => ({
            state: { n: st.n + 1, quien: sd },
            /* la jugada 0 repite turno */
            side: m === 0 ? sd : (sd === 'a' ? 'b' : 'a')
        }),
        isOver: (st) => st.n >= 3,
        evaluate: (st) => st.quien === 'a' ? 10 : -10
    });
    check('apply puede devolver el mismo lado (turno extra)',
        repite.best({ n: 0, quien: null }, 'a', 3).score === 10);

    console.log('\n12. GU.toast');
    {
        const t = GU.toast();
        check('nace apagado', !t.active() && t.text() === '');
        t.show('turno extra', 1);
        check('show lo enciende', t.active() && t.text() === 'turno extra');
        t.update(0.6);
        check('sigue vivo a media vida', t.active());
        t.update(0.6);
        check('se apaga al agotarse', !t.active() && t.text() === '');
        t.show('x', 1); t.clear();
        check('clear lo apaga en el acto', !t.active());
        t.show('y', 1); t.update(99);
        check('un dt enorme no lo deja en negativo', !t.active());
    }

    console.log('\n13. GU.cards');
    {
        const deck = GU.cards().deck();
        check('el mazo son 52 cartas', deck.length === 52);
        const claves = new Set(deck.map(c => c.s + c.r));
        check('sin repetidas', claves.size === 52);
        check('el as es 0 y el rey 12',
            deck[0].r === 0 && deck[12].r === 12);
        const c = GU.cards();
        check('corazones y diamantes son los rojos',
            c.isRed('C') && c.isRed('D') && !c.isRed('T') && !c.isRed('P'));
        check('label lee la carta', c.label({ s: 'P', r: 12 }) === 'KP');
    }

    console.log('\n14. GU.canvasButtons');
    {
        const bs = GU.canvasButtons();
        bs.add({ id: 'pedir', label: 'Pedir', x: 10, y: 10, w: 80, h: 30 });
        bs.add({ id: 'doblar', label: 'Doblar', x: 100, y: 10, w: 80, h: 30, disabled: true });
        check('acierta el boton bajo el punto', bs.at(20, 20).id === 'pedir');
        check('fuera de todo devuelve null', bs.at(300, 300) === null);
        check('un boton apagado no se puede pulsar', bs.at(110, 20) === null);
        check('targets solo ofrece los activos',
            bs.targets().length === 1 && bs.targets()[0].id === 'pedir');
        bs.clear();
        check('clear los quita todos', bs.all().length === 0 && bs.at(20, 20) === null);
    }

    console.log('\n15. GU.idleScreen');
    {
        /* Un contexto de mentira que apunta lo que le hacen: lo que importa de
         * esta pieza es que no le deje el estado cambiado al siguiente que
         * dibuje, que es lo que hacian las copias que sustituye. */
        const ops = [];
        const ctx = {
            canvas: { width: 400, height: 300 },
            fillStyle: '', font: '', textAlign: 'left', textBaseline: 'alphabetic',
            _stack: [],
            save() { this._stack.push([this.textAlign, this.textBaseline, this.fillStyle]); ops.push('save'); },
            restore() {
                const st = this._stack.pop();
                if (st) { this.textAlign = st[0]; this.textBaseline = st[1]; this.fillStyle = st[2]; }
                ops.push('restore');
            },
            fillRect(x, y, w, h) { ops.push('rect:' + w + 'x' + h); },
            fillText(t) { ops.push('text:' + t); }
        };
        GU.idleScreen(ctx, { title: 'MOLINO', lines: ['Alinea tres'] });
        check('pinta titulo y linea',
            ops.includes('text:MOLINO') && ops.includes('text:Alinea tres'));
        check('cubre el canvas entero por defecto', ops.includes('rect:400x300'));
        check('devuelve textAlign como estaba', ctx.textAlign === 'left');

        ops.length = 0;
        GU.idleScreen(ctx, { title: 'BOLOS', lines: ['a', 'b'], band: true });
        check('band pinta solo una franja',
            ops.some(o => o.startsWith('rect:400x') && o !== 'rect:400x300'));

        ops.length = 0;
        GU.idleScreen(ctx, { title: 'X', hint: 'una sola' });
        check('hint vale como una linea suelta', ops.includes('text:una sola'));
    }
}

console.log('\n' + pass + ' pasan, ' + fail + ' fallan');
process.exit(fail ? 1 : 0);

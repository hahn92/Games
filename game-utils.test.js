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

console.log('\n' + pass + ' pasan, ' + fail + ' fallan');
process.exit(fail ? 1 : 0);

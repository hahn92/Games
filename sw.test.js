/* Pruebas del service worker.
 *
 *   node sw.test.js
 *
 * Mismo enfoque que game-utils.test.js: sin dependencias ni runner, cargando
 * sw.js en un `vm` con dobles escritos a mano de lo único que usa —`caches`,
 * `fetch`, `self` y los eventos—. Un service worker es de las pocas cosas de
 * este proyecto que puede dejar el sitio roto para quien ya lo ha visitado, así
 * que las tres decisiones que lo evitan están fijadas aquí:
 *
 *   - el HTML se pide por red primero, o una publicación nueva no la vería nadie;
 *   - las cachés de versiones anteriores se borran al activar;
 *   - no hay skipWaiting, para que una versión nueva no tome el control a mitad
 *     de partida.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0;
function check(nombre, cond) {
    if (cond) { pass++; console.log('  ok   ' + nombre); }
    else { fail++; console.log('  FALLO ' + nombre); }
}

/* ── Dobles ─────────────────────────────────────────────────────────── */

function hacerCache() {
    const guardado = new Map();
    return {
        _datos: guardado,
        addAll: (reqs) => { reqs.forEach(r => guardado.set(String(r.url || r), 'contenido')); return Promise.resolve(); },
        put: (req, res) => { guardado.set(String(req.url || req), res); return Promise.resolve(); },
        match: (req) => Promise.resolve(guardado.get(String(req.url || req))),
        keys: () => Promise.resolve([...guardado.keys()].map(u => ({ url: u })))
    };
}

function entorno(opts) {
    opts = opts || {};
    const caches = new Map();
    const listeners = {};
    const pedidas = [];

    const sandbox = {
        console,
        URL,
        Promise,
        Request: function (url, init) { this.url = String(url); this.init = init; },
        Response: function (body, init) {
            init = init || {};
            this.body = body;
            this.status = init.status === undefined ? 200 : init.status;
            this.statusText = init.statusText || '';
        },
        self: null,
        caches: {
            _mapa: caches,
            open: (n) => { if (!caches.has(n)) caches.set(n, hacerCache()); return Promise.resolve(caches.get(n)); },
            keys: () => Promise.resolve([...caches.keys()]),
            delete: (n) => { const habia = caches.delete(n); return Promise.resolve(habia); },
            match: (req) => {
                for (const c of caches.values()) {
                    const hit = c._datos.get(String(req.url || req));
                    if (hit) return Promise.resolve(hit);
                }
                return Promise.resolve(undefined);
            }
        },
        fetch: (req) => {
            pedidas.push(String(req.url || req));
            if (opts.sinRed) return Promise.reject(new Error('sin red'));
            return Promise.resolve({
                status: 200,
                clone: () => ({ deLaRed: true }),
                deLaRed: true
            });
        }
    };
    sandbox.self = {
        addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
        location: { origin: 'https://games.hahndev.com' },
        clients: { claim: () => Promise.resolve() },
        skipWaiting: () => { sandbox._skipWaiting = true; }
    };
    sandbox.caches._mapa = caches;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8'), sandbox);
    return { sandbox, listeners, caches, pedidas };
}

function disparar(listeners, tipo, evento) {
    const esperas = [];
    (listeners[tipo] || []).forEach(fn => fn(evento));
    return Promise.all(esperas);
}

function eventoInstall() {
    let promesa = null;
    return { e: { waitUntil: (p) => { promesa = p; } }, espera: () => promesa };
}

function eventoFetch(url, opts) {
    opts = opts || {};
    let respuesta = null;
    const req = {
        url: url,
        method: opts.method || 'GET',
        mode: opts.navigate ? 'navigate' : 'cors',
        headers: { get: (h) => (h === 'accept' ? (opts.accept || '') : null) }
    };
    return {
        e: { request: req, respondWith: (p) => { respuesta = p; } },
        respuesta: () => respuesta
    };
}

/* ── 1. Instalación ─────────────────────────────────────────────────── */
(async function () {
    console.log('\n1. instalacion');
    const { listeners, caches } = entorno();
    const inst = eventoInstall();
    await disparar(listeners, 'install', inst.e);
    await inst.espera();

    const nombres = [...caches.keys()];
    check('crea una sola cache, con version en el nombre',
        nombres.length === 1 && /^juegos-v\d+$/.test(nombres[0]));

    const c = caches.get(nombres[0]);
    const guardado = [...c._datos.keys()];
    check('guarda el catalogo y los cinco ficheros compartidos',
        ['./index.html', './game-utils.js', './audio.js', './mobile-layout.js', './fullscreen-btn.js', './styles.css']
            .every(f => guardado.includes(f)));
    check('NO se baja los ochenta juegos al instalar',
        guardado.length < 15 && !guardado.some(u => /\/(snake|tetris|freecell)\//.test(u)));

    /* ── 2. Activación ─────────────────────────────────────────────── */
    console.log('\n2. activacion');
    const ent2 = entorno();
    ent2.caches.set('juegos-v0', hacerCache());          // una version anterior
    ent2.caches.set('otra-cosa', hacerCache());          // caché ajena
    const act = eventoInstall();
    await disparar(ent2.listeners, 'activate', act.e);
    await act.espera();
    const tras = [...ent2.caches.keys()];
    check('borra las caches de versiones anteriores', !tras.includes('juegos-v0'));
    check('no toca caches que no son suyas', tras.includes('otra-cosa'));

    /* ── 3. El HTML va por red primero ─────────────────────────────── */
    console.log('\n3. HTML: red primero');
    const ent3 = entorno();
    const f3 = eventoFetch('https://games.hahndev.com/index.html', { navigate: true });
    await disparar(ent3.listeners, 'fetch', f3.e);
    const r3 = await f3.respuesta();
    check('una navegacion se pide a la red', ent3.pedidas.length === 1 && r3.deLaRed === true);

    /* ── 4. Sin red, el HTML sale de la copia ──────────────────────── */
    console.log('\n4. HTML sin conexion');
    const ent4 = entorno({ sinRed: true });
    const c4 = await new Promise(res => ent4.sandbox.caches.open('juegos-v1').then(res));
    c4._datos.set('https://games.hahndev.com/snake/index.html', { copia: true });
    const f4 = eventoFetch('https://games.hahndev.com/snake/index.html', { navigate: true });
    await disparar(ent4.listeners, 'fetch', f4.e);
    const r4 = await f4.respuesta();
    check('cae en la copia guardada', r4 && r4.copia === true);

    /* ── 5. Lo estatico sale de la cache ───────────────────────────── */
    console.log('\n5. js/css: cache primero');
    const ent5 = entorno();
    const c5 = await new Promise(res => ent5.sandbox.caches.open('juegos-v1').then(res));
    c5._datos.set('https://games.hahndev.com/game-utils.js', { copia: true });
    const f5 = eventoFetch('https://games.hahndev.com/game-utils.js');
    await disparar(ent5.listeners, 'fetch', f5.e);
    const r5 = await f5.respuesta();
    check('sirve la copia sin esperar a la red', r5 && r5.copia === true);
    check('y revalida por detras', ent5.pedidas.includes('https://games.hahndev.com/game-utils.js'));

    /* ── 6. Lo que no debe tocar ───────────────────────────────────── */
    console.log('\n6. lo que deja pasar');
    const ent6 = entorno();
    const fPost = eventoFetch('https://games.hahndev.com/index.html', { method: 'POST', navigate: true });
    await disparar(ent6.listeners, 'fetch', fPost.e);
    check('no toca las peticiones que no son GET', fPost.respuesta() === null);

    const fFuera = eventoFetch('https://www.googletagmanager.com/gtag/js?id=X');
    await disparar(ent6.listeners, 'fetch', fFuera.e);
    check('no toca lo de otros dominios', fFuera.respuesta() === null);

    /* ── 7. Nada de skipWaiting ────────────────────────────────────── */
    console.log('\n7. control');
    const ent7 = entorno();
    const act7 = eventoInstall();
    await disparar(ent7.listeners, 'install', act7.e);
    await act7.espera();
    check('no llama a skipWaiting: la version nueva espera a la siguiente visita',
        ent7.sandbox._skipWaiting !== true);

    /* ── 8. La version, al dia ──────────────────────────────────────
     *
     * No es una prueba de logica: mira el historial. Si algun fichero del
     * esqueleto se ha tocado DESPUES del ultimo cambio de VERSION, quien ya
     * tenga el worker instalado recibira el HTML nuevo —que va por red— con el
     * CSS y el JS viejos hasta la segunda carga. Paso de verdad entre la v1 y
     * la v2, con tres publicaciones sin tocarla, y no hay forma de notarlo
     * mirando el codigo. */
    console.log('\n8. version al dia');
    try {
        const { execSync } = require('child_process');
        const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
        const esqueleto = (sw.match(/var ESQUELETO = \[([\s\S]*?)\]/) || [, ''])[1]
            .split(',').map(t => t.trim().replace(/^'\.\//, '').replace(/'$/, ''))
            .filter(f => f && f !== '.' && f !== './');
        const fecha = (rev, file) => {
            try {
                return +execSync(`git log -1 --format=%ct ${rev} -- ${file}`,
                                 { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
            } catch (e) { return 0; }
        };
        /* Cuando se toco VERSION por ultima vez: el ultimo commit de sw.js sirve,
         * porque este fichero solo se toca para eso o para cambiar la logica. */
        const swTime = fecha('HEAD', 'sw.js');
        const viejos = esqueleto.filter(f => f && fecha('HEAD', f) > swTime);
        if (!swTime) {
            console.log('  --   sin git: no se puede comprobar');
        } else {
            check('ningun fichero del esqueleto es mas nuevo que sw.js' +
                  (viejos.length ? ' (sube VERSION: ' + viejos.join(', ') + ')' : ''),
                  viejos.length === 0);
        }
    } catch (e) {
        console.log('  --   sin git: no se puede comprobar');
    }

    /* ── 9. Sin copia y sin red ─────────────────────────────────────
     *
     * `respondWith` tiene que resolverse a un Response SIEMPRE. Resolverse a
     * `undefined` no es "error de red": el navegador lo toma por un fallo del
     * worker y tumba la carga entera. Salió abriendo el catálogo sin servidor:
     * las miniaturas que aún no estaban guardadas se llevaban la página por
     * delante en vez de dejar la tarjeta sin dibujo. */
    console.log('\n9. sin copia y sin red');
    const ent9 = entorno({ sinRed: true });
    const f9 = eventoFetch('https://games.hahndev.com/thumbnails/snake.js');
    await disparar(ent9.listeners, 'fetch', f9.e);
    const r9 = await f9.respuesta();
    check('lo estatico responde 503, no undefined', r9 && r9.status === 503);

    const f9b = eventoFetch('https://games.hahndev.com/nunca-visto/index.html', { navigate: true });
    await disparar(ent9.listeners, 'fetch', f9b.e);
    const r9b = await f9b.respuesta();
    check('una navegacion nunca vista tampoco se queda en undefined',
        r9b !== undefined && r9b !== null);

    console.log('\n' + pass + ' pasan, ' + fail + ' fallan');
    process.exit(fail ? 1 : 0);
}());

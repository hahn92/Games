/* sw.js — hace que la colección funcione sin conexión.
 *
 * Los ochenta juegos son HTML, CSS y JavaScript estáticos: no hay servidor que
 * consultar ni datos que pedir. Lo único que hacía falta para jugar en un avión
 * o en el metro era guardarlos, y eso es todo lo que hace este fichero.
 *
 * Las tres decisiones que evitan que un service worker haga más mal que bien:
 *
 * 1. **El HTML va por red primero.** Es lo que garantiza que una actualización
 *    llegue: si el HTML se sirviera de la caché, un cambio publicado no lo vería
 *    nadie que ya hubiera entrado una vez, y no habría forma de arreglarlo desde
 *    el servidor. Si la red falla, entonces sí se tira de la copia.
 * 2. **No se hace `skipWaiting()`.** Una versión nueva se instala en segundo
 *    plano y toma el control en la siguiente visita, no a mitad de partida. Con
 *    `skipWaiting` una pestaña abierta puede acabar mezclando el HTML viejo con
 *    el JavaScript nuevo, que es la peor forma de romper algo.
 * 3. **La caché lleva versión en el nombre y las viejas se borran al activar.**
 *    Sin eso, cada despliegue deja su basura en el disco del visitante para
 *    siempre.
 *
 * Al instalar sólo se guarda el esqueleto —el catálogo y los cinco ficheros
 * compartidos, unos 150 KB—. Los juegos se guardan a medida que se abren: la
 * alternativa, bajarse los 3 MB de los ochenta en la primera visita, castiga con
 * una espera y con datos a quien a lo mejor sólo quería jugar al Snake.
 */

/* Súbela cuando cambie cualquier fichero del esqueleto. Es lo que dispara la
 * caché nueva y el borrado de la vieja; si no se sube, quien ya tenía el worker
 * recibe el HTML nuevo (va por red) con el CSS y el JS viejos hasta la segunda
 * carga. Pasó entre la v1 y esta: se publicaron tres cambios sin tocarla.
 * `node sw.test.js` lo comprueba y avisa. */
var VERSION = 'v2';
var CACHE = 'juegos-' + VERSION;

/* El esqueleto: lo que necesita el catálogo para arrancar, y los ficheros que
 * comparten los ochenta juegos. Sin `thumbnails.js` no se ve ninguna miniatura,
 * pero las miniaturas concretas se piden una a una y se guardan al vuelo. */
var ESQUELETO = [
    './',
    './index.html',
    './styles.css',
    './main.js',
    './thumbnails.js',
    './game-utils.js',
    './audio.js',
    './mobile-layout.js',
    './fullscreen-btn.js',
    './favicon.svg'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            /* `reload` evita que el propio caché HTTP del navegador sirva una
             * copia vieja justo al instalar, que dejaría la versión nueva
             * naciendo con ficheros de la anterior. */
            return c.addAll(ESQUELETO.map(function (u) {
                return new Request(u, { cache: 'reload' });
            }));
        })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (nombres) {
            return Promise.all(nombres.map(function (n) {
                if (n !== CACHE && n.indexOf('juegos-') === 0) return caches.delete(n);
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

function esHTML(req) {
    return req.mode === 'navigate' ||
           (req.headers.get('accept') || '').indexOf('text/html') >= 0;
}

self.addEventListener('fetch', function (e) {
    var req = e.request;

    /* Sólo GET y sólo lo de esta misma web. Una petición a otro dominio —el
     * gtag del catálogo -- se deja pasar tal cual: no es nuestra y cachearla
     * sólo puede dar problemas. */
    if (req.method !== 'GET') return;
    if (new URL(req.url).origin !== self.location.origin) return;

    if (esHTML(req)) {
        /* Red primero: así una publicación nueva se ve en la siguiente carga. */
        e.respondWith(
            fetch(req).then(function (res) {
                var copia = res.clone();
                caches.open(CACHE).then(function (c) { c.put(req, copia); });
                return res;
            }).catch(function () {
                return caches.match(req).then(function (hit) {
                    return hit || caches.match('./index.html');
                });
            })
        );
        return;
    }

    /* Todo lo demás —js, css, svg— de la caché primero, porque no cambia dentro
     * de una versión y así el juego arranca al instante. Se revalida en segundo
     * plano: la copia guardada se sirve ya, y la siguiente carga tendrá la
     * nueva. Un fallo de red aquí no rompe nada, sólo deja la copia como está. */
    e.respondWith(
        caches.match(req).then(function (hit) {
            var red = fetch(req).then(function (res) {
                if (res && res.status === 200) {
                    var copia = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copia); });
                }
                return res;
            }).catch(function () { return hit; });
            return hit || red;
        })
    );
});

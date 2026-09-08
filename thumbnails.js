/* thumbnails.js — carga y pinta las miniaturas del catálogo.
 *
 * Cada miniatura es una escena dibujada a canvas, sin imágenes. Antes vivían
 * las ochenta en este fichero: 292 KB (56 KB comprimidos) que la portada se
 * descargaba y PARSEABA enteros para pintar las ocho tarjetas de la primera
 * página. El IntersectionObserver difería el dibujo, pero no la descarga ni el
 * parseo, que es trabajo en el hilo principal antes de que se vea nada.
 *
 * Ahora cada juego tiene su fichero en `thumbnails/` y se pide sólo cuando su
 * tarjeta entra en pantalla. La portada baja de ~292 KB de JS a este cargador
 * más los ocho ficheros que necesita de verdad.
 *
 * Añadir un juego es añadir `thumbnails/<carpeta>.js`; no hay lista que
 * mantener aquí, el nombre sale del `data-game` de la tarjeta.
 */
(function () {
    var W = 220, H = 220;
    var pedidos = {};        /* carpeta -> true en cuanto se pide el script */
    var pendientes = {};     /* carpeta -> [canvas] esperando a que llegue */

    function pintar(canvas, fn) {
        if (canvas.__thumbDrawn) return;
        canvas.__thumbDrawn = true;
        canvas.width  = W;
        canvas.height = H;
        /* Se dimensiona aquí y no en el markup, así que la pasada automática de
           game-utils.js lo saltó: hay que apuntarse ahora que W/H se conocen y
           ANTES de crear el contexto. Sin fijar el CSS: styles.css ya lo mide
           con width:100% + aspect-ratio:1/1, y un alto explícito lo aplastaría. */
        if (window.GU) GU.upgradeCanvas(canvas, { pinCss: false });
        var ctx = canvas.getContext('2d');
        try { fn(ctx); } catch (e) { console.warn('Thumbnail error for', canvas.getAttribute('data-game'), e); }
    }

    function servir(key) {
        var fn = window.__thumbs && window.__thumbs[key];
        if (!fn) return;
        var lista = pendientes[key] || [];
        for (var i = 0; i < lista.length; i++) pintar(lista[i], fn);
        pendientes[key] = [];
    }

    function pedir(canvas) {
        var key = canvas.getAttribute('data-game');
        if (!key || canvas.__thumbDrawn) return;

        var fn = window.__thumbs && window.__thumbs[key];
        if (fn) { pintar(canvas, fn); return; }

        (pendientes[key] = pendientes[key] || []).push(canvas);
        if (pedidos[key]) return;      /* ya está en camino */
        pedidos[key] = true;

        var s = document.createElement('script');
        s.src = './thumbnails/' + key + '.js';
        s.async = true;
        s.onload = function () { servir(key); };
        /* Un juego cuyo fichero falte deja la tarjeta con el canvas vacío, que
           es exactamente lo que pasaba antes si faltaba su entrada: se avisa por
           consola y el catálogo sigue funcionando. */
        s.onerror = function () { console.warn('Falta la miniatura de', key); };
        document.head.appendChild(s);
    }

    /* ── se pide cada miniatura la primera vez que su tarjeta se ve ──
     *
     * Las ochenta tarjetas están en el DOM, pero el catálogo pagina ocultando
     * las tarjetas, así que sólo se ven ocho a la vez. Una tarjeta oculta no
     * tiene caja de layout y nunca intersecta; al paginar hasta ella la gana y
     * el observador dispara entonces.
     *
     * Dibujar es de una sola vez: el canvas conserva sus píxeles cuando la
     * tarjeta se vuelve a ocultar. */
    document.addEventListener('DOMContentLoaded', function () {
        var list = document.querySelectorAll('canvas[data-game]');
        var i;
        if (!('IntersectionObserver' in window)) {
            for (i = 0; i < list.length; i++) pedir(list[i]);
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            for (var k = 0; k < entries.length; k++) {
                if (!entries[k].isIntersecting) continue;
                pedir(entries[k].target);
                io.unobserve(entries[k].target);
            }
        }, { rootMargin: '300px' });   /* un poco antes de entrar en pantalla */
        for (i = 0; i < list.length; i++) io.observe(list[i]);
    });
}());

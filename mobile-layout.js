/* mobile-layout.js — Shared mobile-layout bootstrap for every game page.
 *
 * Replaces the ~60-line script each game used to carry inline. The invariant
 * part (fixed full-screen gameSide, hiding infoSide, viewport listeners and the
 * mobile start button) lives here once; each game only declares what differs.
 *
 * Must be loaded BEFORE main.js — it defines the `isMobile` and
 * `adjustMobileLayout` globals that snake/main.js and minesweeper/main.js use.
 *
 *   MobileLayout({
 *       show:       { mobileScore: 'block' },   // ids shown on mobile, hidden on reset
 *       fit:        function (vHeight) { ... }, // size the canvas/board
 *       reset:      function () { ... },        // undo `fit` on desktop
 *       onMobile:   function (gameSide, vHeight) { ... }, // extra mobile-only setup
 *       onReset:    function (gameSide) { ... },          // undo `onMobile`
 *       mobileOnly: false,   // true = skip the `innerWidth < 900` desktop-narrow branch
 *       startBtn:   true,    // false = never reveal #mobileStartBtn (hangman)
 *       background: 'var(--grad-bg)', // gameSide backdrop on mobile (pacman uses '#000')
 *       stopPropagation: false, // true = stopPropagation on the mobile start click
 *       actions:    ['rollBtn']  // botones del panel lateral que hacen falta para jugar
 *   });
 *
 * `actions`: en móvil el panel lateral se oculta entero, y con él botones sin
 * los que no se puede jugar — Comprobar en mastermind, Robar en dominó, Tirar en
 * generala. Se reflejan en una barra bajo el tablero: mismo texto, mismo
 * disabled, y el toque pulsa el botón ORIGINAL, así que no se duplica lógica.
 */
(function () {
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    /* snake/main.js calls this global directly */
    window.isMobile = isMobile;

    window.MobileLayout = function (cfg) {
        cfg = cfg || {};
        var show     = cfg.show || {};
        var useStart = cfg.startBtn !== false;
        var bg       = cfg.background || 'var(--grad-bg)';

        var inMobile = false;
        var actionBar = null;

        function buildActions(gameSide) {
            if (actionBar || !cfg.actions || !cfg.actions.length) return actionBar;
            actionBar = document.createElement('div');
            actionBar.className = 'mobile-actions';
            actionBar.style.display = 'none';
            cfg.actions.forEach(function (id) {
                var src = document.getElementById(id);
                if (!src) return;
                var b = document.createElement('button');
                b.type = 'button';
                function sync() {
                    b.textContent = src.textContent;
                    b.disabled = src.disabled;
                    b.style.display = src.style.display === 'none' ? 'none' : '';
                }
                sync();
                b.addEventListener('click', function () { src.click(); });
                if (window.MutationObserver) {
                    new MutationObserver(sync).observe(src, {
                        attributes: true, attributeFilter: ['disabled', 'style'],
                        childList: true, characterData: true, subtree: true
                    });
                }
                actionBar.appendChild(b);
            });
            var anchor = gameSide.querySelector('canvas');
            if (anchor && anchor.parentNode === gameSide) gameSide.insertBefore(actionBar, anchor.nextSibling);
            else gameSide.appendChild(actionBar);
            return actionBar;
        }
        var dismissed = false;   // pulsado; vuelve a salir cuando Iniciar se reactive

        /* El botón de inicio en móvil, garantizado y en su sitio.
         *
         * En móvil el panel de información —y con él Iniciar— se oculta, así que
         * este botón es la ÚNICA forma de empezar. 38 juegos no lo llevaban en el
         * markup: enseñaban «Pulsa Iniciar» sin nada que pulsar y no se podían
         * jugar en un teléfono. Ahora se crea aquí si falta.
         *
         * La posición también se decide aquí: 22 juegos lo tenían a 20 px del
         * borde, debajo de la barra de navegación y del marcador, que se comían el
         * toque; los demás a media altura, encima del título de la pantalla de
         * reposo. Va centrado y al 70 % del tablero, bajo ese título. */
        function ensureStartBtn(gameSide) {
            var btn = document.getElementById('mobileStartBtn');
            if (btn || !useStart || !document.getElementById('startBtn')) return btn;
            btn = document.createElement('button');
            btn.id = 'mobileStartBtn';
            btn.type = 'button';
            btn.textContent = 'Iniciar';
            btn.style.display = 'none';
            gameSide.appendChild(btn);
            return btn;
        }

        /* En un canvas el título de reposo va a media altura, así que el botón va
         * debajo, al 70 %. Un tablero de DOM (wordle, 2048) no tiene título: ahí
         * va centrado sobre el propio tablero, no sobre el teclado de debajo. */
        function boardOf(gameSide, btn) {
            var c = gameSide.querySelector('canvas');
            if (c) return { el: c, at: 0.7 };
            for (var k = gameSide.firstElementChild; k; k = k.nextElementSibling) {
                if (k === btn || k.id === 'mobileScore' || k.classList.contains('mobile-score')) continue;
                if (k.getBoundingClientRect().height > 40) return { el: k, at: 0.5 };
            }
            return { el: gameSide, at: 0.5 };
        }

        function placeStartBtn(btn, gameSide) {
            var b = boardOf(gameSide, btn);
            var r = b.el.getBoundingClientRect();
            var host = (btn.offsetParent || gameSide).getBoundingClientRect();
            var s = btn.style;
            s.position  = 'absolute';
            s.left      = (r.left + r.width / 2 - host.left) + 'px';
            s.top       = (r.top + r.height * b.at - host.top) + 'px';
            s.transform = 'translate(-50%, -50%)';
            s.zIndex    = '1000';
            btn.classList.add('mobile-start-btn');
        }

        /* Sigue al Iniciar de escritorio: la partida puede empezar por otro camino
         * (tocar el tablero, una tecla) y el botón se quedaba flotando encima; y al
         * terminar, Iniciar vuelve a estar activo y en móvil no había forma de jugar
         * otra vez si el juego no saca popup. */
        function syncStartBtn() {
            var btn = document.getElementById('mobileStartBtn');
            var startBtn = document.getElementById('startBtn');
            if (!btn || !startBtn || !useStart || !inMobile) return;
            if (startBtn.disabled) btn.style.display = 'none';
            else {
                dismissed = false;
                btn.style.display = 'block';
                placeStartBtn(btn, document.getElementById('gameSide'));
            }
        }

        function adjustMobileLayout() {
            var gameSide       = document.getElementById('gameSide');
            var infoSide       = document.getElementById('infoSide');
            if (!gameSide) return;
            var mobileStartBtn = ensureStartBtn(gameSide);
            var bar = buildActions(gameSide);

            /* visualViewport excludes the browser chrome on iOS Safari */
            var vHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            var id, el;

            var narrow = cfg.mobileOnly ? isMobile() : (isMobile() || window.innerWidth < 900);

            if (narrow) {
                if (isMobile()) {
                    gameSide.style.position   = 'fixed';
                    gameSide.style.top        = '0';
                    gameSide.style.left       = '0';
                    /* innerWidth, not 100vw — on iOS Safari 100vw exceeds the visual viewport */
                    gameSide.style.width      = window.innerWidth + 'px';
                    gameSide.style.height     = vHeight + 'px';
                    gameSide.style.zIndex     = '999';
                    gameSide.style.background = bg;
                    if (infoSide) infoSide.style.display = 'none';
                    /* Girar el móvil a media partida lanza un resize: el botón no
                     * puede volver a salir si ya se pulsó o la partida está en marcha. */
                    var sb = document.getElementById('startBtn');
                    if (mobileStartBtn && useStart && !dismissed && !(sb && sb.disabled)) {
                        mobileStartBtn.style.display = 'block';
                    }
                    for (id in show) {
                        el = document.getElementById(id);
                        if (el) el.style.display = show[id];
                    }
                    if (bar) bar.style.display = 'flex';
                    if (cfg.onMobile) cfg.onMobile(gameSide, vHeight);
                }
                if (cfg.fit) cfg.fit(vHeight);
                inMobile = isMobile();
                if (inMobile && mobileStartBtn && useStart && mobileStartBtn.style.display !== 'none') {
                    placeStartBtn(mobileStartBtn, gameSide);
                }
            } else {
                inMobile = false;
                gameSide.style.position   = '';
                gameSide.style.top        = '';
                gameSide.style.left       = '';
                gameSide.style.width      = '';
                gameSide.style.height     = '';
                gameSide.style.zIndex     = '';
                gameSide.style.background = '';
                if (infoSide) infoSide.style.display = '';
                if (mobileStartBtn && useStart) mobileStartBtn.style.display = 'none';
                for (id in show) {
                    el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                }
                if (bar) bar.style.display = 'none';
                if (cfg.onReset) cfg.onReset(gameSide);
                if (cfg.reset)   cfg.reset();
            }
        }

        /* minesweeper/main.js calls this global directly */
        window.adjustMobileLayout = adjustMobileLayout;

        window.addEventListener('resize', adjustMobileLayout);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', adjustMobileLayout);
        document.addEventListener('DOMContentLoaded', adjustMobileLayout);

        document.addEventListener('DOMContentLoaded', function () {
            var gameSide = document.getElementById('gameSide');
            var btn      = gameSide && ensureStartBtn(gameSide);
            var startBtn = document.getElementById('startBtn');
            if (!btn) return;
            btn.addEventListener('click', function (e) {
                if (cfg.stopPropagation) e.stopPropagation();
                if (startBtn) startBtn.click();
                btn.style.display = 'none';
                dismissed = true;
            });
            if (startBtn && useStart && window.MutationObserver) {
                new MutationObserver(syncStartBtn)
                    .observe(startBtn, { attributes: true, attributeFilter: ['disabled'] });
            }
        });
    };
}());

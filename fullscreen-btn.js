/* fullscreen-btn.js — Fullscreen/landscape button + inter-game navigation */
(function () {
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    function isIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /* ── Game list (same order as catalog) ─────────────────────────── */
    var GAMES = [
        ['snake',        'Snake Clásico'],
        ['tetris',       'Tetris JS'],
        ['pong',         'Pong Clásico'],
        ['breakout',     'Breakout'],
        ['2048',         '2048'],
        ['memorama',     'Memorama'],
        ['flappybird',   'Flappy Bird'],
        ['spaceinvaders','Space Invaders'],
        ['whackamole',   'Whack-a-Mole'],
        ['simon',        'Simon Dice'],
        ['runner',       'Endless Runner'],
        ['minesweeper',  'Buscaminas'],
        ['tictactoe',    'Tres en Raya'],
        ['connectfour',  'Conecta 4'],
        ['asteroids',    'Asteroids'],
        ['frogger',      'Frogger'],
        ['wordle',       'Wordle'],
        ['typingspeed',  'Velocidad de Escritura'],
        ['slidingpuzzle','Puzzle 15'],
        ['fruitcatcher', 'Atrapa Frutas'],
        ['pacman',       'Pac-Man'],
        ['bubbleshooter','Bubble Shooter'],
        ['hangman',      'Ahorcado'],
        ['carrace',      'Carrera de Autos'],
        ['platformer',   'Plataformero'],
        ['stacktower',   'Apilador de Bloques'],
        ['catapulta',    'Catapulta'],
        ['helicoidal',   'Helicoidal'],
        ['ritmo',        'Ritmo'],
        ['cambiocolor',  'Cambio de Color'],
        ['chess',        'Ajedrez'],
        ['cosecha',      'La Cosecha'],
        ['plinko',       'Plinko'],
        ['dardos',       'Dardos Giratorios'],
        ['gemas',        'Gemas'],
        ['minero',       'Minero de Oro'],
        ['laberinto',    'Laberinto Neón'],
        ['sokoban',      'Empuja Cajas'],
        ['pinball',      'Pinball Neón'],
        ['billar',       'Billar'],
        ['airhockey',    'Air Hockey'],
        ['damas',        'Damas'],
        ['reversi',      'Reversi'],
        ['misiles',      'Comando Misil'],
        ['saltador',     'Saltador'],
        ['batallanaval', 'Batalla Naval'],
        ['blackjack',    'Blackjack'],
        ['sopaletras',   'Sopa de Letras'],
        ['hanoi',        'Torres de Hanói'],
        ['sudoku',       'Sudoku'],
        ['nonograma',    'Nonograma'],
        ['solitario',    'Solitario'],
        ['minigolf',     'Minigolf'],
        ['bolos',        'Bolos'],
        ['tron',         'Estelas de Luz'],
        ['lunar',        'Alunizaje'],
        ['mastermind',   'Descifra el Código'],
        ['generala',     'Generala'],
        ['ciempies',     'Ciempiés'],
        ['bombas',       'Bombas'],
        ['domino',       'Dominó'],
        ['mahjong',      'Mahjong Solitario'],
        ['tiroalblanco', 'Galería de Tiro'],
        ['canastas',     'Canastas'],
        ['lightsout',    'Apaga las Luces'],
        ['tuberias',     'Tuberías'],
        ['gomoku',       'Cinco en Raya'],
        ['futoshiki',    'Futoshiki'],
        ['mancala',      'Mancala'],
        ['molino',       'Molino'],
        ['inundacion',   'Inundación'],
        ['senku',        'Senku'],
        ['timbiriche',   'Timbiriche'],
        ['escaleras',    'Serpientes y Escaleras'],
        ['freecell',     'FreeCell'],
        ['kakuro',       'Kakuro'],
        ['puentes',      'Puentes'],
        ['gatosupremo',  'Gato Supremo'],
        ['bloques',      'Bloques'],
        ['backgammon',   'Backgammon'],
    ];

    /* ── Detect current game folder from URL ────────────────────────── */
    function detectFolder() {
        var parts = window.location.pathname.split('/').filter(Boolean);
        // Remove trailing filename (e.g. 'index.html')
        if (parts.length > 0 && parts[parts.length - 1].indexOf('.') > -1) parts.pop();
        return parts.length > 0 ? parts[parts.length - 1] : '';
    }

    function findGameIndex(folder) {
        for (var i = 0; i < GAMES.length; i++) {
            if (GAMES[i][0] === folder) return i;
        }
        return -1;
    }

    /* ── Sin conexión ───────────────────────────────────────────────
       El service worker se registra desde aquí porque este es el único fichero
       que cargan los ochenta juegos y el catálogo: así da igual por dónde entre
       alguien —un juego suelto compartido por enlace, por ejemplo—, la próxima
       vez lo tendrá guardado.

       La ruta se calcula desde la ubicación de ESTE script, no desde la página:
       un juego vive en /snake/ y el worker en la raíz, y un './sw.js' desde ahí
       apuntaría a /snake/sw.js. El `scope` en la raíz es lo que le deja
       responder por todos los juegos y no sólo por la carpeta desde la que se
       registró.

       Si algo falla —protocolo file://, el navegador no lo soporta, el usuario
       lo tiene bloqueado— no pasa nada: el sitio funciona igual, sólo que
       necesitando red. */
    function registrarSW() {
        if (!('serviceWorker' in navigator)) return;
        if (location.protocol === 'file:') return;
        var base = document.currentScript && document.currentScript.src;
        if (!base) {
            var scripts = document.getElementsByTagName('script');
            for (var i = scripts.length - 1; i >= 0; i--) {
                if (/fullscreen-btn\.js/.test(scripts[i].src)) { base = scripts[i].src; break; }
            }
        }
        if (!base) return;
        var raiz = base.replace(/fullscreen-btn\.js.*$/, '');
        navigator.serviceWorker.register(raiz + 'sw.js', { scope: raiz })
            .catch(function () { /* sin conexión offline, pero el sitio va */ });
    }

    /* ── Sound preference ───────────────────────────────────────────
       audio.js lleva desde el principio setMuted/isMuted/toggleMute y no los
       usaba nadie: setenta juegos con sonido y ninguna manera de callarlos sin
       bajarle el volumen al sistema. El interruptor vive aqui, en el unico
       fichero que cargan todos, en vez de en cada juego.

       La preferencia se guarda por GameStore, que degrada a memoria cuando el
       navegador bloquea el almacenamiento — asi que esto no puede lanzar ni
       dejar la pagina a medias, y como mucho se pierde el ajuste al recargar. */
    var MUTE_KEY = 'gamesMuted';

    function storedMuted() {
        if (!window.GameStore) return false;
        return window.GameStore.getNum(MUTE_KEY, 0) === 1;
    }

    /* `persist` es falso al arrancar: leer la preferencia no es cambiarla, y
       reescribirla en cada carga solo sirve para pisarla si algo va mal. */
    function applyMuted(m, persist) {
        if (window.GameAudio && window.GameAudio.setMuted) window.GameAudio.setMuted(m);
        if (persist && window.GameStore) window.GameStore.setNum(MUTE_KEY, m ? 1 : 0);
    }

    /* ── Build navigation bar ───────────────────────────────────────── */
    function buildNav(idx) {
        var prev = idx > 0 ? GAMES[idx - 1] : null;
        var next = idx < GAMES.length - 1 ? GAMES[idx + 1] : null;

        var nav = document.createElement('div');
        nav.id = 'gameNavBar';
        nav.style.cssText =
            'position:fixed;top:10px;left:10px;z-index:9998;' +
            'display:flex;align-items:center;gap:2px;' +
            'background:rgba(15,20,30,0.88);' +
            'border-radius:24px;padding:4px 6px;' +
            'box-shadow:0 2px 12px rgba(0,0,0,0.55);' +
            '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
            'border:1px solid rgba(143,211,244,0.18);' +
            'font-family:sans-serif;';

        function svgLeft() {
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
        }
        function svgHome() {
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
        }
        function svgRight() {
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        }

        function makeBtn(html, href, title, disabled) {
            var el = disabled ? document.createElement('span') : document.createElement('a');
            if (!disabled) el.href = href;
            el.title = title;
            /* el contenido es un SVG sin texto: sin aria-label el enlace se
               anuncia solo por su URL */
            el.setAttribute('aria-label', title);
            el.innerHTML = html;
            el.style.cssText =
                'color:' + (disabled ? 'rgba(143,211,244,0.25)' : '#8fd3f4') + ';' +
                'text-decoration:none;' +
                'width:28px;height:28px;display:flex;align-items:center;justify-content:center;' +
                'border-radius:50%;' +
                'transition:background 0.15s,color 0.15s;' +
                'cursor:' + (disabled ? 'default' : 'pointer') + ';' +
                'touch-action:manipulation;-webkit-tap-highlight-color:transparent;' +
                'flex-shrink:0;';
            if (!disabled) {
                el.addEventListener('mouseenter', function () {
                    this.style.background = 'rgba(143,211,244,0.18)';
                    this.style.color = '#fff';
                });
                el.addEventListener('mouseleave', function () {
                    this.style.background = '';
                    this.style.color = '#8fd3f4';
                });
            }
            return el;
        }

        function svgSound() {
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 9 8 9 13 5 13 19 8 15 4 15" fill="currentColor" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
        }
        function svgMuted() {
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 9 8 9 13 5 13 19 8 15 4 15" fill="currentColor" stroke-linejoin="round"/><line x1="17" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="17" y2="15"/></svg>';
        }

        /* Un <button> de verdad, no el <a> de makeBtn: esto no navega a ningun
           sitio, y asi trae foco, Enter/Espacio y aria-pressed sin escribirlos. */
        function makeSoundBtn() {
            var b = document.createElement('button');
            var muted = storedMuted();
            b.id = 'soundBtn';
            b.type = 'button';
            b.style.cssText =
                'color:#8fd3f4;background:none;border:0;padding:0;margin:0;' +
                'width:28px;height:28px;display:flex;align-items:center;justify-content:center;' +
                'border-radius:50%;transition:background 0.15s,color 0.15s;cursor:pointer;' +
                'touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex-shrink:0;';
            function paint() {
                b.innerHTML = muted ? svgMuted() : svgSound();
                b.title = muted ? 'Activar sonido' : 'Silenciar';
                b.setAttribute('aria-label', b.title);
                b.setAttribute('aria-pressed', muted ? 'true' : 'false');
                b.style.color = muted ? 'rgba(143,211,244,0.45)' : '#8fd3f4';
            }
            paint();
            b.addEventListener('click', function () {
                muted = !muted;
                applyMuted(muted, true);
                paint();
                /* El clic de confirmacion solo cuando se vuelve a oir; al
                   silenciar, sonar seria contradecir al boton. */
                if (!muted && window.GameAudio && window.GameAudio.click) window.GameAudio.click();
            });
            b.addEventListener('mouseenter', function () {
                this.style.background = 'rgba(143,211,244,0.18)';
            });
            b.addEventListener('mouseleave', function () {
                this.style.background = '';
                this.style.color = muted ? 'rgba(143,211,244,0.45)' : '#8fd3f4';
            });
            return b;
        }

        // Separator
        function sep() {
            var s = document.createElement('span');
            s.style.cssText =
                'width:1px;height:18px;background:rgba(143,211,244,0.18);flex-shrink:0;margin:0 1px;';
            return s;
        }

        // Prev
        var homeHref = '../';
        nav.appendChild(makeBtn(
            svgLeft(),
            prev ? ('../' + prev[0] + '/') : '#',
            prev ? ('◀ ' + prev[1]) : 'Primer juego',
            !prev
        ));
        nav.appendChild(sep());

        // Home
        nav.appendChild(makeBtn(svgHome(), homeHref, 'Catálogo de juegos', false));
        nav.appendChild(sep());

        // Next
        nav.appendChild(makeBtn(
            svgRight(),
            next ? ('../' + next[0] + '/') : '#',
            next ? (next[1] + ' ▶') : 'Último juego',
            !next
        ));
        nav.appendChild(sep());

        // Sound
        nav.appendChild(makeSoundBtn());

        document.body.appendChild(nav);
    }

    /* ── DOMContentLoaded — nav for all devices ─────────────────────── */
    document.addEventListener('DOMContentLoaded', function () {

        /* El silencio se aplica aunque la barra no llegue a construirse: la
           preferencia es del jugador, no de esta pantalla. */
        applyMuted(storedMuted());

        registrarSW();

        /* Navigation */
        var folder = detectFolder();
        var idx    = findGameIndex(folder);
        if (idx >= 0) buildNav(idx);

        /* Fullscreen button — mobile only */
        if (!isMobile()) return;

        var ios = isIOS();

        /* ── Button ── */
        var btn = document.createElement('button');
        btn.id = 'fullscreenBtn';
        btn.title = ios ? 'Rotar pantalla' : 'Pantalla completa';
        btn.setAttribute('aria-label', btn.title);
        btn.style.cssText =
            'position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));right:16px;' +
            'z-index:9999;width:46px;height:46px;border-radius:50%;border:none;' +
            'background:rgba(30,30,30,0.92);color:#8fd3f4;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 2px 10px rgba(0,0,0,0.55);' +
            '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
            'touch-action:manipulation;-webkit-tap-highlight-color:transparent;';

        function svgExpand() {
            return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
                '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        }
        function svgCompress() {
            return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
                '<line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';
        }
        function svgRotate() {
            return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>' +
                '<path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>';
        }

        btn.innerHTML = ios ? svgRotate() : svgExpand();
        document.body.appendChild(btn);

        /* ── iOS rotate-hint overlay ── */
        var rotateHint = null;
        if (ios) {
            rotateHint = document.createElement('div');
            rotateHint.style.cssText =
                'position:fixed;inset:0;background:rgba(0,0,0,0.87);z-index:10000;' +
                'display:none;flex-direction:column;align-items:center;justify-content:center;' +
                'color:#fff;font-size:1.1rem;text-align:center;font-family:sans-serif;' +
                'padding:2rem;box-sizing:border-box;';
            rotateHint.innerHTML =
                '<div style="font-size:4rem;margin-bottom:0.8rem;line-height:1;' +
                'animation:rotateHintSpin 1.2s ease-in-out infinite alternate">⟳</div>' +
                '<div style="font-size:1.3rem;font-weight:bold;margin-bottom:0.5rem">Rota tu dispositivo</div>' +
                '<div style="font-size:0.95rem;color:#aaa;margin-bottom:1.8rem">Gira el teléfono horizontalmente<br>para aprovechar toda la pantalla</div>' +
                '<button id="rotateHintClose" style="padding:0.7rem 2.2rem;border-radius:10px;border:none;' +
                'background:linear-gradient(90deg,#8fd3f4,#ff512f);color:#222;font-weight:bold;' +
                'font-size:1rem;cursor:pointer;touch-action:manipulation;">Cerrar</button>';
            document.body.appendChild(rotateHint);

            var style = document.createElement('style');
            style.textContent =
                '@keyframes rotateHintSpin{from{transform:rotate(-30deg)}to{transform:rotate(30deg)}}';
            document.head.appendChild(style);

            document.getElementById('rotateHintClose').addEventListener('click', function () {
                rotateHint.style.display = 'none';
            });

            function onOrientationChange() {
                setTimeout(function () {
                    var landscape = window.innerWidth > window.innerHeight;
                    if (landscape && rotateHint.style.display !== 'none') {
                        rotateHint.style.display = 'none';
                    }
                    triggerResize();
                }, 400);
            }
            window.addEventListener('orientationchange', onOrientationChange);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', onOrientationChange);
            }
        }

        /* ── Helpers ── */
        function triggerResize() {
            [100, 350, 700].forEach(function (d) {
                setTimeout(function () {
                    window.dispatchEvent(new Event('resize'));
                    if (window.visualViewport) {
                        window.visualViewport.dispatchEvent(new Event('resize'));
                    }
                }, d);
            });
        }

        var fsActive = false;

        function enterFS() {
            var el = document.documentElement;
            var req = el.requestFullscreen ||
                      el.webkitRequestFullscreen ||
                      el.mozRequestFullScreen ||
                      el.msRequestFullscreen;
            if (!req) { triggerResize(); return; }
            var p = req.call(el);
            if (p && typeof p.then === 'function') {
                p.then(function () { onEnterFSDone(); }).catch(function () {});
            } else {
                setTimeout(onEnterFSDone, 200);
            }
        }

        function onEnterFSDone() {
            fsActive = true;
            btn.innerHTML = svgCompress();
            if (screen.orientation && typeof screen.orientation.lock === 'function') {
                screen.orientation.lock('landscape').catch(function () {});
            }
            triggerResize();
        }

        function exitFS() {
            var ex = document.exitFullscreen ||
                     document.webkitExitFullscreen ||
                     document.mozCancelFullScreen ||
                     document.msExitFullscreen;
            if (ex) ex.call(document);
        }

        btn.addEventListener('click', function () {
            if (ios) {
                var landscape = window.innerWidth > window.innerHeight;
                if (landscape) { triggerResize(); } else { rotateHint.style.display = 'flex'; }
                return;
            }
            if (fsActive) { exitFS(); } else { enterFS(); }
        });

        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
            .forEach(function (ev) {
                document.addEventListener(ev, function () {
                    var isFS = !!(document.fullscreenElement ||
                                  document.webkitFullscreenElement ||
                                  document.mozFullScreenElement ||
                                  document.msFullscreenElement);
                    if (isFS) {
                        fsActive = true;
                        btn.innerHTML = svgCompress();
                    } else {
                        fsActive = false;
                        btn.innerHTML = svgExpand();
                        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                            screen.orientation.unlock();
                        }
                        triggerResize();
                    }
                });
            });
    });
})();

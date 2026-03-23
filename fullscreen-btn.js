/* fullscreen-btn.js — Shared fullscreen/landscape button for all games */
(function () {
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    function isIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    if (!isMobile()) return;

    var ios = isIOS();

    document.addEventListener('DOMContentLoaded', function () {

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

            /* Auto-dismiss when device rotates to landscape */
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
            /* Fire multiple times to catch slow paint cycles */
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
            if (!req) {
                /* Browser doesn't support fullscreen (rare on Android) */
                triggerResize();
                return;
            }
            var p = req.call(el);
            if (p && typeof p.then === 'function') {
                p.then(function () {
                    onEnterFSDone();
                }).catch(function () {});
            } else {
                /* Non-Promise implementation — assume success */
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

        /* ── Click handler ── */
        btn.addEventListener('click', function () {
            if (ios) {
                var landscape = window.innerWidth > window.innerHeight;
                if (landscape) {
                    /* Already landscape — just recalculate layout */
                    triggerResize();
                } else {
                    /* Portrait on iOS — show rotate hint */
                    rotateHint.style.display = 'flex';
                }
                return;
            }
            /* Android / other */
            if (fsActive) { exitFS(); } else { enterFS(); }
        });

        /* ── Fullscreen change (Android) ── */
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

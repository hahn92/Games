/* fullscreen-btn.js — Shared fullscreen/landscape button for all games */
(function () {
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    if (!isMobile()) return;

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.createElement('button');
        btn.id = 'fullscreenBtn';
        btn.title = 'Pantalla completa';
        btn.setAttribute('aria-label', 'Pantalla completa');
        btn.style.cssText =
            'position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));right:16px;' +
            'z-index:2001;width:46px;height:46px;border-radius:50%;border:none;' +
            'background:rgba(30,30,30,0.88);color:#8fd3f4;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 2px 10px rgba(0,0,0,0.45);' +
            '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
            'touch-action:manipulation;';

        function iconExpand() {
            return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
                '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        }
        function iconCompress() {
            return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
                '<line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';
        }

        btn.innerHTML = iconExpand();
        document.body.appendChild(btn);

        var fsActive = false;

        function triggerResize() {
            setTimeout(function () {
                window.dispatchEvent(new Event('resize'));
                if (window.visualViewport) {
                    window.visualViewport.dispatchEvent(new Event('resize'));
                }
            }, 300);
        }

        function enterFS() {
            var el = document.documentElement;
            var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
            if (!req) return;
            req.call(el).then(function () {
                fsActive = true;
                btn.innerHTML = iconCompress();
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(function () {});
                }
                triggerResize();
            }).catch(function () {});
        }

        function exitFS() {
            var ex = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
            if (ex) ex.call(document);
        }

        btn.addEventListener('click', function () {
            if (fsActive) { exitFS(); } else { enterFS(); }
        });

        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach(function (ev) {
            document.addEventListener(ev, function () {
                var isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
                if (!isFS) {
                    fsActive = false;
                    btn.innerHTML = iconExpand();
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                    triggerResize();
                }
            });
        });
    });
})();

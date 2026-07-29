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
 *       stopPropagation: false // true = stopPropagation on the mobile start click
 *   });
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

        function adjustMobileLayout() {
            var gameSide       = document.getElementById('gameSide');
            var infoSide       = document.getElementById('infoSide');
            var mobileStartBtn = document.getElementById('mobileStartBtn');
            if (!gameSide) return;

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
                    if (mobileStartBtn && useStart) mobileStartBtn.style.display = 'block';
                    for (id in show) {
                        el = document.getElementById(id);
                        if (el) el.style.display = show[id];
                    }
                    if (cfg.onMobile) cfg.onMobile(gameSide, vHeight);
                }
                if (cfg.fit) cfg.fit(vHeight);
            } else {
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
            var btn      = document.getElementById('mobileStartBtn');
            var startBtn = document.getElementById('startBtn');
            if (!btn) return;
            btn.addEventListener('click', function (e) {
                if (cfg.stopPropagation) e.stopPropagation();
                if (startBtn) startBtn.click();
                btn.style.display = 'none';
            });
        });
    };
}());

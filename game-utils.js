/* game-utils.js — Shared toolkit for every game page.
 *
 *   <script src="../mobile-layout.js"></script>
 *   <script src="../audio.js"></script>
 *   <script src="../game-utils.js"></script>   <-- before main.js
 *   <script src="./main.js"></script>
 *   <script src="../fullscreen-btn.js"></script>
 *
 * Everything is exposed as a plain global (the games are classic scripts, no
 * modules) and also grouped under `GameUtils` for the ones with names generic
 * enough to collide. A game that declares its own `clamp`/`lerp`/`roundRect`
 * simply shadows the shared one with an equivalent implementation — that is
 * safe, but prefer deleting the local copy.
 */
(function (global) {
    'use strict';

    /* ═══════════════════════════════════════════════════════════
       Compatibility
    ═══════════════════════════════════════════════════════════ */

    /* ctx.roundRect() is Chrome 99+ / Firefox 112+ / Safari 16.4+. A dozen
     * games call it directly, which throws on older iOS Safari and takes the
     * whole render loop down. Polyfill it so those calls keep working. */
    if (typeof CanvasRenderingContext2D !== 'undefined' &&
        !CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            /* The spec accepts a number or an array of 1-4 radii. */
            var tl, tr, br, bl;
            if (r == null) r = 0;
            if (typeof r === 'number') {
                tl = tr = br = bl = r;
            } else {
                tl = r[0] || 0;
                tr = r.length > 1 ? r[1] : tl;
                br = r.length > 2 ? r[2] : tl;
                bl = r.length > 3 ? r[3] : tr;
            }
            var max = Math.min(Math.abs(w), Math.abs(h)) / 2;
            tl = Math.min(tl, max); tr = Math.min(tr, max);
            br = Math.min(br, max); bl = Math.min(bl, max);

            this.moveTo(x + tl, y);
            this.lineTo(x + w - tr, y);
            this.arcTo(x + w, y, x + w, y + tr, tr);
            this.lineTo(x + w, y + h - br);
            this.arcTo(x + w, y + h, x + w - br, y + h, br);
            this.lineTo(x + bl, y + h);
            this.arcTo(x, y + h, x, y + h - bl, bl);
            this.lineTo(x, y + tl);
            this.arcTo(x, y, x + tl, y, tl);
            this.closePath();
            return this;
        };
    }

    /* ═══════════════════════════════════════════════════════════
       HiDPI
    ═══════════════════════════════════════════════════════════ */

    /* Render canvases at the display's native pixel density.
     *
     * Every game sizes its canvas with width/height attributes and then uses
     * those same numbers as its coordinate system, so we cannot simply enlarge
     * the backing store — 34 games read `canvas.width` as game logic.
     *
     * Instead: the backing store grows by `dpr`, the context gets a permanent
     * scale(dpr) base transform, and `canvas.width`/`height` are shadowed with
     * instance accessors that keep reporting the LOGICAL size. Game code, hit
     * testing and pointerPos() all keep working in logical units and never
     * learn that any of this happened.
     *
     * Capped at 2×: beyond that the fill-rate cost outweighs the sharpness, and
     * several of these games are already fill-bound on a phone. */
    var HIDPI_MAX = 2;

    /* opts: a number (maxScale) or {maxScale, pinCss}.
     *
     * pinCss defaults to true and is what stops the page from rendering at
     * double size — but pass false when a stylesheet already sizes the canvas
     * (the catalog thumbnails use `width:100%; aspect-ratio:1/1`). Pinning
     * there would set an explicit height, which wins over an aspect ratio
     * nothing else constrains and squashes the element. */
    function upgradeCanvas(canvas, opts) {
        if (!canvas || canvas.__guHidpi) return 0;
        if (canvas.hasAttribute && canvas.hasAttribute('data-no-hidpi')) return 0;

        if (typeof opts === 'number' || opts == null) opts = { maxScale: opts };
        var maxScale = opts.maxScale;
        var pinCss = opts.pinCss !== false;

        var dpr = Math.min(global.devicePixelRatio || 1, maxScale || HIDPI_MAX);
        if (!(dpr > 1)) return 0;

        var proto = global.HTMLCanvasElement && global.HTMLCanvasElement.prototype;
        var dw = proto && Object.getOwnPropertyDescriptor(proto, 'width');
        var dh = proto && Object.getOwnPropertyDescriptor(proto, 'height');
        if (!dw || !dw.set || !dh || !dh.set) return 0;   /* exotic host — leave it alone */

        var logicalW = canvas.width, logicalH = canvas.height;
        if (!logicalW || !logicalH) return 0;

        canvas.__guHidpi = dpr;

        /* The CSS box must stay at the logical size or the page doubles.
         * Injected at the TOP of <head> at zero specificity, so a game's own
         * `canvas { max-width: 95vw; height: auto }` and the inline styles
         * mobile-layout.js writes both still win. */
        if (pinCss) pinCssSize(canvas, logicalW, logicalH);

        dw.set.call(canvas, Math.round(logicalW * dpr));
        dh.set.call(canvas, Math.round(logicalH * dpr));

        function shadow(name, get, set) {
            Object.defineProperty(canvas, name, {
                configurable: true, enumerable: true, get: get, set: set
            });
        }
        function resized() {
            if (pinCss) pinCssSize(canvas, logicalW, logicalH);
            rebase();
        }
        shadow('width',  function () { return logicalW; },
                         function (v) { logicalW = v; dw.set.call(canvas, Math.round(v * dpr)); resized(); });
        shadow('height', function () { return logicalH; },
                         function (v) { logicalH = v; dh.set.call(canvas, Math.round(v * dpr)); resized(); });

        var ctx2d = null;
        function rebase() {
            /* Resizing the backing store wipes all context state, transform
             * included — reinstall the base scale. */
            if (ctx2d) ctx2d.__guSetTransform(dpr, 0, 0, dpr, 0, 0);
        }

        var origGetContext = canvas.getContext;
        canvas.getContext = function (type) {
            var ctx = origGetContext.apply(canvas, arguments);
            if (!ctx || (type !== '2d' && type !== undefined) || ctx.__guDpr) return ctx;
            ctx.__guDpr = dpr;
            ctx2d = ctx;

            var origSet = ctx.setTransform;
            ctx.__guSetTransform = function (a, b, c, d, e, f) { origSet.call(ctx, a, b, c, d, e, f); };

            /* A game calling setTransform() means "replace the transform" — it
             * has no idea the DPR scale is underneath. Premultiply by scale(dpr)
             * so its matrix composes on top instead of erasing it.
             * (gemas and plinko both do this for screen shake.) */
            ctx.setTransform = function (a, b, c, d, e, f) {
                if (arguments.length === 0) { origSet.call(ctx, dpr, 0, 0, dpr, 0, 0); return; }
                if (typeof a === 'object' && a !== null) {   /* DOMMatrix form */
                    origSet.call(ctx, a.a * dpr, a.b * dpr, a.c * dpr, a.d * dpr, a.e * dpr, a.f * dpr);
                    return;
                }
                origSet.call(ctx, a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
            };
            ctx.resetTransform = function () { origSet.call(ctx, dpr, 0, 0, dpr, 0, 0); };

            origSet.call(ctx, dpr, 0, 0, dpr, 0, 0);
            return ctx;
        };

        return dpr;
    }

    var cssPin = null;
    var pinNodes = {};
    function pinCssSize(canvas, w, h) {
        if (!global.document || !global.document.head) return;
        if (!cssPin) {
            cssPin = global.document.createElement('style');
            cssPin.setAttribute('data-gu', 'hidpi');
            global.document.head.insertBefore(cssPin, global.document.head.firstChild);
        }
        var sel = canvas.id ? '#' + canvas.id : 'canvas';
        /* :where() keeps an id selector at zero specificity, so this never
         * outranks the game's own stylesheet. */
        var text = ':where(' + sel + '){width:' + w + 'px;height:' + h + 'px}\n';
        /* Rewrite in place. A game that resizes its canvas (snake does, from
         * its mobile `fit`) would otherwise be left pinned at the size it had
         * when it was upgraded, and the stale value wins over the intrinsic
         * one it expects. */
        if (pinNodes[sel]) { pinNodes[sel].nodeValue = text; return; }
        pinNodes[sel] = global.document.createTextNode(text);
        cssPin.appendChild(pinNodes[sel]);
    }

    /* Auto-upgrade only canvases whose size is declared in the markup. A canvas
     * with no width/height attribute is still at the 300x150 default, and its
     * real size arrives later from script (the catalog's thumbnails do this) —
     * upgrading it now would capture the wrong logical size. Those must call
     * upgradeCanvas() themselves, after they set width/height. */
    function upgradeAllCanvases(opts) {
        if (!global.document) return 0;
        var list = global.document.getElementsByTagName('canvas');
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (c.hasAttribute && !(c.hasAttribute('width') && c.hasAttribute('height'))) continue;
            if (upgradeCanvas(c, opts)) n++;
        }
        return n;
    }

    /* ═══════════════════════════════════════════════════════════
       Loop
    ═══════════════════════════════════════════════════════════ */

    /* rAF-based interval: same tick semantics as setInterval but synced to the
     * display. Use for fixed-tick game loops (snake, tetris, pong, ...).
     * Stop with rafClear(). */
    function rafInterval(fn, ms) {
        var handle = { id: 0, stop: false };
        var last = performance.now();
        function loop(ts) {
            if (handle.stop) return;
            handle.id = requestAnimationFrame(loop);
            if (ts - last >= ms) {
                last = ts - ((ts - last) % ms);
                fn();
            }
        }
        handle.id = requestAnimationFrame(loop);
        return handle;
    }

    function rafClear(handle) {
        if (handle) { handle.stop = true; cancelAnimationFrame(handle.id); }
    }

    /* Free-running rAF loop capped at ~60fps. `fn(dtSeconds, ts)` — dt is
     * clamped so a backgrounded tab does not resume with a huge time step
     * that tunnels moving bodies through walls. Stop with rafClear(). */
    function rafLoop(fn, minMs) {
        if (minMs == null) minMs = 15;
        var handle = { id: 0, stop: false };
        var last = performance.now();
        function loop(ts) {
            if (handle.stop) return;
            handle.id = requestAnimationFrame(loop);
            var elapsed = ts - last;
            if (elapsed < minMs) return;
            last = ts;
            fn(Math.min(elapsed, 100) / 1000, ts);
        }
        handle.id = requestAnimationFrame(loop);
        return handle;
    }

    /* ═══════════════════════════════════════════════════════════
       Math
    ═══════════════════════════════════════════════════════════ */

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
    function dist2(x1, y1, x2, y2) {
        var dx = x2 - x1, dy = y2 - y1;
        return dx * dx + dy * dy;
    }
    function rand(min, max) { return min + Math.random() * (max - min); }
    function randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    /* Fisher-Yates, in place. */
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }

    /* Shortest signed angular distance from a to b, in (-PI, PI]. */
    function angleDelta(a, b) {
        var d = (b - a) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
    function easeInQuad(t) { return t * t; }
    function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    /* Axis-aligned rectangle overlap. */
    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function circlesOverlap(x1, y1, r1, x2, y2, r2) {
        var r = r1 + r2;
        return dist2(x1, y1, x2, y2) < r * r;
    }

    /* ═══════════════════════════════════════════════════════════
       Color
    ═══════════════════════════════════════════════════════════ */

    function hexToRgb(hex) {
        var c = String(hex).replace('#', '');
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        var n = parseInt(c, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    /* Additive shade: positive `d` lightens, negative darkens. */
    function shade(hex, d) {
        var c = hexToRgb(hex);
        return 'rgb(' + clamp(c.r + d, 0, 255) + ',' +
                        clamp(c.g + d, 0, 255) + ',' +
                        clamp(c.b + d, 0, 255) + ')';
    }

    /* Multiplicative shade: f < 1 darkens, f > 1 lightens. */
    function scaleColor(hex, f) {
        var c = hexToRgb(hex);
        return 'rgb(' + clamp(Math.round(c.r * f), 0, 255) + ',' +
                        clamp(Math.round(c.g * f), 0, 255) + ',' +
                        clamp(Math.round(c.b * f), 0, 255) + ')';
    }

    /* Hex + alpha -> rgba() string. */
    function rgba(hex, a) {
        var c = hexToRgb(hex);
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }

    /* Blend two hex colors; t = 0 -> a, t = 1 -> b. */
    function mixColor(a, b, t) {
        var ca = hexToRgb(a), cb = hexToRgb(b);
        return 'rgb(' + Math.round(lerp(ca.r, cb.r, t)) + ',' +
                        Math.round(lerp(ca.g, cb.g, t)) + ',' +
                        Math.round(lerp(ca.b, cb.b, t)) + ')';
    }

    /* ═══════════════════════════════════════════════════════════
       Canvas
    ═══════════════════════════════════════════════════════════ */

    /* Map a mouse/touch event to canvas coordinate space.
     *
     * Every canvas game needs this and every one of them re-derived it, some
     * without the CSS-scale correction — which silently breaks aiming as soon
     * as mobile-layout.js resizes the canvas via style.width/height.
     * Handles `touches`, `changedTouches` and plain pointer/mouse events. */
    function pointerPos(canvas, e) {
        var r = canvas.getBoundingClientRect();
        var src = e;
        if (e.touches && e.touches.length) src = e.touches[0];
        else if (e.changedTouches && e.changedTouches.length) src = e.changedTouches[0];
        /* rect.width can be 0 on a display:none canvas — guard the divide. */
        var sx = r.width  ? canvas.width  / r.width  : 1;
        var sy = r.height ? canvas.height / r.height : 1;
        return {
            x: (src.clientX - r.left) * sx,
            y: (src.clientY - r.top)  * sy
        };
    }

    /* Make a non-<button> element operable from the keyboard: focusable,
     * announced as a button, and activated by Enter or Space.
     *
     * Several DOM games build their board out of plain <div>s with a click
     * listener, which leaves them playable with a mouse only — a WCAG 2.1.1
     * failure. This gives those cells what a real <button> would have given
     * them for free, without restructuring the markup. */
    function keyActivate(el, label) {
        if (!el || el.__guKeyed) return el;
        el.__guKeyed = true;
        if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (label) el.setAttribute('aria-label', label);
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
            e.preventDefault();   /* Space would scroll the page */
            el.click();
        });
        return el;
    }

    /* Announce the end-of-game popups.
     *
     * All 44 of them are plain divs shown by flipping `display`, with no role
     * and no focus change — so a screen reader never learns the game ended or
     * what the score was. Rather than edit 44 files, watch them here: when one
     * appears, it becomes a proper alert dialog and takes focus, which is what
     * makes assistive tech read it out.
     *
     * Runs automatically; games do not call it. */
    function wirePopups() {
        /* The rest of the toolkit degrades quietly on an exotic host; this
         * should too, instead of throwing and taking main.js down with it. */
        if (!global.document || !global.document.querySelectorAll ||
            !global.MutationObserver || !global.getComputedStyle) return;
        var popups = global.document.querySelectorAll('.popup');
        for (var i = 0; i < popups.length; i++) prepare(popups[i]);

        function prepare(p) {
            if (p.__guPopup) return;
            p.__guPopup = true;

            var heading = p.querySelector('h1,h2,h3');
            if (heading) {
                if (!heading.id) heading.id = 'gu-popup-title-' + i;
                p.setAttribute('aria-labelledby', heading.id);
            }
            p.setAttribute('role', 'alertdialog');
            p.setAttribute('aria-modal', 'true');

            var shown = visible(p);
            new global.MutationObserver(function () {
                var now = visible(p);
                if (now === shown) return;
                shown = now;
                if (!now) return;
                /* focus the action button so the dialog is both announced and
                 * immediately operable from the keyboard */
                var btn = p.querySelector('button,a[href],[tabindex]');
                if (btn) btn.focus();
                else { p.tabIndex = -1; p.focus(); }
            }).observe(p, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        function visible(el) {
            /* offsetParent is null for position:fixed elements, and every one
             * of these popups is fixed — use the computed display instead. */
            return global.getComputedStyle(el).display !== 'none';
        }
    }

    /* Roving tabindex over a grid of cells.
     *
     * keyActivate() alone puts every cell in the tab order, which is fine for
     * nine of them and miserable for the 480 of a hard minesweeper board. The
     * grid pattern instead keeps exactly ONE cell tabbable and moves between
     * cells with the arrow keys, so the whole board costs a single tab stop.
     *
     * The listener lives on the container, so it survives the cell rebuilds
     * these games do on every move; call this again after each render to
     * re-seat the tabbable cell. */
    function gridKeyboard(container, cols, cellSelector) {
        if (!container || !cols) return;
        var sel = cellSelector || '[role="button"],[role="gridcell"]';
        function cells() { return Array.prototype.slice.call(container.querySelectorAll(sel)); }

        function seat(list, idx) {
            for (var i = 0; i < list.length; i++) list[i].tabIndex = (i === idx ? 0 : -1);
        }

        var list = cells();
        if (!list.length) return;
        /* keep whatever cell already had focus, otherwise the first one */
        var active = list.indexOf(container.querySelector(sel + ':focus'));
        var remembered = container.__guGridIdx;
        if (active < 0 && remembered != null && remembered < list.length &&
            (document.activeElement === document.body || document.activeElement === null)) {
            /* These games rebuild their cells after every move, which destroys
             * the focused element and drops the user out of the board. If they
             * were on a cell and the rebuild is what took focus away, put them
             * back on the same square. */
            active = remembered;
            list[active].focus();
        }
        seat(list, active < 0 ? 0 : active);

        if (container.__guGrid) return;
        container.__guGrid = true;

        container.addEventListener('keydown', function (e) {
            var d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
            if (d === undefined) return;
            var list = cells();
            var i = list.indexOf(document.activeElement);
            if (i < 0) return;
            /* don't wrap around the row edges: sliding off the left of a row
             * onto the previous one reads as a bug, not navigation */
            if (Math.abs(d) === 1 && Math.floor((i + d) / cols) !== Math.floor(i / cols)) return;
            var next = i + d;
            if (next < 0 || next >= list.length) return;
            e.preventDefault();
            seat(list, next);
            list[next].focus();
        });

        container.addEventListener('focusin', function (e) {
            var list = cells();
            var i = list.indexOf(e.target);
            if (i >= 0) { container.__guGridIdx = i; seat(list, i); }
        });
    }

    /* Keyboard cursor over a canvas — the canvas counterpart of gridKeyboard().
     *
     * A pile of canvas games are pointer-only: the entire interaction is a
     * click handler that maps a pixel to a square, a tower or a button, so
     * nothing in them is reachable without a mouse (WCAG 2.1.1, level A).
     *
     * This deliberately knows NOTHING about the game's topology. The game
     * hands over a flat list of targets in canvas coordinates and the arrows
     * pick the nearest one in that direction geometrically, which covers an
     * 8x8 board, three Hanoi towers and a row of blackjack buttons with one
     * implementation. `targets()` is called fresh every time, so a game that
     * rebuilds its list every frame (blackjack) needs no extra bookkeeping.
     *
     * The game keeps doing its own drawing: read `cursor.target()` in the
     * render pass and outline whatever comes back. The cursor reports itself
     * hidden until the canvas is focused, so mouse players never see it.
     *
     * The canvas is made focusable rather than listening on document: these
     * games have no other keyboard handlers today, but stealing the arrows
     * globally would break the moment one grows a shortcut, and a real focus
     * stop is what lets a keyboard user reach the board in the first place. */
    function canvasCursor(canvas, opts) {
        if (!canvas || !opts || typeof opts.targets !== 'function') return null;

        /* `focused` and `keyed` are separate on purpose — this is the
         * :focus-visible rule, and getting it wrong makes the cursor invisible
         * while it is still moving. Hiding the ring on mousedown alone does not
         * work: clicking a canvas that ALREADY has focus fires no new focus
         * event, so the ring would never come back and the arrows would drive
         * something the player cannot see. */
        var idx = -1, lastId = null, focused = false, keyed = false, byPointer = false;

        function list()      { return opts.targets() || []; }
        function mid(t)      { return { x: t.x + (t.w || 0) / 2, y: t.y + (t.h || 0) / 2 }; }

        /* The list is rebuilt by the game, so an index alone goes stale.
         * Re-find the target by id; fall back to clamping the index.
         *
         * On a miss the remembered id is deliberately NOT overwritten. These
         * lists come and go — blackjack empties its button list entirely while
         * dealing and swaps it wholesale between phases — and a cursor that
         * forgot its target the moment it blinked out would land somewhere
         * arbitrary when it came back. The clamped index only decides where
         * the cursor sits meanwhile; `lastId` changes when the player moves. */
        function sync() {
            var l = list();
            if (!l.length) { idx = -1; return l; }
            if (lastId !== null) {
                for (var i = 0; i < l.length; i++) {
                    if (l[i].id === lastId) { idx = i; return l; }
                }
            }
            if (idx >= l.length) idx = l.length - 1;
            if (idx < 0) idx = 0;
            return l;
        }

        /* Not every game runs a render loop: several of these repaint only when
         * something changes, so moving the cursor has to say so or it simply
         * would not appear. onChange fires on focus, blur and every move. */
        function changed(t) { if (opts.onChange) opts.onChange(t || null); }

        function select(i, l) {
            idx = i; lastId = l[i].id;
            if (opts.onMove) opts.onMove(l[i]);
            changed(l[i]);
        }

        function step(dx, dy) {
            var l = sync();
            if (!l.length) return;
            if (idx < 0) { select(0, l); return; }

            var from = mid(l[idx]);
            var best = -1, bestScore = Infinity;
            for (var i = 0; i < l.length; i++) {
                if (i === idx) continue;
                var c = mid(l[i]);
                var along  = (c.x - from.x) * dx + (c.y - from.y) * dy;
                if (along <= 0.5) continue;                  /* behind us */
                var across = Math.abs((c.x - from.x) * dy - (c.y - from.y) * dx);
                /* weight sideways drift so a straight neighbour always wins
                 * over a closer diagonal one — otherwise a board reads as
                 * wandering rather than stepping */
                var score = along + across * 3;
                if (score < bestScore) { bestScore = score; best = i; }
            }
            if (best >= 0) select(best, l);
        }

        canvas.tabIndex = 0;
        if (!canvas.getAttribute('role')) canvas.setAttribute('role', 'application');
        if (opts.label && !canvas.getAttribute('aria-label')) {
            canvas.setAttribute('aria-label', opts.label);
        }

        canvas.addEventListener('focus', function () {
            focused = true;
            /* Arriving with Tab is keyboard use and should show the ring at
             * once; arriving via a click should not. mousedown runs first, so
             * that flag tells the two apart. */
            keyed = !byPointer;
            byPointer = false;
            var l = sync();
            if (idx < 0 && l.length) select(0, l);
            else changed(idx < 0 ? null : l[idx]);
        });
        canvas.addEventListener('blur', function () { focused = false; changed(null); });

        canvas.addEventListener('keydown', function (e) {
            var d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0],
                      ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
            var act = (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar');
            if (!d && !act) return;
            /* the first navigation key is what reveals the cursor */
            if (!keyed) { keyed = true; changed(null); }
            if (d) { e.preventDefault(); step(d[0], d[1]); return; }
            var l = sync();
            if (idx < 0 || !l.length) return;
            e.preventDefault();
            if (opts.activate) opts.activate(l[idx]);
        });

        /* Reaching for the mouse hides the ring, so the two input modes never
         * both claim to be "the" selection. Focus is left alone: the canvas may
         * legitimately keep it, and the next key press brings the ring back. */
        canvas.addEventListener('mousedown', function () {
            byPointer = true;
            if (keyed) { keyed = false; changed(null); }
        });

        function shown() { return focused && keyed && idx >= 0; }

        return {
            target:  function () { if (!focused || !keyed) return null; var l = sync(); return idx < 0 ? null : l[idx]; },
            visible: shown,
            set:     function (id) { lastId = id; sync(); },
            hide:    function () { keyed = false; }
        };
    }

    /* Trace a rounded rect on `ctx` (does not fill or stroke). Prefer
     * ctx.roundRect() directly — the polyfill above makes it universally
     * available; this stays for games whose helper took the ctx explicitly. */
    function roundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return ctx;
    }

    /* Memoise gradients by an arbitrary key.
     *
     * createLinearGradient/createRadialGradient allocate and are among the more
     * expensive 2D calls; games that rebuild the same gradient every frame pay
     * for it every frame. Build once, look up thereafter:
     *
     *   var grad = GU.gradientMemo();
     *   ctx.fillStyle = grad('sky:' + themeIndex, function () {
     *       var g = ctx.createLinearGradient(0, 0, 0, H);
     *       g.addColorStop(0, th.s0); g.addColorStop(1, th.s2);
     *       return g;
     *   });
     *
     * The key must cover everything the gradient depends on — geometry AND
     * colour stops. For per-object gradients that differ only by position,
     * build the gradient at the origin and ctx.translate() to the object
     * instead of keying on x/y, or the cache grows without bound.
     * `.clear()` after a resize, since gradients are tied to their geometry. */
    function gradientMemo() {
        var map = {};
        function memo(key, build) {
            var g = map[key];
            if (g === undefined) { g = map[key] = build(); }
            return g;
        }
        memo.clear = function () { map = {}; };
        return memo;
    }

    /* ═══════════════════════════════════════════════════════════
       Storage
    ═══════════════════════════════════════════════════════════ */

    /* localStorage throws — not returns null — when site data is blocked
     * (Safari "Block All Cookies", sandboxed iframes, some enterprise
     * policies). Games read their high score at module top level, so an
     * unguarded access takes the entire game down before it renders.
     * Every accessor here degrades to an in-memory map instead. */
    var memStore = {};
    var storageOk = (function () {
        try {
            var k = '__gu__';
            global.localStorage.setItem(k, '1');
            global.localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    }());

    var Store = {
        available: storageOk,

        get: function (key, fallback) {
            if (!storageOk) return key in memStore ? memStore[key] : (fallback == null ? null : fallback);
            try {
                var v = global.localStorage.getItem(key);
                return v == null ? (fallback == null ? null : fallback) : v;
            } catch (e) {
                return fallback == null ? null : fallback;
            }
        },

        set: function (key, value) {
            memStore[key] = String(value);
            if (!storageOk) return false;
            try {
                global.localStorage.setItem(key, String(value));
                return true;
            } catch (e) {
                /* Quota exceeded — keep the in-memory copy for this session. */
                return false;
            }
        },

        remove: function (key) {
            delete memStore[key];
            if (!storageOk) return;
            try { global.localStorage.removeItem(key); } catch (e) {}
        },

        /* Integer accessor — the shape 32 of the games needed. */
        getNum: function (key, fallback) {
            var n = parseFloat(Store.get(key, ''));
            return isNaN(n) ? (fallback || 0) : n;
        },

        setNum: function (key, value) { return Store.set(key, value); },

        getJSON: function (key, fallback) {
            var raw = Store.get(key, null);
            if (raw == null) return fallback;
            try {
                var v = JSON.parse(raw);
                return v == null ? fallback : v;
            } catch (e) {
                return fallback;
            }
        },

        setJSON: function (key, value) {
            try {
                return Store.set(key, JSON.stringify(value));
            } catch (e) {
                return false;
            }
        }
    };

    /* ═══════════════════════════════════════════════════════════
       Particles
    ═══════════════════════════════════════════════════════════ */

    /* A pooled particle system. Every canvas game grew its own copy of
     * "push {x,y,vx,vy,life,col}, decay it, draw a circle"; this is that loop
     * with the allocations removed — dead particles are reused instead of
     * being spliced out of the array each frame.
     *
     *   var fx = new Particles(300);
     *   fx.burst(x, y, 20, { color: '#ff512f', speed: [1, 4], gravity: 0.15 });
     *   fx.update();  fx.draw(ctx);
     */
    /* opts: { semiImplicit }
     *
     * The games split cleanly in two on integration order. The per-frame loops
     * move first and then apply gravity/drag (explicit Euler) — that is the
     * default. The delta-time loops apply gravity/drag first and then move
     * (semi-implicit). The difference is a few pixels over a particle's life,
     * which is enough to change how an effect reads, so a pool follows whichever
     * convention the game it replaced used. */
    function Particles(max, opts) {
        this.max = max || 200;
        this.pool = [];
        this.count = 0;
        this.semiImplicit = !!(opts && opts.semiImplicit);
    }

    Particles.prototype._acquire = function () {
        /* Reuse the first dead slot; grow only until `max`. */
        for (var i = 0; i < this.pool.length; i++) {
            if (this.pool[i].life <= 0) return this.pool[i];
        }
        if (this.pool.length >= this.max) return null;
        var p = {};
        this.pool.push(p);
        return p;
    };

    /* Add one particle with an explicit velocity.
     *
     * `burst` picks the angle and speed for you; `add` is for callers that
     * already computed them (an upward bias, a jittered origin, a directional
     * spray). opts: {life, size, color, gravity, drag, shape}.
     *
     * `life` is in SECONDS. Migrating a per-frame `life: 1, decay: d` loop:
     * life = 1 / (d * 60), which reproduces both the lifetime and the linear
     * alpha ramp exactly at 60fps.
     *
     * Returns false when the pool is full — the particle is dropped, which is
     * what a capped effect should do rather than growing without bound. */
    Particles.prototype.add = function (x, y, vx, vy, opts) {
        var p = this._acquire();
        if (!p) return false;
        opts = opts || {};
        p.x = x; p.y = y; p.vx = vx; p.vy = vy;
        p.life = p.life0 = opts.life == null ? 1 : opts.life;
        p.r = opts.size == null ? 2 : opts.size;
        p.col = opts.color || '#fff';
        p.grav = opts.gravity || 0;
        setDrag(p, opts.drag);
        p.square = opts.shape === 'square';
        p.alpha = opts.alpha == null ? 1 : opts.alpha;
        return true;
    };

    /* drag: a number for both axes, or [x, y] — several games damp only the
     * horizontal component so the spray still falls at full speed. */
    function setDrag(p, drag) {
        if (drag == null) { p.dragX = p.dragY = 1; return; }
        if (typeof drag === 'number') { p.dragX = p.dragY = drag; return; }
        p.dragX = drag[0] == null ? 1 : drag[0];
        p.dragY = drag[1] == null ? 1 : drag[1];
    }

    /* opts: color | colors[], speed [min,max], size [min,max], life [min,max],
     *       gravity, drag (number or [x, y]), spread (radians), angle (radians),
     *       shape 'circle'|'square', alpha (peak opacity, default 1) */
    Particles.prototype.burst = function (x, y, n, opts) {
        opts = opts || {};
        var colors = opts.colors || [opts.color || '#8fd3f4'];
        var speed  = opts.speed  || [1, 4];
        var size   = opts.size   || [1.5, 3.5];
        var life   = opts.life   || [0.5, 1];
        var base   = opts.angle == null ? 0 : opts.angle;
        var spread = opts.spread == null ? Math.PI * 2 : opts.spread;

        for (var i = 0; i < n; i++) {
            var p = this._acquire();
            if (!p) return;
            var a  = base + (Math.random() - 0.5) * spread;
            var sp = rand(speed[0], speed[1]);
            p.x = x; p.y = y;
            p.vx = Math.cos(a) * sp;
            p.vy = Math.sin(a) * sp;
            p.life = p.life0 = rand(life[0], life[1]);
            p.r = rand(size[0], size[1]);
            p.col = colors.length === 1 ? colors[0] : pick(colors);
            p.grav = opts.gravity || 0;
            setDrag(p, opts.drag);
            p.square = opts.shape === 'square';
            p.alpha = opts.alpha == null ? 1 : opts.alpha;
        }
    };

    Particles.prototype.update = function (dt) {
        if (dt == null) dt = 1 / 60;
        var step = dt * 60; /* keep the tuning in per-frame units */
        var semi = this.semiImplicit;
        this.count = 0;
        for (var i = 0; i < this.pool.length; i++) {
            var p = this.pool[i];
            if (p.life <= 0) continue;
            p.life -= dt;
            if (semi) {
                /* accelerate, then move */
                p.vy += p.grav * step;
                if (p.dragX !== 1) p.vx *= p.dragX;
                if (p.dragY !== 1) p.vy *= p.dragY;
                p.x += p.vx * step;
                p.y += p.vy * step;
            } else {
                /* move, then accelerate */
                p.x += p.vx * step;
                p.y += p.vy * step;
                p.vy += p.grav * step;
                if (p.dragX !== 1) p.vx *= p.dragX;
                if (p.dragY !== 1) p.vy *= p.dragY;
            }
            this.count++;
        }
    };

    Particles.prototype.draw = function (ctx) {
        if (!this.count) return;
        var prevAlpha = ctx.globalAlpha;
        var lastCol = null;
        /* No save/restore and no per-particle fillStyle churn — the pool is
         * drawn in insertion order, so runs of the same color are common. */
        for (var i = 0; i < this.pool.length; i++) {
            var p = this.pool[i];
            if (p.life <= 0) continue;
            if (p.col !== lastCol) { ctx.fillStyle = p.col; lastCol = p.col; }
            ctx.globalAlpha = prevAlpha * p.alpha * clamp(p.life / p.life0, 0, 1);
            if (p.square) {
                ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = prevAlpha;
    };

    /* Visit every live particle. For effects that have to be nudged from the
     * outside — a camera scroll shifting the whole spray, say. */
    Particles.prototype.each = function (fn) {
        for (var i = 0; i < this.pool.length; i++) {
            if (this.pool[i].life > 0) fn(this.pool[i]);
        }
    };

    Particles.prototype.clear = function () {
        for (var i = 0; i < this.pool.length; i++) this.pool[i].life = 0;
        this.count = 0;
    };

    /* ═══════════════════════════════════════════════════════════
       Shake
    ═══════════════════════════════════════════════════════════ */

    /* Screen shake, with the random offsets picked in update() rather than in
     * the render pass.
     *
     * Eleven games grew their own version of this and three of them
     * (batallanaval, misiles, sopaletras) call Math.random() from inside draw(),
     * which the performance rules forbid for a reason: it makes a frame
     * non-reproducible, so the same frame drawn twice — as happens on a resize
     * repaint — jitters. Here the offsets are state, computed once per tick.
     *
     *   var shake = new Shake();
     *   shake.hit(14);                  // on impact
     *   shake.update(dt);               // in the tick
     *   ctx.save(); shake.translate(ctx); ...draw...; ctx.restore();
     *
     * `hit` takes the MAX rather than adding: a small knock landing during a big
     * one must not be able to cut the big one short, and repeated small hits
     * should not sum into a screen-destroying convulsion.
     *
     * opts: {decay} retained fraction per 1/60s (default 0.88, ~0.2s tail),
     *       {ratio} vertical amplitude relative to horizontal (default 1),
     *       {max} clamp on the magnitude. */
    function Shake(opts) {
        opts = opts || {};
        this.decay = opts.decay == null ? 0.88 : opts.decay;
        this.ratio = opts.ratio == null ? 1 : opts.ratio;
        this.max   = opts.max   == null ? Infinity : opts.max;
        this.mag = 0;
        this.ox = 0;
        this.oy = 0;
    }

    Shake.prototype.hit = function (mag) {
        if (mag > this.mag) this.mag = mag > this.max ? this.max : mag;
        return this;
    };

    /* dt in seconds, matching rafLoop(). Games on a fixed tick can call it with
     * no argument and get one frame's worth of decay. */
    Shake.prototype.update = function (dt) {
        if (dt == null) dt = 1 / 60;
        if (this.mag <= 0) { this.ox = this.oy = 0; return; }
        this.mag *= Math.pow(this.decay, dt * 60);
        /* Cut the tail rather than letting it ring on at sub-pixel amplitude
         * forever — an offset below a tenth of a pixel is invisible but still
         * costs a transform every frame. */
        if (this.mag < 0.1) { this.mag = 0; this.ox = this.oy = 0; return; }
        this.ox = (Math.random() - 0.5) * this.mag;
        this.oy = (Math.random() - 0.5) * this.mag * this.ratio;
    };

    /* Compose onto whatever transform is current. Pairs with save/restore. */
    Shake.prototype.translate = function (ctx) {
        if (this.mag > 0) ctx.translate(this.ox, this.oy);
        return ctx;
    };

    Shake.prototype.active = function () { return this.mag > 0; };

    Shake.prototype.stop = function () { this.mag = this.ox = this.oy = 0; };

    /* ═══════════════════════════════════════════════════════════
       Input
    ═══════════════════════════════════════════════════════════ */

    /* Directional swipe + tap recognition.
     *
     * Nine games rolled this by hand and they disagree on every parameter that
     * matters: the distance threshold, whether a slow drag still counts, which
     * element listens, and whether the gesture resolves on touchend or as soon
     * as it crosses the threshold. The differences are not deliberate — they
     * are just what each one happened to be written with.
     *
     *   GU.swipe(canvas, {
     *       onSwipe: function (dir) { move(dir); },   // 'left'|'right'|'up'|'down'
     *       onTap:   function (pos) { jump(); }       // pos in canvas space
     *   });
     *
     * opts: {minDist: 30}     px before a drag counts as a swipe
     *       {maxTime: 600}    ms; 0 disables the limit
     *       {tapSlop: 10}     px of movement a tap may still have
     *       {live: false}     fire as soon as the threshold is crossed rather
     *                         than on touchend — once per gesture. Games that
     *                         steer continuously (snake, tetris) want this;
     *                         games that take one move per gesture do not.
     *       {mouse: false}    also recognise mouse drags, for desktop testing
     *       {preventDefault}  true to swallow the browser's own scroll/zoom.
     *                         Registers non-passive, which is the only way that
     *                         works on iOS.
     *
     * `pos` handed to onTap is in canvas space when the target is a canvas, and
     * client space otherwise — the same thing pointerPos() would have returned,
     * so a game can route a tap straight into its existing click handler.
     *
     * Returns {destroy} — needed by anything that rebuilds its board. */
    function swipe(el, opts) {
        if (!el || !opts) return { destroy: function () {} };
        var minDist = opts.minDist == null ? 30 : opts.minDist;
        var maxTime = opts.maxTime == null ? 600 : opts.maxTime;
        var tapSlop = opts.tapSlop == null ? 10 : opts.tapSlop;
        var live    = !!opts.live;
        var prevent = !!opts.preventDefault;
        var isCanvas = el.tagName === 'CANVAS';

        var sx = 0, sy = 0, st = 0, tracking = false, fired = false;
        var listenOpts = prevent ? { passive: false } : { passive: true };

        function at(e) {
            var s = e;
            if (e.touches && e.touches.length) s = e.touches[0];
            else if (e.changedTouches && e.changedTouches.length) s = e.changedTouches[0];
            return { x: s.clientX, y: s.clientY };
        }

        function dirOf(dx, dy) {
            if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
            return dy > 0 ? 'down' : 'up';
        }

        function start(e) {
            var p = at(e);
            sx = p.x; sy = p.y; st = performance.now();
            tracking = true; fired = false;
            if (prevent) e.preventDefault();
        }

        function move(e) {
            if (!tracking || !live || fired) { if (prevent) e.preventDefault(); return; }
            var p = at(e);
            var dx = p.x - sx, dy = p.y - sy;
            if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) {
                if (prevent) e.preventDefault();
                return;
            }
            fired = true;
            if (opts.onSwipe) opts.onSwipe(dirOf(dx, dy), { dx: dx, dy: dy, dt: performance.now() - st });
            if (prevent) e.preventDefault();
        }

        function end(e) {
            if (!tracking) return;
            tracking = false;
            var p = at(e);
            var dx = p.x - sx, dy = p.y - sy, dt = performance.now() - st;
            if (prevent) e.preventDefault();
            if (fired) return;                       /* live mode already handled it */

            if (Math.abs(dx) < tapSlop && Math.abs(dy) < tapSlop) {
                if (opts.onTap) {
                    opts.onTap(isCanvas ? pointerPos(el, e) : { x: p.x, y: p.y }, e);
                }
                return;
            }
            if (maxTime && dt > maxTime) return;     /* a slow drag is not a flick */
            if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;
            if (opts.onSwipe) opts.onSwipe(dirOf(dx, dy), { dx: dx, dy: dy, dt: dt });
        }

        function cancel() { tracking = false; }

        el.addEventListener('touchstart', start, listenOpts);
        el.addEventListener('touchmove',  move,  listenOpts);
        el.addEventListener('touchend',   end,   listenOpts);
        el.addEventListener('touchcancel', cancel, { passive: true });
        if (opts.mouse) {
            el.addEventListener('mousedown', start);
            el.addEventListener('mousemove', move);
            el.addEventListener('mouseup',   end);
            el.addEventListener('mouseleave', cancel);
        }

        return {
            destroy: function () {
                el.removeEventListener('touchstart', start, listenOpts);
                el.removeEventListener('touchmove',  move,  listenOpts);
                el.removeEventListener('touchend',   end,   listenOpts);
                el.removeEventListener('touchcancel', cancel);
                if (opts.mouse) {
                    el.removeEventListener('mousedown', start);
                    el.removeEventListener('mousemove', move);
                    el.removeEventListener('mouseup',   end);
                    el.removeEventListener('mouseleave', cancel);
                }
            }
        };
    }

    /* Held-key state, by action name rather than by key code.
     *
     *   var keys = GU.keys({
     *       left:  ['ArrowLeft',  'a', 'A'],
     *       right: ['ArrowRight', 'd', 'D'],
     *       fire:  [' ']
     *   }, { preventDefault: true, onPress: function (a) { if (a === 'fire') shoot(); } });
     *
     *   if (keys.down('left')) x -= speed;
     *
     * Two things this fixes that most of the hand-rolled maps get wrong:
     *
     * - **The stuck key.** A keydown with no matching keyup — alt-tab, a
     *   focus-stealing overlay, the iOS keyboard closing — leaves the action
     *   held forever, and the player comes back to a ship drifting into a wall.
     *   Everything is released on window blur and on visibilitychange.
     * - **Scroll and space.** Arrows scroll the page and Space activates the
     *   focused button; `preventDefault: true` stops that for the bound keys
     *   ONLY, so a game that also has real <button>s keeps them operable.
     *
     * Matching is case-insensitive on single characters, so binding 'a' catches
     * a shift-held 'A' without listing both.
     *
     * `pressed(action)` is the edge: true once per physical press, and cleared
     * by flush(). A fixed-tick game calls flush() at the end of its tick. If you
     * would rather not track that, use the onPress callback instead — it fires
     * on the same edge and needs no bookkeeping. */
    function keys(bindings, opts) {
        opts = opts || {};
        var target = opts.target || global;
        var prevent = opts.preventDefault;

        var byKey = {};                 /* normalised key -> [action, ...] */
        var held = {}, edge = {};

        function norm(k) { return k.length === 1 ? k.toLowerCase() : k; }

        for (var action in bindings) {
            if (!Object.prototype.hasOwnProperty.call(bindings, action)) continue;
            var list = bindings[action];
            if (typeof list === 'string') list = [list];
            for (var i = 0; i < list.length; i++) {
                var k = norm(list[i]);
                (byKey[k] || (byKey[k] = [])).push(action);
            }
            held[action] = false;
            edge[action] = false;
        }

        function actionsFor(e) {
            /* e.key is the primary match; e.code covers 'Space'/'KeyA' style
             * bindings and keeps working on a layout where e.key differs. */
            return byKey[norm(e.key)] || byKey[e.code] || null;
        }

        function onDown(e) {
            var acts = actionsFor(e);
            if (!acts) return;
            if (prevent) e.preventDefault();
            for (var i = 0; i < acts.length; i++) {
                var a = acts[i];
                /* e.repeat would otherwise re-fire the edge at the OS key-repeat
                 * rate, which turns one keypress into a burst of shots. */
                if (held[a] || e.repeat) continue;
                held[a] = true;
                edge[a] = true;
                if (opts.onPress) opts.onPress(a, e);
            }
        }

        function onUp(e) {
            var acts = actionsFor(e);
            if (!acts) return;
            if (prevent) e.preventDefault();
            for (var i = 0; i < acts.length; i++) {
                if (!held[acts[i]]) continue;
                held[acts[i]] = false;
                if (opts.onRelease) opts.onRelease(acts[i], e);
            }
        }

        function releaseAll() {
            for (var a in held) {
                if (!held[a]) continue;
                held[a] = false;
                if (opts.onRelease) opts.onRelease(a, null);
            }
        }

        target.addEventListener('keydown', onDown, prevent ? { passive: false } : undefined);
        target.addEventListener('keyup', onUp, prevent ? { passive: false } : undefined);
        global.addEventListener('blur', releaseAll);
        if (global.document) {
            global.document.addEventListener('visibilitychange', function () {
                if (global.document.hidden) releaseAll();
            });
        }

        return {
            down:    function (a) { return !!held[a]; },
            pressed: function (a) { return !!edge[a]; },
            /* Fija una acción a mano, sin que venga de una tecla.
             *
             * Es para el control táctil: en móvil no hay teclado, y un juego de
             * mantener pulsado —empujar el motor, girar— necesita decir "esta
             * acción está activa mientras el dedo siga en esta zona". Sin esto
             * cada juego acaba con dos fuentes de verdad, el mapa de teclas y un
             * objeto de toques aparte, y la lógica tiene que consultar las dos.
             *
             * Dispara onPress/onRelease igual que una tecla, incluido el filtro
             * de no repetir el flanco si ya estaba pulsada. */
            set: function (a, isDown) {
                if (!(a in held)) return;
                isDown = !!isDown;
                if (held[a] === isDown) return;
                held[a] = isDown;
                if (isDown) {
                    edge[a] = true;
                    if (opts.onPress) opts.onPress(a, null);
                } else if (opts.onRelease) {
                    opts.onRelease(a, null);
                }
            },
            flush:   function () { for (var a in edge) edge[a] = false; },
            clear:   function () { releaseAll(); for (var b in edge) edge[b] = false; },
            destroy: function () {
                target.removeEventListener('keydown', onDown);
                target.removeEventListener('keyup', onUp);
                global.removeEventListener('blur', releaseAll);
            }
        };
    }

    /* ═══════════════════════════════════════════════════════════
       HUD, popups and records
    ═══════════════════════════════════════════════════════════ */

    function el(ref) {
        if (!ref) return null;
        if (typeof ref !== 'string') return ref;
        return global.document ? global.document.getElementById(ref) : null;
    }

    /* Keep the side panel and the mobile overlay showing the same numbers.
     *
     * Forty-seven games write their score twice — once into the desktop panel
     * and once into #mobileScore — and eighteen of them do it from a function
     * called every frame. Writing textContent invalidates layout even when the
     * string is identical, so a game whose score changes once a second was
     * paying for 60 layout invalidations a second to say the same thing.
     * Everything here is dirty-checked: unchanged values do not touch the DOM.
     *
     *   var hud = GU.hud({
     *       score: 'score',                 // -> #score
     *       best:  'highScore',
     *       mobile: {
     *           el: 'mobileScore',
     *           html: function (v) { return 'Puntaje: <b>' + v.score + '</b>'; }
     *       }
     *   });
     *   hud.set({ score: 0, best: 12 });
     *   hud.add('score', 10);
     *
     * A field can be an id, an element, or {el, format} when the panel wants
     * more than the bare number.
     *
     * Un campo puede valer `null`: se sigue su valor pero no se pinta en ningún
     * sitio. No hace falta para que la línea de móvil se entere de un cambio —de
     * eso se encarga el recálculo en cada set(), ver más abajo—; sirve para dejar
     * escrito de qué depende esa línea y para poder leerlo con .get(). */
    function hud(spec) {
        var fields = {}, values = {}, mobile = null, lastMobile = null;

        for (var name in spec) {
            if (!Object.prototype.hasOwnProperty.call(spec, name)) continue;
            if (name === 'mobile') { mobile = spec.mobile; continue; }
            var f = spec[name];
            if (f == null) fields[name] = { el: null };
            else fields[name] = (typeof f === 'string' || f.tagName) ? { el: f } : f;
            values[name] = undefined;
        }
        if (mobile && (typeof mobile === 'string' || mobile.tagName)) mobile = { el: mobile };

        function paint(name) {
            var f = fields[name];
            if (!f) return;
            var node = el(f.el);
            if (!node) return;
            var text = f.format ? f.format(values[name], values) : String(values[name]);
            if (node.textContent !== text) node.textContent = text;
        }

        function paintMobile() {
            if (!mobile) return;
            var node = el(mobile.el);
            if (!node) return;
            if (mobile.html) {
                var html = mobile.html(values);
                if (html === lastMobile) return;
                lastMobile = html;
                node.innerHTML = html;
            } else {
                var text = mobile.format ? mobile.format(values) : String(values[Object.keys(values)[0]]);
                if (text === lastMobile) return;
                lastMobile = text;
                node.textContent = text;
            }
        }

        var api = {
            set: function (patch) {
                for (var name in patch) {
                    if (!Object.prototype.hasOwnProperty.call(patch, name)) continue;
                    if (values[name] === patch[name]) continue;
                    values[name] = patch[name];
                    paint(name);
                }
                /* La línea de móvil se recalcula SIEMPRE, haya cambiado o no un
                 * campo, y se filtra comparando el texto que produce.
                 *
                 * Es a propósito. Casi todas las líneas de móvil enseñan algo
                 * que el panel de escritorio no tiene —las vidas, el combo, el
                 * reloj— y su callback lo lee por cierre de las variables del
                 * juego. Si sólo se repintara al ensuciarse un campo, cada juego
                 * tendría que acordarse de declarar todas esas variables, y
                 * olvidar una deja la línea congelada sin dar ningún síntoma en
                 * consola. Construir la cadena es concatenar; lo caro es tocar
                 * el DOM, y eso lo sigue evitando la comparación. */
                paintMobile();
                return api;
            },
            add: function (name, delta) {
                var patch = {};
                patch[name] = (values[name] || 0) + delta;
                return api.set(patch);
            },
            get: function (name) { return values[name]; },
            /* Repaint everything unconditionally — after a layout switch has
             * replaced the nodes the cached values were written into. */
            refresh: function () {
                lastMobile = null;
                for (var name in fields) paint(name);
                paintMobile();
                return api;
            }
        };
        return api;
    }

    /* The end-of-game overlay, which every game toggles by hand.
     *
     *   var over = GU.popup('gameOverPopup');
     *   over.show({ finalScore: 'Puntaje: ' + score });   // ids -> textContent
     *   over.hide();
     *
     * wirePopups() above already handles announcing these; this is only the
     * show/hide half. `display` defaults to 'flex', which is what every .popup
     * in the set uses. */
    function popup(ref, opts) {
        opts = opts || {};
        var display = opts.display || 'flex';
        var api = {
            el: function () { return el(ref); },
            show: function (fields) {
                var node = el(ref);
                if (!node) return api;
                if (fields) {
                    for (var id in fields) {
                        if (!Object.prototype.hasOwnProperty.call(fields, id)) continue;
                        var f = el(id);
                        if (f) f.textContent = fields[id];
                    }
                }
                node.style.display = display;
                return api;
            },
            hide: function () {
                var node = el(ref);
                if (node) node.style.display = 'none';
                return api;
            },
            visible: function () {
                var node = el(ref);
                if (!node) return false;
                /* Prefer the computed value, as wirePopups() does. The inline
                 * style is empty until show() runs, and these popups are hidden
                 * from the stylesheet — reading the inline style alone would
                 * report a never-shown popup as visible. */
                if (global.getComputedStyle) {
                    return global.getComputedStyle(node).display !== 'none';
                }
                return !!node.style.display && node.style.display !== 'none';
            }
        };
        return api;
    }

    /* Los tres botones de una página de juego: Iniciar, Reiniciar y el "Jugar de
     * nuevo" del popup final.
     *
     * Cuarenta y nueve juegos traían este bloque copiado, idéntico salvo el
     * nombre de la función que llaman:
     *
     *   document.getElementById('startBtn').addEventListener('click', function () {
     *       GameAudio.click(); startGame();
     *   });
     *   document.getElementById('restartBtn').addEventListener('click', ...);
     *   document.getElementById('playAgainBtn').addEventListener('click', function () {
     *       GameAudio.click();
     *       document.getElementById('gameOverPopup').style.display = 'none';
     *       startGame();
     *   });
     *
     * y, repartido por startGame/gameOver, el vaivén de `disabled` entre los dos
     * primeros. Aquí queda:
     *
     *   var ctl = GU.controls({ start: startGame, restart: restartGame,
     *                           popup: 'gameOverPopup' });
     *   ctl.running();   // en startGame: Iniciar apagado, Reiniciar encendido
     *   ctl.idle();      // en gameOver:  al revés
     *
     * Detalles que arrastra por ti:
     *
     * - `GameAudio.click()` en los tres, que es lo que pide docs/audio.md. Se
     *   emite ANTES del handler: si el handler abre un popup o cambia de pantalla,
     *   el sonido ya salió.
     * - `playAgain` esconde el popup antes de llamar al handler. Hacerlo después
     *   deja un frame con el overlay encima del tablero ya reiniciado.
     * - `restart` cae en `start` y `playAgain` en `restart` cuando no se declaran,
     *   que es lo que hacía la mayoría a mano.
     * - Un botón que no está en el markup se ignora sin ruido: hangman no tiene
     *   popup, chess no tiene ninguno de los tres.
     *
     * opts: {sound: false} para el juego que quiera otro sonido en un botón. */
    function controls(spec) {
        spec = spec || {};
        var sound = spec.sound !== false;
        var over = spec.popup ? popup(spec.popup) : null;

        function fire(handler, hidePopup) {
            if (sound && global.GameAudio && global.GameAudio.click) global.GameAudio.click();
            if (hidePopup && over) over.hide();
            handler();
        }

        function wire(id, handler, hidePopup) {
            if (!handler) return null;
            var node = el(id);
            if (!node) return null;
            node.addEventListener('click', function () { fire(handler, hidePopup); });
            return node;
        }

        /* El botón del popup se cablea POR DELEGACIÓN en el propio popup, no
         * sobre el botón.
         *
         * Varios juegos reescriben el innerHTML del contenido del popup al
         * terminar la partida para rehacer el marcador final — typingspeed es
         * el caso claro — y eso se lleva por delante el botón. Un listener
         * puesto al cargar queda entonces apuntando a un nodo que ya no está en
         * el documento, y "Jugar de nuevo" deja de responder a partir de la
         * segunda partida. El popup, en cambio, no se sustituye nunca.
         *
         * Si el juego no declara popup no hay dónde delegar y se cae al
         * cableado directo, que para un botón que nadie recrea vale igual. */
        function wirePlayAgain(id, handler) {
            if (!handler) return;
            var host = over && over.el();
            var node = el(id);
            /* Sin popup no hay dónde delegar. Y si el botón existe pero cuelga
             * de otro sitio —hangman lo tiene en un panel de resultado, no en
             * un overlay— la delegación no lo vería nunca: ahí se cablea
             * directo, o el botón quedaría mudo sin decir nada. */
            if (!host || (node && !host.contains(node))) { wire(id, handler, true); return; }
            host.addEventListener('click', function (e) {
                var t = e.target;
                if (!t || !t.closest) return;
                var btn = t.closest('#' + id);
                if (!btn || !host.contains(btn)) return;
                fire(handler, true);
            });
        }

        var startFn     = spec.start;
        var restartFn   = spec.restart   || startFn;
        var playAgainFn = spec.playAgain || restartFn;

        var startBtn   = wire(spec.startId   || 'startBtn',   startFn,   false);
        var restartBtn = wire(spec.restartId || 'restartBtn', restartFn, false);
        wirePlayAgain(spec.playAgainId || 'playAgainBtn', playAgainFn);

        function setDisabled(node, v) { if (node) node.disabled = v; }

        var api = {
            popup: over,
            /* La partida está en marcha. */
            running: function () {
                setDisabled(startBtn, true);
                setDisabled(restartBtn, false);
                return api;
            },
            /* No hay partida: se puede iniciar, no se puede reiniciar. */
            idle: function () {
                setDisabled(startBtn, false);
                setDisabled(restartBtn, true);
                return api;
            }
        };
        return api;
    }

    /* Un botón que aparece MÁS DE UNA VEZ en la página.
     *
     * chess, damas, reversi y hanoi repiten sus controles en dos sitios —el
     * panel lateral de escritorio y la tira de encima del tablero en móvil—, así
     * que no pueden llevar id: un id tiene que ser único. Van por clase, y los
     * cuatro escribían el mismo bucle:
     *
     *   document.querySelectorAll('.btn-new').forEach(function (b) {
     *       b.addEventListener('click', function () { GameAudio.click(); newGame(); });
     *   });
     *
     * Aquí:
     *
     *   GU.buttons('.btn-new', newGame);
     *
     * Igual que controls(), el clic suena antes de llamar al handler. Devuelve
     * los nodos encontrados, que es lo que estos juegos necesitan luego para
     * reescribir la etiqueta de los dos a la vez (`vs IA` / `2 Jugadores`).
     *
     * Se resuelve UNA vez, al llamar: si un juego crea botones después tiene que
     * volver a llamar, igual que gridKeyboard tras cada render. */
    function buttons(selector, handler, opts) {
        opts = opts || {};
        var sound = opts.sound !== false;
        if (!global.document) return [];
        var nodes = global.document.querySelectorAll(selector);
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            out.push(nodes[i]);
            nodes[i].addEventListener('click', function () {
                if (sound && global.GameAudio && global.GameAudio.click) global.GameAudio.click();
                handler();
            });
        }
        return out;
    }

    /* A persisted personal best.
     *
     * Every game does load-compare-store by hand, and the three that record a
     * TIME rather than a score (laberinto, memorama, slidingpuzzle) each had to
     * invert the comparison themselves — laberinto's record detection is still
     * subtly wrong because of it. `lower: true` inverts it once, here.
     *
     *   var best = GU.highScore('snakeHighScore');
     *   if (best.submit(score)) GameAudio.win();   // true only on a new record
     *   hud.set({ best: best.value });
     *
     * An empty slot starts at -Infinity (or +Infinity when lower is better), so
     * the very first result always registers as a record — which is what a
     * first run should report, and what a `0` default gets wrong for times. */
    function highScore(key, opts) {
        opts = opts || {};
        var lower = !!opts.lower;
        var empty = lower ? Infinity : -Infinity;

        var api = {
            key: key,
            value: Store.getNum(key, empty),
            /* True when `v` beats the stored best. Persists as a side effect —
             * the caller almost always wants both, and splitting them is how
             * you end up comparing against a value you already overwrote. */
            submit: function (v) {
                if (lower ? v >= api.value : v <= api.value) return false;
                api.value = v;
                Store.setNum(key, v);
                return true;
            },
            /* The stored best, or `fallback` when nothing is stored yet — for
             * display, where Infinity is not what you want to print. */
            display: function (fallback) {
                return isFinite(api.value) ? api.value : (fallback == null ? '—' : fallback);
            },
            has: function () { return isFinite(api.value); },
            reset: function () { api.value = empty; Store.remove(key); }
        };
        return api;
    }

    /* mm:ss, the format the timed games print.
     * opts: {ms: true} -> mm:ss.cs   {hours: true} -> h:mm:ss */
    function formatTime(millis, opts) {
        opts = opts || {};
        var t = Math.max(0, Math.floor(millis));
        var cs = Math.floor((t % 1000) / 10);
        var total = Math.floor(t / 1000);
        var s = total % 60;
        var m = Math.floor(total / 60);
        var out;
        if (opts.hours) {
            var h = Math.floor(m / 60);
            out = h + ':' + pad2(m % 60) + ':' + pad2(s);
        } else {
            out = m + ':' + pad2(s);
        }
        return opts.ms ? out + '.' + pad2(cs) : out;
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    /* ═══════════════════════════════════════════════════════════
       Shapes
    ═══════════════════════════════════════════════════════════ */

    /* Paths only — they call beginPath() and leave the path current, so the
     * caller decides fill, stroke or clip, and can set fillStyle once for a
     * whole batch instead of per shape.
     *
     * These are the three shapes the emoji rule keeps forcing games to hand-roll
     * (canvas shapes only, never ctx.fillText with an emoji). Seven games carry
     * a copy of the star and three carry the heart. */

    /* Five-pointed star by default, point upward. `inner` defaults to the 0.5
     * ratio the existing copies all use. */
    function starPath(ctx, cx, cy, outer, inner, points, rot) {
        if (inner == null) inner = outer * 0.5;
        if (points == null) points = 5;
        if (rot == null) rot = -Math.PI / 2;
        var step = Math.PI / points;
        ctx.beginPath();
        for (var i = 0; i < points * 2; i++) {
            var r = (i % 2 === 0) ? outer : inner;
            var a = rot + i * step;
            var x = cx + Math.cos(a) * r;
            var y = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        return ctx;
    }

    /* `size` is the full width, so a heart of size 20 spans 20px across — the
     * per-game copies used the same convention. */
    function heartPath(ctx, cx, cy, size) {
        var s = size / 2;
        var top = cy - s * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.75);
        ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.2, cx - s * 0.9, top - s * 0.8, cx, top + s * 0.15);
        ctx.bezierCurveTo(cx + s * 0.9, top - s * 0.8, cx + s * 1.4, cy - s * 0.2, cx, cy + s * 0.75);
        ctx.closePath();
        return ctx;
    }

    /* Regular polygon, first vertex pointing up unless `rot` says otherwise. */
    function polygonPath(ctx, cx, cy, r, sides, rot) {
        if (rot == null) rot = -Math.PI / 2;
        ctx.beginPath();
        for (var i = 0; i < sides; i++) {
            var a = rot + i * Math.PI * 2 / sides;
            var x = cx + Math.cos(a) * r;
            var y = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        return ctx;
    }

    /* ═══════════════════════════════════════════════════════════
       Sprite cache
    ═══════════════════════════════════════════════════════════ */

    /* Draw something once into an offscreen canvas, then blit it.
     *
     * This is the single biggest lever available in these games and only
     * bubbleshooter uses it today, where it replaced a live radial gradient per
     * bubble per frame with one drawImage. Anything drawn many times from the
     * same shapes — a grid tile, a pellet, a brick, a card back, an enemy that
     * only has two animation poses — is a candidate.
     *
     *   var chip = GU.sprite(24, 24, function (c) {
     *       var g = c.createRadialGradient(12, 12, 2, 12, 12, 12);
     *       ...
     *   });
     *   chip.drawCentered(ctx, x, y);
     *
     * The offscreen canvas is allocated at device pixel density and the draw
     * callback runs pre-scaled, so the sprite stays sharp on a phone and the
     * callback still works in logical pixels. Blits are in logical pixels too,
     * so a sprite is a drop-in for the shape code it replaces.
     *
     * Two shapes of use: one-off (`GU.sprite`) and keyed (`GU.spriteSheet`),
     * which builds on first request and is the right one for "one per colour"
     * or "one per piece type". */
    function sprite(w, h, draw, opts) {
        opts = opts || {};
        if (!global.document) return null;
        var dpr = Math.min(global.devicePixelRatio || 1, opts.maxScale || HIDPI_MAX);
        var pad = opts.pad || 0;                /* room for a glow or a stroke */
        var lw = w + pad * 2, lh = h + pad * 2;

        var c = global.document.createElement('canvas');
        c.width  = Math.max(1, Math.round(lw * dpr));
        c.height = Math.max(1, Math.round(lh * dpr));
        var cx = c.getContext('2d');
        cx.scale(dpr, dpr);
        cx.translate(pad, pad);
        draw(cx, w, h);

        return {
            canvas: c,
            w: w, h: h, pad: pad,
            /* x,y is the sprite's top-left in the DESTINATION's coordinates —
             * the padding is drawn outside it, exactly where the original shape
             * code would have put the overspill. */
            draw: function (ctx, x, y) {
                ctx.drawImage(c, x - pad, y - pad, lw, lh);
            },
            drawCentered: function (ctx, x, y) {
                ctx.drawImage(c, x - w / 2 - pad, y - h / 2 - pad, lw, lh);
            },
            /* Rotated blit. Costs a save/restore, so it is still worth it
             * against rebuilding gradients but not against a bare fillRect. */
            drawRotated: function (ctx, x, y, angle) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.drawImage(c, -w / 2 - pad, -h / 2 - pad, lw, lh);
                ctx.restore();
            }
        };
    }

    /* Lazily-built, keyed family of sprites.
     *
     *   var bubbles = GU.spriteSheet(function (color) {
     *       return GU.sprite(R * 2, R * 2, function (c) { ...draw in `color`... });
     *   });
     *   bubbles.get('#ff512f').drawCentered(ctx, x, y);
     *
     * The key must cover everything the sprite's appearance depends on, and it
     * must be BOUNDED — the same warning as gradientMemo(). Keying on a moving
     * coordinate leaks a whole canvas per frame, which is far worse than the
     * gradient it was meant to save. */
    function spriteSheet(build) {
        var cache = {};
        return {
            get: function (key) {
                var s = cache[key];
                if (s === undefined) s = cache[key] = build(key);
                return s;
            },
            clear: function () { cache = {}; },
            size: function () { return Object.keys(cache).length; }
        };
    }

    /* ═══════════════════════════════════════════════════════════
       Exports
    ═══════════════════════════════════════════════════════════ */

    var GameUtils = {
        rafInterval: rafInterval, rafClear: rafClear, rafLoop: rafLoop,
        clamp: clamp, lerp: lerp, dist: dist, dist2: dist2,
        rand: rand, randInt: randInt, pick: pick, shuffle: shuffle,
        angleDelta: angleDelta,
        easeOutQuad: easeOutQuad, easeInQuad: easeInQuad, easeInOutQuad: easeInOutQuad,
        rectsOverlap: rectsOverlap, circlesOverlap: circlesOverlap,
        hexToRgb: hexToRgb, shade: shade, scaleColor: scaleColor,
        rgba: rgba, mixColor: mixColor,
        pointerPos: pointerPos, roundRectPath: roundRectPath, keyActivate: keyActivate, gridKeyboard: gridKeyboard,
        canvasCursor: canvasCursor, wirePopups: wirePopups,
        gradientMemo: gradientMemo,
        upgradeCanvas: upgradeCanvas, upgradeAllCanvases: upgradeAllCanvases,
        Store: Store, Particles: Particles, Shake: Shake,
        swipe: swipe, keys: keys,
        hud: hud, popup: popup, controls: controls, buttons: buttons,
        highScore: highScore, formatTime: formatTime,
        starPath: starPath, heartPath: heartPath, polygonPath: polygonPath,
        sprite: sprite, spriteSheet: spriteSheet
    };

    global.GameUtils = GameUtils;
    global.GU = GameUtils;

    /* Flat globals. These are exactly the names the games already call
     * unqualified — each one replaced a per-game copy of the same function, so
     * the call sites stayed untouched. Everything else lives on `GU` only, to
     * keep generic names (dist, rand, pick, shuffle) out of the global scope.
     * A game that declares its own `clamp`/`lerp` simply shadows these. */
    global.rafInterval = rafInterval;
    global.rafClear    = rafClear;
    global.rafLoop     = rafLoop;
    global.GameStore   = Store;
    global.Particles   = Particles;
    global.Shake       = Shake;
    global.pointerPos  = pointerPos;
    global.clamp       = clamp;
    global.lerp        = lerp;
    global.shade       = shade;
    global.hexToRgb    = hexToRgb;

    /* Upgrade every canvas now, at script-evaluation time. game-utils.js is
     * loaded at the end of <body> — after the markup, before main.js — so the
     * canvas exists and no game has called getContext() yet. Doing it later
     * (DOMContentLoaded) would be too late: the context would already be live
     * without the base transform. */
    upgradeAllCanvases();

    /* Los popups existen ya en el markup, pero este script corre antes de que
       el documento termine; esperar a DOMContentLoaded para cazarlos todos. */
    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', wirePopups);
        } else {
            wirePopups();
        }
    }

}(typeof window !== 'undefined' ? window : this));

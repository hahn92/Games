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
        gradientMemo: gradientMemo,
        upgradeCanvas: upgradeCanvas, upgradeAllCanvases: upgradeAllCanvases,
        Store: Store, Particles: Particles
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

}(typeof window !== 'undefined' ? window : this));

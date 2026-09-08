/* Miniatura de ciempies para el catálogo. La carga thumbnails.js bajo demanda,
 * cuando la tarjeta entra en pantalla — ver la nota de ese fichero. */
(function () {
    var W = 220, H = 220;

    /* ── palette ── */
    var C = {
        bg:     '#181818',
        card:   '#242424',
        blue:   '#8fd3f4',
        orange: '#ff512f',
        grad0:  '#1a2980',
        grad1:  '#26d0ce',
        green:  '#538d4e',
        yellow: '#b59f3b',
        dark:   '#3a3a3c',
        white:  '#f0f0f0',
        red:    '#e53935',
    };

    function clr(ctx, color) { ctx.fillStyle = color; ctx.strokeStyle = color; }

    function background(ctx, color) {
        ctx.fillStyle = color || C.bg;
        ctx.fillRect(0, 0, W, H);
    }

    function gradBg(ctx, c0, c1) {
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, c0 || C.grad0);
        g.addColorStop(1, c1 || C.grad1);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    }

    var draw = function (ctx) {
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#050a12'); bg.addColorStop(1, '#0a1424');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            /* setas */
            function shroom(x, y, s) {
                ctx.fillStyle = '#d98f3c';
                ctx.beginPath(); ctx.arc(x, y, s, Math.PI, 0); ctx.closePath(); ctx.fill();
                ctx.fillRect(x - s * 0.32, y, s * 0.64, s * 0.9);
            }
            var ms = [[30, 46], [92, 34], [150, 58], [196, 40], [60, 96], [178, 104], [116, 120]];
            for (var i = 0; i < ms.length; i++) shroom(ms[i][0], ms[i][1], 9);

            /* dos trozos de ciempiés: el de arriba entero, el de abajo partido */
            function worm(pts) {
                for (var k = pts.length - 1; k >= 0; k--) {
                    ctx.fillStyle = k === 0 ? '#ff512f' : (k % 2 ? '#8fff6a' : '#6cd94f');
                    ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], 8, 0, Math.PI * 2); ctx.fill();
                    if (k === 0) {
                        ctx.fillStyle = '#fff';
                        ctx.beginPath();
                        ctx.arc(pts[k][0] - 3, pts[k][1] - 2, 1.8, 0, Math.PI * 2);
                        ctx.arc(pts[k][0] + 3, pts[k][1] - 2, 1.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            worm([[168, 78], [152, 78], [136, 78], [120, 78], [104, 78]]);
            worm([[52, 140], [36, 140], [20, 140]]);
            worm([[196, 140], [180, 140], [164, 140], [148, 140]]);

            /* nave y disparo */
            ctx.fillStyle = '#ffe98a'; ctx.fillRect(107, 152, 3, 12);
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.moveTo(108, 174); ctx.lineTo(120, 194); ctx.lineTo(108, 189);
            ctx.lineTo(96, 194); ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#8fff6a';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('CIEMPIÉS', W / 2, H - 10);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['ciempies'] = draw;
}());

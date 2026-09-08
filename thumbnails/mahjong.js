/* Miniatura de mahjong para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#15402b'); bg.addColorStop(1, '#0a2418');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            function face(x, y, w, h, suit, n) {
                var cx = x + w / 2, cy = y + h / 2 - 2;
                var cols = n <= 3 ? 1 : 2, rows = Math.ceil(n / cols);
                var r = n <= 3 ? 3.6 : 3;
                ctx.fillStyle = suit === 0 ? '#1f6fb2' : suit === 1 ? '#2f8f3f' : '#b03a2e';
                for (var row = 0; row < rows; row++) {
                    var inRow = Math.min(cols, n - row * cols);
                    for (var col = 0; col < inRow; col++) {
                        var px = cx + (col - (inRow - 1) / 2) * 8;
                        var py = cy + (row - (rows - 1) / 2) * 7;
                        if (suit === 0) { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
                        else if (suit === 1) ctx.fillRect(px - r * 0.45, py - r * 1.3, r * 0.9, r * 2.6);
                        else ctx.fillRect(px - r * 1.2, py - r * 0.35, r * 2.4, r * 0.7);
                    }
                }
            }
            function tile(x, y, suit, n, sel) {
                var w = 28, h = 36;
                ctx.fillStyle = '#9c9384'; ctx.fillRect(x + 3, y + 3, w, h);
                ctx.fillStyle = '#f6f2e7'; ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = sel ? '#00e5ff' : '#a49b8b';
                ctx.lineWidth = sel ? 2.5 : 1;
                ctx.strokeRect(x, y, w, h);
                face(x, y, w, h, suit, n);
            }
            /* dos filas base y una encima, para que se vea el relieve */
            var base = [[16, 66], [46, 66], [76, 66], [106, 66], [136, 66], [166, 66],
                        [16, 110], [46, 110], [76, 110], [106, 110], [136, 110], [166, 110]];
            var kinds = [[0, 1], [1, 3], [2, 5], [0, 4], [1, 7], [2, 2],
                         [2, 5], [0, 9], [1, 3], [2, 8], [0, 6], [1, 1]];
            for (var i = 0; i < base.length; i++) {
                tile(base[i][0], base[i][1], kinds[i][0], kinds[i][1], i === 2 || i === 6);
            }
            var top = [[61, 88], [91, 88], [121, 88]];
            var tk = [[0, 2], [1, 5], [2, 3]];
            for (var k = 0; k < top.length; k++) tile(top[k][0], top[k][1], tk[k][0], tk[k][1], false);

            ctx.fillStyle = '#f6f2e7';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('MAHJONG', W / 2, 34);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['mahjong'] = draw;
}());

/* Miniatura de timbiriche para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#16233c'); bg.addColorStop(1, '#080d18');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 4, m = W * 0.72, s = m / n, ox = (W - m) / 2, oy = 30;
            function px(c) { return ox + c * s; }
            function py(r) { return oy + r * s; }
            /* Dos cuadros cerrados, uno de cada, y una cadena a medio hacer. */
            ctx.fillStyle = 'rgba(143,211,244,0.28)'; ctx.fillRect(px(0), py(0), s, s);
            ctx.fillStyle = 'rgba(255,138,61,0.28)'; ctx.fillRect(px(2), py(1), s, s);
            ctx.strokeStyle = '#dfe9f6'; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath();
            [[0,0,1,0],[0,0,0,1],[0,1,1,1],[1,0,1,1],[1,2,1,3],[2,2,2,3],[1,2,2,2],[1,3,2,3],
             [0,2,0,3],[3,0,3,1],[2,0,3,0]].forEach(function (l) {
                ctx.moveTo(px(l[1]), py(l[0])); ctx.lineTo(px(l[3]), py(l[2]));
            });
            ctx.stroke();
            ctx.fillStyle = '#ffd54a';
            for (var r = 0; r <= n; r++) for (var c = 0; c <= n; c++) {
                ctx.beginPath(); ctx.arc(px(c), py(r), 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#8fd3f4'; ctx.font = 'bold 15px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('T', px(0) + s / 2, py(0) + s / 2);
            ctx.fillStyle = '#ff8a3d';
            ctx.fillText('M', px(2) + s / 2, py(1) + s / 2);
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 12px monospace';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('TIMBIRICHE', W / 2, H - 8);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['timbiriche'] = draw;
}());

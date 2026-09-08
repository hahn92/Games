/* Miniatura de generala para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0f2a1c'); bg.addColorStop(1, '#08170f');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var PIPS = {
                1: [[0.5, 0.5]],
                3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
                4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
                5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
                6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]]
            };
            function die(x, y, s, v, held) {
                ctx.fillStyle = held ? '#ffd54a' : '#f4f1ea';
                ctx.beginPath();
                if (ctx.roundRect) { ctx.roundRect(x, y, s, s, 7); }
                else { ctx.rect(x, y, s, s); }
                ctx.fill();
                ctx.strokeStyle = held ? '#a8811f' : '#b9b3a6'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#26221c';
                var pts = PIPS[v] || PIPS[1];
                for (var i = 0; i < pts.length; i++) {
                    ctx.beginPath();
                    ctx.arc(x + pts[i][0] * s, y + pts[i][1] * s, s * 0.08, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            var vals = [5, 5, 5, 3, 6], held = [1, 1, 1, 0, 0];
            for (var d = 0; d < 5; d++) die(14 + d * 39, 30, 34, vals[d], held[d]);

            /* tabla de puntuación */
            var names = ['Cincos', 'Trío', 'Full', 'Generala'];
            var pts = ['15', '24', '25', '—'];
            for (var i2 = 0; i2 < names.length; i2++) {
                var y = 92 + i2 * 27;
                ctx.fillStyle = 'rgba(255,255,255,0.09)';
                ctx.fillRect(16, y, W - 32, 22);
                ctx.fillStyle = '#e8f2ec';
                ctx.font = '12px Arial'; ctx.textAlign = 'left';
                ctx.fillText(names[i2], 26, y + 16);
                ctx.fillStyle = pts[i2] === '—' ? '#5c6b63' : '#ffd54a';
                ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
                ctx.fillText(pts[i2], W - 26, y + 16);
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 12px monospace'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('GENERALA', W / 2, H - 12);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['generala'] = draw;
}());

/* Miniatura de tron para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#05070f'); bg.addColorStop(1, '#0b1020');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            /* rejilla tenue, un solo trazo para las dos direcciones */
            ctx.strokeStyle = 'rgba(90,160,200,0.12)';
            ctx.lineWidth = 1; ctx.beginPath();
            for (var g = 0; g <= W; g += 22) {
                ctx.moveTo(g + 0.5, 0); ctx.lineTo(g + 0.5, H);
                ctx.moveTo(0, g + 0.5); ctx.lineTo(W, g + 0.5);
            }
            ctx.stroke();

            function trail(pts, col, glow) {
                ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineJoin = 'miter';
                ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
                for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
                ctx.stroke();
                ctx.strokeStyle = glow; ctx.lineWidth = 2;
                ctx.stroke();
                var last = pts[pts.length - 1];
                ctx.fillStyle = '#fff';
                ctx.fillRect(last[0] - 4, last[1] - 4, 8, 8);
            }
            trail([[24, 190], [24, 96], [104, 96], [104, 52], [150, 52]], '#0090aa', '#00e5ff');
            trail([[196, 30], [196, 130], [128, 130], [128, 172], [78, 172]], '#a32a17', '#ff512f');

            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('ESTELAS', W / 2, H - 12);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['tron'] = draw;
}());

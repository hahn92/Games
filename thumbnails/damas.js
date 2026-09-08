/* Miniatura de damas para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#241a12');
            var n = 8, s = (W - 36) / n, ox = 18, oy = 18;
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    ctx.fillStyle = (r + c) % 2 ? '#5d3a1a' : '#d8b98a';
                    ctx.fillRect(ox + c * s, oy + r * s, s, s);
                }
            }
            // fichas: rojas arriba, negras abajo
            function piece(r, c, color, hi, king) {
                var x = ox + c * s + s/2, y = oy + r * s + s/2;
                var g = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, s*0.4);
                g.addColorStop(0, hi); g.addColorStop(1, color);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(x, y, s*0.38, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.arc(x, y, s*0.27, 0, Math.PI*2); ctx.stroke();
                if (king) {
                    ctx.fillStyle = '#ffe082';
                    ctx.beginPath(); ctx.arc(x, y, s*0.13, 0, Math.PI*2); ctx.fill();
                }
            }
            [[0,1],[0,3],[0,5],[1,2],[1,6],[2,1]].forEach(function (p) { piece(p[0], p[1], '#b71c1c', '#ef5350'); });
            piece(2, 5, '#b71c1c', '#ef5350', true);
            [[7,0],[7,4],[7,6],[6,3],[6,5],[5,2]].forEach(function (p) { piece(p[0], p[1], '#1c1c1c', '#555'); });
            // resaltado de movimiento
            ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2;
            ctx.strokeRect(ox + 3 * s, oy + 4 * s, s, s);
            ctx.lineWidth = 1;
        };

    (window.__thumbs = window.__thumbs || {})['damas'] = draw;
}());

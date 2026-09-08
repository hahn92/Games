/* Miniatura de reversi para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#0d2b1a');
            var n = 8, s = (W - 36) / n, ox = 18, oy = 18;
            ctx.fillStyle = '#1b6b3a';
            ctx.fillRect(ox, oy, n * s, n * s);
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            for (var i = 0; i <= n; i++) {
                ctx.beginPath(); ctx.moveTo(ox + i * s, oy); ctx.lineTo(ox + i * s, oy + n * s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(ox, oy + i * s); ctx.lineTo(ox + n * s, oy + i * s); ctx.stroke();
            }
            function disc(r, c, black) {
                var x = ox + c * s + s/2, y = oy + r * s + s/2;
                var g = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, s*0.4);
                if (black) { g.addColorStop(0, '#555'); g.addColorStop(1, '#0c0c0c'); }
                else       { g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9c9c9'); }
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(x, y, s*0.38, 0, Math.PI*2); ctx.fill();
            }
            [[3,3],[4,4],[2,3],[3,4],[4,2],[5,4]].forEach(function (p) { disc(p[0], p[1], true); });
            [[3,2],[4,3],[2,4],[5,3],[4,5]].forEach(function (p) { disc(p[0], p[1], false); });
            // indicadores de movimiento válido
            ctx.fillStyle = 'rgba(255,224,130,0.55)';
            [[2,2],[5,5],[1,4]].forEach(function (p) {
                ctx.beginPath();
                ctx.arc(ox + p[1]*s + s/2, oy + p[0]*s + s/2, 4, 0, Math.PI*2);
                ctx.fill();
            });
        };

    (window.__thumbs = window.__thumbs || {})['reversi'] = draw;
}());

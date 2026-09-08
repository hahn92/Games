/* Miniatura de batallanaval para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#071527');
            var n = 8, s = (W - 44) / n, ox = 22, oy = 22;
            // agua
            ctx.fillStyle = '#0d2c4f';
            ctx.fillRect(ox, oy, n * s, n * s);
            ctx.strokeStyle = 'rgba(143,211,244,0.25)';
            for (var i = 0; i <= n; i++) {
                ctx.beginPath(); ctx.moveTo(ox + i * s, oy); ctx.lineTo(ox + i * s, oy + n * s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(ox, oy + i * s); ctx.lineTo(ox + n * s, oy + i * s); ctx.stroke();
            }
            // barco hundido revelado
            ctx.fillStyle = '#546e7a';
            roundRect(ctx, ox + 1 * s + 4, oy + 2 * s + 5, s * 3 - 8, s - 10, 6, '#546e7a');
            // impactos (X rojas)
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 3;
            [[1,2],[2,2],[3,2],[5,5]].forEach(function (p) {
                var x = ox + p[0]*s + s/2, y = oy + p[1]*s + s/2;
                ctx.beginPath();
                ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6);
                ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6);
                ctx.stroke();
            });
            // fallos (puntos blancos)
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            [[4,1],[6,3],[2,5],[0,6]].forEach(function (p) {
                ctx.beginPath();
                ctx.arc(ox + p[0]*s + s/2, oy + p[1]*s + s/2, 4, 0, Math.PI*2);
                ctx.fill();
            });
            // mira sobre celda objetivo
            var tx = ox + 6 * s + s/2, ty = oy + 6 * s + s/2;
            ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx - 13, ty); ctx.lineTo(tx + 13, ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx, ty - 13); ctx.lineTo(tx, ty + 13); ctx.stroke();
            ctx.lineWidth = 1;
        };

    (window.__thumbs = window.__thumbs || {})['batallanaval'] = draw;
}());

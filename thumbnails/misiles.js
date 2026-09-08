/* Miniatura de misiles para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#050514');
            bg.addColorStop(1, '#141430');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            // estelas de misiles enemigos
            function trail(x0, y0, x1, y1, color) {
                var g = ctx.createLinearGradient(x0, y0, x1, y1);
                g.addColorStop(0, 'rgba(255,81,47,0)');
                g.addColorStop(1, color);
                ctx.strokeStyle = g; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fillRect(x1 - 1.5, y1 - 1.5, 3, 3);
            }
            trail(30, -5, 75, 120, '#ff512f');
            trail(120, -10, 95, 95, '#ff512f');
            trail(200, -5, 170, 130, '#ffa000');
            // explosión interceptora
            var ex = 150, ey = 80;
            var eg = ctx.createRadialGradient(ex, ey, 4, ex, ey, 30);
            eg.addColorStop(0, '#fff');
            eg.addColorStop(0.4, '#ffe082');
            eg.addColorStop(1, 'rgba(255,81,47,0)');
            ctx.fillStyle = eg;
            ctx.beginPath(); ctx.arc(ex, ey, 30, 0, Math.PI*2); ctx.fill();
            // suelo
            ctx.fillStyle = '#1a2f1a';
            ctx.fillRect(0, H - 30, W, 30);
            // ciudades
            ctx.fillStyle = '#8fd3f4';
            [[28, 12], [62, 16], [100, 10], [140, 14], [178, 12]].forEach(function (cd) {
                ctx.fillRect(cd[0], H - 30 - cd[1], 16, cd[1]);
            });
            // base central
            ctx.fillStyle = '#ffe082';
            ctx.beginPath();
            ctx.moveTo(W/2 - 14, H - 30); ctx.lineTo(W/2, H - 48); ctx.lineTo(W/2 + 14, H - 30);
            ctx.closePath(); ctx.fill();
            // mira
            ctx.strokeStyle = '#76ff03'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(170, 50, 8, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(170, 38); ctx.lineTo(170, 62); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(158, 50); ctx.lineTo(182, 50); ctx.stroke();
        };

    (window.__thumbs = window.__thumbs || {})['misiles'] = draw;
}());

/* Miniatura de mancala para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#5a3a1c'); bg.addColorStop(1, '#3a2411');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#6b4522';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(10, 44, W - 20, H - 88, 16);
            else ctx.rect(10, 44, W - 20, H - 88);
            ctx.fill();
            ctx.strokeStyle = '#8a5c2e'; ctx.lineWidth = 3; ctx.stroke();

            function seeds(cx, cy, n, rad, warm) {
                for (var k = 0; k < Math.min(n, 10); k++) {
                    var ang = k * 2.399963;
                    var rr = rad * Math.sqrt((k + 0.5) / Math.min(n, 10));
                    ctx.fillStyle = warm ? '#f0b23c' : '#c8d6e8';
                    ctx.beginPath();
                    ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 2.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            /* graneros */
            [[28, false], [W - 28, true]].forEach(function (s) {
                ctx.fillStyle = '#452a13';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(s[0] - 16, 58, 32, H - 116, 16);
                else ctx.rect(s[0] - 16, 58, 32, H - 116);
                ctx.fill();
                seeds(s[0], H / 2, s[1] ? 5 : 3, 11, s[1]);
            });
            var pr = 17, n = 6;
            for (var i = 0; i < n; i++) {
                var x = 58 + i * ((W - 116) / (n - 1));
                [[H * 0.36, false, 4], [H * 0.64, true, 4]].forEach(function (row) {
                    ctx.fillStyle = '#452a13';
                    ctx.beginPath(); ctx.arc(x, row[0], pr, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = row[1] ? '#8fff6a' : '#2e1c0d';
                    ctx.lineWidth = row[1] ? 2 : 1.5; ctx.stroke();
                    seeds(x, row[0], row[2], pr * 0.6, row[1]);
                });
            }
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('MANCALA', W / 2, 26);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['mancala'] = draw;
}());

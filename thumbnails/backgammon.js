/* Miniatura de backgammon para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#4a3018'); bg.addColorStop(1, '#2a1a0c');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var pw = (W - 24) / 13, barX = 12 + 6 * pw;
            for (var p = 0; p < 12; p++) {
                var col = p >= 6 ? p + 1 : p;
                var x = 12 + col * pw + pw / 2;
                [0, 1].forEach(function (half) {
                    ctx.fillStyle = (p + half) % 2 ? '#c9a06a' : '#8b5e34';
                    var y = half ? H - 8 : 8, dir = half ? -1 : 1;
                    ctx.beginPath();
                    ctx.moveTo(x - pw / 2 + 1, y);
                    ctx.lineTo(x + pw / 2 - 1, y);
                    ctx.lineTo(x, y + dir * (H / 2 - 24));
                    ctx.closePath(); ctx.fill();
                });
            }
            ctx.fillStyle = '#3a2415'; ctx.fillRect(barX, 0, pw, H);
            function checker(x, y, mine) {
                var r = pw * 0.4;
                ctx.fillStyle = mine ? '#2b6ea8' : '#c9c2b6';
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = mine ? '#8fd3f4' : '#7c7368'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = mine ? 'rgba(143,211,244,0.35)' : 'rgba(255,255,255,0.5)';
                ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.32, 0, Math.PI * 2); ctx.fill();
            }
            function stack(col, half, n, mine) {
                var c = col >= 6 ? col + 1 : col;
                var x = 12 + c * pw + pw / 2;
                for (var k = 0; k < n; k++) {
                    var y = half ? H - 8 - pw * 0.4 - k * pw * 0.72 : 8 + pw * 0.4 + k * pw * 0.72;
                    checker(x, y, mine);
                }
            }
            stack(0, 1, 5, true); stack(4, 1, 3, false); stack(11, 1, 2, false);
            stack(0, 0, 5, false); stack(4, 0, 3, true); stack(11, 0, 2, true);
            ctx.fillStyle = '#f4f1ea';
            [[W / 2 - 34, H / 2 - 14], [W / 2 + 6, H / 2 - 14]].forEach(function (d, i) {
                ctx.beginPath(); ctx.roundRect(d[0], d[1], 28, 28, 6); ctx.fill();
                ctx.fillStyle = '#26221c';
                var pips = i === 0 ? [[0.3, 0.3], [0.7, 0.7]] : [[0.5, 0.5], [0.28, 0.28], [0.72, 0.72]];
                pips.forEach(function (q) {
                    ctx.beginPath();
                    ctx.arc(d[0] + q[0] * 28, d[1] + q[1] * 28, 2.6, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.fillStyle = '#f4f1ea';
            });
            ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('BACKGAMMON', W / 2, H - 4);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['backgammon'] = draw;
}());

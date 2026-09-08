/* Miniatura de senku para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#33230f'); bg.addColorStop(1, '#1a1209');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var m = W * 0.8, s = m / 7, ox = (W - m) / 2, oy = (H - m) / 2 - 6;
            ctx.fillStyle = '#7a5326';
            ctx.beginPath(); ctx.roundRect(ox - 10, oy - 10, m + 20, m + 20, 14); ctx.fill();
            for (var r = 0; r < 7; r++) {
                for (var c = 0; c < 7; c++) {
                    if ((r < 2 || r > 4) && (c < 2 || c > 4)) continue;
                    var x = ox + c * s + s / 2, y = oy + r * s + s / 2;
                    ctx.fillStyle = '#4d3315';
                    ctx.beginPath(); ctx.arc(x, y, s * 0.27, 0, Math.PI * 2); ctx.fill();
                    if (r === 3 && c === 3) continue;             // el hueco central
                    var g = ctx.createRadialGradient(x - s * 0.1, y - s * 0.12, s * 0.04, x, y, s * 0.33);
                    g.addColorStop(0, '#eaf3ff'); g.addColorStop(0.55, '#8fd3f4'); g.addColorStop(1, '#2b6ea8');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(x, y, s * 0.31, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.fillText('SENKU', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['senku'] = draw;
}());

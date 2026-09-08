/* Miniatura de lightsout para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#161326'); bg.addColorStop(1, '#0b0916');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 4, pad = 22, cs = (W - pad * 2) / n;
            var on = [1,0,1,1, 0,1,1,0, 1,1,0,0, 0,1,0,1];
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var lit = on[r * n + c];
                    var x = pad + c * cs + 3, y = pad + r * cs + 3, s = cs - 6;
                    var g = ctx.createLinearGradient(0, y, 0, y + s);
                    if (lit) { g.addColorStop(0, '#ffe98a'); g.addColorStop(1, '#f5a623'); }
                    else     { g.addColorStop(0, '#2a2740'); g.addColorStop(1, '#1b1930'); }
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(x, y, s, s, 9); else ctx.rect(x, y, s, s);
                    ctx.fill();
                    if (lit) {
                        ctx.fillStyle = 'rgba(255,255,255,0.35)';
                        ctx.fillRect(x + s * 0.16, y + s * 0.14, s * 0.68, s * 0.28);
                    }
                    ctx.strokeStyle = lit ? '#c07f13' : '#332f4d';
                    ctx.lineWidth = 1.5; ctx.stroke();
                }
            }
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('APAGA LAS LUCES', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['lightsout'] = draw;
}());

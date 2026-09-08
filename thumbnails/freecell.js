/* Miniatura de freecell para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0f5c34'); bg.addColorStop(1, '#083c22');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var cw = 30, ch = 42;
            function card(x, y, label, red) {
                ctx.fillStyle = '#fdfdfb';
                ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 5); ctx.fill();
                ctx.strokeStyle = '#c3ccd8'; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = red ? '#d63c34' : '#1d2430';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(label, x + 3, y + 3);
                ctx.beginPath();
                ctx.arc(x + cw / 2, y + ch * 0.62, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            function slot(x, y) {
                ctx.strokeStyle = 'rgba(255,255,255,0.34)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 5); ctx.stroke();
            }
            var top = 12;
            slot(10, top); card(46, top, 'K', false); slot(82, top); slot(118, top);
            card(W - 10 - cw, top, 'A', true);
            card(W - 46 - cw, top, 'A', false);
            for (var c = 0; c < 5; c++) {
                for (var k = 0; k < 3; k++) {
                    card(14 + c * 36, top + 58 + k * 16, ['10','9','8','7','6'][c], (c + k) % 2 === 0);
                }
            }
            ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('FREECELL', W / 2, H - 8);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['freecell'] = draw;
}());

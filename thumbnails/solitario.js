/* Miniatura de solitario para el catálogo. La carga thumbnails.js bajo demanda,
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
            var g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#1c6b3a');
            g.addColorStop(1, '#124a28');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

            var cw = 30, ch = 42;
            function card(x, y, label, red, faceUp) {
                if (!faceUp) {
                    roundRect(ctx, x, y, cw, ch, 4, '#123a6b');
                    ctx.strokeStyle = '#e8eef7'; ctx.lineWidth = 1;
                    ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5);
                    return;
                }
                roundRect(ctx, x, y, cw, ch, 4, '#fdfdfb');
                ctx.strokeStyle = '#c3ccd8'; ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
                ctx.fillStyle = red ? '#d63c34' : '#1d2430';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(label, x + 3, y + 3);
                // pequeño rombo/pica segun color
                ctx.beginPath();
                if (red) {
                    ctx.moveTo(x + cw - 8, y + 8); ctx.lineTo(x + cw - 4, y + 13);
                    ctx.lineTo(x + cw - 8, y + 18); ctx.lineTo(x + cw - 12, y + 13);
                } else {
                    ctx.moveTo(x + cw - 8, y + 7);
                    ctx.bezierCurveTo(x + cw - 2, y + 12, x + cw - 5, y + 16, x + cw - 8, y + 14);
                    ctx.lineTo(x + cw - 6, y + 18); ctx.lineTo(x + cw - 10, y + 18);
                    ctx.lineTo(x + cw - 8, y + 14);
                    ctx.bezierCurveTo(x + cw - 11, y + 16, x + cw - 14, y + 12, x + cw - 8, y + 7);
                }
                ctx.closePath(); ctx.fill();
            }

            // fila superior: mazo, descarte y fundaciones
            card(12, 12, '', false, false);
            card(48, 12, 'K', false, true);
            for (var f = 0; f < 4; f++) {
                var fx2 = 100 + f * 30;
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
                ctx.strokeRect(fx2, 12, cw - 2, ch);
            }
            card(100, 12, 'A', true, true);
            card(130, 12, 'A', false, true);

            // tablero en abanico
            var cols = [
                [['', false, false], ['Q', true, true]],
                [['', false, false], ['J', false, true], ['10', true, true]],
                [['9', true, true], ['8', false, true]],
                [['K', false, true]]
            ];
            for (var c = 0; c < cols.length; c++) {
                var x = 12 + c * 52;
                for (var i = 0; i < cols[c].length; i++) {
                    var d = cols[c][i];
                    card(x, 80 + i * 22, d[0], d[1], d[2]);
                }
            }

            ctx.fillStyle = '#e8f2e8';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('SOLITARIO', W / 2, H - 14);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['solitario'] = draw;
}());

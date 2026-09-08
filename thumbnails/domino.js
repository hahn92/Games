/* Miniatura de domino para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#17402c'); bg.addColorStop(1, '#0c2418');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var PIP = {
                0: [], 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]],
                3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
                4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
                5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
                6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]]
            };
            function pips(x, y, w, h, n) {
                var pts = PIP[n] || [];
                var rr = Math.min(w, h) * 0.11;
                ctx.fillStyle = '#26221c';
                for (var i = 0; i < pts.length; i++) {
                    ctx.beginPath();
                    ctx.arc(x + pts[i][0] * w, y + pts[i][1] * h, rr, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            /* cadena tumbada */
            var chain = [[3, 5], [5, 2], [2, 6], [6, 1]];
            for (var i = 0; i < chain.length; i++) {
                var x = 16 + i * 48, y = 74, w = 44, h = 26;
                ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#b9b3a6'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
                ctx.strokeStyle = '#8d8880';
                ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); ctx.stroke();
                pips(x, y, w / 2, h, chain[i][0]);
                pips(x + w / 2, y, w / 2, h, chain[i][1]);
            }
            /* mano de abajo, de pie */
            var hand = [[1, 4], [4, 4], [0, 3], [6, 6]];
            for (var k = 0; k < hand.length; k++) {
                var hx = 30 + k * 42, hy = 132, hw = 32, hh = 58;
                ctx.fillStyle = '#f4f1ea'; ctx.fillRect(hx, hy, hw, hh);
                ctx.strokeStyle = k === 3 ? '#8fff6a' : '#b9b3a6';
                ctx.lineWidth = k === 3 ? 2.5 : 1;
                ctx.strokeRect(hx, hy, hw, hh);
                ctx.strokeStyle = '#8d8880'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(hx + 3, hy + hh / 2); ctx.lineTo(hx + hw - 3, hy + hh / 2); ctx.stroke();
                pips(hx, hy, hw, hh / 2, hand[k][0]);
                pips(hx, hy + hh / 2, hw, hh / 2, hand[k][1]);
            }

            ctx.fillStyle = '#f4f1ea';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('DOMINÓ', W / 2, 30);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['domino'] = draw;
}());

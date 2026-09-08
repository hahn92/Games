/* Miniatura de mastermind para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#141726'); bg.addColorStop(1, '#0a0c16');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var COL = ['#ff512f', '#ffd54a', '#8fff6a', '#00e5ff', '#c78fff'];
            function peg(x, y, r, c) {
                var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
                g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, c); g.addColorStop(1, c);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            }

            /* fila oculta */
            ctx.fillStyle = '#1b1f30';
            ctx.fillRect(18, 24, W - 36, 34);
            for (var s = 0; s < 4; s++) {
                ctx.fillStyle = '#2b3145';
                ctx.beginPath(); ctx.arc(42 + s * 34, 41, 11, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#586080';
                ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
                ctx.fillText('?', 42 + s * 34, 46);
            }
            ctx.textAlign = 'left';

            /* tres intentos con sus marcas */
            var rows = [
                { pegs: [0, 1, 2, 3], black: 1, white: 1 },
                { pegs: [3, 0, 4, 1], black: 2, white: 0 },
                { pegs: [1, 1, 3, 0], black: 2, white: 2 }
            ];
            for (var r = 0; r < rows.length; r++) {
                var y = 84 + r * 40;
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(18, y - 15, W - 36, 30);
                for (var i = 0; i < 4; i++) peg(42 + i * 34, y, 12, COL[rows[r].pegs[i]]);
                for (var k = 0; k < 4; k++) {
                    var px = 180 + (k % 2) * 12, py = y - 6 + Math.floor(k / 2) * 12;
                    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fillStyle = k < rows[r].black ? '#ff512f'
                                  : k < rows[r].black + rows[r].white ? '#f0f0f0' : '#2b3145';
                    ctx.fill();
                }
            }

            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('DESCIFRA EL CÓDIGO', W / 2, H - 10);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['mastermind'] = draw;
}());

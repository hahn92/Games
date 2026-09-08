/* Miniatura de tiroalblanco para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0d1c30'); bg.addColorStop(1, '#060d18');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            /* carriles */
            var lanes = [56, 106, 156];
            for (var i = 0; i < lanes.length; i++) {
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.fillRect(0, lanes[i] - 20, W, 40);
                ctx.fillStyle = 'rgba(143,211,244,0.18)';
                ctx.fillRect(0, lanes[i] + 20, W, 2);
            }
            function target(x, y, r, c1, c2, cross) {
                ctx.fillStyle = c1;
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = c2;
                ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = c1;
                ctx.beginPath(); ctx.arc(x, y, r * 0.33, 0, Math.PI * 2); ctx.fill();
                if (cross) {
                    ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x - r * 0.45, y - r * 0.45); ctx.lineTo(x + r * 0.45, y + r * 0.45);
                    ctx.moveTo(x + r * 0.45, y - r * 0.45); ctx.lineTo(x - r * 0.45, y + r * 0.45);
                    ctx.stroke();
                }
            }
            target(48, 56, 18, '#ff512f', '#f4f1ea', false);
            target(150, 56, 11, '#ffd54a', '#3a2f10', false);
            target(96, 106, 15, '#8fff6a', '#123a12', false);
            target(178, 106, 16, '#2b2b33', '#ff512f', true);
            target(62, 156, 18, '#ff512f', '#f4f1ea', false);

            /* cargador */
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 186, 118, 22);
            for (var b = 0; b < 6; b++) {
                ctx.fillStyle = b < 4 ? '#ffd54a' : '#3a3f4c';
                ctx.fillRect(16 + b * 18, 191, 10, 12);
            }
            ctx.fillStyle = '#cfe8f5';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('42s', W - 12, 203);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('GALERÍA DE TIRO', W / 2, 24);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['tiroalblanco'] = draw;
}());

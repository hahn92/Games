/* Miniatura de blackjack para el catálogo. La carga thumbnails.js bajo demanda,
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
            // tapete
            var bg = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 160);
            bg.addColorStop(0, '#1b6b3a');
            bg.addColorStop(1, '#0d3d20');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,224,130,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(W/2, -40, 180, 0.35 * Math.PI, 0.65 * Math.PI); ctx.stroke();
            // carta: as de picas
            function card(x, y, rot, draw) {
                ctx.save();
                ctx.translate(x, y); ctx.rotate(rot);
                roundRect(ctx, -28, -40, 56, 80, 6, '#f7f7f2', 'rgba(0,0,0,0.35)');
                draw();
                ctx.restore();
            }
            function spade(x, y, sc) {
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.moveTo(x, y - 9 * sc);
                ctx.bezierCurveTo(x + 9*sc, y - 1*sc, x + 8*sc, y + 6*sc, x + 1.5*sc, y + 5*sc);
                ctx.bezierCurveTo(x + 2*sc, y + 8*sc, x + 4*sc, y + 10*sc, x + 5*sc, y + 11*sc);
                ctx.lineTo(x - 5*sc, y + 11*sc);
                ctx.bezierCurveTo(x - 4*sc, y + 10*sc, x - 2*sc, y + 8*sc, x - 1.5*sc, y + 5*sc);
                ctx.bezierCurveTo(x - 8*sc, y + 6*sc, x - 9*sc, y - 1*sc, x, y - 9*sc);
                ctx.fill();
            }
            function heart(x, y, sc) {
                ctx.fillStyle = '#d32f2f';
                ctx.beginPath();
                ctx.moveTo(x, y + 9 * sc);
                ctx.bezierCurveTo(x - 11*sc, y - 1*sc, x - 6*sc, y - 10*sc, x, y - 4*sc);
                ctx.bezierCurveTo(x + 6*sc, y - 10*sc, x + 11*sc, y - 1*sc, x, y + 9*sc);
                ctx.fill();
            }
            card(85, 105, -0.12, function () {
                ctx.fillStyle = '#222';
                ctx.font = 'bold 14px monospace';
                ctx.fillText('A', -23, -24);
                spade(0, 0, 1.4);
            });
            card(135, 112, 0.1, function () {
                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 14px monospace';
                ctx.fillText('K', -23, -24);
                heart(0, 0, 1.4);
            });
            // fichas
            function chip(x, y, color) {
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2); ctx.stroke();
                ctx.setLineDash([]);
            }
            chip(48, 185, '#e53935');
            chip(78, 190, '#1e88e5');
            chip(63, 172, '#fdd835');
            // 21
            ctx.fillStyle = '#ffe082';
            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('21', 170, 190);
            ctx.textAlign = 'left';
            ctx.lineWidth = 1;
        };

    (window.__thumbs = window.__thumbs || {})['blackjack'] = draw;
}());

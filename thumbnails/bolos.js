/* Miniatura de bolos para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0a1020');
            bg.addColorStop(1, '#14203a');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            // pista en perspectiva
            var nearY = 200, farY = 52, nearH = 76, farH = 26;
            ctx.fillStyle = '#0b1526';
            ctx.beginPath();
            ctx.moveTo(W / 2 - nearH - 12, nearY); ctx.lineTo(W / 2 - farH - 5, farY);
            ctx.lineTo(W / 2 + farH + 5, farY);   ctx.lineTo(W / 2 + nearH + 12, nearY);
            ctx.closePath(); ctx.fill();

            var lane = ctx.createLinearGradient(0, farY, 0, nearY);
            lane.addColorStop(0, '#6b4a25');
            lane.addColorStop(0.5, '#9c6f38');
            lane.addColorStop(1, '#c08c48');
            ctx.fillStyle = lane;
            ctx.beginPath();
            ctx.moveTo(W / 2 - nearH, nearY); ctx.lineTo(W / 2 - farH, farY);
            ctx.lineTo(W / 2 + farH, farY);   ctx.lineTo(W / 2 + nearH, nearY);
            ctx.closePath(); ctx.fill();

            ctx.strokeStyle = 'rgba(60,35,12,0.35)'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (var i = 1; i < 6; i++) {
                var t = i / 6;
                ctx.moveTo(W / 2 - nearH + t * nearH * 2, nearY);
                ctx.lineTo(W / 2 - farH + t * farH * 2, farY);
            }
            ctx.stroke();

            // bolos en triangulo, cerca del fondo
            function pin(px, py, s) {
                ctx.fillStyle = '#f2f2f4';
                ctx.beginPath();
                ctx.moveTo(px - 3.4 * s, py);
                ctx.bezierCurveTo(px - 4.6 * s, py - 6 * s, px - 1.9 * s, py - 9 * s, px - 2.1 * s, py - 12 * s);
                ctx.bezierCurveTo(px - 2.2 * s, py - 16 * s, px + 2.2 * s, py - 16 * s, px + 2.1 * s, py - 12 * s);
                ctx.bezierCurveTo(px + 1.9 * s, py - 9 * s, px + 4.6 * s, py - 6 * s, px + 3.4 * s, py);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e0453a';
                ctx.fillRect(px - 2.6 * s, py - 10 * s, 5.2 * s, 1.3 * s);
            }
            var rows = [[0], [-1, 1], [-2, 0, 2], [-3, -1, 1, 3]];
            for (var r = 3; r >= 0; r--) {
                for (var k = 0; k < rows[r].length; k++) {
                    pin(W / 2 + rows[r][k] * 8, farY + 34 + r * 9, 1 + r * 0.14);
                }
            }
            // bola con trayectoria curva
            ctx.strokeStyle = 'rgba(143,211,244,0.4)';
            ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(W / 2 + 44, nearY - 12);
            ctx.quadraticCurveTo(W / 2 + 30, farY + 80, W / 2 + 6, farY + 46);
            ctx.stroke();
            ctx.setLineDash([]);
            var bg2 = ctx.createRadialGradient(W / 2 + 38, nearY - 24, 1, W / 2 + 44, nearY - 18, 15);
            bg2.addColorStop(0, '#7fd4ff');
            bg2.addColorStop(0.5, '#2b6fb8');
            bg2.addColorStop(1, '#0d2540');
            ctx.fillStyle = bg2;
            ctx.beginPath(); ctx.arc(W / 2 + 44, nearY - 18, 14, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BOLOS   X  X  9/', W / 2, 28);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['bolos'] = draw;
}());

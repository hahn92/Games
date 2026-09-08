/* Miniatura de hanoi para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#1a1035');
            bg.addColorStop(1, '#0d081e');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            // base
            roundRect(ctx, 14, 168, W - 28, 14, 5, '#5d3a1a');
            // varillas
            var pegs = [50, 110, 170];
            ctx.fillStyle = '#8a5a2a';
            pegs.forEach(function (px) { ctx.fillRect(px - 3, 80, 6, 90); });
            // discos torre origen (3 discos restantes)
            var discCols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5'];
            function disc(px, y, w, color) {
                var g = ctx.createLinearGradient(px - w/2, 0, px + w/2, 0);
                g.addColorStop(0, color);
                g.addColorStop(0.5, '#fff2');
                g.addColorStop(1, color);
                roundRect(ctx, px - w/2, y, w, 14, 7, color);
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(px - w/2 + 4, y + 2, w - 8, 3);
            }
            disc(pegs[0], 152, 64, discCols[4]);
            disc(pegs[0], 136, 52, discCols[3]);
            disc(pegs[0], 120, 40, discCols[2]);
            // torre destino (1 disco)
            disc(pegs[2], 152, 30, discCols[0]);
            // disco en vuelo
            disc(pegs[1], 52, 38, discCols[1]);
            ctx.strokeStyle = 'rgba(255,224,130,0.5)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pegs[1] + 22, 60);
            ctx.quadraticCurveTo(pegs[2] - 20, 60, pegs[2], 140);
            ctx.stroke();
            ctx.setLineDash([]);
            // contador
            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MOV 12 / 31', W/2, 28);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['hanoi'] = draw;
}());

/* Miniatura de billar para el catálogo. La carga thumbnails.js bajo demanda,
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
            // marco de madera
            ctx.fillStyle = '#5d3a1a';
            ctx.fillRect(0, 0, W, H);
            // paño verde
            ctx.fillStyle = '#1b6b3a';
            ctx.fillRect(16, 16, W - 32, H - 32);
            var g = ctx.createRadialGradient(W/2, H/2, 30, W/2, H/2, 150);
            g.addColorStop(0, 'rgba(255,255,255,0.08)');
            g.addColorStop(1, 'rgba(0,0,0,0.25)');
            ctx.fillStyle = g;
            ctx.fillRect(16, 16, W - 32, H - 32);
            // troneras
            ctx.fillStyle = '#0a0a0a';
            [[16,16],[W-16,16],[16,H-16],[W-16,H-16],[W/2,14],[W/2,H-14]].forEach(function (p) {
                ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, Math.PI*2); ctx.fill();
            });
            // bolas de colores en triángulo
            var cols = ['#e53935','#fdd835','#1e88e5','#8e24aa','#fb8c00','#43a047'];
            var bi = 0;
            for (var r = 0; r < 3; r++) {
                for (var c = 0; c <= r; c++) {
                    var bx = 140 + r * 17, by = 110 - r * 10 + c * 20;
                    ctx.fillStyle = cols[bi++ % cols.length];
                    ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.beginPath(); ctx.arc(bx - 3, by - 3, 2.5, 0, Math.PI*2); ctx.fill();
                }
            }
            // bola negra al centro del triángulo
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(157, 110, 9, 0, Math.PI*2); ctx.fill();
            // bola blanca + línea de tiro
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(55, 130); ctx.lineTo(135, 113); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#f5f5f5';
            ctx.beginPath(); ctx.arc(55, 130, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(51, 126, 3, 0, Math.PI*2); ctx.fill();
            // taco
            ctx.strokeStyle = '#c8924f'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(20, 175); ctx.lineTo(46, 138); ctx.stroke();
            ctx.lineWidth = 1;
        };

    (window.__thumbs = window.__thumbs || {})['billar'] = draw;
}());

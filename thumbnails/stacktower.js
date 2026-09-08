/* Miniatura de stacktower para el catálogo. La carga thumbnails.js bajo demanda,
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
            // cielo nocturno con degradado
            var skyG = ctx.createLinearGradient(0, 0, 0, H);
            skyG.addColorStop(0, '#0a1830');
            skyG.addColorStop(0.55, '#362068');
            skyG.addColorStop(1, '#b14c82');
            ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (var i = 0; i < 28; i++) {
                var sx = (i * 53) % W;
                var sy = ((i * 97) % (H - 100)) + 8;
                ctx.fillRect(sx, sy, (i % 3 === 0) ? 2 : 1, (i % 3 === 0) ? 2 : 1);
            }

            // torre apilada (colores que van cambiando por HUE)
            function block(bx, by, bw, bh, hue) {
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(bx + 3, by + bh - 4, bw, 5);
                var g = ctx.createLinearGradient(bx, by, bx, by + bh);
                g.addColorStop(0, 'hsl(' + hue + ',75%,68%)');
                g.addColorStop(1, 'hsl(' + hue + ',70%,38%)');
                ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                ctx.fillRect(bx + 2, by + 2, Math.max(0, bw - 4), 3);
                ctx.strokeStyle = 'hsl(' + hue + ',80%,25%)';
                ctx.lineWidth = 1;
                ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
            }

            // la pila va estrechando hacia arriba
            var baseW = 140, baseX = (W - baseW) / 2, baseY = H - 30;
            var bh = 18;
            var widths = [140, 130, 122, 118, 110, 102, 94, 86, 78];
            var cx = W / 2;
            var cy = baseY;
            var hue = 200;
            for (var k = 0; k < widths.length; k++) {
                var ww = widths[k];
                // desviaciones suaves a izquierda/derecha para dar sensación de apilado
                var off = [0, 4, -3, 5, -4, 3, -2, 4, -3][k];
                block(cx - ww / 2 + off, cy, ww, bh, hue);
                cy -= bh;
                hue = (hue + 18) % 360;
            }

            // bloque activo (flotando)
            var ax = 40, ay = 40, aw = 70;
            block(ax, ay, aw, bh, (hue + 18) % 360);

            // flecha/indicador de movimiento
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.moveTo(ax + aw + 10, ay + bh / 2);
            ctx.lineTo(ax + aw + 22, ay + bh / 2 - 7);
            ctx.lineTo(ax + aw + 22, ay + bh / 2 + 7);
            ctx.closePath(); ctx.fill();

            // partículas tipo "perfecto"
            ctx.fillStyle = 'rgba(255,224,102,0.95)';
            [[135, 78, 2], [150, 70, 3], [165, 82, 2], [120, 90, 2], [175, 95, 3]].forEach(function (p) {
                ctx.fillRect(p[0], p[1], p[2], p[2]);
            });

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Altura: 9', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 42', W - 8, 11);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['stacktower'] = draw;
}());

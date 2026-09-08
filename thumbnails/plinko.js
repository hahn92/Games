/* Miniatura de plinko para el catálogo. La carga thumbnails.js bajo demanda,
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
            // fondo azul profundo con gradiente vertical
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#101c3a');
            bg.addColorStop(1, '#070a1a');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            // franja superior (drop zone)
            ctx.fillStyle = 'rgba(143,211,244,0.08)';
            ctx.fillRect(0, 0, W, 34);
            ctx.strokeStyle = 'rgba(143,211,244,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(W, 34); ctx.stroke();

            // línea guía de la bola
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(110, 26); ctx.lineTo(110, 34); ctx.stroke();
            ctx.setLineDash([]);

            // pinchos: rejilla triangular alterna
            var pegR = 3.2;
            var rows = 6;
            var rowY0 = 54;
            var rowDY = 24;
            var colDX = 28;
            ctx.fillStyle = '#cfe8ff';
            for (var r = 0; r < rows; r++) {
                var even = r % 2 === 0;
                var count = even ? 7 : 8;
                var x0 = even ? 30 : 16;
                for (var c = 0; c < count; c++) {
                    var px = x0 + c * colDX;
                    var py = rowY0 + r * rowDY;
                    ctx.beginPath(); ctx.arc(px, py, pegR, 0, Math.PI * 2); ctx.fill();
                }
            }
            // borde tenue de los pinchos (un pase batch)
            ctx.strokeStyle = 'rgba(143,211,244,0.45)';
            ctx.lineWidth = 1;
            for (var r2 = 0; r2 < rows; r2++) {
                var even2 = r2 % 2 === 0;
                var count2 = even2 ? 7 : 8;
                var x02 = even2 ? 30 : 16;
                for (var c2 = 0; c2 < count2; c2++) {
                    var px2 = x02 + c2 * colDX;
                    var py2 = rowY0 + r2 * rowDY;
                    ctx.beginPath(); ctx.arc(px2, py2, pegR + 0.6, 0, Math.PI * 2); ctx.stroke();
                }
            }

            // bola en caída rebotando (posición representativa)
            var ballX = 110, ballY = 38;
            // trail
            ctx.fillStyle = 'rgba(255,180,90,0.35)';
            ctx.fillRect(110 - 1.5, 28 - 1.5, 3, 3);
            ctx.fillStyle = 'rgba(255,180,90,0.25)';
            ctx.fillRect(108 - 1.5, 20 - 1.5, 3, 3);
            // bola principal
            var bg2 = ctx.createRadialGradient(ballX - 2, ballY - 2, 0, ballX, ballY, 7);
            bg2.addColorStop(0, '#ffe29a');
            bg2.addColorStop(0.5, '#ff8a3d');
            bg2.addColorStop(1, '#c43211');
            ctx.fillStyle = bg2;
            ctx.beginPath(); ctx.arc(ballX, ballY, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.arc(ballX - 2, ballY - 2.5, 1.8, 0, Math.PI * 2); ctx.fill();

            // segunda bola cayendo en otro lado
            var ballX2 = 170, ballY2 = 120;
            ctx.fillStyle = bg2;
            ctx.save(); ctx.translate(ballX2 - ballX, ballY2 - ballY);
            ctx.beginPath(); ctx.arc(ballX, ballY, 7, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.arc(ballX2 - 2, ballY2 - 2.5, 1.8, 0, Math.PI * 2); ctx.fill();

            // ranuras inferiores con multiplicadores
            var slotY = 180, slotH = 40;
            var slots = 7;
            var slotW = W / slots;
            var mults = [0, 1, 3, 10, 3, 1, 0];
            function mcolor(m) {
                if (m >= 10) return '#ff4081';
                if (m >= 3)  return '#ffb347';
                if (m >= 1)  return '#8fd3f4';
                return '#4a4a52';
            }
            // fondo común ranuras
            ctx.fillStyle = '#1a2550';
            ctx.fillRect(0, slotY, W, slotH);
            // barra superior por ranura
            for (var s = 0; s < slots; s++) {
                var m = mults[s];
                ctx.fillStyle = mcolor(m);
                ctx.fillRect(s * slotW + 1, slotY, slotW - 2, 14);
            }
            // divisores
            ctx.strokeStyle = 'rgba(143,211,244,0.3)';
            ctx.lineWidth = 1;
            for (var s2 = 1; s2 < slots; s2++) {
                ctx.beginPath();
                ctx.moveTo(s2 * slotW, slotY);
                ctx.lineTo(s2 * slotW, slotY + slotH);
                ctx.stroke();
            }
            // texto multiplicador (no emoji)
            ctx.font = 'bold 11px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (var s3 = 0; s3 < slots; s3++) {
                var m3 = mults[s3];
                ctx.fillStyle = m3 === 0 ? '#999' : '#111';
                ctx.fillText(m3 + 'x', s3 * slotW + slotW / 2, slotY + 7);
            }

            // partículas de celebración en la ranura 10x (última)
            var partX = W - slotW / 2;
            var partY = slotY + 8;
            var partColor = '#ff4081';
            var partOffsets = [[-10,-6],[ -4,-12],[3,-9],[8,-14],[-6,-16],[2,-18]];
            for (var p = 0; p < partOffsets.length; p++) {
                ctx.globalAlpha = 0.6 + p * 0.04;
                ctx.fillStyle = partColor;
                ctx.fillRect(partX + partOffsets[p][0], partY + partOffsets[p][1], 3, 3);
            }
            ctx.globalAlpha = 1;

            // puntuación arriba
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 15px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('2400', 10, 18);
            ctx.fillStyle = '#ffb347';
            ctx.font = 'bold 13px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('Bolas: 7', W - 10, 18);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['plinko'] = draw;
}());

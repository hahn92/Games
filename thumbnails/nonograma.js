/* Miniatura de nonograma para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0b1424');
            bg.addColorStop(1, '#0f1a2b');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var n = 8, cell = 17, gx = 74, gy = 74;
            // patron a revelar: una carita
            var on = [
                [1,1,1,1,1,1,1,1],
                [1,0,0,0,0,0,0,1],
                [1,0,1,0,0,1,0,1],
                [1,0,1,0,0,1,0,1],
                [1,0,0,0,0,0,0,1],
                [1,0,1,0,0,1,0,1],
                [1,0,0,1,1,0,0,1],
                [1,1,1,1,1,1,1,1]
            ];
            // pistas
            ctx.fillStyle = '#cfe0f5';
            ctx.font = 'bold 9px sans-serif';
            ctx.textBaseline = 'middle';
            for (var r = 0; r < n; r++) {
                var run = 0, groups = [];
                for (var c = 0; c < n; c++) {
                    if (on[r][c]) run++; else if (run) { groups.push(run); run = 0; }
                }
                if (run) groups.push(run);
                ctx.textAlign = 'right';
                for (var k = 0; k < groups.length; k++) {
                    ctx.fillText(String(groups[k]),
                        gx - 5 - (groups.length - 1 - k) * 12, gy + r * cell + cell / 2);
                }
            }
            for (var c2 = 0; c2 < n; c2++) {
                var run2 = 0, g2 = [];
                for (var r2 = 0; r2 < n; r2++) {
                    if (on[r2][c2]) run2++; else if (run2) { g2.push(run2); run2 = 0; }
                }
                if (run2) g2.push(run2);
                ctx.textAlign = 'center';
                for (var k2 = 0; k2 < g2.length; k2++) {
                    ctx.fillText(String(g2[k2]),
                        gx + c2 * cell + cell / 2, gy - 8 - (g2.length - 1 - k2) * 11);
                }
            }
            // celdas: parte resuelta pintada, resto con aspas o vacio
            for (var rr = 0; rr < n; rr++) {
                for (var cc = 0; cc < n; cc++) {
                    var x = gx + cc * cell, y = gy + rr * cell;
                    ctx.fillStyle = ((Math.floor(rr / 4) + Math.floor(cc / 4)) % 2) ? '#22334f' : '#1d2c46';
                    ctx.fillRect(x, y, cell, cell);
                    if (rr < 5 && on[rr][cc]) {
                        ctx.fillStyle = '#8fd3f4';
                        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                    } else if (rr < 5) {
                        ctx.strokeStyle = '#5a6c88'; ctx.lineWidth = 1.4;
                        ctx.beginPath();
                        ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + cell - 5, y + cell - 5);
                        ctx.moveTo(x + cell - 5, y + 5); ctx.lineTo(x + 5, y + cell - 5);
                        ctx.stroke();
                    }
                }
            }
            ctx.strokeStyle = 'rgba(143,211,244,0.55)'; ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (var b = 0; b <= n; b += 4) {
                ctx.moveTo(gx + b * cell, gy); ctx.lineTo(gx + b * cell, gy + n * cell);
                ctx.moveTo(gx, gy + b * cell); ctx.lineTo(gx + n * cell, gy + b * cell);
            }
            ctx.stroke();
            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NONOGRAMA', W / 2, 24);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['nonograma'] = draw;
}());

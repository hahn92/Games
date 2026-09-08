/* Miniatura de sudoku para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0d1526');
            bg.addColorStop(1, '#101a2e');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var pad = 18, grid = W - pad * 2, cell = grid / 9, top = 34;

            // bloques 3x3 alternos
            for (var br = 0; br < 3; br++) {
                for (var bc = 0; bc < 3; bc++) {
                    if ((br + bc) % 2) continue;
                    ctx.fillStyle = '#1b2a49';
                    ctx.fillRect(pad + bc * cell * 3, top + br * cell * 3, cell * 3, cell * 3);
                }
            }
            // fila/columna resaltada de la casilla activa (fila 4, col 4)
            ctx.fillStyle = 'rgba(45,74,122,0.55)';
            ctx.fillRect(pad, top + 4 * cell, grid, cell);
            ctx.fillRect(pad + 4 * cell, top, cell, grid);
            ctx.fillStyle = '#2d4a7a';
            ctx.fillRect(pad + 4 * cell, top + 4 * cell, cell, cell);

            // lineas finas y gruesas, un path cada una
            ctx.strokeStyle = 'rgba(143,211,244,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var k = 0; k <= 9; k++) {
                if (k % 3 === 0) continue;
                ctx.moveTo(pad + k * cell, top); ctx.lineTo(pad + k * cell, top + grid);
                ctx.moveTo(pad, top + k * cell); ctx.lineTo(pad + grid, top + k * cell);
            }
            ctx.stroke();
            ctx.strokeStyle = 'rgba(143,211,244,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var b = 0; b <= 9; b += 3) {
                ctx.moveTo(pad + b * cell, top); ctx.lineTo(pad + b * cell, top + grid);
                ctx.moveTo(pad, top + b * cell); ctx.lineTo(pad + grid, top + b * cell);
            }
            ctx.stroke();

            // cifras: pistas en gris claro, las del jugador en azul
            var given = [[0,0,5],[0,3,7],[1,1,9],[1,4,1],[2,2,8],[2,7,6],
                         [3,0,4],[3,5,3],[4,4,2],[5,3,9],[5,8,1],
                         [6,1,6],[6,6,2],[7,4,8],[7,7,5],[8,5,4],[8,8,7]];
            var mine  = [[0,6,3],[2,4,4],[4,1,7],[6,3,1],[8,2,9]];
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#cfe0f5';
            given.forEach(function (g) {
                ctx.fillText(String(g[2]), pad + g[1] * cell + cell / 2, top + g[0] * cell + cell / 2);
            });
            ctx.fillStyle = '#8fd3f4';
            ctx.font = '13px sans-serif';
            mine.forEach(function (g) {
                ctx.fillText(String(g[2]), pad + g[1] * cell + cell / 2, top + g[0] * cell + cell / 2);
            });

            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('SUDOKU  2:14', W / 2, 18);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['sudoku'] = draw;
}());

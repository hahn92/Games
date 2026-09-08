/* Miniatura de bombas para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#141d31'); bg.addColorStop(1, '#0a1020');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            var C2 = 30, cols = 7, rows = 7, ox = 5, oy = 5;
            function cell(c, r) { return { x: ox + c * C2, y: oy + r * C2 }; }

            /* muros fijos en las celdas pares */
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    var p = cell(c, r);
                    var border = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
                    var pillar = c % 2 === 0 && r % 2 === 0;
                    if (border || pillar) {
                        ctx.fillStyle = '#39415c'; ctx.fillRect(p.x, p.y, C2, C2);
                        ctx.fillStyle = '#22293d'; ctx.fillRect(p.x + 3, p.y + 3, C2 - 6, C2 - 6);
                    }
                }
            }
            /* cajas */
            var crates = [[3, 1], [5, 1], [1, 3], [5, 3], [3, 5]];
            for (var k = 0; k < crates.length; k++) {
                var q = cell(crates[k][0], crates[k][1]);
                ctx.fillStyle = '#a2703c'; ctx.fillRect(q.x + 2, q.y + 2, C2 - 4, C2 - 4);
                ctx.strokeStyle = '#7a5228'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(q.x + 5, q.y + C2 / 2); ctx.lineTo(q.x + C2 - 5, q.y + C2 / 2);
                ctx.stroke();
            }
            /* explosión en cruz */
            var bx = 3, by = 3;
            var flame = [[3, 3], [2, 3], [4, 3], [3, 2], [3, 4]];
            for (var f = 0; f < flame.length; f++) {
                var fp = cell(flame[f][0], flame[f][1]);
                ctx.fillStyle = 'rgba(255,175,60,0.8)';
                ctx.fillRect(fp.x + 2, fp.y + 2, C2 - 4, C2 - 4);
                ctx.fillStyle = 'rgba(255,240,180,0.7)';
                ctx.fillRect(fp.x + 8, fp.y + 8, C2 - 16, C2 - 16);
            }
            /* bomba */
            var bp = cell(1, 5);
            ctx.fillStyle = '#1b1b22';
            ctx.beginPath(); ctx.arc(bp.x + C2 / 2, bp.y + C2 / 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bp.x + C2 / 2 + 3, bp.y + C2 / 2 - 10);
            ctx.lineTo(bp.x + C2 / 2 + 7, bp.y + C2 / 2 - 17);
            ctx.stroke();
            /* jugador */
            var pp = cell(5, 5);
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); ctx.arc(pp.x + C2 / 2, pp.y + C2 / 2 - 2, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0c3b47';
            ctx.fillRect(pp.x + C2 / 2 - 7, pp.y + C2 / 2 + 2, 14, 7);

            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('BOMBAS', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['bombas'] = draw;
}());
